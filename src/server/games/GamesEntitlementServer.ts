import "server-only";

import {
  adminDb,
} from "@/src/lib/firebaseAdmin";

export type GamesEntitlementReason =
  | "admin"
  | "free"
  | "games_pass"
  | "single_game"
  | "purchase_required";

export type GamesEntitlementResult = {
  hasAccess:
    boolean;

  reason:
    GamesEntitlementReason;

  priceCents:
    number;
};

export type GamesAccessSummary = {
  hasGamesPass:
    boolean;

  purchasedGameIds:
    string[];
};

export function buildGamesGamePurchaseId({
  userId,
  gamesSeasonId,
  gameId,
}: {
  userId:
    string;

  gamesSeasonId:
    string;

  gameId:
    string;
}): string {
  return [
    userId,
    gamesSeasonId,
    gameId,
  ]
    .map(
      encodeDocumentIdPart,
    )
    .join("__");
}

export function buildGamesCheckoutLockId({
  userId,
  gamesSeasonId,
  purchaseType,
  gameId,
}: {
  userId:
    string;

  gamesSeasonId:
    string;

  purchaseType:
    "games_pass" | "single_game";

  gameId?:
    string | null;
}): string {
  if (
    purchaseType ===
    "games_pass"
  ) {
    /*
     * Manteniamo lo stesso ID storico del Games Pass per non
     * interferire con eventuali lock già esistenti.
     */
    return `${userId}-${gamesSeasonId}`;
  }

  if (
    !gameId
  ) {
    throw new Error(
      "GAME_ID_REQUIRED",
    );
  }

  return `single__${buildGamesGamePurchaseId({
    userId,
    gamesSeasonId,
    gameId,
  })}`;
}

export function isActiveGamesPassData(
  value:
    Record<string, unknown> | undefined,
): boolean {
  return Boolean(
    value &&
      (
        value.status ===
          "active" ||
        value.active ===
          true
      ),
  );
}

export function isActiveSingleGamePurchaseData(
  value:
    Record<string, unknown> | undefined,
): boolean {
  return Boolean(
    value &&
      value.status ===
        "active",
  );
}

export async function getUserGamesAccessSummary({
  userId,
  gamesSeasonId,
}: {
  userId:
    string;

  gamesSeasonId:
    string;
}): Promise<GamesAccessSummary> {
  const subscriptionId =
    `${userId}-${gamesSeasonId}`;

  const [
    subscriptionSnapshot,
    purchasesSnapshot,
  ] =
    await Promise.all([
      adminDb
        .collection(
          "gamesSubscriptions",
        )
        .doc(
          subscriptionId,
        )
        .get(),

      adminDb
        .collection(
          "gamesGamePurchases",
        )
        .where(
          "userId",
          "==",
          userId,
        )
        .get(),
    ]);

  const purchasedGameIds =
    purchasesSnapshot.docs
      .map(
        (
          document,
        ) =>
          document.data(),
      )
      .filter(
        (
          data,
        ) =>
          data.gamesSeasonId ===
            gamesSeasonId &&
          isActiveSingleGamePurchaseData(
            data,
          ),
      )
      .map(
        (
          data,
        ) =>
          typeof data.gameId ===
          "string"
            ? data.gameId.trim()
            : "",
      )
      .filter(
        Boolean,
      );

  return {
    hasGamesPass:
      isActiveGamesPassData(
        subscriptionSnapshot.data(),
      ),

    purchasedGameIds:
      Array.from(
        new Set(
          purchasedGameIds,
        ),
      ),
  };
}

export async function resolveGameEntitlement({
  userId,
  gamesSeasonId,
  gameId,
  isAdmin = false,
}: {
  userId:
    string;

  gamesSeasonId:
    string;

  gameId:
    string;

  isAdmin?:
    boolean;
}): Promise<GamesEntitlementResult> {
  if (
    isAdmin
  ) {
    return {
      hasAccess:
        true,

      reason:
        "admin",

      priceCents:
        0,
    };
  }

  const gameSnapshot =
    await adminDb
      .collection(
        "gamesGames",
      )
      .doc(
        gameId,
      )
      .get();

  if (
    !gameSnapshot.exists
  ) {
    return {
      hasAccess:
        false,

      reason:
        "purchase_required",

      priceCents:
        0,
    };
  }

  const gameData =
    gameSnapshot.data() ??
    {};

  const priceCents =
    normalizeNonNegativeInteger(
      gameData.priceCents,
    );

  if (
    priceCents ===
    0
  ) {
    return {
      hasAccess:
        true,

      reason:
        "free",

      priceCents,
    };
  }

  const subscriptionId =
    `${userId}-${gamesSeasonId}`;

  const purchaseId =
    buildGamesGamePurchaseId({
      userId,
      gamesSeasonId,
      gameId,
    });

  const [
    subscriptionSnapshot,
    purchaseSnapshot,
  ] =
    await Promise.all([
      adminDb
        .collection(
          "gamesSubscriptions",
        )
        .doc(
          subscriptionId,
        )
        .get(),

      adminDb
        .collection(
          "gamesGamePurchases",
        )
        .doc(
          purchaseId,
        )
        .get(),
    ]);

  if (
    isActiveGamesPassData(
      subscriptionSnapshot.data(),
    )
  ) {
    return {
      hasAccess:
        true,

      reason:
        "games_pass",

      priceCents,
    };
  }

  if (
    isActiveSingleGamePurchaseData(
      purchaseSnapshot.data(),
    )
  ) {
    return {
      hasAccess:
        true,

      reason:
        "single_game",

      priceCents,
    };
  }

  return {
    hasAccess:
      false,

    reason:
      "purchase_required",

    priceCents,
  };
}

export async function isActiveGamesAdmin(
  userId:
    string,
): Promise<boolean> {
  const snapshot =
    await adminDb
      .collection(
        "admins",
      )
      .doc(
        userId,
      )
      .get();

  return Boolean(
    snapshot.exists &&
      snapshot.data()?.active ===
        true,
  );
}

export async function resolveCurrentGamesSeasonId(): Promise<string | null> {
  const snapshot =
    await adminDb
      .collection(
        "gamesSeasons",
      )
      .where(
        "status",
        "==",
        "active",
      )
      .get();

  if (
    snapshot.empty
  ) {
    return null;
  }

  const now =
    Date.now();

  const candidates =
    snapshot.docs
      .map(
        (
          document,
        ) => {
          const data =
            document.data();

          const startsAtMs =
            toMillis(
              data.startsAt,
            );

          const rawEndsAtMs =
            toMillis(
              data.endsAt,
            );

          const endsAtMs =
            rawEndsAtMs ===
            null
              ? null
              : rawEndsAtMs +
                24 *
                60 *
                60 *
                1000 -
                1;

          return {
            id:
              document.id,

            startsAtMs,
            endsAtMs,
          };
        },
      )
      .filter(
        (
          value,
        ) => {
          if (
            value.startsAtMs !==
              null &&
            now <
              value.startsAtMs
          ) {
            return false;
          }

          if (
            value.endsAtMs !==
              null &&
            now >
              value.endsAtMs
          ) {
            return false;
          }

          return true;
        },
      )
      .sort(
        (
          first,
          second,
        ) =>
          (second.startsAtMs ?? 0) -
          (first.startsAtMs ?? 0),
      );

  return (
    candidates[0]?.id ??
    null
  );
}

function encodeDocumentIdPart(
  value:
    string,
): string {
  return encodeURIComponent(
    value.trim(),
  ).replace(
    /%/g,
    "_",
  );
}

function normalizeNonNegativeInteger(
  value:
    unknown,
): number {
  const normalized =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      normalized,
    ) ||
    normalized <
      0
  ) {
    return 0;
  }

  return Math.floor(
    normalized,
  );
}

function toMillis(
  value:
    unknown,
): number | null {
  if (
    value instanceof
    Date
  ) {
    const time =
      value.getTime();

    return Number.isFinite(
      time,
    )
      ? time
      : null;
  }

  if (
    value &&
    typeof value ===
      "object"
  ) {
    const maybeTimestamp =
      value as {
        toDate?: () => Date;
        toMillis?: () => number;
        seconds?: number;
      };

    if (
      typeof maybeTimestamp.toMillis ===
      "function"
    ) {
      const time =
        maybeTimestamp.toMillis();

      return Number.isFinite(
        time,
      )
        ? time
        : null;
    }

    if (
      typeof maybeTimestamp.toDate ===
      "function"
    ) {
      const date =
        maybeTimestamp.toDate();

      const time =
        date.getTime();

      return Number.isFinite(
        time,
      )
        ? time
        : null;
    }

    if (
      typeof maybeTimestamp.seconds ===
      "number"
    ) {
      return (
        maybeTimestamp.seconds *
        1000
      );
    }
  }

  if (
    typeof value ===
      "string" ||
    typeof value ===
      "number"
  ) {
    const date =
      new Date(
        value,
      );

    const time =
      date.getTime();

    return Number.isFinite(
      time,
    )
      ? time
      : null;
  }

  return null;
}
