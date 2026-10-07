import {
  collection,
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
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";

import {
  db,
} from "@/src/lib/firebase";

import type {
  CreateGamesGameInput,
  GamesGame,
  GamesGameType,
  UpdateGamesGameInput,
} from "@/src/types/GamesGame";

import {
  GAMES_COMPETITION_IDS,
} from "@/src/types/GamesSeason";

const COLLECTION_NAME =
  "gamesGames";

const CATALOG_VERSION =
  2;

/*
 * ============================================================
 * REPOSITORY
 * ============================================================
 */

export class FirebaseGamesGameRepository {
  /*
   * ==========================================================
   * CREATE
   * ==========================================================
   *
   * Il gioco viene creato nel catalogo permanente.
   * Non viene collegato a una Games Season.
   * ==========================================================
   */

  static async create(
    input:
      CreateGamesGameInput,
  ): Promise<void> {
    validateCreateInput(
      input,
    );

    const slug =
      normalizeSlug(
        input.slug,
      );

    const matchingSnapshot =
      await getDocs(
        query(
          collection(
            db,
            COLLECTION_NAME,
          ),

          where(
            "slug",
            "==",
            slug,
          ),
        ),
      );

    const matchingGames =
      buildCatalogGames(
        matchingSnapshot.docs.map(
          (
            currentDocument,
          ) => ({
            id:
              currentDocument.id,

            data:
              currentDocument.data(),
          }),
        ),
      );

    const existing =
      matchingGames[0];

    if (
      existing &&
      existing.status !==
        "suppressed"
    ) {
      throw new Error(
        "Esiste già un gioco con questo nome.",
      );
    }

    const gameId =
      existing?.id ??
      createCatalogGameDocumentId(
        slug,
      );

    const payload = {
      name:
        input.name.trim(),

      slug,

      priceCents:
        normalizePriceCents(
          input.priceCents,
        ),

      status:
        input.status,

      activatesAt:
        input.activatesAt ??
        null,

      /*
       * Campi interni mantenuti per compatibilità.
       *
       * Tutti i giochi sono disponibili per tutte
       * le competizioni.
       */
      gameType:
        normalizeGameType(
          input.gameType,
          slug,
        ),

      competitionIds:
        [...GAMES_COMPETITION_IDS],

      description:
        input.description?.trim() ??
        "",

      /*
       * Un gioco del catalogo non appartiene più
       * a una Games Season.
       */
      gamesSeasonId:
        null,

      catalogVersion:
        CATALOG_VERSION,

      updatedAt:
        serverTimestamp(),
    };

    if (
      existing
    ) {
      /*
       * Se il gioco era stato eliminato in precedenza,
       * lo riattiviamo senza sovrascrivere eventuali
       * configurazioni specifiche del builder.
       */
      await updateDoc(
        doc(
          db,
          COLLECTION_NAME,
          gameId,
        ),
        payload,
      );

      return;
    }

    await setDoc(
      doc(
        db,
        COLLECTION_NAME,
        gameId,
      ),
      {
        ...payload,

        createdAt:
          serverTimestamp(),
      },
    );
  }

  /*
   * ==========================================================
   * UPDATE
   * ==========================================================
   */

  static async update(
    input:
      UpdateGamesGameInput,
  ): Promise<void> {
    validateUpdateInput(
      input,
    );

    const reference =
      doc(
        db,
        COLLECTION_NAME,
        input.gameId.trim(),
      );

    const snapshot =
      await getDoc(
        reference,
      );

    if (
      !snapshot.exists()
    ) {
      throw new Error(
        "Gioco non trovato.",
      );
    }

    const current =
      normalizeDocument(
        snapshot.id,
        snapshot.data(),
      );

    const slug =
      normalizeSlug(
        input.slug ||
        current.slug,
      );

    await updateDoc(
      reference,
      {
        name:
          input.name.trim(),

        /*
         * Lo slug resta stabile: cambiare nome non rompe
         * route o dati già collegati al gioco.
         */
        slug,

        priceCents:
          normalizePriceCents(
            input.priceCents,
          ),

        status:
          input.status,

        activatesAt:
          input.activatesAt ??
          null,

        gameType:
          normalizeGameType(
            input.gameType ??
            current.gameType,
            slug,
          ),

        competitionIds:
          [...GAMES_COMPETITION_IDS],

        description:
          input.description?.trim() ??
          current.description ??
          "",

        gamesSeasonId:
          null,

        catalogVersion:
          CATALOG_VERSION,

        updatedAt:
          serverTimestamp(),
      },
    );
  }

  /*
   * ==========================================================
   * DELETE / SUPPRESS
   * ==========================================================
   *
   * "Elimina" in Admin usa una cancellazione logica.
   * In questo modo eventuali classifiche, acquisti o edizioni
   * passate non rimangono senza riferimento.
   * ==========================================================
   */

  static async suppress(
    gameId:
      string,
  ): Promise<void> {
    const normalizedGameId =
      gameId.trim();

    if (
      !normalizedGameId
    ) {
      throw new Error(
        "gameId obbligatorio.",
      );
    }

    await updateDoc(
      doc(
        db,
        COLLECTION_NAME,
        normalizedGameId,
      ),
      {
        status:
          "suppressed",

        catalogVersion:
          CATALOG_VERSION,

        updatedAt:
          serverTimestamp(),
      },
    );
  }

  /*
   * ==========================================================
   * LEGACY HELPERS
   * ==========================================================
   */

  static async activate(
    gameId:
      string,
  ): Promise<void> {
    const normalizedGameId =
      gameId.trim();

    if (
      !normalizedGameId
    ) {
      throw new Error(
        "gameId obbligatorio.",
      );
    }

    await updateDoc(
      doc(
        db,
        COLLECTION_NAME,
        normalizedGameId,
      ),
      {
        status:
          "active",

        activatesAt:
          null,

        catalogVersion:
          CATALOG_VERSION,

        competitionIds:
          [...GAMES_COMPETITION_IDS],

        gamesSeasonId:
          null,

        updatedAt:
          serverTimestamp(),
      },
    );
  }

  static async restore(
    gameId:
      string,
  ): Promise<void> {
    const normalizedGameId =
      gameId.trim();

    if (
      !normalizedGameId
    ) {
      throw new Error(
        "gameId obbligatorio.",
      );
    }

    await updateDoc(
      doc(
        db,
        COLLECTION_NAME,
        normalizedGameId,
      ),
      {
        status:
          "waiting",

        activatesAt:
          null,

        catalogVersion:
          CATALOG_VERSION,

        competitionIds:
          [...GAMES_COMPETITION_IDS],

        gamesSeasonId:
          null,

        updatedAt:
          serverTimestamp(),
      },
    );
  }

  /*
   * ==========================================================
   * PERMANENT CATALOG
   * ==========================================================
   */

  static subscribeCatalog(
    onChange:
      (
        games:
          GamesGame[],
      ) => void,

    onError?:
      (
        error:
          Error,
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
          "asc",
        ),
      );

    return onSnapshot(
      reference,

      (
        snapshot,
      ) => {
        onChange(
          buildCatalogGames(
            snapshot.docs.map(
              (
                currentDocument,
              ) => ({
                id:
                  currentDocument.id,

                data:
                  currentDocument.data(),
              }),
            ),
          ),
        );
      },

      (
        error,
      ) => {
        console.error(
          "Errore caricamento catalogo Games:",
          error,
        );

        onError?.(
          error,
        );
      },
    );
  }

  /*
   * ==========================================================
   * REORDER CATALOG
   * ==========================================================
   *
   * Salva l'ordine completo del catalogo in un'unica batch.
   * Il listener pubblico riceverà automaticamente il nuovo
   * ordinamento senza bisogno di altre modifiche alla GamesScreen.
   * ==========================================================
   */

  static async reorderCatalog(
    gameIds:
      string[],
  ): Promise<void> {
    const normalizedIds =
      gameIds.map(
        (
          gameId,
        ) =>
          gameId.trim(),
      );

    if (
      normalizedIds.some(
        (
          gameId,
        ) =>
          !gameId,
      )
    ) {
      throw new Error(
        "ID gioco non valido nell'ordinamento.",
      );
    }

    if (
      new Set(
        normalizedIds,
      ).size !==
      normalizedIds.length
    ) {
      throw new Error(
        "L'ordinamento contiene giochi duplicati.",
      );
    }

    const batch =
      writeBatch(
        db,
      );

    normalizedIds.forEach(
      (
        gameId,
        index,
      ) => {
        batch.update(
          doc(
            db,
            COLLECTION_NAME,
            gameId,
          ),
          {
            sortOrder:
              index,

            catalogVersion:
              CATALOG_VERSION,

            updatedAt:
              serverTimestamp(),
          },
        );
      },
    );

    await batch.commit();
  }

  /*
   * ==========================================================
   * BACKWARD COMPATIBILITY
   * ==========================================================
   *
   * I vecchi hook chiamavano subscribeByGamesSeason().
   * Ora il parametro season non filtra più i giochi:
   * è mantenuto soltanto per evitare rotture durante la migrazione.
   * ==========================================================
   */

  static subscribeByGamesSeason(
    _gamesSeasonId:
      string,

    onChange:
      (
        games:
          GamesGame[],
      ) => void,

    onError?:
      (
        error:
          Error,
      ) => void,
  ): Unsubscribe {
    return this.subscribeCatalog(
      onChange,
      onError,
    );
  }
}

/*
 * ============================================================
 * VALIDATION
 * ============================================================
 */

function validateCreateInput(
  input:
    CreateGamesGameInput,
): void {
  if (
    !input.name.trim()
  ) {
    throw new Error(
      "Nome gioco obbligatorio.",
    );
  }

  if (
    !normalizeSlug(
      input.slug,
    )
  ) {
    throw new Error(
      "Slug gioco obbligatorio.",
    );
  }

  validatePrice(
    input.priceCents,
  );

  validateActivation(
    input.status,
    input.activatesAt,
  );
}

function validateUpdateInput(
  input:
    UpdateGamesGameInput,
): void {
  if (
    !input.gameId.trim()
  ) {
    throw new Error(
      "gameId obbligatorio.",
    );
  }

  if (
    !input.name.trim()
  ) {
    throw new Error(
      "Nome gioco obbligatorio.",
    );
  }

  if (
    !normalizeSlug(
      input.slug,
    )
  ) {
    throw new Error(
      "Slug gioco obbligatorio.",
    );
  }

  validatePrice(
    input.priceCents,
  );

  validateActivation(
    input.status,
    input.activatesAt,
  );
}

function validatePrice(
  priceCents:
    number,
): void {
  if (
    !Number.isInteger(
      priceCents,
    ) ||
    priceCents <
      0
  ) {
    throw new Error(
      "Prezzo gioco non valido.",
    );
  }
}

function validateActivation(
  status:
    GamesGame["status"],

  activatesAt?:
    Date,
): void {
  if (
    activatesAt &&
    Number.isNaN(
      activatesAt.getTime(),
    )
  ) {
    throw new Error(
      "Data di attivazione non valida.",
    );
  }

  if (
    status !==
      "waiting" &&
    activatesAt
  ) {
    throw new Error(
      "La data di attivazione può essere impostata solo per un gioco Prossimamente.",
    );
  }
}

/*
 * ============================================================
 * CATALOG NORMALIZATION
 * ============================================================
 *
 * Durante la migrazione potrebbero esistere più documenti legacy
 * con lo stesso slug, uno per ogni vecchia Games Season.
 *
 * Il catalogo ne espone uno solo:
 * 1. preferisce catalogVersion 2;
 * 2. poi il documento aggiornato più di recente.
 * ============================================================
 */

function buildCatalogGames(
  documents:
    Array<{
      id: string;
      data:
        Record<
          string,
          unknown
        >;
    }>,
): GamesGame[] {
  const bySlug =
    new Map<
      string,
      {
        game:
          GamesGame;

        priority:
          number;

        timestamp:
          number;
      }
    >();

  for (
    const currentDocument of
    documents
  ) {
    const game =
      normalizeDocument(
        currentDocument.id,
        currentDocument.data,
      );

    if (
      !game.slug
    ) {
      continue;
    }

    const priority =
      game.catalogVersion ===
      CATALOG_VERSION
        ? 2
        : 1;

    const timestamp =
      getTimestamp(
        game.updatedAt,
      ) ||
      getTimestamp(
        game.createdAt,
      );

    const previous =
      bySlug.get(
        game.slug,
      );

    if (
      !previous ||
      priority >
        previous.priority ||
      (
        priority ===
          previous.priority &&
        timestamp >
          previous.timestamp
      )
    ) {
      bySlug.set(
        game.slug,
        {
          game,
          priority,
          timestamp,
        },
      );
    }
  }

  return Array.from(
    bySlug.values(),
  )
    .map(
      (
        entry,
      ) =>
        entry.game,
    )
    .sort(
      (
        first,
        second,
      ) => {
        const firstOrder =
          first.sortOrder ??
          Number.MAX_SAFE_INTEGER;

        const secondOrder =
          second.sortOrder ??
          Number.MAX_SAFE_INTEGER;

        if (
          firstOrder !==
          secondOrder
        ) {
          return (
            firstOrder -
            secondOrder
          );
        }

        return first.name.localeCompare(
          second.name,
          "it",
        );
      },
    );
}

function normalizeDocument(
  id:
    string,

  value:
    Record<
      string,
      unknown
    >,
): GamesGame {
  const slug =
    normalizeSlug(
      normalizeString(
        value.slug,
      ),
    );

  return {
    id,

    name:
      normalizeString(
        value.name,
      ),

    slug,

    priceCents:
      normalizePriceCents(
        value.priceCents,
      ),

    status:
      value.status ===
      "active"
        ? "active"
        : value.status ===
            "suppressed"
          ? "suppressed"
          : "waiting",

    activatesAt:
      value.activatesAt,

    gameType:
      normalizeGameType(
        value.gameType,
        slug,
      ),

    /*
     * La lettura espone già l'invariante nuovo:
     * tutti i giochi sono disponibili per tutte le competizioni.
     */
    competitionIds:
      [...GAMES_COMPETITION_IDS],

    description:
      normalizeOptionalString(
        value.description,
      ),

    sortOrder:
      normalizeSortOrder(
        value.sortOrder,
      ),

    gamesSeasonId:
      normalizeOptionalString(
        value.gamesSeasonId,
      ),

    catalogVersion:
      normalizeCatalogVersion(
        value.catalogVersion,
      ),

    createdAt:
      value.createdAt,

    updatedAt:
      value.updatedAt,
  };
}

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function createCatalogGameDocumentId(
  slug:
    string,
): string {
  return `game-${slug}`;
}

function normalizeSlug(
  value:
    string,
): string {
  return value
    .trim()
    .toLowerCase()
    .normalize(
      "NFD",
    )
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /[^a-z0-9]+/g,
      "-",
    )
    .replace(
      /^-+|-+$/g,
      "",
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

function normalizeSortOrder(
  value:
    unknown,
): number | undefined {
  const normalized =
    Number(
      value,
    );

  if (
    !Number.isInteger(
      normalized,
    ) ||
    normalized <
      0
  ) {
    return undefined;
  }

  return normalized;
}

function normalizeCatalogVersion(
  value:
    unknown,
): number | undefined {
  const normalized =
    Number(
      value,
    );

  if (
    !Number.isInteger(
      normalized,
    ) ||
    normalized <=
      0
  ) {
    return undefined;
  }

  return normalized;
}

function normalizeString(
  value:
    unknown,
): string {
  return String(
    value ??
      "",
  ).trim();
}

function normalizeOptionalString(
  value:
    unknown,
): string | undefined {
  const normalized =
    normalizeString(
      value,
    );

  return (
    normalized ||
    undefined
  );
}

function normalizeGameType(
  value:
    unknown,

  slugValue:
    unknown,
): GamesGameType {
  if (
    value ===
      "fantacalcio" ||
    value ===
      "pronostici" ||
    value ===
      "votazioni" ||
    value ===
      "quiz" ||
    value ===
      "custom"
  ) {
    return value;
  }

  const slug =
    normalizeSlug(
      normalizeString(
        slugValue,
      ),
    );

  switch (
    slug
  ) {
    case "fantacalcio":
      return "fantacalcio";

    case "pronostici":
      return "pronostici";

    case "votazioni":
      return "votazioni";

    case "quiz":
      return "quiz";

    default:
      return "custom";
  }
}

function getTimestamp(
  value:
    unknown,
): number {
  if (
    value instanceof
    Date
  ) {
    return value.getTime();
  }

  if (
    value &&
    typeof value ===
      "object" &&
    "toDate" in
      value &&
    typeof (
      value as {
        toDate?: unknown;
      }
    ).toDate ===
      "function"
  ) {
    return (
      value as {
        toDate: () => Date;
      }
    ).toDate().getTime();
  }

  return 0;
}
