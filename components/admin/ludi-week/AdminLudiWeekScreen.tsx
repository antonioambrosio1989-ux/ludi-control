"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import AppShell from "@/components/ui/AppShell";
import LudiWeekImageUploader from "@/components/admin/ludi-week/LudiWeekImageUploader";

import { MatchweekDataBuilder } from "@/src/application/matchweek-data/MatchweekDataBuilder";

import {
  buildCompletedMatchweeks,
} from "@/src/application/ludi-week/buildCompletedMatchweeks";

import {
  MatchweekAwardsEngine,
  type MatchweekAwardCandidate,
} from "@/src/application/matchweek-awards/MatchweekAwardsEngine";

import { FirebaseMatchweekAwardsRepository } from "@/src/services/matchweek/FirebaseMatchweekAwardsRepository";

import type {
  MatchweekAwardsLineup,
  MatchweekAwardsPlayerSnapshot,
  MatchweekAwardsStatus,
} from "@/src/types/MatchweekAwardsPublication";

import {
  useCompetition,
} from "@/src/contexts/CompetitionContext";

import { useInstagramFeaturePost } from "@/src/hooks/useInstagramFeaturePost";
import type { InstagramPost } from "@/app/api/instagram/route";
import { usePlayers } from "@/src/hooks/usePlayers";
import { useSeasonPlayers } from "@/src/hooks/useSeasonPlayers";
import { useStandings } from "@/src/hooks/useStandings";
import { useTeams } from "@/src/hooks/useTeams";

/*
 * Top Five e Player of the Week diventano dati definitivi e pubblici
 * nel momento in cui l'Admin li conferma. La Matchweek Hub viene resa
 * visibile solo con la pubblicazione finale. Il Goal of the Week resta
 * indipendente e viene recuperato da Instagram quando disponibile.
 */

export default function MatchweekAdmin() {
  const {
    currentSeason,
    selectedCompetition,

    isLoading:
      competitionLoading,

    error:
      competitionError,
  } =
    useCompetition();

  const currentSeasonId =
    currentSeason?.id;

  const isLudiWeekEnabled =
    selectedCompetition
      ?.features
      .ludiWeek ===
    true;

  const {
    teams,

    isLoading:
      teamsLoading,

    error:
      teamsError,
  } =
    useTeams();

  const {
    players,

    isLoading:
      playersLoading,

    error:
      playersError,
  } =
    usePlayers(
      currentSeason?.competitionId ??
        "__no-competition__",
    );

  const {
    seasonPlayers,

    isLoading:
      seasonPlayersLoading,

    error:
      seasonPlayersError,
  } =
    useSeasonPlayers(
      currentSeasonId,
    );

  const {
    matches,
    reports,

    isLoading:
      standingsLoading,

    error:
      standingsError,
  } =
    useStandings(
      currentSeasonId,
      currentSeason
        ?.competitionId,
    );

  /*
   * ==========================================================
   * STATE
   * ==========================================================
   */

  const [
    selectedMatchweek,
    setSelectedMatchweek,
  ] =
    useState<
      number | null
    >(
      null,
    );

  const [
    publicationStatus,
    setPublicationStatus,
  ] =
    useState<
      MatchweekAwardsStatus | null
    >(
      null,
    );

  const [
    isLoadingPublication,
    setIsLoadingPublication,
  ] =
    useState(
      false,
    );

  const [
    isPublishing,
    setIsPublishing,
  ] =
    useState(
      false,
    );

  const [
    publicationMessage,
    setPublicationMessage,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    confirmedMvpPlayerId,
    setConfirmedMvpPlayerId,
  ] =
    useState("");

  const [
    confirmedGoalkeeperPlayerId,
    setConfirmedGoalkeeperPlayerId,
  ] =
    useState("");

  const [
    confirmedOutfieldPlayerIds,
    setConfirmedOutfieldPlayerIds,
  ] =
    useState<string[]>([]);

  const [topFiveConfirmed, setTopFiveConfirmed] = useState(false);
  const [isSavingTopFive, setIsSavingTopFive] = useState(false);
  const [playerOfTheWeekConfirmed, setPlayerOfTheWeekConfirmed] = useState(false);
  const [isSavingPlayerOfTheWeek, setIsSavingPlayerOfTheWeek] = useState(false);
  const [topFiveImage, setTopFiveImage] = useState<{url:string;key:string}|null>(null);
  const [playerOfTheWeekImage, setPlayerOfTheWeekImage] = useState<{url:string;key:string}|null>(null);

  /*
   * ==========================================================
   * MATCHWEEK COMPLETE
   * ==========================================================
   */

  const completedMatchweeks =
    useMemo(() => {
      return buildCompletedMatchweeks({
        matches,
        reports,
      });
    }, [
      matches,
      reports,
    ]);

  const effectiveMatchweek =
    selectedMatchweek !==
      null &&
    completedMatchweeks.includes(
      selectedMatchweek,
    )
      ? selectedMatchweek
      : completedMatchweeks.at(
            -1,
          ) ??
        null;

  const [instagramRefreshKey, setInstagramRefreshKey] = useState(0);
  const [loadedSelectionKey, setLoadedSelectionKey] = useState("");
  const selectionKey = `${currentSeasonId ?? ""}:${effectiveMatchweek ?? ""}`;
  const selectionKeyRef = useRef(selectionKey);
  useEffect(() => { selectionKeyRef.current = selectionKey; }, [selectionKey]);
  const goalPost = useInstagramFeaturePost("gotw", effectiveMatchweek, selectedCompetition?.id, instagramRefreshKey);

  /*
   * ==========================================================
   * DATI CENTRALIZZATI DELLA MATCHWEEK
   * ==========================================================
   */

  const matchweekData =
    useMemo(() => {
      if (
        effectiveMatchweek ===
        null
      ) {
        return undefined;
      }

      return MatchweekDataBuilder.build({
        matchweek:
          effectiveMatchweek,

        matches,

        reports:
          reports.map(
            (
              report,
            ) => ({
              matchId:
                report.matchId,

              status:
                report.status,

              data:
                report.data,
            }),
          ),

        players,
        teams,
        seasonPlayers,
      });
    }, [
      effectiveMatchweek,
      matches,
      reports,
      players,
      teams,
      seasonPlayers,
    ]);

  /*
   * ==========================================================
   * SUGGERIMENTI
   * ==========================================================
   */

  const suggestions =
    useMemo(() => {
      return MatchweekAwardsEngine.generate({
        players:
          matchweekData
            ?.players ??
          [],
      });
    }, [
      matchweekData
        ?.players,
    ]);

  /*
   * ==========================================================
   * CANDIDATI MVP
   *
   * Mostriamo solo i 3 papabili migliori.
   * La selezione editoriale deve coincidere con il post Instagram:
   * è un supporto alla decisione editoriale per Instagram.
   * ==========================================================
   */

  const mvpCandidates =
    useMemo(() => {
      const candidates: MatchweekAwardCandidate[] = [
        ...suggestions
          .rankingsByRole
          .goalkeepers,

        ...suggestions
          .rankingsByRole
          .defenders,

        ...suggestions
          .rankingsByRole
          .forwards,
      ];

      return candidates
        .sort(
          (
            first,
            second,
          ) =>
            compareCandidates(
              first,
              second,
            ),
        );
    }, [
      suggestions,
    ]);

  /*
   * ==========================================================
   * TOP FIVE SUGGERITA
   * ==========================================================
   *
   * 1 Portiere
   * 2 Difensori
   * 2 Attaccanti
   *
   * Alternative:
   * - Portiere: fino a 2
   * - Difensori: fino a 2
   * - Attaccanti: fino a 2
   * ==========================================================
   */

  const suggestedLineup =
    useMemo<
      MatchweekAwardsLineup
    >(() => {
      const suggestedTeam =
        suggestions
          .suggestedTeamOfTheWeek;

      return {
        goalkeeperPlayerId:
          suggestedTeam
            .goalkeeper
            ?.playerId,

        defenderPlayerIds:
          suggestedTeam
            .defenders
            .map(
              (
                player,
              ) =>
                player.playerId,
            ),

        forwardPlayerIds:
          suggestedTeam
            .forwards
            .map(
              (
                player,
              ) =>
                player.playerId,
            ),
      };
    }, [
      suggestions,
    ]);


  const outfieldCandidates =
    useMemo(() => {
      return [
        ...suggestions.rankingsByRole.defenders,
        ...suggestions.rankingsByRole.forwards,
      ].sort(compareCandidates);
    }, [suggestions]);

  const confirmedTopFiveIsComplete =
    Boolean(confirmedGoalkeeperPlayerId) &&
    confirmedOutfieldPlayerIds.length === 4 &&
    new Set([
      confirmedGoalkeeperPlayerId,
      ...confirmedOutfieldPlayerIds,
    ]).size === 5;

  const confirmedTopFivePlayerIds = [
    confirmedGoalkeeperPlayerId,
    ...confirmedOutfieldPlayerIds,
  ].filter(Boolean);

  const canPublishSelection =
    !isLoadingPublication &&
    loadedSelectionKey === selectionKey &&
    topFiveConfirmed &&
    playerOfTheWeekConfirmed &&
    confirmedTopFiveIsComplete &&
    Boolean(confirmedMvpPlayerId) &&
    confirmedTopFivePlayerIds.includes(confirmedMvpPlayerId) &&
    Boolean(topFiveImage?.url) &&
    Boolean(playerOfTheWeekImage?.url);

  function candidateSnapshot(
    candidate: MatchweekAwardCandidate,
  ): MatchweekAwardsPlayerSnapshot {
    return {
      playerId: candidate.playerId,
      playerName: candidate.playerName,
      teamId: candidate.teamId,
      teamName: candidate.teamName,
      role: candidate.role,
    };
  }

  /*
   * ==========================================================
   * STATO PUBBLICAZIONE
   * ==========================================================
   */

  useEffect(() => {
    let active =
      true;

    if (
      !currentSeasonId ||
      effectiveMatchweek ===
        null
    ) {
      /*
       * Non serve azzerare qui gli state:
       * quando non esiste una matchweek valida la relativa
       * UI non viene renderizzata.
       *
       * Evitiamo così setState sincroni nel corpo dell'effect.
       */
      return;
    }

    const seasonId =
      currentSeasonId;

    const matchweek =
      effectiveMatchweek;

    async function loadPublication() {
      setIsLoadingPublication(
        true,
      );

      setPublicationMessage(
        null,
      );

      try {
        const publication =
          await FirebaseMatchweekAwardsRepository
            .getByMatchweek({
              seasonId,
              matchweek,
            });

        if (
          !active
        ) {
          return;
        }

        setLoadedSelectionKey(selectionKey);
        setPublicationStatus(publication?.ludiWeekPublished ? "published" : null);

        setConfirmedMvpPlayerId(
          publication?.confirmedMvpPlayerId ?? "",
        );

        setTopFiveConfirmed(publication?.topFiveConfirmed === true);
        setPlayerOfTheWeekConfirmed(
          publication?.playerOfTheWeekConfirmed === true,
        );
        setTopFiveImage(publication?.topFiveImageUrl ? { url: publication.topFiveImageUrl, key: publication.topFiveImageKey ?? "" } : null);
        setPlayerOfTheWeekImage(publication?.playerOfTheWeekImageUrl ? { url: publication.playerOfTheWeekImageUrl, key: publication.playerOfTheWeekImageKey ?? "" } : null);

        setConfirmedGoalkeeperPlayerId(
          publication?.confirmedLineup.goalkeeperPlayerId ??
            suggestedLineup.goalkeeperPlayerId ??
            "",
        );

        const savedOutfieldPlayerIds =
          publication?.confirmedLineup.outfieldPlayerIds?.length
            ? publication.confirmedLineup.outfieldPlayerIds
            : [
                ...(publication?.confirmedLineup.defenderPlayerIds ?? []),
                ...(publication?.confirmedLineup.forwardPlayerIds ?? []),
              ];

        setConfirmedOutfieldPlayerIds(
          savedOutfieldPlayerIds.length > 0
            ? savedOutfieldPlayerIds.slice(0, 4)
            : [
                ...suggestedLineup.defenderPlayerIds,
                ...suggestedLineup.forwardPlayerIds,
              ].slice(0, 4),
        );
      } catch (
        error
      ) {
        if (
          !active
        ) {
          return;
        }

        console.error(
          "Errore caricamento pubblicazione Matchweek Hub:",
          error,
        );

        setPublicationMessage(
          "Impossibile verificare lo stato della pubblicazione.",
        );
      } finally {
        if (
          active
        ) {
          setIsLoadingPublication(
            false,
          );
        }
      }
    }

    void loadPublication();

    return () => {
      active =
        false;
    };
  }, [
    selectionKey,
    currentSeasonId,
    effectiveMatchweek,
    suggestedLineup,
    suggestions,
  ]);

  /*
   * Recheck all three Instagram posts before committing the editorial
   * winner and selected team in one atomic batch.
   */

  async function confirmTopFive() {
    if (
      !currentSeasonId ||
      effectiveMatchweek === null ||
      !confirmedTopFiveIsComplete ||
      isSavingTopFive ||
      topFiveConfirmed
    ) {
      return;
    }

    const allCandidates = [
      ...suggestions.rankingsByRole.goalkeepers,
      ...outfieldCandidates,
    ];

    const byId = new Map(
      allCandidates.map((candidate) => [
        candidate.playerId,
        candidate,
      ]),
    );

    const selected = confirmedTopFivePlayerIds
      .map((id) => byId.get(id))
      .filter(
        (candidate): candidate is MatchweekAwardCandidate =>
          Boolean(candidate),
      );

    if (selected.length !== 5) {
      setPublicationMessage(
        "Completa la Top Five prima di confermare.",
      );
      return;
    }

    setIsSavingTopFive(true);
    setPublicationMessage(null);

    try {
      await FirebaseMatchweekAwardsRepository.save({
        seasonId: currentSeasonId,
        matchweek: effectiveMatchweek,
        suggestedMvpPlayerId:
          suggestions.suggestedMvp?.playerId,
        suggestedLineup,
        confirmedLineup: {
          goalkeeperPlayerId:
            confirmedGoalkeeperPlayerId,
          outfieldPlayerIds:
            confirmedOutfieldPlayerIds,
          defenderPlayerIds:
            selected
              .filter(
                (candidate) =>
                  candidate.role === "Difensore",
              )
              .map(
                (candidate) =>
                  candidate.playerId,
              ),
          forwardPlayerIds:
            selected
              .filter(
                (candidate) =>
                  candidate.role === "Attaccante",
              )
              .map(
                (candidate) =>
                  candidate.playerId,
              ),
        },
        confirmedTeamOfWeekPlayers:
          selected.map(candidateSnapshot),
        topFiveConfirmed: true,
        playerOfTheWeekConfirmed: false,
        status: "published",
      });

      setTopFiveConfirmed(true);
      setPlayerOfTheWeekConfirmed(false);
      setConfirmedMvpPlayerId("");
      setPublicationMessage(
        "Top Five confermata definitivamente e resa pubblica. Ora scegli e conferma il Player of the Week tra i cinque selezionati.",
      );
    } catch (error) {
      setPublicationMessage(
        error instanceof Error
          ? error.message
          : "Impossibile confermare la Top Five.",
      );
    } finally {
      setIsSavingTopFive(false);
    }
  }

  async function confirmPlayerOfTheWeek() {
    if (
      !currentSeasonId ||
      effectiveMatchweek === null ||
      !topFiveConfirmed ||
      playerOfTheWeekConfirmed ||
      !confirmedMvpPlayerId ||
      isSavingPlayerOfTheWeek
    ) {
      return;
    }

    if (
      !confirmedTopFivePlayerIds.includes(
        confirmedMvpPlayerId,
      )
    ) {
      setPublicationMessage(
        "Il Player of the Week deve essere scelto tra i cinque giocatori della Top Five confermata.",
      );
      return;
    }

    const allCandidates = [
      ...suggestions.rankingsByRole.goalkeepers,
      ...outfieldCandidates,
    ];

    const byId = new Map(
      allCandidates.map((candidate) => [
        candidate.playerId,
        candidate,
      ]),
    );

    const selectedTopFive = confirmedTopFivePlayerIds
      .map((id) => byId.get(id))
      .filter(
        (candidate): candidate is MatchweekAwardCandidate =>
          Boolean(candidate),
      );

    const mvpCandidate = byId.get(
      confirmedMvpPlayerId,
    );

    if (
      selectedTopFive.length !== 5 ||
      !mvpCandidate
    ) {
      setPublicationMessage(
        "Impossibile confermare il Player of the Week: i dati della Top Five non sono completi.",
      );
      return;
    }

    setIsSavingPlayerOfTheWeek(true);
    setPublicationMessage(null);

    try {
      await FirebaseMatchweekAwardsRepository.save({
        seasonId: currentSeasonId,
        matchweek: effectiveMatchweek,
        suggestedMvpPlayerId:
          suggestions.suggestedMvp?.playerId,
        confirmedMvpPlayerId,
        confirmedMvpPlayer:
          candidateSnapshot(mvpCandidate),
        suggestedLineup,
        confirmedLineup: {
          goalkeeperPlayerId:
            confirmedGoalkeeperPlayerId,
          outfieldPlayerIds:
            confirmedOutfieldPlayerIds,
          defenderPlayerIds:
            selectedTopFive
              .filter(
                (candidate) =>
                  candidate.role === "Difensore",
              )
              .map(
                (candidate) =>
                  candidate.playerId,
              ),
          forwardPlayerIds:
            selectedTopFive
              .filter(
                (candidate) =>
                  candidate.role === "Attaccante",
              )
              .map(
                (candidate) =>
                  candidate.playerId,
              ),
        },
        confirmedTeamOfWeekPlayers:
          selectedTopFive.map(candidateSnapshot),
        topFiveConfirmed: true,
        playerOfTheWeekConfirmed: true,
        status: "published",
      });

      setPlayerOfTheWeekConfirmed(true);
      setPublicationMessage(
        "Player of the Week confermato definitivamente e reso pubblico. Ora puoi caricare le immagini.",
      );
    } catch (error) {
      setPublicationMessage(
        error instanceof Error
          ? error.message
          : "Impossibile confermare il Player of the Week.",
      );
    } finally {
      setIsSavingPlayerOfTheWeek(false);
    }
  }

  async function publishLudiWeek() {
    if (
      !currentSeasonId ||
      !isLudiWeekEnabled ||
      effectiveMatchweek === null
    ) {
      return;
    }

    if (!canPublishSelection || isPublishing) {
      setPublicationMessage(
        "Conferma definitivamente Top Five e Player of the Week, poi carica entrambe le immagini prima di pubblicare.",
      );
      return;
    }

    if (!confirmedMvpPlayerId) {
      setPublicationMessage(
        "Seleziona il Player of the Week.",
      );
      return;
    }

    if (!confirmedGoalkeeperPlayerId) {
      setPublicationMessage(
        "Seleziona un portiere per il Team of the Week.",
      );
      return;
    }

    if (confirmedOutfieldPlayerIds.length !== 4) {
      setPublicationMessage(
        "Seleziona esattamente 4 giocatori di movimento per il Team of the Week.",
      );
      return;
    }

    const confirmedPlayerIds = [
      confirmedGoalkeeperPlayerId,
      ...confirmedOutfieldPlayerIds,
    ];

    if (new Set(confirmedPlayerIds).size !== 5) {
      setPublicationMessage(
        "Lo stesso giocatore non può comparire più volte nel Team of the Week.",
      );
      return;
    }

    const goalkeeperCandidate =
      suggestions.rankingsByRole.goalkeepers.find(
        (candidate) =>
          candidate.playerId === confirmedGoalkeeperPlayerId,
      );

    if (!goalkeeperCandidate) {
      setPublicationMessage(
        "Il portiere selezionato non è tra i portieri candidati della settimana.",
      );
      return;
    }

    const outfieldById =
      new Map(
        outfieldCandidates.map((candidate) => [
          candidate.playerId,
          candidate,
        ]),
      );

    const selectedOutfield =
      confirmedOutfieldPlayerIds
        .map((playerId) => outfieldById.get(playerId))
        .filter(
          (
            candidate,
          ): candidate is MatchweekAwardCandidate =>
            Boolean(candidate),
        );

    if (selectedOutfield.length !== 4) {
      setPublicationMessage(
        "Uno o più giocatori selezionati non sono tra i candidati della settimana.",
      );
      return;
    }

    const mvpCandidate =
      mvpCandidates.find(
        (candidate) =>
          candidate.playerId === confirmedMvpPlayerId,
      );

    if (!mvpCandidate || !confirmedPlayerIds.includes(confirmedMvpPlayerId)) {
      setPublicationMessage(
        "Il Player of the Week deve essere scelto tra i cinque giocatori della Top Five confermata.",
      );
      return;
    }

    const confirmedDefenderPlayerIds =
      selectedOutfield
        .filter((candidate) => candidate.role === "Difensore")
        .map((candidate) => candidate.playerId);

    const confirmedForwardPlayerIds =
      selectedOutfield
        .filter((candidate) => candidate.role === "Attaccante")
        .map((candidate) => candidate.playerId);

    const confirmedLineup: MatchweekAwardsLineup = {
      goalkeeperPlayerId: confirmedGoalkeeperPlayerId,
      outfieldPlayerIds: confirmedOutfieldPlayerIds,
      defenderPlayerIds: confirmedDefenderPlayerIds,
      forwardPlayerIds: confirmedForwardPlayerIds,
    };

    const confirmedTeamOfWeekPlayers: MatchweekAwardsPlayerSnapshot[] = [
      candidateSnapshot(goalkeeperCandidate),
      ...selectedOutfield.map(candidateSnapshot),
    ];

    setIsPublishing(true);
    setPublicationMessage(null);

    try {
      const goalPostId = goalPost.post?.id;
      if (selectionKeyRef.current !== selectionKey) {
        throw new Error("La competizione o la matchweek è cambiata. Verifica la selezione e riprova.");
      }
      if (!completedMatchweeks.includes(effectiveMatchweek)) {
        throw new Error("La matchweek non è completa.");
      }
      await FirebaseMatchweekAwardsRepository.save({
        seasonId: currentSeasonId,
        matchweek: effectiveMatchweek,
        suggestedMvpPlayerId:
          suggestions.suggestedMvp?.playerId,
        confirmedMvpPlayerId,
        confirmedMvpPlayer:
          candidateSnapshot(mvpCandidate),
        suggestedLineup,
        confirmedLineup,
        confirmedTeamOfWeekPlayers,
        topFiveConfirmed: true,
        playerOfTheWeekConfirmed: true,
        topFiveImageUrl: topFiveImage?.url, topFiveImageKey: topFiveImage?.key,
        playerOfTheWeekImageUrl: playerOfTheWeekImage?.url, playerOfTheWeekImageKey: playerOfTheWeekImage?.key,
        status: "published",
        ludiWeekPublished: true,
        ...(goalPostId ? { ludiWeekInstagramPostIds: { gotw: goalPostId } } : {}),
      });

      if (selectionKeyRef.current !== selectionKey) return;
      setPublicationStatus("published");
      setPublicationMessage(
        "Matchweek Hub pubblicata. Player of the Week e Team of the Week selezionati sono stati salvati nel database.",
      );
    } catch (error) {
      console.error(
        "Errore pubblicazione Matchweek Hub:",
        error,
      );
      if (selectionKeyRef.current !== selectionKey) return;
      setPublicationMessage(
        error instanceof Error ? error.message : "Impossibile pubblicare Matchweek Hub.",
      );
    } finally {
      setIsPublishing(false);
    }
  }

  /*
   * ==========================================================
   * LOADING / ERROR
   * ==========================================================
   */

  const isLoading =
    competitionLoading ||
    teamsLoading ||
    playersLoading ||
    seasonPlayersLoading ||
    standingsLoading ||
    isLoadingPublication;

  const error =
    competitionError ||
    teamsError ||
    playersError ||
    seasonPlayersError ||
    standingsError;

  /*
   * ==========================================================
   * FEATURE DISABILITATA
   * ==========================================================
   */

  if (
    !competitionLoading &&
    !isLudiWeekEnabled
  ) {
    return (
      <AppShell>
        <MessageCard>
          Matchweek Hub non è
          disponibile per questa
          competizione.
        </MessageCard>
      </AppShell>
    );
  }

  /*
   * ==========================================================
   * RENDER
   * ==========================================================
   */

  return (
    <AppShell>
      <div className="space-y-6">
        {/* ====================================================
            HEADER
            ==================================================== */}

        <header className="mt-6 mb-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#06142E]/40">
            Centro di controllo
          </p>

          <h1 className="mt-1 text-3xl font-black uppercase text-[#06142E]">
            Matchweek Hub
          </h1>

          <p className="mt-1 max-w-2xl text-sm font-bold leading-6 text-[#06142E]/50">
            Il sistema analizza i tabellini e propone i candidati migliori.
          </p>
        </header>

        {isLoading && (
          <MessageCard>
            Analisi della giornata...
          </MessageCard>
        )}

        {!isLoading &&
          error && (
          <MessageCard
            error
          >
            Impossibile caricare i dati.
          </MessageCard>
        )}

        {!isLoading &&
          !error &&
          !currentSeason && (
          <MessageCard>
            Nessuna stagione attiva.
          </MessageCard>
        )}

        {!isLoading &&
          !error &&
          currentSeason &&
          effectiveMatchweek ===
            null && (
          <MessageCard>
            Matchweek Hub sarà disponibile quando tutte le partite della
            giornata saranno concluse.
          </MessageCard>
        )}

        {!isLoading &&
          !error &&
          effectiveMatchweek !==
            null && (
          <>
            <MatchweekSelector
              matchweeks={
                completedMatchweeks
              }
              selectedMatchweek={
                effectiveMatchweek
              }
              onChange={
                setSelectedMatchweek
              }
            />

            {/* =================================================
                PUBBLICAZIONE
                ================================================= */}

            <PublicationCard
              matchweek={
                effectiveMatchweek
              }
              isPublished={
                loadedSelectionKey === selectionKey && publicationStatus ===
                "published"
              }
              isPublishing={
                isPublishing
              }
              instagramStatus={[
                { label: "Goal of the Week", state: goalPost },
              ]}
              onRefreshInstagram={() => setInstagramRefreshKey((value) => value + 1)}
              canPublish={
                canPublishSelection
              }
              onPublish={() => {
                void publishLudiWeek();
              }}
            />

            {publicationMessage && (
              <p className="rounded-[14px] bg-white px-4 py-3 text-center text-xs font-black leading-5 text-[#06142E] shadow-[0_8px_20px_rgba(6,20,46,0.08)]">
                {
                  publicationMessage
                }
              </p>
            )}

            {/* =================================================
                COSA ARRIVA DA INSTAGRAM
                ================================================= */}

            <InstagramInfoCard />

            {/* =================================================
                TOP FIVE SUGGERITA
                ================================================= */}

            <SuggestedTopFiveCard
              goalkeepers={
                suggestions
                  .rankingsByRole
                  .goalkeepers
              }
              outfieldCandidates={
                outfieldCandidates
              }
              selectedGoalkeeperPlayerId={
                confirmedGoalkeeperPlayerId
              }
              selectedOutfieldPlayerIds={
                confirmedOutfieldPlayerIds
              }
              suggestedOutfieldPlayerIds={[
                ...suggestedLineup.defenderPlayerIds,
                ...suggestedLineup.forwardPlayerIds,
              ]}
              onSelectGoalkeeper={(playerId) => { if (!topFiveConfirmed) setConfirmedGoalkeeperPlayerId(playerId); }}
              confirmed={topFiveConfirmed}
              isSaving={isSavingTopFive}
              onConfirm={() => { void confirmTopFive(); }}
              onToggleOutfield={(playerId) => {
                if (topFiveConfirmed) return;
                setConfirmedOutfieldPlayerIds((current) => {
                  if (current.includes(playerId)) {
                    return current.filter((id) => id !== playerId);
                  }
                  if (current.length >= 4) {
                    return current;
                  }
                  return [...current, playerId];
                });
              }}
            />


            {/* =================================================
                MIGLIOR GIOCATORE - PAPABILI
                ================================================= */}

            <SuggestedMvpCandidatesCard
              candidates={topFiveConfirmed ? mvpCandidates.filter((candidate) => confirmedTopFivePlayerIds.includes(candidate.playerId)) : []}
              disabled={!topFiveConfirmed}
              confirmed={
                playerOfTheWeekConfirmed
              }
              isSaving={
                isSavingPlayerOfTheWeek
              }
              selectedPlayerId={
                confirmedMvpPlayerId
              }
              onSelect={(playerId) => {
                if (!playerOfTheWeekConfirmed) {
                  setConfirmedMvpPlayerId(playerId);
                }
              }}
              onConfirm={() => {
                void confirmPlayerOfTheWeek();
              }}
            />

            <section className="rounded-[22px] bg-white p-5 shadow-[0_10px_24px_rgba(6,20,46,0.08)]">
              <h2 className="text-xl font-black text-[#06142E]">Carica contenuti Ludi Week</h2>
              <p className="mt-2 text-xs font-bold leading-5 text-[#06142E]/40">Top Five e Player of the Week vengono caricati dall&apos;Admin. Il Goal of the Week resta su Instagram e non blocca la pubblicazione.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <LudiWeekImageUploader label="Top Five" imageUrl={topFiveImage?.url} disabled={!topFiveConfirmed} onUploaded={setTopFiveImage} onRemove={()=>setTopFiveImage(null)} />
                <LudiWeekImageUploader label="Player of the Week" imageUrl={playerOfTheWeekImage?.url} disabled={!playerOfTheWeekConfirmed} onUploaded={setPlayerOfTheWeekImage} onRemove={()=>setPlayerOfTheWeekImage(null)} />
              </div>
            </section>

            {/* =================================================
                OUTPUT AUTOMATICO
                ================================================= */}

            <AutomaticPublicationInfoCard />
          </>
        )}
      </div>
    </AppShell>
  );
}

/*
 * ============================================================
 * MATCHWEEK SELECTOR
 * ============================================================
 */

function MatchweekSelector({
  matchweeks,
  selectedMatchweek,
  onChange,
}: {
  matchweeks:
    number[];

  selectedMatchweek:
    number;

  onChange:
    (
      matchweek:
        number,
    ) => void;
}) {
  return (
    <section className="rounded-[20px] bg-white p-5 shadow-[0_10px_24px_rgba(6,20,46,0.08)]">
      <label className="text-xs font-black uppercase text-[#06142E]/45">
        Giornata analizzata
      </label>

      <select
        value={
          selectedMatchweek
        }
        onChange={(
          event,
        ) =>
          onChange(
            Number(
              event.target.value,
            ),
          )
        }
        className="mt-3 h-12 w-full rounded-[13px] border border-[#06142E]/10 bg-white px-4 text-sm font-black text-[#06142E]"
      >
        {matchweeks.map(
          (
            matchweek,
          ) => (
            <option
              key={
                matchweek
              }
              value={
                matchweek
              }
            >
              Matchweek{" "}
              {
                matchweek
              }
            </option>
          ),
        )}
      </select>
    </section>
  );
}

/*
 * ============================================================
 * PUBBLICAZIONE
 * ============================================================
 */

function PublicationCard({
  matchweek,
  isPublished,
  isPublishing,
  canPublish,
  instagramStatus,
  onRefreshInstagram,
  onPublish,
}: {
  matchweek:
    number;

  isPublished:
    boolean;

  isPublishing:
    boolean;

  canPublish:
    boolean;

  instagramStatus: Array<{ label: string; state: { post: InstagramPost | null; isLoading: boolean; error: string | null } }>;
  onRefreshInstagram: () => void;

  onPublish:
    () => void;
}) {
  return (
    <section className="rounded-[22px] bg-[#06142E] p-5 text-white shadow-[0_14px_34px_rgba(6,20,46,0.18)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.17em] text-white/45">
            Matchweek{" "}
            {
              matchweek
            }
          </p>

          <h2 className="mt-1 text-xl font-black uppercase">
            Pubblica Matchweek
          </h2>
        </div>

        <span
          className={`shrink-0 rounded-full px-3 py-1 text-[9px] font-black uppercase ${
            isPublished
              ? "bg-emerald-400/15 text-emerald-300"
              : "bg-white/10 text-white/60"
          }`}
        >
          {isPublished
            ? "Pubblicata"
            : "Pronta"}
        </span>
      </div>

      <p className="mt-3 text-xs font-semibold leading-5 text-white/55">
        Conferma definitivamente Top Five e Player of the Week, carica le due immagini e poi pubblica la Matchweek. Il Goal of the Week viene recuperato da Instagram quando disponibile e non blocca la pubblicazione.
      </p>

      <ul className="mt-4 space-y-2 text-xs font-bold">
        {instagramStatus.map(({ label, state }) => (
          <li key={label}>
            {label}: {state.isLoading ? "verifica in corso" : state.error ? "verifica non riuscita" : state.post ? "disponibile" : "da pubblicare su Instagram"}
          </li>
        ))}
      </ul>
      <button type="button" onClick={onRefreshInstagram} disabled={isPublishing} className="mt-3 text-xs font-black underline disabled:opacity-35">
        Verifica nuovamente Instagram
      </button>

      <button
        type="button"
        disabled={
          isPublishing ||
          !canPublish
        }
        onClick={
          onPublish
        }
        className="mt-5 min-h-12 w-full rounded-[14px] bg-white px-5 text-xs font-black uppercase text-[#06142E] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
      >
        {isPublishing
          ? "Pubblicazione..."
          : isPublished
            ? "Aggiorna Matchweek"
            : "Pubblica Matchweek"}
      </button>

      {!canPublish && (
        <p className="mt-3 text-center text-[10px] font-bold leading-4 text-amber-200/80">
          Conferma definitivamente la Top Five e il Player of the Week, quindi carica entrambe le immagini. Il Goal of the Week su Instagram non è obbligatorio per pubblicare.
        </p>
      )}
    </section>
  );
}

/*
 * ============================================================
 * INSTAGRAM
 * ============================================================
 */

function InstagramInfoCard() {
  return (
    <section className="rounded-[20px] border border-[#06142E]/8 bg-white p-5 shadow-[0_8px_20px_rgba(6,20,46,0.06)]">
      <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#06142E]/35">
        Contenuti editoriali
      </p>

      <h2 className="mt-1 text-lg font-black text-[#06142E]">
        Resta su Instagram
      </h2>

      <div className="mt-4">
        <InstagramBadge
          icon="⚽"
          label="Goal of the Week"
        />
      </div>

      <p className="mt-4 text-xs font-bold leading-5 text-[#06142E]/40">
        Player of the Week e Team of the Week vengono ora selezionati e
        salvati da questa pagina. Il Goal of the Week continua ad arrivare
        dal contenuto editoriale pubblicato su Instagram.
      </p>
    </section>
  );
}

function InstagramBadge({
  icon,
  label,
}: {
  icon:
    string;

  label:
    string;
}) {
  return (
    <div className="rounded-[13px] bg-[#F3F6FB] px-2 py-3 text-center">
      <div className="text-xl">
        {
          icon
        }
      </div>

      <p className="mt-1 text-[9px] font-black uppercase tracking-[0.06em] text-[#06142E]/55">
        {
          label
        }
      </p>
    </div>
  );
}

/*
 * ============================================================
 * MVP - 2/3 PAPABILI
 * ============================================================
 */

function SuggestedMvpCandidatesCard({
  candidates,
  selectedPlayerId,
  onSelect,
  onConfirm,
  disabled = false,
  confirmed = false,
  isSaving = false,
}: {
  candidates: MatchweekAwardCandidate[];
  selectedPlayerId: string;
  onSelect: (playerId: string) => void;
  onConfirm: () => void;
  disabled?: boolean;
  confirmed?: boolean;
  isSaving?: boolean;
}) {
  return (
    <section className="rounded-[22px] bg-white p-5 shadow-[0_10px_24px_rgba(6,20,46,0.08)]">
      <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#0B5FFF]">
        Suggerimento sistema
      </p>

      <h2 className="mt-1 text-xl font-black text-[#06142E]">
        Player of the Week
      </h2>

      <p className="mt-2 text-xs font-bold leading-5 text-[#06142E]/40">
        Scegli il Player of the Week esclusivamente tra i cinque giocatori della Top Five confermata. Dopo la conferma la scelta è definitiva.
      </p>

      {candidates.length === 0 ? (
        <p className="mt-5 rounded-[14px] bg-[#F3F6FB] p-4 text-center text-xs font-bold text-[#06142E]/45">
          {disabled ? "Conferma prima la Top Five." : "Nessun candidato disponibile."}
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          <label className="block text-xs font-black text-[#06142E]">
            Player of the Week
            <select
              value={selectedPlayerId}
              disabled={
                disabled ||
                confirmed
              }
              onChange={(event) =>
                onSelect(event.target.value)
              }
              className="mt-2 min-h-12 w-full rounded-[12px] border border-[#06142E]/15 bg-white px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Seleziona il Player of the Week</option>
              {candidates.map((candidate) => <option key={candidate.playerId} value={candidate.playerId}>{candidate.playerName} · {candidate.teamName}</option>)}
            </select>
          </label>
          {candidates.slice(0, 3).map((candidate, index) => {
            const selected =
              candidate.playerId === selectedPlayerId;
            return (
              <button
                type="button"
                key={candidate.playerId}
                disabled={
                  disabled ||
                  confirmed
                }
                onClick={() => onSelect(candidate.playerId)}
                className={`w-full rounded-[16px] p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-55 ${
                  selected
                    ? "bg-[#06142E] text-white ring-2 ring-[#0B5FFF]"
                    : "bg-[#F3F6FB] text-[#06142E]"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] opacity-45">
                      Candidato {index + 1}
                    </p>
                    <p className="mt-1 truncate text-base font-black">
                      {candidate.playerName}
                    </p>
                    <p className="mt-1 text-xs font-bold opacity-50">
                      {candidate.teamName} · {candidate.role}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[9px] font-black uppercase ${
                    selected
                      ? "bg-white text-[#06142E]"
                      : "bg-white text-[#06142E]/45"
                  }`}>
                    {selected ? "Selezionato" : `Voto ${formatVote(candidate.averageVote)}`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={
          onConfirm
        }
        disabled={
          disabled ||
          confirmed ||
          isSaving ||
          !selectedPlayerId
        }
        className="mt-4 min-h-12 w-full rounded-[13px] bg-[#06142E] px-4 text-xs font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-35"
      >
        {confirmed
          ? "Player of the Week confermato"
          : isSaving
            ? "Conferma in corso..."
            : "Conferma Player of the Week"}
      </button>
    </section>
  );
}

/*
 * ============================================================
 * TOP FIVE SUGGERITA
 * ============================================================
 */

function SuggestedTopFiveCard({
  goalkeepers,
  outfieldCandidates,
  selectedGoalkeeperPlayerId,
  selectedOutfieldPlayerIds,
  suggestedOutfieldPlayerIds,
  onSelectGoalkeeper,
  onToggleOutfield,
  confirmed,
  isSaving,
  onConfirm,
}: {
  goalkeepers: MatchweekAwardCandidate[];
  outfieldCandidates: MatchweekAwardCandidate[];
  selectedGoalkeeperPlayerId: string;
  selectedOutfieldPlayerIds: string[];
  suggestedOutfieldPlayerIds: string[];
  onSelectGoalkeeper: (playerId: string) => void;
  onToggleOutfield: (playerId: string) => void;
  confirmed: boolean;
  isSaving: boolean;
  onConfirm: () => void;
}) {
  return (
    <section className="rounded-[22px] bg-white p-5 shadow-[0_10px_24px_rgba(6,20,46,0.08)]">
      <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#0B5FFF]">
        Team of the Week
      </p>

      <h2 className="mt-1 text-xl font-black text-[#06142E]">
        Seleziona la Top Five
      </h2>

      <p className="mt-2 text-xs font-bold leading-5 text-[#06142E]/40">
        Il sistema continua a suggerire una formazione 1-2-2, ma è solo un
        consiglio. Il portiere deve essere un portiere; gli altri quattro posti
        sono liberi tra difensori e attaccanti. Dopo la conferma la scelta è definitiva.
      </p>

      <div className="mt-5 rounded-[16px] bg-[#F3F6FB] p-4">
        <h3 className="text-sm font-black uppercase text-[#06142E]">
          1 · Portiere obbligatorio
        </h3>
        <div className="mt-3 space-y-2">
          {goalkeepers.map((candidate, index) => {
            const selected =
              candidate.playerId === selectedGoalkeeperPlayerId;
            return (
              <SelectionCandidateRow
                key={candidate.playerId}
                candidate={candidate}
                selected={selected}
                suggested={index === 0}
                disabled={confirmed}
                onClick={() => onSelectGoalkeeper(candidate.playerId)}
              />
            );
          })}
        </div>
      </div>

      <div className="mt-4 rounded-[16px] bg-[#F3F6FB] p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-black uppercase text-[#06142E]">
            4 · Giocatori di movimento
          </h3>
          <span className="rounded-full bg-white px-3 py-1 text-[9px] font-black text-[#06142E]">
            {selectedOutfieldPlayerIds.length}/4
          </span>
        </div>

        <p className="mt-2 text-[10px] font-bold leading-4 text-[#06142E]/40">
          Puoi scegliere qualsiasi combinazione di difensori e attaccanti.
        </p>

        <div className="mt-3 space-y-2">
          {outfieldCandidates.map((candidate) => {
            const selected =
              selectedOutfieldPlayerIds.includes(candidate.playerId);
            const suggested =
              suggestedOutfieldPlayerIds.includes(candidate.playerId);
            return (
              <SelectionCandidateRow
                key={candidate.playerId}
                candidate={candidate}
                selected={selected}
                suggested={suggested}
                disabled={
                  confirmed ||
                  (!selected &&
                    selectedOutfieldPlayerIds.length >= 4)
                }
                onClick={() => onToggleOutfield(candidate.playerId)}
              />
            );
          })}
        </div>
      </div>
      <button type="button" onClick={onConfirm} disabled={confirmed || isSaving || !selectedGoalkeeperPlayerId || selectedOutfieldPlayerIds.length !== 4} className="mt-4 min-h-12 w-full rounded-[13px] bg-[#06142E] px-4 text-xs font-black uppercase text-white disabled:opacity-35">{confirmed ? "Top Five confermata" : isSaving ? "Salvataggio..." : "Conferma Top Five"}</button>
    </section>
  );
}

function SelectionCandidateRow({
  candidate,
  selected,
  suggested,
  disabled = false,
  onClick,
}: {
  candidate: MatchweekAwardCandidate;
  selected: boolean;
  suggested: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full rounded-[12px] px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-35 ${
        selected
          ? "bg-[#06142E] text-white"
          : "bg-white text-[#06142E]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-black">
              {candidate.playerName}
            </p>
            <span className={`rounded-full px-2 py-1 text-[8px] font-black uppercase ${
              selected
                ? "bg-white/15 text-white"
                : "bg-[#06142E]/5 text-[#06142E]/45"
            }`}>
              {candidate.role}
            </span>
            {suggested ? (
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-black uppercase text-emerald-700">
                Suggerito
              </span>
            ) : null}
          </div>
          <p className={`mt-1 text-[10px] font-bold ${
            selected ? "text-white/50" : "text-[#06142E]/35"
          }`}>
            {candidate.teamName}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[9px] font-black uppercase ${
          selected
            ? "bg-white text-[#06142E]"
            : "bg-[#F3F6FB] text-[#06142E]/45"
        }`}>
          {selected ? "Scelto" : `Voto ${formatVote(candidate.averageVote)}`}
        </span>
      </div>
    </button>
  );
}

/*
 * ============================================================
 * PUBBLICAZIONE AUTOMATICA
 * ============================================================
 */

function AutomaticPublicationInfoCard() {
  return (
    <section className="rounded-[20px] border border-emerald-100 bg-emerald-50 p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.17em] text-emerald-700/60">
        Pubblicazione automatica
      </p>

      <h2 className="mt-1 text-lg font-black text-emerald-950">
        Cosa costruisce Matchweek Hub
      </h2>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <AutoItem
          icon="📈"
          label="Top 5"
        />

        <AutoItem
          icon="📉"
          label="Flop 5"
        />

        <AutoItem
          icon="⚽"
          label="Risultati"
        />

        <AutoItem
          icon="📊"
          label="Recap"
        />
      </div>

      <p className="mt-4 text-xs font-bold leading-5 text-emerald-900/55">
        Questi contenuti non vanno scelti manualmente: vengono ricavati
        dai voti, dai risultati, dagli MVP e dalle altre informazioni
        già presenti nei tabellini della giornata.
      </p>
    </section>
  );
}

function AutoItem({
  icon,
  label,
}: {
  icon:
    string;

  label:
    string;
}) {
  return (
    <div className="rounded-[12px] bg-white/80 p-3 text-center">
      <div className="text-lg">
        {
          icon
        }
      </div>

      <p className="mt-1 text-[10px] font-black uppercase text-emerald-950/65">
        {
          label
        }
      </p>
    </div>
  );
}

/*
 * ============================================================
 * MESSAGE CARD
 * ============================================================
 */

function MessageCard({
  children,
  error = false,
}: {
  children:
    ReactNode;

  error?:
    boolean;
}) {
  return (
    <section
      className={`rounded-[20px] p-7 text-center ${
        error
          ? "bg-red-50 text-red-700"
          : "bg-white text-[#06142E]/45"
      }`}
    >
      <p className="text-sm font-bold leading-6">
        {
          children
        }
      </p>
    </section>
  );
}

/*
 * ============================================================
 * ORDINAMENTO CANDIDATI
 * ============================================================
 */

function compareCandidates(
  first:
    MatchweekAwardCandidate,

  second:
    MatchweekAwardCandidate,
): number {
  if (
    second.mvp !==
    first.mvp
  ) {
    return (
      second.mvp -
      first.mvp
    );
  }

  if (
    second.averageVote !==
    first.averageVote
  ) {
    return (
      second.averageVote -
      first.averageVote
    );
  }

  if (
    second.matchImportance !==
    first.matchImportance
  ) {
    return (
      second.matchImportance -
      first.matchImportance
    );
  }

  const firstPerformance =
    first.role ===
    "Portiere"
      ? first.cleanSheets
      : first.goals;

  const secondPerformance =
    second.role ===
    "Portiere"
      ? second.cleanSheets
      : second.goals;

  if (
    secondPerformance !==
    firstPerformance
  ) {
    return (
      secondPerformance -
      firstPerformance
    );
  }

  if (
    second.assists !==
    first.assists
  ) {
    return (
      second.assists -
      first.assists
    );
  }

  return first.playerName.localeCompare(
    second.playerName,
    "it",
  );
}

/*
 * ============================================================
 * FORMAT VOTO
 * ============================================================
 */

function formatVote(
  value:
    number,
): string {
  return new Intl.NumberFormat(
    "it-IT",
    {
      minimumFractionDigits:
        1,

      maximumFractionDigits:
        1,
    },
  ).format(
    value,
  );
}
