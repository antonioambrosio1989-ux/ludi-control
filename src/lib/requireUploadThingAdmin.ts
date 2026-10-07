import "server-only";

import {
  UploadThingError,
} from "uploadthing/server";

import {
  adminAuth,
  adminDb,
} from "@/src/lib/firebaseAdmin";

/*
 * ============================================================
 * VERIFICA ADMIN PER UPLOADTHING
 * ============================================================
 *
 * UploadThing esegue il middleware lato server.
 *
 * Il client deve inviare:
 *
 * Authorization: Bearer <Firebase ID token>
 *
 * Qui:
 * - estraiamo il token
 * - lo verifichiamo tramite Firebase Admin
 * - controlliamo che l'utente sia realmente Admin
 * ============================================================
 */

export async function requireUploadThingAdmin(
  request: Request,
) {
  const authorization =
    request.headers.get(
      "authorization",
    );

  if (
    !authorization?.startsWith(
      "Bearer ",
    )
  ) {
    throw new UploadThingError(
      "Autenticazione richiesta.",
    );
  }

  const token =
    authorization
      .slice(
        "Bearer ".length,
      )
      .trim();

  if (!token) {
    throw new UploadThingError(
      "Autenticazione richiesta.",
    );
  }

  try {
    const decodedToken =
  await adminAuth.verifyIdToken(
    token,
  );

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
  throw new UploadThingError(
    "Accesso non autorizzato.",
  );
}

return {
  uid,

  email:
    decodedToken.email,
};
  } catch (
    error
  ) {
    if (
      error instanceof
      UploadThingError
    ) {
      throw error;
    }

    console.error(
      "[UploadThing Admin Auth]",
      error,
    );

    throw new UploadThingError(
      "Sessione non valida.",
    );
  }
}