export type GamesSubscriptionStatus =
  | "pending"
  | "active"
  | "expired"
  | "cancelled";


export type GamesSubscriptionAccessMethod =
  | "payment"
  | "president_code";

export type GamesSubscription = {
  id: string;

  userId: string;

  accessMethod:
  GamesSubscriptionAccessMethod;

  gamesSeasonId: string;

  status:
    GamesSubscriptionStatus;

  purchasedAt?: unknown;

  expiresAt?: unknown;

  paymentProvider?:
    "stripe";

  paymentReference?: string;

  createdAt?: unknown;

  updatedAt?: unknown;
};

export type CreateGamesSubscriptionInput = {
  userId: string;

  gamesSeasonId: string;

  status:
    GamesSubscriptionStatus;

  expiresAt?: Date;

  paymentProvider:
    "stripe";

  paymentReference?: string;
};

export function hasActiveGamesSubscription(
  subscription:
    GamesSubscription | null | undefined,

  gamesSeasonId: string,
): boolean {
  if (!subscription) {
    return false;
  }

  if (
    subscription.status !==
    "active"
  ) {
    return false;
  }

  if (
    String(
      subscription.gamesSeasonId,
    ) !==
    String(
      gamesSeasonId,
    )
  ) {
    return false;
  }

  const expiresAt =
    convertToDate(
      subscription.expiresAt,
    );

  if (
    expiresAt &&
    expiresAt.getTime() <=
      Date.now()
  ) {
    return false;
  }

  return true;
}

function convertToDate(
  value: unknown,
): Date | undefined {
  if (value instanceof Date) {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate ===
      "function"
  ) {
    return value.toDate();
  }

  return undefined;
}