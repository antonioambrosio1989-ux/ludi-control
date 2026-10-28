import "server-only";

import type {
  DocumentSnapshot,
} from "firebase-admin/firestore";

import {
  adminDb,
  adminMessaging,
} from "@/src/lib/firebaseAdmin";

import type {
  NotificationCategory,
  NotificationPreferences,
} from "@/src/types/Notification";

/*
 * ============================================================
 * TYPES
 * ============================================================
 */

export type PushNotificationInput = {
  title:
    string;

  body:
    string;

  link?:
    string;

  category?:
    NotificationCategory |
    "test";
};

export type PushSendResult = {
  attempted:
    number;

  sent:
    number;

  failed:
    number;

  skipped:
    boolean;
};

type PushInstallation = {
  id:
    string;

  fid:
    string;

  uid:
    string;
};

const MAX_FIDS_PER_BATCH =
  500;

/*
 * ============================================================
 * PUBLIC SERVICE
 * ============================================================
 */

export const PushNotificationSender = {
  async sendToUser({
    uid,
    notification,
    respectCategory =
      true,
    targetFid,
  }: {
    uid:
      string;

    notification:
      PushNotificationInput;

    respectCategory?:
      boolean;
    targetFid?: string;
  }): Promise<PushSendResult> {
    const normalizedUid =
      uid.trim();

    if (
      !normalizedUid
    ) {
      return emptyResult(
        true,
      );
    }

    const settings =
      await getUserNotificationSettings(
        normalizedUid,
      );

    if (
      !settings.notificationsEnabled
    ) {
      return emptyResult(
        true,
      );
    }

    if (
      respectCategory &&
      notification.category &&
      notification.category !==
        "test" &&
      !settings.notificationPreferences[
        notification.category
      ]
    ) {
      return emptyResult(
        true,
      );
    }

    const installations =
      await getInstallationsForUser(
        normalizedUid,
      );

    // Il test deve interessare solo il token registrato per questo UID.
    const selectedInstallations = targetFid
      ? installations.filter((installation) => installation.fid === targetFid)
      : installations;

    return sendToInstallations({
      installations: selectedInstallations,
      notification,
    });
  },

  async sendToCategory({
    category,
    title,
    body,
    link,
  }: {
    category:
      NotificationCategory;

    title:
      string;

    body:
      string;

    link?:
      string;
  }): Promise<PushSendResult> {
    const installations =
      await getAllInstallations();

    if (
      installations.length ===
      0
    ) {
      return emptyResult(
        true,
      );
    }

    const userIds =
      Array.from(
        new Set(
          installations.map(
            (
              installation,
            ) =>
              installation.uid,
          ),
        ),
      );

    const settingsByUid =
      await getSettingsForUsers(
        userIds,
      );

    const eligibleInstallations =
      installations.filter(
        (
          installation,
        ) => {
          const settings =
            settingsByUid.get(
              installation.uid,
            );

          return Boolean(
            settings
              ?.notificationsEnabled &&
            settings.notificationPreferences[
              category
            ],
          );
        },
      );

    return sendToInstallations({
      installations:
        eligibleInstallations,

      notification: {
        title,
        body,
        link,
        category,
      },
    });
  },
};

/*
 * ============================================================
 * SEND
 * ============================================================
 */

async function sendToInstallations({
  installations,
  notification,
}: {
  installations:
    PushInstallation[];

  notification:
    PushNotificationInput;
}): Promise<PushSendResult> {
  if (
    installations.length ===
    0
  ) {
    return emptyResult(
      true,
    );
  }

  const title =
    notification.title
      .trim()
      .slice(
        0,
        120,
      ) ||
    "Ludis League";

  const body =
    notification.body
      .trim()
      .slice(
        0,
        300,
      );

  const link =
    normalizeLink(
      notification.link,
    );

  const category =
    notification.category ??
    "test";

  let attempted =
    0;

  let sent =
    0;

  let failed =
    0;

  for (
    let index = 0;
    index <
      installations.length;
    index +=
      MAX_FIDS_PER_BATCH
  ) {
    const batch =
      installations.slice(
        index,
        index +
          MAX_FIDS_PER_BATCH,
      );

    const fids =
      batch.map(
        (
          installation,
        ) =>
          installation.fid,
      );

    attempted +=
      fids.length;

    const response =
      await adminMessaging.sendEachForMulticast(
        {
          tokens: fids,

          // Test diagnostico iOS: oltre ai dati, forniamo un payload
          // notification FCM standard. I promemoria operativi restano
          // data-only finche non e verificata la ricezione su iPhone.
          // Il service worker attuale gestisce l evento push manualmente.
          ...(category === "test"
            ? { notification: { title, body } }
            : {}),

          data: {
            title,
            body,
            link,
            category,
          },

          webpush: {
            headers: {
              Urgency:
                "high",
            },
          },
        },
      );

    sent +=
      response.successCount;

    failed +=
      response.failureCount;

    const staleInstallationIds:
      string[] =
      [];

    response.responses.forEach(
      (
        currentResponse,
        responseIndex,
      ) => {
        if (
          currentResponse.success
        ) {
          return;
        }

        const errorCode =
          currentResponse.error
            ?.code ??
          "";

        if (
          errorCode.includes(
            "not-registered",
          ) ||
          errorCode.includes(
            "invalid-registration",
          )
        ) {
          const staleInstallation =
            batch[
              responseIndex
            ];

          if (
            staleInstallation
          ) {
            staleInstallationIds.push(
              staleInstallation.id,
            );
          }
        }
      },
    );

    await removeStaleInstallations(
      staleInstallationIds,
    );
  }

  return {
    attempted,
    sent,
    failed,
    skipped:
      false,
  };
}

/*
 * ============================================================
 * INSTALLATIONS
 * ============================================================
 */

async function getInstallationsForUser(
  uid:
    string,
): Promise<
  PushInstallation[]
> {
  const snapshot =
    await adminDb
      .collection(
        "pushInstallations",
      )
      .where(
        "uid",
        "==",
        uid,
      )
      .get();

  return snapshot.docs
    .map(
      mapInstallation,
    )
    .filter(
      (
        installation,
      ) =>
        Boolean(
          installation,
        ),
    ) as
    PushInstallation[];
}

async function getAllInstallations():
  Promise<
    PushInstallation[]
  > {
  const snapshot =
    await adminDb
      .collection(
        "pushInstallations",
      )
      .get();

  return snapshot.docs
    .map(
      mapInstallation,
    )
    .filter(
      (
        installation,
      ) =>
        Boolean(
          installation,
        ),
    ) as
    PushInstallation[];
}

function mapInstallation(
  snapshot:
    DocumentSnapshot,
): PushInstallation |
  null {
  const data =
    snapshot.data();

  const fid =
    typeof data?.fid ===
      "string"
      ? data.fid.trim()
      : "";

  const uid =
    typeof data?.uid ===
      "string"
      ? data.uid.trim()
      : "";

  if (
    !fid ||
    !uid
  ) {
    return null;
  }

  return {
    id:
      snapshot.id,

    fid,

    uid,
  };
}

async function removeStaleInstallations(
  installationIds:
    string[],
): Promise<void> {
  if (
    installationIds.length ===
    0
  ) {
    return;
  }

  const batch =
    adminDb.batch();

  installationIds.forEach(
    (
      installationId,
    ) => {
      batch.delete(
        adminDb
          .collection(
            "pushInstallations",
          )
          .doc(
            installationId,
          ),
      );
    },
  );

  await batch.commit();
}

/*
 * ============================================================
 * USER SETTINGS
 * ============================================================
 */

type ServerNotificationSettings = {
  notificationsEnabled:
    boolean;

  notificationPreferences:
    NotificationPreferences;
};

async function getUserNotificationSettings(
  uid:
    string,
): Promise<
  ServerNotificationSettings
> {
  const snapshot =
    await adminDb
      .collection(
        "users",
      )
      .doc(
        uid,
      )
      .collection(
        "settings",
      )
      .doc(
        "preferences",
      )
      .get();

  return mapSettings(
    snapshot,
  );
}

async function getSettingsForUsers(
  userIds:
    string[],
): Promise<
  Map<
    string,
    ServerNotificationSettings
  >
> {
  const result =
    new Map<
      string,
      ServerNotificationSettings
    >();

  /*
   * Evitiamo richieste gigantesche mantenendo blocchi ridotti.
   */

  const chunkSize =
    200;

  for (
    let index = 0;
    index <
      userIds.length;
    index +=
      chunkSize
  ) {
    const chunk =
      userIds.slice(
        index,
        index +
          chunkSize,
      );

    const references =
      chunk.map(
        (
          uid,
        ) =>
          adminDb
            .collection(
              "users",
            )
            .doc(
              uid,
            )
            .collection(
              "settings",
            )
            .doc(
              "preferences",
            ),
      );

    const snapshots =
      await adminDb.getAll(
        ...references,
      );

    snapshots.forEach(
      (
        snapshot,
        snapshotIndex,
      ) => {
        const uid =
          chunk[
            snapshotIndex
          ];

        if (
          uid
        ) {
          result.set(
            uid,
            mapSettings(
              snapshot,
            ),
          );
        }
      },
    );
  }

  return result;
}

function mapSettings(
  snapshot:
    DocumentSnapshot,
): ServerNotificationSettings {
  const data =
    snapshot.data();

  return {
    notificationsEnabled:
      data?.notificationsEnabled ===
      true,

    notificationPreferences: {
      matchday:
        true,

      matchReports:
        true,

      ludisWeek:
        true,

      calendar:
        true,
    },
  };
}

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function normalizeLink(
  link:
    string | undefined,
): string {
  const normalized =
    link?.trim() ??
    "";

  if (
    !normalized
  ) {
    return "/";
  }

  if (
    normalized.startsWith(
      "/",
    )
  ) {
    return normalized;
  }

  try {
    const url =
      new URL(
        normalized,
      );

    return url.pathname +
      url.search +
      url.hash;
  } catch {
    return "/";
  }
}

function emptyResult(
  skipped:
    boolean,
): PushSendResult {
  return {
    attempted:
      0,

    sent:
      0,

    failed:
      0,

    skipped,
  };
}
