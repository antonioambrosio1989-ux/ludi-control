"use client";

import {
  useEffect,
} from "react";

import {
  useAuth,
} from "@/src/hooks/useAuth";

import {
  UserSettingsService,
} from "@/src/services/auth/UserSettingsService";

import {
  PushNotificationService,
} from "@/src/services/notifications/PushNotificationService";

/*
 * ============================================================
 * PUSH NOTIFICATION BOOTSTRAP
 * ============================================================
 *
 * Mantiene sincronizzato il Firebase Installation ID (FID)
 * del dispositivo con il backend quando:
 *
 * - l'utente ha già concesso il permesso browser;
 * - le notifiche Ludi risultano abilitate;
 * - Firebase rinnova/ruota l'identificatore installazione.
 *
 * Gestisce inoltre i messaggi ricevuti mentre la web-app è
 * in primo piano.
 * ============================================================
 */

export default function PushNotificationBootstrap() {
  const {
    user,
    isLoading,
  } =
    useAuth();

  useEffect(
    () => {
      if (
        isLoading ||
        !user
      ) {
        return;
      }

      /*
       * ========================================================
       * STABLE AUTHENTICATED USER
       * ========================================================
       *
       * Salviamo il riferimento in una variabile locale stabile.
       *
       * In questo modo TypeScript sa che, all'interno della
       * funzione asincrona start(), l'utente non può essere null.
       * ========================================================
       */

      const authenticatedUser =
        user;

      let active =
        true;

      let cleanup:
        () => void =
        () => {};

      async function start() {
        try {
          const settings =
            await UserSettingsService.getByUid(
              authenticatedUser.uid,
            );

          if (
            !active
          ) {
            return;
          }

          cleanup =
            await PushNotificationService.startRegistrationSync({
              user:
                authenticatedUser,

              registerIfEnabled:
                settings.notificationsEnabled,
            });
        } catch (
          error
        ) {
          /*
           * Il bootstrap non deve mai bloccare il rendering
           * dell'app. Gli errori di configurazione vengono
           * mostrati in modo esplicito nella pagina Impostazioni.
           */

          console.error(
            "Errore bootstrap notifiche Push:",
            error,
          );
        }
      }

      void start();

      return () => {
        active =
          false;

        cleanup();
      };
    },
    [
      user,
      isLoading,
    ],
  );

  return null;
}