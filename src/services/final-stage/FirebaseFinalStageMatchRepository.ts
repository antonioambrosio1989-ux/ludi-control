import {
  addDoc,
  collection,
  deleteDoc,
  documentId,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";

import {
  FirebaseSeasonTeamRepository,
} from "@/src/services/team/FirebaseSeasonTeamRepository";

import {
  assertSeasonWritable,
} from "@/src/services/season/SeasonWriteGuard";

import { transitionLiveMatch, type LiveTransitionInput } from "@/src/services/match/LiveMatchTransaction";

import {
  assertFinalStageMatchFormat,
} from "@/src/services/final-stage/FinalStageCompetitionFormatResolver";

import {
  assertFinalStageTwoLegTieConsistency,
  assertFinalStageTwoLegTieRemovalConsistency,
  assertFinalStageTwoLegTieUpdateConsistency,
} from "@/src/services/final-stage/FinalStageTwoLegTieValidator";

import type {
  CreateFinalStageMatchInput,
  FinalStageMatch,
  FinalStageMatchStatus,
  UpdateFinalStageMatchInput,
} from "@/src/types/FinalStageMatch";

/*
 * ============================================================
 * COLLECTION
 * ============================================================
 */

const COLLECTION_NAME =
  "finalStageMatches";


/*
 * ============================================================
 * MAPPING FIRESTORE
 * ============================================================
 */

export function mapFinalStageMatch(
  documentId: string,

  data:
    Record<
      string,
      unknown
    >,
): FinalStageMatch {
  const rawStatus =
    data.status;

  const status:
    FinalStageMatchStatus =
      rawStatus ===
        "live" ||
      rawStatus ===
        "played" ||
      rawStatus ===
        "finished" ||
      rawStatus ===
        "postponed" ||
      rawStatus ===
        "cancelled" ||
      rawStatus ===
        "walkover"
        ? rawStatus
        : "scheduled";

  return {
    id:
      documentId,

    seasonId:
      String(
        data.seasonId ??
          "",
      ),

    competition:
      data.competition as
        FinalStageMatch["competition"],

    round:
      data.round as
        FinalStageMatch["round"],

    group:
      typeof data.group ===
      "string"
        ? data.group
        : undefined,

    leg:
      data.leg as
        FinalStageMatch["leg"],

    matchOrder:
      typeof data.matchOrder ===
        "number" &&
      Number.isFinite(
        data.matchOrder,
      )
        ? data.matchOrder
        : undefined,

    finalStageWeek:
      typeof data.finalStageWeek ===
        "number" &&
      Number.isInteger(
        data.finalStageWeek,
      ) &&
      data.finalStageWeek >
        0
        ? data.finalStageWeek
        : undefined,

    homeTeamId:
      String(
        data.homeTeamId ??
          "",
      ),

    awayTeamId:
      String(
        data.awayTeamId ??
          "",
      ),

    date:
      String(
        data.date ??
          "",
      ),

    time:
      String(
        data.time ??
          "",
      ),

    venue:
      typeof data.venue ===
      "string"
        ? data.venue
        : "Centro Sportivo Ludi",

    status,

    published:
      typeof data.published ===
      "boolean"
        ? data.published
        : false,

    homeScore:
      typeof data.homeScore ===
        "number" &&
      Number.isFinite(
        data.homeScore,
      )
        ? data.homeScore
        : undefined,

    awayScore:
      typeof data.awayScore ===
        "number" &&
      Number.isFinite(
        data.awayScore,
      )
        ? data.awayScore
        : undefined,

    extraTimePlayed:
  typeof data.extraTimePlayed ===
    "boolean"
    ? data.extraTimePlayed
    : undefined,

    homePenalties:
      typeof data.homePenalties ===
        "number" &&
      Number.isFinite(
        data.homePenalties,
      )
        ? data.homePenalties
        : undefined,

    awayPenalties:
      typeof data.awayPenalties ===
        "number" &&
      Number.isFinite(
        data.awayPenalties,
      )
        ? data.awayPenalties
        : undefined,

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

/*
 * ============================================================
 * CHIAVE ANTI-DUPLICATO
 * ============================================================
 */

function buildMatchKey({
  seasonId,
  competition,
  round,
  group,
  leg,
  matchOrder,
  homeTeamId,
  awayTeamId,
}: {
  seasonId: string;

  competition: string;

  round: string;

  group?: string;

  leg: string;

  matchOrder?: number;

  homeTeamId: string;

  awayTeamId: string;
}) {
  return [
    seasonId,
    competition,
    round,
    group ??
      "",
    leg,
    matchOrder ??
      "",
    homeTeamId,
    awayTeamId,
  ].join("|");
}

/*
 * ============================================================
 * VALIDAZIONE INPUT
 * ============================================================
 */

function validateInput(
  input:
    CreateFinalStageMatchInput,
) {
  if (
    !input.seasonId.trim()
  ) {
    throw new Error(
      "La stagione non è stata specificata.",
    );
  }

  if (
    !input.homeTeamId.trim() ||
    !input.awayTeamId.trim()
  ) {
    throw new Error(
      "Seleziona entrambe le squadre.",
    );
  }

  if (
    input.homeTeamId ===
    input.awayTeamId
  ) {
    throw new Error(
      "Una squadra non può giocare contro sé stessa.",
    );
  }

  if (
    !input.date.trim()
  ) {
    throw new Error(
      "Inserisci la data della partita.",
    );
  }

  if (
    !input.time.trim()
  ) {
    throw new Error(
      "Inserisci l'orario della partita.",
    );
  }

  if (
    input.matchOrder !==
      undefined &&
    (
      !Number.isInteger(
        input.matchOrder,
      ) ||
      input.matchOrder <
        1
    )
  ) {
    throw new Error(
      "Ordine partita non valido.",
    );
  }

  if (
    !Number.isInteger(
      input.finalStageWeek,
    ) ||
    input.finalStageWeek <
      1
  ) {
    throw new Error(
      "Settimana Final Stage non valida.",
    );
  }
/*
 * ============================================================
 * FORMATO FINAL STAGE
 * ============================================================
 *
 * Tutte le Final Stage adottano:
 *
 * quarti       -> andata / ritorno
 * semifinali   -> andata / ritorno
 * finale       -> gara secca
 * ============================================================
 */

assertFinalStageMatchFormat({
  competition:
    input.competition,

  round:
    input.round,

  leg:
    input.leg,

  matchOrder:
    input.matchOrder,
});

}

async function assertTeamsRegisteredInSeason(
  seasonId: string,
  teamIds: string[],
): Promise<void> {
  const normalizedSeasonId =
    seasonId.trim();

  const normalizedTeamIds =
    teamIds.map(
      (teamId) =>
        teamId.trim(),
    );

  const seasonTeams =
    await FirebaseSeasonTeamRepository.getBySeasonId(
      normalizedSeasonId,
    );

  const registeredTeamIds =
    new Set(
      seasonTeams.map(
        (seasonTeam) =>
          String(
            seasonTeam.teamId,
          ),
      ),
    );

  const invalidTeamId =
    normalizedTeamIds.find(
      (teamId) =>
        !registeredTeamIds.has(
          teamId,
        ),
    );

  if (invalidTeamId) {
    throw new Error(
      "Una delle squadre selezionate non è iscritta alla stagione.",
    );
  }
}

/*
 * ============================================================
 * REPORT FINALE PUBBLICATO
 * ============================================================
 */


/*
 * ============================================================
 * REPOSITORY
 * ============================================================
 */

export const FirebaseFinalStageMatchRepository =
  {
    /*
     * ========================================================
     * SUBSCRIBE BY SEASON
     * ========================================================
     */

    subscribeBySeason(
      seasonId:
        string,

      onChange:
        (
          matches:
            FinalStageMatch[],
        ) => void,

      onError?:
        (
          error:
            Error,
        ) => void,
    ): Unsubscribe {
      const normalizedSeasonId =
        seasonId.trim();

      const matchesQuery =
        query(
          collection(
            db,
            COLLECTION_NAME,
          ),

          where(
            "seasonId",
            "==",
            normalizedSeasonId,
          ),

          orderBy(
            "competition",
            "asc",
          ),

          orderBy(
            "date",
            "asc",
          ),

          orderBy(
            "time",
            "asc",
          ),
        );

      return onSnapshot(
        matchesQuery,

        (
          snapshot,
        ) => {
          const matches =
            snapshot.docs.map(
              (
                currentDocument,
              ) =>
                mapFinalStageMatch(
                  currentDocument.id,

                  currentDocument.data(),
                ),
            );

          onChange(
            matches,
          );
        },

        (
          error,
        ) => {
          console.error(
            "Errore caricamento partite fasi finali:",
            error,
          );

          onError?.(
            error,
          );
        },
      );
    },

    /*
     * ========================================================
     * SUBSCRIBE PUBLISHED BY SEASON
     * ========================================================
     */

    subscribePublishedBySeason(
      seasonId:
        string,

      onChange:
        (
          matches:
            FinalStageMatch[],
        ) => void,

      onError?:
        (
          error:
            Error,
        ) => void,
    ): Unsubscribe {
      const normalizedSeasonId =
        seasonId.trim();

      const matchesQuery =
        query(
          collection(
            db,
            COLLECTION_NAME,
          ),

          where(
            "seasonId",
            "==",
            normalizedSeasonId,
          ),

          where(
            "published",
            "==",
            true,
          ),

          orderBy(
            "competition",
            "asc",
          ),

          orderBy(
            "date",
            "asc",
          ),

          orderBy(
            "time",
            "asc",
          ),
        );

      return onSnapshot(
        matchesQuery,

        (
          snapshot,
        ) => {
          onChange(
            snapshot.docs.map(
              (
                currentDocument,
              ) =>
                mapFinalStageMatch(
                  currentDocument.id,
                  currentDocument.data(),
                ),
            ),
          );
        },

        (
          error,
        ) => {
          console.error(
            "Errore caricamento partite fasi finali pubblicate:",
            error,
          );

          onError?.(
            error,
          );
        },
      );
    },

    /*
     * ========================================================
     * GET BY SEASON
     * ========================================================
     */

    async getBySeason(
      seasonId:
        string,
    ): Promise<
      FinalStageMatch[]
    > {
      const normalizedSeasonId =
        seasonId.trim();

      if (
        !normalizedSeasonId
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
              "seasonId",
              "==",
              normalizedSeasonId,
            ),

            orderBy(
              "competition",
              "asc",
            ),

            orderBy(
              "date",
              "asc",
            ),

            orderBy(
              "time",
              "asc",
            ),
          ),
        );

      return snapshot.docs.map(
        (
          currentDocument,
        ) =>
          mapFinalStageMatch(
            currentDocument.id,

            currentDocument.data(),
          ),
      );
    },

    /*
     * ========================================================
     * GET PUBLISHED BY SEASON
     * ========================================================
     */

    async getPublishedBySeason(
      seasonId:
        string,
    ): Promise<
      FinalStageMatch[]
    > {
      const normalizedSeasonId =
        seasonId.trim();

      if (
        !normalizedSeasonId
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
              "seasonId",
              "==",
              normalizedSeasonId,
            ),

            where(
              "published",
              "==",
              true,
            ),

            orderBy(
              "competition",
              "asc",
            ),

            orderBy(
              "date",
              "asc",
            ),

            orderBy(
              "time",
              "asc",
            ),
          ),
        );

      return snapshot.docs.map(
        (
          currentDocument,
        ) =>
          mapFinalStageMatch(
            currentDocument.id,
            currentDocument.data(),
          ),
      );
    },

    /*
     * ========================================================
     * GET BY ID
     * ========================================================
     */

  async getPublishedById(matchId: string | number): Promise<FinalStageMatch | undefined> {
    const id = String(matchId).trim();
    if (!id) return undefined;
    try {
      const snapshot = await getDocs(query(collection(db, COLLECTION_NAME),
      where(documentId(), "==", id), where("published", "==", true)));
    const match = snapshot.docs[0];
    return match ? mapFinalStageMatch(match.id, match.data()) : undefined;
    } catch (error) {
      // Firestore may deny an exact-ID query when the document is a draft
      // (or absent), even with a published-only filter. It is unavailable
      // to the public; never retry with an unrestricted read.
      if ((error as { code?: string }).code === "permission-denied") return undefined;
      throw error;
    }
  },

    async getById(
      matchId:
        string,
    ): Promise<
      FinalStageMatch |
      undefined
    > {
      const normalizedMatchId =
        matchId.trim();

      if (
        !normalizedMatchId
      ) {
        return undefined;
      }

      const snapshot =
        await getDoc(
          doc(
            db,
            COLLECTION_NAME,
            normalizedMatchId,
          ),
        );

      if (
        !snapshot.exists()
      ) {
        return undefined;
      }

      return mapFinalStageMatch(
        snapshot.id,

        snapshot.data(),
      );
    },

    /*
     * ========================================================
     * CREATE
     * ========================================================
     */

    async create(
      input:
        CreateFinalStageMatchInput,
    ): Promise<string> {
      validateInput(
        input,
      );

      await assertSeasonWritable(
        input.seasonId,
      );

      await assertTeamsRegisteredInSeason(
  input.seasonId,
  [
    input.homeTeamId,
    input.awayTeamId,
  ],
);

      const existing =
        await this.getBySeason(
          input.seasonId,
        );

      const inputKey =
        buildMatchKey({
          seasonId:
            input.seasonId,

          competition:
            input.competition,

          round:
            input.round,

          group:
            input.group,

          leg:
            input.leg,

          matchOrder:
            input.matchOrder,

          homeTeamId:
            input.homeTeamId,

          awayTeamId:
            input.awayTeamId,
        });

      const alreadyExists =
        existing.some(
          (
            match,
          ) =>
            buildMatchKey({
              seasonId:
                match.seasonId,

              competition:
                match.competition,

              round:
                match.round,

              group:
                match.group,

              leg:
                match.leg,

              matchOrder:
                match.matchOrder,

              homeTeamId:
                String(
                  match.homeTeamId,
                ),

              awayTeamId:
                String(
                  match.awayTeamId,
                ),
            }) ===
            inputKey,
        );

      if (
        alreadyExists
      ) {
        throw new Error(
          "La partita è già presente nelle fasi finali.",
        );
      }

      /*
 * ============================================================
 * COERENZA DOPPIO CONFRONTO
 * ============================================================
 *
 * Quarti e semifinali devono avere:
 *
 * - una sola gara di andata;
 * - una sola gara di ritorno;
 * - lo stesso matchOrder;
 * - le stesse due squadre.
 *
 * La disposizione casa/trasferta può invece essere diversa.
 * ============================================================
 */

assertFinalStageTwoLegTieConsistency({
  candidate: {
    seasonId:
      input.seasonId.trim(),

    competition:
      input.competition,

    round:
      input.round,

    leg:
      input.leg,

    matchOrder:
      input.matchOrder,

    homeTeamId:
      input.homeTeamId.trim(),

    awayTeamId:
      input.awayTeamId.trim(),
  },

  allMatches:
    existing,
});

      const createdDocument =
        await addDoc(
          collection(
            db,
            COLLECTION_NAME,
          ),

          {
            seasonId:
              input.seasonId.trim(),

            competition:
              input.competition,

            round:
              input.round,

            group:
              input.group ??
              null,

            leg:
              input.leg,

            matchOrder:
              input.matchOrder ??
              null,

            finalStageWeek:
              input.finalStageWeek,

            homeTeamId:
              input.homeTeamId.trim(),

            awayTeamId:
              input.awayTeamId.trim(),

            date:
              input.date.trim(),

            time:
              input.time.trim(),

            venue:
              input.venue.trim() ||
              "Centro Sportivo Ludi",

            status:
              "scheduled",

            published:
              false,

            homeScore:
              null,

            awayScore:
              null,

            homePenalties:
              null,

            awayPenalties:
              null,

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp(),
          },
        );

      return createdDocument.id;
    },

    /*
     * ========================================================
     * CREATE MANY
     * ========================================================
     */

    async createMany(
      inputs:
        CreateFinalStageMatchInput[],
    ): Promise<void> {
      if (
        inputs.length ===
        0
      ) {
        throw new Error(
          "Non ci sono partite da importare.",
        );
      }

      if (
        inputs.length >
        500
      ) {
        throw new Error(
          "Puoi importare al massimo 500 partite alla volta.",
        );
      }

      const seasonIds =
        Array.from(
          new Set(
            inputs.map(
              (
                input,
              ) =>
                input.seasonId.trim(),
            ),
          ),
        );

      if (
        seasonIds.length !==
        1
      ) {
        throw new Error(
          "Tutte le partite devono appartenere alla stessa stagione.",
        );
      }

      const seasonId =
        seasonIds[0];

      await assertSeasonWritable(
        seasonId,
      );

      const importedTeamIds =
  Array.from(
    new Set(
      inputs.flatMap(
        (input) => [
          input.homeTeamId,
          input.awayTeamId,
        ],
      ),
    ),
  );

await assertTeamsRegisteredInSeason(
  seasonId,
  importedTeamIds,
);

      const existingMatches =
        await this.getBySeason(
          seasonId,
        );

      const existingKeys =
        new Set(
          existingMatches.map(
            (
              match,
            ) =>
              buildMatchKey({
                seasonId:
                  match.seasonId,

                competition:
                  match.competition,

                round:
                  match.round,

                group:
                  match.group,

                leg:
                  match.leg,

                matchOrder:
                  match.matchOrder,

                homeTeamId:
                  String(
                    match.homeTeamId,
                  ),

                awayTeamId:
                  String(
                    match.awayTeamId,
                  ),
              }),
          ),
        );

      const importedKeys =
        new Set<string>();

      /*
 * ============================================================
 * PARTITE DEL BATCH GIÀ VALIDATE
 * ============================================================
 *
 * Serve per verificare la coerenza tra andata e ritorno
 * anche quando entrambe vengono create nello stesso import.
 * ============================================================
 */

const validatedBatchMatches:
  FinalStageMatch[] =
    [];

      for (
        const input of
          inputs
      ) {
        validateInput(
          input,
        );

        const key =
          buildMatchKey({
            seasonId:
              input.seasonId,

            competition:
              input.competition,

            round:
              input.round,

            group:
              input.group,

            leg:
              input.leg,

            matchOrder:
              input.matchOrder,

            homeTeamId:
              input.homeTeamId,

            awayTeamId:
              input.awayTeamId,
          });

        if (
          existingKeys.has(
            key,
          )
        ) {
          throw new Error(
            `La partita ${input.homeTeamId} - ${input.awayTeamId} è già presente.`,
          );
        }

        if (
          importedKeys.has(
            key,
          )
        ) {
          throw new Error(
            "Il file contiene una partita duplicata.",
          );
        }
        /*
 * ============================================================
 * COERENZA DOPPIO CONFRONTO
 * ============================================================
 */

assertFinalStageTwoLegTieConsistency({
  candidate: {
    seasonId:
      input.seasonId.trim(),

    competition:
      input.competition,

    round:
      input.round,

    leg:
      input.leg,

    matchOrder:
      input.matchOrder,

    homeTeamId:
      input.homeTeamId.trim(),

    awayTeamId:
      input.awayTeamId.trim(),
  },

  allMatches: [
    ...existingMatches,
    ...validatedBatchMatches,
  ],
});
        importedKeys.add(
          key,
        );
        validatedBatchMatches.push({
  id:
    `__batch_${validatedBatchMatches.length + 1}`,

  seasonId:
    input.seasonId.trim(),

  competition:
    input.competition,

  round:
    input.round,

  group:
    input.group,

  leg:
    input.leg,

  matchOrder:
    input.matchOrder,

  finalStageWeek:
    input.finalStageWeek,

  homeTeamId:
    input.homeTeamId.trim(),

  awayTeamId:
    input.awayTeamId.trim(),

  date:
    input.date.trim(),

  time:
    input.time.trim(),

  venue:
    input.venue.trim() ||
    "Centro Sportivo Ludi",

  status:
    "scheduled",

  published:
    false,
});
      }

      const batch =
        writeBatch(
          db,
        );

      for (
        const input of
          inputs
      ) {
        const reference =
          doc(
            collection(
              db,
              COLLECTION_NAME,
            ),
          );

        batch.set(
          reference,

          {
            seasonId:
              input.seasonId.trim(),

            competition:
              input.competition,

            round:
              input.round,

            group:
              input.group ??
              null,

            leg:
              input.leg,

            matchOrder:
              input.matchOrder ??
              null,

            finalStageWeek:
              input.finalStageWeek,

            homeTeamId:
              input.homeTeamId.trim(),

            awayTeamId:
              input.awayTeamId.trim(),

            date:
              input.date.trim(),

            time:
              input.time.trim(),

            venue:
              input.venue.trim() ||
              "Centro Sportivo Ludi",

            status:
              "scheduled",

            published:
              false,

            homeScore:
              null,

            awayScore:
              null,

            homePenalties:
              null,

            awayPenalties:
              null,

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp(),
          },
        );
      }

      await batch.commit();
    },

    /*
     * ========================================================
     * UPDATE
     * ========================================================
     */

    async update(
      input:
        UpdateFinalStageMatchInput,
    ): Promise<void> {
      const existingMatch =
        await this.getById(
          input.matchId,
        );

      if (
        !existingMatch
      ) {
        throw new Error(
          "La partita selezionata non esiste.",
        );
      }

      /*
 * ==========================================================
 * PROTEZIONE PARTITA UFFICIALE
 * ==========================================================
 *
 * Una partita già in corso, conclusa o pubblicata
 * non può più essere modificata dalla gestione
 * del calendario.
 *
 * Risultato e pubblicazione appartengono al
 * Match Wizard / servizio di pubblicazione.
 * ==========================================================
 */

if (
  existingMatch.status ===
    "live" ||
  existingMatch.status ===
    "played" ||
  existingMatch.status ===
    "finished" ||
  existingMatch.status ===
    "walkover" ||
  existingMatch.published ===
    true
) {
  throw new Error(
    "Una partita già iniziata, conclusa o pubblicata non può essere modificata dalla gestione calendario.",
  );
}

/*
 * ==========================================================
 * STATI CONSENTITI DAL CALENDARIO
 * ==========================================================
 */

if (
  input.status !==
    "scheduled" &&
  input.status !==
    "postponed" &&
  input.status !==
    "cancelled"
) {
  throw new Error(
    "Dalla gestione calendario puoi impostare solo una partita programmata, rinviata o annullata.",
  );
}

      await assertSeasonWritable(
        existingMatch.seasonId,
      );

      await assertTeamsRegisteredInSeason(
  existingMatch.seasonId,
  [
    input.homeTeamId,
    input.awayTeamId,
  ],
);

      if (
        input.homeTeamId ===
        input.awayTeamId
      ) {
        throw new Error(
          "Una squadra non può giocare contro sé stessa.",
        );
      }

      if (
        !input.homeTeamId.trim() ||
        !input.awayTeamId.trim()
      ) {
        throw new Error(
          "Seleziona entrambe le squadre.",
        );
      }

      if (
        input.matchOrder !==
          undefined &&
        (
          !Number.isInteger(
            input.matchOrder,
          ) ||
          input.matchOrder <
            1
        )
      ) {
        throw new Error(
          "Ordine partita non valido.",
        );
      }

      if (
        !Number.isInteger(
          input.finalStageWeek,
        ) ||
        input.finalStageWeek <
          1
      ) {
        throw new Error(
          "Settimana Final Stage non valida.",
        );
      }

      /*
 * ============================================================
 * FORMATO FINAL STAGE
 * ============================================================
 *
 * Impedisce che una partita creata con un formato corretto
 * venga successivamente trasformata dall'Admin in un formato
 * incompatibile.
 *
 * Quarti:
 * first / second
 *
 * Semifinali:
 * first / second
 *
 * Finale:
 * single
 * ============================================================
 */

assertFinalStageMatchFormat({
  competition:
    input.competition,

  round:
    input.round,

  leg:
    input.leg,

  matchOrder:
    input.matchOrder,
});

      const existingMatches =
  await this.getBySeason(
    existingMatch.seasonId,
  );

const updatedMatchKey =
  buildMatchKey({
    seasonId:
      existingMatch.seasonId,

    competition:
      input.competition,

    round:
      input.round,

    group:
      input.group,

    leg:
      input.leg,

    matchOrder:
      input.matchOrder,

    homeTeamId:
      input.homeTeamId,

    awayTeamId:
      input.awayTeamId,
  });

const duplicateMatch =
  existingMatches.some(
    (match) =>
      match.id !==
        existingMatch.id &&
      buildMatchKey({
        seasonId:
          match.seasonId,

        competition:
          match.competition,

        round:
          match.round,

        group:
          match.group,

        leg:
          match.leg,

        matchOrder:
          match.matchOrder,

        homeTeamId:
          String(
            match.homeTeamId,
          ),

        awayTeamId:
          String(
            match.awayTeamId,
          ),
      }) ===
        updatedMatchKey,
  );

if (duplicateMatch) {
  throw new Error(
    "Esiste già una partita identica nelle fasi finali.",
  );
}

/*
 * ============================================================
 * COERENZA DOPPIO CONFRONTO
 * ============================================================
 *
 * La modifica di una partita programmata non deve poter
 * rompere una coppia andata/ritorno già esistente.
 * ============================================================
 */

assertFinalStageTwoLegTieUpdateConsistency({
  existingMatch,

  candidate: {
    id:
      existingMatch.id,

    seasonId:
      existingMatch.seasonId,

    competition:
      input.competition,

    round:
      input.round,

    leg:
      input.leg,

    matchOrder:
      input.matchOrder,

    homeTeamId:
      input.homeTeamId.trim(),

    awayTeamId:
      input.awayTeamId.trim(),
  },

  allMatches:
    existingMatches,
});

      await updateDoc(
        doc(
          db,
          COLLECTION_NAME,
          input.matchId,
        ),

        {
          competition:
            input.competition,

          round:
            input.round,

          group:
            input.group ??
            null,

          leg:
            input.leg,

          matchOrder:
            input.matchOrder ??
            null,

          finalStageWeek:
            input.finalStageWeek,

          homeTeamId:
            input.homeTeamId.trim(),

          awayTeamId:
            input.awayTeamId.trim(),

          date:
            input.date.trim(),

          time:
            input.time.trim(),

          venue:
            input.venue.trim() ||
            "Centro Sportivo Ludi",

          status:
  input.status,

/*
 * ========================================================
 * DATI UFFICIALI
 * ========================================================
 *
 * La gestione calendario non può modificare
 * pubblicazione, risultato o rigori.
 *
 * Manteniamo sempre i valori già presenti
 * nel documento.
 * ========================================================
 */

published:
  existingMatch.published,

homeScore:
  existingMatch.homeScore ??
  null,

awayScore:
  existingMatch.awayScore ??
  null,

homePenalties:
  existingMatch.homePenalties ??
  null,

awayPenalties:
  existingMatch.awayPenalties ??
  null,

          updatedAt:
            serverTimestamp(),
        },
      );
    },

    /*
     * ========================================================
     * LIFECYCLE LIVE ATOMICO
     * ========================================================
     */

    async transitionLifecycle(input: LiveTransitionInput): Promise<void> {
    await transitionLiveMatch({ collectionName: "finalStageMatches", reportsCollectionName: "finalStageMatchReports", input });
  },

  async updateLiveScore(input: Omit<LiveTransitionInput, "status" | "expectedStatus">): Promise<void> {
    await FirebaseFinalStageMatchRepository.transitionLifecycle({ ...input, expectedStatus: "live", status: "live" });
  },

  async remove(
      matchId:
        string,
    ): Promise<void> {
      const existingMatch =
        await this.getById(
          matchId,
        );

      if (
        !existingMatch
      ) {
        throw new Error(
          "La partita selezionata non esiste.",
        );
      }

      /*
 * ==========================================================
 * PROTEZIONE ELIMINAZIONE
 * ==========================================================
 */

if (
  existingMatch.status ===
    "live" ||
  existingMatch.status ===
    "played" ||
  existingMatch.status ===
    "finished" ||
  existingMatch.status ===
    "walkover" ||
  existingMatch.published ===
    true
) {
  throw new Error(
    "Una partita già iniziata, conclusa o pubblicata non può essere eliminata.",
  );
}

      await assertSeasonWritable(
        existingMatch.seasonId,
      );
/*
 * ============================================================
 * PROTEZIONE DOPPIO CONFRONTO
 * ============================================================
 */

const seasonMatches =
  await this.getBySeason(
    existingMatch.seasonId,
  );

assertFinalStageTwoLegTieRemovalConsistency({
  match:
    existingMatch,

  allMatches:
    seasonMatches,
});

      await deleteDoc(
        doc(
          db,
          COLLECTION_NAME,
          matchId,
        ),
      );
    },
  };