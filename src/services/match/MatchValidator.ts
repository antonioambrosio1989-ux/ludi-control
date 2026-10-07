import type { Team } from "@/src/types/Team";

import type {
  MatchWizardData,
} from "@/src/types/MatchWizardData";

export type MatchValidationPlayer = {
  id: string | number;
  name: string;
  team: string | number;
  role: "Portiere" | "Difensore" | "Attaccante";
};

export type MatchValidationSeverity =
  | "error"
  | "warning"
  | "success";

export type MatchValidationResult = {
  id: string;
  severity: MatchValidationSeverity;
  title: string;
  description?: string;
};

type ValidateMatchInput = {
  data: MatchWizardData;

  homeTeam?: Team;
  awayTeam?: Team;

  allPlayers: MatchValidationPlayer[];
};

export function validateMatchReport({
  data,
  homeTeam,
  awayTeam,
  allPlayers,
}: ValidateMatchInput): MatchValidationResult[] {
  const results: MatchValidationResult[] = [];

  if (!homeTeam || !awayTeam) {
    results.push({
      id: "teams-not-found",
      severity: "error",
      title: "Squadre non disponibili",
      description:
        "Non è stato possibile recuperare entrambe le squadre.",
    });

    return results;
  }

  if (data.status === "walkover") {
    validateWalkover(data, homeTeam, awayTeam, results);
    return results;
  }

  const homeGoals = getPerformanceGoalsForTeam(
    data,
    homeTeam.id,
  );

  const awayGoals = getPerformanceGoalsForTeam(
    data,
    awayTeam.id,
  );

  if (homeGoals !== data.homeScore) {
    results.push({
      id: "home-goals-mismatch",
      severity: "error",
      title: `Gol ${homeTeam.name} non coerenti`,
      description: `Risultato: ${data.homeScore}. Reti inserite: ${homeGoals}.`,
    });
  }

  if (awayGoals !== data.awayScore) {
    results.push({
      id: "away-goals-mismatch",
      severity: "error",
      title: `Gol ${awayTeam.name} non coerenti`,
      description: `Risultato: ${data.awayScore}. Reti inserite: ${awayGoals}.`,
    });
  }

  validateAttendance(data, results);

  validatePerformances(
    data,
    allPlayers,
    results,
  );

  validateMvp(data, results);

  validateGoals(
    data,
    allPlayers,
    homeTeam,
    awayTeam,
    results,
  );

  validateGoalkeepers(
    data,
    allPlayers,
    homeTeam,
    awayTeam,
    results,
  );

  if (
    !results.some(
      (result) => result.severity === "error",
    )
  ) {
    results.unshift({
      id: "report-valid",
      severity: "success",
      title: "Tabellino pronto",
      description:
        "Tutti i controlli obbligatori sono stati superati.",
    });
  }

  return results;
}

function validateWalkover(
  data: MatchWizardData,
  homeTeam: Team,
  awayTeam: Team,
  results: MatchValidationResult[],
) {
  if (!data.walkoverWinnerTeamId) {
    results.push({
      id: "walkover-winner",
      severity: "error",
      title: "Seleziona la squadra vincente",
    });

    return;
  }

  const winnerTeamId = String(
    data.walkoverWinnerTeamId,
  );

  const homeTeamId = String(homeTeam.id);
  const awayTeamId = String(awayTeam.id);

  const winnerIsHome =
    winnerTeamId === homeTeamId;

  const winnerIsAway =
    winnerTeamId === awayTeamId;

  if (!winnerIsHome && !winnerIsAway) {
    results.push({
      id: "walkover-invalid-winner",
      severity: "error",
      title: "Squadra vincente non valida",
      description:
        "La squadra vincente deve essere una delle due squadre della partita.",
    });

    return;
  }

  const validScore = winnerIsHome
    ? data.homeScore === 6 &&
      data.awayScore === 0
    : data.homeScore === 0 &&
      data.awayScore === 6;

  if (!validScore) {
    results.push({
      id: "walkover-score",
      severity: "error",
      title: "Risultato a tavolino non valido",
      description: winnerIsHome
        ? `Il risultato deve essere 6-0 per ${homeTeam.name}.`
        : `Il risultato deve essere 0-6 per ${awayTeam.name}.`,
    });
  }

  const winnerPresentPlayerIds =
    winnerIsHome
      ? data.homePresentPlayerIds
      : data.awayPresentPlayerIds;

  const loserPresentPlayerIds =
    winnerIsHome
      ? data.awayPresentPlayerIds
      : data.homePresentPlayerIds;

  if (winnerPresentPlayerIds.length === 0) {
    results.push({
      id: "walkover-winner-attendance",
      severity: "error",
      title:
        "Nessuna presenza assegnata alla squadra vincente",
      description:
        "Il sistema deve assegnare automaticamente le presenze previste ai giocatori della squadra vincente.",
    });
  }

  if (loserPresentPlayerIds.length > 0) {
    results.push({
      id: "walkover-loser-attendance",
      severity: "error",
      title:
        "La squadra perdente non può ricevere presenze",
      description:
        "In una sconfitta a tavolino nessun giocatore della squadra perdente deve ricevere la presenza.",
    });
  }

  if (data.goals.length > 0) {
    results.push({
      id: "walkover-goals",
      severity: "error",
      title: "Rimuovi le reti inserite",
      description:
        "Una partita a tavolino non genera gol individuali.",
    });
  }

  if (
    Object.keys(data.performances).length > 0
  ) {
    results.push({
      id: "walkover-performances",
      severity: "error",
      title: "Rimuovi le prestazioni",
      description:
        "Una partita a tavolino non assegna voti o provvedimenti individuali.",
    });
  }

  if (data.mvpPlayerId) {
    results.push({
      id: "walkover-mvp",
      severity: "error",
      title: "Rimuovi il Player of the Match",
      description:
        "Una partita a tavolino non assegna il premio MVP.",
    });
  }

  results.push({
    id: "walkover-clean-sheet",
    severity: "success",
    title: "Clean sheet disattivati",
    description:
      "La partita a tavolino non assegnerà punti clean sheet.",
  });

  if (
    !results.some(
      (result) => result.severity === "error",
    )
  ) {
    results.unshift({
      id: "walkover-valid",
      severity: "success",
      title: "Vittoria a tavolino pronta",
      description:
        "Risultato e presenze automatiche sono coerenti.",
    });
  }
}

function validateAttendance(
  data: MatchWizardData,
  results: MatchValidationResult[],
) {
  if (data.homePresentPlayerIds.length === 0) {
    results.push({
      id: "home-attendance",
      severity: "error",
      title:
        "Nessun presente nella squadra di casa",
    });
  }

  if (data.awayPresentPlayerIds.length === 0) {
    results.push({
      id: "away-attendance",
      severity: "error",
      title:
        "Nessun presente nella squadra ospite",
    });
  }

  const duplicatedIds =
    data.homePresentPlayerIds.filter((playerId) =>
      data.awayPresentPlayerIds.includes(playerId),
    );

  if (duplicatedIds.length > 0) {
    results.push({
      id: "duplicated-players",
      severity: "error",
      title: "Giocatore presente in entrambe le squadre",
    });
  }
}

function validatePerformances(
  data: MatchWizardData,
  allPlayers: MatchValidationPlayer[],
  results: MatchValidationResult[],
) {
  const presentPlayerIds = [
    ...data.homePresentPlayerIds,
    ...data.awayPresentPlayerIds,
  ];

  presentPlayerIds.forEach((playerId) => {
    const player = allPlayers.find(
      (item) => String(item.id) === String(playerId),
    );

    const performance =
      data.performances[playerId];

    if (!performance) {
      results.push({
        id: `performance-${playerId}`,
        severity: "error",
        title: `Prestazione mancante: ${
          player?.name ?? `Giocatore ${playerId}`
        }`,
      });

      return;
    }

    if (
      performance.status === "rated" &&
      performance.vote === undefined
    ) {
      results.push({
        id: `vote-${playerId}`,
        severity: "error",
        title: `Voto mancante: ${
          player?.name ?? `Giocatore ${playerId}`
        }`,
      });
    }

    if (
      performance.vote !== undefined &&
      (performance.vote < 4 ||
        performance.vote > 10)
    ) {
      results.push({
        id: `invalid-vote-${playerId}`,
        severity: "error",
        title: `Voto non valido: ${
          player?.name ?? `Giocatore ${playerId}`
        }`,
      });
    }
  });
}

function validateMvp(
  data: MatchWizardData,
  results: MatchValidationResult[],
) {
  if (!data.mvpPlayerId) {
    results.push({
      id: "mvp-missing",
      severity: "warning",
      title: "MVP non selezionato",
      description:
        "Puoi pubblicare il tabellino, ma è consigliato scegliere il Player of the Match.",
    });

    return;
  }

  const presentPlayerIds = [
    ...data.homePresentPlayerIds,
    ...data.awayPresentPlayerIds,
  ];

  if (
    !presentPlayerIds.includes(data.mvpPlayerId)
  ) {
    results.push({
      id: "invalid-mvp",
      severity: "error",
      title: "MVP non presente in distinta",
    });
  }
}

function validateGoals(
  data: MatchWizardData,
  allPlayers: MatchValidationPlayer[],
  homeTeam: Team,
  awayTeam: Team,
  results: MatchValidationResult[],
) {
  data.goals.forEach((goal) => {
    const scorer = allPlayers.find(
      (player) =>
        String(player.id) === String(goal.scorerPlayerId),
    );

const goalTeamIsValid =
  String(goal.teamId) ===
    String(homeTeam.id) ||
  String(goal.teamId) ===
    String(awayTeam.id);

if (!goalTeamIsValid) {
  results.push({
    id: `goal-team-${goal.id}`,
    severity: "error",
    title: "Squadra della rete non valida",
  });
}

    if (!scorer) {
      results.push({
        id: `goal-scorer-${goal.id}`,
        severity: "error",
        title: "Marcatore non trovato",
      });
    }

    if (goal.minute < 1 || goal.minute > 99) {
      results.push({
        id: `goal-minute-${goal.id}`,
        severity: "error",
        title: "Minuto della rete non valido",
      });
    }

   if (
  goal.stoppageTime !== undefined &&
  (
    goal.stoppageTime < 0 ||
    goal.stoppageTime > 20
  )
) {
  results.push({
    id: `goal-stoppage-time-${goal.id}`,
    severity: "error",
    title: "Recupero della rete non valido",
    description:
      "Il recupero deve essere compreso tra 0 e 20 minuti.",
  });
}

    if (
      goal.type === "ownGoal" &&
      goal.assistPlayerId
    ) {
      results.push({
        id: `own-goal-assist-${goal.id}`,
        severity: "error",
        title:
          "Un’autorete non può avere un assist",
      });
    }

    if (
      goal.assistPlayerId ===
      goal.scorerPlayerId
    ) {
      results.push({
        id: `self-assist-${goal.id}`,
        severity: "error",
        title:
          "Marcatore e assistman coincidono",
      });
    }
  });
}

function validateGoalkeepers(
  data: MatchWizardData,
  allPlayers: MatchValidationPlayer[],
  homeTeam: Team,
  awayTeam: Team,
  results: MatchValidationResult[],
) {
  validateTeamGoalkeepers(
    data.homePresentPlayerIds,
    data,
    allPlayers,
    awayTeam.id,
    data.awayScore,
    homeTeam.name,
    results,
  );

  validateTeamGoalkeepers(
    data.awayPresentPlayerIds,
    data,
    allPlayers,
    homeTeam.id,
    data.homeScore,
    awayTeam.name,
    results,
  );
}

function validateTeamGoalkeepers(
  presentPlayerIds: string[],
  data: MatchWizardData,
  allPlayers: MatchValidationPlayer[],
  opponentTeamId: string | number,
  opponentScore: number,
  teamName: string,
  results: MatchValidationResult[],
) {
  const goalkeepers = presentPlayerIds
    .map((playerId) =>
      allPlayers.find(
        (player) => String(player.id) === String(playerId),
      ),
    )
    .filter(
      (
        player,
      ): player is MatchValidationPlayer =>
        player !== undefined,
    )
    .filter((player) => {
      if (player.role === "Portiere") {
        return true;
      }

      return (
        data.performances[String(player.id)]
          ?.goalsConceded !== undefined ||
        data.performances[player.id]
          ?.goalsConceded !== undefined
      );
    });

  if (goalkeepers.length === 0) {
    results.push({
      id: `goalkeeper-${teamName}`,
      severity: "warning",
      title: `Nessun portiere selezionato per ${teamName}`,
    });

    return;
  }

  const totalGoalsConceded =
    goalkeepers.reduce((total, goalkeeper) => {
      const performance =
        data.performances[String(goalkeeper.id)] ??
        data.performances[goalkeeper.id];

      return (
        total +
        (performance?.goalsConceded ?? 0)
      );
    }, 0);

  if (totalGoalsConceded !== opponentScore) {
    results.push({
      id: `goals-conceded-${teamName}`,
      severity: "error",
      title: `Reti subite non coerenti: ${teamName}`,
      description: `Risultato avversario: ${opponentScore}. Reti subite attribuite ai portieri: ${totalGoalsConceded}.`,
    });
  }

  const opponentGoals = getPerformanceGoalsForTeam(
    data,
    opponentTeamId,
  );

  if (opponentGoals !== opponentScore) {
    return;
  }
}

function getPerformanceGoalsForTeam(
  data: MatchWizardData,
  teamId: string | number,
): number {
  return data.goals.filter(
    (goal) =>
      String(goal.teamId) ===
      String(teamId),
  ).length;
}