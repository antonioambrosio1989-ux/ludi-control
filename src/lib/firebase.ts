import { getApp, getApps, initializeApp } from "firebase/app";
import { connectFirestoreEmulator, initializeFirestore } from "firebase/firestore";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId:
    process.env
      .NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

export const app =
  getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig);

export const db = initializeFirestore(app, { ignoreUndefinedProperties: true },
  "default",);

export const auth = getAuth(app);

export const storage = getStorage(app);

// Opt-in locale: gli emulatori non possono essere attivati in produzione.
if (process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true") {
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", {disableWarnings:true});
}
