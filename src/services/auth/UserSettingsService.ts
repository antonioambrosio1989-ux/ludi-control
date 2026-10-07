import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import {
  db,
} from "@/src/lib/firebase";

/*
 * ============================================================
 * NOTIFICATION PREFERENCES
 * ============================================================
 */

export type NotificationPreferences = {
  matchday:
    boolean;

  matchReports:
    boolean;

  ludisWeek:
    boolean;

  calendar:
    boolean;
};

/*
 * ============================================================
 * FAVORITE PLAYERS
 * ============================================================
 */

export type FavoritePlayerPreference = {
  competitionId:
    string;

  playerId:
    string;
};

/*
 * ============================================================
 * USER SETTINGS
 * ============================================================
 */

export type FavoriteTeamPreference = { competitionId: string; teamId: string };

export type UserSettings = {
  favoriteTeam?: FavoriteTeamPreference | null;
  notificationsEnabled:
    boolean;

  notificationPreferences:
    NotificationPreferences;

  favoritePlayers:
    FavoritePlayerPreference[];
};

/*
 * ============================================================
 * DEFAULT NOTIFICATION PREFERENCES
 * ============================================================
 */

export const DEFAULT_NOTIFICATION_PREFERENCES:
  NotificationPreferences = {
    matchday:
      true,

    matchReports:
      true,

    ludisWeek:
      true,

    calendar:
      true,
  };

/*
 * ============================================================
 * DEFAULT SETTINGS
 * ============================================================
 */

const DEFAULT_USER_SETTINGS:
  UserSettings = {
    notificationsEnabled:
      false,

    notificationPreferences: {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
    },

    favoritePlayers:
      [],
  };

/*
 * ============================================================
 * REFERENCES
 * ============================================================
 */

function getSettingsRef(
  uid:
    string,
) {
  return doc(
    db,
    "users",
    uid,
    "settings",
    "preferences",
  );
}

/*
 * ============================================================
 * NORMALIZE NOTIFICATION PREFERENCES
 * ============================================================
 */

function normalizeNotificationPreferences(
  value:
    unknown,
): NotificationPreferences {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
    };
  }

  const data =
    value as Record<
      string,
      unknown
    >;

  return {
    matchday:
      data.matchday !==
      false,

    matchReports:
      data.matchReports !==
      false,

    ludisWeek:
      data.ludisWeek !==
      false,

    calendar:
      data.calendar !==
      false,
  };
}

/*
 * ============================================================
 * NORMALIZE FAVORITE PLAYERS
 * ============================================================
 */

function normalizeFavoritePlayers(
  value:
    unknown,
): FavoritePlayerPreference[] {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return [];
  }

  const result:
    FavoritePlayerPreference[] =
      [];

  const seen =
    new Set<
      string
    >();

  for (
    const currentValue of
    value
  ) {
    if (
      !currentValue ||
      typeof currentValue !==
        "object"
    ) {
      continue;
    }

    const data =
      currentValue as Record<
        string,
        unknown
      >;

    const competitionId =
      typeof data.competitionId ===
      "string"
        ? data.competitionId.trim()
        : "";

    const playerId =
      typeof data.playerId ===
      "string"
        ? data.playerId.trim()
        : "";

    if (
      !competitionId ||
      !playerId
    ) {
      continue;
    }

    const key =
      `${competitionId}|${playerId}`;

    if (
      seen.has(
        key,
      )
    ) {
      continue;
    }

    seen.add(
      key,
    );

    result.push({
      competitionId,
      playerId,
    });

    if (
      result.length ===
      1
    ) {
      break;
    }
  }

  return result;
}

function normalizeFavoriteTeam(value: unknown): FavoriteTeamPreference | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (typeof data.competitionId !== "string" || typeof data.teamId !== "string") return null;
  const competitionId = data.competitionId.trim(), teamId = data.teamId.trim();
  return competitionId && teamId ? {competitionId, teamId} : null;
}

/*
 * ============================================================
 * SERVICE
 * ============================================================
 */

export const UserSettingsService = {
  /*
   * ==========================================================
   * GET SETTINGS
   * ==========================================================
   */

  async getByUid(
    uid:
      string,
  ): Promise<UserSettings> {
    const snapshot =
      await getDoc(
        getSettingsRef(
          uid,
        ),
      );

    if (
      !snapshot.exists()
    ) {
      return {
        ...DEFAULT_USER_SETTINGS,

        notificationPreferences: {
          ...DEFAULT_USER_SETTINGS.notificationPreferences,
        },

        favoritePlayers:
          [],
      };
    }

    const data =
      snapshot.data();

    return {
      favoriteTeam: normalizeFavoriteTeam(data.favoriteTeam),
      notificationsEnabled:
        data.notificationsEnabled ===
        true,

      notificationPreferences:
        normalizeNotificationPreferences(
          data.notificationPreferences,
        ),

      favoritePlayers:
        normalizeFavoritePlayers(
          data.favoritePlayers,
        ),
    };
  },

  /*
   * ==========================================================
   * SET NOTIFICATIONS
   * ==========================================================
   */

  async setNotificationsEnabled({
    uid,
    enabled,
    notificationPreferences,
  }: {
    uid:
      string;

    enabled:
      boolean;

    notificationPreferences?:
      NotificationPreferences;
  }): Promise<void> {
    const reference =
      getSettingsRef(
        uid,
      );

    const snapshot =
      await getDoc(
        reference,
      );

    const preferences =
      notificationPreferences ??
      (
        snapshot.exists()
          ? normalizeNotificationPreferences(
              snapshot.data()
                .notificationPreferences,
            )
          : {
              ...DEFAULT_NOTIFICATION_PREFERENCES,
            }
      );

    if (
      !snapshot.exists()
    ) {
      await setDoc(
        reference,
        {
          notificationsEnabled:
            enabled,

          notificationPreferences:
            preferences,

          favoritePlayers:
            [],

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        },
      );

      return;
    }

    await updateDoc(
      reference,
      {
        notificationsEnabled:
          enabled,

        notificationPreferences:
          preferences,

        updatedAt:
          serverTimestamp(),
      },
    );
  },

  /*
   * ==========================================================
   * SET NOTIFICATION PREFERENCES
   * ==========================================================
   */

  async setNotificationPreferences({
    uid,
    preferences,
  }: {
    uid:
      string;

    preferences:
      NotificationPreferences;
  }): Promise<void> {
    const reference =
      getSettingsRef(
        uid,
      );

    const snapshot =
      await getDoc(
        reference,
      );

    if (
      !snapshot.exists()
    ) {
      await setDoc(
        reference,
        {
          notificationsEnabled:
            false,

          notificationPreferences:
            preferences,

          favoritePlayers:
            [],

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        },
      );

      return;
    }

    await updateDoc(
      reference,
      {
        notificationPreferences:
          preferences,

        updatedAt:
          serverTimestamp(),
      },
    );
  },

  /*
   * ==========================================================
   * SET FAVORITE PLAYERS
   * ==========================================================
   */

  async setFavoriteTeam({uid, favoriteTeam}: {uid: string; favoriteTeam: FavoriteTeamPreference | null}): Promise<void> {
    if (!uid.trim()) throw new Error("Utente non valido.");
    const normalized = normalizeFavoriteTeam(favoriteTeam);
    if (favoriteTeam && !normalized) throw new Error("Squadra non valida.");
    const reference = getSettingsRef(uid.trim());
    const snapshot = await getDoc(reference);
    if (snapshot.exists()) {
      await updateDoc(reference, {favoriteTeam: normalized, updatedAt: serverTimestamp()});
    } else {
      await setDoc(reference, {...DEFAULT_USER_SETTINGS, favoriteTeam: normalized, createdAt: serverTimestamp(), updatedAt: serverTimestamp()});
    }
  },

  async setFavoritePlayers({
    uid,
    favoritePlayers,
  }: {
    uid:
      string;

    favoritePlayers:
      FavoritePlayerPreference[];
  }): Promise<void> {
    const normalizedUid =
      uid.trim();

    if (
      !normalizedUid
    ) {
      throw new Error(
        "Utente non valido.",
      );
    }

    if (
      favoritePlayers.length >
      1
    ) {
      throw new Error(
        "Puoi scegliere un solo giocatore preferito.",
      );
    }

    const normalizedFavoritePlayers =
      normalizeFavoritePlayers(
        favoritePlayers,
      );

    const reference =
      getSettingsRef(
        normalizedUid,
      );

    const snapshot =
      await getDoc(
        reference,
      );

    if (
      !snapshot.exists()
    ) {
      await setDoc(
        reference,
        {
          notificationsEnabled:
            false,

          notificationPreferences: {
            ...DEFAULT_NOTIFICATION_PREFERENCES,
          },

          favoritePlayers:
            normalizedFavoritePlayers,

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        },
      );

      return;
    }

    await updateDoc(
      reference,
      {
        favoritePlayers:
          normalizedFavoritePlayers,

        updatedAt:
          serverTimestamp(),
      },
    );
  },

  /*
   * ==========================================================
   * BROWSER NOTIFICATION SUPPORT
   * ==========================================================
   */

  isNotificationSupported():
    boolean {
    if (
      typeof window ===
      "undefined"
    ) {
      return false;
    }

    return (
      "Notification" in
      window
    );
  },

  /*
   * ==========================================================
   * CURRENT PERMISSION
   * ==========================================================
   */

  getNotificationPermission():
    NotificationPermission |
    "unsupported" {
    if (
      typeof window ===
        "undefined" ||
      !(
        "Notification" in
        window
      )
    ) {
      return "unsupported";
    }

    return Notification.permission;
  },

  /*
   * ==========================================================
   * REQUEST PERMISSION
   * ==========================================================
   */

  async requestNotificationPermission():
    Promise<
      NotificationPermission |
      "unsupported"
    > {
    if (
      typeof window ===
        "undefined" ||
      !(
        "Notification" in
        window
      )
    ) {
      return "unsupported";
    }

    return Notification.requestPermission();
  },
};
