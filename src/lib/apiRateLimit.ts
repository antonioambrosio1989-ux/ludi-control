import "server-only";

import {
  createHash,
} from "node:crypto";

import {
  NextResponse,
} from "next/server";

import {
  adminDb,
} from "@/src/lib/firebaseAdmin";

/*
 * ============================================================
 * API RATE LIMIT
 * ============================================================
 *
 * Limite distribuito basato su Firestore Admin.
 *
 * Ogni combinazione:
 *
 * - profilo;
 * - identità utente;
 *
 * utilizza un solo documento stabile.
 *
 * L'identità reale NON viene salvata nel documento: il document
 * id è un hash SHA-256 di scope + identità.
 * ============================================================
 */

const RATE_LIMIT_COLLECTION =
  "apiRateLimits";

export type ApiRateLimitProfile =
  | "adminOperationsAssistant"
  | "gamesCheckout"
  | "gamesRedeemCode"
  | "gamesFantasyMutation"
  | "gamesQuizLifecycle"
  | "gamesQuizAnswer"
  | "gamesQuizRead";

export type ApiRateLimitPolicy = {
  scope:
    string;

  limit:
    number;

  windowMs:
    number;
};

export type ApiRateLimitResult = {
  allowed:
    boolean;

  limit:
    number;

  remaining:
    number;

  retryAfterSeconds:
    number;

  resetAtMs:
    number;
};

/*
 * ============================================================
 * POLICIES
 * ============================================================
 *
 * I limiti sono intenzionalmente abbastanza permissivi da non
 * interferire con il normale utilizzo dell'app, ma impediscono
 * burst anomali e tentativi automatizzati ripetuti.
 * ============================================================
 */

const API_RATE_LIMIT_POLICIES:
  Record<
    ApiRateLimitProfile,
    ApiRateLimitPolicy
  > = {
  adminOperationsAssistant: {scope:"admin-operations-assistant",limit:4,windowMs:60*60*1000},
  gamesCheckout: {
    scope:
      "games-checkout",

    limit:
      6,

    windowMs:
      10 *
      60 *
      1000,
  },

  gamesRedeemCode: {
    scope:
      "games-redeem-code",

    limit:
      8,

    windowMs:
      15 *
      60 *
      1000,
  },

  gamesFantasyMutation: {
    scope:
      "games-fantasy-mutation",

    limit:
      60,

    windowMs:
      60 *
      1000,
  },

  gamesQuizLifecycle: {
    scope:
      "games-quiz-lifecycle",

    limit:
      15,

    windowMs:
      60 *
      1000,
  },

  gamesQuizAnswer: {
    scope:
      "games-quiz-answer",

    limit:
      60,

    windowMs:
      60 *
      1000,
  },

  gamesQuizRead: {
    scope:
      "games-quiz-read",

    limit:
      60,

    windowMs:
      60 *
      1000,
  },
};

/*
 * ============================================================
 * USER RATE LIMIT
 * ============================================================
 */

export async function enforceUserApiRateLimit({
  userId,
  profile,
}: {
  userId:
    string;

  profile:
    ApiRateLimitProfile;
}): Promise<NextResponse | null> {
  const normalizedUserId =
    userId.trim();

  if (
    !normalizedUserId
  ) {
    return null;
  }

  try {
    const result =
      await consumeApiRateLimit({
        identity:
          `uid:${normalizedUserId}`,

        policy:
          getApiRateLimitPolicy(
            profile,
          ),
      });

    if (
      result.allowed
    ) {
      return null;
    }

    return buildRateLimitResponse(
      result,
    );
  } catch (
    error
  ) {
    /*
     * ========================================================
     * FAIL OPEN
     * ========================================================
     *
     * Il rate limit è una protezione supplementare.
     * Un errore del contatore non deve rendere indisponibile
     * Games se tutte le verifiche di autenticazione e business
     * logic sono comunque operative.
     * ========================================================
     */

    console.error(
      `Errore rate limit API (${profile}):`,
      error,
    );

    return null;
  }
}

/*
 * ============================================================
 * CONSUME
 * ============================================================
 *
 * Fixed window distribuita.
 *
 * Il documento resta stabile nel tempo e viene semplicemente
 * resettato quando la finestra precedente è terminata.
 * ============================================================
 */

export async function consumeApiRateLimit({
  identity,
  policy,
  nowMs =
    Date.now(),
}: {
  identity:
    string;

  policy:
    ApiRateLimitPolicy;

  nowMs?:
    number;
}): Promise<ApiRateLimitResult> {
  const normalizedIdentity =
    identity.trim();

  if (
    !normalizedIdentity
  ) {
    throw new Error(
      "Identità rate limit non valida.",
    );
  }

  assertPolicy(
    policy,
  );

  const documentId =
    createHash(
      "sha256",
    )
      .update(
        `${policy.scope}\u0000${normalizedIdentity}`,
      )
      .digest(
        "hex",
      );

  const reference =
    adminDb
      .collection(
        RATE_LIMIT_COLLECTION,
      )
      .doc(
        documentId,
      );

  return adminDb.runTransaction(
    async (
      transaction,
    ) => {
      const snapshot =
        await transaction.get(
          reference,
        );

      const data =
        snapshot.exists
          ? snapshot.data()
          : undefined;

      const storedWindowStartedAtMs =
        getFiniteNumber(
          data?.windowStartedAtMs,
        );

      const storedCount =
        getFiniteNumber(
          data?.count,
        );

      const hasActiveWindow =
        storedWindowStartedAtMs !==
          null &&
        storedCount !==
          null &&
        storedCount >=
          0 &&
        nowMs >=
          storedWindowStartedAtMs &&
        nowMs <
          storedWindowStartedAtMs +
            policy.windowMs;

      const windowStartedAtMs =
        hasActiveWindow &&
        storedWindowStartedAtMs !==
          null
          ? storedWindowStartedAtMs
          : nowMs;

      const currentCount =
        hasActiveWindow &&
        storedCount !==
          null
          ? storedCount
          : 0;

      const resetAtMs =
        windowStartedAtMs +
        policy.windowMs;

      const retryAfterSeconds =
        Math.max(
          1,
          Math.ceil(
            (
              resetAtMs -
              nowMs
            ) /
              1000,
          ),
        );

      if (
        currentCount >=
        policy.limit
      ) {
        return {
          allowed:
            false,

          limit:
            policy.limit,

          remaining:
            0,

          retryAfterSeconds,

          resetAtMs,
        };
      }

      const nextCount =
        currentCount +
        1;

      transaction.set(
        reference,
        {
          scope:
            policy.scope,

          count:
            nextCount,

          windowStartedAtMs,

          windowMs:
            policy.windowMs,

          updatedAtMs:
            nowMs,

          resetAtMs,
        },
      );

      return {
        allowed:
          true,

        limit:
          policy.limit,

        remaining:
          Math.max(
            0,
            policy.limit -
              nextCount,
          ),

        retryAfterSeconds,

        resetAtMs,
      };
    },
  );
}

/*
 * ============================================================
 * POLICY
 * ============================================================
 */

export function getApiRateLimitPolicy(
  profile:
    ApiRateLimitProfile,
): ApiRateLimitPolicy {
  return API_RATE_LIMIT_POLICIES[
    profile
  ];
}

/*
 * ============================================================
 * RESPONSE
 * ============================================================
 */

function buildRateLimitResponse(
  result:
    ApiRateLimitResult,
) {
  return NextResponse.json(
    {
      error:
        "Troppe richieste. Riprova tra poco.",

      code:
        "RATE_LIMITED",
    },
    {
      status:
        429,

      headers: {
        "Cache-Control":
          "no-store",

        "Retry-After":
          String(
            result.retryAfterSeconds,
          ),

        "X-RateLimit-Limit":
          String(
            result.limit,
          ),

        "X-RateLimit-Remaining":
          "0",

        "X-RateLimit-Reset":
          String(
            Math.ceil(
              result.resetAtMs /
                1000,
            ),
          ),
      },
    },
  );
}

/*
 * ============================================================
 * VALIDATION
 * ============================================================
 */

function assertPolicy(
  policy:
    ApiRateLimitPolicy,
) {
  if (
    !policy.scope.trim() ||
    !Number.isInteger(
      policy.limit,
    ) ||
    policy.limit <=
      0 ||
    !Number.isFinite(
      policy.windowMs,
    ) ||
    policy.windowMs <=
      0
  ) {
    throw new Error(
      "Configurazione rate limit non valida.",
    );
  }
}

function getFiniteNumber(
  value:
    unknown,
): number | null {
  return typeof value ===
      "number" &&
    Number.isFinite(
      value,
    )
    ? value
    : null;
}
