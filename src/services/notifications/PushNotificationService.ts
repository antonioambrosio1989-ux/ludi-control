"use client";

import type {
  User,
} from "firebase/auth";

import {
  getMessaging,
  isSupported,
  onMessage,
  onRegistered,
  onUnregistered,
  register,
  unregister,
  type MessagePayload,
  type Messaging,
} from "firebase/messaging";

import {
  app,
} from "@/src/lib/firebase";

/*
 * ============================================================
 * CONFIG
 * ============================================================
 */

const SERVICE_WORKER_PATH =
  "/firebase-messaging-sw.js";

const SERVICE_WORKER_SCOPE =
  "/";

const LAST_FID_STORAGE_KEY =
  "ludi.notifications.last-fid";

const REGISTRATION_TIMEOUT_MS =
  12_000;

/*
 * ============================================================
 * ERRORS
 * ============================================================
 */

export type PushNotificationErrorCode =
  | "unsupported"
  | "permission-not-granted"
  | "missing-vapid-key"
  | "service-worker-registration-failed"
  | "fcm-registration-timeout"
  | "fcm-registration-failed"
  | "server-sync-failed";

export class PushNotificationError extends Error {
  readonly code:
    PushNotificationErrorCode;

  constructor(
    code:
      PushNotificationErrorCode,

    message:
      string,
  ) {
    super(
      message,
    );

    this.name =
      "PushNotificationError";

    this.code =
      code;
  }
}

/*
 * ============================================================
 * TYPES
 * ============================================================
 */

type MessagingContext = {
  messaging:
    Messaging;

  serviceWorkerRegistration:
    ServiceWorkerRegistration;

  vapidKey:
    string;
};

type RegistrationSyncOptions = {
  user:
    User;

  registerIfEnabled:
    boolean;
};

/*
 * ============================================================
 * INTERNAL STATE
 * ============================================================
 */

let serviceWorkerRegistrationPromise:
  Promise<ServiceWorkerRegistration> |
  null =
  null;

/*
 * ============================================================
 * SUPPORT
 * ============================================================
 */

async function browserSupportsPush():
  Promise<boolean> {
  if (
    typeof window ===
      "undefined" ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return false;
  }

  try {
    return await isSupported();
  } catch (
    error
  ) {
    console.error(
      "Errore verifica supporto FCM:",
      error,
    );

    return false;
  }
}

/*
 * ============================================================
 * SERVICE WORKER
 * ============================================================
 */

async function getServiceWorkerRegistration():
  Promise<ServiceWorkerRegistration> {
  if (
    typeof window ===
      "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    throw new PushNotificationError(
      "unsupported",
      "Il Service Worker non è disponibile su questo dispositivo.",
    );
  }

  if (
    !serviceWorkerRegistrationPromise
  ) {
    serviceWorkerRegistrationPromise =
      navigator.serviceWorker
        .register(
          SERVICE_WORKER_PATH,
          {
            scope:
              SERVICE_WORKER_SCOPE,
          },
        )
        .catch(
          (
            error,
          ) => {
            serviceWorkerRegistrationPromise =
              null;

            console.error(
              "Errore registrazione Service Worker notifiche:",
              error,
            );

            throw new PushNotificationError(
              "service-worker-registration-failed",
              "Impossibile preparare il dispositivo per le notifiche.",
            );
          },
        );
  }

  return serviceWorkerRegistrationPromise;
}

/*
 * ============================================================
 * MESSAGING CONTEXT
 * ============================================================
 */

async function getMessagingContext({
  requireVapidKey =
    true,
  requirePermission =
    true,
}: {
  requireVapidKey?:
    boolean;
  requirePermission?:
    boolean;
} = {}): Promise<MessagingContext> {
  const supported =
    await browserSupportsPush();

  if (
    !supported
  ) {
    throw new PushNotificationError(
      "unsupported",
      "Le notifiche Push non sono supportate su questo browser o dispositivo.",
    );
  }

  if (
    requirePermission &&
    Notification.permission !==
    "granted"
  ) {
    throw new PushNotificationError(
      "permission-not-granted",
      "Il permesso per le notifiche non è stato concesso.",
    );
  }

  const vapidKey =
    process.env
      .NEXT_PUBLIC_FIREBASE_VAPID_KEY
      ?.trim() ??
    "";

  if (
    requireVapidKey &&
    !vapidKey
  ) {
    throw new PushNotificationError(
      "missing-vapid-key",
      "La chiave Web Push di Firebase non è configurata.",
    );
  }

  const serviceWorkerRegistration =
    await getServiceWorkerRegistration();

  return {
    messaging:
      getMessaging(
        app,
      ),

    serviceWorkerRegistration,

    vapidKey,
  };
}

/*
 * ============================================================
 * SERVER SYNC
 * ============================================================
 */

async function syncFidToServer({
  user,
  fid,
}: {
  user:
    User;

  fid:
    string;
}): Promise<void> {
  const normalizedFid =
    fid.trim();

  if (
    !normalizedFid
  ) {
    return;
  }

  const idToken =
    await user.getIdToken();

  const response =
    await fetch(
      "/api/notifications/subscriptions",
      {
        method:
          "POST",

        headers: {
          Authorization:
            `Bearer ${idToken}`,

          "Content-Type":
            "application/json",
        },

        cache:
          "no-store",

        body:
          JSON.stringify(
            {
              fid:
                normalizedFid,

              userAgent:
                navigator.userAgent,

              language:
                navigator.language,

              platform:
                getPlatformLabel(),
            },
          ),
      },
    );

  if (
    !response.ok
  ) {
    const body =
      await safeJson(
        response,
      );

    throw new PushNotificationError(
      "server-sync-failed",
      typeof body?.error ===
        "string"
        ? body.error
        : "Impossibile registrare il dispositivo per le notifiche.",
    );
  }

  try {
    window.localStorage.setItem(
      LAST_FID_STORAGE_KEY,
      normalizedFid,
    );
  } catch {
    // LocalStorage non è indispensabile per il funzionamento Push.
  }
}

async function removeFidFromServer({
  user,
  fid,
}: {
  user:
    User;

  fid:
    string;
}): Promise<void> {
  const normalizedFid =
    fid.trim();

  if (
    !normalizedFid
  ) {
    return;
  }

  const idToken =
    await user.getIdToken();

  const response =
    await fetch(
      "/api/notifications/subscriptions",
      {
        method:
          "DELETE",

        headers: {
          Authorization:
            `Bearer ${idToken}`,

          "Content-Type":
            "application/json",
        },

        cache:
          "no-store",

        body:
          JSON.stringify(
            {
              fid:
                normalizedFid,
            },
          ),
      },
    );

  if (
    !response.ok &&
    response.status !==
      404
  ) {
    const body =
      await safeJson(
        response,
      );

    throw new PushNotificationError(
      "server-sync-failed",
      typeof body?.error ===
        "string"
        ? body.error
        : "Impossibile rimuovere il dispositivo dalle notifiche.",
    );
  }
}

/*
 * ============================================================
 * AWAIT FID
 * ============================================================
 */

async function registerAndWaitForFid(
  context:
    MessagingContext,
): Promise<string> {
  return new Promise<
    string
  >(
    (
      resolve,
      reject,
    ) => {
      let settled =
        false;

      let timeoutId:
        number | null =
        null;

      let unsubscribeRegistered:
        () => void =
        () => {};

      const finish = (
        callback:
          () => void,
      ) => {
        if (
          settled
        ) {
          return;
        }

        settled =
          true;

        if (
          timeoutId !==
          null
        ) {
          window.clearTimeout(
            timeoutId,
          );
        }

        unsubscribeRegistered();

        callback();
      };

      unsubscribeRegistered =
        onRegistered(
          context.messaging,
          (
            fid,
          ) => {
            finish(
              () =>
                resolve(
                  fid,
                ),
            );
          },
        );

      timeoutId =
        window.setTimeout(
          () => {
            finish(
              () =>
                reject(
                  new PushNotificationError(
                    "fcm-registration-timeout",
                    "Firebase non ha completato la registrazione Push del dispositivo.",
                  ),
                ),
            );
          },
          REGISTRATION_TIMEOUT_MS,
        );

      void register(
        context.messaging,
        {
          vapidKey:
            context.vapidKey,

          serviceWorkerRegistration:
            context.serviceWorkerRegistration,
        },
      ).catch(
        (
          error,
        ) => {
          console.error(
            "Errore registrazione FCM:",
            error,
          );

          finish(
            () =>
              reject(
                new PushNotificationError(
                  "fcm-registration-failed",
                  "Firebase non è riuscito a registrare il dispositivo per le notifiche.",
                ),
              ),
          );
        },
      );
    },
  );
}

/*
 * ============================================================
 * FOREGROUND NOTIFICATION
 * ============================================================
 */

async function showForegroundNotification(
  payload:
    MessagePayload,
): Promise<void> {
  if (
    Notification.permission !==
    "granted"
  ) {
    return;
  }

  const serviceWorkerRegistration =
    await getServiceWorkerRegistration();

  const title =
    payload.data
      ?.title?.trim() ||
    payload.notification
      ?.title?.trim() ||
    "Ludis League";

  const body =
    payload.data
      ?.body?.trim() ||
    payload.notification
      ?.body?.trim() ||
    "Hai un nuovo aggiornamento.";

  const category =
    payload.data
      ?.category?.trim() ||
    "general";

  const link =
    payload.data
      ?.link?.trim() ||
    "/";

  await serviceWorkerRegistration.showNotification(
    title,
    {
      body,

      icon:
        "/icons/icon-192.png",

      badge:
        "/icons/icon-192.png",

      tag:
        `ludi-${category}`,

      data: {
        link,
      },
    },
  );
}

/*
 * ============================================================
 * PUBLIC SERVICE
 * ============================================================
 */

export const PushNotificationService = {
  async isSupported():
    Promise<boolean> {
    return browserSupportsPush();
  },

  async registerCurrentDevice({
    user,
  }: {
    user:
      User;
  }): Promise<string> {
    const context =
      await getMessagingContext();

    const fid =
      await registerAndWaitForFid(
        context,
      );

    await syncFidToServer({
      user,
      fid,
    });

    return fid;
  },

  async unregisterCurrentDevice({
    user,
  }: {
    user:
      User;
  }): Promise<void> {
    if (
      typeof window ===
        "undefined" ||
      !(await browserSupportsPush())
    ) {
      return;
    }

    let storedFid =
      "";

    try {
      storedFid =
        window.localStorage.getItem(
          LAST_FID_STORAGE_KEY,
        ) ??
        "";
    } catch {
      storedFid =
        "";
    }

    const messaging =
      getMessaging(
        app,
      );

    let unregisteredFid =
      "";

    const unsubscribe =
      onUnregistered(
        messaging,
        (
          fid,
        ) => {
          unregisteredFid =
            fid.trim();
        },
      );

    try {
      await unregister(
        messaging,
      );
    } catch (
      error
    ) {
      console.error(
        "Errore unregister FCM:",
        error,
      );
    } finally {
      unsubscribe();
    }

    const fidToRemove =
      unregisteredFid ||
      storedFid;

    if (
      fidToRemove
    ) {
      try {
        await removeFidFromServer({
          user,
          fid:
            fidToRemove,
        });
      } catch (
        error
      ) {
        console.error(
          "Errore rimozione FID dal server:",
          error,
        );
      }
    }

    try {
      window.localStorage.removeItem(
        LAST_FID_STORAGE_KEY,
      );
    } catch {
      // Nessuna azione necessaria.
    }
  },

  async startRegistrationSync({
    user,
    registerIfEnabled,
  }:
    RegistrationSyncOptions):
    Promise<() => void> {
    if (
      typeof window ===
        "undefined" ||
      !(await browserSupportsPush())
    ) {
      return () => {};
    }

    const context =
      await getMessagingContext({
        requireVapidKey:
          false,

        requirePermission:
          false,
      });

    let active =
      true;

    const unsubscribeRegistered =
      onRegistered(
        context.messaging,
        (
          fid,
        ) => {
          if (
            !active
          ) {
            return;
          }

          void syncFidToServer({
            user,
            fid,
          }).catch(
            (
              error,
            ) => {
              console.error(
                "Errore sincronizzazione FID:",
                error,
              );
            },
          );
        },
      );

    const unsubscribeUnregistered =
      onUnregistered(
        context.messaging,
        (
          fid,
        ) => {
          if (
            !active
          ) {
            return;
          }

          void removeFidFromServer({
            user,
            fid,
          }).catch(
            (
              error,
            ) => {
              console.error(
                "Errore rimozione FID non più registrato:",
                error,
              );
            },
          );
        },
      );

    const unsubscribeMessage =
      onMessage(
        context.messaging,
        (
          payload,
        ) => {
          if (
            !active
          ) {
            return;
          }

          void showForegroundNotification(
            payload,
          ).catch(
            (
              error,
            ) => {
              console.error(
                "Errore visualizzazione notifica in foreground:",
                error,
              );
            },
          );
        },
      );

    if (
      registerIfEnabled &&
      Notification.permission ===
        "granted" &&
      context.vapidKey
    ) {
      void register(
        context.messaging,
        {
          vapidKey:
            context.vapidKey,

          serviceWorkerRegistration:
            context.serviceWorkerRegistration,
        },
      ).catch(
        (
          error,
        ) => {
          console.error(
            "Errore refresh registrazione FCM:",
            error,
          );
        },
      );
    }

    return () => {
      active =
        false;

      unsubscribeRegistered();
      unsubscribeUnregistered();
      unsubscribeMessage();
    };
  },

  async sendTestNotification({
    user,
  }: {
    user:
      User;
  }): Promise<void> {
    let fid = "";
    try {
      fid = window.localStorage.getItem(LAST_FID_STORAGE_KEY)?.trim() ?? "";
    } catch {
      // Un token non disponibile non può essere usato per un test mirato.
    }
    if (!fid) {
      throw new PushNotificationError(
        "fcm-registration-failed",
        "Token Push non trovato su questo dispositivo. Disattiva e riattiva le notifiche.",
      );
    }

    const idToken =
      await user.getIdToken();

    const response =
      await fetch(
        "/api/notifications/test",
        {
          method:
            "POST",

          headers: {
            Authorization:
              `Bearer ${idToken}`,

            "Content-Type":
              "application/json",
          },

          cache:
            "no-store",

          body: JSON.stringify({ fid }),
        },
      );

    if (
      !response.ok
    ) {
      const body =
        await safeJson(
          response,
        );

      throw new Error(
        typeof body?.error ===
          "string"
          ? body.error
          : "Impossibile inviare la notifica di prova.",
      );
    }
  },
};

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function getPlatformLabel():
  string {
  const userAgent =
    navigator.userAgent;

  if (
    /iPhone|iPad|iPod/i.test(
      userAgent,
    )
  ) {
    return "ios";
  }

  if (
    /Android/i.test(
      userAgent,
    )
  ) {
    return "android";
  }

  if (
    /Windows/i.test(
      userAgent,
    )
  ) {
    return "windows";
  }

  if (
    /Macintosh|Mac OS X/i.test(
      userAgent,
    )
  ) {
    return "macos";
  }

  if (
    /Linux/i.test(
      userAgent,
    )
  ) {
    return "linux";
  }

  return "unknown";
}

async function safeJson(
  response:
    Response,
): Promise<
  Record<string, unknown> |
  null
> {
  try {
    return await response.json() as
      Record<
        string,
        unknown
      >;
  } catch {
    return null;
  }
}
