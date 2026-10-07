import {
  createHash,
} from "crypto";

import {
  NextResponse,
} from "next/server";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminDb,
} from "@/src/lib/firebaseAdmin";

import {
  requireGamesApiAccess,
} from "@/src/lib/requireGamesApiAccess";

export const runtime =
  "nodejs";

/*
 * ============================================================
 * TYPES
 * ============================================================
 */

type RedeemCodeRequestBody = {
  gamesSeasonId?:
    unknown;

  code?:
    unknown;
};

/*
 * ============================================================
 * POST
 * ============================================================
 */

export async function POST(
  request:
    Request,
) {
  try {
        /*
     * ========================================================
     * GAMES ACCESS
     * ========================================================
     */

    const access =
      await requireGamesApiAccess(
        request,
        {
          rateLimitProfile:
            "gamesRedeemCode",
        },
      );

    if (
      !access.ok
    ) {
      return access.response;
    }

    const userId =
      access.decodedToken.uid;

    /*
     * ========================================================
     * BODY
     * ========================================================
     */

    const body =
      (await request.json()) as
        RedeemCodeRequestBody;

    const gamesSeasonId =
      getRequiredString(
        body.gamesSeasonId,
      );

    const plainCode =
      getRequiredString(
        body.code,
      );

    if (
      !gamesSeasonId ||
      !plainCode
    ) {
      return NextResponse.json(
        {
          error:
            "Codice Games Pass non valido.",
        },
        {
          status:
            400,
        },
      );
    }

    /*
     * ========================================================
     * VERIFY ACTIVE GAMES SEASON
     * ========================================================
     */

    const gamesSeasonRef =
      adminDb
        .collection(
          "gamesSeasons",
        )
        .doc(
          gamesSeasonId,
        );

    const gamesSeasonSnapshot =
      await gamesSeasonRef.get();

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
      gamesSeasonData?.status !==
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

    /*
     * ========================================================
     * REFERENCES
     * ========================================================
     */

    const codeHash =
      hashAccessCode(
        plainCode,
      );

    const accessCodeRef =
      adminDb
        .collection(
          "gamesAccessCodes",
        )
        .doc(
          codeHash,
        );

    const subscriptionId =
      `${userId}-${gamesSeasonId}`;

    const subscriptionRef =
      adminDb
        .collection(
          "gamesSubscriptions",
        )
        .doc(
          subscriptionId,
        );

    /*
     * ========================================================
     * ATOMIC REDEMPTION
     * ========================================================
     *
     * Il codice viene verificato e riscattato nella stessa
     * transazione che crea il Games Pass.
     *
     * Due utenti non possono quindi utilizzare lo stesso
     * codice contemporaneamente.
     * ========================================================
     */

    await adminDb.runTransaction(
      async (
        transaction,
      ) => {
        const [
          accessCodeSnapshot,
          subscriptionSnapshot,
        ] =
          await Promise.all([
            transaction.get(
              accessCodeRef,
            ),

            transaction.get(
              subscriptionRef,
            ),
          ]);

        /*
         * ====================================================
         * VERIFY CODE
         * ====================================================
         */

        if (
          !accessCodeSnapshot.exists
        ) {
          throw new RedeemCodeError(
            "Codice non valido.",
            404,
          );
        }

        const accessCodeData =
          accessCodeSnapshot.data();

        if (
          !accessCodeData
        ) {
          throw new RedeemCodeError(
            "Codice non valido.",
            404,
          );
        }

        if (
          accessCodeData.gamesSeasonId !==
          gamesSeasonId
        ) {
          throw new RedeemCodeError(
            "Questo codice non appartiene alla stagione Games attiva.",
            409,
          );
        }

        if (
          accessCodeData.type !==
          "president"
        ) {
          throw new RedeemCodeError(
            "Tipologia di pass non valida.",
            409,
          );
        }

        if (
          accessCodeData.status ===
          "redeemed"
        ) {
          throw new RedeemCodeError(
            "Questo codice è già stato utilizzato.",
            409,
          );
        }

        if (
          accessCodeData.status ===
          "disabled"
        ) {
          throw new RedeemCodeError(
            "Questo codice è stato disabilitato.",
            409,
          );
        }

        if (
          accessCodeData.status !==
          "available"
        ) {
          throw new RedeemCodeError(
            "Questo codice non è disponibile.",
            409,
          );
        }

        /*
         * ====================================================
         * EXISTING SUBSCRIPTION
         * ====================================================
         */

        if (
          subscriptionSnapshot.exists
        ) {
          const subscriptionData =
            subscriptionSnapshot.data();

          if (
            subscriptionData?.status ===
            "active"
          ) {
            throw new RedeemCodeError(
              "Hai già un Games Pass attivo per questa stagione.",
              409,
            );
          }
        }

        /*
         * ====================================================
         * REDEEM CODE
         * ====================================================
         */

        transaction.update(
          accessCodeRef,
          {
            status:
              "redeemed",

            redeemedByUserId:
              userId,

            redeemedAt:
              FieldValue.serverTimestamp(),

            updatedAt:
              FieldValue.serverTimestamp(),
          },
        );

        /*
         * ====================================================
         * CREATE / ACTIVATE SUBSCRIPTION
         * ====================================================
         */

        transaction.set(
          subscriptionRef,
          {
            userId,

            gamesSeasonId,

            status:
              "active",

            accessMethod:
              "president_code",

            accessCodeId:
              accessCodeSnapshot.id,

            accessCodeLabel:
              getOptionalString(
                accessCodeData.label,
              ),

            paymentProvider:
              null,

            paymentReference:
              null,

            paymentIntentId:
              null,

            amountTotal:
              0,

            currency:
              "eur",

            purchasedAt:
              null,

            activatedAt:
              FieldValue.serverTimestamp(),

            expiresAt:
              null,

            updatedAt:
              FieldValue.serverTimestamp(),

            createdAt:
              subscriptionSnapshot.exists
                ? subscriptionSnapshot.data()
                    ?.createdAt ??
                  FieldValue.serverTimestamp()
                : FieldValue.serverTimestamp(),
          },
          {
            merge:
              true,
          },
        );
      },
    );

    /*
     * ========================================================
     * SUCCESS
     * ========================================================
     */

    return NextResponse.json(
      {
        success:
          true,

        message:
          "Games Pass attivato correttamente.",
      },
      {
        status:
          200,
      },
    );
  } catch (
    error
  ) {
    /*
     * ========================================================
     * EXPECTED REDEMPTION ERRORS
     * ========================================================
     */

    if (
      error instanceof
      RedeemCodeError
    ) {
      return NextResponse.json(
        {
          error:
            error.message,
        },
        {
          status:
            error.status,
        },
      );
    }

    console.error(
      "Errore riscatto pass Presidente:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Impossibile riscattare il Games Pass.",
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
 * CUSTOM ERROR
 * ============================================================
 */

class RedeemCodeError extends Error {
  readonly status:
    number;

  constructor(
    message:
      string,

    status:
      number,
  ) {
    super(
      message,
    );

    this.name =
      "RedeemCodeError";

    this.status =
      status;
  }
}

/*
 * ============================================================
 * HASH
 * ============================================================
 */

function hashAccessCode(
  code:
    string,
): string {
  return createHash(
    "sha256",
  )
    .update(
      normalizeAccessCode(
        code,
      ),
    )
    .digest(
      "hex",
    );
}

function normalizeAccessCode(
  code:
    string,
): string {
  return code
    .trim()
    .toUpperCase()
    .replace(
      /\s+/g,
      "",
    );
}

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

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

  return (
    normalized ||
    null
  );
}

function getOptionalString(
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

  return (
    normalized ||
    null
  );
}