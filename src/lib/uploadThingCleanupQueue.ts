import "server-only";

import {
  createHash,
} from "node:crypto";

import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";

import {
  adminDb,
} from "@/src/lib/firebaseAdmin";

const CLEANUP_QUEUE_COLLECTION =
  "uploadThingCleanupQueue";

const UNCLAIMED_UPLOAD_GRACE_MS =
  24 * 60 * 60 * 1000;

export type UploadThingCleanupCandidateInput = {
  key: string;
  url?: string;
  source: string;
  uploadedBy?: string;
};

function normalizeOptionalString(
  value: unknown,
): string | undefined {
  if (
    typeof value !==
    "string"
  ) {
    return undefined;
  }

  const normalized =
    value.trim();

  return normalized ||
    undefined;
}

function createQueueDocumentId(
  key: string,
) {
  return createHash(
    "sha256",
  )
    .update(key)
    .digest("hex");
}

/*
 * ============================================================
 * REGISTRA UPLOAD NON ANCORA AGGANCIATO A FIRESTORE
 * ============================================================
 *
 * Ogni file appena caricato viene considerato temporaneamente
 * "non reclamato". La Firebase Function di cleanup aspetta 24h
 * e, prima di cancellarlo, verifica che nessun documento lo
 * abbia nel frattempo referenziato.
 *
 * Questo copre anche il caso:
 * upload -> annulla/chiudi il form -> file orfano.
 * ============================================================
 */

export async function enqueueUploadedFileForCleanup({
  key,
  url,
  source,
  uploadedBy,
}: UploadThingCleanupCandidateInput): Promise<void> {
  const normalizedKey =
    normalizeOptionalString(
      key,
    );

  if (!normalizedKey) {
    return;
  }

  const normalizedUrl =
    normalizeOptionalString(
      url,
    );

  const normalizedSource =
    normalizeOptionalString(
      source,
    ) ??
    "uploadthing";

  const normalizedUploadedBy =
    normalizeOptionalString(
      uploadedBy,
    );

  const now = Date.now();

  await adminDb
    .collection(
      CLEANUP_QUEUE_COLLECTION,
    )
    .doc(
      createQueueDocumentId(
        normalizedKey,
      ),
    )
    .set(
      {
        key:
          normalizedKey,

        ...(normalizedUrl
          ? {
              url:
                normalizedUrl,
            }
          : {}),

        reason:
          "upload-unclaimed",

        source:
          normalizedSource,

        ...(normalizedUploadedBy
          ? {
              uploadedBy:
                normalizedUploadedBy,
            }
          : {}),

        notBeforeAt:
          Timestamp.fromMillis(
            now +
              UNCLAIMED_UPLOAD_GRACE_MS,
          ),

        queuedAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      },
    );
}
