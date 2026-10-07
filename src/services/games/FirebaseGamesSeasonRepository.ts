import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";

import {
  db,
} from "@/src/lib/firebase";

import type {
  CreateGamesSeasonInput,
  GamesPassPricePeriod,
  GamesPassPricePeriodInput,
  GamesSeason,
  UpdateGamesSeasonInput,
} from "@/src/types/GamesSeason";

import {
  GAMES_COMPETITION_IDS,
  buildGamesSeasonIdentity,
} from "@/src/types/GamesSeason";

import {
  gamesSeasonsOverlap,
  getNextGamesSeasonBoundaryTimestamp,
  selectActiveGamesSeason,
  toGamesDate,
} from "@/src/services/games/GamesSeasonStatusService";

const COLLECTION_NAME =
  "gamesSeasons";

const MAX_TIMEOUT_MS =
  2_147_000_000;

/*
 * ============================================================
 * REPOSITORY
 * ============================================================
 */

export class FirebaseGamesSeasonRepository {
  /*
   * ==========================================================
   * CREATE
   * ==========================================================
   *
   * Alias mantenuto per compatibilità.
   * Ogni nuova Games Season viene creata come configurazione
   * stagionale attiva; la sua effettiva visibilità è poi
   * determinata esclusivamente da startsAt / endsAt.
   * ==========================================================
   */

  static async create(
    input:
      CreateGamesSeasonInput,
  ): Promise<void> {
    await this.createAndActivate(
      input,
    );
  }

  /*
   * ==========================================================
   * CREATE AND ACTIVATE
   * ==========================================================
   *
   * - nome automatico: Games 2026/27
   * - id automatico: games-2026-27
   * - tutte le competizioni sempre incluse
   * - nessuna archiviazione automatica dei documenti precedenti
   * - nessuna sovrapposizione tra Games Season
   * ==========================================================
   */

  static async createAndActivate(
    input:
      CreateGamesSeasonInput,
  ): Promise<void> {
    validateCreateInput(
      input,
    );

    const identity =
      buildGamesSeasonIdentity(
        input.startsAt,
        input.endsAt,
      );

    const reference =
      doc(
        db,
        COLLECTION_NAME,
        identity.id,
      );

    const existingDocument =
      await getDoc(
        reference,
      );

    if (
      existingDocument.exists()
    ) {
      throw new Error(
        `Esiste già una Games Season per ${identity.startYear}/${String(
          identity.endYear,
        ).slice(-2)}.`,
      );
    }

    /*
     * Una sola Games Season può coprire un dato intervallo.
     *
     * I vecchi documenti "archived" vengono ignorati.
     * I vecchi documenti senza date valide non bloccano la
     * creazione perché non possono essere confrontati.
     */
    const configuredSnapshot =
      await getDocs(
        query(
          collection(
            db,
            COLLECTION_NAME,
          ),

          where(
            "status",
            "==",
            "active",
          ),
        ),
      );

    for (
      const currentDocument of
      configuredSnapshot.docs
    ) {
      const currentGamesSeason =
        normalizeDocument(
          currentDocument.id,
          currentDocument.data(),
        );

      const currentStartsAt =
        toGamesDate(
          currentGamesSeason.startsAt,
        );

      const currentEndsAt =
        toGamesDate(
          currentGamesSeason.endsAt,
        );

      if (
        !currentStartsAt ||
        !currentEndsAt
      ) {
        continue;
      }

      if (
        gamesSeasonsOverlap(
          input.startsAt,
          input.endsAt,
          currentStartsAt,
          currentEndsAt,
        )
      ) {
        throw new Error(
          `La nuova Games Season si sovrappone a "${currentGamesSeason.name}".`,
        );
      }
    }

    await setDoc(
      reference,
      {
        name:
          identity.name,

        status:
          "active",

        /*
         * Campo mantenuto per compatibilità con il codice
         * esistente, ma non è più configurabile.
         */
        competitionIds:
          [...GAMES_COMPETITION_IDS],

        passPricing:
          serializePassPricing(
            input.passPricing ??
              [],
          ),

        startsAt:
          input.startsAt,

        endsAt:
          input.endsAt,

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp(),
      },
    );
  }

  /*
   * ==========================================================
   * UPDATE
   * ==========================================================
   *
   * Usato soprattutto dall'editor del Games Pass.
   * Nome e competizioni vengono sempre rigenerati.
   * ==========================================================
   */

  static async update(
    input:
      UpdateGamesSeasonInput,
  ): Promise<void> {
    const normalizedGamesSeasonId =
      input.gamesSeasonId.trim();

    if (
      !normalizedGamesSeasonId
    ) {
      throw new Error(
        "gamesSeasonId obbligatorio.",
      );
    }

    const reference =
      doc(
        db,
        COLLECTION_NAME,
        normalizedGamesSeasonId,
      );

    const snapshot =
      await getDoc(
        reference,
      );

    if (
      !snapshot.exists()
    ) {
      throw new Error(
        "Games Season non trovata.",
      );
    }

    const current =
      normalizeDocument(
        snapshot.id,
        snapshot.data(),
      );

    const startsAt =
      input.startsAt ??
      toGamesDate(
        current.startsAt,
      );

    const endsAt =
      input.endsAt ??
      toGamesDate(
        current.endsAt,
      );

    if (
      !startsAt ||
      !endsAt
    ) {
      throw new Error(
        "Data di inizio e data di fine sono obbligatorie.",
      );
    }

    validateSeasonDates(
      startsAt,
      endsAt,
    );

    if (
      input.passPricing
    ) {
      validatePassPricing(
        input.passPricing,
      );
    }

    const identity =
      buildGamesSeasonIdentity(
        startsAt,
        endsAt,
      );

    const payload:
      Record<
        string,
        unknown
      > = {
        name:
          identity.name,

        status:
          "active",

        competitionIds:
          [...GAMES_COMPETITION_IDS],

        startsAt,
        endsAt,

        updatedAt:
          serverTimestamp(),
      };

    if (
      input.passPricing
    ) {
      payload.passPricing =
        serializePassPricing(
          input.passPricing,
        );
    }

    await updateDoc(
      reference,
      payload,
    );
  }

  /*
   * ==========================================================
   * LEGACY MAINTENANCE
   * ==========================================================
   *
   * Non vengono più usati dalla nuova Admin Games.
   * Restano per evitare rotture con strumenti di manutenzione
   * già presenti nel progetto.
   * ==========================================================
   */

  static async deleteArchived(
    gamesSeasonId:
      string,
  ): Promise<void> {
    const normalizedGamesSeasonId =
      gamesSeasonId.trim();

    if (
      !normalizedGamesSeasonId
    ) {
      throw new Error(
        "gamesSeasonId obbligatorio.",
      );
    }

    await deleteDoc(
      doc(
        db,
        COLLECTION_NAME,
        normalizedGamesSeasonId,
      ),
    );
  }

  static async activate(
    gamesSeasonId:
      string,
  ): Promise<void> {
    const normalizedGamesSeasonId =
      gamesSeasonId.trim();

    if (
      !normalizedGamesSeasonId
    ) {
      throw new Error(
        "gamesSeasonId obbligatorio.",
      );
    }

    await updateDoc(
      doc(
        db,
        COLLECTION_NAME,
        normalizedGamesSeasonId,
      ),
      {
        status:
          "active",

        competitionIds:
          [...GAMES_COMPETITION_IDS],

        updatedAt:
          serverTimestamp(),
      },
    );
  }

  /*
   * ==========================================================
   * ACTIVE
   * ==========================================================
   */

  static async getActive():
    Promise<
      GamesSeason | undefined
    > {
    const snapshot =
      await getDocs(
        query(
          collection(
            db,
            COLLECTION_NAME,
          ),

          where(
            "status",
            "==",
            "active",
          ),
        ),
      );

    const gamesSeasons =
      snapshot.docs.map(
        (
          currentDocument,
        ) =>
          normalizeDocument(
            currentDocument.id,
            currentDocument.data(),
          ),
      );

    return selectActiveGamesSeason(
      gamesSeasons,
      new Date(),
    );
  }

  /*
   * ==========================================================
   * ACTIVE SUBSCRIPTION
   * ==========================================================
   *
   * Il listener Firestore da solo non emetterebbe un nuovo
   * snapshot quando scatta semplicemente l'orario di fine.
   *
   * Per questo manteniamo un timer locale sulla prossima
   * boundary temporale. Alla scadenza il callback viene
   * rivalutato anche senza modifiche al database.
   * ==========================================================
   */

  static subscribeActive(
    onChange:
      (
        gamesSeason:
          GamesSeason | undefined,
      ) => void,

    onError?:
      (
        error: Error,
      ) => void,
  ): Unsubscribe {
    let latestGamesSeasons:
      GamesSeason[] = [];

    let boundaryTimer:
      ReturnType<
        typeof setTimeout
      > | null =
      null;

    let disposed =
      false;

    const clearBoundaryTimer =
      () => {
        if (
          boundaryTimer
        ) {
          clearTimeout(
            boundaryTimer,
          );

          boundaryTimer =
            null;
        }
      };

    const evaluate =
      () => {
        if (
          disposed
        ) {
          return;
        }

        clearBoundaryTimer();

        const now =
          new Date();

        onChange(
          selectActiveGamesSeason(
            latestGamesSeasons,
            now,
          ),
        );

        const nextBoundary =
          getNextGamesSeasonBoundaryTimestamp(
            latestGamesSeasons,
            now,
          );

        if (
          nextBoundary ===
          null
        ) {
          return;
        }

        const delay =
          Math.max(
            1,
            Math.min(
              MAX_TIMEOUT_MS,
              nextBoundary -
                now.getTime() +
                25,
            ),
          );

        boundaryTimer =
          setTimeout(
            evaluate,
            delay,
          );
      };

    const reference =
      query(
        collection(
          db,
          COLLECTION_NAME,
        ),

        where(
          "status",
          "==",
          "active",
        ),
      );

    const unsubscribe =
      onSnapshot(
        reference,

        (
          snapshot,
        ) => {
          latestGamesSeasons =
            snapshot.docs.map(
              (
                currentDocument,
              ) =>
                normalizeDocument(
                  currentDocument.id,
                  currentDocument.data(),
                ),
            );

          evaluate();
        },

        (
          error,
        ) => {
          console.error(
            "Errore caricamento stagione Games:",
            error,
          );

          onError?.(
            error,
          );
        },
      );

    return () => {
      disposed =
        true;

      clearBoundaryTimer();

      unsubscribe();
    };
  }

  /*
   * ==========================================================
   * ADMIN LISTENER
   * ==========================================================
   *
   * Serve alla sola amministrazione.
   * Nessuna sezione archivio viene mostrata in UI.
   * ==========================================================
   */

  static subscribeAll(
    onChange:
      (
        gamesSeasons:
          GamesSeason[],
      ) => void,

    onError?:
      (
        error: Error,
      ) => void,
  ): Unsubscribe {
    const reference =
      query(
        collection(
          db,
          COLLECTION_NAME,
        ),

        orderBy(
          "name",
          "desc",
        ),
      );

    return onSnapshot(
      reference,

      (
        snapshot,
      ) => {
        onChange(
          snapshot.docs.map(
            (
              currentDocument,
            ) =>
              normalizeDocument(
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
          "Errore caricamento stagioni Games:",
          error,
        );

        onError?.(
          error,
        );
      },
    );
  }
}

/*
 * ============================================================
 * NORMALIZATION
 * ============================================================
 */

function normalizeDocument(
  id:
    string,

  value:
    Record<
      string,
      unknown
    >,
): GamesSeason {
  const status =
    value.status ===
    "archived"
      ? "archived"
      : "active";

  return {
    id,

    name:
      normalizeString(
        value.name,
      ),

    status,

    /*
     * Dalla nuova architettura tutte le competizioni sono
     * sempre disponibili. Uniformiamo anche i vecchi record
     * quando vengono letti.
     */
    competitionIds:
      [...GAMES_COMPETITION_IDS],

    passPricing:
      normalizePassPricing(
        value.passPricing,
      ),

    startsAt:
      value.startsAt,

    endsAt:
      value.endsAt,

    createdAt:
      value.createdAt,

    updatedAt:
      value.updatedAt,
  };
}

/*
 * ============================================================
 * VALIDATION
 * ============================================================
 */

function validateCreateInput(
  input:
    CreateGamesSeasonInput,
): void {
  validateSeasonDates(
    input.startsAt,
    input.endsAt,
  );

  validatePassPricing(
    input.passPricing ??
      [],
  );
}

function validateSeasonDates(
  startsAt:
    Date,

  endsAt:
    Date,
): void {
  if (
    Number.isNaN(
      startsAt.getTime(),
    ) ||
    Number.isNaN(
      endsAt.getTime(),
    )
  ) {
    throw new Error(
      "Date Games Season non valide.",
    );
  }

  if (
    endsAt.getTime() <=
    startsAt.getTime()
  ) {
    throw new Error(
      "La data di fine deve essere successiva alla data di inizio.",
    );
  }
}

function validatePassPricing(
  periods:
    GamesPassPricePeriodInput[],
): void {
  if (
    periods.length ===
    0
  ) {
    return;
  }

  const normalizedIds =
    new Set<string>();

  const orderedPeriods =
    [...periods].sort(
      (
        first,
        second,
      ) =>
        first.startsAt.getTime() -
        second.startsAt.getTime(),
    );

  orderedPeriods.forEach(
    (
      period,
      index,
    ) => {
      const id =
        period.id.trim();

      const name =
        period.name.trim();

      if (
        !id
      ) {
        throw new Error(
          "Ogni fascia prezzo deve avere un ID.",
        );
      }

      if (
        normalizedIds.has(
          id,
        )
      ) {
        throw new Error(
          `ID fascia prezzo duplicato: ${id}.`,
        );
      }

      normalizedIds.add(
        id,
      );

      if (
        !name
      ) {
        throw new Error(
          "Ogni fascia prezzo deve avere un nome.",
        );
      }

      if (
        !Number.isInteger(
          period.priceCents,
        ) ||
        period.priceCents <=
          0
      ) {
        throw new Error(
          `Prezzo non valido per "${name}".`,
        );
      }

      if (
        Number.isNaN(
          period.startsAt.getTime(),
        )
      ) {
        throw new Error(
          `Data iniziale non valida per "${name}".`,
        );
      }

      if (
        period.endsAt
      ) {
        if (
          Number.isNaN(
            period.endsAt.getTime(),
          )
        ) {
          throw new Error(
            `Data finale non valida per "${name}".`,
          );
        }

        if (
          period.endsAt.getTime() <=
          period.startsAt.getTime()
        ) {
          throw new Error(
            `La data finale di "${name}" deve essere successiva alla data iniziale.`,
          );
        }
      }

      const previousPeriod =
        orderedPeriods[
          index -
            1
        ];

      if (
        !previousPeriod
      ) {
        return;
      }

      if (
        !previousPeriod.endsAt
      ) {
        throw new Error(
          `La fascia "${previousPeriod.name}" non ha una data finale e impedisce l'inizio delle fasce successive.`,
        );
      }

      if (
        period.startsAt.getTime() <=
        previousPeriod.endsAt.getTime()
      ) {
        throw new Error(
          `Le fasce "${previousPeriod.name}" e "${name}" si sovrappongono.`,
        );
      }
    },
  );
}

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function normalizeString(
  value:
    unknown,
): string {
  return String(
    value ??
      "",
  ).trim();
}

function serializePassPricing(
  periods:
    GamesPassPricePeriodInput[],
) {
  return periods.map(
    (
      period,
    ) => ({
      id:
        period.id.trim(),

      name:
        period.name.trim(),

      priceCents:
        period.priceCents,

      startsAt:
        period.startsAt,

      endsAt:
        period.endsAt ??
        null,
    }),
  );
}

function normalizePassPricing(
  value:
    unknown,
): GamesPassPricePeriod[] {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return [];
  }

  return value
    .filter(
      (
        item,
      ): item is Record<
        string,
        unknown
      > =>
        typeof item ===
          "object" &&
        item !==
          null,
    )
    .map(
      (
        item,
      ) => ({
        id:
          normalizeString(
            item.id,
          ),

        name:
          normalizeString(
            item.name,
          ),

        priceCents:
          normalizePriceCents(
            item.priceCents,
          ),

        startsAt:
          item.startsAt,

        endsAt:
          item.endsAt ??
          undefined,
      }),
    )
    .filter(
      (
        period,
      ) =>
        Boolean(
          period.id &&
            period.name &&
            period.startsAt,
        ),
    );
}

function normalizePriceCents(
  value:
    unknown,
): number {
  const normalized =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      normalized,
    )
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(
      normalized,
    ),
  );
}
