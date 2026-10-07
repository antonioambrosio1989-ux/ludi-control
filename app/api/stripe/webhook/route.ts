import { activatePaidEntitlement, recordPaymentLifecycle } from "@/src/server/payments/StripePaymentLifecycleServer";
import {
  NextResponse,
} from "next/server";

import type Stripe from "stripe";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminDb,
} from "@/src/lib/firebaseAdmin";

import {
  buildGamesCheckoutLockId,
  buildGamesGamePurchaseId,
} from "@/src/server/games/GamesEntitlementServer";

import {
  stripe,
  stripeLiveMode,
} from "@/src/lib/stripe";

export const runtime =
  "nodejs";

const webhookSecret =
  process.env.STRIPE_WEBHOOK_SECRET;

/*
 * ============================================================
 * WEBHOOK EVENT STATUS
 * ============================================================
 */

type StripeWebhookEventStatus =
  | "processing"
  | "processed"
  | "failed";

type StripeWebhookEventData = {
  stripeEventId:
    string;

  eventType:
    string;

  status:
    StripeWebhookEventStatus;

  attempts:
    number;

  processingStartedAtMs:
    number;

  leaseExpiresAtMs:
    number;

  processedAtMs?:
    number;

  failedAtMs?:
    number;

  lastError?:
    string | null;

  createdAt:
    unknown;

  updatedAt:
    unknown;
};

type WebhookClaimResult =
  | {
      kind:
        "process";
    }
  | {
      kind:
        "processed";
    }
  | {
      kind:
        "busy";
    };

const WEBHOOK_PROCESSING_LEASE_MS =
  2 *
  60 *
  1000;

/*
 * ============================================================
 * POST
 * ============================================================
 */

export async function POST(
  request:
    Request,
) {
  /*
   * ==========================================================
   * WEBHOOK SECRET
   * ==========================================================
   */

  if (
    !webhookSecret
  ) {
    console.error(
      "STRIPE_WEBHOOK_SECRET non configurata.",
    );

    return NextResponse.json(
      {
        error:
          "Webhook Stripe non configurato.",
      },
      {
        status:
          500,
      },
    );
  }

  /*
   * ==========================================================
   * STRIPE SIGNATURE
   * ==========================================================
   */

  const signature =
    request.headers.get(
      "stripe-signature",
    );

  if (
    !signature
  ) {
    return NextResponse.json(
      {
        error:
          "Firma Stripe mancante.",
      },
      {
        status:
          400,
      },
    );
  }

  /*
   * ==========================================================
   * VERIFY EVENT
   * ==========================================================
   */

  let event:
    Stripe.Event;

  try {
    const rawBody =
      await request.text();

    event =
      stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );

    if (
      stripeLiveMode &&
      !event.livemode
    ) {
      return NextResponse.json(
        {
          error:
            "Evento Stripe test rifiutato in modalità live.",
        },
        {
          status:
            400,
        },
      );
    }
  } catch (
    error
  ) {
    console.error(
      "Firma webhook Stripe non valida:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Firma webhook non valida.",
      },
      {
        status:
          400,
      },
    );
  }

  /*
   * ==========================================================
   * IDEMPOTENCY CLAIM
   * ==========================================================
   */

  let claim:
    WebhookClaimResult;

  try {
    claim =
      await claimWebhookEvent(
        event,
      );
  } catch (
    error
  ) {
    console.error(
      "Errore acquisizione evento Stripe:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Impossibile acquisire l'evento Stripe.",
      },
      {
        status:
          500,
      },
    );
  }

  /*
   * ==========================================================
   * ALREADY PROCESSED
   * ==========================================================
   */

  if (
    claim.kind ===
    "processed"
  ) {
    return NextResponse.json({
      received:
        true,

      duplicate:
        true,

      eventId:
        event.id,
    });
  }

  /*
   * ==========================================================
   * PROCESSING ALREADY IN PROGRESS
   * ==========================================================
   *
   * Restituiamo 500 per chiedere a Stripe di ritentare.
   * In questo modo un eventuale crash del worker che detiene
   * il lease non può far perdere definitivamente l'evento.
   * ==========================================================
   */

  if (
    claim.kind ===
    "busy"
  ) {
    return NextResponse.json(
      {
        error:
          "Evento Stripe già in elaborazione.",
      },
      {
        status:
          500,
      },
    );
  }

  /*
   * ==========================================================
   * PROCESS EVENT
   * ==========================================================
   */

  try {
    await processStripeEvent(
      event,
    );

    await markWebhookEventAsProcessed(
      event,
    );

    return NextResponse.json({
      received:
        true,

      duplicate:
        false,

      eventId:
        event.id,
    });
  } catch (
    error
  ) {
    console.error(
      "Errore elaborazione webhook Stripe:",
      error,
    );

    try {
      await markWebhookEventAsFailed(
        event,
        error,
      );
    } catch (
      auditError
    ) {
      console.error(
        "Errore registrazione fallimento webhook Stripe:",
        auditError,
      );
    }

    return NextResponse.json(
      {
        error:
          "Errore elaborazione webhook.",
      },
      {
        status:
          500,
      },
    );
  }
}

/*
 * ============================================================
 * CLAIM WEBHOOK EVENT
 * ============================================================
 */

async function claimWebhookEvent(
  event:
    Stripe.Event,
): Promise<
  WebhookClaimResult
> {
  const eventRef =
    adminDb
      .collection(
        "stripeWebhookEvents",
      )
      .doc(
        event.id,
      );

  return adminDb.runTransaction(
    async (
      transaction,
    ) => {
      const snapshot =
        await transaction.get(
          eventRef,
        );

      const now =
        Date.now();

      if (
        snapshot.exists
      ) {
        const data =
          snapshot.data() as
            Partial<
              StripeWebhookEventData
            >;

        if (
          data.status ===
          "processed"
        ) {
          return {
            kind:
              "processed",
          };
        }

        if (
          data.status ===
            "processing" &&
          typeof data.leaseExpiresAtMs ===
            "number" &&
          data.leaseExpiresAtMs >
            now
        ) {
          return {
            kind:
              "busy",
          };
        }

        const previousAttempts =
          typeof data.attempts ===
            "number"
            ? data.attempts
            : 0;

        transaction.set(
          eventRef,
          {
            stripeEventId:
              event.id,

            eventType:
              event.type,

            status:
              "processing",

            attempts:
              previousAttempts +
              1,

            processingStartedAtMs:
              now,

            leaseExpiresAtMs:
              now +
              WEBHOOK_PROCESSING_LEASE_MS,

            lastError:
              null,

            updatedAt:
              FieldValue.serverTimestamp(),
          },
          {
            merge:
              true,
          },
        );

        return {
          kind:
            "process",
        };
      }

      transaction.set(
        eventRef,
        {
          stripeEventId:
            event.id,

          eventType:
            event.type,

          status:
            "processing",

          attempts:
            1,

          processingStartedAtMs:
            now,

          leaseExpiresAtMs:
            now +
            WEBHOOK_PROCESSING_LEASE_MS,

          lastError:
            null,

          createdAt:
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),
        } satisfies StripeWebhookEventData,
      );

      return {
        kind:
          "process",
      };
    },
  );
}

/*
 * ============================================================
 * PROCESS STRIPE EVENT
 * ============================================================
 */

async function processStripeEvent(
  event:
    Stripe.Event,
): Promise<void> {
  switch (
    event.type
  ) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session =
        event.data.object as
          Stripe.Checkout.Session;

      const purchaseType =
        getRequiredMetadata(
          session.metadata
            ?.purchaseType,
        );

      if (
        purchaseType ===
        "games_pass"
      ) {
        await activateGamesPass(
          session,
        );
      } else if (
        purchaseType ===
        "single_game"
      ) {
        await activateSingleGamePurchase(
          session,
        );
      } else {
        return;
      }

      await releaseCheckoutLock(
        session,
      );

      return;
    }

    case "checkout.session.async_payment_failed": {
      const session =
        event.data.object as
          Stripe.Checkout.Session;

      const purchaseType =
        getRequiredMetadata(
          session.metadata
            ?.purchaseType,
        );

      if (
        purchaseType ===
        "games_pass"
      ) {
        await markGamesPassAsPending(
          session,
        );
      } else if (
        purchaseType ===
        "single_game"
      ) {
        await markSingleGamePurchaseAsPending(
          session,
        );
      } else {
        return;
      }

      await releaseCheckoutLock(
        session,
      );

      return;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      if (paymentIntentId) await recordPaymentLifecycle({
        paymentIntentId, eventId: event.id,
        signal: {type: "refund", full: charge.refunded || charge.amount_refunded >= charge.amount},
      });
      return;
    }
    case "charge.dispute.created":
    case "charge.dispute.closed": {
      const dispute = event.data.object as Stripe.Dispute;
      const paymentIntentId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id;
      if (paymentIntentId) await recordPaymentLifecycle({paymentIntentId, eventId: event.id,
        signal: event.type === "charge.dispute.created"
          ? {type: "dispute_opened", created: event.created}
          : {type: "dispute_closed", created: event.created, won: dispute.status === "won"},
      });
      return;
    }
    default:
      return;
  }
}

/*
 * ============================================================
 * MARK EVENT AS PROCESSED
 * ============================================================
 */

async function markWebhookEventAsProcessed(
  event:
    Stripe.Event,
): Promise<void> {
  const now =
    Date.now();

  await adminDb
    .collection(
      "stripeWebhookEvents",
    )
    .doc(
      event.id,
    )
    .set(
      {
        stripeEventId:
          event.id,

        eventType:
          event.type,

        status:
          "processed",

        processedAtMs:
          now,

        leaseExpiresAtMs:
          now,

        lastError:
          null,

        updatedAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge:
          true,
      },
    );
}

/*
 * ============================================================
 * MARK EVENT AS FAILED
 * ============================================================
 */

async function markWebhookEventAsFailed(
  event:
    Stripe.Event,

  error:
    unknown,
): Promise<void> {
  const now =
    Date.now();

  await adminDb
    .collection(
      "stripeWebhookEvents",
    )
    .doc(
      event.id,
    )
    .set(
      {
        stripeEventId:
          event.id,

        eventType:
          event.type,

        status:
          "failed",

        failedAtMs:
          now,

        leaseExpiresAtMs:
          now,

        lastError:
          getErrorMessage(
            error,
          ),

        updatedAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge:
          true,
      },
    );
}

/*
 * ============================================================
 * ACTIVATE GAMES PASS
 * ============================================================
 */

async function activateGamesPass(
  session:
    Stripe.Checkout.Session,
): Promise<void> {
  if (
    session.payment_status !==
    "paid"
  ) {
    return;
  }

  const userId =
    getRequiredMetadata(
      session.metadata?.userId,
    );

  const gamesSeasonId =
    getRequiredMetadata(
      session.metadata
        ?.gamesSeasonId,
    );

  const purchaseType =
    getRequiredMetadata(
      session.metadata
        ?.purchaseType,
    );

  if (
    !userId ||
    !gamesSeasonId ||
    purchaseType !==
      "games_pass"
  ) {
    throw new Error(
      "Metadata Games Pass non valide.",
    );
  }

  const documentId =
    `${userId}-${gamesSeasonId}`;

  await activatePaidEntitlement(adminDb.collection("gamesSubscriptions").doc(documentId), {
        userId,

        gamesSeasonId,

        status:
          "active",

        accessMethod:
          "payment",

        paymentProvider:
          "stripe",

        paymentReference:
          session.id,

        paymentIntentId:
          typeof session.payment_intent ===
            "string"
            ? session.payment_intent
            : session.payment_intent
                ?.id ??
              null,

        amountTotal:
          session.amount_total ??
          null,

        currency:
          session.currency ??
          "eur",

        purchasedAt:
          FieldValue.serverTimestamp(),

        expiresAt:
          null,

        updatedAt:
          FieldValue.serverTimestamp(),

        createdAt:
          FieldValue.serverTimestamp(),
  });
}

/*
 * ============================================================
 * MARK GAMES PASS AS PENDING
 * ============================================================
 */

async function markGamesPassAsPending(
  session:
    Stripe.Checkout.Session,
): Promise<void> {
  const userId =
    getRequiredMetadata(
      session.metadata?.userId,
    );

  const gamesSeasonId =
    getRequiredMetadata(
      session.metadata
        ?.gamesSeasonId,
    );

  const purchaseType =
    getRequiredMetadata(
      session.metadata
        ?.purchaseType,
    );

  if (
    !userId ||
    !gamesSeasonId ||
    purchaseType !==
      "games_pass"
  ) {
    return;
  }

  const documentId =
    `${userId}-${gamesSeasonId}`;

  /*
   * ==========================================================
   * DO NOT DOWNGRADE AN ACTIVE PASS
   * ==========================================================
   *
   * Un evento async_payment_failed vecchio o fuori ordine non
   * deve trasformare un Games Pass già attivo in pending.
   * ==========================================================
   */

  const subscriptionRef =
    adminDb
      .collection(
        "gamesSubscriptions",
      )
      .doc(
        documentId,
      );

  await adminDb.runTransaction(
    async (
      transaction,
    ) => {
      const snapshot =
        await transaction.get(
          subscriptionRef,
        );

      if (
        snapshot.exists &&
        snapshot.data()
          ?.status ===
          "active"
      ) {
        return;
      }

      transaction.set(
        subscriptionRef,
        {
          userId,

          gamesSeasonId,

          status:
            "pending",

          accessMethod:
            "payment",

          paymentProvider:
            "stripe",

          paymentReference:
            session.id,

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge:
            true,
        },
      );
    },
  );
}

/*
 * ============================================================
 * ACTIVATE SINGLE GAME PURCHASE
 * ============================================================
 */

async function activateSingleGamePurchase(
  session:
    Stripe.Checkout.Session,
): Promise<void> {
  if (
    session.payment_status !==
    "paid"
  ) {
    return;
  }

  const userId =
    getRequiredMetadata(
      session.metadata?.userId,
    );

  const gamesSeasonId =
    getRequiredMetadata(
      session.metadata
        ?.gamesSeasonId,
    );

  const gameId =
    getRequiredMetadata(
      session.metadata
        ?.gameId,
    );

  const gameName =
    getRequiredMetadata(
      session.metadata
        ?.gameName,
    );

  const purchaseType =
    getRequiredMetadata(
      session.metadata
        ?.purchaseType,
    );

  if (
    !userId ||
    !gamesSeasonId ||
    !gameId ||
    purchaseType !==
      "single_game"
  ) {
    throw new Error(
      "Metadata acquisto singolo gioco non valide.",
    );
  }

  const documentId =
    buildGamesGamePurchaseId({
      userId,
      gamesSeasonId,
      gameId,
    });

  await activatePaidEntitlement(adminDb.collection("gamesGamePurchases").doc(documentId), {
        userId,
        gamesSeasonId,
        gameId,

        gameName:
          gameName ??
          null,

        status:
          "active",

        purchaseType:
          "single_game",

        accessMethod:
          "payment",

        paymentProvider:
          "stripe",

        paymentReference:
          session.id,

        paymentIntentId:
          typeof session.payment_intent ===
          "string"
            ? session.payment_intent
            : session.payment_intent
                ?.id ??
              null,

        amountTotal:
          session.amount_total ??
          null,

        currency:
          session.currency ??
          "eur",

        purchasedAt:
          FieldValue.serverTimestamp(),

        expiresAt:
          null,

        updatedAt:
          FieldValue.serverTimestamp(),

        createdAt:
          FieldValue.serverTimestamp(),
  });
}

/*
 * ============================================================
 * MARK SINGLE GAME PURCHASE AS PENDING
 * ============================================================
 */

async function markSingleGamePurchaseAsPending(
  session:
    Stripe.Checkout.Session,
): Promise<void> {
  const userId =
    getRequiredMetadata(
      session.metadata?.userId,
    );

  const gamesSeasonId =
    getRequiredMetadata(
      session.metadata
        ?.gamesSeasonId,
    );

  const gameId =
    getRequiredMetadata(
      session.metadata
        ?.gameId,
    );

  const gameName =
    getRequiredMetadata(
      session.metadata
        ?.gameName,
    );

  const purchaseType =
    getRequiredMetadata(
      session.metadata
        ?.purchaseType,
    );

  if (
    !userId ||
    !gamesSeasonId ||
    !gameId ||
    purchaseType !==
      "single_game"
  ) {
    return;
  }

  const purchaseRef =
    adminDb
      .collection(
        "gamesGamePurchases",
      )
      .doc(
        buildGamesGamePurchaseId({
          userId,
          gamesSeasonId,
          gameId,
        }),
      );

  await adminDb.runTransaction(
    async (
      transaction,
    ) => {
      const snapshot =
        await transaction.get(
          purchaseRef,
        );

      if (
        snapshot.exists &&
        snapshot.data()
          ?.status ===
          "active"
      ) {
        return;
      }

      transaction.set(
        purchaseRef,
        {
          userId,
          gamesSeasonId,
          gameId,

          gameName:
            gameName ??
            null,

          status:
            "pending",

          purchaseType:
            "single_game",

          accessMethod:
            "payment",

          paymentProvider:
            "stripe",

          paymentReference:
            session.id,

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge:
            true,
        },
      );
    },
  );
}

/*
 * ============================================================
 * RELEASE CHECKOUT LOCK
 * ============================================================
 */

async function releaseCheckoutLock(
  session:
    Stripe.Checkout.Session,
): Promise<void> {
  const userId =
    getRequiredMetadata(
      session.metadata?.userId,
    );

  const gamesSeasonId =
    getRequiredMetadata(
      session.metadata
        ?.gamesSeasonId,
    );

  const purchaseType =
    getRequiredMetadata(
      session.metadata
        ?.purchaseType,
    );

  const gameId =
    getRequiredMetadata(
      session.metadata
        ?.gameId,
    );

  const checkoutAttemptId =
    getRequiredMetadata(
      session.metadata
        ?.checkoutAttemptId,
    );

  if (
    !userId ||
    !gamesSeasonId ||
    !checkoutAttemptId ||
    (
      purchaseType !==
        "games_pass" &&
      purchaseType !==
        "single_game"
    )
  ) {
    return;
  }

  if (
    purchaseType ===
      "single_game" &&
    !gameId
  ) {
    return;
  }

  const checkoutLockRef =
    adminDb
      .collection(
        "gamesCheckoutLocks",
      )
      .doc(
        buildGamesCheckoutLockId({
          userId,
          gamesSeasonId,
          purchaseType,
          gameId,
        }),
      );

  await adminDb.runTransaction(
    async (
      transaction,
    ) => {
      const snapshot =
        await transaction.get(
          checkoutLockRef,
        );

      if (
        !snapshot.exists
      ) {
        return;
      }

      const currentAttemptId =
        getRequiredMetadata(
          snapshot.data()
            ?.attemptId,
        );

      if (
        currentAttemptId !==
          checkoutAttemptId
      ) {
        return;
      }

      transaction.delete(
        checkoutLockRef,
      );
    },
  );
}

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function getRequiredMetadata(
  value:
    | string
    | null
    | undefined,
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

function getErrorMessage(
  error:
    unknown,
): string {
  if (
    error instanceof
    Error
  ) {
    return error.message;
  }

  return "Errore sconosciuto.";
}
