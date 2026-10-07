import "server-only";

import type {
  DecodedIdToken,
} from "firebase-admin/auth";

import {
  NextResponse,
} from "next/server";

import {
  adminAuth,
  adminDb,
} from "@/src/lib/firebaseAdmin";

import {
  enforceUserApiRateLimit,
  type ApiRateLimitProfile,
} from "@/src/lib/apiRateLimit";

import {
  isActiveGamesAdmin,
  resolveCurrentGamesSeasonId,
  resolveGameEntitlement,
} from "@/src/server/games/GamesEntitlementServer";

const GAMES_MAINTENANCE_MODE =
  process.env.GAMES_MAINTENANCE_MODE
    ?.trim()
    .toLowerCase() !==
  "false";

export type GamesApiAccessResult =
  | {
      ok:
        true;

      decodedToken:
        DecodedIdToken;
    }
  | {
      ok:
        false;

      response:
        NextResponse;
    };

export type GamesApiAccessOptions = {
  rateLimitProfile?:
    ApiRateLimitProfile;

  /*
   * Facoltativi: le route possono passarli esplicitamente.
   * Se gameId non viene indicato, per le route pubbliche dei
   * Games viene ricavato automaticamente dal pathname.
   */
  gameId?:
    string;

  gamesSeasonId?:
    string;

  enforceGameEntitlement?:
    boolean;
};

export async function requireGamesApiAccess(
  request:
    Request,
  options:
    GamesApiAccessOptions = {},
): Promise<GamesApiAccessResult> {
  const authorizationHeader =
    request.headers.get(
      "authorization",
    );

  if (
    !authorizationHeader?.startsWith(
      "Bearer ",
    )
  ) {
    return unauthorized(
      "Autenticazione richiesta.",
    );
  }

  const idToken =
    authorizationHeader
      .slice(
        "Bearer ".length,
      )
      .trim();

  if (
    !idToken
  ) {
    return unauthorized(
      "Token di autenticazione mancante.",
    );
  }

  let decodedToken:
    DecodedIdToken;

  try {
    decodedToken =
      await adminAuth.verifyIdToken(
        idToken,
      );
  } catch (
    error
  ) {
    console.error(
      "Token Games non valido:",
      error,
    );

    return unauthorized(
      "Sessione non valida o scaduta.",
    );
  }

  let maintenanceAdmin =
    false;

  if (
    GAMES_MAINTENANCE_MODE
  ) {
    try {
      const adminSnapshot =
        await adminDb
          .collection(
            "admins",
          )
          .doc(
            decodedToken.uid,
          )
          .get();

      maintenanceAdmin =
        Boolean(
          adminSnapshot.exists &&
            adminSnapshot.data()
              ?.active ===
              true,
        );

      if (
        !maintenanceAdmin
      ) {
        return {
          ok:
            false,

          response:
            buildMaintenanceResponse(),
        };
      }
    } catch (
      error
    ) {
      console.error(
        "Impossibile verificare accesso Admin Games:",
        error,
      );

      return {
        ok:
          false,

        response:
          buildMaintenanceResponse(),
      };
    }
  }

  if (
    options.rateLimitProfile
  ) {
    const rateLimitResponse =
      await enforceUserApiRateLimit({
        userId:
          decodedToken.uid,

        profile:
          options.rateLimitProfile,
      });

    if (
      rateLimitResponse
    ) {
      return {
        ok:
          false,

        response:
          rateLimitResponse,
      };
    }
  }

  const entitlementResult =
    await enforceRequestedGameEntitlement({
      request,
      decodedToken,
      options,
      maintenanceAdmin,
    });

  if (
    entitlementResult
  ) {
    return entitlementResult;
  }

  return {
    ok:
      true,

    decodedToken,
  };
}

async function enforceRequestedGameEntitlement({
  request,
  decodedToken,
  options,
  maintenanceAdmin,
}: {
  request:
    Request;

  decodedToken:
    DecodedIdToken;

  options:
    GamesApiAccessOptions;

  maintenanceAdmin:
    boolean;
}): Promise<GamesApiAccessResult | null> {
  if (
    options.enforceGameEntitlement ===
    false
  ) {
    return null;
  }

  const url =
    new URL(
      request.url,
    );

  const gameId =
    normalizeString(
      options.gameId,
    ) ??
    inferPublicGameId(
      url.pathname,
    );

  if (
    !gameId
  ) {
    return null;
  }

  const gamesSeasonId =
    normalizeString(
      options.gamesSeasonId,
    ) ??
    await resolveCurrentGamesSeasonId();

  if (
    !gamesSeasonId
  ) {
    return {
      ok:
        false,

      response:
        NextResponse.json(
          {
            error:
              "Non esiste una Games Season attiva.",

            code:
              "GAMES_SEASON_REQUIRED",
          },
          {
            status:
              409,

            headers: {
              "Cache-Control":
                "no-store",
            },
          },
        ),
    };
  }

  let entitlement =
    await resolveGameEntitlement({
      userId:
        decodedToken.uid,

      gamesSeasonId,
      gameId,

      isAdmin:
        maintenanceAdmin,
    });

  /*
   * In modalità pubblica non abbiamo ancora letto admins/{uid}.
   * Facciamo quella lettura solo quando l'utente non possiede già
   * un entitlement normale, così l'Admin continua ad avere il
   * bypass senza aggiungere una lettura a tutti gli utenti paganti.
   */
  if (
    !entitlement.hasAccess &&
    !maintenanceAdmin &&
    await isActiveGamesAdmin(
      decodedToken.uid,
    )
  ) {
    entitlement =
      await resolveGameEntitlement({
        userId:
          decodedToken.uid,

        gamesSeasonId,
        gameId,

        isAdmin:
          true,
      });
  }

  if (
    entitlement.hasAccess
  ) {
    return null;
  }

  return {
    ok:
      false,

    response:
      NextResponse.json(
        {
          error:
            "Per partecipare a questo gioco devi acquistarlo singolarmente oppure attivare il Games Pass.",

          code:
            "GAME_PURCHASE_REQUIRED",

          gameId,
          gamesSeasonId,
        },
        {
          status:
            403,

          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      ),
  };
}

function inferPublicGameId(
  pathname:
    string,
): string | null {
  const match =
    pathname.match(
      /^\/api\/games\/(?:predictions|prediction|survivor|voting|votazioni)\/([^/]+)/,
    );

  if (
    !match?.[1]
  ) {
    return null;
  }

  try {
    return decodeURIComponent(
      match[1],
    ).trim() ||
      null;
  } catch {
    return match[1].trim() ||
      null;
  }
}

function normalizeString(
  value:
    unknown,
): string | null {
  if (
    typeof value !==
    "string"
  ) {
    return null;
  }

  const normalized =
    value.trim();

  return normalized ||
    null;
}

function unauthorized(
  message:
    string,
): GamesApiAccessResult {
  return {
    ok:
      false,

    response:
      NextResponse.json(
        {
          error:
            message,
        },
        {
          status:
            401,

          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      ),
  };
}

function buildMaintenanceResponse() {
  return NextResponse.json(
    {
      error:
        "Games temporaneamente non disponibili.",

      code:
        "GAMES_MAINTENANCE",
    },
    {
      status:
        503,

      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}
