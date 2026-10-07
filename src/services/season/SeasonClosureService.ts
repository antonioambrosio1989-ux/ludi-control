import {
  calculateStandings,
  type StandingRow,
} from "@/src/services/standings/StandingsCalculator";

import {
  FirebaseMatchRepository,
} from "@/src/services/match/FirebaseMatchRepository";

import {
  FirebaseMatchReportRepository,
  type CloudMatchReport,
} from "@/src/services/match/FirebaseMatchReportRepository";

import {
  RegularSeasonDisciplineClosureService,
} from "@/src/services/discipline/RegularSeasonDisciplineClosureService";

import {
  FirebaseSeasonTeamRepository,
} from "@/src/services/team/FirebaseSeasonTeamRepository";

import {
  FirebaseFinalStageMatchRepository,
} from "@/src/services/final-stage/FirebaseFinalStageMatchRepository";

import {
  FirebaseFinalStagePlayerRepository,
} from "@/src/services/final-stage/FirebaseFinalStagePlayerRepository";

import {
  validateFinalStageClosure,
  getFinalStageClosureCompetitionLabel,
} from "@/src/services/final-stage/FinalStageClosureValidator";

import {
  CHAMPIONSHIP_FULL_TEAM_COUNT,
} from "@/src/services/final-stage/FinalStageCompetitionAssignmentResolver";

import {
  FirebaseSeasonRepository,
} from "@/src/services/season/FirebaseSeasonRepository";

import {
  FirebaseTeamRepository,
} from "@/src/services/team/FirebaseTeamRepository";

import {
  PlayerAchievementsService,
} from "@/src/services/player/PlayerAchievementsService";

import type {
  FinalStageCompetition,
  FinalStageMatch,
} from "@/src/types/FinalStageMatch";

import type {
  Match,
} from "@/src/types/Match";

/*
 * ============================================================
 * RISULTATI CHIUSURA
 * ============================================================
 */

export type RegularSeasonClosureResult = {
  seasonId: string;

  championTeamId: string;
  championTeamName: string;

  awardedPlayers:
    number;
};

export type RegularSeasonClosurePreparation =
  | {
      status:
        "readyToClose";

      seasonId:
        string;

      championCandidateTeamId:
        string;
    }
  | {
      status:
        "titlePlayoffRequired";

      seasonId:
        string;

      candidateTeamIds: [
        string,
        string,
      ];
    }
  | {
      status:
        "titlePlayoffExists";

      seasonId:
        string;

      candidateTeamIds: [
        string,
        string,
      ];

      titlePlayoff: {
        matchId:
          string;

        homeTeamId:
          string;

        awayTeamId:
          string;

        date:
          string;

        time:
          string;

        venue:
          string;

        matchStatus:
          Match["status"];

        reportPublished:
          boolean;
      };
    };

export type FinalStageClosureWinnerResult = {
  competition:
    FinalStageCompetition;

  competitionLabel:
    string;

  winnerTeamId:
    string;

  winnerTeamName:
    string;

  awardedPlayers:
    number;
};

export type FinalStageClosureResult = {
  seasonId:
    string;

  winners:
    FinalStageClosureWinnerResult[];

  totalAwardedPlayers:
    number;
};

/*
 * ============================================================
 * SERVICE
 * ============================================================
 */

export class SeasonClosureService {

  /*
 * ==========================================================
 * PREPARAZIONE CHIUSURA REGULAR SEASON
 * ==========================================================
 *
 * Metodo esclusivamente READ-ONLY.
 *
 * Non:
 * - assegna achievement;
 * - modifica la disciplina;
 * - chiude la stagione;
 * - crea lo spareggio.
 *
 * Serve esclusivamente per determinare lo stato
 * della chiusura prima dell'azione amministrativa.
 * ==========================================================
 */

static async prepareRegularSeasonClosure(
  seasonId:
    string,
): Promise<
  RegularSeasonClosurePreparation
> {
  const normalizedSeasonId =
    seasonId.trim();

  if (
    !normalizedSeasonId
  ) {
    throw new Error(
      "seasonId non valido.",
    );
  }

  /*
   * ========================================================
   * STAGIONE
   * ========================================================
   */

  const season =
    await FirebaseSeasonRepository.getById(
      normalizedSeasonId,
    );

  if (
    !season
  ) {
    throw new Error(
      "La stagione selezionata non esiste.",
    );
  }

  const competitionId =
    season.competitionId?.trim();

  if (
    !competitionId
  ) {
    throw new Error(
      "La stagione non è associata a una competizione.",
    );
  }

  if (
    season.status !==
    "active"
  ) {
    throw new Error(
      "Puoi preparare la chiusura della Regular Season soltanto durante una stagione attiva.",
    );
  }

  if (
    season.regularSeasonClosed
  ) {
    throw new Error(
      "La Regular Season è già stata chiusa.",
    );
  }

  /*
   * ========================================================
   * PARTITE
   * ========================================================
   */

  const matches =
    await FirebaseMatchRepository.getBySeason(
      normalizedSeasonId,
    );

  const regularSeasonMatches =
    matches.filter(
      (
        match,
      ) =>
        (
          match.matchType ??
          "regularSeason"
        ) ===
        "regularSeason",
    );

  const titlePlayoffMatches =
    matches.filter(
      (
        match,
      ) =>
        match.matchType ===
        "titlePlayoff",
    );

  if (
    regularSeasonMatches.length ===
    0
  ) {
    throw new Error(
      "La stagione non contiene partite di Regular Season.",
    );
  }

  /*
   * ========================================================
   * CONTROLLO REGULAR SEASON COMPLETATA
   * ========================================================
   */

  const incompleteMatches =
    regularSeasonMatches.filter(
      (
        match,
      ) =>
        match.status !==
          "played" &&
        match.status !==
          "walkover" &&
        match.status !==
          "cancelled",
    );

  if (
    incompleteMatches.length >
    0
  ) {
    throw new Error(
      `Non puoi preparare la chiusura della Regular Season: ${incompleteMatches.length} partite risultano ancora da completare.`,
    );
  }

  /*
   * ========================================================
   * REPORT PUBBLICATI
   * ========================================================
   */

  const allPublishedReports =
    await FirebaseMatchReportRepository
      .getPublishedBySeason(
        normalizedSeasonId,
      );

  const matchIds =
    new Set(
      matches.map(
        (
          match,
        ) =>
          String(
            match.id,
          ),
      ),
    );

  const reports =
    allPublishedReports.filter(
      (
        report,
      ) =>
        matchIds.has(
          String(
            report.matchId,
          ),
        ),
    );

  /*
   * ========================================================
   * SQUADRE ISCRITTE
   * ========================================================
   */

  const seasonTeams =
    await FirebaseSeasonTeamRepository
      .getBySeasonId(
        normalizedSeasonId,
      );

  const seasonTeamIds =
    seasonTeams.map(
      (
        entry,
      ) =>
        String(
          entry.teamId,
        ),
    );

  /*
   * ========================================================
   * CLASSIFICA
   * ========================================================
   */

  const standings =
    calculateStandings(
      regularSeasonMatches,
      reports,
      {
        competitionId,

        teamIds:
          seasonTeamIds,
      },
    );

  const championStanding =
    standings[0];

  if (
    !championStanding
  ) {
    throw new Error(
      "Impossibile determinare la squadra campione della Regular Season.",
    );
  }

  /*
   * ========================================================
   * CANDIDATI SPAREGGIO
   * ========================================================
   */

  const candidateTeamIds =
    getTitlePlayoffCandidateTeamIds(
      standings,
    );

  /*
   * Nessuna parità al primo posto:
   * la Regular Season può essere chiusa.
   */

  if (
    !candidateTeamIds
  ) {
    return {
      status:
        "readyToClose",

      seasonId:
        normalizedSeasonId,

      championCandidateTeamId:
        String(
          championStanding.teamId,
        ),
    };
  }

  /*
   * ========================================================
   * RICERCA SPAREGGIO ESISTENTE
   * ========================================================
   */

  const matchingPlayoffs =
    findMatchingTitlePlayoffs({
      titlePlayoffMatches,

      expectedTeamIds:
        candidateTeamIds,
    });

  if (
    matchingPlayoffs.length ===
    0
  ) {
    return {
      status:
        "titlePlayoffRequired",

      seasonId:
        normalizedSeasonId,

      candidateTeamIds,
    };
  }

  if (
    matchingPlayoffs.length >
    1
  ) {
    throw new Error(
      "Sono presenti più spareggi per il titolo tra le stesse squadre. La situazione deve essere risolta prima della chiusura della Regular Season.",
    );
  }

  const titlePlayoff =
    matchingPlayoffs[0];

  const reportPublished =
    reports.some(
      (
        report,
      ) =>
        report.status ===
          "published" &&
        String(
          report.matchId,
        ) ===
          String(
            titlePlayoff.id,
          ),
    );

  return {
    status:
      "titlePlayoffExists",

    seasonId:
      normalizedSeasonId,

    candidateTeamIds,

    titlePlayoff: {
      matchId:
        String(
          titlePlayoff.id,
        ),

      homeTeamId:
        String(
          titlePlayoff.homeTeamId,
        ),

      awayTeamId:
        String(
          titlePlayoff.awayTeamId,
        ),

      date:
        titlePlayoff.date,

      time:
        titlePlayoff.time,

      venue:
        titlePlayoff.venue,

      matchStatus:
        titlePlayoff.status,

      reportPublished,
    },
  };
}

  /*
   * ==========================================================
   * CHIUSURA REGULAR SEASON
   * ==========================================================
   */

  static async closeRegularSeason(
    seasonId:
      string,
  ): Promise<
    RegularSeasonClosureResult
  > {
    const normalizedSeasonId =
      seasonId.trim();

    if (
      !normalizedSeasonId
    ) {
      throw new Error(
        "seasonId non valido.",
      );
    }

    /*
     * ========================================================
     * STAGIONE
     * ========================================================
     */

    const season =
      await FirebaseSeasonRepository.getById(
        normalizedSeasonId,
      );

    if (
      !season
    ) {
      throw new Error(
        "La stagione selezionata non esiste.",
      );
    }

    const competitionId =
  season.competitionId?.trim();

if (
  !competitionId
) {
  throw new Error(
    "La stagione non è associata a una competizione.",
  );
}

    if (
      season.status !==
      "active"
    ) {
      throw new Error(
        "Puoi chiudere la Regular Season soltanto durante una stagione attiva.",
      );
    }

    if (
      season.regularSeasonClosed
    ) {
      throw new Error(
        "La Regular Season è già stata chiusa.",
      );
    }

    /*
     * ========================================================
     * PARTITE REGULAR SEASON
     * ========================================================
     */

    const matches =
      await FirebaseMatchRepository.getBySeason(
        normalizedSeasonId,
      );

      const regularSeasonMatches =
  matches.filter(
    (
      match,
    ) =>
      (
        match.matchType ??
        "regularSeason"
      ) ===
      "regularSeason",
  );

const titlePlayoffMatches =
  matches.filter(
    (
      match,
    ) =>
      match.matchType ===
      "titlePlayoff",
  );

    if (
  regularSeasonMatches.length ===
  0
) {
      throw new Error(
        "La stagione non contiene partite di Regular Season.",
      );
    }

    /*
     * ========================================================
     * REPORT PUBBLICATI
     * ========================================================
     */

    const allPublishedReports =
      await FirebaseMatchReportRepository.getPublishedBySeason(
        normalizedSeasonId,
      );

    const matchIds =
      new Set(
        matches.map(
          (
            match,
          ) =>
            String(
              match.id,
            ),
        ),
      );

    const reports =
      allPublishedReports.filter(
        (
          report,
        ) =>
          matchIds.has(
            String(
              report.matchId,
            ),
          ),
      );

    /*
     * ========================================================
     * CONTROLLO PARTITE CONCLUSE
     * ========================================================
     *
     * Prima di chiudere la Regular Season
     * tutte le partite non rinviate/cancellate
     * devono essere state completate.
     * ========================================================
     */

    const incompleteMatches =
      regularSeasonMatches.filter(
        (
          match,
        ) =>
          match.status !==
            "played" &&
          match.status !==
            "walkover" &&
          match.status !==
            "cancelled",
      );

    if (
      incompleteMatches.length >
      0
    ) {
      throw new Error(
        `Non puoi chiudere la Regular Season: ${incompleteMatches.length} partite risultano ancora da completare.`,
      );
    }

      /*
 * ========================================================
 * SQUADRE ISCRITTE
 * ========================================================
 */

const seasonTeams =
  await FirebaseSeasonTeamRepository
    .getBySeasonId(
      normalizedSeasonId,
    );

const seasonTeamIds =
  seasonTeams.map(
    (
      entry,
    ) =>
      String(
        entry.teamId,
      ),
  );
  
  /*
     * ========================================================
     * CLASSIFICA DEFINITIVA
     * ========================================================
     */

    const standings =
  calculateStandings(
    regularSeasonMatches,
    reports,
    {
      competitionId,

      teamIds:
        seasonTeamIds,
    },
  );

    const championStanding =
      standings[0];

    if (
      !championStanding
    ) {
      throw new Error(
        "Impossibile determinare la squadra campione della Regular Season.",
      );
    }

/*
 * ========================================================
 * DETERMINAZIONE CAMPIONE REGULAR SEASON
 * ========================================================
 *
 * Nessuna parità:
 * - il campione coincide con il primo classificato.
 *
 * Parità al primo posto:
 * - la selezione delle due squadre ammesse allo spareggio
 *   viene centralizzata nell'helper dedicato.
 *
 * Il titlePlayoff non modifica la classifica,
 * ma determina esclusivamente la squadra campione.
 * ========================================================
 */

const playoffCandidateTeamIds =
  getTitlePlayoffCandidateTeamIds(
    standings,
  );

let championTeamId =
  String(
    championStanding.teamId,
  );

if (
  playoffCandidateTeamIds
) {
  championTeamId =
    resolveTitlePlayoffWinner({
      titlePlayoffMatches,

      reports,

      expectedTeamIds:
        playoffCandidateTeamIds,
    });
}

    /*
     * ========================================================
     * SQUADRA CAMPIONE
     * ========================================================
     */

    const championTeam =
      await FirebaseTeamRepository.getById(
        championTeamId,
      );

    if (
      !championTeam
    ) {
      throw new Error(
        "La squadra campione non è presente nel database.",
      );
    }

    /*
     * ========================================================
     * LISTA UFFICIALE AMMESSI
     * ========================================================
     */

    const eligiblePlayers =
      await FirebaseFinalStagePlayerRepository.getByTeam({
        seasonId:
          normalizedSeasonId,

        teamId:
          championTeamId,
      });

    if (
      eligiblePlayers.length ===
      0
    ) {
      throw new Error(
        `Non è stata ancora salvata la lista dei giocatori ammessi alle fasi finali per ${championTeam.name}.`,
      );
    }

    /*
     * ========================================================
     * ASSEGNAZIONE ACHIEVEMENT
     * ========================================================
     *
     * IMPORTANTISSIMO:
     *
     * il titolo viene assegnato PRIMA
     * della chiusura ufficiale.
     *
     * Se questa operazione fallisce,
     * regularSeasonClosed rimane false.
     * ========================================================
     */

   await PlayerAchievementsService.assignRegularSeasonChampion({
  seasonId:
    normalizedSeasonId,

  seasonLabel:
    season.name,

  competitionId,

  teamId:
    championTeamId,

  teamName:
    championTeam.name,

  eligiblePlayers,
});

/*
 * ========================================================
 * CHIUSURA DISCIPLINARE REGULAR SEASON
 * ========================================================
 *
 * Lo spareggio per il titolo appartiene disciplinarmente
 * alla Regular Season.
 *
 * Alla conclusione:
 *
 * - ammonizioni disciplinari → nuovo ciclo;
 * - squalifiche per somma ammonizioni → annullate;
 * - squalifiche per rosso diretto → annullate;
 * - squalifiche del giudice sportivo → conservate.
 * ========================================================
 */

await RegularSeasonDisciplineClosureService
  .close({
    seasonId:
      normalizedSeasonId,
  });

  

/*
 * ========================================================
 * CHIUSURA UFFICIALE
 * ========================================================
 */

await FirebaseSeasonRepository.closeRegularSeason(
  normalizedSeasonId,
);

    return {
      seasonId:
        normalizedSeasonId,

      championTeamId,

      championTeamName:
        championTeam.name,

      awardedPlayers:
        eligiblePlayers.length,
    };
  }

  static async closeFinalStage(
  seasonId:
    string,
): Promise<
  FinalStageClosureResult
> {
  const normalizedSeasonId =
    seasonId.trim();

  if (
    !normalizedSeasonId
  ) {
    throw new Error(
      "seasonId non valido.",
    );
  }

  /*
   * ==========================================================
   * STAGIONE
   * ==========================================================
   */

  const season =
    await FirebaseSeasonRepository.getById(
      normalizedSeasonId,
    );

  if (
    !season
  ) {
    throw new Error(
      "La stagione selezionata non esiste.",
    );
  }

  const competitionId =
    season.competitionId?.trim();

  if (
    !competitionId
  ) {
    throw new Error(
      "La stagione non è associata a una competizione.",
    );
  }

  if (
    season.status !==
    "active"
  ) {
    throw new Error(
      "Puoi chiudere le fasi finali soltanto durante una stagione attiva.",
    );
  }

  if (
    !season.regularSeasonClosed
  ) {
    throw new Error(
      "Devi prima chiudere la Regular Season.",
    );
  }

  if (
    season.finalStageClosed
  ) {
    throw new Error(
      "Le fasi finali sono già state chiuse.",
    );
  }

  /*
   * ==========================================================
   * SQUADRE ISCRITTE
   * ==========================================================
   */

  const seasonTeams =
    await FirebaseSeasonTeamRepository
      .getBySeasonId(
        normalizedSeasonId,
      );

  if (
    seasonTeams.length ===
    0
  ) {
    throw new Error(
      "La stagione non contiene squadre registrate.",
    );
  }

  /*
   * ==========================================================
   * PARTITE FINAL STAGE
   * ==========================================================
   */

  const finalStageMatches =
    await FirebaseFinalStageMatchRepository
      .getBySeason(
        normalizedSeasonId,
      );

  if (
    finalStageMatches.length ===
    0
  ) {
    throw new Error(
      "Non sono presenti partite delle fasi finali.",
    );
  }

  /*
   * ==========================================================
   * COMPETIZIONI RICHIESTE
   * ==========================================================
   */

  const requiredCompetitions =
    resolveRequiredFinalStageCompetitionsForClosure({
      competitionId,

      seasonTeamCount:
        seasonTeams.length,

      finalStageMatches,
    });

  /*
   * ==========================================================
   * VALIDAZIONE COMPLETA
   * ==========================================================
   *
   * Qui controlliamo:
   *
   * - tutte le competizioni richieste;
   * - tutte le partite concluse;
   * - tutti i tabellini pubblicati;
   * - finale presente;
   * - finale in gara singola;
   * - vincitore determinabile;
   * - assenza di competizioni estranee.
   * ==========================================================
   */

  const validation =
    validateFinalStageClosure({
      matches:
        finalStageMatches,

      requiredCompetitions,
    });

  /*
   * ==========================================================
   * PREPARAZIONE VINCITORI
   * ==========================================================
   *
   * IMPORTANTISSIMO:
   *
   * prima di effettuare qualsiasi mutazione recuperiamo
   * e validiamo TUTTE le squadre vincitrici.
   *
   * In questo modo non chiudiamo una stagione a metà
   * se manca qualche dato.
   * ==========================================================
   */

  const preparedWinners =
    await Promise.all(
      validation.winners.map(
        async (
          winner,
        ) => {
          const team =
            await FirebaseTeamRepository
              .getById(
                winner.winnerTeamId,
              );

          if (
            !team
          ) {
            throw new Error(
              `La squadra vincitrice di ${getFinalStageClosureCompetitionLabel(
                winner.competition,
              )} non è presente nel database.`,
            );
          }

          /*
           * ====================================================
           * PALMARÈS GIOCATORI
           * ====================================================
           *
           * Al momento il badge automatico individuale
           * previsto dal progetto per le Final Stage è quello
           * Champions League.
           *
           * Europa, Conference e Ludi Football League Cup
           * vengono comunque validate e chiuse, ma non
           * inventiamo nuovi achievement non ancora previsti.
           * ====================================================
           */

          if (
            winner.competition !==
            "championsLeague"
          ) {
            return {
              competition:
                winner.competition,

              competitionLabel:
                getFinalStageClosureCompetitionLabel(
                  winner.competition,
                ),

              winnerTeamId:
                winner.winnerTeamId,

              winnerTeamName:
                team.name,

              awardedPlayers:
                0,

              eligiblePlayers:
                [],
            };
          }

          const eligiblePlayers =
            await FirebaseFinalStagePlayerRepository
              .getByTeam({
                seasonId:
                  normalizedSeasonId,

                teamId:
                  winner.winnerTeamId,
              });

          if (
            eligiblePlayers.length ===
            0
          ) {
            throw new Error(
              `Non è disponibile la lista dei giocatori ammessi alle fasi finali per ${team.name}.`,
            );
          }

          return {
            competition:
              winner.competition,

            competitionLabel:
              getFinalStageClosureCompetitionLabel(
                winner.competition,
              ),

            winnerTeamId:
              winner.winnerTeamId,

            winnerTeamName:
              team.name,

            awardedPlayers:
              eligiblePlayers.length,

            eligiblePlayers,
          };
        },
      ),
    );

  /*
   * ==========================================================
   * ACHIEVEMENT CHAMPIONS LEAGUE
   * ==========================================================
   */

  const championsWinner =
    preparedWinners.find(
      (
        winner,
      ) =>
        winner.competition ===
        "championsLeague",
    );

  if (
    championsWinner
  ) {
    await PlayerAchievementsService
      .assignChampionsLeagueWinner({
        seasonId:
          normalizedSeasonId,

        seasonLabel:
          season.name,

        competitionId,

        teamId:
          championsWinner.winnerTeamId,

        teamName:
          championsWinner.winnerTeamName,

        eligiblePlayers:
          championsWinner.eligiblePlayers,
      });
  }

  /*
   * ==========================================================
   * CHIUSURA UFFICIALE
   * ==========================================================
   *
   * Arriviamo qui solamente dopo aver validato
   * l'intera Final Stage.
   * ==========================================================
   */

  await FirebaseSeasonRepository
    .closeFinalStage(
      normalizedSeasonId,
    );

  /*
   * ==========================================================
   * RESULT
   * ==========================================================
   */

  const winners:
    FinalStageClosureWinnerResult[] =
      preparedWinners.map(
        (
          winner,
        ) => ({
          competition:
            winner.competition,

          competitionLabel:
            winner.competitionLabel,

          winnerTeamId:
            winner.winnerTeamId,

          winnerTeamName:
            winner.winnerTeamName,

          awardedPlayers:
            winner.awardedPlayers,
        }),
      );

  return {
    seasonId:
      normalizedSeasonId,

    winners,

    totalAwardedPlayers:
      winners.reduce(
        (
          total,
          winner,
        ) =>
          total +
          winner.awardedPlayers,

        0,
      ),
  };
}
}

/*
 * ============================================================
 * SQUADRE AMMESSE ALLO SPAREGGIO PER IL TITOLO
 * ============================================================
 *
 * Regole:
 *
 * - meno di 2 squadre a pari punti al primo posto:
 *   nessuno spareggio.
 *
 * - esattamente 2 squadre:
 *   spareggio tra entrambe.
 *
 * - 3 o più squadre:
 *   spareggio tra le due con migliore differenza reti.
 *
 * - se seconda e terza hanno la stessa differenza reti:
 *   fail-closed, perché il regolamento non permette
 *   di scegliere arbitrariamente la seconda partecipante.
 * ============================================================
 */

function getTitlePlayoffCandidateTeamIds(
  standings:
    StandingRow[],
):
  | [
      string,
      string,
    ]
  | undefined {
  const firstStanding =
    standings[0];

  if (
    !firstStanding
  ) {
    throw new Error(
      "Impossibile determinare la squadra campione della Regular Season.",
    );
  }

  const topPoints =
    firstStanding.points;

  const teamsTiedForFirst =
    standings.filter(
      (
        standing,
      ) =>
        standing.points ===
        topPoints,
    );

  /*
   * Nessuno spareggio.
   */

  if (
    teamsTiedForFirst.length <
    2
  ) {
    return undefined;
  }

  /*
   * ========================================================
   * DUE SQUADRE
   * ========================================================
   */

  if (
    teamsTiedForFirst.length ===
    2
  ) {
    return [
      String(
        teamsTiedForFirst[0]
          .teamId,
      ),

      String(
        teamsTiedForFirst[1]
          .teamId,
      ),
    ];
  }

  /*
   * ========================================================
   * TRE O PIÙ SQUADRE
   * ========================================================
   */

  const playoffCandidates =
    [
      ...teamsTiedForFirst,
    ].sort(
      (
        first,
        second,
      ) =>
        second.goalDifference -
        first.goalDifference,
    );

  const firstCandidate =
    playoffCandidates[0];

  const secondCandidate =
    playoffCandidates[1];

  const thirdCandidate =
    playoffCandidates[2];

  if (
    !firstCandidate ||
    !secondCandidate
  ) {
    throw new Error(
      "Impossibile determinare le squadre ammesse allo spareggio.",
    );
  }

  /*
   * Il regolamento usa la differenza reti
   * per individuare le prime due.
   *
   * Se il confine tra seconda e terza
   * non è univoco, non scegliamo
   * arbitrariamente.
   */

  if (
    thirdCandidate &&
    secondCandidate
      .goalDifference ===
      thirdCandidate
        .goalDifference
  ) {
    throw new Error(
      "Tre o più squadre sono a pari punti al primo posto e la differenza reti non determina in modo univoco le due squadre ammesse allo spareggio. È necessario risolvere manualmente la situazione prima della chiusura.",
    );
  }

  return [
    String(
      firstCandidate.teamId,
    ),

    String(
      secondCandidate.teamId,
    ),
  ];
}

/*
 * ============================================================
 * RICERCA SPAREGGIO CORRETTO
 * ============================================================
 */

function findMatchingTitlePlayoffs({
  titlePlayoffMatches,
  expectedTeamIds,
}: {
  titlePlayoffMatches:
    Match[];

  expectedTeamIds: [
    string,
    string,
  ];
}): Match[] {
  const expectedTeams =
    new Set(
      expectedTeamIds.map(
        (
          teamId,
        ) =>
          String(
            teamId,
          ),
      ),
    );

  return titlePlayoffMatches.filter(
    (
      match,
    ) => {
      const matchTeams =
        new Set([
          String(
            match.homeTeamId,
          ),

          String(
            match.awayTeamId,
          ),
        ]);

      if (
        matchTeams.size !==
          2 ||
        expectedTeams.size !==
          2
      ) {
        return false;
      }

      return Array.from(
        expectedTeams,
      ).every(
        (
          teamId,
        ) =>
          matchTeams.has(
            teamId,
          ),
      );
    },
  );
}

/*
 * ============================================================
 * VINCITORE SPAREGGIO REGULAR SEASON
 * ============================================================
 */

function resolveTitlePlayoffWinner({
  titlePlayoffMatches,
  reports,
  expectedTeamIds,
}: {
  titlePlayoffMatches:
    Match[];

  reports:
    CloudMatchReport[];

  expectedTeamIds:
    string[];
}): string {
  if (
    expectedTeamIds.length !==
    2
  ) {
    throw new Error(
      "Lo spareggio per il titolo deve coinvolgere esattamente due squadre.",
    );
  }

  const expectedTeams =
    new Set(
      expectedTeamIds.map(
        (
          teamId,
        ) =>
          String(
            teamId,
          ),
      ),
    );

  /*
   * ========================================================
   * RICERCA DELLO SPAREGGIO CORRETTO
   * ========================================================
   */

  const matchingPlayoffs =
  findMatchingTitlePlayoffs({
    titlePlayoffMatches,

    expectedTeamIds: [
      String(
        expectedTeamIds[0],
      ),

      String(
        expectedTeamIds[1],
      ),
    ],
  });

  if (
    matchingPlayoffs.length ===
    0
  ) {
    throw new Error(
      "È necessario creare e disputare lo spareggio per il titolo tra le due squadre aventi diritto.",
    );
  }

  if (
    matchingPlayoffs.length >
    1
  ) {
    throw new Error(
      "Sono presenti più spareggi per il titolo tra le stesse squadre. La situazione deve essere risolta prima della chiusura della Regular Season.",
    );
  }

  const playoff =
    matchingPlayoffs[0];

  /*
   * ========================================================
   * STATO PARTITA
   * ========================================================
   */

  if (
    playoff.status !==
      "played" &&
    playoff.status !==
      "walkover"
  ) {
    throw new Error(
      "Lo spareggio per il titolo non risulta ancora concluso.",
    );
  }

  /*
   * ========================================================
   * REPORT PUBBLICATO
   * ========================================================
   */

  const report =
    reports.find(
      (
        currentReport,
      ) =>
        currentReport.status ===
          "published" &&
        String(
          currentReport.matchId,
        ) ===
          String(
            playoff.id,
          ),
    );

  if (
    !report
  ) {
    throw new Error(
      "Il tabellino dello spareggio per il titolo non è stato ancora pubblicato.",
    );
  }

  /*
   * ========================================================
   * VITTORIA A TAVOLINO
   * ========================================================
   */

  if (
    playoff.status ===
      "walkover" ||
    report.data.status ===
      "walkover"
  ) {
    const walkoverWinnerTeamId =
      report.data
        .walkoverWinnerTeamId;

    if (
      walkoverWinnerTeamId ===
        undefined
    ) {
      throw new Error(
        "Lo spareggio risulta assegnato a tavolino ma non è stata indicata la squadra vincente.",
      );
    }

    const normalizedWinnerTeamId =
      String(
        walkoverWinnerTeamId,
      );

    if (
      !expectedTeams.has(
        normalizedWinnerTeamId,
      )
    ) {
      throw new Error(
        "La squadra vincitrice a tavolino non coincide con una delle squadre ammesse allo spareggio.",
      );
    }

    return normalizedWinnerTeamId;
  }

  /*
   * ========================================================
   * RISULTATO REGOLAMENTARE
   * ========================================================
   */

  const homeScore =
    Number(
      report.data.homeScore,
    );

  const awayScore =
    Number(
      report.data.awayScore,
    );

  if (
    !Number.isFinite(
      homeScore,
    ) ||
    !Number.isFinite(
      awayScore,
    )
  ) {
    throw new Error(
      "Il risultato dello spareggio non è valido.",
    );
  }

  if (
    homeScore >
    awayScore
  ) {
    return String(
      playoff.homeTeamId,
    );
  }

  if (
    awayScore >
    homeScore
  ) {
    return String(
      playoff.awayTeamId,
    );
  }

  /*
   * ========================================================
   * CALCI DI RIGORE
   * ========================================================
   */

  const homePenalties =
    report.data.homePenalties;

  const awayPenalties =
    report.data.awayPenalties;

  if (
    typeof homePenalties !==
      "number" ||
    typeof awayPenalties !==
      "number"
  ) {
    throw new Error(
      "Lo spareggio è terminato in parità ma il risultato dei calci di rigore non è disponibile.",
    );
  }

  if (
    !Number.isFinite(
      homePenalties,
    ) ||
    !Number.isFinite(
      awayPenalties,
    )
  ) {
    throw new Error(
      "Il risultato dei calci di rigore non è valido.",
    );
  }

  if (
    homePenalties ===
    awayPenalties
  ) {
    throw new Error(
      "Il risultato dei calci di rigore non determina una squadra vincente.",
    );
  }

  return homePenalties >
    awayPenalties
    ? String(
        playoff.homeTeamId,
      )
    : String(
        playoff.awayTeamId,
      );
}

/*
 * ============================================================
 * RICERCA FINALE CHAMPIONS
 * ============================================================
 */

/*
 * ============================================================
 * COMPETIZIONI RICHIESTE ALLA CHIUSURA
 * ============================================================
 */

function resolveRequiredFinalStageCompetitionsForClosure({
  competitionId,
  seasonTeamCount,
  finalStageMatches,
}: {
  competitionId:
    string;

  seasonTeamCount:
    number;

  finalStageMatches:
    FinalStageMatch[];
}): FinalStageCompetition[] {
  /*
   * ==========================================================
   * PREMIER LEAGUE
   * ==========================================================
   */

  if (
    competitionId ===
    "premier-league"
  ) {
    return [
      "championsLeague",
    ];
  }

  /*
   * ==========================================================
   * CHAMPIONSHIP
   * ==========================================================
   *
   * 16 squadre:
   * Europa + Conference
   *
   * meno di 16:
   * solo Europa
   * ==========================================================
   */

  if (
    competitionId ===
    "championship"
  ) {
    if (
      seasonTeamCount >=
      CHAMPIONSHIP_FULL_TEAM_COUNT
    ) {
      return [
        "europaLeague",
        "conferenceLeague",
      ];
    }

    return [
      "europaLeague",
    ];
  }

  /*
   * ==========================================================
   * LEAGUE ONE
   * ==========================================================
   *
   * La Final Stage della League One può essere:
   *
   * - Ludi Football League Cup
   *
   * oppure
   *
   * - Conference League riciclata.
   *
   * Non possono esistere entrambe.
   * ==========================================================
   */

  if (
    competitionId ===
    "league-one"
  ) {
    const activeCompetitions =
      new Set(
        finalStageMatches
          .filter(
            (
              match,
            ) =>
              match.status !==
              "cancelled",
          )
          .map(
            (
              match,
            ) =>
              match.competition,
          ),
      );

    const hasLudiCup =
      activeCompetitions.has(
        "ludiFootballLeagueCup",
      );

    const hasConference =
      activeCompetitions.has(
        "conferenceLeague",
      );

    if (
      hasLudiCup &&
      hasConference
    ) {
      throw new Error(
        "La League One non può avere contemporaneamente Ludi Football League Cup e Conference League.",
      );
    }

    if (
      hasLudiCup
    ) {
      return [
        "ludiFootballLeagueCup",
      ];
    }

    if (
      hasConference
    ) {
      return [
        "conferenceLeague",
      ];
    }

    throw new Error(
      "Non è stata trovata la competizione prevista per le fasi finali della League One.",
    );
  }

  /*
   * ==========================================================
   * COMPETIZIONE NON SUPPORTATA
   * ==========================================================
   */

  throw new Error(
    `La competizione ${competitionId} non dispone di una configurazione Final Stage supportata.`,
  );
}