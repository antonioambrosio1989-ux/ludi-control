"use client";
/* eslint-disable react-hooks/set-state-in-effect, @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Clock3,
  Link2,
  LockKeyhole,
  Plus,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";

import TeamLogo from "@/components/common/TeamLogo";
import FutPlayerCard from "@/components/players/FutPlayerCard";
import {
  getDefaultFutCardLayout,
} from "@/src/application/fut/FutCardLayoutDefaults";
import {
  FirebaseFutCardLayoutRepository,
} from "@/src/services/fut/FirebaseFutCardLayoutRepository";
import type {
  FutCardLayout,
} from "@/src/types/FutCardLayout";
import AppShell from "@/components/ui/AppShell";
import GameDemoBanner from "@/components/games/demo/GameDemoBanner";
import { useCompetition } from "@/src/contexts/CompetitionContext";
import { useAuth } from "@/src/hooks/useAuth";
import {
  BEST_OF_MONTH_AWARD_LABELS,
  BUILD_XI_REQUIRED_ROLE_COUNTS,
  BUILD_XI_ROLE_LABELS,
  VOTING_TYPE_LABELS,
  type BestOfMonthAwardKey,
  type BestOfMonthPublicWinner,
  type BuildXiCandidate,
  type BuildXiLineup,
  type BuildXiRole,
  type CeremonyAwardPublicResult,
  type GamesVotingPoll,
  type ManOfTheMatchPublicResult,
  type ScorePredictionPublicResult,
  type VotingAdminResults,
  type VotingCandidate,
} from "@/src/types/GamesVoting";

type PublicPoll = GamesVotingPoll & { isClickable: boolean };
type RuntimeSubmission = Record<string, unknown> | null;
type Runtime = {
  poll: GamesVotingPoll;
  candidates: BuildXiCandidate[];
  submission?: RuntimeSubmission;
  submissions?: RuntimeSubmission[];
  results?: VotingAdminResults;
  bestOfMonthWinners?: Partial<
    Record<
      BestOfMonthAwardKey,
      BestOfMonthPublicWinner
    >
  >;
  scorePredictionResult?: ScorePredictionPublicResult;
  manOfTheMatchResult?: ManOfTheMatchPublicResult;
  ceremonyAwardResult?: CeremonyAwardPublicResult;
};

const BEST_OF_MONTH_KEYS: BestOfMonthAwardKey[] = [
  "player_of_the_month",
  "goal_of_the_month",
  "save_of_the_month",
];

const SLOTS: Array<{ role: BuildXiRole; index: number }> = [
  { role: "goalkeeper", index: 0 },
  { role: "defender", index: 0 }, { role: "defender", index: 1 }, { role: "defender", index: 2 },
  { role: "midfielder", index: 0 }, { role: "midfielder", index: 1 }, { role: "midfielder", index: 2 }, { role: "midfielder", index: 3 },
  { role: "forward", index: 0 }, { role: "forward", index: 1 }, { role: "forward", index: 2 },
];

export default function VotingGameScreen({
  gameId,
  demoMode = false,
  demoPollId,
  directPollId,
  directAwardKey,
}: {
  gameId: string;
  demoMode?: boolean;
  demoPollId?: string;
  directPollId?: string;
  directAwardKey?: BestOfMonthAwardKey;
}) {
  const { user, isLoading: authLoading } = useAuth();
  const { activeCompetitions } = useCompetition();
  const router = useRouter();

  const [polls, setPolls] = useState<PublicPoll[]>([]);
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [previewPoll, setPreviewPoll] = useState<PublicPoll | null>(null);
  const [selectedPollId, setSelectedPollId] = useState<string | null>(null);
  const [activeAwardKey, setActiveAwardKey] = useState<BestOfMonthAwardKey | null>(directAwardKey ?? null);

  const [lineup, setLineup] = useState<Partial<Record<string, string>>>({});
  const [editing, setEditing] = useState<{ role: BuildXiRole; index: number } | null>(null);
  const [singleChoiceId, setSingleChoiceId] = useState("");
  const [bestSelections, setBestSelections] = useState<Partial<Record<BestOfMonthAwardKey, string>>>({});
  const [scoreHome, setScoreHome] = useState("0");
  const [scoreAway, setScoreAway] = useState("0");
  const [topScorerId, setTopScorerId] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const authenticatedFetch = useCallback(async (url: string, init?: RequestInit) => {
    if (!user) throw new Error("Accedi per partecipare alle votazioni.");
    const response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await user.getIdToken()}`,
        ...init?.headers,
      },
    });
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(typeof data.error === "string" ? data.error : "Operazione non riuscita.");
    }
    return data;
  }, [user]);

  const hydrateRuntime = useCallback((value: Runtime, isDemo: boolean) => {
    const nextPoll = isDemo ? resolveDemoPoll(value.poll) : value.poll;
    const sourceCandidates = Array.isArray(value.candidates) ? value.candidates : [];
    const nextRuntime: Runtime = {
      ...value,
      poll: nextPoll,
      candidates: nextPoll.type === "build_xi"
        ? resolveDemoCandidates(sourceCandidates, nextPoll, isDemo)
        : sourceCandidates,
    };
    setRuntime(nextRuntime);
    setSelectedPollId(nextPoll.id);

    const submission = nextRuntime.submission ?? null;
    setLineup(
      submission && isBuildXiLineup(submission.lineup)
        ? lineupToSlots(submission.lineup)
        : {},
    );
    setSingleChoiceId(
      submission && typeof submission.optionId === "string"
        ? submission.optionId
        : "",
    );
    setScoreHome(
      submission && typeof submission.homeScore === "number"
        ? String(submission.homeScore)
        : "0",
    );
    setScoreAway(
      submission && typeof submission.awayScore === "number"
        ? String(submission.awayScore)
        : "0",
    );
    setTopScorerId(
      submission && typeof submission.topScorerPlayerId === "string"
        ? submission.topScorerPlayerId
        : submission && typeof submission.firstScorerPlayerId === "string"
          ? submission.firstScorerPlayerId
          : "",
    );

    const monthly: Partial<Record<BestOfMonthAwardKey, string>> = {};
    for (const item of nextRuntime.submissions ?? []) {
      if (!item) continue;
      const awardKey = String(item.awardKey ?? "") as BestOfMonthAwardKey;
      if (BEST_OF_MONTH_KEYS.includes(awardKey) && typeof item.optionId === "string") {
        monthly[awardKey] = item.optionId;
      }
    }
    setBestSelections(monthly);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const pollToOpen = demoMode ? demoPollId : directPollId;
    if (pollToOpen) {
      const requestPromise = demoMode
        ? authenticatedFetch(
            `/api/admin/games/votazioni/${encodeURIComponent(gameId)}?preview=1&pollId=${encodeURIComponent(pollToOpen)}`,
          ).then((value) => ({
            poll: value.poll as GamesVotingPoll,
            candidates: Array.isArray(value.candidates) ? value.candidates as BuildXiCandidate[] : [],
            submission: null,
            submissions: [],
          } satisfies Runtime))
        : authenticatedFetch(
            `/api/games/votazioni/${encodeURIComponent(gameId)}/${encodeURIComponent(pollToOpen)}`,
          ) as Promise<unknown> as Promise<Runtime>;

      requestPromise
        .then((value) => {
          hydrateRuntime(value, demoMode);
          setActiveAwardKey(directAwardKey ?? null);
        })
        .catch((current) => setError(current instanceof Error ? current.message : "Impossibile caricare la votazione."))
        .finally(() => setLoading(false));
      return;
    }

    authenticatedFetch(`/api/games/votazioni/${encodeURIComponent(gameId)}`)
      .then((value) => setPolls(value.polls as PublicPoll[]))
      .catch((current) => setError(current instanceof Error ? current.message : "Impossibile caricare le votazioni."))
      .finally(() => setLoading(false));
  }, [authenticatedFetch, authLoading, demoMode, demoPollId, directAwardKey, directPollId, gameId, hydrateRuntime, user]);

  async function openPoll(poll: PublicPoll) {
    setError(null);

    const canOpenRuntime =
      poll.status ===
        "published" ||
      (
        poll.status ===
          "closed" &&
        [
          "build_xi",
          "best_of_the_month",
          "score_prediction",
          "man_of_the_match",
          "ceremony_award",
        ].includes(
          poll.type,
        )
      );

    if (
      !canOpenRuntime
    ) {
      setPreviewPoll(
        poll,
      );
      setSelectedPollId(
        poll.id,
      );
      setRuntime(
        null,
      );
      return;
    }

    setLoading(true);
    try {
      const value = await authenticatedFetch(
        `/api/games/votazioni/${encodeURIComponent(gameId)}/${encodeURIComponent(poll.id)}`,
      ) as unknown as Runtime;
      hydrateRuntime(value, false);
      setActiveAwardKey(null);
    } catch (current) {
      setError(current instanceof Error ? current.message : "Impossibile aprire la votazione.");
    } finally {
      setLoading(false);
    }
  }

  const selectedBuildXiIds = useMemo(
    () => new Set(
      Object.values(lineup).filter(
        (value): value is string => typeof value === "string" && value.length > 0,
      ),
    ),
    [lineup],
  );
  const buildXiComplete = SLOTS.every((slot) => Boolean(lineup[slotKey(slot.role, slot.index)]));

  function choose(candidate: BuildXiCandidate) {
    if (!editing || Boolean(runtime?.submission)) return;
    setLineup((current) => ({
      ...current,
      [slotKey(editing.role, editing.index)]: candidate.playerId,
    }));
    setEditing(null);
  }

  async function submitBuildXi() {
    if (!runtime || runtime.poll.type !== "build_xi" || !buildXiComplete || runtime.submission) return;
    if (!window.confirm(demoMode
      ? "Confermi la BUILD XI demo? Nessun dato verrà salvato."
      : "Confermi l'invio? Dopo la conferma non potrai modificare la tua BUILD XI.")) return;

    const finalLineup = slotsToLineup(lineup);
    await submitAction(
      { lineup: finalLineup },
      () => setRuntime((current) => current ? { ...current, submission: { lineup: finalLineup } } : current),
    );
  }

  async function submitBestAward(awardKey: BestOfMonthAwardKey) {
    if (!runtime || runtime.poll.type !== "best_of_the_month") return;
    const optionId = bestSelections[awardKey];
    if (!optionId || isBestAwardLocked(runtime, awardKey)) return;
    if (!window.confirm(demoMode
      ? `Confermi il voto demo per ${BEST_OF_MONTH_AWARD_LABELS[awardKey]}?`
      : `Confermi il voto per ${BEST_OF_MONTH_AWARD_LABELS[awardKey]}? Non potrai modificarlo.`)) return;

    await submitAction(
      { awardKey, optionId },
      () => setRuntime((current) => current ? {
        ...current,
        submissions: [
          ...(current.submissions ?? []),
          { type: "best_of_the_month", awardKey, optionId },
        ],
      } : current),
    );
  }

  async function submitScorePrediction() {
    if (!runtime || runtime.poll.type !== "score_prediction" || runtime.submission) return;
    const homeScore = Number(scoreHome);
    const awayScore = Number(scoreAway);
    const needsScorer = homeScore + awayScore > 0;
    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) return;
    if (needsScorer && !topScorerId) return;
    if (!window.confirm(demoMode
      ? "Confermi il pronostico demo?"
      : "Confermi il pronostico? Dopo la conferma non potrai modificarlo.")) return;

    const payload = {
      homeScore,
      awayScore,
      topScorerPlayerId: needsScorer ? topScorerId : null,
    };
    await submitAction(
      payload,
      () => setRuntime((current) => current ? { ...current, submission: payload } : current),
    );
  }

  async function submitSingleChoice() {
    if (!runtime || !["man_of_the_match", "ceremony_award"].includes(runtime.poll.type) || runtime.submission || !singleChoiceId) return;
    if (!window.confirm(demoMode
      ? "Confermi il voto demo?"
      : "Confermi il voto? Dopo la conferma non potrai modificarlo.")) return;
    await submitAction(
      { optionId: singleChoiceId },
      () => setRuntime((current) => current ? { ...current, submission: { optionId: singleChoiceId } } : current),
    );
  }

  async function submitAction(body: Record<string, unknown>, onSuccess: () => void) {
    if (!runtime || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      if (!demoMode) {
        await authenticatedFetch(
          `/api/games/votazioni/${encodeURIComponent(gameId)}/${encodeURIComponent(runtime.poll.id)}`,
          { method: "POST", body: JSON.stringify(body) },
        );
      }
      onSuccess();
    } catch (current) {
      setError(current instanceof Error ? current.message : "Invio non riuscito.");
    } finally {
      setSubmitting(false);
    }
  }

  function closeRuntime() {
    if (directPollId) {
      router.push("/games");
      return;
    }
    if (demoMode) {
      router.push(`/admin/games/giochi/${encodeURIComponent(gameId)}/votazioni`);
      return;
    }
    setSelectedPollId(null);
    setRuntime(null);
    setPreviewPoll(null);
    setLineup({});
    setSingleChoiceId("");
    setBestSelections({});
    setEditing(null);
    setActiveAwardKey(null);
  }

  if (loading) {
    return (
      <AppShell>
        <main className="min-h-screen bg-white pb-28">
          <Message>Caricamento votazioni...</Message>
        </main>
      </AppShell>
    );
  }

  if (!authLoading && !user) {
    return (
      <AppShell>
        <main className="min-h-screen bg-white pb-28">
          <Message>
            Accedi per aprire la votazione e partecipare.
          </Message>
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="mt-4 min-h-12 w-full rounded-[13px] bg-[#06142E] px-5 text-xs font-black uppercase text-white"
          >
            Accedi
          </button>
        </main>
      </AppShell>
    );
  }

  if (
    previewPoll
  ) {
    const concluded =
      previewPoll.status ===
        "closed";

    return (
      <AppShell>
        <main className="min-h-screen bg-white pb-28">
          <button
            type="button"
            onClick={() => {
              setPreviewPoll(
                null,
              );
              setSelectedPollId(
                null,
              );
            }}
            aria-label="Indietro"
            className="mb-4 flex items-center gap-2 text-xs font-black uppercase text-[#06142E]/55"
          >
            <ChevronLeft size={17} />
          </button>

          <p className="mt-5 text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/40">
            Ludi vote
          </p>

          <h1 className="mt-1 text-3xl font-black uppercase text-[#06142E]">
            {previewPoll.title}
          </h1>

          {previewPoll.description?.trim() ? (
            <p className="mt-2 text-sm font-bold leading-6 text-[#06142E]/55">
              {previewPoll.description}
            </p>
          ) : null}

          <section className="mt-5 rounded-[20px] bg-[#F1F2F4] p-5">
            <p className="text-sm font-black text-[#06142E]/55">
              {concluded
                ? "La votazione è conclusa"
                : "La votazione sarà disponibile prossimamente"}
            </p>
          </section>

          <div
            aria-hidden="true"
            className="pointer-events-none mt-5 select-none opacity-55 grayscale"
          >
            <VotingDemoPreview
              poll={
                previewPoll
              }
            />
          </div>
        </main>
      </AppShell>
    );
  }

  if (runtime && selectedPollId) {
    if (runtime.poll.type === "build_xi") {
      return (
        <BuildXiRuntime
          runtime={runtime}
          demoMode={demoMode}
          lineup={lineup}
          selectedIds={selectedBuildXiIds}
          editing={editing}
          error={error}
          submitting={submitting}
          complete={buildXiComplete}
          onBack={closeRuntime}
          onEdit={(role, index) => setEditing({ role, index })}
          onChoose={choose}
          onClosePicker={() => setEditing(null)}
          onSubmit={() => void submitBuildXi()}
        />
      );
    }

    if (runtime.poll.type === "best_of_the_month") {
      return (
        <BestOfMonthRuntime
          gameId={gameId}
          runtime={runtime}
          demoMode={demoMode}
          activeAwardKey={activeAwardKey}
          selections={bestSelections}
          submitting={submitting}
          error={error}
          onBack={activeAwardKey ? () => setActiveAwardKey(null) : closeRuntime}
          onOpenAward={setActiveAwardKey}
          onSelect={(key, optionId) => setBestSelections((current) => ({ ...current, [key]: optionId }))}
          onSubmit={(key) => void submitBestAward(key)}
        />
      );
    }

    if (runtime.poll.type === "score_prediction") {
      return (
        <ScorePredictionRuntime
          runtime={runtime}
          demoMode={demoMode}
          homeScore={scoreHome}
          awayScore={scoreAway}
          topScorerId={topScorerId}
          submitting={submitting}
          error={error}
          onBack={closeRuntime}
          onHomeScore={setScoreHome}
          onAwayScore={setScoreAway}
          onTopScorer={setTopScorerId}
          onSubmit={() => void submitScorePrediction()}
        />
      );
    }

    return (
      <SingleChoiceRuntime
        runtime={runtime}
        demoMode={demoMode}
        selectedId={singleChoiceId}
        submitting={submitting}
        error={error}
        onBack={closeRuntime}
        onSelect={setSingleChoiceId}
        onSubmit={() => void submitSingleChoice()}
      />
    );
  }

  return (
    <AppShell>
      <main className="min-h-screen bg-white pb-28">
        <button
          type="button"
          onClick={() => router.push("/games")}
          className="mt-6 mb-3 flex items-center gap-2 text-xs font-black uppercase text-[#06142E]/55"
        >
          <ChevronLeft size={17} /> Games
        </button>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#06142E]/40">Ludi Experience</p>
        <h1 className="mt-1 text-3xl font-black uppercase text-[#06142E]">Votazioni</h1>
        <p className="mt-1 text-sm font-bold text-[#06142E]/50">La tua opinione conta!</p>

        {error ? <Message error>{error}</Message> : null}

        <div className="mt-6 space-y-4">
          {polls.length === 0 ? <Message>Nessuna votazione disponibile.</Message> : null}
          {polls.map((poll) => {
            const theme = resolveVotingCardTheme(poll, activeCompetitions);
            const statusLabel = getVotingStatusLabel(poll.status);
            return (
              <button
                key={poll.id}
                type="button"
                onClick={() => void openPoll(poll)}
                className="group relative w-full cursor-pointer overflow-hidden rounded-[22px] border border-white/10 p-5 text-left shadow-[0_14px_32px_rgba(6,20,46,0.20)] transition duration-200 hover:-translate-y-0.5 active:scale-[0.99]"
                style={{ backgroundColor: theme.primaryColor, color: theme.textColor }}
              >
                <VotingCardBackground />
                <div className="relative z-10">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-[7px] bg-white px-3 py-1 text-[9px] font-black uppercase" style={{ color: theme.primaryColor }}>
                      {theme.competitionLabel}
                    </span>
                    {poll.status === "published" ? (
                      <span className="inline-flex items-center rounded-[7px] bg-emerald-300 px-3 py-1 text-[9px] font-black uppercase text-emerald-950">
                        {statusLabel}
                      </span>
                    ) : poll.status === "closed" ? (
                      <span className="inline-flex items-center rounded-[7px] bg-white/85 px-3 py-1 text-[9px] font-black uppercase text-[#06142E]/55">
                        {statusLabel}
                      </span>
                    ) : poll.type === "build_xi" ? (
                      <span className="inline-flex items-center rounded-[7px] bg-[#FFD338] px-3 py-1 text-[9px] font-black uppercase text-[#06142E]">
                        Prossimamente
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2">
                    <h2 className="text-[24px] font-black uppercase leading-tight">{poll.title}</h2>
                    <p className="mt-2 text-sm font-semibold italic leading-5 opacity-65">
                      {poll.description?.trim() || defaultPollSubtitle(poll)}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </main>
    </AppShell>
  );
}

function BuildXiRuntime({
  runtime,
  demoMode,
  lineup,
  selectedIds,
  editing,
  error,
  submitting,
  complete,
  onBack,
  onEdit,
  onChoose,
  onClosePicker,
  onSubmit,
}: {
  runtime: Runtime;
  demoMode: boolean;
  lineup: Partial<Record<string, string>>;
  selectedIds: Set<string>;
  editing: { role: BuildXiRole; index: number } | null;
  error: string | null;
  submitting: boolean;
  complete: boolean;
  onBack: () => void;
  onEdit: (role: BuildXiRole, index: number) => void;
  onChoose: (candidate: BuildXiCandidate) => void;
  onClosePicker: () => void;
  onSubmit: () => void;
}) {
  const locked =
    Boolean(
      runtime.submission,
    ) ||
    runtime.poll.status !==
      "published";

  const [
    futLayout,
    setFutLayout,
  ] =
    useState<
      FutCardLayout
    >(
      () =>
        getDefaultFutCardLayout(),
    );

  useEffect(() => {
    return FirebaseFutCardLayoutRepository.subscribe(
      setFutLayout,
    );
  }, []);

  if (
    runtime.poll.status ===
      "closed" &&
    runtime.results?.buildXi
  ) {
    return (
      <RuntimeShell
        poll={
          runtime.poll
        }
        demoMode={
          demoMode
        }
        onBack={
          onBack
        }
        error={
          error
        }
      >
        <BuildXiResultsView
          results={
            runtime.results
          }
          candidates={
            runtime.candidates
          }
          futLayout={
            futLayout
          }
        />
      </RuntimeShell>
    );
  }

  return (
    <RuntimeShell poll={runtime.poll} demoMode={demoMode} onBack={onBack} error={error}>
      {runtime.submission ? <LockedMessage demoMode={demoMode} /> : null}
      <Pitch
        lineup={lineup}
        candidates={runtime.candidates}
        locked={locked}
        futLayout={futLayout}
        onEdit={onEdit}
      />
      {!locked ? (
        <SubmitButton disabled={!complete || submitting} onClick={onSubmit}>
          {submitting ? "Invio..." : demoMode ? "Conferma demo" : "Conferma e invia"}
        </SubmitButton>
      ) : null}
      {editing ? (
        <PlayerPicker
          role={editing.role}
          candidates={runtime.candidates.filter((candidate) => candidate.buildXiRole === editing.role)}
          selectedIds={selectedIds}
          currentId={lineup[slotKey(editing.role, editing.index)]}
          futLayout={futLayout}
          onChoose={onChoose}
          onClose={onClosePicker}
        />
      ) : null}
    </RuntimeShell>
  );
}

function BestOfMonthRuntime({
  gameId,
  runtime,
  demoMode,
  activeAwardKey,
  selections,
  submitting,
  error,
  onBack,
  onOpenAward,
  onSelect,
  onSubmit,
}: {
  gameId: string;
  runtime: Runtime;
  demoMode: boolean;
  activeAwardKey: BestOfMonthAwardKey | null;
  selections: Partial<Record<BestOfMonthAwardKey, string>>;
  submitting: boolean;
  error: string | null;
  onBack: () => void;
  onOpenAward: (key: BestOfMonthAwardKey) => void;
  onSelect: (key: BestOfMonthAwardKey, optionId: string) => void;
  onSubmit: (key: BestOfMonthAwardKey) => void;
}) {
  const config = runtime.poll.bestOfMonth;
  if (!config) {
    return <RuntimeShell poll={runtime.poll} demoMode={demoMode} onBack={onBack} error={error}><Message>Configurazione mensile non disponibile.</Message></RuntimeShell>;
  }

  if (activeAwardKey) {
    const award = config.awards[activeAwardKey];
    const locked = isBestAwardLocked(runtime, activeAwardKey) || runtime.poll.status !== "published";
    return (
      <RuntimeShell poll={runtime.poll} demoMode={demoMode} onBack={onBack} error={error} eyebrow={config.monthLabel}>
        <h2 className="mt-4 text-2xl font-black uppercase text-[#06142E]">{award.title}</h2>
        <p className="mt-1 text-sm font-bold text-[#06142E]/45">Scegli un solo candidato.</p>
        {locked && isBestAwardLocked(runtime, activeAwardKey) ? <LockedMessage demoMode={demoMode} /> : null}
        <div className="mt-5 space-y-3">
          {award.candidates.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              selected={selections[activeAwardKey] === candidate.id}
              disabled={locked}
              onClick={() => onSelect(activeAwardKey, candidate.id)}
            />
          ))}
        </div>
        {!locked ? (
          <SubmitButton disabled={!selections[activeAwardKey] || submitting} onClick={() => onSubmit(activeAwardKey)}>
            {submitting ? "Invio..." : "Conferma voto"}
          </SubmitButton>
        ) : null}
      </RuntimeShell>
    );
  }

  return (
    <RuntimeShell poll={runtime.poll} demoMode={demoMode} onBack={onBack} error={error} eyebrow={config.monthLabel}>
      <div className="mt-4 flex items-center gap-2 rounded-[16px] bg-[#F5F5F2] p-4 text-xs font-bold text-[#06142E]/50">
        <Clock3 size={18} />
        <span>
          Votazioni aperte dal {new Date(config.opensAtMs).toLocaleString("it-IT")} al {new Date(config.closesAtMs).toLocaleString("it-IT")}.
        </span>
      </div>
      <div className="mt-5 space-y-3">
        {BEST_OF_MONTH_KEYS.map((key) => {
          const locked =
            isBestAwardLocked(
              runtime,
              key,
            );

          const winner =
            runtime
              .bestOfMonthWinners?.[
                key
              ];

          const isClosed =
            runtime.poll.status ===
            "closed";

          return (
            <div key={key} className="rounded-[20px] bg-[#06142E] p-5 text-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/45">Premio mensile</p>
                  <h2 className="mt-1 text-xl font-black uppercase">{BEST_OF_MONTH_AWARD_LABELS[key]}</h2>
                  <p className="mt-1 text-xs font-bold text-white/45">{config.awards[key].candidates.length} candidati</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[8px] font-black uppercase ${
                    winner
                      ? "bg-emerald-300 text-emerald-950"
                      : locked
                        ? "bg-white/85 text-[#06142E]"
                        : "bg-[#FFD338] text-[#06142E]"
                  }`}
                >
                  {winner
                    ? "Vincitore"
                    : isClosed
                      ? "In attesa"
                      : locked
                        ? "Votato"
                        : runtime.poll.status === "published"
                          ? "Vota"
                          : "Non aperto"}
                </span>
              </div>
              {winner ? (
                <div className="mt-4 flex items-center gap-3 rounded-[14px] bg-white/[0.10] p-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
                    {winner.candidate.imageUrl ? (
                      <img
                        src={winner.candidate.imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Users size={18} className="text-[#06142E]/40" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="text-[8px] font-black uppercase tracking-[0.14em] text-white/45">
                      Vincitore
                    </p>

                    <p className="mt-0.5 truncate text-sm font-black uppercase text-white">
                      {winner.candidate.label}
                    </p>

                    {winner.candidate.teamName ? (
                      <p className="mt-0.5 truncate text-[9px] font-bold text-white/45">
                        {winner.candidate.teamName}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : isClosed ? (
                <div className="mt-4 rounded-[14px] bg-white/[0.08] p-3">
                  <p className="text-[10px] font-bold leading-5 text-white/55">
                    Votazione conclusa. Il risultato sarà visibile dopo la finalizzazione Admin.
                  </p>
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                <button
                  type="button"
                  onClick={() => onOpenAward(key)}
                  className="min-h-11 rounded-[12px] bg-white px-4 text-[9px] font-black uppercase text-[#06142E]"
                >
                  {winner
                    ? "Vedi candidati"
                    : isClosed
                      ? "Vedi votazione"
                      : "Apri votazione"}
                </button>
                {!demoMode ? (
                  <button
                    type="button"
                    onClick={() => shareBestOfMonth(gameId, runtime.poll.id, key)}
                    aria-label={`Condividi ${BEST_OF_MONTH_AWARD_LABELS[key]}`}
                    className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-white/10"
                  >
                    <Link2 size={17} />
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </RuntimeShell>
  );
}

function ScorePredictionRuntime({
  runtime,
  demoMode,
  homeScore,
  awayScore,
  topScorerId,
  submitting,
  error,
  onBack,
  onHomeScore,
  onAwayScore,
  onTopScorer,
  onSubmit,
}: {
  runtime: Runtime;
  demoMode: boolean;
  homeScore: string;
  awayScore: string;
  topScorerId: string;
  submitting: boolean;
  error: string | null;
  onBack: () => void;
  onHomeScore: (value: string) => void;
  onAwayScore: (value: string) => void;
  onTopScorer: (value: string) => void;
  onSubmit: () => void;
}) {
  const config = runtime.poll.scorePrediction;
  if (!config) {
    return (
      <RuntimeShell poll={runtime.poll} demoMode={demoMode} onBack={onBack} error={error}>
        <Message>Partita non configurata.</Message>
      </RuntimeShell>
    );
  }

  const posterImageUrl = demoMode
    ? "/games/demo/score-prediction-cover.png"
    : config.posterImageUrl;

  const locked = Boolean(runtime.submission) || runtime.poll.status !== "published";
  const totalGoals = Number(homeScore || 0) + Number(awayScore || 0);
  const valid =
    Number.isInteger(Number(homeScore)) &&
    Number.isInteger(Number(awayScore)) &&
    Number(homeScore) >= 0 &&
    Number(awayScore) >= 0 &&
    (totalGoals === 0 || Boolean(topScorerId));

  return (
    <RuntimeShell
      poll={runtime.poll}
      demoMode={demoMode}
      onBack={onBack}
      error={error}
      eyebrow="Ludi vote"
      eyebrowTone="muted"
      hideBackLabel
    >
      <section className="relative mt-5 aspect-[9/16] w-full overflow-hidden rounded-[26px] bg-[#06142E] shadow-[0_18px_42px_rgba(6,20,46,0.20)]">
        {posterImageUrl ? (
          <img
            src={posterImageUrl}
            alt={`Locandina ${config.match.homeTeamName} - ${config.match.awayTeamName}`}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#173a70,#06142e_68%)]" />
        )}

        <div className="absolute bottom-3 left-1/2 w-[94%] -translate-x-1/2 rounded-[20px] bg-[#E5E7EB]/95 px-3 py-3 shadow-[0_14px_30px_rgba(0,0,0,0.20)] sm:bottom-4 sm:w-[76%] sm:max-w-[620px] sm:px-4 sm:py-4">
          <div className="flex w-full items-center justify-center gap-3 sm:gap-4">
            <div className="flex shrink-0 items-center justify-center">
              <PredictionTeamLogo
                name={config.match.homeTeamName}
                logoUrl={config.match.homeTeamLogoUrl}
              />
            </div>

            <div className="flex shrink-0 items-center justify-center gap-2 sm:gap-3">
              <ScoreStepper
                label={config.match.homeTeamName}
                value={homeScore}
                disabled={locked}
                onChange={onHomeScore}
              />
              <span className="pb-1 text-2xl font-black text-[#06142E]/35 sm:text-3xl">-</span>
              <ScoreStepper
                label={config.match.awayTeamName}
                value={awayScore}
                disabled={locked}
                onChange={onAwayScore}
              />
            </div>

            <div className="flex shrink-0 items-center justify-center">
              <PredictionTeamLogo
                name={config.match.awayTeamName}
                logoUrl={config.match.awayTeamLogoUrl}
              />
            </div>
          </div>
        </div>
      </section>

      {runtime.submission ? <LockedMessage demoMode={demoMode} /> : null}

      {runtime.poll.status === "closed" ? (
        <ScorePredictionPublicResultPanel
          result={runtime.scorePredictionResult}
        />
      ) : null}

      <section className="mt-5 rounded-[22px] border border-[#06142E]/10 bg-white p-5 shadow-[0_10px_28px_rgba(6,20,46,0.08)]">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#0B5FFF]">Miglior marcatore</p>
        <h2 className="mt-1 text-xl font-black uppercase text-[#06142E]">Chi segnerà di più?</h2>
        <p className="mt-2 text-xs font-bold leading-5 text-[#06142E]/45">
          La lista contiene i giocatori delle formazioni inviate dai presidenti tramite WhatsApp per questa partita.
        </p>

        <div className="relative mt-4">
          <select
            value={topScorerId}
            disabled={locked || totalGoals === 0}
            onChange={(event) => onTopScorer(event.target.value)}
            className="min-h-14 w-full appearance-none rounded-[15px] bg-[#F5F5F2] px-4 pr-12 text-sm font-black text-[#06142E] outline-none disabled:opacity-45"
          >
            <option value="">{totalGoals === 0 ? "Nessun marcatore (0-0)" : "Seleziona il miglior marcatore..."}</option>
            {config.scorerOptions.map((candidate) => (
              <option key={candidate.id} value={candidate.playerId ?? candidate.id}>
                {candidate.label}{candidate.teamName ? ` · ${candidate.teamName}` : ""}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            size={19}
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#06142E]/40"
          />
        </div>
      </section>

      {!locked ? (
        <SubmitButton disabled={!valid || submitting} onClick={onSubmit}>
          {submitting ? "Invio..." : "Conferma pronostico"}
        </SubmitButton>
      ) : null}
    </RuntimeShell>
  );
}

function ScorePredictionPublicResultPanel({
  result,
}: {
  result:
    ScorePredictionPublicResult |
    undefined;
}) {
  if (
    !result ||
    result.status ===
      "pending"
  ) {
    return (
      <section className="mt-5 rounded-[22px] bg-[#F5F5F2] p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#06142E]/35">
          Risultato
        </p>

        <p className="mt-2 text-sm font-black uppercase text-[#06142E]">
          In attesa del tabellino ufficiale
        </p>

        <p className="mt-1 text-xs font-bold leading-5 text-[#06142E]/45">
          Il pronostico è chiuso. Il risultato verrà calcolato dopo la pubblicazione del tabellino definitivo.
        </p>
      </section>
    );
  }

  const own =
    result.ownResult;

  return (
    <section className="mt-5 space-y-4 rounded-[22px] bg-[#06142E] p-5 text-white">
      <div>
        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-white/40">
          Risultato ufficiale
        </p>

        <p className="mt-1 text-3xl font-black">
          {result.actualHomeScore}
          {" - "}
          {result.actualAwayScore}
        </p>
      </div>

      <div>
        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-white/40">
          Miglior marcatore
        </p>

        <p className="mt-1 text-sm font-black uppercase">
          {result.topScorers.length > 0
            ? result.topScorers
                .map(
                  (
                    candidate,
                  ) =>
                    candidate.label,
                )
                .join(
                  ", ",
                )
            : "Nessun marcatore"}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <ResultCount
          label="Risultato"
          value={result.exactScoreWinnerCount}
        />
        <ResultCount
          label="Marcatore"
          value={result.topScorerWinnerCount}
        />
        <ResultCount
          label="Perfect"
          value={result.perfectWinnerCount}
        />
      </div>

      {own ? (
        <div className="rounded-[15px] bg-white/[0.09] p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/40">
            Il tuo esito
          </p>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <OwnResultBadge
              label="Risultato"
              success={own.exactScore}
            />
            <OwnResultBadge
              label="Marcatore"
              success={own.topScorer}
            />
            <OwnResultBadge
              label="Perfect"
              success={own.perfect}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ResultCount({
  label,
  value,
}: {
  label:
    string;
  value:
    number;
}) {
  return (
    <div className="rounded-[13px] bg-white/[0.09] p-3 text-center">
      <p className="text-xl font-black">
        {value}
      </p>

      <p className="mt-1 text-[8px] font-black uppercase text-white/40">
        {label}
      </p>
    </div>
  );
}

function OwnResultBadge({
  label,
  success,
}: {
  label:
    string;
  success:
    boolean;
}) {
  return (
    <div className="rounded-[12px] bg-white/[0.08] px-2 py-3">
      <p className="text-lg font-black">
        {success
          ? "✓"
          : "—"}
      </p>

      <p className="mt-1 text-[8px] font-black uppercase text-white/45">
        {label}
      </p>
    </div>
  );
}

function SingleChoiceRuntime({
  runtime,
  demoMode,
  selectedId,
  submitting,
  error,
  onBack,
  onSelect,
  onSubmit,
}: {
  runtime: Runtime;
  demoMode: boolean;
  selectedId: string;
  submitting: boolean;
  error: string | null;
  onBack: () => void;
  onSelect: (value: string) => void;
  onSubmit: () => void;
}) {
  const isMotm = runtime.poll.type === "man_of_the_match";
  const candidates = isMotm
    ? runtime.poll.manOfTheMatch?.candidates ?? []
    : runtime.poll.ceremonyAward?.candidates ?? [];
  const locked = Boolean(runtime.submission) || runtime.poll.status !== "published";
  const match = runtime.poll.manOfTheMatch?.match;

  return (
    <RuntimeShell poll={runtime.poll} demoMode={demoMode} onBack={onBack} error={error}>
      {match ? (
        <div className="mt-4 rounded-[18px] bg-[#F5F5F2] p-4 text-center">
          <p className="text-xs font-black uppercase text-[#06142E]">{match.homeTeamName} - {match.awayTeamName}</p>
          <p className="mt-1 text-[10px] font-bold text-[#06142E]/40">{formatMatchDate(match.date, match.time)}</p>
        </div>
      ) : null}
      {runtime.submission ? <LockedMessage demoMode={demoMode} /> : null}

      {isMotm &&
      runtime.poll.status === "closed" ? (
        <ManOfTheMatchPublicResultPanel
          result={
            runtime.manOfTheMatchResult
          }
        />
      ) : null}

      {!isMotm &&
      runtime.poll.status === "closed" ? (
        <CeremonyAwardPublicResultPanel
          result={
            runtime.ceremonyAwardResult
          }
        />
      ) : null}

      <div className="mt-5 space-y-3">
        {candidates.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            selected={
              selectedId ===
                candidate.id ||
              (
                (
                  isMotm &&
                  runtime.poll.status ===
                    "closed" &&
                  runtime.manOfTheMatchResult
                    ?.ownVoteCandidateId ===
                    candidate.id
                ) ||
                (
                  !isMotm &&
                  runtime.poll.status ===
                    "closed" &&
                  runtime.ceremonyAwardResult
                    ?.ownVoteCandidateId ===
                    candidate.id
                )
              )
            }
            disabled={locked}
            onClick={() => onSelect(candidate.id)}
          />
        ))}
      </div>
      {!locked ? <SubmitButton disabled={!selectedId || submitting} onClick={onSubmit}>{submitting ? "Invio..." : "Conferma voto"}</SubmitButton> : null}
    </RuntimeShell>
  );
}



function CeremonyAwardPublicResultPanel({
  result,
}: {
  result:
    CeremonyAwardPublicResult |
    undefined;
}) {
  if (
    !result
  ) {
    return (
      <section className="mt-5 rounded-[18px] bg-[#F5F5F2] p-4">
        <p className="text-xs font-black uppercase text-[#06142E]">
          Risultato non disponibile
        </p>
      </section>
    );
  }

  return (
    <section className="mt-5 rounded-[20px] bg-[#06142E] p-5 text-white">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/40">
            Risultato premio
          </p>

          <p className="mt-1 truncate text-lg font-black uppercase">
            {result.awardName}
          </p>

          <p className="mt-1 text-[10px] font-bold text-white/45">
            {result.winners.length === 0
              ? "Nessun vincitore"
              : result.isTie
                ? "Parità al primo posto"
                : "Vincitore"}
          </p>
        </div>

        <div className="shrink-0 rounded-full bg-white/[0.10] px-3 py-1 text-[9px] font-black uppercase">
          {result.totalVotes} voti
        </div>
      </div>

      {result.winners.length > 0 ? (
        <div className="mt-4 space-y-2">
          {result.winners.map(
            (
              candidate,
            ) => (
              <div
                key={
                  candidate.id
                }
                className="flex items-center gap-3 rounded-[14px] bg-white/[0.10] p-3"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
                  {candidate.imageUrl ? (
                    <img
                      src={
                        candidate.imageUrl
                      }
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Users
                      size={17}
                      className="text-[#06142E]/40"
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black uppercase">
                    {
                      candidate.label
                    }
                  </p>

                  {candidate.description ? (
                    <p className="mt-0.5 truncate text-[9px] font-bold text-white/45">
                      {
                        candidate.description
                      }
                    </p>
                  ) : candidate.teamName ? (
                    <p className="mt-0.5 truncate text-[9px] font-bold text-white/45">
                      {
                        candidate.teamName
                      }
                    </p>
                  ) : null}
                </div>

                <div className="text-right">
                  <p className="text-base font-black">
                    {
                      candidate.votes
                    }
                  </p>

                  <p className="text-[8px] font-black uppercase text-white/40">
                    {
                      candidate.percentage
                    }
                    %
                  </p>
                </div>
              </div>
            ),
          )}
        </div>
      ) : null}

      {result.ownVoteCandidateId ? (
        <p className="mt-4 text-[10px] font-bold text-white/50">
          Il tuo voto è evidenziato nell&apos;elenco dei candidati.
        </p>
      ) : null}
    </section>
  );
}

function ManOfTheMatchPublicResultPanel({
  result,
}: {
  result:
    ManOfTheMatchPublicResult |
    undefined;
}) {
  if (
    !result
  ) {
    return (
      <section className="mt-5 rounded-[18px] bg-[#F5F5F2] p-4">
        <p className="text-xs font-black uppercase text-[#06142E]">
          Risultato non disponibile
        </p>
      </section>
    );
  }

  return (
    <section className="mt-5 rounded-[20px] bg-[#06142E] p-5 text-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/40">
            Esito votazione
          </p>

          <p className="mt-1 text-lg font-black uppercase">
            {result.winners.length === 0
              ? "Nessun vincitore"
              : result.isTie
                ? "Parità"
                : "Man Of The Match"}
          </p>
        </div>

        <div className="rounded-full bg-white/[0.10] px-3 py-1 text-[9px] font-black uppercase">
          {result.totalVotes} voti
        </div>
      </div>

      {result.winners.length > 0 ? (
        <div className="mt-4 space-y-2">
          {result.winners.map(
            (
              candidate,
            ) => (
              <div
                key={
                  candidate.id
                }
                className="flex items-center gap-3 rounded-[14px] bg-white/[0.10] p-3"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
                  {candidate.imageUrl ? (
                    <img
                      src={
                        candidate.imageUrl
                      }
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Users
                      size={17}
                      className="text-[#06142E]/40"
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black uppercase">
                    {
                      candidate.label
                    }
                  </p>

                  {candidate.teamName ? (
                    <p className="mt-0.5 truncate text-[9px] font-bold text-white/45">
                      {
                        candidate.teamName
                      }
                    </p>
                  ) : null}
                </div>

                <div className="text-right">
                  <p className="text-base font-black">
                    {
                      candidate.votes
                    }
                  </p>

                  <p className="text-[8px] font-black uppercase text-white/40">
                    {
                      candidate.percentage
                    }
                    %
                  </p>
                </div>
              </div>
            ),
          )}
        </div>
      ) : null}

      {result.ownVoteCandidateId ? (
        <p className="mt-4 text-[10px] font-bold text-white/50">
          Il tuo voto è evidenziato nell&apos;elenco dei candidati.
        </p>
      ) : null}
    </section>
  );
}

function RuntimeShell({
  poll,
  demoMode,
  onBack,
  error,
  eyebrow,
  eyebrowTone = "blue",
  hideBackLabel = false,
  children,
}: {
  poll: GamesVotingPoll;
  demoMode: boolean;
  onBack: () => void;
  error: string | null;
  eyebrow?: string;
  eyebrowTone?: "blue" | "muted";
  hideBackLabel?: boolean;
  children: ReactNode;
}) {
  return (
    <AppShell>
      <main className="min-h-screen bg-white pb-28">
        <button
          type="button"
          onClick={onBack}
          aria-label="Indietro"
          className="mb-3 flex items-center gap-2 text-xs font-black uppercase text-[#06142E]/55"
        >
          <ChevronLeft size={17} />
          {!hideBackLabel
            ? demoMode
              ? "Pannello votazioni"
              : "Votazioni"
            : null}
        </button>
        {demoMode ? <GameDemoBanner /> : null}
        <p
          className={`mt-5 text-[10px] font-black uppercase tracking-[0.16em] ${
            eyebrowTone === "muted"
              ? "text-[#06142E]/40"
              : "text-[#0B5FFF]"
          }`}
        >
          {eyebrow ?? VOTING_TYPE_LABELS[poll.type]}
        </p>
        <h1 className="mt-1 text-3xl font-black uppercase text-[#06142E]">{poll.title}</h1>
        {poll.description?.trim() ? <p className="mt-2 text-sm font-bold leading-6 text-[#06142E]/55">{poll.description}</p> : null}
        {poll.status !== "published" ? (
          <div className="mt-4 rounded-[16px] bg-amber-50 p-4 text-sm font-bold text-amber-800">
            {poll.status === "closed" ? "Votazione conclusa." : "La votazione non è ancora aperta."}
          </div>
        ) : null}
        {error ? <Message error>{error}</Message> : null}
        {children}
      </main>
    </AppShell>
  );
}

function CandidateCard({
  candidate,
  selected,
  disabled,
  onClick,
}: {
  candidate: VotingCandidate;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-[18px] border p-4 text-left transition disabled:cursor-default ${
        selected
          ? "border-[#0B5FFF] bg-[#0B5FFF]/[0.07] shadow-[0_8px_22px_rgba(11,95,255,0.10)]"
          : "border-[#06142E]/10 bg-[#F5F5F2]"
      }`}
    >
      {candidate.imageUrl ? (
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[14px] bg-white">
          <img src={candidate.imageUrl} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#06142E]/35">
          <Users size={22} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black uppercase text-[#06142E]">{candidate.label}</p>
        {candidate.description ? <p className="mt-1 text-xs font-bold leading-5 text-[#06142E]/45">{candidate.description}</p> : null}
      </div>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-[#0B5FFF] bg-[#0B5FFF] text-white" : "border-[#06142E]/15 bg-white text-transparent"}`}>
        <Check size={17} />
      </span>
    </button>
  );
}

function PredictionTeamLogo({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl?: string;
}) {
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center sm:h-16 sm:w-16">
      <TeamLogo logoUrl={logoUrl} teamName={name} size={56} />
    </div>
  );
}

function ScoreStepper({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const parsed = Number.parseInt(value, 10);
  const score = Number.isFinite(parsed) ? Math.min(99, Math.max(0, parsed)) : 0;

  function update(delta: number) {
    if (disabled) return;
    onChange(String(Math.min(99, Math.max(0, score + delta))));
  }

  return (
    <div className="flex w-[54px] flex-col items-center">
      <button
        type="button"
        disabled={disabled || score >= 99}
        onClick={() => update(1)}
        aria-label={`Aumenta gol ${label}`}
        className="flex h-8 w-10 items-center justify-center rounded-[9px] bg-white/10 text-white transition active:scale-95 disabled:opacity-25"
      >
        <ChevronUp size={22} strokeWidth={3} />
      </button>
      <div className="my-1 flex h-14 w-[54px] items-center justify-center rounded-[12px] bg-white text-[30px] font-black tabular-nums text-[#06142E] shadow-[0_6px_16px_rgba(0,0,0,0.16)]">
        {score}
      </div>
      <button
        type="button"
        disabled={disabled || score <= 0}
        onClick={() => update(-1)}
        aria-label={`Diminuisci gol ${label}`}
        className="flex h-8 w-10 items-center justify-center rounded-[9px] bg-white/10 text-white transition active:scale-95 disabled:opacity-25"
      >
        <ChevronDown size={22} strokeWidth={3} />
      </button>
    </div>
  );
}
function LockedMessage({ demoMode }: { demoMode: boolean }) {
  return (
    <div className="mt-4 flex items-start gap-3 rounded-[18px] bg-emerald-50 p-4 text-emerald-800">
      <LockKeyhole className="shrink-0" size={20} />
      <p className="text-sm font-bold">
        {demoMode ? "Votazione demo completata. Nessun dato è stato salvato." : "Voto inviato. La scelta è definitiva."}
      </p>
    </div>
  );
}

function SubmitButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="mt-5 min-h-14 w-full rounded-[15px] bg-[#0B5FFF] px-5 text-sm font-black uppercase text-white disabled:opacity-35"
    >
      {children}
    </button>
  );
}


function VotingDemoPreview({
  poll,
}: {
  poll:
    GamesVotingPoll;
}) {
  if (
    poll.type ===
      "score_prediction"
  ) {
    return (
      <section className="overflow-hidden rounded-[24px] bg-[#06142E] p-5 text-white">
        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/45">
          Demo
        </p>

        <h2 className="mt-1 text-xl font-black uppercase">
          Score Prediction
        </h2>

        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-[18px] bg-white/10 p-4">
          <div className="text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-white/20" />
            <p className="mt-2 text-[10px] font-black uppercase">
              Casa
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-white text-lg font-black text-[#06142E]">
              3
            </span>
            <span className="font-black">-</span>
            <span className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-white text-lg font-black text-[#06142E]">
              2
            </span>
          </div>

          <div className="text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-white/20" />
            <p className="mt-2 text-[10px] font-black uppercase">
              Ospite
            </p>
          </div>
        </div>

        <div className="mt-3 rounded-[14px] bg-white/10 p-4">
          <p className="text-[9px] font-black uppercase text-white/45">
            Miglior marcatore
          </p>
          <p className="mt-1 text-sm font-black">
            Seleziona giocatore
          </p>
        </div>
      </section>
    );
  }

  if (
    poll.type ===
      "build_xi"
  ) {
    return (
      <section className="overflow-hidden rounded-[24px] bg-[#167546] p-4 text-white">
        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/55">
          Demo Build XI
        </p>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {Array.from(
            {
              length:
                6,
            },
            (
              _,
              index,
            ) => (
              <div
                key={
                  index
                }
                className="flex flex-col items-center"
              >
                <div className="h-14 w-12 rounded-[10px] border-2 border-white/50 bg-white/15" />
                <div className="mt-1 h-2 w-12 rounded-full bg-white/35" />
              </div>
            ),
          )}
        </div>
      </section>
    );
  }

  if (
    poll.type ===
      "best_of_the_month"
  ) {
    return (
      <section className="space-y-3">
        {[
          "Player of the Month",
          "Goal of the Month",
          "Save of the Month",
        ].map(
          (
            label,
          ) => (
            <div
              key={
                label
              }
              className="rounded-[18px] bg-[#06142E] p-4 text-white"
            >
              <p className="text-[9px] font-black uppercase text-white/45">
                Premio mensile
              </p>
              <p className="mt-1 text-base font-black uppercase">
                {label}
              </p>
              <div className="mt-3 h-10 rounded-[12px] bg-white/15" />
            </div>
          ),
        )}
      </section>
    );
  }

  return (
    <section className="rounded-[22px] bg-[#E5E7EB] p-5">
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#06142E]/40">
        Demo votazione
      </p>

      <h2 className="mt-1 text-lg font-black uppercase text-[#06142E]/70">
        {poll.title}
      </h2>

      <div className="mt-4 space-y-3">
        {[
          "Candidato 1",
          "Candidato 2",
          "Candidato 3",
        ].map(
          (
            label,
          ) => (
            <div
              key={
                label
              }
              className="flex min-h-12 items-center rounded-[14px] bg-white px-4 text-xs font-black text-[#06142E]/60"
            >
              {label}
            </div>
          ),
        )}
      </div>
    </section>
  );
}

function Message({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <div className={`mt-5 rounded-[16px] p-4 text-sm font-bold ${error ? "bg-red-50 text-red-700" : "bg-[#F5F5F2] text-[#06142E]/50"}`}>
      {children}
    </div>
  );
}

const DEMO_CANDIDATE_NAMES: Record<BuildXiRole, string[]> = {
  goalkeeper: ["Luca Romano", "Marco Esposito"],
  defender: ["Andrea Russo", "Davide Ferrara", "Simone Conti", "Matteo Greco", "Fabio Costa"],
  midfielder: ["Antonio Rinaldi", "Giuseppe Moretti", "Alessio Marino", "Stefano Gallo", "Nicola Serra", "Michele Ferri"],
  forward: ["Raffaele De Luca", "Salvatore Vitale", "Gennaro Bruno", "Ciro Palmieri", "Vincenzo Esposito"],
};

function resolveDemoCandidates(
  candidates: BuildXiCandidate[],
  poll: GamesVotingPoll,
  isDemo: boolean,
): BuildXiCandidate[] {
  if (!isDemo) return candidates;
  const enough = (Object.entries(BUILD_XI_REQUIRED_ROLE_COUNTS) as Array<[BuildXiRole, number]>).every(
    ([role, minimum]) => candidates.filter((candidate) => candidate.buildXiRole === role).length >= minimum,
  );
  if (enough) return candidates;

  return (Object.entries(DEMO_CANDIDATE_NAMES) as Array<[BuildXiRole, string[]]>).flatMap(
    ([role, names]) => names.map((playerName, index) => ({
      playerId: `demo-${poll.id}-${role}-${index}`,
      seasonPlayerId: `demo-season-${role}-${index}`,
      teamId: `demo-team-${index % 4}`,
      playerName,
      teamName: `${poll.competitionName || "Ludi"} Demo ${index % 4 + 1}`,
      originalRole: BUILD_XI_ROLE_LABELS[role],
      buildXiRole: role,
      appearances: 8,
      availableTeamMatches: 10,
      appearanceRate: 0.8,
    })),
  );
}

function resolveDemoPoll(poll: GamesVotingPoll): GamesVotingPoll {
  if (poll.type === "best_of_the_month" && !poll.bestOfMonth) {
    const now = Date.now();
    const awards = Object.fromEntries(BEST_OF_MONTH_KEYS.map((key) => [key, {
      key,
      title: BEST_OF_MONTH_AWARD_LABELS[key],
      candidates: demoVotingCandidates(key),
    }])) as NonNullable<GamesVotingPoll["bestOfMonth"]>["awards"];
    return {
      ...poll,
      status: "published",
      bestOfMonth: {
        monthKey: "2026-09",
        monthLabel: "Settembre 2026",
        opensAtMs: now,
        closesAtMs: now + 5 * 24 * 60 * 60 * 1000,
        awards,
      },
    };
  }
  if (poll.type === "score_prediction" && !poll.scorePrediction) {
    const now = Date.now();
    return {
      ...poll,
      status: "published",
      scorePrediction: {
        match: {
          id: "demo-match",
          seasonId: "demo-season",
          competitionId: "demo-competition",
          competitionName: "Ludi Championship",
          date: new Date(now + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          time: "21:00",
          kickoffAtMs: now + 24 * 60 * 60 * 1000,
          homeTeamId: "home",
          homeTeamName: "Ludi FC",
          awayTeamId: "away",
          awayTeamName: "Real Vesuvio",
          label: "Ludi FC - Real Vesuvio",
          isUpcoming: true,
        },
        scorerOptions: demoVotingCandidates("scorer"),
      },
    };
  }
  if (poll.type === "man_of_the_match" && !poll.manOfTheMatch) {
    const now = Date.now();
    return {
      ...poll,
      status: "published",
      manOfTheMatch: {
        match: {
          id: "demo-match",
          seasonId: "demo-season",
          competitionId: "demo-competition",
          competitionName: "Ludi Championship",
          date: new Date(now).toISOString().slice(0, 10),
          time: "21:00",
          kickoffAtMs: now,
          homeTeamId: "home",
          homeTeamName: "Ludi FC",
          awayTeamId: "away",
          awayTeamName: "Real Vesuvio",
          label: "Ludi FC - Real Vesuvio",
          isUpcoming: false,
        },
        candidates: demoVotingCandidates("motm").slice(0, 4),
      },
    };
  }
  if (poll.type === "ceremony_award" && !poll.ceremonyAward) {
    return {
      ...poll,
      status: "published",
      ceremonyAward: {
        awardName: poll.title,
        candidates: demoVotingCandidates("award"),
      },
    };
  }
  return demoForcePublished(poll);
}

function demoForcePublished(poll: GamesVotingPoll): GamesVotingPoll {
  return { ...poll, status: "published" };
}

function demoVotingCandidates(seed: string): VotingCandidate[] {
  return ["Andrea Russo", "Luca Romano", "Marco Esposito", "Raffaele De Luca"].map((label, index) => ({
    id: `demo-${seed}-${index}`,
    playerId: `demo-${seed}-${index}`,
    label,
    description: `Squadra Demo ${index + 1}`,
    teamName: `Squadra Demo ${index + 1}`,
  }));
}

type VotingCardCompetition = {
  id: string;
  name?: string;
  shortName?: string;
  primaryColor?: string;
  textColor?: string;
};

type VotingCardPoll = PublicPoll & {
  competitionIds?: string[];
  competitionNames?: string[];
};

const LUDI_VOTING_CARD_THEME = {
  primaryColor: "#06142E",
  textColor: "#FFFFFF",
  competitionLabel: "Ludis League",
};

function resolveVotingCardTheme(
  poll: VotingCardPoll,
  competitions: VotingCardCompetition[],
) {
  const competitionIds = Array.from(new Set(
    (Array.isArray(poll.competitionIds) && poll.competitionIds.length > 0
      ? poll.competitionIds
      : [poll.competitionId]
    ).map((value) => String(value ?? "").trim()).filter(Boolean),
  ));
  if (competitionIds.length !== 1) return LUDI_VOTING_CARD_THEME;
  const competition = competitions.find((candidate) => String(candidate.id) === competitionIds[0]);
  if (!competition) return LUDI_VOTING_CARD_THEME;
  return {
    primaryColor: competition.primaryColor?.trim() || "#06142E",
    textColor: competition.textColor?.trim() || "#FFFFFF",
    competitionLabel: competition.shortName?.trim() || competition.name?.trim() || poll.competitionName || "Competizione",
  };
}

function getVotingStatusLabel(status: GamesVotingPoll["status"]): string {
  if (status === "published") return "Vota ora";
  if (status === "closed") return "Conclusa";
  return "Prossimamente";
}

function defaultPollSubtitle(poll: GamesVotingPoll) {
  if (poll.type === "best_of_the_month") return poll.bestOfMonth?.monthLabel ?? "Premi mensili";
  if (poll.type === "score_prediction") return poll.scorePrediction?.match.label ?? "Risultato esatto + miglior marcatore";
  if (poll.type === "man_of_the_match") return poll.manOfTheMatch?.match.label ?? "Scegli il migliore della partita";
  if (poll.type === "ceremony_award") return poll.ceremonyAward?.awardName ?? "Premio di fine stagione";
  return `${poll.competitionName} · ${poll.seasonName}`;
}

function VotingCardBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -right-20 -top-10 h-50 w-50 rotate-45 rounded-[42px] bg-white/[0.07]" />
      <div className="absolute -bottom-10 -left-20 h-50 w-50 rotate-45 rounded-[48px] bg-white/[0.06]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_42%)]" />
    </div>
  );
}

function BuildXiResultsView({
  results,
  candidates,
  futLayout,
}: {
  results:
    VotingAdminResults;
  candidates:
    BuildXiCandidate[];
  futLayout:
    FutCardLayout;
}) {
  const buildXi =
    results.buildXi;

  if (!buildXi) {
    return (
      <Message>
        Risultati non disponibili.
      </Message>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[20px] bg-[#F5F5F2] p-5">
        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#06142E]/35">
          Risultati finali
        </p>

        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <p className="text-3xl font-black text-[#06142E]">
              {
                results.submissionCount
              }
            </p>

            <p className="text-[10px] font-black uppercase text-[#06142E]/45">
              Formazioni valide
            </p>
          </div>

          {buildXi.invalidSubmissionCount >
          0 ? (
            <span className="rounded-full bg-amber-100 px-3 py-2 text-[9px] font-black uppercase text-amber-800">
              {
                buildXi.invalidSubmissionCount
              }{" "}
              escluse
            </span>
          ) : null}
        </div>
      </section>

      {buildXi.tieRoles.length >
      0 ? (
        <div className="rounded-[18px] bg-amber-50 p-4">
          <p className="text-xs font-black uppercase text-amber-800">
            Parità sul cutoff
          </p>

          <p className="mt-1 text-xs font-bold leading-5 text-amber-800/75">
            La BUILD XI definitiva non viene assegnata automaticamente finché resta una parità nell&apos;ultimo posto utile di uno o più ruoli.
          </p>
        </div>
      ) : buildXi.finalLineup ? (
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#06142E]/35">
            BUILD XI più votata
          </p>

          <Pitch
            lineup={
              lineupToSlots(
                buildXi.finalLineup,
              )
            }
            candidates={
              candidates
            }
            locked
            futLayout={
              futLayout
            }
            onEdit={() =>
              undefined
            }
          />
        </div>
      ) : null}

      <section>
        <div className="mb-3">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#06142E]/35">
            Classifica completa
          </p>

          <h2 className="mt-1 text-xl font-black uppercase text-[#06142E]">
            Voti per ruolo
          </h2>
        </div>

        <div className="space-y-5">
          {(Object.keys(
            BUILD_XI_ROLE_LABELS,
          ) as BuildXiRole[]).map(
            (role) => {
              const entries =
                buildXi.byRole[
                  role
                ] ??
                [];

              return (
                <div
                  key={
                    role
                  }
                  className="rounded-[18px] border border-[#06142E]/10 bg-white p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black uppercase text-[#06142E]">
                      {
                        BUILD_XI_ROLE_LABELS[
                          role
                        ]
                      }
                    </p>

                    <span className="text-[9px] font-black uppercase text-[#06142E]/35">
                      Top{" "}
                      {
                        BUILD_XI_REQUIRED_ROLE_COUNTS[
                          role
                        ]
                      }
                    </span>
                  </div>

                  <div className="mt-3 divide-y divide-[#06142E]/[0.07]">
                    {entries.map(
                      (
                        entry,
                      ) => (
                        <div
                          key={
                            entry.playerId
                          }
                          className="flex items-center gap-3 py-3"
                        >
                          <span className="w-6 shrink-0 text-center text-sm font-black text-[#06142E]/35">
                            {
                              entry.rank
                            }
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-black text-[#06142E]">
                                {
                                  entry.playerName
                                }
                              </p>

                              {entry.isFinalSelection ? (
                                <span className="rounded-full bg-emerald-100 px-2 py-1 text-[7px] font-black uppercase text-emerald-800">
                                  BUILD XI
                                </span>
                              ) : entry.tiedAtCutoff ? (
                                <span className="rounded-full bg-amber-100 px-2 py-1 text-[7px] font-black uppercase text-amber-800">
                                  Parità
                                </span>
                              ) : null}
                            </div>

                            <p className="mt-0.5 truncate text-[9px] font-bold text-[#06142E]/40">
                              {
                                entry.teamName
                              }
                            </p>
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="text-sm font-black text-[#06142E]">
                              {
                                entry.votes
                              }
                            </p>

                            <p className="text-[8px] font-black uppercase text-[#06142E]/35">
                              {
                                entry.percentage
                              }
                              %
                            </p>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              );
            },
          )}
        </div>
      </section>
    </div>
  );
}

function Pitch({
  lineup,
  candidates,
  locked,
  futLayout,
  onEdit,
}: {
  lineup:
    Partial<
      Record<
        string,
        string
      >
    >;
  candidates:
    BuildXiCandidate[];
  locked:
    boolean;
  futLayout:
    FutCardLayout;
  onEdit:
    (
      role:
        BuildXiRole,
      index:
        number,
    ) => void;
}) {
  const byId =
    new Map(
      candidates.map(
        (candidate) => [
          candidate.playerId,
          candidate,
        ],
      ),
    );

  const rows:
    Array<{
      role:
        BuildXiRole;
      count:
        number;
    }> = [
      {
        role:
          "forward",
        count:
          3,
      },
      {
        role:
          "midfielder",
        count:
          4,
      },
      {
        role:
          "defender",
        count:
          3,
      },
      {
        role:
          "goalkeeper",
        count:
          1,
      },
    ];

  return (
    <div className="relative mt-6 overflow-hidden rounded-[28px] border-4 border-white bg-gradient-to-b from-[#178447] to-[#0d6535] p-3 shadow-[0_20px_45px_rgba(6,20,46,0.22)]">
      <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(to_bottom,rgba(255,255,255,0.025)_0%,rgba(255,255,255,0.025)_12.5%,rgba(0,0,0,0.025)_12.5%,rgba(0,0,0,0.025)_25%)]" />

      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-4"
        style={{
          width:
            "calc(100% - 2rem)",
          height:
            "calc(100% - 2rem)",
        }}
        viewBox="0 0 100 160"
        preserveAspectRatio="none"
      >
        <g
          fill="none"
          stroke="rgba(255,255,255,0.52)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="0.38"
        >
          <rect
            x="0.25"
            y="0.25"
            width="99.5"
            height="159.5"
            rx="4.2"
          />
          <line
            x1="0.25"
            y1="80"
            x2="99.75"
            y2="80"
          />
          <ellipse
            cx="50"
            cy="80"
            rx="12.5"
            ry="12.5"
          />
          <path d="M20 0.25 V17 H80 V0.25" />
          <path d="M36 0.25 V8.5 H64 V0.25" />
          <path d="M40.5 17 Q50 25.5 59.5 17" />
          <path d="M20 159.75 V143 H80 V159.75" />
          <path d="M36 159.75 V151.5 H64 V159.75" />
          <path d="M40.5 143 Q50 134.5 59.5 143" />
        </g>

        <g fill="rgba(255,255,255,0.62)">
          <circle
            cx="50"
            cy="80"
            r="0.68"
          />
          <circle
            cx="50"
            cy="12"
            r="0.68"
          />
          <circle
            cx="50"
            cy="148"
            r="0.68"
          />
        </g>
      </svg>

      <div className="relative flex min-h-[650px] flex-col justify-between py-4">
        {rows.map(
          (row) => (
            <div
              key={
                row.role
              }
              className="flex justify-around gap-1"
            >
              {Array.from(
                {
                  length:
                    row.count,
                },
                (
                  _,
                  index,
                ) => {
                  const player =
                    byId.get(
                      lineup[
                        slotKey(
                          row.role,
                          index,
                        )
                      ] ??
                        "",
                    );

                  const hasFut =
                    player &&
                    typeof player.futRating ===
                      "number" &&
                    player.futCard;

                  return (
                    <button
                      type="button"
                      key={
                        index
                      }
                      disabled={
                        locked
                      }
                      onClick={() =>
                        onEdit(
                          row.role,
                          index,
                        )
                      }
                      className="flex w-[23%] min-w-0 flex-col items-center disabled:cursor-default"
                    >
                      {player ? (
                        hasFut ? (
                          <div className="w-full max-w-[78px]">
                            <FutPlayerCard
                              card={
                                player.futCard!
                              }
                              rating={
                                player.futRating!
                              }
                              playerName={
                                player.playerName
                                  .split(
                                    /\s+/,
                                  )
                                  .at(
                                    -1,
                                  ) ??
                                player.playerName
                              }
                              playerPhotoUrl={
                                player.photoUrl
                              }
                              role={
                                player.originalRole
                              }
                              teamName={
                                player.teamName
                              }
                              teamLogoUrl={
                                player.teamLogoUrl
                              }
                              competitionName={
                                player.competitionName
                              }
                              competitionLogoUrl={
                                player.competitionLogoUrl
                              }
                              layoutOverride={
                                futLayout
                              }
                              variant="compact"
                              priority={
                                false
                              }
                            />
                          </div>
                        ) : (
                          <div className="flex h-16 w-14 items-center justify-center overflow-hidden rounded-[12px] border-2 border-[#FFD45A] bg-white">
                            {player.photoUrl ? (
                              <img
                                src={
                                  player.photoUrl
                                }
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Users
                                size={
                                  22
                                }
                                className="text-[#06142E]/40"
                              />
                            )}
                          </div>
                        )
                      ) : (
                        <div className="flex h-16 w-14 items-center justify-center overflow-hidden rounded-[12px] border-2 border-dashed border-white/70 bg-white/15">
                          <Plus className="text-white" />
                        </div>
                      )}

                      <span className="mt-1 line-clamp-2 max-w-full rounded bg-[#06142E]/75 px-2 py-1 text-center text-[8px] font-black uppercase text-white">
                        {
                          player?.playerName ??
                          BUILD_XI_ROLE_LABELS[
                            row.role
                          ]
                        }
                      </span>
                    </button>
                  );
                },
              )}
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function PlayerPicker({
  role,
  candidates,
  selectedIds,
  currentId,
  futLayout,
  onChoose,
  onClose,
}: {
  role:
    BuildXiRole;
  candidates:
    BuildXiCandidate[];
  selectedIds:
    Set<string>;
  currentId?:
    string;
  futLayout:
    FutCardLayout;
  onChoose:
    (
      candidate:
        BuildXiCandidate,
    ) => void;
  onClose:
    () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-end bg-[#06142E]/55 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:justify-center">
      <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-[26px] bg-white sm:max-h-[82vh]">
        <div className="flex shrink-0 items-center justify-between border-b border-[#06142E]/10 p-5">
          <div>
            <p className="text-[9px] font-black uppercase text-[#06142E]/35">
              Seleziona
            </p>

            <h2 className="text-xl font-black uppercase text-[#06142E]">
              {
                BUILD_XI_ROLE_LABELS[
                  role
                ]
              }
            </h2>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            className="rounded-full bg-[#F5F5F2] px-4 py-2 text-xs font-black"
          >
            Chiudi
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto overscroll-contain p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {candidates.map(
            (
              candidate,
            ) => {
              const unavailable =
                selectedIds.has(
                  candidate.playerId,
                ) &&
                candidate.playerId !==
                  currentId;

              const hasFut =
                typeof candidate.futRating ===
                  "number" &&
                candidate.futCard;

              return (
                <button
                  type="button"
                  key={
                    candidate.playerId
                  }
                  disabled={
                    unavailable
                  }
                  onClick={() =>
                    onChoose(
                      candidate,
                    )
                  }
                  className="relative flex min-w-0 flex-col items-center rounded-[18px] bg-[#F5F5F2] p-2 text-center transition active:scale-[0.98] disabled:opacity-35"
                >
                  {candidate.playerId ===
                  currentId ? (
                    <span className="absolute right-2 top-2 z-30 flex h-7 w-7 items-center justify-center rounded-full bg-[#0B5FFF] text-white">
                      <Check
                        size={
                          16
                        }
                      />
                    </span>
                  ) : null}

                  {hasFut ? (
                    <div className="w-full max-w-[150px]">
                      <FutPlayerCard
                        card={
                          candidate.futCard!
                        }
                        rating={
                          candidate.futRating!
                        }
                        playerName={
                          candidate.playerName
                            .split(
                              /\s+/,
                            )
                            .at(
                              -1,
                            ) ??
                          candidate.playerName
                        }
                        playerPhotoUrl={
                          candidate.photoUrl
                        }
                        role={
                          candidate.originalRole
                        }
                        teamName={
                          candidate.teamName
                        }
                        teamLogoUrl={
                          candidate.teamLogoUrl
                        }
                        competitionName={
                          candidate.competitionName
                        }
                        competitionLogoUrl={
                          candidate.competitionLogoUrl
                        }
                        layoutOverride={
                          futLayout
                        }
                        variant="compact"
                        priority={
                          false
                        }
                      />
                    </div>
                  ) : (
                    <div className="mt-3 flex h-24 w-20 items-center justify-center overflow-hidden rounded-[16px] bg-white">
                      {candidate.photoUrl ? (
                        <img
                          src={
                            candidate.photoUrl
                          }
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Users
                          size={
                            22
                          }
                        />
                      )}
                    </div>
                  )}

                  <p className="mt-1 w-full truncate text-xs font-black uppercase text-[#06142E]">
                    {
                      candidate.playerName
                    }
                  </p>

                  <p className="mt-0.5 w-full truncate text-[9px] font-bold text-[#06142E]/40">
                    {
                      candidate.teamName
                    }
                  </p>
                </button>
              );
            },
          )}
        </div>
      </div>
    </div>
  );
}


function isBestAwardLocked(runtime: Runtime, awardKey: BestOfMonthAwardKey) {
  return (runtime.submissions ?? []).some((item) => item && item.awardKey === awardKey);
}

function shareBestOfMonth(gameId: string, pollId: string, awardKey: BestOfMonthAwardKey) {
  if (typeof window === "undefined") return;
  const url = `${window.location.origin}/games/giochi/${encodeURIComponent(gameId)}/votazioni/${encodeURIComponent(pollId)}/${awardKey}`;
  if (navigator.share) {
    void navigator.share({ title: BEST_OF_MONTH_AWARD_LABELS[awardKey], url });
    return;
  }
  void navigator.clipboard?.writeText(url);
}

function formatMatchDate(date: string, time: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return `${match ? `${match[3]}/${match[2]}/${match[1]}` : date} · ${time}`;
}

function slotKey(role: BuildXiRole, index: number) {
  return `${role}:${index}`;
}

function lineupToSlots(lineup: BuildXiLineup): Partial<Record<string, string>> {
  const result: Record<string, string> = { [slotKey("goalkeeper", 0)]: lineup.goalkeeperId };
  lineup.defenderIds.forEach((id, index) => { result[slotKey("defender", index)] = id; });
  lineup.midfielderIds.forEach((id, index) => { result[slotKey("midfielder", index)] = id; });
  lineup.forwardIds.forEach((id, index) => { result[slotKey("forward", index)] = id; });
  return result;
}

function slotsToLineup(value: Partial<Record<string, string>>): BuildXiLineup {
  return {
    goalkeeperId: value[slotKey("goalkeeper", 0)]!,
    defenderIds: [0, 1, 2].map((index) => value[slotKey("defender", index)]!) as BuildXiLineup["defenderIds"],
    midfielderIds: [0, 1, 2, 3].map((index) => value[slotKey("midfielder", index)]!) as BuildXiLineup["midfielderIds"],
    forwardIds: [0, 1, 2].map((index) => value[slotKey("forward", index)]!) as BuildXiLineup["forwardIds"],
  };
}

function isBuildXiLineup(value: unknown): value is BuildXiLineup {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<BuildXiLineup>;
  return typeof record.goalkeeperId === "string" &&
    Array.isArray(record.defenderIds) &&
    Array.isArray(record.midfielderIds) &&
    Array.isArray(record.forwardIds);
}
