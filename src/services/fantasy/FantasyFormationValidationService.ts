import type {
  FantasyFormationBench,
  FantasyFormationLineup,
  FantasyFormationValidationIssue,
  FantasyFormationValidationResult,
} from "@/src/types/FantasyFormation";

import type {
  FantasyRosterPlayer,
} from "@/src/types/FantasyTeam";

import {
  DEFAULT_FANTASY_LINEUP_RULES,
} from "@/src/types/FantasySeason";

import type {
  FantasyLineupRules,
} from "@/src/types/FantasySeason";

export type ValidateFantasyFormationInput = {
  lineup:
    FantasyFormationLineup;

  bench:
    FantasyFormationBench;

  roster:
    FantasyRosterPlayer[];

  lineupRules?:
    Partial<FantasyLineupRules>;
};

export class FantasyFormationValidationService {
  static validate(
    input: ValidateFantasyFormationInput,
  ): FantasyFormationValidationResult {
    const {
      lineup,
      bench,
      roster,

      lineupRules:
        inputLineupRules,
    } = input;

    const issues:
      FantasyFormationValidationIssue[] = [];

    /*
     * ========================================================
     * LINEUP RULES
     * ========================================================
     *
     * Il route server passa sempre le regole della stagione.
     *
     * Il fallback mantiene compatibilità con i chiamanti legacy
     * e con i test del servizio che usano il modulo standard.
     * ========================================================
     */

    const lineupRules:
      FantasyLineupRules = {
        ...DEFAULT_FANTASY_LINEUP_RULES,

        ...(inputLineupRules ??
          {}),
      };

    const configuredStartersCount =
      lineupRules.startingGoalkeepers +
      lineupRules.startingDefenders +
      lineupRules.startingForwards;

    if (
      configuredStartersCount !==
      lineupRules.lineupSize
    ) {
      issues.push({
        type:
          "invalid_role",

        message:
          `Configurazione formazione non valida: i ruoli titolari previsti (${configuredStartersCount}) non coincidono con la dimensione della formazione (${lineupRules.lineupSize}).`,
      });
    }

    const startingGoalkeepers =
      lineup.goalkeeper
        ? 1
        : 0;

    const starters = [
      ...(lineup.goalkeeper
        ? [lineup.goalkeeper]
        : []),

      ...lineup.defenders,

      ...lineup.forwards,
    ];

    const benchPlayers = [
      ...(bench.goalkeeper
        ? [bench.goalkeeper]
        : []),

      ...(bench.defender
        ? [bench.defender]
        : []),

      ...(bench.forward
        ? [bench.forward]
        : []),
    ];

    const allSelectedPlayers = [
      ...starters,
      ...benchPlayers,
    ];

    if (
      startingGoalkeepers !==
      lineupRules.startingGoalkeepers
    ) {
      issues.push({
        type:
          startingGoalkeepers ===
            0 &&
          lineupRules.startingGoalkeepers >
            0
            ? "missing_goalkeeper"
            : "invalid_role",

        message:
          `La formazione deve contenere esattamente ${lineupRules.startingGoalkeepers} ${
            lineupRules.startingGoalkeepers ===
            1
              ? "portiere titolare"
              : "portieri titolari"
          }.`,
      });
    }

    if (
      lineup.goalkeeper &&
      lineup.goalkeeper.role !==
        "goalkeeper"
    ) {
      issues.push({
        type:
          "invalid_role",

        fantasyPlayerId:
          lineup.goalkeeper.fantasyPlayerId,

        message:
          "Il giocatore selezionato come portiere non ha il ruolo corretto.",
      });
    }

    if (
      lineup.defenders.length !==
      lineupRules.startingDefenders
    ) {
      issues.push({
        type:
          "wrong_defender_count",

        message:
          `La formazione deve contenere esattamente ${lineupRules.startingDefenders} ${
            lineupRules.startingDefenders ===
            1
              ? "difensore titolare"
              : "difensori titolari"
          }.`,
      });
    }

    if (
      lineup.forwards.length !==
      lineupRules.startingForwards
    ) {
      issues.push({
        type:
          "wrong_forward_count",

        message:
          `La formazione deve contenere esattamente ${lineupRules.startingForwards} ${
            lineupRules.startingForwards ===
            1
              ? "attaccante titolare"
              : "attaccanti titolari"
          }.`,
      });
    }

    for (
      const defender
      of lineup.defenders
    ) {
      if (
        defender.role !==
        "defender"
      ) {
        issues.push({
          type:
            "invalid_role",

          fantasyPlayerId:
            defender.fantasyPlayerId,

          message:
            `${defender.displayName} non può essere schierato come difensore.`,
        });
      }
    }

    for (
      const forward
      of lineup.forwards
    ) {
      if (
        forward.role !==
        "forward"
      ) {
        issues.push({
          type:
            "invalid_role",

          fantasyPlayerId:
            forward.fantasyPlayerId,

          message:
            `${forward.displayName} non può essere schierato come attaccante.`,
        });
      }
    }

    if (
      bench.goalkeeper &&
      bench.goalkeeper.role !==
        "goalkeeper"
    ) {
      issues.push({
        type:
          "invalid_role",

        fantasyPlayerId:
          bench.goalkeeper.fantasyPlayerId,

        message:
          `${bench.goalkeeper.displayName} non può essere utilizzato come portiere di riserva.`,
      });
    }

    if (
      bench.defender &&
      bench.defender.role !==
        "defender"
    ) {
      issues.push({
        type:
          "invalid_role",

        fantasyPlayerId:
          bench.defender.fantasyPlayerId,

        message:
          `${bench.defender.displayName} non può essere utilizzato come difensore di riserva.`,
      });
    }

    if (
      bench.forward &&
      bench.forward.role !==
        "forward"
    ) {
      issues.push({
        type:
          "invalid_role",

        fantasyPlayerId:
          bench.forward.fantasyPlayerId,

        message:
          `${bench.forward.displayName} non può essere utilizzato come attaccante di riserva.`,
      });
    }

    const selectedIds =
      allSelectedPlayers.map(
        (player) =>
          player.fantasyPlayerId,
      );

    const uniqueSelectedIds =
      new Set(
        selectedIds,
      );

    if (
      uniqueSelectedIds.size !==
      selectedIds.length
    ) {
      issues.push({
        type:
          "duplicate_player",

        message:
          "Uno stesso giocatore non può essere inserito più volte nella formazione.",
      });
    }

    const rosterIds =
      new Set(
        roster.map(
          (player) =>
            player.fantasyPlayerId,
        ),
      );

    for (
      const player
      of allSelectedPlayers
    ) {
      if (
        !rosterIds.has(
          player.fantasyPlayerId,
        )
      ) {
        issues.push({
          type:
            "player_not_in_roster",

          fantasyPlayerId:
            player.fantasyPlayerId,

          message:
            `${player.displayName} non appartiene alla rosa della squadra Fantasy.`,
        });
      }
    }

    if (
      starters.length !==
      lineupRules.lineupSize
    ) {
      issues.push({
        type:
          "invalid_role",

        message:
          `La formazione titolare deve essere composta esattamente da ${lineupRules.lineupSize} giocatori.`,
      });
    }

    /*
     * ========================================================
     * BENCH
     * ========================================================
     *
     * La panchina resta composta da tre slot di ruolo
     * (portiere, difensore, attaccante), come definito
     * attualmente da FantasyFormationBench.
     * ========================================================
     */

    if (
      benchPlayers.length !==
      3
    ) {
      issues.push({
        type:
          "invalid_role",

        message:
          "La panchina deve essere composta esattamente da 3 giocatori.",
      });
    }

    return {
      isValid:
        issues.length === 0,

      issues,

      startersCount:
        starters.length,

      benchCount:
        benchPlayers.length,
    };
  }
  static buildAutomaticBench(
  lineup:
    FantasyFormationLineup,

  roster:
    FantasyRosterPlayer[],
): FantasyFormationBench {
  const starterIds =
    new Set(
      [
        ...(lineup.goalkeeper
          ? [
              lineup.goalkeeper
                .fantasyPlayerId,
            ]
          : []),

        ...lineup.defenders.map(
          (player) =>
            player.fantasyPlayerId,
        ),

        ...lineup.forwards.map(
          (player) =>
            player.fantasyPlayerId,
        ),
      ],
    );

  const remainingPlayers =
    roster.filter(
      (player) =>
        !starterIds.has(
          player.fantasyPlayerId,
        ),
    );

  const goalkeeper =
    remainingPlayers.find(
      (player) =>
        player.role ===
        "goalkeeper",
    ) ?? null;

  const defender =
    remainingPlayers.find(
      (player) =>
        player.role ===
        "defender",
    ) ?? null;

  const forward =
    remainingPlayers.find(
      (player) =>
        player.role ===
        "forward",
    ) ?? null;

  return {
    goalkeeper:
      goalkeeper
        ? {
            fantasyPlayerId:
              goalkeeper.fantasyPlayerId,

            playerSeasonCode:
              goalkeeper.playerSeasonCode,

            teamCode:
              goalkeeper.teamCode,

            firstName:
              goalkeeper.firstName,

            lastName:
              goalkeeper.lastName,

            displayName:
              goalkeeper.displayName,

            role:
              goalkeeper.role,
          }
        : null,

    defender:
      defender
        ? {
            fantasyPlayerId:
              defender.fantasyPlayerId,

            playerSeasonCode:
              defender.playerSeasonCode,

            teamCode:
              defender.teamCode,

            firstName:
              defender.firstName,

            lastName:
              defender.lastName,

            displayName:
              defender.displayName,

            role:
              defender.role,
          }
        : null,

    forward:
      forward
        ? {
            fantasyPlayerId:
              forward.fantasyPlayerId,

            playerSeasonCode:
              forward.playerSeasonCode,

            teamCode:
              forward.teamCode,

            firstName:
              forward.firstName,

            lastName:
              forward.lastName,

            displayName:
              forward.displayName,

            role:
              forward.role,
          }
        : null,
  };
}
}