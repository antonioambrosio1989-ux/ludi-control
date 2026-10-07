import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  NextResponse,
} from "next/server";

const mocks =
  vi.hoisted(
    () => ({
      requireGamesApiAccess:
        vi.fn(),

      collection:
        vi.fn(),

      runTransaction:
        vi.fn(),

      transactionGet:
        vi.fn(),

      transactionSet:
        vi.fn(),

      documentSet:
        vi.fn(),

      documentDelete:
        vi.fn(),

      createCheckoutSession:
        vi.fn(),

      resolveCurrentPrice:
        vi.fn(),
    }),
  );

vi.mock(
  "@/src/lib/firebaseAdmin",
  () => ({
    adminDb: {
      collection:
        mocks.collection,

      runTransaction:
        mocks.runTransaction,
    },
  }),
);

vi.mock(
  "@/src/lib/requireGamesApiAccess",
  () => ({
    requireGamesApiAccess:
      mocks.requireGamesApiAccess,
  }),
);

vi.mock(
  "@/src/lib/stripe",
  () => ({
    stripe: {
      checkout: {
        sessions: {
          create:
            mocks.createCheckoutSession,
        },
      },
    },
  }),
);

vi.mock(
  "@/src/services/games/GamesPassPricingService",
  () => ({
    resolveCurrentGamesPassPrice:
      mocks.resolveCurrentPrice,
  }),
);

vi.mock(
  "@/src/server/games/GamesEntitlementServer",
  () => ({
    buildGamesCheckoutLockId:
      ({
        userId,
        gamesSeasonId,
        purchaseType,
        gameId,
      }: {
        userId: string;
        gamesSeasonId: string;
        purchaseType:
          | "games_pass"
          | "single_game";
        gameId?: string | null;
      }) =>
        purchaseType ===
          "games_pass"
          ? `${userId}-${gamesSeasonId}`
          : `single__${userId}__${gamesSeasonId}__${gameId ?? ""}`,

    buildGamesGamePurchaseId:
      ({
        userId,
        gamesSeasonId,
        gameId,
      }: {
        userId: string;
        gamesSeasonId: string;
        gameId: string;
      }) =>
        `${userId}__${gamesSeasonId}__${gameId}`,

    isActiveGamesPassData:
      (
        value:
          Record<string, unknown> |
          undefined,
      ) =>
        Boolean(
          value &&
            (
              value.status ===
                "active" ||
              value.active ===
                true
            ),
        ),

    isActiveSingleGamePurchaseData:
      (
        value:
          Record<string, unknown> |
          undefined,
      ) =>
        Boolean(
          value &&
            value.status ===
              "active",
        ),
  }),
);

import {
  POST,
} from "./route";

/*
 * ============================================================
 * TEST TYPES
 * ============================================================
 */

type MockDocumentReference = {
  __collectionName:
    string;

  __documentId:
    string;

  get:
    ReturnType<
      typeof vi.fn
    >;

  set:
    ReturnType<
      typeof vi.fn
    >;

  delete:
    ReturnType<
      typeof vi.fn
    >;
};

type MockFirestoreDocumentsOptions = {
  gamesSeasonExists?:
    boolean;

  gamesSeasonData?:
    Record<
      string,
      unknown
    >;

  subscriptionExists?:
    boolean;

  subscriptionData?:
    Record<
      string,
      unknown
    >;

  checkoutLockExists?:
    boolean;

  checkoutLockData?:
    Record<
      string,
      unknown
    >;
};

/*
 * ============================================================
 * REQUEST
 * ============================================================
 */

function createRequest(
  body:
    unknown,

  token?:
    string,
): Request {
  const headers =
    new Headers({
      "Content-Type":
        "application/json",
    });

  if (
    token
  ) {
    headers.set(
      "Authorization",
      `Bearer ${token}`,
    );
  }

  return new Request(
    "https://ludi.example/api/games/checkout",
    {
      method:
        "POST",

      headers,

      body:
        JSON.stringify(
          body,
        ),
    },
  );
}

/*
 * ============================================================
 * SNAPSHOT
 * ============================================================
 */

function createSnapshot(
  exists:
    boolean,

  data?:
    Record<
      string,
      unknown
    >,
) {
  return {
    exists,

    data: () =>
      data,
  };
}

/*
 * ============================================================
 * FIRESTORE MOCK
 * ============================================================
 */

function mockFirestoreDocuments({
  gamesSeasonExists = true,

  gamesSeasonData = {
    name:
      "Games 2026/27",

    status:
      "active",

    passPricing:
      [],
  },

  subscriptionExists = false,

  subscriptionData = undefined,

  checkoutLockExists = false,

  checkoutLockData = undefined,
}: MockFirestoreDocumentsOptions = {}) {
  function createDocumentReference(
    collectionName:
      string,

    documentId:
      string,
  ): MockDocumentReference {
    const reference:
      MockDocumentReference = {
        __collectionName:
          collectionName,

        __documentId:
          documentId,

        get:
          vi.fn(),

        set:
          mocks.documentSet,

        delete:
          mocks.documentDelete,
      };

    reference.get.mockImplementation(
      async () => {
        if (
          collectionName ===
          "gamesSeasons"
        ) {
          return createSnapshot(
            gamesSeasonExists,
            gamesSeasonData,
          );
        }

        if (
          collectionName ===
          "gamesSubscriptions"
        ) {
          expect(
            documentId,
          ).toBe(
            "user-1-games-season-1",
          );

          return createSnapshot(
            subscriptionExists,
            subscriptionData,
          );
        }

        if (
          collectionName ===
          "gamesCheckoutLocks"
        ) {
          expect(
            documentId,
          ).toBe(
            "user-1-games-season-1",
          );

          return createSnapshot(
            checkoutLockExists,
            checkoutLockData,
          );
        }

        throw new Error(
          `Collection inattesa nel test: ${collectionName}`,
        );
      },
    );

    return reference;
  }

  mocks.collection.mockImplementation(
    (
      collectionName:
        string,
    ) => ({
      doc: (
        documentId:
          string,
      ) =>
        createDocumentReference(
          collectionName,
          documentId,
        ),
    }),
  );

  mocks.transactionGet.mockImplementation(
    async (
      reference:
        MockDocumentReference,
    ) => {
      if (
        reference.__collectionName ===
        "gamesSubscriptions"
      ) {
        return createSnapshot(
          subscriptionExists,
          subscriptionData,
        );
      }

      if (
        reference.__collectionName ===
        "gamesCheckoutLocks"
      ) {
        return createSnapshot(
          checkoutLockExists,
          checkoutLockData,
        );
      }

      throw new Error(
        `Documento inatteso nella transaction: ${reference.__collectionName}/${reference.__documentId}`,
      );
    },
  );

  mocks.runTransaction.mockImplementation(
    async (
      callback:
        (
          transaction:
            {
              get:
                typeof mocks.transactionGet;

              set:
                typeof mocks.transactionSet;
            },
        ) => Promise<
          unknown
        >,
    ) =>
      callback({
        get:
          mocks.transactionGet,

        set:
          mocks.transactionSet,
      }),
  );
}

/*
 * ============================================================
 * BEFORE EACH
 * ============================================================
 */

beforeEach(
  () => {
    vi.clearAllMocks();

    mocks.requireGamesApiAccess.mockImplementation(
      async (
        request:
          Request,
      ) => {
        const authorizationHeader =
          request.headers.get(
            "authorization",
          );

        /*
         * Il vero helper gestisce autenticazione e
         * maintenance mode.
         *
         * In questo test della route simuliamo soltanto
         * il suo risultato.
         */

        if (
          !authorizationHeader?.startsWith(
            "Bearer ",
          )
        ) {
          return {
            ok:
              false,

            response:
              NextResponse.json(
                {
                  error:
                    "Autenticazione richiesta.",
                },
                {
                  status:
                    401,
                },
              ),
          };
        }

        return {
          ok:
            true,

          decodedToken: {
            uid:
              "user-1",

            email:
              "user@example.com",
          },
        };
      },
    );

    mocks.resolveCurrentPrice.mockReturnValue({
      id:
        "standard",

      name:
        "Standard Pass",

      priceCents:
        1199,

      startsAt:
        new Date(
          "2026-08-01T00:00:00",
        ),
    });

    mocks.createCheckoutSession.mockResolvedValue({
      id:
        "cs_test_123",

      url:
        "https://checkout.stripe.com/test",

      expires_at:
        Math.floor(
          Date.now() /
            1000,
        ) +
        1800,
    });

    mocks.documentSet.mockResolvedValue(
      undefined,
    );

    mocks.documentDelete.mockResolvedValue(
      undefined,
    );

    mocks.transactionSet.mockReturnValue(
      undefined,
    );

    mockFirestoreDocuments();
  },
);

/*
 * ============================================================
 * TESTS
 * ============================================================
 */

describe(
  "POST /api/games/checkout",
  () => {
    /*
     * ========================================================
     * AUTHENTICATION
     * ========================================================
     */

    it(
      "rifiuta una richiesta senza Firebase ID Token",
      async () => {
        const response =
          await POST(
            createRequest({
              gamesSeasonId:
                "games-season-1",
            }),
          );

        expect(
          response.status,
        ).toBe(
          401,
        );

        expect(
          mocks.runTransaction,
        ).not.toHaveBeenCalled();

        expect(
          mocks.createCheckoutSession,
        ).not.toHaveBeenCalled();
      },
    );

    /*
     * ========================================================
     * MAINTENANCE MODE
     * ========================================================
     */

    it(
      "blocca un utente normale quando Games è in manutenzione",
      async () => {
        mocks.requireGamesApiAccess.mockResolvedValueOnce({
          ok:
            false,

          response:
            NextResponse.json(
              {
                error:
                  "Games temporaneamente non disponibili.",

                code:
                  "GAMES_MAINTENANCE",
              },
              {
                status:
                  503,
              },
            ),
        });

        const response =
          await POST(
            createRequest(
              {
                gamesSeasonId:
                  "games-season-1",
              },
              "valid-user-token",
            ),
          );

        const data =
          await response.json();

        expect(
          response.status,
        ).toBe(
          503,
        );

        expect(
          data,
        ).toMatchObject({
          code:
            "GAMES_MAINTENANCE",
        });

        expect(
          mocks.runTransaction,
        ).not.toHaveBeenCalled();

        expect(
          mocks.createCheckoutSession,
        ).not.toHaveBeenCalled();
      },
    );

    /*
     * ========================================================
     * ACTIVE SUBSCRIPTION
     * ========================================================
     */

    it(
      "blocca un secondo acquisto se il Games Pass della stagione è già attivo",
      async () => {
        mockFirestoreDocuments({
          subscriptionExists:
            true,

          subscriptionData: {
            status:
              "active",
          },
        });

        const response =
          await POST(
            createRequest(
              {
                gamesSeasonId:
                  "games-season-1",
              },
              "valid-token",
            ),
          );

        const data =
          await response.json();

        expect(
          response.status,
        ).toBe(
          409,
        );

        expect(
          data.error,
        ).toContain(
          "già attivo",
        );

        expect(
          mocks.runTransaction,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          mocks.createCheckoutSession,
        ).not.toHaveBeenCalled();
      },
    );

    /*
     * ========================================================
     * CREATE CHECKOUT
     * ========================================================
     */

    it(
      "crea il checkout se non esiste un Games Pass attivo né un checkout valido",
      async () => {
        const response =
          await POST(
            createRequest(
              {
                gamesSeasonId:
                  "games-season-1",
              },
              "valid-token",
            ),
          );

        const data =
          await response.json();

        expect(
          response.status,
        ).toBe(
          200,
        );

        expect(
          data,
        ).toMatchObject({
          checkoutUrl:
            "https://checkout.stripe.com/test",

          sessionId:
            "cs_test_123",

          reused:
            false,
        });

        /*
         * Una sola transaction acquisisce il lock
         * dell'acquisto.
         */

        expect(
          mocks.runTransaction,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          mocks.transactionSet,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          mocks.transactionSet,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            __collectionName:
              "gamesCheckoutLocks",

            __documentId:
              "user-1-games-season-1",
          }),

          expect.objectContaining({
            userId:
              "user-1",

            gamesSeasonId:
              "games-season-1",

            status:
              "creating",

            attemptId:
              expect.any(
                String,
              ),
          }),
        );

        /*
         * Stripe viene chiamato una sola volta.
         */

        expect(
          mocks.createCheckoutSession,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          mocks.createCheckoutSession,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            client_reference_id:
              "user-1",

            customer_email:
              "user@example.com",

            metadata:
              expect.objectContaining({
                gamesSeasonId:
                  "games-season-1",

                userId:
                  "user-1",

                priceCents:
                  "1199",

                purchaseType:
                  "games_pass",

                checkoutAttemptId:
                  expect.any(
                    String,
                  ),
              }),
          }),

          expect.objectContaining({
            idempotencyKey:
              expect.stringMatching(
                /^games-pass-/,
              ),
          }),
        );

        /*
         * Al termine il lock viene aggiornato con
         * la Checkout Session creata.
         */

        expect(
          mocks.documentSet,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            userId:
              "user-1",

            gamesSeasonId:
              "games-season-1",

            status:
              "ready",

            checkoutSessionId:
              "cs_test_123",

            checkoutUrl:
              "https://checkout.stripe.com/test",
          }),

          {
            merge:
              true,
          },
        );
      },
    );

    /*
     * ========================================================
     * REUSE CHECKOUT
     * ========================================================
     */

    it(
      "riutilizza una Checkout Session già pronta e ancora valida",
      async () => {
        mockFirestoreDocuments({
          checkoutLockExists:
            true,

          checkoutLockData: {
            userId:
              "user-1",

            gamesSeasonId:
              "games-season-1",

            attemptId:
              "attempt-existing",

            status:
              "ready",

            checkoutSessionId:
              "cs_existing_123",

            checkoutUrl:
              "https://checkout.stripe.com/existing",

            expiresAtMs:
              Date.now() +
              60_000,

            createdAtMs:
              Date.now() -
              10_000,

            updatedAtMs:
              Date.now() -
              5_000,
          },
        });

        const response =
          await POST(
            createRequest(
              {
                gamesSeasonId:
                  "games-season-1",
              },
              "valid-token",
            ),
          );

        const data =
          await response.json();

        expect(
          response.status,
        ).toBe(
          200,
        );

        expect(
          data,
        ).toEqual({
          checkoutUrl:
            "https://checkout.stripe.com/existing",

          sessionId:
            "cs_existing_123",

          reused:
            true,
        });

        /*
         * Nessuna nuova Checkout Session deve
         * essere creata.
         */

        expect(
          mocks.createCheckoutSession,
        ).not.toHaveBeenCalled();

        expect(
          mocks.transactionSet,
        ).not.toHaveBeenCalled();

        expect(
          mocks.documentSet,
        ).not.toHaveBeenCalled();
      },
    );

    /*
     * ========================================================
     * CHECKOUT ALREADY CREATING
     * ========================================================
     */

    it(
      "blocca un secondo checkout mentre una creazione è già in corso",
      async () => {
        mockFirestoreDocuments({
          checkoutLockExists:
            true,

          checkoutLockData: {
            userId:
              "user-1",

            gamesSeasonId:
              "games-season-1",

            attemptId:
              "attempt-in-progress",

            status:
              "creating",

            expiresAtMs:
              Date.now() +
              60_000,

            createdAtMs:
              Date.now() -
              1_000,

            updatedAtMs:
              Date.now() -
              1_000,
          },
        });

        const response =
          await POST(
            createRequest(
              {
                gamesSeasonId:
                  "games-season-1",
              },
              "valid-token",
            ),
          );

        const data =
          await response.json();

        expect(
          response.status,
        ).toBe(
          409,
        );

        expect(
          data.error,
        ).toContain(
          "già in corso",
        );

        expect(
          mocks.createCheckoutSession,
        ).not.toHaveBeenCalled();

        expect(
          mocks.transactionSet,
        ).not.toHaveBeenCalled();
      },
    );
  },
);