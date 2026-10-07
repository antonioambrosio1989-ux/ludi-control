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
  FantasyRosterPlayer,
} from "@/src/types/FantasyTeam";

import type {
  FantasyRole,
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

type SaveFantasyRosterRequest = {
  fantasyTeamId?:
    string;

  fantasyPlayerIds?:
    string[];
};

/*
 * ============================================================
 * ROSTER WRITE STATUS
 * ============================================================
 */

type RosterWriteStatus =
  | "saved"
  | "team_not_found"
  | "forbidden"
  | "roster_locked"
  | "team_not_writable"
  | "season_not_found"
  | "invalid_season"
  | "market_closed"
  | "roster_not_open"
  | "roster_closed";

/*
 * ============================================================
 * PLAYER DATA
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
 * SAVE ROSTER
 * ============================================================
 */

export async function PUT(
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
      SaveFantasyRosterRequest;

    try {
      body =
        (
          await request.json()
        ) as
          SaveFantasyRosterRequest;
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

    const fantasyPlayerIds =
      Array.isArray(
        body.fantasyPlayerIds,
      )
        ? body.fantasyPlayerIds
            .filter(
              (
                value,
              ): value is string =>
                typeof value ===
                "string",
            )
            .map(
              (
                value,
              ) =>
                value.trim(),
            )
            .filter(
              Boolean,
            )
        : [];

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
            "Non sei autorizzato a modificare questa squadra.",
        },
        {
          status:
            403,
        },
      );
    }

    /*
     * ========================================================
     * TEAM STATUS
     * ========================================================
     */

    if (
      team.rosterLockedAt
    ) {
      return NextResponse.json(
        {
          error:
            "La rosa del Fantacalcio è già stata bloccata.",
        },
        {
          status:
            409,
        },
      );
    }

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
            "La rosa non può essere modificata nello stato attuale.",
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
            "Il mercato del Fantacalcio non è attualmente aperto.",
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
            "Il termine per modificare la rosa è scaduto.",
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
     * MAXIMUM ROSTER SIZE
     * ========================================================
     */

    if (
      uniquePlayerIds.length >
      rosterRules.rosterSize
    ) {
      return NextResponse.json(
        {
          error:
            `La rosa può contenere massimo ${rosterRules.rosterSize} giocatori.`,
        },
        {
          status:
            400,
        },
      );
    }

    /*
     * ========================================================
     * GAMES PASS
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
     * ATOMIC ROSTER WRITE
     * ========================================================
     *
     * Ogni scrittura ricontrolla dentro la transazione:
     *
     * - ownership;
     * - stato della squadra;
     * - eventuale lock della rosa;
     * - associazione con la Fantasy Season;
     * - stato del mercato;
     * - rosterOpensAt / rosterClosesAt.
     *
     * In questo modo la deadline non può essere aggirata se
     * scade tra la validazione iniziale e la scrittura finale.
     * ========================================================
     */

    async function writeRosterAtomically({
      roster,
      spentCredits,
      remainingCredits,
      isRosterValid,
    }: {
      roster:
        FantasyRosterPlayer[];

      spentCredits:
        number;

      remainingCredits:
        number;

      isRosterValid:
        boolean;
    }): Promise<
      RosterWriteStatus
    > {
      return adminDb.runTransaction(
        async (
          transaction,
        ) => {
          /*
           * ==================================================
           * RECHECK TEAM
           * ==================================================
           */

          const latestTeamSnapshot =
            await transaction.get(
              teamRef,
            );

          if (
            !latestTeamSnapshot.exists
          ) {
            return "team_not_found";
          }

          const latestTeam =
            latestTeamSnapshot.data();

          if (
            !latestTeam
          ) {
            return "team_not_found";
          }

          if (
            latestTeam.userId !==
            userId
          ) {
            return "forbidden";
          }

          if (
            latestTeam.rosterLockedAt
          ) {
            return "roster_locked";
          }

          if (
            latestTeam.status ===
              "suspended" ||
            latestTeam.status ===
              "frozen" ||
            latestTeam.status ===
              "completed"
          ) {
            return "team_not_writable";
          }

          if (
            latestTeam.fantasySeasonId !==
            fantasySeasonId
          ) {
            return "invalid_season";
          }

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
            return "season_not_found";
          }

          const latestFantasySeason =
            latestFantasySeasonSnapshot.data();

          if (
            !latestFantasySeason
          ) {
            return "season_not_found";
          }

          if (
            latestFantasySeason.status !==
            "rosters_open"
          ) {
            return "market_closed";
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
            return "roster_not_open";
          }

          if (
            latestRosterClosesAt !==
              null &&
            transactionNow >=
              latestRosterClosesAt
          ) {
            return "roster_closed";
          }

          /*
           * ==================================================
           * SAVE
           * ==================================================
           */

          transaction.update(
            teamRef,
            {
              roster,

              spentCredits,

              remainingCredits,

              isRosterValid,

              isEligible:
                false,

              status:
                "draft",

              updatedAt:
                FieldValue.serverTimestamp(),
            },
          );

          return "saved";
        },
      );
    }

    /*
     * ========================================================
     * TRANSACTION ERROR RESPONSE
     * ========================================================
     */

    function getRosterWriteErrorResponse(
      status:
        RosterWriteStatus,
    ) {
      if (
        status ===
        "saved"
      ) {
        return null;
      }

      if (
        status ===
        "team_not_found"
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
        status ===
        "forbidden"
      ) {
        return NextResponse.json(
          {
            error:
              "Non sei autorizzato a modificare questa squadra.",
          },
          {
            status:
              403,
          },
        );
      }

      if (
        status ===
        "roster_locked"
      ) {
        return NextResponse.json(
          {
            error:
              "La rosa del Fantacalcio è già stata bloccata.",
          },
          {
            status:
              409,
          },
        );
      }

      if (
        status ===
        "team_not_writable"
      ) {
        return NextResponse.json(
          {
            error:
              "La rosa non può essere modificata nello stato attuale.",
          },
          {
            status:
              409,
          },
        );
      }

      if (
        status ===
          "season_not_found" ||
        status ===
          "invalid_season"
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
        status ===
        "market_closed"
      ) {
        return NextResponse.json(
          {
            error:
              "Il mercato del Fantacalcio non è attualmente aperto.",
          },
          {
            status:
              409,
          },
        );
      }

      if (
        status ===
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

      return NextResponse.json(
        {
          error:
            "Il termine per modificare la rosa è scaduto.",
        },
        {
          status:
            409,
        },
      );
    }

    /*
     * ========================================================
     * EMPTY ROSTER
     * ========================================================
     */

    if (
      uniquePlayerIds.length ===
      0
    ) {
      const emptyRosterRemainingCredits =
        Number(
          team.budget ??
            rosterRules.initialBudget,
        );

      const writeStatus =
        await writeRosterAtomically({
          roster:
            [],

          spentCredits:
            0,

          remainingCredits:
            emptyRosterRemainingCredits,

          isRosterValid:
            false,
        });

      const writeErrorResponse =
        getRosterWriteErrorResponse(
          writeStatus,
        );

      if (
        writeErrorResponse
      ) {
        return writeErrorResponse;
      }

      return NextResponse.json(
        {
          roster:
            [],

          spentCredits:
            0,

          remainingCredits:
            emptyRosterRemainingCredits,

          isRosterValid:
            false,
        },
      );
    }

    /*
     * ========================================================
     * LOAD PLAYERS
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
            "Uno o più giocatori selezionati non esistono.",
        },
        {
          status:
            400,
        },
      );
    }

    /*
     * ========================================================
     * NORMALIZE SERVER PLAYERS
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
              400,
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

      const player:
        ServerFantasyPlayer = {
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

        cost:
          Number(
            data.cost ??
              0,
          ),

        availabilityStatus:
          String(
            data.availabilityStatus ??
              "eligible",
          ),
      };

      players.push(
        player,
      );
    }

    /*
     * ========================================================
     * PLAYER SEASON
     * ========================================================
     */

    if (
      players.some(
        (
          player,
        ) =>
          player.fantasySeasonId !==
          fantasySeasonId,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Uno o più giocatori non appartengono a questa stagione del Fantacalcio.",
        },
        {
          status:
            400,
        },
      );
    }

    /*
     * ========================================================
     * AVAILABILITY
     * ========================================================
     */

    if (
      players.some(
        (
          player,
        ) =>
          player.availabilityStatus !==
          "eligible",
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Uno o più giocatori selezionati non sono disponibili.",
        },
        {
          status:
            409,
        },
      );
    }

    /*
     * ========================================================
     * COST
     * ========================================================
     */

    if (
      players.some(
        (
          player,
        ) =>
          !Number.isFinite(
            player.cost,
          ) ||
          player.cost <
            0,
      )
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

    /*
     * ========================================================
     * PREVENT ROLE OVERFLOW
     * ========================================================
     */

    if (
      goalkeeperCount >
      rosterRules.goalkeeperCount
    ) {
      return NextResponse.json(
        {
          error:
            `Puoi acquistare massimo ${rosterRules.goalkeeperCount} portieri.`,
        },
        {
          status:
            409,
        },
      );
    }

    if (
      defenderCount >
      rosterRules.defenderCount
    ) {
      return NextResponse.json(
        {
          error:
            `Puoi acquistare massimo ${rosterRules.defenderCount} difensori.`,
        },
        {
          status:
            409,
        },
      );
    }

    if (
      forwardCount >
      rosterRules.forwardCount
    ) {
      return NextResponse.json(
        {
          error:
            `Puoi acquistare massimo ${rosterRules.forwardCount} attaccanti.`,
        },
        {
          status:
            409,
        },
      );
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

    const exceedsRealTeamLimit =
      [
        ...realTeamCounts.values(),
      ].some(
        (
          count,
        ) =>
          count >
          rosterRules.maxPlayersPerRealTeam,
      );

    if (
      exceedsRealTeamLimit
    ) {
      return NextResponse.json(
        {
          error:
            `Puoi acquistare massimo ${rosterRules.maxPlayersPerRealTeam} giocatore per ogni squadra reale.`,
        },
        {
          status:
            409,
        },
      );
    }

    /*
     * ========================================================
     * BUDGET
     * ========================================================
     */

    const budget =
      Number(
        team.budget ??
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
      return NextResponse.json(
        {
          error:
            `Budget superato di ${Math.abs(
              remainingCredits,
            )} crediti.`,
        },
        {
          status:
            409,
        },
      );
    }

    /*
     * ========================================================
     * COMPLETE ROSTER VALIDATION
     * ========================================================
     */

    const isRosterValid =
      players.length ===
        rosterRules.rosterSize &&
      goalkeeperCount ===
        rosterRules.goalkeeperCount &&
      defenderCount ===
        rosterRules.defenderCount &&
      forwardCount ===
        rosterRules.forwardCount &&
      remainingCredits >=
        0;

    /*
     * ========================================================
     * BUILD TRUSTED ROSTER
     * ========================================================
     */

    const roster:
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
     * SAVE
     * ========================================================
     */

    const writeStatus =
      await writeRosterAtomically({
        roster,

        spentCredits,

        remainingCredits,

        isRosterValid,
      });

    const writeErrorResponse =
      getRosterWriteErrorResponse(
        writeStatus,
      );

    if (
      writeErrorResponse
    ) {
      return writeErrorResponse;
    }

    /*
     * ========================================================
     * RESPONSE
     * ========================================================
     */

    return NextResponse.json(
      {
        roster,

        validation: {
          isValid:
            isRosterValid,

          playerCount:
            players.length,

          goalkeeperCount,

          defenderCount,

          forwardCount,

          spentCredits,

          remainingCredits,
        },

        rules: {
          rosterSize:
            rosterRules.rosterSize,

          goalkeeperCount:
            rosterRules.goalkeeperCount,

          defenderCount:
            rosterRules.defenderCount,

          forwardCount:
            rosterRules.forwardCount,

          maxPlayersPerRealTeam:
            rosterRules.maxPlayersPerRealTeam,

          budget,
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
      "Errore salvataggio rosa Fantacalcio:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Impossibile salvare la rosa Fantacalcio.",
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

