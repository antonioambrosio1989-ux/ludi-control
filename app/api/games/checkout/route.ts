import { randomUUID } from "node:crypto";

import {
  NextResponse,
} from "next/server";

import {
  adminDb,
} from "@/src/lib/firebaseAdmin";

import {
  requireGamesApiAccess,
} from "@/src/lib/requireGamesApiAccess";

import {
  stripe,
} from "@/src/lib/stripe";

import {
  buildGamesCheckoutLockId,
  buildGamesGamePurchaseId,
  isActiveGamesPassData,
  isActiveSingleGamePurchaseData,
} from "@/src/server/games/GamesEntitlementServer";

import {
  resolveCurrentGamesPassPrice,
} from "@/src/services/games/GamesPassPricingService";

import type {
  GamesPassPricePeriod,
} from "@/src/types/GamesSeason";

export const runtime =
  "nodejs";

type PurchaseType =
  | "games_pass"
  | "single_game";

type CheckoutRequestBody = {
  gamesSeasonId?:
    unknown;

  purchaseType?:
    unknown;

  gameId?:
    unknown;
};

type CheckoutLockData = {
  userId:
    string;

  gamesSeasonId:
    string;

  purchaseType:
    PurchaseType;

  gameId?:
    string;

  attemptId:
    string;

  status:
    "creating" | "ready";

  checkoutSessionId?:
    string;

  checkoutUrl?:
    string;

  expiresAtMs:
    number;

  createdAtMs:
    number;

  updatedAtMs:
    number;
};

type CheckoutClaim =
  | {
      kind:
        "create";

      attemptId:
        string;
    }
  | {
      kind:
        "reuse";

      sessionId:
        string;

      checkoutUrl:
        string;
    }
  | {
      kind:
        "busy";
    };

type PurchaseTarget = {
  purchaseType:
    PurchaseType;

  priceCents:
    number;

  productName:
    string;

  description:
    string;

  gameId:
    string | null;

  gameName:
    string | null;

  pricingPeriodId:
    string | null;

  pricingPeriodName:
    string | null;
};

class AlreadyOwnedError extends Error {
  constructor(
    message:
      string,
  ) {
    super(
      message,
    );

    this.name =
      "AlreadyOwnedError";
  }
}

export async function POST(
  request:
    Request,
) {
  try {
    const access =
      await requireGamesApiAccess(
        request,
        {
          rateLimitProfile:
            "gamesCheckout",
        },
      );

    if (
      !access.ok
    ) {
      return access.response;
    }

    const {
      decodedToken,
    } =
      access;

    const body =
      (await request.json()) as
        CheckoutRequestBody;

    const gamesSeasonId =
      getRequiredString(
        body.gamesSeasonId,
      );

    const purchaseType =
      normalizePurchaseType(
        body.purchaseType,
      ) ??
      "games_pass";

    const requestedGameId =
      getRequiredString(
        body.gameId,
      );

    if (
      !gamesSeasonId
    ) {
      return NextResponse.json(
        {
          error:
            "Stagione Games non valida.",
        },
        {
          status:
            400,
        },
      );
    }

    const gamesSeasonSnapshot =
      await adminDb
        .collection(
          "gamesSeasons",
        )
        .doc(
          gamesSeasonId,
        )
        .get();

    if (
      !gamesSeasonSnapshot.exists
    ) {
      return NextResponse.json(
        {
          error:
            "La stagione Games richiesta non esiste.",
        },
        {
          status:
            404,
        },
      );
    }

    const gamesSeasonData =
      gamesSeasonSnapshot.data();

    if (
      !gamesSeasonData
    ) {
      return NextResponse.json(
        {
          error:
            "Dati della stagione Games non disponibili.",
        },
        {
          status:
            500,
        },
      );
    }

    const gamesSeasonName =
      getRequiredString(
        gamesSeasonData.name,
      );

    if (
      !gamesSeasonName
    ) {
      return NextResponse.json(
        {
          error:
            "Nome della stagione Games non valido.",
        },
        {
          status:
            500,
        },
      );
    }

    if (
      gamesSeasonData.status !==
      "active"
    ) {
      return NextResponse.json(
        {
          error:
            "Questa stagione Games non è attiva.",
        },
        {
          status:
            409,
        },
      );
    }

    const target =
      await resolvePurchaseTarget({
        purchaseType,
        requestedGameId,
        gamesSeasonName,
        gamesSeasonData,
      });

    if (
      "response" in target
    ) {
      return target.response;
    }

    const checkoutLockId =
      buildGamesCheckoutLockId({
        userId:
          decodedToken.uid,

        gamesSeasonId,
        purchaseType,
        gameId:
          target.gameId,
      });

    const checkoutLockRef =
      adminDb
        .collection(
          "gamesCheckoutLocks",
        )
        .doc(
          checkoutLockId,
        );

    let checkoutClaim:
      CheckoutClaim;

    try {
      checkoutClaim =
        await adminDb.runTransaction(
          async (
            transaction,
          ) => {
            const subscriptionRef =
              adminDb
                .collection(
                  "gamesSubscriptions",
                )
                .doc(
                  `${decodedToken.uid}-${gamesSeasonId}`,
                );

            const subscriptionSnapshot =
              await transaction.get(
                subscriptionRef,
              );

            if (
              isActiveGamesPassData(
                subscriptionSnapshot.data(),
              )
            ) {
              throw new AlreadyOwnedError(
                purchaseType ===
                  "games_pass"
                  ? "Il Games Pass per questa stagione è già attivo."
                  : "Hai già il Games Pass attivo: questo gioco è già incluso.",
              );
            }

            if (
              purchaseType ===
                "single_game" &&
              target.gameId
            ) {
              const purchaseRef =
                adminDb
                  .collection(
                    "gamesGamePurchases",
                  )
                  .doc(
                    buildGamesGamePurchaseId({
                      userId:
                        decodedToken.uid,

                      gamesSeasonId,
                      gameId:
                        target.gameId,
                    }),
                  );

              const purchaseSnapshot =
                await transaction.get(
                  purchaseRef,
                );

              if (
                isActiveSingleGamePurchaseData(
                  purchaseSnapshot.data(),
                )
              ) {
                throw new AlreadyOwnedError(
                  "Hai già acquistato questo gioco.",
                );
              }
            }

            const checkoutLockSnapshot =
              await transaction.get(
                checkoutLockRef,
              );

            const now =
              Date.now();

            const existingLock =
              checkoutLockSnapshot.exists
                ? checkoutLockSnapshot.data() as
                    CheckoutLockData
                : null;

            if (
              existingLock &&
              existingLock.expiresAtMs >
                now
            ) {
              if (
                existingLock.status ===
                  "ready" &&
                existingLock.checkoutSessionId &&
                existingLock.checkoutUrl
              ) {
                return {
                  kind:
                    "reuse",

                  sessionId:
                    existingLock.checkoutSessionId,

                  checkoutUrl:
                    existingLock.checkoutUrl,
                } satisfies CheckoutClaim;
              }

              return {
                kind:
                  "busy",
              } satisfies CheckoutClaim;
            }

            const attemptId =
              randomUUID();

            const lockTimeoutMs =
              2 *
              60 *
              1000;

            transaction.set(
              checkoutLockRef,
              {
                userId:
                  decodedToken.uid,

                gamesSeasonId,
                purchaseType,

                ...(target.gameId
                  ? {
                      gameId:
                        target.gameId,
                    }
                  : {}),

                attemptId,

                status:
                  "creating",

                expiresAtMs:
                  now +
                  lockTimeoutMs,

                createdAtMs:
                  now,

                updatedAtMs:
                  now,
              } satisfies CheckoutLockData,
            );

            return {
              kind:
                "create",

              attemptId,
            } satisfies CheckoutClaim;
          },
        );
    } catch (
      claimError
    ) {
      if (
        claimError instanceof
        AlreadyOwnedError
      ) {
        return NextResponse.json(
          {
            error:
              claimError.message,
          },
          {
            status:
              409,
          },
        );
      }

      throw claimError;
    }

    if (
      checkoutClaim.kind ===
      "reuse"
    ) {
      return NextResponse.json(
        {
          checkoutUrl:
            checkoutClaim.checkoutUrl,

          sessionId:
            checkoutClaim.sessionId,

          reused:
            true,
        },
      );
    }

    if (
      checkoutClaim.kind ===
      "busy"
    ) {
      return NextResponse.json(
        {
          error:
            "È già in corso la creazione del pagamento. Riprova tra pochi secondi.",
        },
        {
          status:
            409,
        },
      );
    }

    const origin =
      getRequestOrigin(
        request,
      );

    const successUrl =
      buildSuccessUrl({
        origin,
        purchaseType,
        gameId:
          target.gameId,
      });

    const cancelUrl =
      target.gameId
        ? `${origin}/games/acquista?gameId=${encodeURIComponent(
            target.gameId,
          )}`
        : `${origin}/games`;

    const metadata =
      buildCheckoutMetadata({
        userId:
          decodedToken.uid,

        gamesSeasonId,
        gamesSeasonName,
        target,
        checkoutAttemptId:
          checkoutClaim.attemptId,
      });

    let session;

    try {
      session =
        await stripe.checkout.sessions.create(
          {
            mode:
              "payment",

            success_url:
              successUrl,

            cancel_url:
              cancelUrl,

            customer_email:
              decodedToken.email,

            client_reference_id:
              decodedToken.uid,

            line_items: [
              {
                quantity:
                  1,

                price_data: {
                  currency:
                    "eur",

                  unit_amount:
                    target.priceCents,

                  product_data: {
                    name:
                      target.productName,

                    description:
                      target.description,
                  },
                },
              },
            ],

            metadata,

            payment_intent_data: {
              metadata,
            },

            locale:
              "it",
          },
          {
            idempotencyKey:
              purchaseType ===
                "games_pass"
                ? `games-pass-${checkoutClaim.attemptId}`
                : `single-game-${checkoutClaim.attemptId}`,
          },
        );
    } catch (
      stripeError
    ) {
      await checkoutLockRef
        .delete()
        .catch(
          (
            cleanupError,
          ) => {
            console.error(
              "Errore cleanup checkout lock:",
              cleanupError,
            );
          },
        );

      throw stripeError;
    }

    if (
      !session.url
    ) {
      return NextResponse.json(
        {
          error:
            "Stripe non ha restituito il collegamento di pagamento.",
        },
        {
          status:
            500,
        },
      );
    }

    const sessionExpiresAtMs =
      typeof session.expires_at ===
        "number"
        ? session.expires_at *
          1000
        : Date.now() +
          30 *
          60 *
          1000;

    await checkoutLockRef.set(
      {
        userId:
          decodedToken.uid,

        gamesSeasonId,
        purchaseType,

        ...(target.gameId
          ? {
              gameId:
                target.gameId,
            }
          : {}),

        attemptId:
          checkoutClaim.attemptId,

        status:
          "ready",

        checkoutSessionId:
          session.id,

        checkoutUrl:
          session.url,

        expiresAtMs:
          sessionExpiresAtMs,

        updatedAtMs:
          Date.now(),
      },
      {
        merge:
          true,
      },
    );

    return NextResponse.json(
      {
        checkoutUrl:
          session.url,

        sessionId:
          session.id,

        purchaseType,

        gameId:
          target.gameId,

        reused:
          false,
      },
    );
  } catch (
    error
  ) {
    console.error(
      "Errore creazione Stripe Checkout:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Impossibile avviare il pagamento.",
      },
      {
        status:
          500,
      },
    );
  }
}

async function resolvePurchaseTarget({
  purchaseType,
  requestedGameId,
  gamesSeasonName,
  gamesSeasonData,
}: {
  purchaseType:
    PurchaseType;

  requestedGameId:
    string | null;

  gamesSeasonName:
    string;

  gamesSeasonData:
    Record<string, unknown>;
}): Promise<
  PurchaseTarget |
  {
    response:
      NextResponse;
  }
> {
  if (
    purchaseType ===
    "games_pass"
  ) {
    const passPricing =
      normalizeGamesPassPricing(
        gamesSeasonData.passPricing,
      );

    const currentPrice =
      resolveCurrentGamesPassPrice(
        passPricing,
      );

    if (
      !currentPrice
    ) {
      return {
        response:
          NextResponse.json(
            {
              error:
                "Al momento non è disponibile una fascia prezzo valida per il Games Pass.",
            },
            {
              status:
                409,
            },
          ),
      };
    }

    return {
      purchaseType,

      priceCents:
        currentPrice.priceCents,

      productName:
        `Games Pass ${gamesSeasonName}`,

      description:
        currentPrice.name,

      gameId:
        null,

      gameName:
        null,

      pricingPeriodId:
        currentPrice.id,

      pricingPeriodName:
        currentPrice.name,
    };
  }

  if (
    !requestedGameId
  ) {
    return {
      response:
        NextResponse.json(
          {
            error:
              "Gioco non valido.",
          },
          {
            status:
              400,
          },
        ),
    };
  }

  const gameSnapshot =
    await adminDb
      .collection(
        "gamesGames",
      )
      .doc(
        requestedGameId,
      )
      .get();

  if (
    !gameSnapshot.exists
  ) {
    return {
      response:
        NextResponse.json(
          {
            error:
              "Il gioco richiesto non esiste.",
          },
          {
            status:
              404,
          },
        ),
    };
  }

  const gameData =
    gameSnapshot.data() ??
    {};

  const gameName =
    getRequiredString(
      gameData.name,
    ) ??
    "Gioco Ludi";

  const gameStatus =
    resolveEffectiveGameStatus(
      gameData,
    );

  if (
    gameStatus !==
    "active"
  ) {
    return {
      response:
        NextResponse.json(
          {
            error:
              "Questo gioco non è ancora acquistabile.",
          },
          {
            status:
              409,
          },
        ),
    };
  }

  const priceCents =
    normalizePriceCents(
      gameData.priceCents,
    );

  if (
    priceCents <=
    0
  ) {
    return {
      response:
        NextResponse.json(
          {
            error:
              "Questo gioco è gratuito e non richiede un pagamento.",
          },
          {
            status:
              409,
          },
        ),
    };
  }

  return {
    purchaseType,

    priceCents,

    productName:
      gameName,

    description:
      `Accesso al singolo gioco per ${gamesSeasonName}`,

    gameId:
      requestedGameId,

    gameName,

    pricingPeriodId:
      null,

    pricingPeriodName:
      null,
  };
}

function buildCheckoutMetadata({
  userId,
  gamesSeasonId,
  gamesSeasonName,
  target,
  checkoutAttemptId,
}: {
  userId:
    string;

  gamesSeasonId:
    string;

  gamesSeasonName:
    string;

  target:
    PurchaseTarget;

  checkoutAttemptId:
    string;
}): Record<string, string> {
  const metadata:
    Record<string, string> = {
      userId,
      gamesSeasonId,
      gamesSeasonName,

      purchaseType:
        target.purchaseType,

      priceCents:
        String(
          target.priceCents,
        ),

      checkoutAttemptId,
  };

  if (
    target.gameId
  ) {
    metadata.gameId =
      target.gameId;
  }

  if (
    target.gameName
  ) {
    metadata.gameName =
      target.gameName;
  }

  if (
    target.pricingPeriodId
  ) {
    metadata.pricingPeriodId =
      target.pricingPeriodId;
  }

  if (
    target.pricingPeriodName
  ) {
    metadata.pricingPeriodName =
      target.pricingPeriodName;
  }

  return metadata;
}

function buildSuccessUrl({
  origin,
  purchaseType,
  gameId,
}: {
  origin:
    string;

  purchaseType:
    PurchaseType;

  gameId:
    string | null;
}): string {
  if (
    purchaseType ===
    "games_pass"
  ) {
    return (
      `${origin}/games/acquista/successo` +
      "?session_id={CHECKOUT_SESSION_ID}"
    );
  }

  let url =
    `${origin}/games/acquista/successo` +
    "?session_id={CHECKOUT_SESSION_ID}" +
    "&purchaseType=single_game";

  if (
    gameId
  ) {
    url +=
      `&gameId=${encodeURIComponent(
        gameId,
      )}`;
  }

  return url;
}

function normalizePurchaseType(
  value:
    unknown,
): PurchaseType | null {
  if (
    value ===
      "games_pass" ||
    value ===
      "single_game"
  ) {
    return value;
  }

  return null;
}

function normalizeGamesPassPricing(
  value:
    unknown,
): GamesPassPricePeriod[] {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return [];
  }

  return value
    .filter(
      (
        item,
      ): item is Record<
        string,
        unknown
      > =>
        typeof item ===
          "object" &&
        item !==
          null,
    )
    .map(
      (
        item,
      ) => ({
        id:
          getRequiredString(
            item.id,
          ) ??
          "",

        name:
          getRequiredString(
            item.name,
          ) ??
          "",

        priceCents:
          normalizePriceCents(
            item.priceCents,
          ),

        startsAt:
          item.startsAt,

        endsAt:
          item.endsAt ??
          undefined,
      }),
    );
}

function resolveEffectiveGameStatus(
  game:
    Record<string, unknown>,
): string {
  const status =
    getRequiredString(
      game.status,
    ) ??
    "waiting";

  if (
    status !==
    "waiting"
  ) {
    return status;
  }

  const activatesAtMs =
    toMillis(
      game.activatesAt,
    );

  if (
    activatesAtMs !==
      null &&
    activatesAtMs <=
      Date.now()
  ) {
    return "active";
  }

  return status;
}

function getRequiredString(
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

function normalizePriceCents(
  value:
    unknown,
): number {
  const normalized =
    Number(
      value,
    );

  if (
    !Number.isInteger(
      normalized,
    ) ||
    normalized <=
      0
  ) {
    return 0;
  }

  return normalized;
}

function toMillis(
  value:
    unknown,
): number | null {
  if (
    value instanceof
    Date
  ) {
    return Number.isFinite(
      value.getTime(),
    )
      ? value.getTime()
      : null;
  }

  if (
    value &&
    typeof value ===
      "object"
  ) {
    const timestamp =
      value as {
        toMillis?: () => number;
        toDate?: () => Date;
        seconds?: number;
      };

    if (
      typeof timestamp.toMillis ===
      "function"
    ) {
      return timestamp.toMillis();
    }

    if (
      typeof timestamp.toDate ===
      "function"
    ) {
      return timestamp.toDate()
        .getTime();
    }

    if (
      typeof timestamp.seconds ===
      "number"
    ) {
      return timestamp.seconds *
        1000;
    }
  }

  if (
    typeof value ===
      "string" ||
    typeof value ===
      "number"
  ) {
    const parsed =
      new Date(
        value,
      ).getTime();

    return Number.isFinite(
      parsed,
    )
      ? parsed
      : null;
  }

  return null;
}

function getRequestOrigin(
  request:
    Request,
): string {
  const configuredUrl =
    process.env
      .NEXT_PUBLIC_APP_URL
      ?.trim()
      .replace(
        /\/$/,
        "",
      );

  if (
    configuredUrl
  ) {
    return configuredUrl;
  }

  return new URL(
    request.url,
  ).origin;
}
