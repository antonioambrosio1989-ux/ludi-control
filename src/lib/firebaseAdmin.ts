import "server-only";

import {
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";

import {
  getAuth,
} from "firebase-admin/auth";

import {
  getFirestore,
} from "firebase-admin/firestore";

import {
  getMessaging,
} from "firebase-admin/messaging";

const projectId =
  process.env.FIREBASE_ADMIN_PROJECT_ID;

const clientEmail =
  process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

const privateKey =
  process.env.FIREBASE_ADMIN_PRIVATE_KEY
    ?.replace(/\\n/g, "\n");

if (
  !projectId ||
  !clientEmail ||
  !privateKey
) {
  throw new Error(
    "Credenziali Firebase Admin non configurate.",
  );
}

const firebaseAdminApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });

export const adminAuth =
  getAuth(firebaseAdminApp);

export const adminDb =
  getFirestore(
    firebaseAdminApp,
    "default",
  );

export const adminMessaging =
  getMessaging(
    firebaseAdminApp,
  );