import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminDb,
} from "@/src/lib/firebaseAdmin";

import {
  requireAdminApi,
} from "@/src/lib/requireAdminApi";

export const runtime =
  "nodejs";

type UpdateAccessCodeStatusBody = {
  codeId?:
    unknown;

  status?:
    unknown;
};

export async function POST(
  request:
    NextRequest,
) {
  try {
    /*
     * ========================================================
     * ADMIN AUTH
     * ========================================================
     */

    await requireAdminApi(
  request,
);

    /*
     * ========================================================
     * BODY
     * ========================================================
     */

    const body =
      (await request.json()) as
        UpdateAccessCodeStatusBody;

    const codeId =
      getRequiredString(
        body.codeId,
      );

    const requestedStatus =
      getRequiredString(
        body.status,
      );

    if (
      !codeId
    ) {
      return NextResponse.json(
        {
          error:
            "Pass Presidente non valido.",
        },
        {
          status:
            400,
        },
      );
    }

    if (
      requestedStatus !==
        "available" &&
      requestedStatus !==
        "disabled"
    ) {
      return NextResponse.json(
        {
          error:
            "Stato pass non valido.",
        },
        {
          status:
            400,
        },
      );
    }

    /*
     * ========================================================
     * ACCESS CODE
     * ========================================================
     */

    const accessCodeRef =
      adminDb
        .collection(
          "gamesAccessCodes",
        )
        .doc(
          codeId,
        );

    await adminDb.runTransaction(
      async (
        transaction,
      ) => {
        const snapshot =
          await transaction.get(
            accessCodeRef,
          );

        if (
          !snapshot.exists
        ) {
          throw new AccessCodeError(
            "Pass Presidente non trovato.",
            404,
          );
        }

        const data =
          snapshot.data();

        if (
  !data
) {
  throw new AccessCodeError(
    "Dati del pass Presidente non disponibili.",
    500,
  );
}

        if (
          data.type !==
          "president"
        ) {
          throw new AccessCodeError(
            "Tipologia di pass non valida.",
            409,
          );
        }

        if (
          data.status ===
          "redeemed"
        ) {
          throw new AccessCodeError(
            "Un pass già utilizzato non può essere modificato.",
            409,
          );
        }

        if (
          data.status !==
            "available" &&
          data.status !==
            "disabled"
        ) {
          throw new AccessCodeError(
            "Stato attuale del pass non valido.",
            409,
          );
        }

        transaction.update(
          accessCodeRef,
          {
            status:
              requestedStatus,

            updatedAt:
              FieldValue.serverTimestamp(),
          },
        );
      },
    );

    return NextResponse.json(
      {
        success:
          true,
      },
      {
        status:
          200,
      },
    );
  } catch (
    error
  ) {
    if (
      error instanceof
      AccessCodeError
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
      "Errore modifica pass Presidente:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Impossibile modificare il pass Presidente.",
      },
      {
        status:
          500,
      },
    );
  }
}

class AccessCodeError extends Error {
  constructor(
    message:
      string,

    public readonly status:
      number,
  ) {
    super(
      message,
    );

    this.name =
      "AccessCodeError";
  }
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

  return (
    normalized ||
    null
  );
}