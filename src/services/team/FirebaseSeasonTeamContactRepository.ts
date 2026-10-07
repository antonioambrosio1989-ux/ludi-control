import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";

import {
  db,
} from "@/src/lib/firebase";

import type {
  SaveSeasonTeamContactInput,
  SeasonTeamContact,
} from "@/src/types/SeasonTeamContact";

const SEASONS_COLLECTION =
  "seasons";

const CONTACTS_COLLECTION =
  "teamContacts";

function getContactsCollection(
  seasonId: string,
) {
  return collection(
    db,
    SEASONS_COLLECTION,
    seasonId,
    CONTACTS_COLLECTION,
  );
}

function getContactDocument(
  seasonId: string,
  teamId: string,
) {
  return doc(
    db,
    SEASONS_COLLECTION,
    seasonId,
    CONTACTS_COLLECTION,
    teamId,
  );
}

function mapContact(
  documentId: string,
  data: Record<string, unknown>,
): SeasonTeamContact {
  return {
    id: documentId,

    seasonId:
      typeof data.seasonId ===
      "string"
        ? data.seasonId
        : "",

    teamId:
      typeof data.teamId ===
      "string"
        ? data.teamId
        : documentId,

    presidentPhoneE164:
      typeof data.presidentPhoneE164 ===
        "string" &&
      data.presidentPhoneE164.trim()
        ? data.presidentPhoneE164
        : undefined,

    whatsappOptIn:
      data.whatsappOptIn ===
      true,

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

export function normalizeWhatsAppPhone(
  value: string,
): string | undefined {
  const compactValue =
    value
      .trim()
      .replace(
        /[\s().-]/g,
        "",
      );

  if (!compactValue) {
    return undefined;
  }

  const withInternationalPrefix =
    compactValue.startsWith("00")
      ? `+${compactValue.slice(2)}`
      : compactValue.startsWith("+")
        ? compactValue
        : /^3\d{9}$/.test(
              compactValue,
            )
          ? `+39${compactValue}`
          : `+${compactValue}`;

  if (
    !/^\+[1-9]\d{7,14}$/.test(
      withInternationalPrefix,
    )
  ) {
    throw new Error(
      "Inserisci il numero WhatsApp con prefisso internazionale, ad esempio +393331234567.",
    );
  }

  return withInternationalPrefix;
}

export const FirebaseSeasonTeamContactRepository =
  {
    subscribeAll(
      seasonId: string,
      onChange: (
        contacts: SeasonTeamContact[],
      ) => void,
      onError?: (
        error: Error,
      ) => void,
    ): Unsubscribe {
      if (!seasonId.trim()) {
        throw new Error(
          "Season ID non valido.",
        );
      }

      return onSnapshot(
        getContactsCollection(
          seasonId,
        ),

        (snapshot) => {
          onChange(
            snapshot.docs.map(
              (currentDocument) =>
                mapContact(
                  currentDocument.id,
                  currentDocument.data(),
                ),
            ),
          );
        },

        (error) => {
          console.error(
            "Errore caricamento contatti stagionali:",
            error,
          );

          onError?.(error);
        },
      );
    },

    async save(
      input: SaveSeasonTeamContactInput,
    ): Promise<void> {
      const seasonId =
        input.seasonId.trim();

      const teamId =
        input.teamId.trim();

      if (!seasonId || !teamId) {
        throw new Error(
          "Stagione o squadra non valida.",
        );
      }

      const presidentPhoneE164 =
        normalizeWhatsAppPhone(
          input.presidentPhone ??
            "",
        );

      if (
        input.whatsappOptIn &&
        !presidentPhoneE164
      ) {
        throw new Error(
          "Inserisci il numero WhatsApp prima di attivare i messaggi automatici.",
        );
      }

      await setDoc(
        getContactDocument(
          seasonId,
          teamId,
        ),
        {
          seasonId,
          teamId,

          presidentPhoneE164:
            presidentPhoneE164 ??
            null,

          whatsappOptIn:
            Boolean(
              presidentPhoneE164 &&
                input.whatsappOptIn,
            ),

          updatedAt:
            serverTimestamp(),
        },
        {
          merge: true,
        },
      );
    },

    async remove(
      seasonId: string,
      teamId: string,
    ): Promise<void> {
      if (
        !seasonId.trim() ||
        !teamId.trim()
      ) {
        return;
      }

      await deleteDoc(
        getContactDocument(
          seasonId,
          teamId,
        ),
      );
    },
  };
