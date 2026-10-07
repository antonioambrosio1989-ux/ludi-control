"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  Trophy,
} from "lucide-react";

import {
  useAuth,
} from "@/src/hooks/useAuth";

type AdminGamesNotification = {
  id:
    string;

  title:
    string;

  message:
    string;

  displayName:
    string;

  matchweek:
    number;

  createdAt:
    string | null;
};

export default function AdminGamesNotificationsCard() {
  const {
    user,
  } =
    useAuth();

  const [
    notifications,
    setNotifications,
  ] =
    useState<
      AdminGamesNotification[]
    >(
      [],
    );

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  useEffect(
    () => {
      if (!user) {
        return;
      }

      let active =
        true;

      const activeUser =
        user;

      async function loadNotifications() {
        try {
          const token =
            await activeUser.getIdToken();

          const response =
            await fetch(
              "/api/admin/games/notifications",
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },

                cache:
                  "no-store",
              },
            );

          const data =
            await response.json() as {
              notifications?:
                AdminGamesNotification[];

              error?:
                string;
            };

          if (
            !response.ok
          ) {
            throw new Error(
              data.error ||
                "Impossibile caricare le notifiche Games.",
            );
          }

          if (!active) {
            return;
          }

          setNotifications(
            Array.isArray(
              data.notifications,
            )
              ? data.notifications
              : [],
          );

          setError(
            null,
          );
        } catch (
          currentError
        ) {
          if (!active) {
            return;
          }

          console.error(
            "Errore notifiche Games Admin:",
            currentError,
          );

          setError(
            currentError instanceof
              Error
              ? currentError.message
              : "Impossibile caricare le notifiche Games.",
          );
        }
      }

      void loadNotifications();

      function handleFocus() {
        void loadNotifications();
      }

      window.addEventListener(
        "focus",
        handleFocus,
      );

      return () => {
        active =
          false;

        window.removeEventListener(
          "focus",
          handleFocus,
        );
      };
    },
    [
      user,
    ],
  );

  if (
    notifications.length ===
      0 &&
    !error
  ) {
    return null;
  }

  return (
    <section className="mb-5 rounded-[13px] border border-amber-200 bg-amber-50 p-5 shadow-[0_10px_24px_rgba(6,20,46,0.08)]">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-amber-300 text-[#06142E]">
          <Trophy
            aria-hidden="true"
            className="h-6 w-6"
            strokeWidth={2.4}
          />
        </span>

        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/45">
            Notifiche Games
          </p>

          <h2 className="mt-1 text-lg font-black uppercase text-[#06142E]">
            Ludi Bet Club
          </h2>
        </div>
      </div>

      {error ? (
        <p className="mt-4 text-xs font-bold leading-5 text-red-700">
          {error}
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {notifications.map(
            (
              notification,
            ) => (
              <article
                key={
                  notification.id
                }
                className="rounded-[12px] bg-white p-4"
              >
                <p className="text-sm font-black leading-5 text-[#06142E]">
                  {notification.message}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold uppercase text-[#06142E]/35">
                  {notification.matchweek >
                    0 && (
                    <span>
                      MW {notification.matchweek}
                    </span>
                  )}

                  {notification.createdAt && (
                    <span>
                      {formatNotificationDate(
                        notification.createdAt,
                      )}
                    </span>
                  )}
                </div>
              </article>
            ),
          )}
        </div>
      )}
    </section>
  );
}

function formatNotificationDate(
  value:
    string,
): string {
  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "it-IT",
    {
      day:
        "2-digit",

      month:
        "2-digit",

      hour:
        "2-digit",

      minute:
        "2-digit",
    },
  ).format(
    date,
  );
}
