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
  DEFAULT_FANTASY_LINEUP_RULES,
  DEFAULT_FANTASY_VISIBILITY_RULES,
} from "@/src/types/FantasySeason";

import type {
  FantasyFormationLineup,
  FantasyFormationPlayer,
} from "@/src/types/FantasyFormation";

import type {
  FantasyRosterPlayer,
} from "@/src/types/FantasyTeam";

import {
  FantasyFormationValidationService,
} from "@/src/services/fantasy/FantasyFormationValidationService";

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

type SaveFantasyFormationRequest = {
  fantasyTeamId?:
    string;

  fantasyMatchweekId?:
    string;

  lineup?: {
    goalkeeperId?:
      string | null;

    defenderIds?:
      string[];

    forwardIds?:
      string[];
  };
};

/*
 * ============================================================
 * SAVE FORMATION
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
      SaveFantasyFormationRequest;

    try {
      body =
        (
          await request.json()
        ) as
          SaveFantasyFormationRequest;
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

    const fantasyMatchweekId =
      body.fantasyMatchweekId
        ?.trim();

    const goalkeeperId =
      typeof body.lineup
        ?.goalkeeperId ===
        "string"
        ? body.lineup.goalkeeperId.trim()
        : "";

    const defenderIds =
      Array.isArray(
        body.lineup
          ?.defenderIds,
      )
        ? body.lineup.defenderIds
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

    const forwardIds =
      Array.isArray(
        body.lineup
          ?.forwardIds,
      )
        ? body.lineup.forwardIds
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
     * BASIC VALIDATION
     * ========================================================
     */

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

    if (
      !fantasyMatchweekId
    ) {
      return NextResponse.json(
        {
          error:
            "Matchweek Fantacalcio non valida.",
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
            "Non sei autorizzato a modificare questa formazione.",
        },
        {
          status:
            403,
        },
      );
    }

    /*
     * ========================================================
     * TEAM ELIGIBILITY
     * ========================================================
     */

    if (
      team.status !==
      "active"
    ) {
      return NextResponse.json(
        {
          error:
            "La squadra Fantasy non è attiva.",
        },
        {
          status:
            409,
        },
      );
    }

    if (
      !team.rosterLockedAt ||
      team.isRosterValid !==
        true ||
      team.isEligible !==
        true
    ) {
      return NextResponse.json(
        {
          error:
            "La rosa deve essere confermata prima di poter inserire la formazione.",
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

    const gamesSeasonId =
      typeof team.gamesSeasonId ===
      "string"
        ? team.gamesSeasonId
        : "";

    if (
      !fantasySeasonId ||
      !gamesSeasonId
    ) {
      return NextResponse.json(
        {
          error:
            "Configurazione della squadra Fantasy non valida.",
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
     * GAMES SEASON CONSISTENCY
     * ========================================================
     */

    if (
      fantasySeason.gamesSeasonId !==
      gamesSeasonId
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
     * MATCHWEEK
     * ========================================================
     */

    const matchweekRef =
      adminDb
        .collection(
          "fantasyMatchweeks",
        )
        .doc(
          fantasyMatchweekId,
        );

    const matchweekSnapshot =
      await matchweekRef.get();

    if (
      !matchweekSnapshot.exists
    ) {
      return NextResponse.json(
        {
          error:
            "Matchweek Fantacalcio non trovata.",
        },
        {
          status:
            404,
        },
      );
    }

    const matchweek =
      matchweekSnapshot.data();

    if (
      !matchweek
    ) {
      return NextResponse.json(
        {
          error:
            "Dati della Matchweek non disponibili.",
        },
        {
          status:
            404,
        },
      );
    }

    /*
     * ========================================================
     * MATCHWEEK CONSISTENCY
     * ========================================================
     */

    if (
      matchweek.fantasySeasonId !==
      fantasySeasonId
    ) {
      return NextResponse.json(
        {
          error:
            "La Matchweek non appartiene alla stagione Fantacalcio corrente.",
        },
        {
          status:
            409,
        },
      );
    }

    /*
     * ========================================================
     * FORMATION STATUS
     * ========================================================
     */

    if (
      matchweek.status !==
      "formations_open"
    ) {
      return NextResponse.json(
        {
          error:
            "Le formazioni di questa Matchweek non sono aperte.",
        },
        {
          status:
            409,
        },
      );
    }

    /*
     * ========================================================
     * FORMATION WINDOW
     * ========================================================
     */

    const now =
      Date.now();

    const formationOpensAt =
      toTimestampMilliseconds(
        matchweek.formationOpensAt,
      );

    const formationClosesAt =
      toTimestampMilliseconds(
        matchweek.formationClosesAt,
      );

    if (
      formationOpensAt !==
        null &&
      now <
        formationOpensAt
    ) {
      return NextResponse.json(
        {
          error:
            "La finestra per inserire la formazione non è ancora aperta.",
        },
        {
          status:
            409,
        },
      );
    }

    if (
      formationClosesAt !==
        null &&
      now >=
        formationClosesAt
    ) {
      return NextResponse.json(
        {
          error:
            "Il termine per inserire la formazione è scaduto.",
        },
        {
          status:
            409,
        },
      );
    }

    /*
     * ========================================================
     * LINEUP RULES
     * ========================================================
     */

    const lineupRules = {
      ...DEFAULT_FANTASY_LINEUP_RULES,

      ...(fantasySeason.lineupRules ??
        {}),
    };

    /*
     * ========================================================
     * FORMATION MODEL COMPATIBILITY
     * ========================================================
     *
     * Difensori, attaccanti e numero totale dei titolari
     * vengono validati dinamicamente tramite lineupRules.
     *
     * Il modello FantasyFormationLineup espone invece un solo
     * slot goalkeeper, quindi al momento la configurazione deve
     * continuare a prevedere esattamente un portiere titolare.
     * ========================================================
     */

    if (
      lineupRules.startingGoalkeepers !==
      1
    ) {
      return NextResponse.json(
        {
          error:
            "La configurazione Fantasy deve prevedere esattamente un portiere titolare.",
        },
        {
          status:
            409,
        },
      );
    }

    /*
     * ========================================================
     * CLIENT COUNT PRECHECK
     * ========================================================
     */

    if (
      !goalkeeperId
    ) {
      return NextResponse.json(
        {
          error:
            "Seleziona un portiere titolare.",
        },
        {
          status:
            400,
        },
      );
    }

    if (
      defenderIds.length !==
      lineupRules.startingDefenders
    ) {
      return NextResponse.json(
        {
          error:
            `Devi selezionare esattamente ${lineupRules.startingDefenders} difensori titolari.`,
        },
        {
          status:
            400,
        },
      );
    }

    if (
      forwardIds.length !==
      lineupRules.startingForwards
    ) {
      return NextResponse.json(
        {
          error:
            `Devi selezionare esattamente ${lineupRules.startingForwards} attaccanti titolari.`,
        },
        {
          status:
            400,
        },
      );
    }

    /*
     * ========================================================
     * DUPLICATES
     * ========================================================
     */

    const selectedIds = [
      goalkeeperId,

      ...defenderIds,

      ...forwardIds,
    ];

    const uniqueSelectedIds =
      new Set(
        selectedIds,
      );

    if (
      uniqueSelectedIds.size !==
      selectedIds.length
    ) {
      return NextResponse.json(
        {
          error:
            "Uno stesso giocatore non può essere schierato più volte.",
        },
        {
          status:
            400,
        },
      );
    }

    /*
     * ========================================================
     * TRUSTED ROSTER
     * ========================================================
     */

    const roster =
      Array.isArray(
        team.roster,
      )
        ? (
            team.roster as
              FantasyRosterPlayer[]
          )
        : [];

    if (
      roster.length ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            "La rosa della squadra Fantasy è vuota.",
        },
        {
          status:
            409,
        },
      );
    }

    /*
     * ========================================================
     * ROSTER MAP
     * ========================================================
     */

    const rosterById =
      new Map<
        string,
        FantasyRosterPlayer
      >();

    for (
      const player
      of roster
    ) {
      if (
        player &&
        typeof player.fantasyPlayerId ===
          "string"
      ) {
        rosterById.set(
          player.fantasyPlayerId,
          player,
        );
      }
    }

    /*
     * ========================================================
     * VERIFY SELECTED PLAYERS
     * ========================================================
     */

    for (
      const fantasyPlayerId
      of selectedIds
    ) {
      if (
        !rosterById.has(
          fantasyPlayerId,
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Uno o più giocatori selezionati non appartengono alla tua rosa Fantasy.",
          },
          {
            status:
              409,
          },
        );
      }
    }

    /*
     * ========================================================
     * BUILD TRUSTED PLAYERS
     * ========================================================
     *
     * Il client invia soltanto gli ID.
     *
     * Nomi, ruoli, squadra reale e playerSeasonCode vengono
     * ricostruiti utilizzando esclusivamente la rosa bloccata.
     * ========================================================
     */

    const goalkeeper =
      buildFormationPlayer(
        rosterById.get(
          goalkeeperId,
        ),
      );

    if (
      !goalkeeper
    ) {
      return NextResponse.json(
        {
          error:
            "Portiere titolare non valido.",
        },
        {
          status:
            409,
        },
      );
    }

    const defenders =
      defenderIds.map(
        (
          fantasyPlayerId,
        ) =>
          buildFormationPlayer(
            rosterById.get(
              fantasyPlayerId,
            ),
          ),
      );

    const forwards =
      forwardIds.map(
        (
          fantasyPlayerId,
        ) =>
          buildFormationPlayer(
            rosterById.get(
              fantasyPlayerId,
            ),
          ),
      );

    if (
      defenders.some(
        (
          player,
        ) =>
          !player,
      ) ||
      forwards.some(
        (
          player,
        ) =>
          !player,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Uno o più giocatori selezionati non sono validi.",
        },
        {
          status:
            409,
        },
      );
    }

    /*
     * ========================================================
     * LINEUP
     * ========================================================
     */

    const lineup:
      FantasyFormationLineup = {
      goalkeeper,

      defenders:
        defenders as
          FantasyFormationPlayer[],

      forwards:
        forwards as
          FantasyFormationPlayer[],
    };

    /*
     * ========================================================
     * AUTOMATIC BENCH
     * ========================================================
     */

    const bench =
      FantasyFormationValidationService
        .buildAutomaticBench(
          lineup,
          roster,
        );

    /*
     * ========================================================
     * SERVER VALIDATION
     * ========================================================
     */

    const validation =
      FantasyFormationValidationService
        .validate({
          lineup,

          bench,

          roster,

          lineupRules,
        });

    if (
      !validation.isValid
    ) {
      return NextResponse.json(
        {
          error:
            "La formazione non rispetta le regole del Fantacalcio.",

          validation,
        },
        {
          status:
            409,
        },
      );
    }

    /*
     * ========================================================
     * MATCHWEEK NUMBER
     * ========================================================
     */

    const matchweekNumber =
      Number(
        matchweek.matchweekNumber,
      );

    if (
      !Number.isInteger(
        matchweekNumber,
      ) ||
      matchweekNumber <=
        0
    ) {
      return NextResponse.json(
        {
          error:
            "Numero Matchweek non valido.",
        },
        {
          status:
            409,
        },
      );
    }

    /*
     * ========================================================
     * EXISTING FORMATION
     * ========================================================
     */

    const existingFormationSnapshot =
      await adminDb
        .collection(
          "fantasyFormations",
        )
        .where(
          "fantasyTeamId",
          "==",
          fantasyTeamId,
        )
        .where(
          "fantasyMatchweekId",
          "==",
          fantasyMatchweekId,
        )
        .limit(
          1,
        )
        .get();

    const existingFormationDocument =
      existingFormationSnapshot
        .docs[0];

    if (
      existingFormationDocument
    ) {
      const existingFormation =
        existingFormationDocument.data();

      if (
        existingFormation.status ===
          "locked" ||
        existingFormation.lockedAt
      ) {
        return NextResponse.json(
          {
            error:
              "La formazione di questa Matchweek è già stata bloccata.",
          },
          {
            status:
              409,
          },
        );
      }
    }

    /*
     * ========================================================
     * FORMATION DOCUMENT
     * ========================================================
     *
     * Se esiste già utilizziamo lo stesso documento.
     *
     * Per una nuova formazione utilizziamo un ID deterministico
     * così due richieste contemporanee dello stesso utente
     * non possono generare due formazioni differenti.
     * ========================================================
     */

    const formationRef =
      existingFormationDocument
        ? existingFormationDocument.ref
        : adminDb
            .collection(
              "fantasyFormations",
            )
            .doc(
              buildFantasyFormationId({
                fantasyTeamId,

                fantasyMatchweekId,
              }),
            );

        /*
     * ========================================================
     * ATOMIC SAVE
     * ========================================================
     */

    const transactionResult =
      await adminDb.runTransaction(
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
            return {
              status:
                "team_not_found" as const,
            };
          }

          const latestTeam =
            latestTeamSnapshot.data();

          if (
            !latestTeam
          ) {
            return {
              status:
                "team_not_found" as const,
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

          if (
            latestTeam.status !==
              "active" ||
            !latestTeam.rosterLockedAt ||
            latestTeam.isEligible !==
              true ||
            latestTeam.isRosterValid !==
              true
          ) {
            return {
              status:
                "team_not_eligible" as const,
            };
          }

          /*
           * ==================================================
           * RECHECK FANTASY SEASON + LINEUP RULES
           * ==================================================
           *
           * lineupRules viene letto nuovamente dentro la stessa
           * transazione che salva la formazione.
           *
           * Se l'Admin modifica le regole tra la validazione
           * iniziale e il commit, la richiesta viene rifiutata
           * invece di salvare una formazione validata con regole
           * ormai obsolete.
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
                "fantasy_season_not_found" as const,
            };
          }

          const latestFantasySeason =
            latestFantasySeasonSnapshot.data();

          if (
            !latestFantasySeason
          ) {
            return {
              status:
                "fantasy_season_not_found" as const,
            };
          }

          if (
            latestFantasySeason.gamesSeasonId !==
              gamesSeasonId
          ) {
            return {
              status:
                "invalid_fantasy_season" as const,
            };
          }

          const latestLineupRules = {
            ...DEFAULT_FANTASY_LINEUP_RULES,

            ...(latestFantasySeason.lineupRules ??
              {}),
          };

          if (
            latestLineupRules.startingGoalkeepers !==
              1
          ) {
            return {
              status:
                "lineup_rules_changed" as const,
            };
          }

          /*
           * ==================================================
           * ROSTER FINGERPRINT
           * ==================================================
           */

          const latestRoster =
            Array.isArray(
              latestTeam.roster,
            )
              ? latestTeam.roster
              : [];

          const validatedRosterFingerprint =
            buildRosterFingerprint(
              roster,
            );

          const latestRosterFingerprint =
            buildRosterFingerprint(
              latestRoster as
                FantasyRosterPlayer[],
            );

          if (
            validatedRosterFingerprint !==
            latestRosterFingerprint
          ) {
            return {
              status:
                "roster_changed" as const,
            };
          }

          const latestValidation =
            FantasyFormationValidationService
              .validate({
                lineup,

                bench,

                roster:
                  latestRoster as
                    FantasyRosterPlayer[],

                lineupRules:
                  latestLineupRules,
              });

          if (
            !latestValidation.isValid
          ) {
            return {
              status:
                "lineup_rules_changed" as const,
            };
          }

          /*
           * ==================================================
           * RECHECK MATCHWEEK
           * ==================================================
           */

          const latestMatchweekSnapshot =
            await transaction.get(
              matchweekRef,
            );

          if (
            !latestMatchweekSnapshot.exists
          ) {
            return {
              status:
                "matchweek_not_found" as const,
            };
          }

          const latestMatchweek =
            latestMatchweekSnapshot.data();

          if (
            !latestMatchweek
          ) {
            return {
              status:
                "matchweek_not_found" as const,
            };
          }

          if (
            latestMatchweek.fantasySeasonId !==
            fantasySeasonId
          ) {
            return {
              status:
                "invalid_matchweek" as const,
            };
          }

          if (
            latestMatchweek.status !==
            "formations_open"
          ) {
            return {
              status:
                "formations_closed" as const,
            };
          }

          const latestOpensAt =
            toTimestampMilliseconds(
              latestMatchweek
                .formationOpensAt,
            );

          const latestClosesAt =
            toTimestampMilliseconds(
              latestMatchweek
                .formationClosesAt,
            );

          const transactionNow =
            Date.now();

          if (
            latestOpensAt !==
              null &&
            transactionNow <
              latestOpensAt
          ) {
            return {
              status:
                "formations_closed" as const,
            };
          }

          if (
            latestClosesAt !==
              null &&
            transactionNow >=
              latestClosesAt
          ) {
            return {
              status:
                "formations_closed" as const,
            };
          }

          /*
           * ==================================================
           * RECHECK FORMATION
           * ==================================================
           */

          const latestFormationSnapshot =
            await transaction.get(
              formationRef,
            );

          if (
            latestFormationSnapshot.exists
          ) {
            const latestFormation =
              latestFormationSnapshot.data();

            if (
              !latestFormation
            ) {
              return {
                status:
                  "formation_invalid" as const,
              };
            }

            if (
              latestFormation.status ===
                "locked" ||
              latestFormation.lockedAt
            ) {
              return {
                status:
                  "formation_locked" as const,
              };
            }
          }

          /*
           * ==================================================
           * SAVE
           * ==================================================
           */

          const formationData = {
            fantasySeasonId,

            fantasyMatchweekId,

            fantasyTeamId,

            userId,

            matchweekNumber,

            status:
              "submitted",

            source:
              "submitted",

            lineup,

            bench,

            isValid:
              true,

            submittedAt:
              FieldValue.serverTimestamp(),

            lockedAt:
              null,

            carriedForwardFromMatchweek:
              null,

            updatedAt:
              FieldValue.serverTimestamp(),
          };

          if (
            latestFormationSnapshot.exists
          ) {
            transaction.set(
              formationRef,
              formationData,
              {
                merge:
                  true,
              },
            );
          } else {
            transaction.set(
              formationRef,
              {
                ...formationData,

                createdAt:
                  FieldValue.serverTimestamp(),
              },
            );
          }

          return {
            status:
              "saved" as const,
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
      transactionResult.status ===
      "forbidden"
    ) {
      return NextResponse.json(
        {
          error:
            "Non sei autorizzato a modificare questa formazione.",
        },
        {
          status:
            403,
        },
      );
    }

    if (
      transactionResult.status ===
      "team_not_eligible"
    ) {
      return NextResponse.json(
        {
          error:
            "La squadra Fantasy non è abilitata all'invio della formazione.",
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
            "La rosa è cambiata durante il salvataggio della formazione. Riprova.",
        },
        {
          status:
            409,
        },
      );
    }

    if (
      transactionResult.status ===
      "fantasy_season_not_found"
    ) {
      return NextResponse.json(
        {
          error:
            "Stagione Fantacalcio non trovata.",
        },
        {
          status:
            409,
        },
      );
    }

    if (
      transactionResult.status ===
      "invalid_fantasy_season"
    ) {
      return NextResponse.json(
        {
          error:
            "La configurazione della stagione Fantacalcio è cambiata. Riprova.",
        },
        {
          status:
            409,
        },
      );
    }

    if (
      transactionResult.status ===
      "lineup_rules_changed"
    ) {
      return NextResponse.json(
        {
          error:
            "Le regole della formazione sono cambiate durante il salvataggio. Ricarica e riprova.",
        },
        {
          status:
            409,
        },
      );
    }

    if (
      transactionResult.status ===
        "matchweek_not_found" ||
      transactionResult.status ===
        "invalid_matchweek"
    ) {
      return NextResponse.json(
        {
          error:
            "Matchweek Fantacalcio non valida.",
        },
        {
          status:
            409,
        },
      );
    }

    if (
      transactionResult.status ===
      "formations_closed"
    ) {
      return NextResponse.json(
        {
          error:
            "Il termine per inserire la formazione è scaduto.",
        },
        {
          status:
            409,
        },
      );
    }

        if (
      transactionResult.status ===
      "formation_invalid"
    ) {
      return NextResponse.json(
        {
          error:
            "La formazione Fantasy esistente contiene dati non validi.",
        },
        {
          status:
            409,
        },
      );
    }
    
    if (
      transactionResult.status ===
      "formation_locked"
    ) {
      return NextResponse.json(
        {
          error:
            "La formazione di questa Matchweek è già stata bloccata.",
        },
        {
          status:
            409,
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
        fantasyFormationId:
          formationRef.id,

        fantasyTeamId,

        fantasyMatchweekId,

        matchweekNumber,

        status:
          "submitted",

        lineup,

        bench,

        validation,
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
      "Errore salvataggio formazione Fantacalcio:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Impossibile salvare la formazione Fantacalcio.",
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
 * BUILD FORMATION PLAYER
 * ============================================================
 */

function buildFormationPlayer(
  player:
    FantasyRosterPlayer | undefined,
): FantasyFormationPlayer | null {
  if (
    !player
  ) {
    return null;
  }

  return {
    fantasyPlayerId:
      player.fantasyPlayerId,

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
  };
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

/*
 * ============================================================
 * FORMATION ID
 * ============================================================
 */

function buildFantasyFormationId({
  fantasyTeamId,
  fantasyMatchweekId,
}: {
  fantasyTeamId:
    string;

  fantasyMatchweekId:
    string;
}): string {
  return `${fantasyTeamId}-${fantasyMatchweekId}`;
}

/*
 * ============================================================
 * ROSTER FINGERPRINT
 * ============================================================
 */

function buildRosterFingerprint(
  roster:
    FantasyRosterPlayer[],
): string {
  return roster
    .map(
      (
        player,
      ) =>
        `${player.fantasyPlayerId}:${player.role}:${player.teamCode}`,
    )
    .sort()
    .join(
      "|",
    );
}