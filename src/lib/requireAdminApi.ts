import "server-only";

import type {
  NextRequest,
} from "next/server";

import {
  adminAuth,
  adminDb,
} from "@/src/lib/firebaseAdmin";

/*
 * ============================================================
 * RISULTATO AUTORIZZAZIONE ADMIN
 * ============================================================
 */

export type AdminApiAuthorization = {
  uid: string;
};

/*
 * ============================================================
 * REQUIRE ADMIN API
 * ============================================================
 *
 * Verifica:
 *
 * 1. Authorization header
 * 2. Firebase ID Token
 * 3. Documento admins/{uid}
 * 4. active === true
 *
 * In caso contrario genera un errore.
 * ============================================================
 */

export async function requireAdminApi(
  request: NextRequest,
): Promise<AdminApiAuthorization> {
  const authorizationHeader =
    request.headers.get(
      "authorization",
    );

  if (
    !authorizationHeader
  ) {
    throw new Error(
      "UNAUTHORIZED",
    );
  }

  const [
    scheme,
    token,
  ] =
    authorizationHeader.split(
      " ",
    );

  if (
    scheme !== "Bearer" ||
    !token
  ) {
    throw new Error(
      "UNAUTHORIZED",
    );
  }

  /*
   * ==========================================================
   * VERIFICA TOKEN FIREBASE
   * ==========================================================
   */

  let decodedToken;

  try {
    decodedToken =
      await adminAuth.verifyIdToken(
        token,
      );
  } catch {
    throw new Error(
      "UNAUTHORIZED",
    );
  }

  const uid =
    decodedToken.uid;

  /*
   * ==========================================================
   * VERIFICA DOCUMENTO ADMIN
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

  return {
    uid,
  };
}