import {
  createHash,
  randomBytes,
} from "crypto";

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

/*
 * ============================================================
 * CONFIG
 * ============================================================
 */

type CreateAccessCodeBody = {
  gamesSeasonId?:
    unknown;

  label?:
    unknown;
};

/*
 * ============================================================
 * POST
 * ============================================================
 */

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
        CreateAccessCodeBody;

    const gamesSeasonId =
      getRequiredString(
        body.gamesSeasonId,
      );

    const label =
      getRequiredString(
        body.label,
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

    if (
      !label
    ) {
      return NextResponse.json(
        {
          error:
            "Inserisci il presidente o la descrizione del pass.",
        },
        {
          status:
            400,
        },
      );
    }

    /*
     * ========================================================
     * VERIFY GAMES SEASON
     * ========================================================
     */

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

    const gamesSeason =
      gamesSeasonSnapshot.data();

    if (
      gamesSeason?.status !==
      "active"
    ) {
      return NextResponse.json(
        {
          error:
            "I pass possono essere generati soltanto per la stagione Games attiva.",
        },
        {
          status:
            409,
        },
      );
    }

    /*
     * ========================================================
     * GENERATE CODE
     * ========================================================
     *
     * Il codice in chiaro viene restituito solo adesso.
     * Firestore conserva esclusivamente l'hash SHA-256.
     * ========================================================
     */

    const plainCode =
      generatePresidentCode();

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

    await accessCodeRef.create(
      {
        gamesSeasonId,

        type:
          "president",

        label,

        status:
          "available",

        codeHash,

        redeemedByUserId:
          null,

        redeemedAt:
          null,

        createdAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      },
    );

    /*
     * ========================================================
     * RESPONSE
     * ========================================================
     */

    return NextResponse.json(
      {
        code:
          plainCode,

        gamesSeasonId,

        label,
      },
      {
        status:
          201,
      },
    );
  } catch (
    error
  ) {
    console.error(
      "Errore generazione pass Presidente:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Impossibile generare il pass Presidente.",
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
 * CODE GENERATION
 * ============================================================
 */

function generatePresidentCode():
  string {
  const randomPart =
    randomBytes(
      12,
    )
      .toString(
        "hex",
      )
      .toUpperCase();

  const groups =
    randomPart.match(
      /.{1,6}/g,
    ) ??
    [
      randomPart,
    ];

  return [
    "LUDI",
    "PRES",
    ...groups,
  ].join(
    "-",
  );
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