"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  Bell,
  BellOff,
  Send,
} from "lucide-react";

import {
  useAuth,
} from "@/src/hooks/useAuth";

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  UserSettingsService,
} from "@/src/services/auth/UserSettingsService";

import {
  PushNotificationError,
  PushNotificationService,
} from "@/src/services/notifications/PushNotificationService";

export default function AdminSettingsScreen() {
  const {
    user,
    isLoading,
  } = useAuth();

  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] =
    useState<NotificationPermission | "unsupported">("unsupported");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (
      isLoading ||
      !user
    ) {
      return;
    }

    let active = true;

    void Promise.all([
      UserSettingsService.getByUid(user.uid),
      PushNotificationService.isSupported(),
    ])
      .then(([settings, pushSupported]) => {
        if (!active) return;

        setEnabled(settings.notificationsEnabled);
        setSupported(pushSupported);
        setPermission(UserSettingsService.getNotificationPermission());
      })
      .catch((currentError) => {
        if (!active) return;

        console.error(
          "Errore caricamento impostazioni Control:",
          currentError,
        );

        setError(
          "Impossibile caricare le impostazioni delle notifiche.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isLoading, user]);

  async function toggleNotifications() {
    if (!user || busy) return;

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      if (enabled) {
        await UserSettingsService.setNotificationsEnabled({
          uid: user.uid,
          enabled: false,
          notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
        });

        await PushNotificationService.unregisterCurrentDevice({
          user,
        });

        setEnabled(false);
        setMessage(
          "Notifiche Control disattivate su questo account.",
        );

        return;
      }

      const currentPermission =
        UserSettingsService.getNotificationPermission();

      if (currentPermission === "unsupported") {
        throw new Error(
          "Le notifiche non sono supportate da questo browser o dispositivo.",
        );
      }

      if (currentPermission === "denied") {
        throw new Error(
          "Le notifiche sono bloccate nelle impostazioni del browser.",
        );
      }

      let nextPermission:
        NotificationPermission |
        "unsupported" =
          currentPermission;

      if (currentPermission === "default") {
        nextPermission =
          await UserSettingsService.requestNotificationPermission();
      }

      setPermission(nextPermission);

      if (nextPermission !== "granted") {
        throw new Error(
          "Per attivare le notifiche devi consentirle nel browser.",
        );
      }

      await PushNotificationService.registerCurrentDevice({
        user,
      });

      await UserSettingsService.setNotificationsEnabled({
        uid: user.uid,
        enabled: true,
        notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
      });

      setEnabled(true);
      setMessage(
        "Notifiche Control attivate su questo dispositivo.",
      );
    } catch (currentError) {
      console.error(
        "Errore gestione notifiche Control:",
        currentError,
      );

      setError(
        currentError instanceof PushNotificationError ||
        currentError instanceof Error
          ? currentError.message
          : "Impossibile aggiornare le notifiche.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (!user || busy) return;

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      await PushNotificationService.sendTestNotification({
        user,
      });

      setMessage(
        "Notifica di prova inviata.",
      );
    } catch (currentError) {
      console.error(
        "Errore test notifiche Control:",
        currentError,
      );

      setError(
        currentError instanceof Error
          ? currentError.message
          : "Impossibile inviare la notifica di prova.",
      );
    } finally {
      setBusy(false);
    }
  }

  const isInitialLoading =
    isLoading ||
    (
      Boolean(user) &&
      loading
    );

  if (isInitialLoading) {
    return (
      <div className="rounded-[20px] bg-white p-6">
        <p className="text-sm font-bold text-[#06142E]/55">
          Caricamento impostazioni...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#06142E]/35">
          Sistema
        </p>

        <h1 className="mt-1 text-3xl font-black uppercase tracking-[-0.03em] text-[#06142E] sm:text-4xl">
          Impostazioni
        </h1>

        <p className="mt-2 text-sm font-bold text-[#06142E]/50">
          Configurazione del Centro di Controllo su questo dispositivo.
        </p>
      </div>

      <section className="max-w-5xl rounded-[22px] border border-[#06142E]/10 bg-white p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] bg-[#06142E] text-white">
            {enabled ? (
              <Bell size={22} />
            ) : (
              <BellOff size={22} />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-black text-[#06142E]">
              Notifiche operative
            </h2>

            <p className="mt-1 text-sm font-bold leading-6 text-[#06142E]/50">
              Abilita promemoria e avvisi del Centro di Controllo sul browser attuale.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 rounded-[16px] bg-[#06142E]/[0.04] p-4 text-sm font-bold text-[#06142E]/65 sm:grid-cols-3">
          <div>
            <span className="block text-[10px] uppercase text-[#06142E]/35">
              Stato
            </span>
            {enabled ? "Attive" : "Disattive"}
          </div>

          <div>
            <span className="block text-[10px] uppercase text-[#06142E]/35">
              Browser
            </span>
            {supported === false
              ? "Non supportato"
              : "Supportato"}
          </div>

          <div>
            <span className="block text-[10px] uppercase text-[#06142E]/35">
              Permesso
            </span>
            {permission}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={
              busy ||
              supported === false
            }
            onClick={toggleNotifications}
            className="min-h-11 rounded-[13px] bg-[#06142E] px-5 text-xs font-black uppercase text-white disabled:opacity-40"
          >
            {busy
              ? "Attendere..."
              : enabled
                ? "Disattiva notifiche"
                : "Attiva notifiche"}
          </button>

          <button
            type="button"
            disabled={
              busy ||
              !enabled
            }
            onClick={sendTest}
            className="inline-flex min-h-11 items-center gap-2 rounded-[13px] border border-[#06142E]/15 bg-white px-5 text-xs font-black uppercase text-[#06142E] disabled:opacity-40"
          >
            <Send size={15} />
            Test notifica
          </button>
        </div>

        {message && (
          <p
            role="status"
            className="mt-4 rounded-[13px] border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800"
          >
            {message}
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-[13px] border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700"
          >
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
