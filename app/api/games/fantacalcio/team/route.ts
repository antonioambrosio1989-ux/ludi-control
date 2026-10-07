import {
  NextResponse,
} from "next/server";

import {
  createHash,
} from "node:crypto";

import {
  getAuth,
} from "firebase-admin/auth";

import {
  getApps,
  initializeApp,
} from "firebase-admin/app";

import {
  FieldValue,
  getFirestore,
} from "firebase-admin/firestore";

import {
  buildGamesGamePurchaseId,
  isActiveGamesPassData,
  isActiveSingleGamePurchaseData,
  resolveGameEntitlement,
} from "@/src/server/games/GamesEntitlementServer";

import {
  DEFAULT_FANTASY_ROSTER_RULES,
  DEFAULT_FANTASY_VISIBILITY_RULES,
} from "@/src/types/FantasySeason";

/*
 * ============================================================
 * FIREBASE ADMIN
 * ============================================================
 */

const adminApp =
  getApps().length >
  0
    ? getApps()[0]
    : initializeApp();

const adminAuth =
  getAuth(
    adminApp,
  );

const adminDb =
  getFirestore(
    adminApp,
    "default",
  );

/*
 * ============================================================
 * REQUEST
 * ============================================================
 */

type CreateFantasyTeamRequest = {
  fantasySeasonId?:
    string;

  name?:
    string;
};

/*
 * ============================================================
 * CREATE FANTASY TEAM
 * ============================================================
 */

export async function POST(
  request:
    Request,
) {
  try {
    /*
     * ========================================================
     * AUTHORIZATION
     * ========================================================
     */

    const authorizationHeader =
      request.headers.get(
        "authorization",
      );

    if (
      !authorizationHeader?.startsWith(
        "Bearer ",
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Token di autenticazione mancante.",
        },
        {
          status:
            401,
        },
      );
    }

    const idToken =
      authorizationHeader
        .slice(
          "Bearer ".length,
        )
        .trim();

    if (
      !idToken
    ) {
      return NextResponse.json(
        {
          error:
            "Token di autenticazione mancante.",
        },
        {
          status:
            401,
        },
      );
    }

    /*
     * ========================================================
     * VERIFY USER
     * ========================================================
     */

    let decodedToken;

    try {
      decodedToken =
        await adminAuth.verifyIdToken(
          idToken,
        );
    } catch (
      error
    ) {
      console.error(
        "Token Fantacalcio non valido:",
        error,
      );

      return NextResponse.json(
        {
          error:
            "Sessione non valida o scaduta.",
        },
        {
          status:
            401,
        },
      );
    }

    const userId =
      decodedToken.uid;

    let userEmail =
      decodedToken.email ??
      "";

    if (
      !userEmail
    ) {
      const userRecord =
        await adminAuth.getUser(
          userId,
        );

      userEmail =
        userRecord.email ??
        "";
    }

    if (
      !userEmail
    ) {
      return NextResponse.json(
        {
          error:
            "L'account non dispone di un indirizzo email valido.",
        },
        {
          status:
            409,
        },
      );
    }

    /*
     * ========================================================
     * BODY
     * ========================================================
     */

    let body:
      CreateFantasyTeamRequest;

    try {
      body =
        (
          await request.json()
        ) as
          CreateFantasyTeamRequest;
    } catch {
      return NextResponse.json(
        {
          error:
            "Richiesta non valida.",
        },
        {
          status:
            400,
        },
      );
    }

    const fantasySeasonId =
      body.fantasySeasonId
        ?.trim();

    const normalizedName =
      body.name
        ?.trim()
        .replace(
          /\s+/g,
          " ",
        ) ??
      "";

    /*
     * ========================================================
     * VALIDATION
     * ========================================================
     */

    if (
      !fantasySeasonId
    ) {
      return NextResponse.json(
        {
          error:
            "Stagione Fantacalcio non valida.",
        },
        {
          status:
            400,
        },
      );
    }

    if (
      normalizedName.length <
        3 ||
      normalizedName.length >
        24
    ) {
      return NextResponse.json(
        {
          error:
            "Il nome della squadra Fantasy deve contenere da 3 a 24 caratteri.",
        },
        {
          status:
            400,
        },
      );
    }

    /*
     * ========================================================
     * FANTASY SEASON
     * ========================================================
     */

    const fantasySeasonRef =
      adminDb
        .collection(
          "fantasySeasons",
        )
        .doc(
          fantasySeasonId,
        );

    const fantasySeasonSnapshot =
      await fantasySeasonRef.get();

    if (
      !fantasySeasonSnapshot.exists
    ) {
      return NextResponse.json(
        {
          error:
            "Stagione Fantacalcio non trovata.",
        },
        {
          status:
            404,
        },
      );
    }

    const fantasySeason =
      fantasySeasonSnapshot.data();

    if (
      !fantasySeason
    ) {
      return NextResponse.json(
        {
          error:
            "Configurazione Fantacalcio non disponibile.",
        },
        {
          status:
            404,
        },
      );
    }

    /*
     * ========================================================
     * ROSTERS MUST BE OPEN
     * ========================================================
     */

    if (
      fantasySeason.status !==
      "rosters_open"
    ) {
      return NextResponse.json(
        {
          error:
            "La creazione delle squadre Fantacalcio non è attualmente aperta.",
        },
        {
          status:
            409,
        },
      );
    }

    const now =
      Date.now();

    const rosterOpensAt =
      toTimestampMilliseconds(
        fantasySeason.rosterOpensAt,
      );

    const rosterClosesAt =
      toTimestampMilliseconds(
        fantasySeason.rosterClosesAt,
      );

    if (
      rosterOpensAt !==
        null &&
      now <
        rosterOpensAt
    ) {
      return NextResponse.json(
        {
          error:
            "La finestra per la creazione della squadra Fantasy non è ancora aperta.",
        },
        {
          status:
            409,
        },
      );
    }

    if (
      rosterClosesAt !==
        null &&
      now >=
        rosterClosesAt
    ) {
      return NextResponse.json(
        {
          error:
            "Il termine per creare la squadra Fantasy è scaduto.",
        },
        {
          status:
            409,
        },
      );
    }

    /*
     * ========================================================
     * GAMES SEASON
     * ========================================================
     */

    const gamesSeasonId =
      typeof fantasySeason.gamesSeasonId ===
      "string"
        ? fantasySeason.gamesSeasonId
        : "";

    if (
      !gamesSeasonId
    ) {
      return NextResponse.json(
        {
          error:
            "Stagione Games associata non valida.",
        },
        {
          status:
            409,
        },
      );
    }

    /*
     * ========================================================
     * VISIBILITY RULES
     * ========================================================
     */

    const visibilityRules = {
      ...DEFAULT_FANTASY_VISIBILITY_RULES,
      ...(fantasySeason.visibilityRules ??
        {}),
    };

    /*
     * ========================================================
     * GAMES PASS
     * ========================================================
     */

    const fantasyGameId =
      typeof fantasySeason.gameId ===
      "string"
        ? fantasySeason.gameId.trim()
        : "";

    if (
      !fantasyGameId
    ) {
      return NextResponse.json(
        {
          error:
            "Gioco Fantacalcio associato non valido.",
        },
        {
          status:
            409,
        },
      );
    }

    if (
      visibilityRules.requiresGamesPass
    ) {
      const entitlement =
        await resolveGameEntitlement({
          userId,

          gamesSeasonId,

          gameId:
            fantasyGameId,
        });

      if (
        !entitlement.hasAccess
      ) {
        return NextResponse.json(
          {
            error:
              "Per accedere al Fantacalcio serve il Games Pass oppure l’acquisto del singolo gioco.",
          },
          {
            status:
              403,
          },
        );
      }
    }

    /*
     * ========================================================
     * EXISTING USER TEAM
     * ========================================================
     */

    const existingTeamSnapshot =
      await adminDb
        .collection(
          "fantasyTeams",
        )
        .where(
          "userId",
          "==",
          userId,
        )
        .where(
          "fantasySeasonId",
          "==",
          fantasySeasonId,
        )
        .limit(
          1,
        )
        .get();

    if (
      !existingTeamSnapshot.empty
    ) {
      return NextResponse.json(
        {
          error:
            "Hai già creato una squadra per questa stagione del Fantacalcio.",
        },
        {
          status:
            409,
        },
      );
    }

    /*
     * ========================================================
     * DUPLICATE NAME
     * ========================================================
     */

    const normalizedNameKey =
      normalizedName.toLocaleLowerCase(
        "it-IT",
      );

    const nameSnapshot =
      await adminDb
        .collection(
          "fantasyTeams",
        )
        .where(
          "fantasySeasonId",
          "==",
          fantasySeasonId,
        )
        .where(
          "normalizedName",
          "==",
          normalizedNameKey,
        )
        .limit(
          1,
        )
        .get();

    if (
      !nameSnapshot.empty
    ) {
      return NextResponse.json(
        {
          error:
            "Questo nome squadra è già utilizzato nel Fantacalcio.",
        },
        {
          status:
            409,
        },
      );
    }

    /*
     * ========================================================
     * ATOMIC UNIQUENESS LOCKS
     * ========================================================
     *
     * I controlli query sopra restano utili per intercettare
     * le squadre create prima dell'introduzione dei lock.
     *
     * La garanzia contro richieste concorrenti viene invece
     * ottenuta tramite due documenti deterministici:
     *
     * - uno per utente + Fantasy Season;
     * - uno per nome normalizzato + Fantasy Season.
     *
     * Entrambi vengono letti e creati nella stessa transazione
     * che crea la squadra.
     * ========================================================
     */

    const uniquenessLocksCollection =
      adminDb.collection(
        "fantasyTeamUniquenessLocks",
      );

    const userLockRef =
      uniquenessLocksCollection.doc(
        createUniquenessLockId(
          `user|${fantasySeasonId}|${userId}`,
        ),
      );

    const nameLockRef =
      uniquenessLocksCollection.doc(
        createUniquenessLockId(
          `name|${fantasySeasonId}|${normalizedNameKey}`,
        ),
      );

    const teamRef =
      adminDb
        .collection(
          "fantasyTeams",
        )
        .doc();

    const transactionResult =
      await adminDb.runTransaction(
        async (
          transaction,
        ) => {
          /*
           * ==================================================
           * RECHECK FANTASY SEASON
           * ==================================================
           */

          const latestFantasySeasonSnapshot =
            await transaction.get(
              fantasySeasonRef,
            );

          if (
            !latestFantasySeasonSnapshot.exists
          ) {
            return {
              status:
                "season_not_found" as const,
            };
          }

          const latestFantasySeason =
            latestFantasySeasonSnapshot.data();

          if (
            !latestFantasySeason
          ) {
            return {
              status:
                "season_not_found" as const,
            };
          }

          if (
            latestFantasySeason.status !==
            "rosters_open"
          ) {
            return {
              status:
                "market_closed" as const,
            };
          }

          const latestGamesSeasonId =
            typeof latestFantasySeason
              .gamesSeasonId ===
            "string"
              ? latestFantasySeason
                  .gamesSeasonId
              : "";

          if (
            !latestGamesSeasonId ||
            latestGamesSeasonId !==
              gamesSeasonId
          ) {
            return {
              status:
                "invalid_games_season" as const,
            };
          }

          const latestFantasyGameId =
            typeof latestFantasySeason.gameId ===
            "string"
              ? latestFantasySeason.gameId.trim()
              : "";

          if (
            !latestFantasyGameId ||
            latestFantasyGameId !==
              fantasyGameId
          ) {
            return {
              status:
                "invalid_game" as const,
            };
          }

          const transactionNow =
            Date.now();

          const latestRosterOpensAt =
            toTimestampMilliseconds(
              latestFantasySeason.rosterOpensAt,
            );

          const latestRosterClosesAt =
            toTimestampMilliseconds(
              latestFantasySeason.rosterClosesAt,
            );

          if (
            latestRosterOpensAt !==
              null &&
            transactionNow <
              latestRosterOpensAt
          ) {
            return {
              status:
                "roster_not_open" as const,
            };
          }

          if (
            latestRosterClosesAt !==
              null &&
            transactionNow >=
              latestRosterClosesAt
          ) {
            return {
              status:
                "roster_closed" as const,
            };
          }

          /*
           * ==================================================
           * RECHECK GAMES PASS
           * ==================================================
           */

          const latestVisibilityRules = {
            ...DEFAULT_FANTASY_VISIBILITY_RULES,

            ...(latestFantasySeason
              .visibilityRules ??
              {}),
          };

          if (
            latestVisibilityRules
              .requiresGamesPass
          ) {
            const gameRef =
              adminDb
                .collection(
                  "gamesGames",
                )
                .doc(
                  latestFantasyGameId,
                );

            const latestGameSnapshot =
              await transaction.get(
                gameRef,
              );

            if (
              !latestGameSnapshot.exists
            ) {
              return {
                status:
                  "invalid_game" as const,
              };
            }

            const latestGamePriceCents =
              Math.max(
                0,
                Math.floor(
                  Number(
                    latestGameSnapshot.data()
                      ?.priceCents ??
                      0,
                  ) ||
                    0,
                ),
              );

            if (
              latestGamePriceCents >
              0
            ) {
              const subscriptionRef =
                adminDb
                  .collection(
                    "gamesSubscriptions",
                  )
                  .doc(
                    `${userId}-${latestGamesSeasonId}`,
                  );

              const purchaseRef =
                adminDb
                  .collection(
                    "gamesGamePurchases",
                  )
                  .doc(
                    buildGamesGamePurchaseId({
                      userId,

                      gamesSeasonId:
                        latestGamesSeasonId,

                      gameId:
                        latestFantasyGameId,
                    }),
                  );

              const latestSubscriptionSnapshot =
                await transaction.get(
                  subscriptionRef,
                );

              const latestPurchaseSnapshot =
                await transaction.get(
                  purchaseRef,
                );

              const hasGamesPass =
                isActiveGamesPassData(
                  latestSubscriptionSnapshot.data(),
                );

              const hasSingleGamePurchase =
                isActiveSingleGamePurchaseData(
                  latestPurchaseSnapshot.data(),
                );

              if (
                !hasGamesPass &&
                !hasSingleGamePurchase
              ) {
                return {
                  status:
                    "games_access_required" as const,
                };
              }
            }
          }

          /*
           * ==================================================
           * USER UNIQUENESS LOCK
           * ==================================================
           */

          const userLockSnapshot =
            await transaction.get(
              userLockRef,
            );

          if (
            userLockSnapshot.exists
          ) {
            const userLock =
              userLockSnapshot.data();

            const existingFantasyTeamId =
              typeof userLock
                ?.fantasyTeamId ===
              "string"
                ? userLock.fantasyTeamId
                : "";

            const existingNormalizedName =
              typeof userLock
                ?.normalizedName ===
              "string"
                ? userLock.normalizedName
                : "";

            /*
             * Una ripetizione della stessa identica richiesta
             * viene trattata in modo idempotente.
             */

            if (
              existingFantasyTeamId &&
              existingNormalizedName ===
                normalizedNameKey
            ) {
              const existingTeamRef =
                adminDb
                  .collection(
                    "fantasyTeams",
                  )
                  .doc(
                    existingFantasyTeamId,
                  );

              const existingTeamSnapshot =
                await transaction.get(
                  existingTeamRef,
                );

              const existingTeam =
                existingTeamSnapshot.exists
                  ? existingTeamSnapshot.data()
                  : null;

              if (
                existingTeam &&
                existingTeam.userId ===
                  userId &&
                existingTeam.fantasySeasonId ===
                  fantasySeasonId
              ) {
                return {
                  status:
                    "already_created" as const,

                  fantasyTeamId:
                    existingFantasyTeamId,

                  name:
                    String(
                      existingTeam.name ??
                        normalizedName,
                    ),

                  budget:
                    Number(
                      existingTeam.budget ??
                        DEFAULT_FANTASY_ROSTER_RULES
                          .initialBudget,
                    ),

                  teamStatus:
                    String(
                      existingTeam.status ??
                        "draft",
                    ),
                };
              }
            }

            return {
              status:
                "user_team_exists" as const,
            };
          }

          /*
           * ==================================================
           * NAME UNIQUENESS LOCK
           * ==================================================
           */

          const nameLockSnapshot =
            await transaction.get(
              nameLockRef,
            );

          if (
            nameLockSnapshot.exists
          ) {
            return {
              status:
                "name_taken" as const,
            };
          }

          /*
           * ==================================================
           * LATEST ROSTER RULES
           * ==================================================
           */

          const latestRosterRules = {
            ...DEFAULT_FANTASY_ROSTER_RULES,

            ...(latestFantasySeason
              .rosterRules ??
              {}),
          };

          const initialBudget =
            Number(
              latestRosterRules
                .initialBudget,
            );

          if (
            !Number.isFinite(
              initialBudget,
            ) ||
            initialBudget <
              0
          ) {
            return {
              status:
                "invalid_budget" as const,
            };
          }

          /*
           * ==================================================
           * CREATE TEAM + LOCKS
           * ==================================================
           */

          const teamData = {
            fantasySeasonId,

            gamesSeasonId:
              latestGamesSeasonId,

            userId,

            userEmail:
              userEmail.trim(),

            name:
              normalizedName,

            normalizedName:
              normalizedNameKey,

            status:
              "draft",

            roster:
              [],

            budget:
              initialBudget,

            spentCredits:
              0,

            remainingCredits:
              initialBudget,

            isRosterValid:
              false,

            isEligible:
              false,

            registeredAt:
              FieldValue.serverTimestamp(),

            rosterLockedAt:
              null,

            suspendedAt:
              null,

            frozenAt:
              null,

            reactivatedAt:
              null,

            completedAt:
              null,

            createdAt:
              FieldValue.serverTimestamp(),

            updatedAt:
              FieldValue.serverTimestamp(),
          };

          transaction.set(
            teamRef,
            teamData,
          );

          transaction.set(
            userLockRef,
            {
              type:
                "user",

              fantasySeasonId,

              userId,

              fantasyTeamId:
                teamRef.id,

              normalizedName:
                normalizedNameKey,

              createdAt:
                FieldValue.serverTimestamp(),
            },
          );

          transaction.set(
            nameLockRef,
            {
              type:
                "name",

              fantasySeasonId,

              normalizedName:
                normalizedNameKey,

              fantasyTeamId:
                teamRef.id,

              userId,

              createdAt:
                FieldValue.serverTimestamp(),
            },
          );

          return {
            status:
              "created" as const,

            fantasyTeamId:
              teamRef.id,

            name:
              normalizedName,

            budget:
              initialBudget,

            teamStatus:
              "draft",
          };
        },
      );

    /*
     * ========================================================
     * TRANSACTION RESULT
     * ========================================================
     */

    if (
      transactionResult.status ===
      "season_not_found"
    ) {
      return NextResponse.json(
        {
          error:
            "Stagione Fantacalcio non trovata.",
        },
        {
          status:
            404,
        },
      );
    }

    if (
      transactionResult.status ===
      "market_closed"
    ) {
      return NextResponse.json(
        {
          error:
            "La creazione delle squadre Fantacalcio non è attualmente aperta.",
        },
        {
          status:
            409,
        },
      );
    }

    if (
      transactionResult.status ===
      "invalid_games_season"
    ) {
      return NextResponse.json(
        {
          error:
            "Stagione Games associata non valida.",
        },
        {
          status:
            409,
        },
      );
    }

    if (
      transactionResult.status ===
      "invalid_game"
    ) {
      return NextResponse.json(
        {
          error:
            "Gioco Fantacalcio associato non valido.",
        },
        {
          status:
            409,
        },
      );
    }

    if (
      transactionResult.status ===
      "roster_not_open"
    ) {
      return NextResponse.json(
        {
          error:
            "La finestra per la creazione della squadra Fantasy non è ancora aperta.",
        },
        {
          status:
            409,
        },
      );
    }

    if (
      transactionResult.status ===
      "roster_closed"
    ) {
      return NextResponse.json(
        {
          error:
            "Il termine per creare la squadra Fantasy è scaduto.",
        },
        {
          status:
            409,
        },
      );
    }

    if (
      transactionResult.status ===
      "games_access_required"
    ) {
      return NextResponse.json(
        {
          error:
            "Per accedere al Fantacalcio serve il Games Pass oppure l’acquisto del singolo gioco.",
        },
        {
          status:
            403,
        },
      );
    }

    if (
      transactionResult.status ===
      "user_team_exists"
    ) {
      return NextResponse.json(
        {
          error:
            "Hai già creato una squadra per questa stagione del Fantacalcio.",
        },
        {
          status:
            409,
        },
      );
    }

    if (
      transactionResult.status ===
      "name_taken"
    ) {
      return NextResponse.json(
        {
          error:
            "Questo nome squadra è già utilizzato nel Fantacalcio.",
        },
        {
          status:
            409,
        },
      );
    }

    if (
      transactionResult.status ===
      "invalid_budget"
    ) {
      return NextResponse.json(
        {
          error:
            "Il budget iniziale del Fantacalcio non è valido.",
        },
        {
          status:
            409,
        },
      );
    }

    if (
      transactionResult.status ===
      "already_created"
    ) {
      return NextResponse.json(
        {
          fantasyTeamId:
            transactionResult.fantasyTeamId,

          name:
            transactionResult.name,

          budget:
            transactionResult.budget,

          status:
            transactionResult.teamStatus,

          reused:
            true,
        },
        {
          status:
            200,
        },
      );
    }

    /*
     * ========================================================
     * RESPONSE
     * ========================================================
     */

    return NextResponse.json(
      {
        fantasyTeamId:
          transactionResult.fantasyTeamId,

        name:
          transactionResult.name,

        budget:
          transactionResult.budget,

        status:
          transactionResult.teamStatus,

        reused:
          false,
      },
      {
        status:
          201,
      },
    );
  } catch (
    error
  ) {
    console.error(
      "Errore creazione squadra Fantacalcio:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Impossibile creare la squadra Fantacalcio.",
      },
      {
        status:
          500,
      },
    );
  }
}

/*
 * ============================================================
 * UNIQUENESS LOCK ID
 * ============================================================
 */

function createUniquenessLockId(
  value:
    string,
): string {
  return createHash(
    "sha256",
  )
    .update(
      value,
      "utf8",
    )
    .digest(
      "hex",
    );
}

/*
 * ============================================================
 * TIMESTAMP TO MILLISECONDS
 * ============================================================
 */

function toTimestampMilliseconds(
  value:
    unknown,
): number | null {
  if (
    !value
  ) {
    return null;
  }

  if (
    value instanceof
    Date
  ) {
    const milliseconds =
      value.getTime();

    return Number.isFinite(
      milliseconds,
    )
      ? milliseconds
      : null;
  }

  if (
    typeof value ===
      "object" &&
    value !==
      null &&
    "toDate" in
      value &&
    typeof (
      value as {
        toDate?:
          unknown;
      }
    ).toDate ===
      "function"
  ) {
    const date =
      (
        value as {
          toDate:
            () => Date;
        }
      ).toDate();

    const milliseconds =
      date.getTime();

    return Number.isFinite(
      milliseconds,
    )
      ? milliseconds
      : null;
  }

  if (
    typeof value ===
      "object" &&
    value !==
      null &&
    "seconds" in
      value
  ) {
    const seconds =
      Number(
        (
          value as {
            seconds?:
              unknown;
          }
        ).seconds,
      );

    if (
      Number.isFinite(
        seconds,
      )
    ) {
      return seconds *
        1000;
    }
  }

  return null;
}

