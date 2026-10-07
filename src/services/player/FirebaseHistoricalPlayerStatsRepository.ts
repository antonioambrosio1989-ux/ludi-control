import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";

import type {
  HistoricalPlayerSeasonStats,
  HistoricalPlayerSeasonStatsInput,
} from "@/src/types/HistoricalPlayerSeasonStats";

const COLLECTION_NAME =
  "historicalPlayerSeasonStats";

export class FirebaseHistoricalPlayerStatsRepository {
  static createDocumentId(
    seasonId: string,
    playerId: string,
  ) {
    return `${seasonId}__${playerId}`;
  }

  static async mergePlayerReferences({
  sourcePlayerId,
  targetPlayerId,
}: {
  sourcePlayerId: string;
  targetPlayerId: string;
}): Promise<void> {
  if (
    sourcePlayerId ===
    targetPlayerId
  ) {
    return;
  }

  const reference =
    query(
      collection(
        db,
        COLLECTION_NAME,
      ),
      where(
        "playerId",
        "==",
        sourcePlayerId,
      ),
    );

  const snapshot =
    await getDocs(
      reference,
    );

  for (
    const sourceDocument of
      snapshot.docs
  ) {
    const sourceStats =
      normalizeDocument(
        sourceDocument.id,
        sourceDocument.data(),
      );

    const targetDocumentId =
      this.createDocumentId(
        sourceStats.seasonId,
        targetPlayerId,
      );

    const targetReference =
      doc(
        db,
        COLLECTION_NAME,
        targetDocumentId,
      );

    const targetSnapshot =
      await getDoc(
        targetReference,
      );

    /*
     * Se il profilo principale NON ha
     * già statistiche per questa stagione,
     * trasferiamo direttamente quelle
     * del duplicato.
     */
    if (
      !targetSnapshot.exists()
    ) {
      await setDoc(
        targetReference,
        {
          seasonId:
            sourceStats.seasonId,

          seasonName:
            sourceStats.seasonName,

          competitionId:
            sourceStats.competitionId,

          playerId:
            targetPlayerId,

          teamId:
            sourceStats.teamId ??
            null,

          teamName:
            sourceStats.teamName ??
            null,

          appearances:
            sourceStats.appearances,

          goals:
            sourceStats.goals,

          assists:
            sourceStats.assists,

          ownGoals:
            sourceStats.ownGoals,

          averageVote:
            sourceStats.averageVote ??
            null,

          yellowCards:
            sourceStats.yellowCards,

          redCards:
            sourceStats.redCards,

          createdAt:
            sourceStats.createdAt ??
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        },
      );
    } else {
      /*
       * Caso più importante:
       *
       * target e source hanno già statistiche
       * nella STESSA stagione.
       *
       * In quel caso le sommiamo,
       * evitando di perdere dati.
       */

      const targetStats =
        normalizeDocument(
          targetSnapshot.id,
          targetSnapshot.data(),
        );

      const targetRatedAppearances =
        targetStats.averageVote !==
          undefined
          ? targetStats.appearances
          : 0;

      const sourceRatedAppearances =
        sourceStats.averageVote !==
          undefined
          ? sourceStats.appearances
          : 0;

      const totalRatedAppearances =
        targetRatedAppearances +
        sourceRatedAppearances;

      const mergedAverageVote =
        totalRatedAppearances >
        0
          ? (
              (
                (targetStats.averageVote ??
                  0) *
                  targetRatedAppearances +
                (sourceStats.averageVote ??
                  0) *
                  sourceRatedAppearances
              ) /
              totalRatedAppearances
            )
          : undefined;

      const teamNames =
        Array.from(
          new Set(
            [
              targetStats.teamName,
              sourceStats.teamName,
            ].filter(
              (
                value,
              ): value is string =>
                Boolean(
                  value?.trim(),
                ),
            ),
          ),
        );

      await setDoc(
        targetReference,
        {
          seasonId:
            targetStats.seasonId,

          seasonName:
            targetStats.seasonName ||
            sourceStats.seasonName,

          competitionId:
            targetStats.competitionId ||
            sourceStats.competitionId,

          playerId:
            targetPlayerId,

          teamId:
            targetStats.teamId ??
            sourceStats.teamId ??
            null,

          teamName:
            teamNames.length >
            0
              ? teamNames.join(
                  " / ",
                )
              : null,

          appearances:
            targetStats.appearances +
            sourceStats.appearances,

          goals:
            targetStats.goals +
            sourceStats.goals,

          assists:
            targetStats.assists +
            sourceStats.assists,

          ownGoals:
            targetStats.ownGoals +
            sourceStats.ownGoals,

          averageVote:
            mergedAverageVote ??
            null,

          yellowCards:
            targetStats.yellowCards +
            sourceStats.yellowCards,

          redCards:
            targetStats.redCards +
            sourceStats.redCards,

          updatedAt:
            serverTimestamp(),
        },
        {
          merge:
            true,
        },
      );
    }

    /*
     * Solo dopo aver salvato correttamente
     * il documento del profilo principale
     * possiamo eliminare quello del duplicato.
     */

    await deleteDoc(
      sourceDocument.ref,
    );
  }
}
  
  static async upsert(
  input: HistoricalPlayerSeasonStatsInput,
): Promise<void> {
  validateInput(input);

  const normalizedSeasonName =
    normalizeHistoricalSeasonName(
      input.seasonName,
    );

  const normalizedCompetitionId =
    input.competitionId.trim();

  const normalizedPlayerId =
    input.playerId.trim();

  /*
   * ==========================================================
   * CERCA EVENTUALI RECORD DELLA STESSA STAGIONE LOGICA
   * ==========================================================
   *
   * Questo protegge da casi in cui la stessa stagione
   * (es. 2019/20) sia stata importata con seasonId differenti.
   */

  const existingSnapshot =
    await getDocs(
      query(
        collection(
          db,
          COLLECTION_NAME,
        ),
        where(
          "playerId",
          "==",
          normalizedPlayerId,
        ),
      ),
    );

  const duplicateDocuments =
    existingSnapshot.docs.filter(
      (document) => {
        const current =
          normalizeDocument(
            document.id,
            document.data(),
          );

        return (
          current.competitionId ===
            normalizedCompetitionId &&
          normalizeHistoricalSeasonName(
            current.seasonName,
          ) ===
            normalizedSeasonName
        );
      },
    );

  /*
   * Documento canonico che vogliamo utilizzare
   * da questo momento in avanti.
   */

  const documentId =
    this.createDocumentId(
      input.seasonId,
      normalizedPlayerId,
    );

  const reference =
    doc(
      db,
      COLLECTION_NAME,
      documentId,
    );

  await setDoc(
    reference,
    {
      seasonId:
        input.seasonId,

      seasonName:
        input.seasonName.trim(),

      competitionId:
        normalizedCompetitionId,

      playerId:
        normalizedPlayerId,

      teamId:
        input.teamId ??
        null,

      teamName:
        input.teamName?.trim() ??
        null,

      appearances:
        normalizeInteger(
          input.appearances,
        ),

      goals:
        normalizeInteger(
          input.goals,
        ),

      assists:
        normalizeInteger(
          input.assists ?? 0,
        ),

      ownGoals:
        normalizeInteger(
          input.ownGoals ?? 0,
        ),

      averageVote:
        input.averageVote !==
        undefined
          ? normalizeAverageVote(
              input.averageVote,
            )
          : null,

      yellowCards:
        normalizeInteger(
          input.yellowCards ?? 0,
        ),

      redCards:
        normalizeInteger(
          input.redCards ?? 0,
        ),

      updatedAt:
        serverTimestamp(),

      createdAt:
        serverTimestamp(),
    },
    {
      merge:
        true,
    },
  );

  /*
   * ==========================================================
   * ELIMINA EVENTUALI COPIE LEGACY
   * ==========================================================
   *
   * NON sommiamo le statistiche.
   *
   * Il file Excel appena importato è considerato
   * la sorgente autorevole per questa stagione.
   */

  for (
    const duplicateDocument of
    duplicateDocuments
  ) {
    if (
      duplicateDocument.id ===
      documentId
    ) {
      continue;
    }

    await deleteDoc(
      duplicateDocument.ref,
    );
  }
}

  static async getAll(): Promise<
    HistoricalPlayerSeasonStats[]
  > {
    const snapshot =
      await getDocs(
        collection(
          db,
          COLLECTION_NAME,
        ),
      );

    return snapshot.docs.map(
      (document) =>
        normalizeDocument(
          document.id,
          document.data(),
        ),
    );
  }

  static async getByCompetition(
    competitionId: string,
  ): Promise<
    HistoricalPlayerSeasonStats[]
  > {
    const normalizedCompetitionId =
      competitionId.trim();

    if (
      !normalizedCompetitionId
    ) {
      return [];
    }

    const snapshot =
      await getDocs(
        query(
          collection(
            db,
            COLLECTION_NAME,
          ),

          where(
            "competitionId",
            "==",
            normalizedCompetitionId,
          ),
        ),
      );

    return snapshot.docs.map(
      (document) =>
        normalizeDocument(
          document.id,
          document.data(),
        ),
    );
  }

  static async getByPlayerId(
    playerId: string,
  ): Promise<
    HistoricalPlayerSeasonStats[]
  > {
    const normalizedPlayerId =
      playerId.trim();

    if (
      !normalizedPlayerId
    ) {
      return [];
    }

    const snapshot =
      await getDocs(
        query(
          collection(
            db,
            COLLECTION_NAME,
          ),

          where(
            "playerId",
            "==",
            normalizedPlayerId,
          ),
        ),
      );

    return snapshot.docs.map(
      (document) =>
        normalizeDocument(
          document.id,
          document.data(),
        ),
    );
  }

  static subscribeAll(
    onData: (
      stats: HistoricalPlayerSeasonStats[],
    ) => void,

    onError?: (
      error: Error,
    ) => void,
  ) {
    const reference =
      collection(
        db,
        COLLECTION_NAME,
      );

    return onSnapshot(
      reference,

      (snapshot) => {
        const result =
          snapshot.docs.map(
            (document) =>
              normalizeDocument(
                document.id,
                document.data(),
              ),
          );

        onData(result);
      },

      (error) => {
        console.error(
          "Errore historicalPlayerSeasonStats:",
          error,
        );

        onError?.(error);
      },
    );
  }

  static subscribeByCompetition(
  competitionId: string,

  onData: (
    stats:
      HistoricalPlayerSeasonStats[],
  ) => void,

  onError?: (
    error: Error,
  ) => void,
) {
  const normalizedCompetitionId =
    competitionId.trim();

  const reference =
    query(
      collection(
        db,
        COLLECTION_NAME,
      ),
      where(
        "competitionId",
        "==",
        normalizedCompetitionId,
      ),
    );

  return onSnapshot(
    reference,

    (snapshot) => {
      onData(
        snapshot.docs.map(
          (document) =>
            normalizeDocument(
              document.id,
              document.data(),
            ),
        ),
      );
    },

    (error) => {
      console.error(
        "Errore statistiche storiche competizione:",
        error,
      );

      onError?.(
        error,
      );
    },
  );
}

  static subscribeBySeason(
    seasonId: string,

    onData: (
      stats: HistoricalPlayerSeasonStats[],
    ) => void,

    onError?: (
      error: Error,
    ) => void,
  ) {
    const reference =
      query(
        collection(
          db,
          COLLECTION_NAME,
        ),
        where(
          "seasonId",
          "==",
          seasonId,
        ),
      );

    return onSnapshot(
      reference,

      (snapshot) => {
        onData(
          snapshot.docs.map(
            (document) =>
              normalizeDocument(
                document.id,
                document.data(),
              ),
          ),
        );
      },

      (error) => {
        console.error(
          "Errore statistiche storiche stagione:",
          error,
        );

        onError?.(error);
      },
    );
  }
}

function normalizeDocument(
  id: string,
  value: Record<
    string,
    unknown
  >,
): HistoricalPlayerSeasonStats {
  const averageVote =
    normalizeOptionalNumber(
      value.averageVote,
    );

  return {
    id,

    competitionId:
  normalizeString(
    value.competitionId,
  ),

    seasonId:
      normalizeString(
        value.seasonId,
      ),

    seasonName:
      normalizeString(
        value.seasonName,
      ),

    playerId:
      normalizeString(
        value.playerId,
      ),

    teamId:
      normalizeOptionalString(
        value.teamId,
      ),

    teamName:
      normalizeOptionalString(
        value.teamName,
      ),

    appearances:
      normalizeInteger(
        value.appearances,
      ),

    goals:
      normalizeInteger(
        value.goals,
      ),

    assists:
      normalizeInteger(
        value.assists,
      ),

    ownGoals:
      normalizeInteger(
        value.ownGoals,
      ),

    averageVote,

    yellowCards:
      normalizeInteger(
        value.yellowCards,
      ),

    redCards:
      normalizeInteger(
        value.redCards,
      ),

    createdAt:
      value.createdAt,

    updatedAt:
      value.updatedAt,
  };
}

function validateInput(
  input: HistoricalPlayerSeasonStatsInput,
) {
  if (
    !input.seasonId.trim()
  ) {
    throw new Error(
      "seasonId obbligatorio.",
    );
  }

  if (
  !input.competitionId.trim()
) {
  throw new Error(
    "competitionId obbligatorio.",
  );
}

if (
    !input.seasonName.trim()
  ) {
    throw new Error(
      "Nome stagione obbligatorio.",
    );
  }

  if (
    !input.playerId.trim()
  ) {
    throw new Error(
      "playerId obbligatorio.",
    );
  }

  const integerValues = [
    input.appearances,
    input.goals,
    input.assists ?? 0,
    input.ownGoals ?? 0,
    input.yellowCards ?? 0,
    input.redCards ?? 0,
  ];

  if (
    integerValues.some(
      (value) =>
        !Number.isInteger(
          value,
        ) ||
        value < 0,
    )
  ) {
    throw new Error(
      "Le statistiche devono essere numeri interi non negativi.",
    );
  }

  if (
    input.averageVote !==
      undefined &&
    (
      !Number.isFinite(
        input.averageVote,
      ) ||
      input.averageVote < 0 ||
      input.averageVote > 10
    )
  ) {
    throw new Error(
      "Media voto non valida.",
    );
  }
}

function normalizeInteger(
  value: unknown,
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number,
    )
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(number),
  );
}

function normalizeAverageVote(
  value: unknown,
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number,
    )
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      10,
      number,
    ),
  );
}

function normalizeOptionalNumber(
  value: unknown,
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return undefined;
  }

  const number =
    Number(value);

  return Number.isFinite(
    number,
  )
    ? number
    : undefined;
}

function normalizeString(
  value: unknown,
) {
  return String(
    value ?? "",
  ).trim();
}

function normalizeOptionalString(
  value: unknown,
) {
  const result =
    normalizeString(value);

  return result ||
    undefined;
}

function normalizeHistoricalSeasonName(
  value: string,
): string {
  return value
    .trim()
    .toLocaleLowerCase(
      "it",
    )
    .replace(
      /^stagione\s+/i,
      "",
    )
    .replace(
      /-/g,
      "/",
    )
    .replace(
      /(\d{4})\/(\d{4})/,
      (_, firstYear, secondYear) =>
        `${firstYear}/${String(
          secondYear,
        ).slice(-2)}`,
    )
    .replace(
      /\s+/g,
      "",
    );
}