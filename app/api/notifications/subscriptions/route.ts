import {
  createHash,
} from "node:crypto";

import {
  NextResponse,
} from "next/server";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminAuth,
  adminDb,
} from "@/src/lib/firebaseAdmin";

export const runtime =
  "nodejs";

/*
 * ============================================================
 * TYPES
 * ============================================================
 */

type SubscriptionRequestBody = {
  fid?:
    unknown;

  userAgent?:
    unknown;

  language?:
    unknown;

  platform?:
    unknown;
};

/*
 * ============================================================
 * POST - REGISTER / REFRESH INSTALLATION
 * ============================================================
 */

export async function POST(
  request:
    Request,
) {
  try {
    const uid =
      await requireUserId(
        request,
      );

    const body =
      (await request.json()) as
        SubscriptionRequestBody;

    const fid =
      getRequiredString(
        body.fid,
      );

    if (
      !fid ||
      fid.length >
        512
    ) {
      return NextResponse.json(
        {
          error:
            "Identificatore Push non valido.",
        },
        {
          status:
            400,
        },
      );
    }

    const installationId =
      hashFid(
        fid,
      );

    const reference =
      adminDb
        .collection(
          "pushInstallations",
        )
        .doc(
          installationId,
        );

    const snapshot =
      await reference.get();

    const now =
      FieldValue.serverTimestamp();

    await reference.set(
      {
        fid,

        uid,

        registrationType:
          "fid",

        userAgent:
          normalizeOptionalString(
            body.userAgent,
            500,
          ),

        language:
          normalizeOptionalString(
            body.language,
            32,
          ),

        platform:
          normalizeOptionalString(
            body.platform,
            32,
          ),

        createdAt:
          snapshot.exists
            ? snapshot.data()
                ?.createdAt ??
              now
            : now,

        lastSeenAt:
          now,

        updatedAt:
          now,
      },
      {
        merge:
          true,
      },
    );

    return NextResponse.json(
      {
        registered:
          true,
      },
      {
        status:
          200,

        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (
    error
  ) {
    return handleApiError(
      error,
    );
  }
}

/*
 * ============================================================
 * DELETE - REMOVE INSTALLATION
 * ============================================================
 */

export async function DELETE(
  request:
    Request,
) {
  try {
    const uid =
      await requireUserId(
        request,
      );

    const body =
      (await request.json()) as
        SubscriptionRequestBody;

    const fid =
      getRequiredString(
        body.fid,
      );

    if (
      !fid
    ) {
      return NextResponse.json(
        {
          error:
            "Identificatore Push non valido.",
        },
        {
          status:
            400,
        },
      );
    }

    const reference =
      adminDb
        .collection(
          "pushInstallations",
        )
        .doc(
          hashFid(
            fid,
          ),
        );

    const snapshot =
      await reference.get();

    /*
     * Non permettiamo a un utente di eliminare accidentalmente
     * una registrazione che nel frattempo è stata assegnata
     * a un altro account sullo stesso dispositivo/browser.
     */

    if (
      snapshot.exists &&
      snapshot.data()?.uid ===
        uid
    ) {
      await reference.delete();
    }

    return NextResponse.json(
      {
        removed:
          true,
      },
      {
        status:
          200,

        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (
    error
  ) {
    return handleApiError(
      error,
    );
  }
}

/*
 * ============================================================
 * AUTH
 * ============================================================
 */

async function requireUserId(
  request:
    Request,
): Promise<string> {
  const authorization =
    request.headers.get(
      "authorization",
    );

  if (
    !authorization
      ?.startsWith(
        "Bearer ",
      )
  ) {
    throw new Error(
      "UNAUTHORIZED",
    );
  }

  const token =
    authorization
      .slice(
        "Bearer ".length,
      )
      .trim();

  if (
    !token
  ) {
    throw new Error(
      "UNAUTHORIZED",
    );
  }

  try {
    const decodedToken =
      await adminAuth.verifyIdToken(
        token,
      );

    return decodedToken.uid;
  } catch {
    throw new Error(
      "UNAUTHORIZED",
    );
  }
}

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function hashFid(
  fid:
    string,
): string {
  return createHash(
    "sha256",
  )
    .update(
      fid,
    )
    .digest(
      "hex",
    );
}

function getRequiredString(
  value:
    unknown,
): string {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function normalizeOptionalString(
  value:
    unknown,
  maxLength:
    number,
): string | null {
  if (
    typeof value !==
    "string"
  ) {
    return null;
  }

  const normalized =
    value.trim();

  if (
    !normalized
  ) {
    return null;
  }

  return normalized.slice(
    0,
    maxLength,
  );
}

function handleApiError(
  error:
    unknown,
) {
  if (
    error instanceof
      Error &&
    error.message ===
      "UNAUTHORIZED"
  ) {
    return NextResponse.json(
      {
        error:
          "Autenticazione richiesta.",
      },
      {
        status:
          401,
      },
    );
  }

  console.error(
    "Errore API registrazione Push:",
    error,
  );

  return NextResponse.json(
    {
      error:
        "Impossibile aggiornare la registrazione Push.",
    },
    {
      status:
        500,
    },
  );
}
