"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ChevronLeft,
  Clipboard,
  Download,
  FileSpreadsheet,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/ui/AppShell";
import ScorePredictionPosterUploader from "./ScorePredictionPosterUploader";
import { useAuth } from "@/src/hooks/useAuth";
import {
  BEST_OF_MONTH_AWARD_LABELS,
  BUILD_XI_ROLE_LABELS,
  VOTING_TYPE_LABELS,
  type BestOfMonthAwardKey,
  type BuildXiCandidate,
  type BuildXiRole,
  type GamesVotingPoll,
  type VotingAdminResults,
  type VotingCandidate,
  type VotingMatchOption,
  type VotingStatus,
} from "@/src/types/GamesVoting";

type Preview = {
  poll: GamesVotingPoll;
  candidates: BuildXiCandidate[];
  matchOptions: VotingMatchOption[];
  results: VotingAdminResults;
};

const BEST_OF_MONTH_KEYS: BestOfMonthAwardKey[] = [
  "player_of_the_month",
  "goal_of_the_month",
  "save_of_the_month",
];

export default function AdminVotingPollBuilder({
  gameId,
  pollId,
}: {
  gameId: string;
  pollId: string;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const fileInput = useRef<HTMLInputElement | null>(null);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [
    buildXiTieDrafts,
    setBuildXiTieDrafts,
  ] =
    useState<
      Partial<
        Record<
          BuildXiRole,
          string[]
        >
      >
    >({});

  const [monthKey, setMonthKey] = useState("");
  const [opensAtLocal, setOpensAtLocal] = useState("");
  const [monthlyAwards, setMonthlyAwards] = useState<Record<BestOfMonthAwardKey, VotingCandidate[]>>({
    player_of_the_month: [],
    goal_of_the_month: [],
    save_of_the_month: [],
  });

  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [scorePosterImageUrl, setScorePosterImageUrl] = useState("");
  const [scoreScorers, setScoreScorers] = useState<VotingCandidate[]>([]);
  const [motmCandidates, setMotmCandidates] = useState<VotingCandidate[]>([]);
  const [matchSuggestions, setMatchSuggestions] = useState<VotingCandidate[]>([]);

  const [awardName, setAwardName] = useState("");
  const [ceremonyCandidates, setCeremonyCandidates] = useState<VotingCandidate[]>([]);

  const request = useCallback(async (url: string, init?: RequestInit) => {
    if (!user) throw new Error("Autenticazione Admin richiesta.");
    const token = await user.getIdToken();
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...init?.headers,
      },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error || "Operazione non riuscita.");
    }
    return response;
  }, [user]);

  function hydrateForm(poll: GamesVotingPoll) {
    setMonthKey("");
    setOpensAtLocal("");
    setMonthlyAwards({
      player_of_the_month: [],
      goal_of_the_month: [],
      save_of_the_month: [],
    });
    setSelectedMatchId("");
    setScorePosterImageUrl("");
    setScoreScorers([]);
    setMotmCandidates([]);
    setMatchSuggestions([]);
    setAwardName("");
    setCeremonyCandidates([]);

    if (poll.bestOfMonth) {
      setMonthKey(poll.bestOfMonth.monthKey);
      setOpensAtLocal(toDateTimeLocal(poll.bestOfMonth.opensAtMs));
      setMonthlyAwards({
        player_of_the_month: poll.bestOfMonth.awards.player_of_the_month.candidates,
        goal_of_the_month: poll.bestOfMonth.awards.goal_of_the_month.candidates,
        save_of_the_month: poll.bestOfMonth.awards.save_of_the_month.candidates,
      });
    }
    if (poll.scorePrediction) {
      setSelectedMatchId(poll.scorePrediction.match.id);
      setScorePosterImageUrl(poll.scorePrediction.posterImageUrl ?? "");
      setScoreScorers(poll.scorePrediction.scorerOptions);
    }
    if (poll.manOfTheMatch) {
      setSelectedMatchId(poll.manOfTheMatch.match.id);
      setMotmCandidates(poll.manOfTheMatch.candidates);
    }
    if (poll.ceremonyAward) {
      setAwardName(poll.ceremonyAward.awardName);
      setCeremonyCandidates(poll.ceremonyAward.candidates);
    }
  }


  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await request(
        `/api/admin/games/votazioni/${encodeURIComponent(gameId)}?preview=1&pollId=${encodeURIComponent(pollId)}`,
      );
      const value = await response.json() as Preview;

      setPreview(
        value,
      );

      hydrateForm(
        value.poll,
      );

      if (
        value.results.buildXi
      ) {
        setBuildXiTieDrafts(
          Object.fromEntries(
            Object.entries(
              value.results.buildXi.tieBreaks,
            ).map(
              (
                [
                  role,
                  tieBreak,
                ],
              ) => [
                role,
                tieBreak?.selectedPlayerIds ??
                  [],
              ],
            ),
          ) as Partial<
            Record<
              BuildXiRole,
              string[]
            >
          >,
        );
      } else {
        setBuildXiTieDrafts(
          {},
        );
      }

      setError(null);
    } catch (current) {
      setError(current instanceof Error ? current.message : "Impossibile caricare la votazione.");
    } finally {
      setLoading(false);
    }
  }, [gameId, pollId, request, user]);

  useEffect(() => {
    void load();
  }, [load]);


  async function run(action: () => Promise<void>, message: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await action();
      await load();
      setSuccess(message);
    } catch (current) {
      setError(current instanceof Error ? current.message : "Operazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  async function postAction(body: Record<string, unknown>) {
    await request(`/api/admin/games/votazioni/${encodeURIComponent(gameId)}`, {
      method: "POST",
      body: JSON.stringify({ ...body, pollId }),
    });
  }

  async function setStatus(status: VotingStatus) {
    await run(
      () => postAction({ action: "status", status }),
      status === "published" ? "Votazione pubblicata." : "Stato aggiornato.",
    );
  }

  function toggleBuildXiTieCandidate(
    role:
      BuildXiRole,
    playerId:
      string,
    requiredSelections:
      number,
  ) {
    setBuildXiTieDrafts(
      (
        current,
      ) => {
        const selected =
          current[
            role
          ] ??
          [];

        if (
          selected.includes(
            playerId,
          )
        ) {
          return {
            ...current,
            [role]:
              selected.filter(
                (
                  currentPlayerId,
                ) =>
                  currentPlayerId !==
                  playerId,
              ),
          };
        }

        if (
          selected.length >=
          requiredSelections
        ) {
          return current;
        }

        return {
          ...current,
          [role]: [
            ...selected,
            playerId,
          ],
        };
      },
    );
  }

  async function saveBuildXiTieBreak(
    role:
      BuildXiRole,
    requiredSelections:
      number,
  ) {
    const selectedPlayerIds =
      buildXiTieDrafts[
        role
      ] ??
      [];

    if (
      selectedPlayerIds.length !==
      requiredSelections
    ) {
      setError(
        `Seleziona esattamente ${requiredSelections} ${
          requiredSelections ===
          1
            ? "giocatore"
            : "giocatori"
        } per risolvere la parità.`,
      );

      return;
    }

    await run(
      async () => {
        await request(
          `/api/admin/games/votazioni/${encodeURIComponent(
            gameId,
          )}/build-xi-tiebreak`,
          {
            method:
              "POST",
            body:
              JSON.stringify({
                pollId,
                role,
                selectedPlayerIds,
              }),
          },
        );
      },
      "Parità BUILD XI risolta.",
    );
  }

  async function downloadTemplate() {
    await run(async () => {
      const response = await request(
        `/api/admin/games/votazioni/${encodeURIComponent(gameId)}?pollId=${encodeURIComponent(pollId)}&download=template`,
      );
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `build-xi-${pollId}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
    }, "File Excel generato.");
  }

  async function uploadTemplate(file: File) {
    await run(async () => {
      const formData = new FormData();
      formData.set("pollId", pollId);
      formData.set("file", file);
      await request(`/api/admin/games/votazioni/${encodeURIComponent(gameId)}`, {
        method: "POST",
        body: formData,
      });
    }, "Ruoli importati. BUILD XI pronta.");
  }

  async function saveBestOfMonth() {
    const opensAtMs = opensAtLocal ? new Date(opensAtLocal).getTime() : Number.NaN;
    await run(
      () => postAction({
        action: "best-of-month-config",
        monthKey,
        opensAtMs,
        awards: monthlyAwards,
      }),
      "Best Of The Month salvato. La chiusura è impostata automaticamente a 5 giorni dall'apertura.",
    );
  }

  async function loadMatchCandidates(source: "lineup" | "roster") {
    if (!selectedMatchId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await request(
        `/api/admin/games/votazioni/${encodeURIComponent(gameId)}?matchId=${encodeURIComponent(selectedMatchId)}&players=${source}`,
      );
      const value = await response.json() as { candidates?: VotingCandidate[] };
      setMatchSuggestions(value.candidates ?? []);
      if (source === "lineup" && (value.candidates ?? []).length > 0) {
        setScoreScorers(value.candidates ?? []);
      }
    } catch (current) {
      setError(current instanceof Error ? current.message : "Impossibile caricare i giocatori della partita.");
    } finally {
      setBusy(false);
    }
  }

  async function saveScorePrediction() {
    await run(
      () => postAction({
        action: "score-prediction-config",
        matchId: selectedMatchId,
        posterImageUrl: scorePosterImageUrl,
        scorerOptions: scoreScorers,
      }),
      "Score Prediction salvato.",
    );
  }

  async function saveMotm() {
    await run(
      () => postAction({
        action: "motm-config",
        matchId: selectedMatchId,
        candidates: motmCandidates,
      }),
      "Man Of The Match salvato.",
    );
  }

  async function saveCeremony() {
    await run(
      () => postAction({
        action: "ceremony-config",
        awardName,
        candidates: ceremonyCandidates,
      }),
      "Ceremony Award salvato.",
    );
  }

  if (loading) {
    return (
      <AppShell>
        <main className="min-h-screen bg-white pb-28">
          <Message>Caricamento votazione...</Message>
        </main>
      </AppShell>
    );
  }

  if (!preview) {
    return (
      <AppShell>
        <main className="min-h-screen bg-white pb-28">
          <Message error>{error ?? "Votazione non trovata."}</Message>
        </main>
      </AppShell>
    );
  }

  const poll = preview.poll;

  return (
    <AppShell>
      <main className="min-h-screen bg-white pb-28">
        <button
          type="button"
          onClick={() => router.push(`/admin/games/giochi/${encodeURIComponent(gameId)}/votazioni`)}
          className="mb-5 flex items-center gap-2 text-xs font-black uppercase text-[#06142E]/55"
        >
          <ChevronLeft size={17} /> Elenco votazioni
        </button>

        <header>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#06142E]/40">
            {VOTING_TYPE_LABELS[poll.type]}
          </p>
          <h1 className="mt-1 text-3xl font-black uppercase text-[#06142E]">{poll.title}</h1>
          {poll.description ? (
            <p className="mt-2 text-sm font-bold leading-6 text-[#06142E]/50">{poll.description}</p>
          ) : null}
        </header>

        {(error || success) ? (
          <Message error={Boolean(error)}>{error ?? success}</Message>
        ) : null}

        {poll.type === "build_xi" ? (
          <BuildXiBuilder
            preview={preview}
            busy={busy}
            fileInput={fileInput}
            onDownload={() => void downloadTemplate()}
            onUpload={(file) => void uploadTemplate(file)}
          />
        ) : null}

        {poll.type === "best_of_the_month" ? (
          <BestOfMonthBuilder
            gameId={gameId}
            pollId={pollId}
            monthKey={monthKey}
            opensAtLocal={opensAtLocal}
            awards={monthlyAwards}
            disabled={busy || !["setup", "ready"].includes(poll.status)}
            onMonthChange={setMonthKey}
            onOpensChange={setOpensAtLocal}
            onAwardsChange={setMonthlyAwards}
            onSave={() => void saveBestOfMonth()}
          />
        ) : null}

        {poll.type === "score_prediction" ? (
          <ScorePredictionBuilder
            matches={preview.matchOptions.filter((match) => match.isUpcoming)}
            selectedMatchId={selectedMatchId}
            posterImageUrl={scorePosterImageUrl}
            candidates={scoreScorers}
            disabled={busy || !["setup", "ready"].includes(poll.status)}
            onMatchChange={(value) => {
              setSelectedMatchId(value);
              setScorePosterImageUrl("");
              setScoreScorers([]);
              setMatchSuggestions([]);
            }}
            onPosterChange={setScorePosterImageUrl}
            onCandidatesChange={setScoreScorers}
            onLoadLineup={() => void loadMatchCandidates("lineup")}
            onSave={() => void saveScorePrediction()}
          />
        ) : null}

        {poll.type === "man_of_the_match" ? (
          <ManOfTheMatchBuilder
            matches={preview.matchOptions}
            selectedMatchId={selectedMatchId}
            candidates={motmCandidates}
            suggestions={matchSuggestions}
            disabled={busy || !["setup", "ready"].includes(poll.status)}
            onMatchChange={(value) => {
              setSelectedMatchId(value);
              setMotmCandidates([]);
              setMatchSuggestions([]);
            }}
            onLoadPlayers={() => void loadMatchCandidates("roster")}
            onCandidatesChange={setMotmCandidates}
            onSave={() => void saveMotm()}
          />
        ) : null}

        {poll.type === "ceremony_award" ? (
          <CeremonyAwardBuilder
            awardName={awardName}
            candidates={ceremonyCandidates}
            disabled={busy || !["setup", "ready"].includes(poll.status)}
            onAwardNameChange={setAwardName}
            onCandidatesChange={setCeremonyCandidates}
            onSave={() => void saveCeremony()}
          />
        ) : null}

        <StatusActions
          status={poll.status}
          busy={busy}
          onSetStatus={(status) => void setStatus(status)}
        />

        <ResultsPanel
          poll={
            poll
          }
          results={
            preview.results
          }
          busy={
            busy
          }
          buildXiTieDrafts={
            buildXiTieDrafts
          }
          onToggleBuildXiTieCandidate={
            toggleBuildXiTieCandidate
          }
          onSaveBuildXiTieBreak={
            saveBuildXiTieBreak
          }
        />
      </main>
    </AppShell>
  );
}

function BuildXiBuilder({
  preview,
  busy,
  fileInput,
  onDownload,
  onUpload,
}: {
  preview: Preview;
  busy: boolean;
  fileInput: RefObject<HTMLInputElement | null>;
  onDownload: () => void;
  onUpload: (file: File) => void;
}) {
  const editable = preview.poll.status === "setup" || preview.poll.status === "ready";
  return (
    <Panel title="Configurazione BUILD XI" icon={<FileSpreadsheet className="text-[#0B5FFF]" />}>
      <div className="grid grid-cols-4 gap-2">
        {(Object.keys(BUILD_XI_ROLE_LABELS) as BuildXiRole[]).map((role) => (
          <div key={role} className="rounded-[12px] bg-[#F5F5F2] p-2 text-center">
            <p className="text-[7px] font-black uppercase text-[#06142E]/35">{BUILD_XI_ROLE_LABELS[role]}</p>
            <p className="mt-1 text-sm font-black text-[#06142E]">{preview.poll.roleCounts[role]}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] font-bold text-[#06142E]/40">
        {preview.poll.candidateCount} giocatori configurati · soglia presenze 60%
      </p>
      {editable ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={onDownload} className="flex min-h-11 items-center justify-center gap-2 rounded-[12px] bg-[#06142E]/[0.06] px-3 text-[9px] font-black uppercase text-[#06142E] disabled:opacity-35">
            <Download size={16} /> Scarica Excel
          </button>
          <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} className="flex min-h-11 items-center justify-center gap-2 rounded-[12px] bg-[#06142E]/[0.06] px-3 text-[9px] font-black uppercase text-[#06142E] disabled:opacity-35">
            <Upload size={16} /> Carica Excel
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file);
              event.currentTarget.value = "";
            }}
          />
        </div>
      ) : null}
    </Panel>
  );
}

function BestOfMonthBuilder({
  gameId,
  pollId,
  monthKey,
  opensAtLocal,
  awards,
  disabled,
  onMonthChange,
  onOpensChange,
  onAwardsChange,
  onSave,
}: {
  gameId: string;
  pollId: string;
  monthKey: string;
  opensAtLocal: string;
  awards: Record<BestOfMonthAwardKey, VotingCandidate[]>;
  disabled: boolean;
  onMonthChange: (value: string) => void;
  onOpensChange: (value: string) => void;
  onAwardsChange: (value: Record<BestOfMonthAwardKey, VotingCandidate[]>) => void;
  onSave: () => void;
}) {
  const closesAt = opensAtLocal
    ? new Date(new Date(opensAtLocal).getTime() + 5 * 24 * 60 * 60 * 1000)
    : null;
  return (
    <Panel title="Best Of The Month">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Mese">
          <input type="month" value={monthKey} disabled={disabled} onChange={(event) => onMonthChange(event.target.value)} className="admin-input" />
        </Field>
        <Field label="Apertura votazioni">
          <input type="datetime-local" value={opensAtLocal} disabled={disabled} onChange={(event) => onOpensChange(event.target.value)} className="admin-input" />
        </Field>
      </div>
      <div className="mt-3 rounded-[14px] bg-blue-50 px-4 py-3 text-xs font-bold text-blue-800">
        Chiusura automatica: {closesAt ? closesAt.toLocaleString("it-IT") : "5 giorni dopo l'apertura"}
      </div>

      <div className="mt-5 space-y-5">
        {BEST_OF_MONTH_KEYS.map((key) => (
          <div key={key} className="rounded-[18px] bg-[#F5F5F2] p-4">
            <h3 className="font-black uppercase text-[#06142E]">{BEST_OF_MONTH_AWARD_LABELS[key]}</h3>
            <CandidateEditor
              candidates={awards[key]}
              disabled={disabled}
              onChange={(next) => onAwardsChange({ ...awards, [key]: next })}
            />
            <ShareLink gameId={gameId} pollId={pollId} awardKey={key} />
          </div>
        ))}
      </div>

      <SaveButton disabled={disabled} onClick={onSave}>Salva mese e candidati</SaveButton>
    </Panel>
  );
}

function ScorePredictionBuilder({
  matches,
  selectedMatchId,
  posterImageUrl,
  candidates,
  disabled,
  onMatchChange,
  onPosterChange,
  onCandidatesChange,
  onLoadLineup,
  onSave,
}: {
  matches: VotingMatchOption[];
  selectedMatchId: string;
  posterImageUrl: string;
  candidates: VotingCandidate[];
  disabled: boolean;
  onMatchChange: (value: string) => void;
  onPosterChange: (value: string) => void;
  onCandidatesChange: (value: VotingCandidate[]) => void;
  onLoadLineup: () => void;
  onSave: () => void;
}) {
  const match = matches.find((item) => item.id === selectedMatchId);
  return (
    <Panel title="Score Prediction">
      <div className="mb-5">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#06142E]/45">Locandina iniziale</p>
        <p className="mt-1 text-xs font-bold leading-5 text-[#06142E]/45">
          Carica la grafica verticale che aprirà lo Score Prediction. Il ritaglio è fisso in formato 9:16.
        </p>
        <div className="mt-3">
          <ScorePredictionPosterUploader
            value={posterImageUrl}
            disabled={disabled}
            onChange={onPosterChange}
          />
        </div>
      </div>

      <Field label="Partita">
        <select value={selectedMatchId} disabled={disabled} onChange={(event) => onMatchChange(event.target.value)} className="admin-input">
          <option value="">Seleziona una partita...</option>
          {matches.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </Field>
      {match ? (
        <div className="mt-3 rounded-[14px] bg-[#F5F5F2] p-4 text-xs font-bold text-[#06142E]/55">
          Chiusura automatica al calcio d&apos;inizio: {new Date(match.kickoffAtMs).toLocaleString("it-IT")}
        </div>
      ) : null}
      <button type="button" disabled={disabled || !selectedMatchId} onClick={onLoadLineup} className="mt-4 w-full flex min-h-11 items-center justify-center gap-2 rounded-[12px] bg-[#06142E]/[0.06] px-3 text-[9px] font-black uppercase text-[#06142E] disabled:opacity-35">
        Carica formazione WhatsApp
      </button>
      <p className="mt-3 text-[10px] font-bold leading-5 text-[#06142E]/45">
        La lista del miglior marcatore viene inizializzata con le formazioni ricevute dai presidenti via WhatsApp. Puoi correggerla, aggiungere o rimuovere giocatori prima della pubblicazione.
      </p>
      <CandidateEditor candidates={candidates} disabled={disabled} onChange={onCandidatesChange} />
      <SaveButton disabled={disabled || !selectedMatchId || !posterImageUrl || candidates.length === 0} onClick={onSave}>Salva Score Prediction</SaveButton>
    </Panel>
  );
}

function ManOfTheMatchBuilder({
  matches,
  selectedMatchId,
  candidates,
  suggestions,
  disabled,
  onMatchChange,
  onLoadPlayers,
  onCandidatesChange,
  onSave,
}: {
  matches: VotingMatchOption[];
  selectedMatchId: string;
  candidates: VotingCandidate[];
  suggestions: VotingCandidate[];
  disabled: boolean;
  onMatchChange: (value: string) => void;
  onLoadPlayers: () => void;
  onCandidatesChange: (value: VotingCandidate[]) => void;
  onSave: () => void;
}) {
  return (
    <Panel title="Man Of The Match">
      <Field label="Partita">
        <select value={selectedMatchId} disabled={disabled} onChange={(event) => onMatchChange(event.target.value)} className="admin-input">
          <option value="">Seleziona una partita...</option>
          {matches.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </Field>
      <button type="button" disabled={disabled || !selectedMatchId} onClick={onLoadPlayers} className="mt-4 w-full flex min-h-11 items-center justify-center gap-2 rounded-[12px] bg-[#06142E]/[0.06] px-3 text-[9px] font-black uppercase text-[#06142E] disabled:opacity-35">
        Carica giocatori della partita
      </button>
      {suggestions.length > 0 ? (
        <div className="mt-4 max-h-64 space-y-2 overflow-y-auto rounded-[16px] bg-[#F5F5F2] p-3">
          {suggestions.map((candidate) => {
            const selected = candidates.some((item) => item.id === candidate.id);
            return (
              <button
                key={candidate.id}
                type="button"
                disabled={disabled || (!selected && candidates.length >= 4)}
                onClick={() => onCandidatesChange(
                  selected
                    ? candidates.filter((item) => item.id !== candidate.id)
                    : [...candidates, candidate],
                )}
                className={`flex w-full items-center justify-between rounded-[12px] px-3 py-2 text-left text-xs font-black ${selected ? "bg-[#0B5FFF] text-white" : "bg-white text-[#06142E]"}`}
              >
                <span>{candidate.label}</span>
                <span className="opacity-60">{candidate.teamName}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      <p className="mt-3 text-xs font-black uppercase text-[#06142E]/45">Selezionati: {candidates.length}/4</p>
      <CandidateEditor candidates={candidates} disabled={disabled} onChange={onCandidatesChange} max={4} />
      <SaveButton disabled={disabled || !selectedMatchId || candidates.length !== 4} onClick={onSave}>Salva 4 candidati</SaveButton>
    </Panel>
  );
}

function CeremonyAwardBuilder({
  awardName,
  candidates,
  disabled,
  onAwardNameChange,
  onCandidatesChange,
  onSave,
}: {
  awardName: string;
  candidates: VotingCandidate[];
  disabled: boolean;
  onAwardNameChange: (value: string) => void;
  onCandidatesChange: (value: VotingCandidate[]) => void;
  onSave: () => void;
}) {
  return (
    <Panel title="Ceremony Awards">
      <Field label="Premio">
        <input value={awardName} disabled={disabled} onChange={(event) => onAwardNameChange(event.target.value)} placeholder="Es. Miglior Portiere" className="admin-input" />
      </Field>
      <CandidateEditor candidates={candidates} disabled={disabled} onChange={onCandidatesChange} />
      <SaveButton disabled={disabled || !awardName.trim()} onClick={onSave}>Salva premio e candidati</SaveButton>
    </Panel>
  );
}

function CandidateEditor({
  candidates,
  disabled,
  onChange,
  max,
}: {
  candidates: VotingCandidate[];
  disabled: boolean;
  onChange: (value: VotingCandidate[]) => void;
  max?: number;
}) {
  function add() {
    if (max && candidates.length >= max) return;
    onChange([
      ...candidates,
      {
        id: `candidate-${Date.now()}-${candidates.length + 1}`,
        label: "",
      },
    ]);
  }
  function update(index: number, field: "label" | "description" | "imageUrl", value: string) {
    onChange(candidates.map((candidate, currentIndex) => currentIndex === index ? { ...candidate, [field]: value } : candidate));
  }
  return (
    <div className="mt-4 space-y-3">
      {candidates.map((candidate, index) => (
        <div key={candidate.id} className="rounded-[14px] border border-[#06142E]/10 bg-white p-3">
          <div className="flex gap-2">
            <input
              value={candidate.label}
              disabled={disabled}
              onChange={(event) => update(index, "label", event.target.value)}
              placeholder="Nome candidato"
              className="admin-input flex-1"
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(candidates.filter((_, currentIndex) => currentIndex !== index))}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-red-50 text-red-700 disabled:opacity-35"
            >
              <Trash2 size={17} />
            </button>
          </div>
          <input
            value={candidate.description ?? ""}
            disabled={disabled}
            onChange={(event) => update(index, "description", event.target.value)}
            placeholder="Descrizione / squadra (facoltativa)"
            className="admin-input mt-2"
          />
          <input
            value={candidate.imageUrl ?? ""}
            disabled={disabled}
            onChange={(event) => update(index, "imageUrl", event.target.value)}
            placeholder="URL immagine (facoltativo)"
            className="admin-input mt-2"
          />
        </div>
      ))}
      <button
        type="button"
        disabled={disabled || Boolean(max && candidates.length >= max)}
        onClick={add}
        className="w-full flex min-h-11 items-center justify-center gap-2 rounded-[12px] bg-[#06142E]/[0.06] px-3 text-[9px] font-black uppercase text-[#06142E] disabled:opacity-35"
      >
        <Plus size={16} /> Aggiungi candidato
      </button>
    </div>
  );
}

function ShareLink({
  gameId,
  pollId,
  awardKey,
}: {
  gameId: string;
  pollId: string;
  awardKey: BestOfMonthAwardKey;
}) {
  const path = `/games/giochi/${encodeURIComponent(gameId)}/votazioni/${encodeURIComponent(pollId)}/${awardKey}`;
  return (
    <button
      type="button"
      onClick={() => {
        const url = typeof window === "undefined" ? path : `${window.location.origin}${path}`;
        void navigator.clipboard?.writeText(url);
      }}
      className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-[11px] bg-white px-3 text-[9px] font-black uppercase text-[#06142E]"
    >
      <Clipboard size={14} /> Copia link social
    </button>
  );
}

function StatusActions({
  status,
  busy,
  onSetStatus,
}: {
  status: VotingStatus;
  busy: boolean;
  onSetStatus: (status: VotingStatus) => void;
}) {
  return (
    <section className="mt-5 grid grid-cols-2 gap-2">
      {status === "ready" ? (
        <button type="button" disabled={busy} onClick={() => onSetStatus("published")} className="min-h-12 rounded-[13px] bg-emerald-600 px-4 text-xs font-black uppercase text-white disabled:opacity-35">
          Pubblica
        </button>
      ) : null}
      {status === "published" ? (
        <button type="button" disabled={busy} onClick={() => onSetStatus("closed")} className="min-h-12 rounded-[13px] bg-[#06142E] px-4 text-xs font-black uppercase text-white disabled:opacity-35">
          Chiudi votazione
        </button>
      ) : null}
      {status === "ready" ? (
        <button type="button" disabled={busy} onClick={() => onSetStatus("setup")} className="min-h-12 rounded-[13px] bg-[#F5F5F2] px-4 text-xs font-black uppercase text-[#06142E] disabled:opacity-35">
          Torna in setup
        </button>
      ) : null}
    </section>
  );
}

function ResultsPanel({
  poll,
  results,
  busy,
  buildXiTieDrafts,
  onToggleBuildXiTieCandidate,
  onSaveBuildXiTieBreak,
}: {
  poll:
    GamesVotingPoll;
  results:
    VotingAdminResults;
  busy:
    boolean;
  buildXiTieDrafts:
    Partial<
      Record<
        BuildXiRole,
        string[]
      >
    >;
  onToggleBuildXiTieCandidate:
    (
      role:
        BuildXiRole,
      playerId:
        string,
      requiredSelections:
        number,
    ) => void;
  onSaveBuildXiTieBreak:
    (
      role:
        BuildXiRole,
      requiredSelections:
        number,
    ) => Promise<void>;
}) {
  if (!results || results.submissionCount === 0) return null;

  const buildXiResults =
    results.buildXi;

  return (
    <Panel title={`Risultati · ${results.submissionCount} invii`}>
      {poll.type === "build_xi" && buildXiResults ? (
        <div className="space-y-5">
          {buildXiResults.tieRoles.length > 0 ? (
            <div className="space-y-4 rounded-[14px] bg-amber-50 p-4">
              <div>
                <p className="text-xs font-black uppercase text-amber-800">
                  Parità sul cutoff
                </p>
                <p className="mt-1 text-xs font-bold leading-5 text-amber-800/75">
                  Scegli manualmente tra i soli giocatori a pari voti. Il voto pubblico resta invariato e la decisione Admin viene salvata separatamente.
                </p>
              </div>

              {buildXiResults.tieRoles.map((role) => {
                const tieBreak =
                  buildXiResults.tieBreaks[role];

                if (!tieBreak) {
                  return null;
                }

                const selected =
                  buildXiTieDrafts[role] ??
                  [];

                const tiedPlayers =
                  buildXiResults.byRole[role].filter(
                    (player) =>
                      tieBreak.candidateIds.includes(
                        player.playerId,
                      ),
                  );

                return (
                  <div
                    key={role}
                    className="rounded-[13px] bg-white p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-black uppercase text-[#06142E]">
                        {BUILD_XI_ROLE_LABELS[role]}
                      </p>

                      <span className="text-[8px] font-black uppercase text-amber-700">
                        Scegli {tieBreak.requiredSelections}
                      </span>
                    </div>

                    <div className="mt-3 space-y-2">
                      {tiedPlayers.map((player) => {
                        const checked =
                          selected.includes(
                            player.playerId,
                          );

                        return (
                          <button
                            type="button"
                            key={player.playerId}
                            disabled={
                              busy ||
                              (
                                !checked &&
                                selected.length >=
                                  tieBreak.requiredSelections
                              )
                            }
                            onClick={() =>
                              onToggleBuildXiTieCandidate(
                                role,
                                player.playerId,
                                tieBreak.requiredSelections,
                              )
                            }
                            className={[
                              "flex min-h-11 w-full items-center justify-between gap-3 rounded-[11px] px-3 text-left transition disabled:opacity-35",
                              checked
                                ? "bg-[#06142E] text-white"
                                : "bg-[#F5F5F2] text-[#06142E]",
                            ].join(" ")}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-black uppercase">
                                {player.playerName}
                              </span>
                              <span className={[
                                "mt-0.5 block truncate text-[8px] font-bold",
                                checked
                                  ? "text-white/60"
                                  : "text-[#06142E]/40",
                              ].join(" ")}>
                                {player.teamName}
                              </span>
                            </span>

                            <span className="shrink-0 text-xs font-black">
                              {player.votes} voti
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      disabled={
                        busy ||
                        selected.length !==
                          tieBreak.requiredSelections
                      }
                      onClick={() => {
                        void onSaveBuildXiTieBreak(
                          role,
                          tieBreak.requiredSelections,
                        );
                      }}
                      className="mt-3 min-h-11 w-full rounded-[11px] bg-amber-500 px-4 text-[9px] font-black uppercase text-[#06142E] disabled:opacity-35"
                    >
                      Conferma scelta Admin
                    </button>
                  </div>
                );
              })}
            </div>
          ) : buildXiResults.finalLineup ? (
            <div className="rounded-[14px] bg-emerald-50 p-4">
              <p className="text-xs font-black uppercase text-emerald-800">
                BUILD XI determinata
              </p>
              <p className="mt-1 text-xs font-bold text-emerald-800/75">
                Tutti gli 11 posti risultano assegnati senza parità sul cutoff.
              </p>
            </div>
          ) : null}

          {buildXiResults.invalidSubmissionCount > 0 ? (
            <p className="text-[10px] font-bold text-amber-700">
              Submission escluse dal conteggio perché non valide: {buildXiResults.invalidSubmissionCount}
            </p>
          ) : null}

          {(Object.keys(BUILD_XI_ROLE_LABELS) as BuildXiRole[]).map((role) => (
            <div key={role}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[9px] font-black uppercase text-[#06142E]/35">
                  {BUILD_XI_ROLE_LABELS[role]}
                </p>
                <span className="text-[8px] font-black uppercase text-[#06142E]/30">
                  Classifica completa
                </span>
              </div>

              <div className="mt-2 divide-y divide-[#06142E]/[0.07] rounded-[13px] bg-[#F5F5F2] px-3">
                {(buildXiResults.byRole[role] ?? []).map((item) => (
                  <div
                    key={item.playerId}
                    className="flex items-center gap-3 py-3"
                  >
                    <span className="w-6 shrink-0 text-center text-xs font-black text-[#06142E]/35">
                      {item.rank}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-black text-[#06142E]">
                          {item.playerName}
                        </p>

                        {item.isAdminSelection ? (
                          <span className="rounded-full bg-blue-100 px-2 py-1 text-[7px] font-black uppercase text-blue-800">
                            Scelta Admin
                          </span>
                        ) : item.isFinalSelection ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-[7px] font-black uppercase text-emerald-800">
                            BUILD XI
                          </span>
                        ) : item.tiedAtCutoff ? (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-[7px] font-black uppercase text-amber-800">
                            Parità
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-0.5 truncate text-[9px] font-bold text-[#06142E]/40">
                        {item.teamName}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-sm font-black text-[#06142E]">
                        {item.votes} voti
                      </p>
                      <p className="text-[8px] font-black uppercase text-[#06142E]/35">
                        {item.percentage}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {poll.type === "best_of_the_month" && results.awards ? (
        <div className="space-y-4">
          {BEST_OF_MONTH_KEYS.map((key) => (
            <div key={key}>
              <p className="text-[9px] font-black uppercase text-[#06142E]/35">{BEST_OF_MONTH_AWARD_LABELS[key]}</p>
              {(results.awards?.[key] ?? []).slice(0, 5).map((candidate) => (
                <p key={candidate.id} className="mt-1 text-sm font-black text-[#06142E]">
                  {candidate.label} <span className="text-[#06142E]/35">· {candidate.votes}</span>
                </p>
              ))}
            </div>
          ))}
        </div>
      ) : null}
      {(poll.type === "man_of_the_match" || poll.type === "ceremony_award") && results.choices ? (
        <div className="space-y-1">
          {results.choices.map((candidate) => (
            <p key={candidate.id} className="text-sm font-black text-[#06142E]">
              {candidate.label} <span className="text-[#06142E]/35">· {candidate.votes} voti</span>
            </p>
          ))}
        </div>
      ) : null}
      {poll.type === "score_prediction" ? (
        <p className="text-sm font-bold text-[#06142E]/50">
          Pronostici ricevuti: {results.submissionCount}. Il confronto con il risultato ufficiale verrà rifinito nel prossimo passaggio.
        </p>
      ) : null}
    </Panel>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-6 rounded-[22px] border border-[#06142E]/10 bg-white p-5 shadow-[0_12px_30px_rgba(6,20,46,0.07)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-black uppercase text-[#06142E]">{title}</h2>
        {icon}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-[10px] font-black uppercase text-[#06142E]/45">
      {label}
      <div className="mt-2">{children}</div>
    </label>
  );
}

function SaveButton({
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
      className="mt-5 min-h-12 w-full rounded-[13px] bg-[#06142E] px-5 text-xs font-black uppercase text-white disabled:opacity-35"
    >
      {children}
    </button>
  );
}

function Message({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <div className={`mt-5 rounded-[16px] p-4 text-sm font-bold ${error ? "bg-red-50 text-red-700" : "bg-[#F5F5F2] text-[#06142E]/50"}`}>
      {children}
    </div>
  );
}

function toDateTimeLocal(timestamp: number) {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
