import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";

import {
  db,
} from "@/src/lib/firebase";

import type {
  CreateFantasySeasonInput,
  FantasySeason,
  FantasySeasonStatus,
  UpdateFantasySeasonInput,
} from "@/src/types/FantasySeason";

import {
  DEFAULT_FANTASY_DEFAULT_SCORES,
  DEFAULT_FANTASY_FORMATION_WINDOW_RULES,
  DEFAULT_FANTASY_LINEUP_RULES,
  DEFAULT_FANTASY_POLITICAL_VOTES,
  DEFAULT_FANTASY_ROSTER_RULES,
  DEFAULT_FANTASY_SCORING_RULES,
  DEFAULT_FANTASY_VISIBILITY_RULES,
} from "@/src/types/FantasySeason";

const COLLECTION_NAME =
  "fantasySeasons";

function normalizeFantasySeason(
  snapshot:
    DocumentSnapshot<DocumentData>,
): FantasySeason {
  const data =
    snapshot.data();

  if (
    !data
  ) {
    throw new Error(
      `Documento FantasySeason ${snapshot.id} privo di dati.`,
    );
  }

  return {
    id:
      snapshot.id,

    gamesSeasonId:
      String(
        data.gamesSeasonId ?? "",
      ),

    gameId:
      String(
        data.gameId ?? "",
      ),

    competitionId:
      String(
        data.competitionId ?? "",
      ),

    sportSeasonId:
      String(
        data.sportSeasonId ?? "",
      ),

    name:
      String(
        data.name ?? "",
      ),

    status:
      (
        data.status ??
        "prelaunch"
      ) as FantasySeasonStatus,

    interestOpensAt:
      data.interestOpensAt,

    playerListTargetDate:
      data.playerListTargetDate,

    playerListPublishedAt:
      data.playerListPublishedAt,

    rosterOpensAt:
      data.rosterOpensAt,

    rosterClosesAt:
      data.rosterClosesAt,

    firstScoringMatchweek:
      Number(
        data.firstScoringMatchweek ??
          3,
      ),

    lastScoringMatchweek:
      typeof data.lastScoringMatchweek ===
      "number"
        ? data.lastScoringMatchweek
        : undefined,

    rosterRules: {
      ...DEFAULT_FANTASY_ROSTER_RULES,
      ...(data.rosterRules ?? {}),
    },

    lineupRules: {
      ...DEFAULT_FANTASY_LINEUP_RULES,
      ...(data.lineupRules ?? {}),
    },

    formationWindowRules: {
      ...DEFAULT_FANTASY_FORMATION_WINDOW_RULES,
      ...(data.formationWindowRules ??
        {}),
    },

    defaultScores: {
      ...DEFAULT_FANTASY_DEFAULT_SCORES,
      ...(data.defaultScores ?? {}),
    },

    politicalVotes: {
      ...DEFAULT_FANTASY_POLITICAL_VOTES,
      ...(data.politicalVotes ?? {}),
    },

    scoringRules: {
      ...DEFAULT_FANTASY_SCORING_RULES,
      ...(data.scoringRules ?? {}),
    },

    scoringUsesOriginalMatchweekOnly:
      data.scoringUsesOriginalMatchweekOnly !==
      false,

    visibilityRules: {
      ...DEFAULT_FANTASY_VISIBILITY_RULES,
      ...(data.visibilityRules ?? {}),
    },

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,

    completedAt:
      data.completedAt,

    createdBy:
      data.createdBy,

    updatedBy:
      data.updatedBy,
  };
}

export class FirebaseFantasySeasonRepository {
  static async create(
    input:
      CreateFantasySeasonInput,
  ): Promise<FantasySeason> {
    const collectionRef =
      collection(
        db,
        COLLECTION_NAME,
      );

    const documentRef =
      input.id
        ? doc(
            db,
            COLLECTION_NAME,
            input.id,
          )
        : doc(
            collectionRef,
          );

    const data = {
      gamesSeasonId:
        input.gamesSeasonId,

      gameId:
        input.gameId,

      competitionId:
        input.competitionId,

      sportSeasonId:
        input.sportSeasonId,

      name:
        input.name.trim(),

      status:
        "prelaunch" as const,

      interestOpensAt:
        input.interestOpensAt ??
        null,

      playerListTargetDate:
        input.playerListTargetDate ??
        null,

      playerListPublishedAt:
        null,

      rosterOpensAt:
        null,

      rosterClosesAt:
        input.rosterClosesAt ??
        null,

      firstScoringMatchweek:
        input.firstScoringMatchweek,

      lastScoringMatchweek:
        input.lastScoringMatchweek ??
        null,

      rosterRules:
        DEFAULT_FANTASY_ROSTER_RULES,

      lineupRules:
        DEFAULT_FANTASY_LINEUP_RULES,

      formationWindowRules:
        DEFAULT_FANTASY_FORMATION_WINDOW_RULES,

      defaultScores:
        DEFAULT_FANTASY_DEFAULT_SCORES,

      politicalVotes:
        DEFAULT_FANTASY_POLITICAL_VOTES,

      scoringRules:
        DEFAULT_FANTASY_SCORING_RULES,

      scoringUsesOriginalMatchweekOnly:
        true,

      visibilityRules:
        DEFAULT_FANTASY_VISIBILITY_RULES,

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),

      createdBy:
        input.createdBy ?? null,

      updatedBy:
        input.createdBy ?? null,
    };

    await setDoc(
      documentRef,
      data,
    );

    const createdSnapshot =
      await getDoc(
        documentRef,
      );

    if (
      !createdSnapshot.exists()
    ) {
      throw new Error(
        "La stagione Fantacalcio non è stata creata correttamente.",
      );
    }

    return normalizeFantasySeason(
      createdSnapshot,
    );
  }

  static async getById(
    fantasySeasonId:
      string,
  ): Promise<FantasySeason | null> {
    const snapshot =
      await getDoc(
        doc(
          db,
          COLLECTION_NAME,
          fantasySeasonId,
        ),
      );

    if (
      !snapshot.exists()
    ) {
      return null;
    }

    return normalizeFantasySeason(
      snapshot,
    );
  }

  static async getByGameId(
    gameId:
      string,
  ): Promise<FantasySeason | null> {
    const seasonsQuery =
      query(
        collection(
          db,
          COLLECTION_NAME,
        ),
        where(
          "gameId",
          "==",
          gameId,
        ),
        limit(
          1,
        ),
      );

    const snapshot =
      await getDocs(
        seasonsQuery,
      );

    const firstDocument =
      snapshot.docs[0];

    return firstDocument
      ? normalizeFantasySeason(
          firstDocument,
        )
      : null;
  }

  static async getByGamesSeasonId(
    gamesSeasonId:
      string,
  ): Promise<FantasySeason[]> {
    const seasonsQuery =
      query(
        collection(
          db,
          COLLECTION_NAME,
        ),
        where(
          "gamesSeasonId",
          "==",
          gamesSeasonId,
        ),
      );

    const snapshot =
      await getDocs(
        seasonsQuery,
      );

    return snapshot.docs.map(
      normalizeFantasySeason,
    );
  }

  static async getActive(
    gamesSeasonId:
      string,
  ): Promise<FantasySeason | null> {
    const seasonsQuery =
      query(
        collection(
          db,
          COLLECTION_NAME,
        ),
        where(
          "gamesSeasonId",
          "==",
          gamesSeasonId,
        ),
        where(
          "status",
          "in",
          [
            "prelaunch",
            "player_list_draft",
            "rosters_open",
            "rosters_locked",
            "active",
          ],
        ),
        limit(
          1,
        ),
      );

    const snapshot =
      await getDocs(
        seasonsQuery,
      );

    const firstDocument =
      snapshot.docs[0];

    return firstDocument
      ? normalizeFantasySeason(
          firstDocument,
        )
      : null;
  }

  static async update(
    input:
      UpdateFantasySeasonInput,
  ): Promise<void> {
    const documentRef =
      doc(
        db,
        COLLECTION_NAME,
        input.fantasySeasonId,
      );

    await updateDoc(
      documentRef,
      {
        name:
          input.name.trim(),

        status:
          input.status,

        interestOpensAt:
          input.interestOpensAt ??
          null,

        playerListTargetDate:
          input.playerListTargetDate ??
          null,

        playerListPublishedAt:
          input.playerListPublishedAt ??
          null,

        rosterOpensAt:
          input.rosterOpensAt ??
          null,

        rosterClosesAt:
          input.rosterClosesAt ??
          null,

        firstScoringMatchweek:
          input.firstScoringMatchweek,

        lastScoringMatchweek:
          input.lastScoringMatchweek ??
          null,

        rosterRules:
          input.rosterRules,

        lineupRules:
          input.lineupRules,

        formationWindowRules:
          input.formationWindowRules,

        defaultScores:
          input.defaultScores,

        politicalVotes:
          input.politicalVotes,

        scoringRules:
          input.scoringRules,

        scoringUsesOriginalMatchweekOnly:
          input.scoringUsesOriginalMatchweekOnly,

        visibilityRules:
          input.visibilityRules,

        updatedAt:
          serverTimestamp(),

        updatedBy:
          input.updatedBy ?? null,

        completedAt:
          input.status ===
          "completed"
            ? serverTimestamp()
            : null,
      },
    );
  }

  static async updateStatus(
    fantasySeasonId:
      string,

    status:
      FantasySeasonStatus,

    updatedBy?:
      string,
  ): Promise<void> {
    await updateDoc(
      doc(
        db,
        COLLECTION_NAME,
        fantasySeasonId,
      ),
      {
        status,

        updatedAt:
          serverTimestamp(),

        updatedBy:
          updatedBy ?? null,

        completedAt:
          status ===
          "completed"
            ? serverTimestamp()
            : null,
      },
    );
  }

  static async publishPlayerList(
    fantasySeasonId:
      string,

    publishedBy?:
      string,
  ): Promise<void> {
    const documentRef =
      doc(
        db,
        COLLECTION_NAME,
        fantasySeasonId,
      );

    const snapshot =
      await getDoc(
        documentRef,
      );

    if (
      !snapshot.exists()
    ) {
      throw new Error(
        "Stagione Fantacalcio non trovata.",
      );
    }

    const data =
      snapshot.data();

    if (
      data.playerListPublishedAt
    ) {
      throw new Error(
        "Il listone del Fantacalcio è già stato pubblicato.",
      );
    }

    await updateDoc(
      documentRef,
      {
        status:
          "rosters_open",

        playerListPublishedAt:
          serverTimestamp(),

        rosterOpensAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp(),

        updatedBy:
          publishedBy ?? null,
      },
    );
  }

  static subscribeByGameId(
    gameId:
      string,

    callback:
      (
        fantasySeason:
          FantasySeason | null,
      ) => void,
  ): Unsubscribe {
    const seasonsQuery =
      query(
        collection(
          db,
          COLLECTION_NAME,
        ),
        where(
          "gameId",
          "==",
          gameId,
        ),
        limit(
          1,
        ),
      );

    return onSnapshot(
      seasonsQuery,
      (
        snapshot,
      ) => {
        const firstDocument =
          snapshot.docs[0];

        callback(
          firstDocument
            ? normalizeFantasySeason(
                firstDocument,
              )
            : null,
        );
      },
    );
  }

  static subscribeByGamesSeasonId(
    gamesSeasonId:
      string,

    callback:
      (
        seasons:
          FantasySeason[],
      ) => void,
  ): Unsubscribe {
    const seasonsQuery =
      query(
        collection(
          db,
          COLLECTION_NAME,
        ),
        where(
          "gamesSeasonId",
          "==",
          gamesSeasonId,
        ),
      );

    return onSnapshot(
      seasonsQuery,
      (
        snapshot,
      ) => {
        callback(
          snapshot.docs.map(
            normalizeFantasySeason,
          ),
        );
      },
    );
  }
}