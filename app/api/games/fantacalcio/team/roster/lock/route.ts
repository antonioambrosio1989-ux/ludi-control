import {
  NextResponse,
} from "next/server";

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
  resolveGameEntitlement,
} from "@/src/server/games/GamesEntitlementServer";

import {
  DEFAULT_FANTASY_ROSTER_RULES,
  DEFAULT_FANTASY_VISIBILITY_RULES,
} from "@/src/types/FantasySeason";

import type {
  FantasyRole,
} from "@/src/types/FantasySeason";

import type {
  FantasyRosterPlayer,
  FantasyRosterValidationIssue,
} from "@/src/types/FantasyTeam";

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

type LockFantasyRosterRequest = {
  fantasyTeamId?:
    string;
};

/*
 * ============================================================
 * SERVER PLAYER
 * ============================================================
 */

type ServerFantasyPlayer = {
  id:
    string;

  fantasySeasonId:
    string;

  playerSeasonCode:
    string;

  teamCode:
    string;

  firstName:
    string;

  lastName:
    string;

  displayName:
    string;

  role:
    FantasyRole;

  cost:
    number;

  availabilityStatus:
    string;
};

/*
 * ============================================================
 * LOCK FANTASY ROSTER
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

    /*
     * ========================================================
     * BODY
     * ========================================================
     */

    let body:
      LockFantasyRosterRequest;

    try {
      body =
        (
          await request.json()
        ) as
          LockFantasyRosterRequest;
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

    const fantasyTeamId =
      body.fantasyTeamId
        ?.trim();

    if (
      !fantasyTeamId
    ) {
      return NextResponse.json(
        {
          error:
            "Squadra Fantacalcio non valida.",
        },
        {
          status:
            400,
        },
      );
    }

    /*
     * ========================================================
     * TEAM
     * ========================================================
     */

    const teamRef =
      adminDb
        .collection(
          "fantasyTeams",
        )
        .doc(
          fantasyTeamId,
        );

    const teamSnapshot =
      await teamRef.get();

    if (
      !teamSnapshot.exists
    ) {
      return NextResponse.json(
        {
          error:
            "Squadra Fantasy non trovata.",
        },
        {
          status:
            404,
        },
      );
    }

    const team =
      teamSnapshot.data();

    if (
      !team
    ) {
      return NextResponse.json(
        {
          error:
            "Dati della squadra Fantasy non disponibili.",
        },
        {
          status:
            404,
        },
      );
    }

    /*
     * ========================================================
     * OWNERSHIP
     * ========================================================
     */

    if (
      team.userId !==
      userId
    ) {
      return NextResponse.json(
        {
          error:
            "Non sei autorizzato a confermare questa squadra.",
        },
        {
          status:
            403,
        },
      );
    }

    /*
     * ========================================================
     * ALREADY LOCKED
     * ========================================================
     */

    if (
      team.rosterLockedAt
    ) {
      return NextResponse.json(
        {
          fantasyTeamId,

          locked:
            true,

          status:
            team.status,

          message:
            "La rosa del Fantacalcio è già stata confermata.",
        },
        {
          status:
            200,
        },
      );
    }

    /*
     * ========================================================
     * TEAM STATUS
     * ========================================================
     */

    if (
      team.status ===
        "suspended" ||
      team.status ===
        "frozen" ||
      team.status ===
        "completed"
    ) {
      return NextResponse.json(
        {
          error:
            "La squadra non può essere confermata nello stato attuale.",
        },
        {
          status:
            409,
        },
      );
    }

    /*
     * ========================================================
     * FANTASY SEASON ID
     * ========================================================
     */

    const fantasySeasonId =
      typeof team.fantasySeasonId ===
      "string"
        ? team.fantasySeasonId
        : "";

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
            409,
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
     * ROSTER WINDOW
     * ========================================================
     */

    if (
      fantasySeason.status !==
      "rosters_open"
    ) {
      return NextResponse.json(
        {
          error:
            "La conferma delle rose non è attualmente disponibile.",
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
            "La finestra per la composizione della rosa non è ancora aperta.",
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
            "Il termine per confermare la rosa è scaduto.",
        },
        {
          status:
            409,
        },
      );
    }

    /*
     * ========================================================
     * RULES
     * ========================================================
     */

    const rosterRules = {
      ...DEFAULT_FANTASY_ROSTER_RULES,
      ...(fantasySeason.rosterRules ??
        {}),
    };

    const visibilityRules = {
      ...DEFAULT_FANTASY_VISIBILITY_RULES,
      ...(fantasySeason.visibilityRules ??
        {}),
    };

    /*
     * ========================================================
     * GAMES SEASON
     * ========================================================
     */

    const gamesSeasonId =
      typeof team.gamesSeasonId ===
      "string"
        ? team.gamesSeasonId
        : "";

    if (
      !gamesSeasonId ||
      gamesSeasonId !==
        fantasySeason.gamesSeasonId
    ) {
      return NextResponse.json(
        {
          error:
            "Associazione con la stagione Games non valida.",
        },
        {
          status:
            409,
        },
      );
    }

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
     * PUBLISHED PLAYER POOL
     * ========================================================
     */

    const poolSnapshot =
      await adminDb
        .collection(
          "fantasyPlayerPools",
        )
        .where(
          "fantasySeasonId",
          "==",
          fantasySeasonId,
        )
        .where(
          "status",
          "==",
          "published",
        )
        .limit(
          1,
        )
        .get();

    if (
      poolSnapshot.empty
    ) {
      return NextResponse.json(
        {
          error:
            "Il Listone ufficiale del Fantacalcio non è disponibile.",
        },
        {
          status:
            409,
        },
      );
    }

    /*
     * ========================================================
     * CURRENT ROSTER
     * ========================================================
     */

    const currentRoster =
      Array.isArray(
        team.roster,
      )
        ? team.roster
        : [];

    const fantasyPlayerIds =
      currentRoster
        .map(
          (
            player,
          ) =>
            typeof player?.fantasyPlayerId ===
            "string"
              ? player.fantasyPlayerId.trim()
              : "",
        )
        .filter(
          Boolean,
        );

    /*
     * ========================================================
     * DUPLICATE IDS
     * ========================================================
     */

    const uniquePlayerIds =
      [
        ...new Set(
          fantasyPlayerIds,
        ),
      ];

    if (
      uniquePlayerIds.length !==
      fantasyPlayerIds.length
    ) {
      return NextResponse.json(
        {
          error:
            "La rosa contiene giocatori duplicati.",
        },
        {
          status:
            409,
        },
      );
    }

    /*
     * ========================================================
     * ROSTER SIZE PRECHECK
     * ========================================================
     */

    if (
      uniquePlayerIds.length !==
      rosterRules.rosterSize
    ) {
      return NextResponse.json(
        {
          error:
            `La rosa deve contenere esattamente ${rosterRules.rosterSize} giocatori.`,

          validation: {
            isValid:
              false,

            playerCount:
              uniquePlayerIds.length,

            expectedPlayerCount:
              rosterRules.rosterSize,
          },
        },
        {
          status:
            409,
        },
      );
    }

    /*
     * ========================================================
     * LOAD TRUSTED PLAYERS
     * ========================================================
     */

    const playerSnapshots =
      await Promise.all(
        uniquePlayerIds.map(
          (
            fantasyPlayerId,
          ) =>
            adminDb
              .collection(
                "fantasyPlayers",
              )
              .doc(
                fantasyPlayerId,
              )
              .get(),
        ),
      );

    if (
      playerSnapshots.some(
        (
          snapshot,
        ) =>
          !snapshot.exists,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Uno o più giocatori della rosa non esistono più nel Listone.",
        },
        {
          status:
            409,
        },
      );
    }

    /*
     * ========================================================
     * NORMALIZE TRUSTED PLAYERS
     * ========================================================
     */

    const players:
      ServerFantasyPlayer[] =
      [];

    for (
      const snapshot
      of playerSnapshots
    ) {
      const data =
        snapshot.data();

      if (
        !data
      ) {
        return NextResponse.json(
          {
            error:
              "Dati di uno o più giocatori non disponibili.",
          },
          {
            status:
              409,
          },
        );
      }

      const role =
        data.role;

      if (
        role !==
          "goalkeeper" &&
        role !==
          "defender" &&
        role !==
          "forward"
      ) {
        return NextResponse.json(
          {
            error:
              "Il ruolo di uno o più giocatori non è valido.",
          },
          {
            status:
              409,
          },
        );
      }

      const cost =
        Number(
          data.cost,
        );

      if (
        !Number.isFinite(
          cost,
        ) ||
        cost <
          0
      ) {
        return NextResponse.json(
          {
            error:
              "Il costo di uno o più giocatori non è valido.",
          },
          {
            status:
              409,
          },
        );
      }

      players.push({
        id:
          snapshot.id,

        fantasySeasonId:
          String(
            data.fantasySeasonId ??
              "",
          ),

        playerSeasonCode:
          String(
            data.playerSeasonCode ??
              "",
          ),

        teamCode:
          String(
            data.teamCode ??
              "",
          ),

        firstName:
          String(
            data.firstName ??
              "",
          ),

        lastName:
          String(
            data.lastName ??
              "",
          ),

        displayName:
          String(
            data.displayName ??
              `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim(),
          ),

        role,

        cost,

        availabilityStatus:
          String(
            data.availabilityStatus ??
              "eligible",
          ),
      });
    }

    /*
     * ========================================================
     * VALIDATION ISSUES
     * ========================================================
     */

    const issues:
      FantasyRosterValidationIssue[] =
      [];

    /*
     * ========================================================
     * PLAYER COUNT
     * ========================================================
     */

    if (
      players.length !==
      rosterRules.rosterSize
    ) {
      issues.push({
        type:
          "wrong_roster_size",

        message:
          `La rosa deve contenere ${rosterRules.rosterSize} giocatori.`,
      });
    }

    /*
     * ========================================================
     * ROLE COUNTS
     * ========================================================
     */

    const goalkeeperCount =
      players.filter(
        (
          player,
        ) =>
          player.role ===
          "goalkeeper",
      ).length;

    const defenderCount =
      players.filter(
        (
          player,
        ) =>
          player.role ===
          "defender",
      ).length;

    const forwardCount =
      players.filter(
        (
          player,
        ) =>
          player.role ===
          "forward",
      ).length;

    if (
      goalkeeperCount !==
      rosterRules.goalkeeperCount
    ) {
      issues.push({
        type:
          "wrong_goalkeeper_count",

        message:
          `La rosa deve contenere ${rosterRules.goalkeeperCount} portieri.`,
      });
    }

    if (
      defenderCount !==
      rosterRules.defenderCount
    ) {
      issues.push({
        type:
          "wrong_defender_count",

        message:
          `La rosa deve contenere ${rosterRules.defenderCount} difensori.`,
      });
    }

    if (
      forwardCount !==
      rosterRules.forwardCount
    ) {
      issues.push({
        type:
          "wrong_forward_count",

        message:
          `La rosa deve contenere ${rosterRules.forwardCount} attaccanti.`,
      });
    }

    /*
     * ========================================================
     * PLAYER SEASON
     * ========================================================
     */

    for (
      const player
      of players
    ) {
      if (
        player.fantasySeasonId !==
        fantasySeasonId
      ) {
        issues.push({
          type:
            "player_not_eligible",

          fantasyPlayerId:
            player.id,

          message:
            `${player.displayName} non appartiene alla stagione Fantacalcio corrente.`,
        });
      }
    }

    /*
     * ========================================================
     * AVAILABILITY
     * ========================================================
     */

    for (
      const player
      of players
    ) {
      if (
        player.availabilityStatus !==
        "eligible"
      ) {
        issues.push({
          type:
            "player_not_eligible",

          fantasyPlayerId:
            player.id,

          message:
            `${player.displayName} non è disponibile nel Listone.`,
        });
      }
    }

    /*
     * ========================================================
     * REAL TEAM LIMIT
     * ========================================================
     */

    const realTeamCounts =
      new Map<
        string,
        number
      >();

    for (
      const player
      of players
    ) {
      if (
        !player.teamCode
      ) {
        issues.push({
          type:
            "player_not_eligible",

          fantasyPlayerId:
            player.id,

          message:
            `${player.displayName} non ha una squadra reale valida.`,
        });

        continue;
      }

      const currentCount =
        realTeamCounts.get(
          player.teamCode,
        ) ??
        0;

      realTeamCounts.set(
        player.teamCode,
        currentCount +
          1,
      );
    }

    for (
      const [
        teamCode,
        count,
      ]
      of realTeamCounts
    ) {
      if (
        count >
        rosterRules.maxPlayersPerRealTeam
      ) {
        issues.push({
          type:
            "duplicate_real_team",

          teamCode,

          message:
            `Hai selezionato ${count} giocatori della squadra ${teamCode}. Il massimo consentito è ${rosterRules.maxPlayersPerRealTeam}.`,
        });
      }
    }

    /*
     * ========================================================
     * BUDGET
     * ========================================================
     *
     * Il budget viene preso dalle regole della stagione,
     * non dal valore eventualmente presente nel documento
     * della squadra.
     * ========================================================
     */

    const budget =
      Number(
        rosterRules.initialBudget,
      );

    const spentCredits =
      players.reduce(
        (
          total,
          player,
        ) =>
          total +
          player.cost,
        0,
      );

    const remainingCredits =
      budget -
      spentCredits;

    if (
      remainingCredits <
      0
    ) {
      issues.push({
        type:
          "budget_exceeded",

        message:
          `Budget superato di ${Math.abs(
            remainingCredits,
          )} crediti.`,
      });
    }

    /*
     * ========================================================
     * FINAL VALIDATION
     * ========================================================
     */

    const isRosterValid =
      issues.length ===
      0;

    if (
      !isRosterValid
    ) {
      return NextResponse.json(
        {
          error:
            "La rosa non rispetta le regole del Fantacalcio.",

          validation: {
            isValid:
              false,

            issues,

            playerCount:
              players.length,

            goalkeeperCount,

            defenderCount,

            forwardCount,

            spentCredits,

            remainingCredits,
          },
        },
        {
          status:
            409,
        },
      );
    }

    /*
     * ========================================================
     * TRUSTED ROSTER
     * ========================================================
     *
     * Ricostruiamo ancora una volta il roster utilizzando
     * esclusivamente i dati letti dal Listone ufficiale.
     * ========================================================
     */

    const trustedRoster:
      FantasyRosterPlayer[] =
      players.map(
        (
          player,
        ) => ({
          fantasyPlayerId:
            player.id,

          playerSeasonCode:
            player.playerSeasonCode,

          teamCode:
            player.teamCode,

          firstName:
            player.firstName,

          lastName:
            player.lastName,

          displayName:
            player.displayName,

          role:
            player.role,

          cost:
            player.cost,
        }),
      );

    /*
     * ========================================================
     * ROSTER FINGERPRINT
     * ========================================================
     *
     * Serve per impedire che il roster venga modificato
     * tra la validazione e il blocco definitivo.
     * ========================================================
     */

    const validatedRosterFingerprint =
      uniquePlayerIds
        .slice()
        .sort()
        .join(
          "|",
        );

    /*
     * ========================================================
     * ATOMIC LOCK
     * ========================================================
     */

    const transactionResult =
      await adminDb.runTransaction(
        async (
          transaction,
        ) => {
          const latestTeamSnapshot =
            await transaction.get(
              teamRef,
            );

          if (
            !latestTeamSnapshot.exists
          ) {
            return {
              status:
                "not_found" as const,
            };
          }

          const latestTeam =
            latestTeamSnapshot.data();

          if (
            !latestTeam
          ) {
            return {
              status:
                "not_found" as const,
            };
          }

          if (
            latestTeam.userId !==
            userId
          ) {
            return {
              status:
                "forbidden" as const,
            };
          }

          /*
           * Se un'altra richiesta ha già
           * bloccato la rosa, consideriamo
           * l'operazione conclusa.
           */

          if (
            latestTeam.rosterLockedAt
          ) {
            return {
              status:
                "already_locked" as const,
            };
          }

          if (
            latestTeam.status ===
              "suspended" ||
            latestTeam.status ===
              "frozen" ||
            latestTeam.status ===
              "completed"
          ) {
            return {
              status:
                "invalid_status" as const,
            };
          }

          if (
            latestTeam.fantasySeasonId !==
            fantasySeasonId
          ) {
            return {
              status:
                "invalid_season" as const,
            };
          }

          /*
           * ==================================================
           * RECHECK FANTASY SEASON / ROSTER WINDOW
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

          const latestRoster =
            Array.isArray(
              latestTeam.roster,
            )
              ? latestTeam.roster
              : [];

          const latestRosterFingerprint =
            latestRoster
              .map(
                (
                  player,
                ) =>
                  typeof player?.fantasyPlayerId ===
                  "string"
                    ? player.fantasyPlayerId.trim()
                    : "",
              )
              .filter(
                Boolean,
              )
              .sort()
              .join(
                "|",
              );

          /*
           * Il roster è cambiato dopo
           * la nostra validazione.
           *
           * Non blocchiamo una composizione
           * diversa da quella validata.
           */

          if (
            latestRosterFingerprint !==
            validatedRosterFingerprint
          ) {
            return {
              status:
                "roster_changed" as const,
            };
          }

          /*
           * ==================================================
           * LOCK
           * ==================================================
           */

          transaction.update(
            teamRef,
            {
              roster:
                trustedRoster,

              budget,

              spentCredits,

              remainingCredits,

              isRosterValid:
                true,

              isEligible:
                true,

              status:
                "active",

              rosterLockedAt:
                FieldValue.serverTimestamp(),

              updatedAt:
                FieldValue.serverTimestamp(),
            },
          );

          return {
            status:
              "locked" as const,
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
      "not_found"
    ) {
      return NextResponse.json(
        {
          error:
            "Squadra Fantasy non trovata.",
        },
        {
          status:
            404,
        },
      );
    }

    if (
      transactionResult.status ===
      "forbidden"
    ) {
      return NextResponse.json(
        {
          error:
            "Non sei autorizzato a confermare questa squadra.",
        },
        {
          status:
            403,
        },
      );
    }

    if (
      transactionResult.status ===
      "invalid_status"
    ) {
      return NextResponse.json(
        {
          error:
            "La squadra non può essere confermata nello stato attuale.",
        },
        {
          status:
            409,
        },
      );
    }

    if (
      transactionResult.status ===
        "invalid_season" ||
      transactionResult.status ===
        "season_not_found"
    ) {
      return NextResponse.json(
        {
          error:
            "Stagione Fantacalcio non valida.",
        },
        {
          status:
            409,
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
            "La conferma delle rose non è attualmente disponibile.",
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
            "La finestra per la composizione della rosa non è ancora aperta.",
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
            "Il termine per confermare la rosa è scaduto.",
        },
        {
          status:
            409,
        },
      );
    }

    if (
      transactionResult.status ===
      "roster_changed"
    ) {
      return NextResponse.json(
        {
          error:
            "La rosa è stata modificata durante la conferma. Riprova.",
        },
        {
          status:
            409,
        },
      );
    }

    if (
      transactionResult.status ===
      "already_locked"
    ) {
      return NextResponse.json(
        {
          fantasyTeamId,

          locked:
            true,

          status:
            "active",

          message:
            "La rosa del Fantacalcio è già stata confermata.",
        },
        {
          status:
            200,
        },
      );
    }

    /*
     * ========================================================
     * SUCCESS
     * ========================================================
     */

    return NextResponse.json(
      {
        fantasyTeamId,

        locked:
          true,

        status:
          "active",

        roster:
          trustedRoster,

        validation: {
          isValid:
            true,

          issues:
            [],

          playerCount:
            players.length,

          goalkeeperCount,

          defenderCount,

          forwardCount,

          spentCredits,

          remainingCredits,
        },
      },
      {
        status:
          200,
      },
    );
  } catch (
    error
  ) {
    console.error(
      "Errore conferma rosa Fantacalcio:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Impossibile confermare la rosa Fantacalcio.",
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

