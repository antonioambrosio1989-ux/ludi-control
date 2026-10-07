import { mapMatch } from "@/src/lib/firestore/mappers/MatchDocumentMapper";
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
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";

import { assertSeasonWritable } from "@/src/services/season/SeasonWriteGuard";

import {
  getOppositePhaseMatchIds,
} from "@/src/services/match/GlobalLiveMatchGate";

import type {
  CreateMatchInput,
  Match,
  UpdateMatchInput,
} from "@/src/types/Match";

const COLLECTION_NAME = "matches";
const MATCH_REPORTS_COLLECTION_NAME =
  "matchReports";

type PublishedMatchSubscriber = {
  onChange: (
    matches: Match[],
  ) => void;
  onError?: (
    error: Error,
  ) => void;
};

type SharedPublishedMatchSubscription = {
  subscribers:
    Set<PublishedMatchSubscriber>;
  cache?: Match[];
  unsubscribe?: Unsubscribe;
};

const publishedMatchSubscriptions =
  new Map<
    string,
    SharedPublishedMatchSubscription
  >();

function subscribeSharedPublishedMatches({
  seasonId,
  subscriber,
}: {
  seasonId: string;
  subscriber:
    PublishedMatchSubscriber;
}): Unsubscribe {
  const normalizedSeasonId =
    seasonId.trim();

  let shared =
    publishedMatchSubscriptions.get(
      normalizedSeasonId,
    );

  if (!shared) {
    shared = {
      subscribers:
        new Set<
          PublishedMatchSubscriber
        >(),
    };

    publishedMatchSubscriptions.set(
      normalizedSeasonId,
      shared,
    );
  }

  shared.subscribers.add(
    subscriber,
  );

  if (shared.cache) {
    subscriber.onChange(
      shared.cache,
    );
  }

  if (!shared.unsubscribe) {
    const currentShared =
      shared;

    const matchesQuery = query(
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
        "matchweek",
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

    currentShared.unsubscribe =
      onSnapshot(
        matchesQuery,
        (snapshot) => {
          currentShared.cache =
            snapshot.docs.map(
              (
                currentDocument,
              ) =>
                mapMatch(
                  currentDocument.id,
                  currentDocument.data(),
                ),
            );

          for (
            const currentSubscriber of
              currentShared.subscribers
          ) {
            currentSubscriber.onChange(
              currentShared.cache,
            );
          }
        },
        (error) => {
          console.error(
            "Errore caricamento partite pubblicate:",
            error,
          );

          for (
            const currentSubscriber of
              currentShared.subscribers
          ) {
            currentSubscriber.onError?.(
              error,
            );
          }
        },
      );
  }

  return () => {
    const currentShared =
      publishedMatchSubscriptions.get(
        normalizedSeasonId,
      );

    if (!currentShared) {
      return;
    }

    currentShared.subscribers.delete(
      subscriber,
    );

    if (
      currentShared.subscribers.size ===
      0
    ) {
      currentShared.unsubscribe?.();
      publishedMatchSubscriptions.delete(
        normalizedSeasonId,
      );
    }
  };
}

/*
 * ============================================================
 * BLOCCO SOLO DOPO TABELLINO FINALE PUBBLICATO
 *
 * Il campo match.published riguarda la pubblicazione del
 * calendario e NON deve rendere la partita non modificabile.
 *
 * Una partita viene bloccata soltanto quando esiste un
 * Match Report:
 * - status === "published"
 * - data.status === "played" oppure "walkover"
 *
 * Un report "postponed" pubblicato non blocca la partita:
 * la data/orario devono poter essere riprogrammati.
 * ============================================================
 */

function isPublishedFinalMatchReportData(
  value:
    unknown,
): boolean {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return false;
  }

  const report =
    value as {
      status?: unknown;

      data?: {
        status?: unknown;
      };
    };

  return (
    report.status ===
      "published" &&
    (
      report.data?.status ===
        "played" ||
      report.data?.status ===
        "walkover"
    )
  );
}

async function hasPublishedFinalMatchReport(
  matchId:
    string | number,
): Promise<boolean> {
  const normalizedMatchId =
    String(
      matchId ?? "",
    ).trim();

  if (!normalizedMatchId) {
    return false;
  }

  const snapshot =
    await getDoc(
      doc(
        db,
        MATCH_REPORTS_COLLECTION_NAME,
        normalizedMatchId,
      ),
    );

  if (!snapshot.exists()) {
    return false;
  }

  return isPublishedFinalMatchReportData(
    snapshot.data(),
  );
}



function buildMatchKey({
  seasonId,
  matchweek,
  homeTeamId,
  awayTeamId,
}: {
  seasonId: string;
  matchweek: number;
  homeTeamId: string;
  awayTeamId: string;
}) {
  return [
    seasonId,
    matchweek,
    homeTeamId,
    awayTeamId,
  ].join("|");
}

function buildTeamMatchweekKey({
  seasonId,
  matchweek,
  teamId,
}: {
  seasonId: string;
  matchweek: number;
  teamId: string;
}) {
  return [
    seasonId,
    matchweek,
    teamId,
  ].join("|");
}

export const FirebaseMatchRepository = {
  subscribeBySeason(
    seasonId: string,
    onChange: (matches: Match[]) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe {
    const matchesQuery = query(
      collection(db, COLLECTION_NAME),
      where("seasonId", "==", seasonId),
      orderBy("matchweek", "asc"),
      orderBy("date", "asc"),
      orderBy("time", "asc"),
    );

    return onSnapshot(
      matchesQuery,
      (snapshot) => {
        onChange(
          snapshot.docs.map((currentDocument) =>
            mapMatch(
              currentDocument.id,
              currentDocument.data(),
            ),
          ),
        );
      },
      (error) => {
        console.error(
          "Errore caricamento partite:",
          error,
        );

        onError?.(error);
      },
    );
  },

  subscribePublishedBySeason(
    seasonId: string,
    onChange: (matches: Match[]) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe {
    return subscribeSharedPublishedMatches({
      seasonId,
      subscriber: {
        onChange,
        onError,
      },
    });
  },

  async getBySeason(
    seasonId: string,
  ): Promise<Match[]> {
    const matchesQuery = query(
      collection(db, COLLECTION_NAME),
      where("seasonId", "==", seasonId),
      orderBy("matchweek", "asc"),
      orderBy("date", "asc"),
      orderBy("time", "asc"),
    );

    const snapshot =
      await getDocs(matchesQuery);

    return snapshot.docs.map(
      (currentDocument) =>
        mapMatch(
          currentDocument.id,
          currentDocument.data(),
        ),
    );
  },

  async getPublishedBySeason(
    seasonId: string,
  ): Promise<Match[]> {
    const matchesQuery = query(
      collection(db, COLLECTION_NAME),
      where("seasonId", "==", seasonId),
      where("published", "==", true),
      orderBy("matchweek", "asc"),
      orderBy("date", "asc"),
      orderBy("time", "asc"),
    );

    const snapshot =
      await getDocs(matchesQuery);

    return snapshot.docs.map(
      (currentDocument) =>
        mapMatch(
          currentDocument.id,
          currentDocument.data(),
        ),
    );
  },

  async setMatchweekPublished({
    seasonId,
    matchweek,
    published,
  }: {
    seasonId: string;
    matchweek: number;
    published: boolean;
  }): Promise<number> {
    await assertSeasonWritable(
      seasonId,
    );

    const matches =
      await FirebaseMatchRepository.getBySeason(
        seasonId,
      );

    const matchweekMatches =
      matches.filter(
        (match) =>
          match.matchweek ===
          matchweek,
      );

    if (
      matchweekMatches.length ===
      0
    ) {
      throw new Error(
        `La Matchweek ${matchweek} non contiene partite.`,
      );
    }

    const batch =
      writeBatch(db);

    for (
      const match
      of matchweekMatches
    ) {
      batch.update(
        doc(
          db,
          COLLECTION_NAME,
          match.id,
        ),
        {
          published,
          updatedAt:
            serverTimestamp(),
        },
      );
    }

    await batch.commit();

    return matchweekMatches.length;
  },

  subscribePublishedById(
    matchId: string,
    onChange: (match: Match | undefined) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe {
    return onSnapshot(query(collection(db, COLLECTION_NAME),
      where(documentId(), "==", matchId), where("published", "==", true)), (snapshot) => {
      const match = snapshot.docs[0];
      onChange(match ? mapMatch(match.id, match.data()) : undefined);
    }, (error) => {
      if (error.code === "permission-denied") onChange(undefined);
      else onError?.(error);
    });
  },

  async getPublishedById(matchId: string | number): Promise<Match | undefined> {
    const id = String(matchId).trim();
    if (!id) return undefined;
    try {
      const snapshot = await getDocs(query(collection(db, COLLECTION_NAME),
      where(documentId(), "==", id), where("published", "==", true)));
    const match = snapshot.docs[0];
    return match ? mapMatch(match.id, match.data()) : undefined;
    } catch (error) {
      // Firestore may deny an exact-ID query when the document is a draft
      // (or absent), even with a published-only filter. It is unavailable
      // to the public; never retry with an unrestricted read.
      if ((error as { code?: string }).code === "permission-denied") return undefined;
      throw error;
    }
  },

  async getById(
    matchId: string | number,
  ): Promise<Match | undefined> {
    const normalizedMatchId =
    String(matchId ?? "").trim();

    if (!normalizedMatchId) {
      return undefined;
    }
    
    const snapshot = await getDoc(
      doc(
        db,
        COLLECTION_NAME,
        normalizedMatchId,
      ),
    );

    if (!snapshot.exists()) {
      return undefined;
    }

    return mapMatch(
      snapshot.id,
      snapshot.data(),
    );
  },

  async create(
    input: CreateMatchInput,
  ): Promise<string> {
    await assertSeasonWritable(
      input.seasonId,
    );

    if (
      input.homeTeamId ===
      input.awayTeamId
    ) {
      throw new Error(
        "Una squadra non può giocare contro sé stessa.",
      );
    }

    /*
 * ==========================================================
 * CONTROLLO DUPLICATI
 * ==========================================================
 */

const existingMatches =
  await FirebaseMatchRepository
    .getBySeason(
      input.seasonId,
    );

const currentKey =
  buildMatchKey({
    seasonId:
      input.seasonId,

    matchweek:
      input.matchweek,

    homeTeamId:
      String(
        input.homeTeamId,
      ),

    awayTeamId:
      String(
        input.awayTeamId,
      ),
  });

const duplicateExists =
  existingMatches.some(
    (
      match,
    ) =>
      buildMatchKey({
        seasonId:
          match.seasonId,

        matchweek:
          match.matchweek,

        homeTeamId:
          String(
            match.homeTeamId,
          ),

        awayTeamId:
          String(
            match.awayTeamId,
          ),
      }) ===
      currentKey,
  );

if (
  duplicateExists
) {
  throw new Error(
    `La partita della Matchweek ${input.matchweek}, ${input.homeTeamId} - ${input.awayTeamId}, è già presente nel calendario.`,
  );
}

/*
 * ==========================================================
 * CONFLITTO SQUADRA NELLA MATCHWEEK
 * ==========================================================
 */

const existingTeamKeys =
  new Set(
    existingMatches.flatMap(
      (
        match,
      ) => [
        buildTeamMatchweekKey({
          seasonId:
            match.seasonId,

          matchweek:
            match.matchweek,

          teamId:
            String(
              match.homeTeamId,
            ),
        }),

        buildTeamMatchweekKey({
          seasonId:
            match.seasonId,

          matchweek:
            match.matchweek,

          teamId:
            String(
              match.awayTeamId,
            ),
        }),
      ],
    ),
  );

const conflictingTeamId =
  [
    String(
      input.homeTeamId,
    ),

    String(
      input.awayTeamId,
    ),
  ].find(
    (
      teamId,
    ) =>
      existingTeamKeys.has(
        buildTeamMatchweekKey({
          seasonId:
            input.seasonId,

          matchweek:
            input.matchweek,

          teamId,
        }),
      ),
  );

if (
  conflictingTeamId
) {
  throw new Error(
    `La squadra ${conflictingTeamId} è già presente in un'altra partita della Matchweek ${input.matchweek}.`,
  );
}

    const createdDocument = await addDoc(
      collection(db, COLLECTION_NAME),
      {
        seasonId: input.seasonId,

        matchType:
           input.matchType ??
           "regularSeason",

        matchweek: input.matchweek,

        matchweekId:
          input.matchweekId ??
          `mw${input.matchweek}`,

        date: input.date,
        time: input.time,

        venue:
          input.venue.trim() ||
          "Centro Sportivo Ludi",

        homeTeamId: input.homeTeamId,
        awayTeamId: input.awayTeamId,

        status: "scheduled",
        published: false,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    );

    return createdDocument.id;
  },

  async createMany(
    inputs: CreateMatchInput[],
    options: {
      allowCompletedSeason?: boolean;
    } = {},
  ): Promise<void> {
    if (inputs.length === 0) {
      throw new Error(
        "Non ci sono partite da importare.",
      );
    }

    if (inputs.length > 500) {
      throw new Error(
        "Puoi importare al massimo 500 partite alla volta.",
      );
    }

    const seasonIds = Array.from(
      new Set(
        inputs.map(
          (input) =>
            input.seasonId,
        ),
      ),
    );

    if (seasonIds.length !== 1) {
      throw new Error(
        "Tutte le partite importate devono appartenere alla stessa stagione.",
      );
    }

    const seasonId = seasonIds[0];

    await assertSeasonWritable(
      seasonId,
      {
        allowCompleted:
          options.allowCompletedSeason ===
          true,
      },
    );

    const existingMatches =
      await FirebaseMatchRepository.getBySeason(
        seasonId,
      );

    const existingKeys = new Set(
      existingMatches.map((match) =>
        buildMatchKey({
          seasonId: match.seasonId,
          
          matchweek: match.matchweek,
          homeTeamId:
            String(match.homeTeamId),
          awayTeamId:
            String(match.awayTeamId),
        }),
      ),
    );

    const existingTeamKeys =
  new Set(
    existingMatches.flatMap(
      (
        match,
      ) => [
        buildTeamMatchweekKey({
          seasonId:
            match.seasonId,

          matchweek:
            match.matchweek,

          teamId:
            String(
              match.homeTeamId,
            ),
        }),

        buildTeamMatchweekKey({
          seasonId:
            match.seasonId,

          matchweek:
            match.matchweek,

          teamId:
            String(
              match.awayTeamId,
            ),
        }),
      ],
    ),
  );

    const importedKeys =
      new Set<string>();

    const importedTeamKeys =
  new Set<string>();  

    for (const input of inputs) {
      if (
        input.homeTeamId ===
        input.awayTeamId
      ) {
        throw new Error(
          "Una squadra non può giocare contro sé stessa.",
        );
      } 

      const currentKey =
        buildMatchKey({
          seasonId:
            input.seasonId,

          matchweek:
            input.matchweek,

          homeTeamId:
            String(
              input.homeTeamId,
            ),

          awayTeamId:
            String(
              input.awayTeamId,
            ),
        });

      if (
        existingKeys.has(
          currentKey,
        )
      ) {
        throw new Error(
          `La partita della Matchweek ${input.matchweek}, ${input.homeTeamId} - ${input.awayTeamId}, è già presente nel calendario.`,
        );
      }

      if (
        importedKeys.has(
          currentKey,
        )
      ) {
        throw new Error(
          "Il file Excel contiene una partita duplicata.",
        );
      }

      const importedTeamIds =
  [
    String(
      input.homeTeamId,
    ),

    String(
      input.awayTeamId,
    ),
  ];

for (
  const teamId
  of importedTeamIds
) {
  const teamKey =
    buildTeamMatchweekKey({
      seasonId:
        input.seasonId,

      matchweek:
        input.matchweek,

      teamId,
    });

  if (
    existingTeamKeys.has(
      teamKey,
    )
  ) {
    throw new Error(
      `La squadra ${teamId} è già presente nel calendario della Matchweek ${input.matchweek}.`,
    );
  }

  if (
    importedTeamKeys.has(
      teamKey,
    )
  ) {
    throw new Error(
      `Il file Excel contiene la squadra ${teamId} più di una volta nella Matchweek ${input.matchweek}.`,
    );
  }

  importedTeamKeys.add(
    teamKey,
  );
}

      importedKeys.add(
        currentKey,
      );
    }

    const batch =
      writeBatch(db);

    for (const input of inputs) {
      const reference = doc(
        collection(
          db,
          COLLECTION_NAME,
        ),
      );

      batch.set(reference, {
        seasonId:
          input.seasonId,

        matchType:
          input.matchType ??
          "regularSeason",

        matchweek:
          input.matchweek,

        matchweekId:
          input.matchweekId ??
          `mw${input.matchweek}`,

        date:
          input.date,

        time:
          input.time,

        venue:
          input.venue.trim() ||
          "Centro Sportivo Ludi",

        homeTeamId:
          input.homeTeamId,

        awayTeamId:
          input.awayTeamId,

        status:
          "scheduled",

        published:
          false,

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp(),
      });
    }

    await batch.commit();
  },

  async update(
  input: UpdateMatchInput,
  options: {
    allowPublishedFinalReportOverride?: boolean;
  } = {},
): Promise<void> {
  const existingMatch =
    await FirebaseMatchRepository.getById(
      input.matchId,
    );

  if (!existingMatch) {
    throw new Error(
      "La partita selezionata non esiste.",
    );
  }

  /*
   * ==========================================================
   * PROTEZIONE TABELLINO PUBBLICATO
   * ==========================================================
   *
   * Non blocchiamo in base a:
   * - existingMatch.published
   * - existingMatch.status
   *
   * Il calendario resta modificabile finché non esiste un
   * tabellino FINALE effettivamente pubblicato.
   * ==========================================================
   */

  /*
   * Le modifiche provenienti dalla gestione calendario
   * possono forzare il superamento di questo blocco SOLO
   * quando la UI ha già verificato che la partita sia
   * "in attesa" / programmata oppure rinviata.
   *
   * Tutti gli altri chiamanti mantengono il blocco standard.
   */
  if (
    options.allowPublishedFinalReportOverride !==
      true &&
    await hasPublishedFinalMatchReport(
      existingMatch.id,
    )
  ) {
    throw new Error(
      "Una partita con tabellino pubblicato non può essere modificata dalla gestione calendario.",
    );
  }

  /*
   * ==========================================================
   * PROTEZIONE TITLE PLAYOFF
   * ==========================================================
   */

  if (
    existingMatch.matchType ===
      "titlePlayoff" &&
    (
      String(
        input.homeTeamId,
      ) !==
        String(
          existingMatch.homeTeamId,
        ) ||
      String(
        input.awayTeamId,
      ) !==
        String(
          existingMatch.awayTeamId,
        )
    )
  ) {
    throw new Error(
      "Le squadre dello spareggio per il titolo non possono essere modificate.",
    );
  }

  await assertSeasonWritable(
    existingMatch.seasonId,
  );

  if (
    input.homeTeamId ===
    input.awayTeamId
  ) {
    throw new Error(
      "Una squadra non può giocare contro sé stessa.",
    );
  }

  /*
   * ==========================================================
   * STATO GESTIBILE DAL CALENDARIO
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

  /*
 * ==========================================================
 * CONFLITTO SQUADRA NELLA MATCHWEEK
 * ==========================================================
 */

const seasonMatches =
  await FirebaseMatchRepository
    .getBySeason(
      existingMatch.seasonId,
    );

const otherMatches =
  seasonMatches.filter(
    (
      match,
    ) =>
      String(
        match.id,
      ) !==
      String(
        existingMatch.id,
      ),
  );

const otherTeamKeys =
  new Set(
    otherMatches.flatMap(
      (
        match,
      ) => [
        buildTeamMatchweekKey({
          seasonId:
            match.seasonId,

          matchweek:
            match.matchweek,

          teamId:
            String(
              match.homeTeamId,
            ),
        }),

        buildTeamMatchweekKey({
          seasonId:
            match.seasonId,

          matchweek:
            match.matchweek,

          teamId:
            String(
              match.awayTeamId,
            ),
        }),
      ],
    ),
  );

const conflictingTeamId =
  [
    String(
      input.homeTeamId,
    ),

    String(
      input.awayTeamId,
    ),
  ].find(
    (
      teamId,
    ) =>
      otherTeamKeys.has(
        buildTeamMatchweekKey({
          seasonId:
            existingMatch.seasonId,

          matchweek:
            input.matchweek,

          teamId,
        }),
      ),
  );

if (
  conflictingTeamId
) {
  throw new Error(
    `La squadra ${conflictingTeamId} è già presente in un'altra partita della Matchweek ${input.matchweek}.`,
  );
}

  await updateDoc(
      doc(
        db,
        COLLECTION_NAME,
        input.matchId,
      ),
      {
        matchweek:
          input.matchweek,

        matchweekId:
          input.matchweekId ??
          `mw${input.matchweek}`,

        matchType:
          input.matchType ??
          existingMatch.matchType ??
         
          "regularSeason",

        date:
          input.date,

        time:
          input.time,

        venue:
          input.venue.trim() ||
          "Centro Sportivo Ludi",

        homeTeamId:
          input.homeTeamId,

        awayTeamId:
          input.awayTeamId,

        status:
          input.status,

        published:
          input.published,

        updatedAt:
          serverTimestamp(),
      },
    );
  },

  /*
   * ==========================================================
   * LIFECYCLE LIVE
   * ==========================================================
   */
  async transitionLifecycle({
    matchId,
    expectedStatus,
    status,
    homeScore,
    awayScore,
  }: {
    matchId: string;
    expectedStatus:
      | "scheduled"
      | "live"
      | "finished";
    status:
      | "live"
      | "finished";
    homeScore: number;
    awayScore: number;
  }): Promise<void> {
    const normalizedMatchId =
      String(
        matchId ?? "",
      ).trim();

    if (!normalizedMatchId) {
      throw new Error(
        "La partita non è stata specificata.",
      );
    }

    if (
      !Number.isInteger(
        homeScore,
      ) ||
      !Number.isInteger(
        awayScore,
      ) ||
      homeScore < 0 ||
      awayScore < 0
    ) {
      throw new Error(
        "Il risultato deve contenere numeri interi maggiori o uguali a zero.",
      );
    }

    /*
     * Preflight necessario per conoscere la stagione e applicare
     * il guard già condiviso dal resto del repository.
     *
     * Lo stato viene poi riletto DENTRO la transaction:
     * il preflight non viene usato per decidere la transizione.
     */
    const existingMatch =
      await FirebaseMatchRepository.getById(
        normalizedMatchId,
      );

    if (!existingMatch) {
      throw new Error(
        "La partita selezionata non esiste.",
      );
    }

    await assertSeasonWritable(
      existingMatch.seasonId,
    );

    /*
     * Recuperiamo gli id della stagione prima della transaction.
     * All'interno della transaction rileggiamo tutti i documenti:
     * questo rende atomico anche il vincolo "una sola gara LIVE".
     */
    const [
      seasonMatches,
      finalStageMatchIds,
    ] =
      await Promise.all([
        FirebaseMatchRepository.getBySeason(
          existingMatch.seasonId,
        ),

        getOppositePhaseMatchIds({
          seasonId:
            existingMatch.seasonId,

          phase:
            "regularSeason",
        }),
      ]);

    const matchReference =
      doc(
        db,
        COLLECTION_NAME,
        normalizedMatchId,
      );

    const reportReference =
      doc(
        db,
        MATCH_REPORTS_COLLECTION_NAME,
        normalizedMatchId,
      );

    const otherRegularMatchReferences =
      seasonMatches
        .filter(
          (
            currentMatch,
          ) =>
            String(
              currentMatch.id,
            ) !==
            normalizedMatchId,
        )
        .map(
          (
            currentMatch,
          ) =>
            doc(
              db,
              COLLECTION_NAME,
              String(
                currentMatch.id,
              ),
            ),
        );

    const finalStageMatchReferences =
      finalStageMatchIds.map(
        (
          finalStageMatchId,
        ) =>
          doc(
            db,
            "finalStageMatches",
            finalStageMatchId,
          ),
      );

    const otherMatchReferences = [
      ...otherRegularMatchReferences,
      ...finalStageMatchReferences,
    ];

    await runTransaction(
      db,
      async (
        transaction,
      ) => {
        /*
         * Tutte le letture vengono eseguite prima della scrittura.
         */
        const [
          matchSnapshot,
          reportSnapshot,
          ...otherMatchSnapshots
        ] =
          await Promise.all([
            transaction.get(
              matchReference,
            ),

            transaction.get(
              reportReference,
            ),

            ...otherMatchReferences.map(
              (
                reference,
              ) =>
                transaction.get(
                  reference,
                ),
            ),
          ]);

        if (
          !matchSnapshot.exists()
        ) {
          throw new Error(
            "La partita selezionata non esiste.",
          );
        }

        const storedMatch =
          mapMatch(
            matchSnapshot.id,
            matchSnapshot.data(),
          );

        if (
          storedMatch.seasonId !==
          existingMatch.seasonId
        ) {
          throw new Error(
            "La partita non appartiene più alla stagione prevista.",
          );
        }

        if (
          reportSnapshot.exists() &&
          isPublishedFinalMatchReportData(
            reportSnapshot.data(),
          )
        ) {
          throw new Error(
            "Il lifecycle live non può essere modificato dopo la pubblicazione del tabellino finale.",
          );
        }

        if (
          storedMatch.status !==
          expectedStatus
        ) {
          throw new Error(
            `Stato partita non valido: atteso ${expectedStatus}, trovato ${storedMatch.status}.`,
          );
        }

        /*
         * Qualsiasi passaggio verso LIVE, incluso finished -> live,
         * deve rispettare atomicamente l'esclusività.
         */
        if (
          status ===
          "live"
        ) {
          const conflictingLive =
            otherMatchSnapshots.find(
              (
                snapshot,
              ) =>
                snapshot.exists() &&
                snapshot.data().status ===
                  "live",
            );

          if (
            conflictingLive
          ) {
            throw new Error(
              "Un'altra partita della stagione è già live.",
            );
          }
        }

        transaction.update(
          matchReference,
          {
            status,
            homeScore,
            awayScore,
            updatedAt:
              serverTimestamp(),
          },
        );
      },
    );
  },

  async updateLiveScore({
    matchId,
    homeScore,
    awayScore,
  }: {
    matchId: string;
    homeScore: number;
    awayScore: number;
  }): Promise<void> {
    await FirebaseMatchRepository.transitionLifecycle({
      matchId,
      expectedStatus:
        "live",
      status:
        "live",
      homeScore,
      awayScore,
    });
  },

  async remove(
    matchId: string,
    options: {
      allowPublishedFinalReportOverride?: boolean;
    } = {},
  ): Promise<void> {
    const existingMatch =
      await FirebaseMatchRepository.getById(
        matchId,
      );

    if (!existingMatch) {
      throw new Error(
        "La partita selezionata non esiste.",
      );
    }

    /*
     * ========================================================
     * PROTEZIONE TABELLINO PUBBLICATO
     * ========================================================
     *
     * Anche l'eliminazione viene bloccata soltanto dopo
     * la pubblicazione di un tabellino finale.
     * ========================================================
     */

    /*
     * Stesso criterio della modifica:
     * l'override viene richiesto esplicitamente dalla UI
     * soltanto per partite programmabili / in attesa / rinviate.
     */
    if (
      options.allowPublishedFinalReportOverride !==
        true &&
      await hasPublishedFinalMatchReport(
        existingMatch.id,
      )
    ) {
      throw new Error(
        "Una partita con tabellino pubblicato non può essere eliminata dalla gestione calendario.",
      );
    }

/*
 * ==========================================================
 * PROTEZIONE TITLE PLAYOFF
 * ==========================================================
 *
 * Una volta creato lo spareggio,
 * le due squadre devono rimanere
 * quelle determinate dal motore
 * di chiusura della Regular Season.
 * ==========================================================
 */

    await assertSeasonWritable(
      existingMatch.seasonId,
    );

    await deleteDoc(
      doc(
        db,
        COLLECTION_NAME,
        matchId,
      ),
    );
  },
};
