"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

import { useTeams } from "@/src/hooks/useTeams";
import { usePlayers } from "@/src/hooks/usePlayers";
import { useSeasonPlayers } from "@/src/hooks/useSeasonPlayers";

import { MatchReportStorage } from "@/src/services/match/MatchReportStorage";

import AppShell from "../../ui/AppShell";

import {
  resolveFinalStageQualification,
} from "@/src/services/final-stage/FinalStageQualificationResolver";

import type { MatchWizardStep } from "./MatchStep";
import type { Match } from "@/src/types/Match";
import type { MatchWizardData } from "@/src/types/MatchWizardData";

import MatchInfoStep from "./steps/MatchInfoStep";

import {
  FirebaseMatchReportRepository,
} from "@/src/services/match/FirebaseMatchReportRepository";

import {
  FirebaseMatchRepository,
} from "@/src/services/match/FirebaseMatchRepository";

import {
  PublishMatchService,
} from "@/src/application/match-publishing";

import {
  FirebaseFinalStageMatchReportRepository,
} from "@/src/services/final-stage/FirebaseFinalStageMatchReportRepository";

import {
  FirebaseFinalStageMatchRepository,
} from "@/src/services/final-stage/FirebaseFinalStageMatchRepository";

import {
  FirebaseFinalStagePlayerRepository,
} from "@/src/services/final-stage/FirebaseFinalStagePlayerRepository";

import {
  PublishFinalStageMatchService,
} from "@/src/application/match-publishing/PublishFinalStageMatchService";

import type {
  FinalStageMatch,
} from "@/src/types/FinalStageMatch";

function MatchStepLoading() {
  return (
    <div role="status" className="ludi-card p-5 text-sm font-bold text-[#06142E]/60">
      Caricamento del passaggio...
    </div>
  );
}

const AttendanceStep = dynamic(() => import("./steps/AttendanceStep"), {
  loading: MatchStepLoading,
});

const PerformanceStep = dynamic(() => import("./steps/PerformanceStep"), {
  loading: MatchStepLoading,
});

const ReviewStep = dynamic(() => import("./steps/ReviewStep"), {
  loading: MatchStepLoading,
});

type CloudSyncStatus =
  | "loading"
  | "saved"
  | "saving"
  | "offline"
  | "error";

type Props = {
  matchId: string;

  mode?:
  | "regularSeason"
  | "finalStage";
};

export default function AdminMatchWizard({
  matchId,
  mode = "regularSeason",
}: Props) {
  const router = useRouter();

  const {
    teams,
    isLoading: teamsLoading,
    error: teamsError,
  } = useTeams();

  const {
    isLoading: playersLoading,
    error: playersError,
    refresh: refreshPlayers,
  } = usePlayers();

  const [
    match,
    setMatch,
  ] = useState<Match | FinalStageMatch | null>(
    null,
  );

  const isFinalStage =
    mode === "finalStage";

  const {
    seasonPlayers,
    isLoading: seasonPlayersLoading,
    refresh: refreshSeasonPlayers,
  } = useSeasonPlayers(
    match?.seasonId,
  );

  async function refreshMatchRosterData() {
    await Promise.all([
      refreshPlayers(),
      refreshSeasonPlayers(),
    ]);
  }

  const [
  finalStagePlayers,
  setFinalStagePlayers,
] =
  useState<
    Awaited<
      ReturnType<
        typeof FirebaseFinalStagePlayerRepository.getBySeason
      >
    >
  >(
    [],
  );

const [
  finalStageSeasonMatches,
  setFinalStageSeasonMatches,
] =
  useState<
    FinalStageMatch[]
  >(
    [],
  );

const [
  finalStagePlayersLoading,
  setFinalStagePlayersLoading,
] =
  useState(
    false,
  );

  const [
    matchLoading,
    setMatchLoading,
  ] = useState(true);

  const [
    matchError,
    setMatchError,
  ] = useState<string | null>(
    null,
  );

  const [
    cloudSyncStatus,
    setCloudSyncStatus,
  ] =
    useState<CloudSyncStatus>(
      "loading",
    );

  const [
    publishError,
    setPublishError,
  ] = useState<string | null>(
    null,
  );

  const [publishedReportId, setPublishedReportId] = useState<string | null>(null);
  const editingPublishedReport = publishedReportId === matchId;

  const [
    draftLoaded,
    setDraftLoaded,
  ] = useState(false);

  const [
    isPublishing,
    setIsPublishing,
  ] = useState(false);

  const [
    currentStep,
    setCurrentStep,
  ] =
    useState<MatchWizardStep>(
      "match",
    );

  const [
    isResolvingWalkover,
    setIsResolvingWalkover,
  ] = useState(false);

  const [
    walkoverError,
    setWalkoverError,
  ] = useState<string | null>(
    null,
  );

  const [
    wizardData,
    setWizardData,
  ] =
    useState<MatchWizardData>(
      () => ({
        matchId,

        status: "scheduled",

        homeScore: 0,
        awayScore: 0,

        homePenalties:
  undefined,

awayPenalties:
  undefined,

        walkoverWinnerTeamId:
          undefined,

        homePresentPlayerIds:
          [],

        awayPresentPlayerIds:
          [],

        performances: {},

        goals: [],

        mvpPlayerId:
          undefined,

        mvpPhotoUrl:
          undefined,
      }),
    );

  const homeTeam = match
    ? teams.find(
        (team) =>
          String(team.id) ===
          String(
            match.homeTeamId,
          ),
      )
    : undefined;

  const awayTeam = match
    ? teams.find(
        (team) =>
          String(team.id) ===
          String(
            match.awayTeamId,
          ),
      )
    : undefined;

    const wizardRoster =
  useMemo(() => {
    if (
      isFinalStage
    ) {
      return finalStagePlayers.map(
        (
          entry,
        ) => ({
          id:
            entry.id,

          seasonId:
            entry.seasonId,

          playerId:
            entry.playerId,

          teamId:
            entry.teamId,

          role:
            entry.role,

          shirtNumber:
            entry.shirtNumber,

          status:
            "active" as const,
        }),
      );
    }

    return seasonPlayers
      .filter(
        (
          entry,
        ) =>
          entry.status !==
          "withdrawn",
      )
      .map(
        (
          entry,
        ) => ({
          id:
            entry.id,

          seasonId:
            entry.seasonId,

          playerId:
            entry.playerId,

          teamId:
            entry.teamId,

          role:
            entry.role,

          shirtNumber:
            entry.shirtNumber,

          status:
            "active" as const,
        }),
      );
  }, [
    isFinalStage,
    finalStagePlayers,
    seasonPlayers,
  ]);

  /*
   * ROSA SQUADRA CASA
   */

  const homeSeasonPlayers =
    useMemo(() => {
      if (!match) {
        return [];
      }

      return wizardRoster
  .filter(
    (entry) =>
      String(
        entry.teamId,
      ) ===
      String(
        match.homeTeamId,
      ),
  )
        .sort(
          (
            firstEntry,
            secondEntry,
          ) => {
            const firstNumber =
              firstEntry.shirtNumber ??
              Number.MAX_SAFE_INTEGER;

            const secondNumber =
              secondEntry.shirtNumber ??
              Number.MAX_SAFE_INTEGER;

            return (
              firstNumber -
              secondNumber
            );
          },
        );
    }, [
      match,
      wizardRoster,
    ]);

  /*
   * ROSA SQUADRA OSPITE
   */

  const awaySeasonPlayers =
    useMemo(() => {
      if (!match) {
        return [];
      }

      return wizardRoster
  .filter(
    (entry) =>
      String(
        entry.teamId,
      ) ===
      String(
        match.awayTeamId,
      ),
  )
        .sort(
          (
            firstEntry,
            secondEntry,
          ) => {
            const firstNumber =
              firstEntry.shirtNumber ??
              Number.MAX_SAFE_INTEGER;

            const secondNumber =
              secondEntry.shirtNumber ??
              Number.MAX_SAFE_INTEGER;

            return (
              firstNumber -
              secondNumber
            );
          },
        );
    }, [
      match,
      wizardRoster,
    ]);

    useEffect(() => {
  let active =
    true;

  async function loadFinalStagePlayers() {
    if (
      !isFinalStage ||
      !match?.seasonId
    ) {
      setFinalStagePlayers(
        [],
      );

      return;
    }

    setFinalStagePlayersLoading(
      true,
    );

    try {
      const loaded =
        await FirebaseFinalStagePlayerRepository.getBySeason(
          match.seasonId,
        );

      if (
        active
      ) {
        setFinalStagePlayers(
          loaded,
        );
      }
    } catch (
      error
    ) {
      console.error(
        "Errore caricamento rose fasi finali:",
        error,
      );
    } finally {
      if (
        active
      ) {
        setFinalStagePlayersLoading(
          false,
        );
      }
    }
  }

  void loadFinalStagePlayers();

  return () => {
    active =
      false;
  };
}, [
  isFinalStage,
  match?.seasonId,
]);

  /*
   * CARICAMENTO PARTITA
   */

  useEffect(() => {
    let isActive = true;

    async function loadMatch() {
      setMatchLoading(true);

      setMatchError(null);

      try {
        const loadedMatch =
  isFinalStage
    ? await FirebaseFinalStageMatchRepository
        .getById(
          matchId,
        )
    : await FirebaseMatchRepository
        .getById(
          matchId,
        );

        if (!isActive) {
          return;
        }

        if (!loadedMatch) {
          setMatch(null);

          setMatchError(
            "Partita non trovata.",
          );

          return;
        }

        const loadedFinalStageMatches =
  isFinalStage
    ? await FirebaseFinalStageMatchRepository
        .getBySeason(
          loadedMatch.seasonId,
        )
    : [];

if (
  !isActive
) {
  return;
}

setFinalStageSeasonMatches(
  loadedFinalStageMatches,
);

        setMatch(
          loadedMatch,
        );

        setWizardData(
          (currentData) => ({
            ...currentData,

            matchId:
              loadedMatch.id,

            status:
              loadedMatch.status,
          }),
        );
      } catch (currentError) {
        console.error(
          "Errore caricamento partita:",
          currentError,
        );

        if (!isActive) {
          return;
        }

        setMatch(null);

        setMatchError(
          currentError instanceof
            Error
            ? currentError.message
            : "Impossibile caricare la partita.",
        );
      } finally {
        if (isActive) {
          setMatchLoading(false);
        }
      }
    }

    void loadMatch();

    return () => {
      isActive = false;
    };
  }, [
    matchId,
    isFinalStage,
  ]);

  /*
   * CARICAMENTO TABELLINO
   * CLOUD / LOCALE
   */

  useEffect(() => {
    let isActive = true;

    async function loadStoredReport() {
      setCloudSyncStatus(
        "loading",
      );

      try {
        const cloudReport =
  isFinalStage
    ? await FirebaseFinalStageMatchReportRepository.getByMatchId(
        matchId,
      )
    : await FirebaseMatchReportRepository.getByMatchId(
        matchId,
      );

        if (!isActive) {
          return;
        }

        if (cloudReport) {
          setPublishedReportId(cloudReport.status === "published" ? matchId : null);
          setWizardData(
            (currentData) => ({
              ...currentData,
              ...cloudReport.data,

              matchId,
            }),
          );

          setCloudSyncStatus(
            "saved",
          );

          setDraftLoaded(true);

          return;
        }

        const localReport =
          MatchReportStorage.getByMatchId(
            matchId,
          );

        setPublishedReportId(localReport?.status === "published" ? matchId : null);
        if (localReport) {
          setWizardData(
            (currentData) => ({
              ...currentData,
              ...localReport.data,

              matchId,
            }),
          );
        }

        setCloudSyncStatus(
          "saved",
        );
      } catch (error) {
        console.error(
          "Errore caricamento Firestore:",
          error,
        );

        if (!isActive) {
          return;
        }

        const localReport =
          MatchReportStorage.getByMatchId(
            matchId,
          );

        setPublishedReportId(localReport?.status === "published" ? matchId : null);
        if (localReport) {
          setWizardData(
            (currentData) => ({
              ...currentData,
              ...localReport.data,

              matchId,
            }),
          );
        }

        setCloudSyncStatus(
          "offline",
        );
      } finally {
        if (isActive) {
          setDraftLoaded(true);
        }
      }
    }

    void loadStoredReport();

    return () => {
      isActive = false;
    };
  }, [
    matchId,
    isFinalStage,
  ]);

  /*
   * AUTOSAVE
   */

  useEffect(() => {
    if (
      !draftLoaded ||
      editingPublishedReport ||
      isPublishing
    ) {
      return;
    }

    const timeoutId =
      window.setTimeout(
        async () => {
          setCloudSyncStatus(
            "saving",
          );

          MatchReportStorage.saveDraft(
            wizardData,
          );

          try {
if (
  isFinalStage
) {
  await FirebaseFinalStageMatchReportRepository.saveDraft(
    wizardData,
  );
} else {
  await FirebaseMatchReportRepository.saveDraft(
    wizardData,
  );
}

            setCloudSyncStatus(
              "saved",
            );
          } catch (error) {
            console.error(
              "Salvataggio cloud non riuscito:",
              error,
            );

            setCloudSyncStatus(
              "offline",
            );
          }
        },
        1200,
      );

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  }, [
    wizardData,
    draftLoaded,
    editingPublishedReport,
    isPublishing,
    isFinalStage,
  ]);

  function updateWizardData(
    updates:
      Partial<MatchWizardData>,
  ) {
    setWizardData(
      (currentData) => ({
        ...currentData,
        ...updates,
      }),
    );
  }

  /*
   * STEP PARTITA
   */

  async function handleMatchStepContinue() {
    if (
      isResolvingWalkover
    ) {
      return;
    }

    /*
     * PARTITA RINVIATA
     */

    if (
      wizardData.status ===
      "postponed"
    ) {
      setWizardData(
        (currentData) => ({
          ...currentData,

          homeScore: 0,
          awayScore: 0,

          homePenalties:
  undefined,

awayPenalties:
  undefined,

          homePresentPlayerIds:
            [],

          awayPresentPlayerIds:
            [],

          performances: {},

          goals: [],

          mvpPlayerId:
            undefined,

          mvpPhotoUrl:
            undefined,
        }),
      );

      setCurrentStep(
        "review",
      );

      return;
    }

    /*
     * PARTITA NORMALE
     */

    if (
      wizardData.status !==
        "walkover" ||
      !wizardData.walkoverWinnerTeamId
    ) {
      setCurrentStep(
        "attendance",
      );

      return;
    }

    /*
     * VITTORIA A TAVOLINO
     */

    if (!match) {
      setWalkoverError(
        "Impossibile calcolare le presenze: partita non disponibile.",
      );

      return;
    }

    if (
  isFinalStage
) {
  const winnerTeamId =
    String(
      wizardData.walkoverWinnerTeamId,
    );

  const winnerRoster =
    winnerTeamId ===
    String(
      match.homeTeamId,
    )
      ? homeSeasonPlayers
      : awaySeasonPlayers;

  const winnerPresentPlayerIds =
    winnerRoster.map(
      (
        entry,
      ) =>
        String(
          entry.playerId,
        ),
    );

  const homeIsWinner =
    winnerTeamId ===
    String(
      match.homeTeamId,
    );

  setWizardData(
    (
      currentData,
    ) => ({
      ...currentData,

      homePresentPlayerIds:
        homeIsWinner
          ? winnerPresentPlayerIds
          : [],

      awayPresentPlayerIds:
        homeIsWinner
          ? []
          : winnerPresentPlayerIds,

      performances:
        {},

      goals:
        [],

      mvpPlayerId:
        undefined,

      mvpPhotoUrl:
        undefined,
    }),
  );

  setCurrentStep(
    "review",
  );

  return;
}

    setIsResolvingWalkover(
      true,
    );

    setWalkoverError(
      null,
    );

    try {
      const winnerTeamId =
        String(
          wizardData.walkoverWinnerTeamId,
        );

      const loserTeamId =
        winnerTeamId ===
        String(
          match.homeTeamId,
        )
          ? String(
              match.awayTeamId,
            )
          : String(
              match.homeTeamId,
            );

      const winnerRoster =
        winnerTeamId ===
        String(
          match.homeTeamId,
        )
          ? homeSeasonPlayers
          : awaySeasonPlayers;

      const regularSeasonMatch =
      match as Match;

      const seasonMatches =
        await FirebaseMatchRepository.getBySeason(
          regularSeasonMatch.seasonId,
        );

      const reports =
        await FirebaseMatchReportRepository.getAll();

      const publishedReportsByMatchId =
        new Map(
          reports
            .filter(
              (report) =>
                report.status ===
                "published",
            )
            .map(
              (report) => [
                String(
                  report.matchId,
                ),
                report,
              ],
            ),
        );

      const previousWinnerMatches =
        seasonMatches
          .filter(
            (currentMatch) => {
              if (
                String(
                  currentMatch.id,
                ) ===
                String(
                  match.id,
                )
              ) {
                return false;
              }

              const winnerWasInvolved =
                String(
                  currentMatch.homeTeamId,
                ) ===
                  winnerTeamId ||
                String(
                  currentMatch.awayTeamId,
                ) ===
                  winnerTeamId;

              if (
                !winnerWasInvolved
              ) {
                return false;
              }

              const isPreviousMatch =
                currentMatch.matchweek <
                  regularSeasonMatch.matchweek ||
                (
                  currentMatch.matchweek ===
                    regularSeasonMatch.matchweek &&
                  `${currentMatch.date} ${currentMatch.time}` <
                    `${match.date} ${match.time}`
                );

              if (
                !isPreviousMatch
              ) {
                return false;
              }

              return publishedReportsByMatchId.has(
                String(
                  currentMatch.id,
                ),
              );
            },
          )
          .sort(
            (
              firstMatch,
              secondMatch,
            ) => {
              if (
                firstMatch.matchweek !==
                secondMatch.matchweek
              ) {
                return (
                  secondMatch.matchweek -
                  firstMatch.matchweek
                );
              }

              const firstDateTime =
                `${firstMatch.date} ${firstMatch.time}`;

              const secondDateTime =
                `${secondMatch.date} ${secondMatch.time}`;

              return secondDateTime.localeCompare(
                firstDateTime,
              );
            },
          );

      let winnerPresentPlayerIds:
        string[];

      /*
       * Nelle prime quattro
       * partite della squadra:
       * presenza a tutti i
       * giocatori attivi.
       */

      if (
        previousWinnerMatches.length <
        4
      ) {
        winnerPresentPlayerIds =
          winnerRoster.map(
            (entry) =>
              String(
                entry.playerId,
              ),
          );
      } else {
        /*
         * Dalla quinta partita:
         * presenza a chi è comparso
         * almeno una volta nelle
         * quattro gare precedenti.
         */

        const lastFourMatches =
          previousWinnerMatches.slice(
            0,
            4,
          );

        const eligiblePlayerIds =
          new Set<string>();

        lastFourMatches.forEach(
          (previousMatch) => {
            const report =
              publishedReportsByMatchId.get(
                String(
                  previousMatch.id,
                ),
              );

            if (!report) {
              return;
            }

            const previousPresentPlayerIds =
              String(
                previousMatch.homeTeamId,
              ) ===
              winnerTeamId
                ? report.data
                    .homePresentPlayerIds
                : report.data
                    .awayPresentPlayerIds;

            previousPresentPlayerIds.forEach(
              (playerId: string | number) => {
                eligiblePlayerIds.add(
                  String(
                    playerId,
                  ),
                );
              },
            );
          },
        );

        /*
         * Manteniamo solo
         * i giocatori ancora attivi
         * nella rosa corrente.
         */

        winnerPresentPlayerIds =
          winnerRoster
            .map(
              (entry) =>
                String(
                  entry.playerId,
                ),
            )
            .filter(
              (playerId) =>
                eligiblePlayerIds.has(
                  String(
                    playerId,
                  ),
                ),
            );
      }

      if (
        winnerPresentPlayerIds.length ===
        0
      ) {
        throw new Error(
          "La squadra vincente non contiene giocatori attivi nella rosa stagionale.",
        );
      }

      const homeIsWinner =
        winnerTeamId ===
        String(
          match.homeTeamId,
        );

      setWizardData(
        (currentData) => ({
          ...currentData,

          homePresentPlayerIds:
            homeIsWinner
              ? winnerPresentPlayerIds
              : [],

          awayPresentPlayerIds:
            homeIsWinner
              ? []
              : winnerPresentPlayerIds,

          /*
           * Vittoria a tavolino:
           * nessun voto,
           * cartellino,
           * gol o MVP.
           */

          performances: {},

          goals: [],

          mvpPlayerId:
            undefined,

          mvpPhotoUrl:
            undefined,
        }),
      );

      console.log(
        "Presenze vittoria a tavolino:",
        {
          winnerTeamId,
          loserTeamId,

          previousMatches:
            previousWinnerMatches
              .slice(
                0,
                4,
              )
              .map(
                (
                  previousMatch,
                ) =>
                  previousMatch.id,
              ),

          winnerPresentPlayerIds,
        },
      );

      /*
       * Lo step Convocati
       * viene saltato.
       */

      setCurrentStep(
        "review",
      );
    } catch (error) {
      console.error(
        "Errore calcolo presenze vittoria a tavolino:",
        error,
      );

      setWalkoverError(
        error instanceof
          Error
          ? error.message
          : "Impossibile calcolare automaticamente le presenze.",
      );
    } finally {
      setIsResolvingWalkover(
        false,
      );
    }
  }

  /*
   * PUBBLICAZIONE
   */

  async function publishMatchReport() {
    if (!match) {
      setPublishError(
        "Impossibile pubblicare: partita non disponibile.",
      );

      return;
    }

    setIsPublishing(
      true,
    );

    setPublishError(
      null,
    );

    try {
      if (
  isFinalStage
) {
  const publishResult =
    await PublishFinalStageMatchService
      .publish({
        match:
          match as FinalStageMatch,

        report:
          wizardData,
      });

  setPublishedReportId(matchId);

  /*
   * ========================================================
   * PREFILL TURNO SUCCESSIVO
   * ========================================================
   *
   * Se entrambe le qualificate sono note,
   * salviamo temporaneamente il piano nella
   * sessione del browser.
   *
   * Non viene scritto nulla in Firestore.
   * ========================================================
   */

  if (
    publishResult
      .advancement
      ?.status ===
    "ready"
  ) {
    window.sessionStorage
      .setItem(
        "ludi.finalStageBracketPrefill",

        JSON.stringify({
          seasonId:
            publishResult
              .advancement
              .seasonId,

          competition:
            publishResult
              .advancement
              .competition,

          round:
            publishResult
              .advancement
              .targetRound,

          matchOrder:
            publishResult
              .advancement
              .targetMatchOrder,

          homeTeamId:
            publishResult
              .advancement
              .homeTeamId,

          awayTeamId:
            publishResult
              .advancement
              .awayTeamId,
        }),
      );
  }

  router.push(
    "/admin/fasi-finali/calendario?published=true",
  );

  router.refresh();

  return;
}

const publishResult =
  await PublishMatchService.publish({
    match:
      match as Match,

  report:
    wizardData,
});

      setPublishedReportId(matchId);
      console.info(
        "[Publish Match] Completed:",
        publishResult,
      );

      if (
        publishResult.processing.status ===
        "failed"
      ) {
        console.warn(
          "[Publish Match] Report published, but processing failed:",
          publishResult.processing.error,
        );
      }

      router.push(
        "/admin/partite?published=true",
      );

      router.refresh();
    } catch (error) {
      console.error(
        "Errore pubblicazione tabellino:",
        error,
      );

      setPublishError(
        error instanceof
          Error
          ? error.message
          : "Impossibile pubblicare il tabellino.",
      );
    } finally {
      setIsPublishing(
        false,
      );
    }
  }

  /*
   * LOADING
   */

  if (
    matchLoading ||
    teamsLoading ||
    playersLoading ||
    seasonPlayersLoading ||
    (
      isFinalStage &&
      finalStagePlayersLoading
    )
  ) {
    return (
      <AppShell>
        <main className="p-6">
          <section className="rounded-[18px] bg-white p-5 shadow-lg">
            <p className="text-sm font-bold text-[#06142E]/50">
              Caricamento partita...
            </p>
          </section>
        </main>
      </AppShell>
    );
  }

  /*
   * ERROR
   */

  if (
    matchError ||
    teamsError ||
    playersError ||
    !match
  ) {

    return (
      <AppShell>
        <main className="p-6">
          <section className="rounded-[18px] bg-white p-5 shadow-lg">
            <h1 className="text-xl font-black text-[#06142E]">
              Partita non trovata
            </h1>

            <p className="mt-2 text-sm font-bold text-[#06142E]/50">
              {matchError ||
                teamsError ||
                playersError ||
                "La partita richiesta non esiste."}
            </p>
          </section>
        </main>
      </AppShell>
    );
  }

  const wizardMatch:
  Match =
  isFinalStage
    ? {
        id:
          match.id,

        seasonId:
          match.seasonId,

        matchweek:
          0,

        matchweekId:
          "final-stage",

        homeTeamId:
          match.homeTeamId,

        awayTeamId:
          match.awayTeamId,

        date:
          match.date,

        time:
          match.time,

        venue:
          match.venue,

        status:
          match.status,

        published:
          match.published,

        homeScore:
          match.homeScore,

        awayScore:
          match.awayScore,

        createdAt:
          match.createdAt,

        updatedAt:
          match.updatedAt,
      }
    : (match as Match);

    /*
 * ============================================================
 * GARA SECCA FASI FINALI
 * ============================================================
 *
 * Gironi:
 * - il pareggio è ammesso.
 *
 * Quarti / semifinali / finale a gara secca:
 * - deve sempre esistere un vincitore;
 * - in caso di parità sono obbligatori i rigori.
 *
 * Le gare di andata/ritorno verranno gestite
 * successivamente tramite risultato aggregato.
 * ============================================================
 */

const finalStageRequiresWinner =
  isFinalStage &&
  (
    match as FinalStageMatch
  ).leg ===
    "single" &&
  (
    match as FinalStageMatch
  ).round !==
    "group";

       /*
 * ============================================================
 * TEMPI SUPPLEMENTARI SU RISULTATO AGGREGATO
 * ============================================================
 */

const finalStageRequiresExtraTimeBeforePenalties =
  isFinalStage &&
  match !==
    null &&
  (
    match as FinalStageMatch
  ).round ===
    "final" &&
  (
    match as FinalStageMatch
  ).leg ===
    "single";

   /*
 * ============================================================
 * RIGORI SU RISULTATO AGGREGATO
 * ============================================================
 */

let finalStageAggregateRequiresPenalties =
  false;

if (
  isFinalStage &&
  (
    match as FinalStageMatch
  ).round !==
    "group" &&
  (
    match as FinalStageMatch
  ).leg ===
    "second" &&
  wizardData.status ===
    "played"
) {
  const currentFinalStageMatch =
    match as FinalStageMatch;

  /*
   * Creiamo una versione temporanea della
   * gara di ritorno con il risultato che
   * l'admin sta inserendo nel Wizard.
   *
   * Non viene scritto nulla su Firestore.
   */
  const previewMatch:
    FinalStageMatch = {
    ...currentFinalStageMatch,

    status:
      "played",

    published:
      true,

    homeScore:
      wizardData.homeScore,

    awayScore:
      wizardData.awayScore,

    homePenalties:
      wizardData.homePenalties,

    awayPenalties:
      wizardData.awayPenalties,
  };

  try {
    const resolution =
      resolveFinalStageQualification({
        match:
          previewMatch,

        allMatches:
          finalStageSeasonMatches,
      });

    finalStageAggregateRequiresPenalties =
      resolution.status ===
        "penaltiesRequired" ||
      (
        resolution.status ===
          "qualified" &&
        resolution.decidedBy ===
          "aggregatePenalties"
      );
  } catch {
    /*
     * Il controllo definitivo viene eseguito
     * dal servizio di qualificazione.
     *
     * Qui stiamo solamente preparando la UI
     * del Match Wizard.
     */
    finalStageAggregateRequiresPenalties =
      false;
  }
} 

  return (
    <AppShell>
      <div className="space-y-6">
      {/* ======================================================
          HEADER
          ====================================================== */}

      <header className="mt-6 mb-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#06142E]/40">
          Centro di controllo
        </p>

        <h1 className="mt-1 text-3xl font-black uppercase text-[#06142E]">
          Tabellino
        </h1>

        <p className="mt-1 max-w-2xl text-sm font-bold leading-6 text-[#06142E]/50">
          Inserisci i dati della partita
        </p>
      </header>

      {editingPublishedReport ? (
        <div className="mb-5 rounded-[13px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-black">Tabellino pubblicato</p>
          <p className="mt-1">Le modifiche saranno applicate solo premendo Pubblica. Se esci senza pubblicare, resta online il tabellino precedente e le modifiche vengono scartate.</p>
        </div>
      ) : <CloudSyncBadge status={cloudSyncStatus} />}

      {publishError && (
        <section className="mb-5 rounded-[13px] border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-black text-red-700">
            Pubblicazione non riuscita
          </p>

          <p className="mt-1 text-xs font-bold text-red-600/75">
            {
              publishError
            }
          </p>
        </section>
      )}

      {walkoverError && (
        <section className="mb-5 rounded-[13px] border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-black text-red-700">
            Calcolo presenze non riuscito
          </p>

          <p className="mt-1 text-xs font-bold text-red-600/75">
            {
              walkoverError
            }
          </p>
        </section>
      )}

      {currentStep ===
        "match" && (
        <MatchInfoStep
          match={wizardMatch}
          homeTeam={
            homeTeam
          }
          awayTeam={
            awayTeam
          }
          data={
            wizardData
          }
          requiresWinner={
  finalStageRequiresWinner
}
forcePenalties={
  finalStageAggregateRequiresPenalties
}
requiresExtraTimeBeforePenalties={
  finalStageRequiresExtraTimeBeforePenalties
}
          onChange={
            updateWizardData
          }
          onContinue={() => {
            void handleMatchStepContinue();
          }}
        />
      )}

      {currentStep ===
        "attendance" && (
        <AttendanceStep
          homeTeam={
            homeTeam
          }
          awayTeam={
            awayTeam
          }
          seasonId={
            match.seasonId
          }
          homeRoster={
            homeSeasonPlayers
          }
          awayRoster={
            awaySeasonPlayers
          }
          onRosterUpdate={
            refreshMatchRosterData
          }
          homePresentPlayerIds={
            wizardData.homePresentPlayerIds
          }
          awayPresentPlayerIds={
            wizardData.awayPresentPlayerIds
          }
          onHomePresentPlayersChange={(
            playerIds,
          ) => {
            setWizardData(
              (
                currentData,
              ) => ({
                ...currentData,

                homePresentPlayerIds:
                  playerIds,
              }),
            );
          }}
          onAwayPresentPlayersChange={(
            playerIds,
          ) => {
            setWizardData(
              (
                currentData,
              ) => ({
                ...currentData,

                awayPresentPlayerIds:
                  playerIds,
              }),
            );
          }}
          onBack={() => {
            setCurrentStep(
              "match",
            );
          }}
          onContinue={() => {
            setCurrentStep(
              "performance",
            );
          }}
        />
      )}

      {currentStep ===
        "performance" && (
        <PerformanceStep
          homeTeam={
            homeTeam
          }
          awayTeam={
            awayTeam
          }
          homeRoster={
            homeSeasonPlayers
          }
          awayRoster={
            awaySeasonPlayers
          }
          homePresentPlayerIds={
            wizardData.homePresentPlayerIds
          }
          awayPresentPlayerIds={
            wizardData.awayPresentPlayerIds
          }
          performances={
            wizardData.performances
          }
          goals={
            wizardData.goals
          }
          mvpPlayerId={
            wizardData.mvpPlayerId
          }
          onGoalsChange={(
            goals,
          ) => {
            setWizardData(
              (
                currentData,
              ) => ({
                ...currentData,
                goals,
              }),
            );
          }}
          onPerformanceChange={(
            playerId,
            performance,
          ) => {
            setWizardData(
              (
                currentData,
              ) => ({
                ...currentData,

                performances:
                  {
                    ...currentData.performances,

                    [playerId]:
                      performance,
                  },
              }),
            );
          }}
          onMvpPlayerChange={(
            playerId,
          ) => {
            setWizardData(
              (
                currentData,
              ) => ({
                ...currentData,

                mvpPlayerId:
                  playerId,
              }),
            );
          }}
          onBack={() => {
            setCurrentStep(
              "attendance",
            );
          }}
          onContinue={() => {
            setCurrentStep(
              "review",
            );
          }}
        />
      )}

      {currentStep ===
        "review" &&
        match && (
          <ReviewStep
            match={wizardMatch}
            homeTeam={
              homeTeam
            }
            awayTeam={
              awayTeam
            }
            homeRoster={
              homeSeasonPlayers
            }
            awayRoster={
              awaySeasonPlayers
            }
            data={
              wizardData
            }
            requiresWinner={
  finalStageRequiresWinner
}
forcePenalties={
  finalStageAggregateRequiresPenalties
}
requiresExtraTimeBeforePenalties={
  finalStageRequiresExtraTimeBeforePenalties
}
            isPublishing={
              isPublishing
            }
            onMvpPhotoChange={(
              photoUrl,
            ) => {
              setWizardData(
                (
                  currentData,
                ) => ({
                  ...currentData,

                  mvpPhotoUrl:
                    photoUrl,
                }),
              );
            }}
            onBack={() => {
              setCurrentStep(
                "performance",
              );
            }}
            onPublish={() => {
              void publishMatchReport();
            }}
          />
        )}
        </div>
    </AppShell>
  );
}

function CloudSyncBadge({
  status,
}: {
  status: CloudSyncStatus;
}) {
  const content: Record<
    CloudSyncStatus,
    {
      icon: string;
      label: string;
    }
  > = {
    loading: {
      icon: "⏳",
      label:
        "Caricamento cloud",
    },

    saving: {
      icon: "☁️",
      label:
        "Salvataggio...",
    },

    saved: {
      icon: "✓",
      label:
        "Salvato nel cloud",
    },

    offline: {
      icon: "📱",
      label:
        "Salvato sul dispositivo",
    },

    error: {
      icon: "!",
      label:
        "Errore sincronizzazione",
    },
  };

  const current =
    content[status];

  

  return (
    <div className="mb-5 flex items-center justify-center gap-2 rounded-[13px] bg-white px-4 py-3 shadow-[0_8px_20px_rgba(6,20,46,0.07)]">
      <span className="text-sm">
        {current.icon}
      </span>

      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#06142E]/50">
        {current.label}
      </span>
    </div>
  );
}