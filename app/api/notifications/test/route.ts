import {
  NextResponse,
} from "next/server";

import {
  adminAuth,
  adminDb,
} from "@/src/lib/firebaseAdmin";

import {
  PushNotificationSender,
} from "@/src/server/notifications/PushNotificationSender";

export const runtime =
  "nodejs";

/*
 * ============================================================
 * TEST CURRENT ADMIN PUSH
 * ============================================================
 */

export async function POST(
  request:
    Request,
) {
  try {
    const uid =
      await requireAdminUserId(
        request,
      );

    // Il test riceve il token dall'installazione corrente, mai da un altro dispositivo.
    const body = await request.json().catch(() => null) as { fid?: unknown } | null;
    const fid = typeof body?.fid === "string" ? body.fid.trim() : "";
    if (!fid || fid.length > 512) {
      return NextResponse.json(
        { error: "Token di questo dispositivo mancante: riattiva le notifiche dalle impostazioni." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const result =
      await PushNotificationSender.sendToUser({
        targetFid: fid,
        uid,

        respectCategory:
          false,

        notification: {
          category:
            "test",

          title:
            "Ludi Notifications",

          body:
            "Le notifiche Push funzionano correttamente su questo dispositivo.",

          link:
            "/admin/impostazioni",
        },
      });

    if (
      result.sent ===
        0 &&
      result.attempted ===
        0
    ) {
      return NextResponse.json(
        {
          error:
            "Questo dispositivo non risulta registrato per questo account.",

          result,
        },
        {
          status:
            409,

          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      );
    }

    return NextResponse.json(
      {
        ok:
          result.sent >
          0,

        result,
      },
      {
        status:
          result.sent >
          0
            ? 200
            : 502,

        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (
    error
  ) {
    /*
     * ==========================================================
     * UNAUTHENTICATED
     * ==========================================================
     */

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

          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      );
    }

    /*
     * ==========================================================
     * NOT ADMIN
     * ==========================================================
     */

    if (
      error instanceof
        Error &&
      error.message ===
        "FORBIDDEN"
    ) {
      return NextResponse.json(
        {
          error:
            "Accesso riservato agli amministratori.",
        },
        {
          status:
            403,

          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      );
    }

    console.error(
      "Errore invio notifica Push di prova:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Impossibile inviare la notifica Push di prova.",
      },
      {
        status:
          500,

        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  }
}

/*
 * ============================================================
 * REQUIRE ADMIN USER
 * ============================================================
 */

async function requireAdminUserId(
  request:
    Request,
): Promise<string> {
  /*
   * ==========================================================
   * AUTHORIZATION HEADER
   * ==========================================================
   */

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

  /*
   * ==========================================================
   * VERIFY FIREBASE TOKEN
   * ==========================================================
   */

  let uid:
    string;

  try {
    const decodedToken =
      await adminAuth.verifyIdToken(
        token,
      );

    uid =
      decodedToken.uid;
  } catch {
    throw new Error(
      "UNAUTHORIZED",
    );
  }

  /*
   * ==========================================================
   * VERIFY ADMIN
   * ==========================================================
   *
   * L'utente deve avere:
   *
   * admins/{uid}
   *
   * con:
   *
   * active: true
   *
   * ==========================================================
   */

  const adminSnapshot =
    await adminDb
      .collection(
        "admins",
      )
      .doc(
        uid,
      )
      .get();

  if (
    !adminSnapshot.exists ||
    adminSnapshot.data()?.active !==
      true
  ) {
    throw new Error(
      "FORBIDDEN",
    );
  }

  return uid;
}