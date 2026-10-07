"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  FlaskConical,
  Pencil,
  Plus,
  RotateCcw,
  Settings2,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/ui/AppShell";
import { useAuth } from "@/src/hooks/useAuth";
import { useCompetitions } from "@/src/hooks/useCompetitions";
import {
  BEST_OF_MONTH_AWARD_LABELS,
  VOTING_TYPE_LABELS,
  type GamesVotingPoll,
  type VotingType,
} from "@/src/types/GamesVoting";

const VOTING_TYPES: VotingType[] = [
  "build_xi",
  "best_of_the_month",
  "score_prediction",
  "man_of_the_match",
  "ceremony_award",
];

export default function AdminVotingListScreen({
  gameId,
}: {
  gameId: string;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const {
    activeCompetitions,
    isLoading: competitionsLoading,
  } = useCompetitions();

  const [polls, setPolls] = useState<GamesVotingPoll[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [competitionId, setCompetitionId] = useState("");
  const [votingType, setVotingType] = useState<VotingType>("build_xi");
  const [editingPollId, setEditingPollId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [editingCompetitionId, setEditingCompetitionId] = useState("");
  const [busyPollId, setBusyPollId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedCompetitionId =
    competitionId ||
    (["build_xi", "best_of_the_month"].includes(votingType)
      ? activeCompetitions[0]?.id ?? ""
      : "");

  const request = useCallback(
    async (init?: RequestInit) => {
      if (!user) throw new Error("Autenticazione Admin richiesta.");
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/admin/games/votazioni/${encodeURIComponent(gameId)}`,
        {
          ...init,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...init?.headers,
          },
        },
      );
      const value = await response.json().catch(() => ({})) as {
        polls?: GamesVotingPoll[];
        pollId?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(value.error || "Operazione non riuscita.");
      return value;
    },
    [gameId, user],
  );

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const value = await request();
      setPolls(value.polls ?? []);
      setError(null);
    } catch (current) {
      setError(current instanceof Error ? current.message : "Impossibile caricare le votazioni.");
    } finally {
      setLoading(false);
    }
  }, [request, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const canCreate = useMemo(() => {
    if (!title.trim() || creating) return false;
    if (["build_xi", "best_of_the_month"].includes(votingType)) {
      return Boolean(selectedCompetitionId);
    }
    return true;
  }, [creating, selectedCompetitionId, title, votingType]);

  async function createPoll() {
    if (!canCreate) return;
    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      const value = await request({
        method: "POST",
        body: JSON.stringify({
          action: "create",
          type: votingType,
          title: title.trim(),
          description: description.trim(),
          competitionId:
            ["build_xi", "best_of_the_month", "ceremony_award"].includes(votingType)
              ? selectedCompetitionId
              : "",
        }),
      });
      setTitle("");
      setDescription("");
      setCompetitionId("");
      await load();
      setSuccess(`${VOTING_TYPE_LABELS[votingType]} creata.`);
      if (value.pollId) {
        router.push(
          `/admin/games/giochi/${encodeURIComponent(gameId)}/votazioni/${encodeURIComponent(value.pollId)}`,
        );
      }
    } catch (current) {
      setError(current instanceof Error ? current.message : "Impossibile creare la votazione.");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(poll: GamesVotingPoll) {
    setEditingPollId(poll.id);
    setEditingTitle(poll.title);
    setEditingDescription(poll.description ?? "");
    setEditingCompetitionId(poll.competitionId ?? "");
    setError(null);
    setSuccess(null);
  }

  async function saveEdit(poll: GamesVotingPoll) {
    if (!editingTitle.trim()) {
      setError("Inserisci il titolo della votazione.");
      return;
    }
    await runPollAction(
      poll,
      async () => {
        await request({
          method: "POST",
          body: JSON.stringify({
            action: "metadata",
            pollId: poll.id,
            title: editingTitle.trim(),
            description: editingDescription.trim(),
            ...(poll.type === "best_of_the_month"
              ? { competitionId: editingCompetitionId }
              : {}),
          }),
        });
        setEditingPollId(null);
      },
      "Votazione aggiornata.",
    );
  }


  async function movePoll(
    poll: GamesVotingPoll,
    index: number,
    direction: -1 | 1,
  ) {
    const nextIndex = index + direction;

    if (
      nextIndex < 0 ||
      nextIndex >= polls.length ||
      busyPollId
    ) {
      return;
    }

    const nextPolls = [...polls];
    const [moved] = nextPolls.splice(index, 1);
    nextPolls.splice(nextIndex, 0, moved);

    setBusyPollId(poll.id);
    setError(null);
    setSuccess(null);

    try {
      await request({
        method: "POST",
        body: JSON.stringify({
          action: "reorder",
          orderedPollIds: nextPolls.map((item) => item.id),
        }),
      });

      setPolls(nextPolls);
      setSuccess("Ordine votazioni aggiornato.");
    } catch (current) {
      setError(
        current instanceof Error
          ? current.message
          : "Impossibile aggiornare l'ordine delle votazioni.",
      );
    } finally {
      setBusyPollId(null);
    }
  }

  async function resetPoll(poll: GamesVotingPoll) {
    const confirmed = window.confirm(
      [
        `Resettare "${poll.title}"?`,
        "",
        "La votazione tornerà allo stato appena creato.",
        "Configurazione, candidati e voti degli utenti verranno azzerati.",
        "Titolo e descrizione resteranno invariati.",
      ].join("\n"),
    );
    if (!confirmed) return;
    await runPollAction(
      poll,
      () => request({
        method: "POST",
        body: JSON.stringify({ action: "reset", pollId: poll.id }),
      }).then(() => undefined),
      "Votazione resettata.",
    );
  }

  async function deletePoll(poll: GamesVotingPoll) {
    const confirmed = window.confirm(
      [
        `Eliminare definitivamente "${poll.title}"?`,
        "",
        "Verranno cancellati anche tutti i voti degli utenti.",
        "Questa operazione non può essere annullata.",
      ].join("\n"),
    );
    if (!confirmed) return;
    await runPollAction(
      poll,
      () => request({
        method: "POST",
        body: JSON.stringify({ action: "delete", pollId: poll.id }),
      }).then(() => undefined),
      "Votazione eliminata.",
    );
  }

  async function runPollAction(
    poll: GamesVotingPoll,
    action: () => Promise<void>,
    message: string,
  ) {
    if (busyPollId) return;
    setBusyPollId(poll.id);
    setError(null);
    setSuccess(null);
    try {
      await action();
      await load();
      setSuccess(message);
    } catch (current) {
      setError(current instanceof Error ? current.message : "Operazione non riuscita.");
    } finally {
      setBusyPollId(null);
    }
  }

  const showCompetition = ["build_xi", "best_of_the_month", "ceremony_award"].includes(votingType);

  return (
    <AppShell>
      <main className="min-h-screen bg-white pb-28">
        <button
          type="button"
          onClick={() => router.push("/admin/games")}
          className="mb-5 flex items-center gap-2 text-xs font-black uppercase text-[#06142E]/55"
        >
          <ChevronLeft size={17} /> Games
        </button>

        <header>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#06142E]/40">
            Pannello Admin
          </p>
          <h1 className="mt-1 text-3xl font-black uppercase text-[#06142E]">
            Elenco votazioni
          </h1>
          <p className="mt-2 text-sm font-bold leading-6 text-[#06142E]/50">
            Ogni categoria ha il proprio builder, la propria demo e la stessa interfaccia usata nel gioco reale.
          </p>
        </header>

        <section className="mt-6 rounded-[22px] bg-[#F5F5F2] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
            Nuova votazione
          </p>
          <h2 className="mt-1 text-xl font-black uppercase text-[#06142E]">
            Crea votazione
          </h2>

          <label className="mt-4 block text-[10px] font-black uppercase text-[#06142E]/45">
            Categoria
            <select
              value={votingType}
              onChange={(event) => {
                setVotingType(event.target.value as VotingType);
                setCompetitionId("");
              }}
              className="mt-2 min-h-12 w-full rounded-[13px] bg-white px-4 text-sm font-bold normal-case text-[#06142E] outline-none"
            >
              {VOTING_TYPES.map((type) => (
                <option key={type} value={type}>
                  {VOTING_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>

          {showCompetition ? (
            <label className="mt-3 block text-[10px] font-black uppercase text-[#06142E]/45">
              Competizione {votingType === "ceremony_award" ? "(facoltativa)" : ""}
              <select
                value={selectedCompetitionId}
                disabled={competitionsLoading}
                onChange={(event) => setCompetitionId(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-[13px] bg-white px-4 text-sm font-bold normal-case text-[#06142E] outline-none"
              >
                {votingType === "ceremony_award" ? (
                  <option value="">Tutte le competizioni</option>
                ) : (
                  <option value="">Seleziona...</option>
                )}
                {activeCompetitions.map((competition) => (
                  <option key={competition.id} value={competition.id}>
                    {competition.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="mt-3 block text-[10px] font-black uppercase text-[#06142E]/45">
            Titolo
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={titlePlaceholder(votingType)}
              className="mt-2 min-h-12 w-full rounded-[13px] bg-white px-4 text-sm font-bold normal-case text-[#06142E] outline-none"
            />
          </label>

          <label className="mt-3 block text-[10px] font-black uppercase text-[#06142E]/45">
            Descrizione personalizzata
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder={descriptionPlaceholder(votingType)}
              className="mt-2 w-full resize-none rounded-[13px] bg-white px-4 py-3 text-sm font-bold normal-case leading-5 text-[#06142E] outline-none"
            />
          </label>

          <div className="mt-3 rounded-[14px] bg-white px-4 py-3 text-xs font-bold leading-5 text-[#06142E]/50">
            {typeHelp(votingType)}
          </div>

          <button
            type="button"
            disabled={!canCreate}
            onClick={() => void createPoll()}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-[13px] bg-[#06142E] px-5 text-xs font-black uppercase text-white disabled:opacity-35"
          >
            <Plus size={17} /> {creating ? "Creazione..." : "Crea votazione"}
          </button>
        </section>

        {(error || success) && (
          <div className={`mt-5 rounded-[16px] p-4 text-sm font-bold ${
            error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
          }`}>
            {error ?? success}
          </div>
        )}

        <section className="mt-7">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
                Votazioni create
              </p>
              <h2 className="mt-1 text-2xl font-black uppercase text-[#06142E]">
                Catalogo votazioni
              </h2>
            </div>
            <span className="text-xs font-black text-[#06142E]/35">{polls.length}</span>
          </div>

          {loading ? (
            <Message>Caricamento votazioni...</Message>
          ) : polls.length === 0 ? (
            <Message>Nessuna votazione creata.</Message>
          ) : (
            <div className="mt-4 space-y-4">
              {polls.map((poll, index) => {
                const isBusy = busyPollId === poll.id;
                return (
                  <article
                    key={poll.id}
                    className="rounded-[20px] border border-[#06142E]/10 bg-white p-5 shadow-[0_10px_24px_rgba(6,20,46,0.06)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[#06142E]/[0.06] px-2.5 py-1 text-[7px] font-black uppercase text-[#06142E]/60">
                            {VOTING_TYPE_LABELS[poll.type]}
                          </span>
                          <StatusBadge status={poll.status} />
                        </div>
                        <h3 className="mt-3 text-lg font-black uppercase text-[#06142E]">
                          {poll.title}
                        </h3>
                        {poll.description?.trim() ? (
                          <p className="mt-1 text-xs font-bold leading-5 text-[#06142E]/45">
                            {poll.description}
                          </p>
                        ) : null}
                        <p className="mt-2 text-[10px] font-black uppercase text-[#06142E]/35">
                          {pollSummary(poll)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between rounded-[14px] bg-[#F5F5F2] px-3 py-2">
                      <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#06142E]/40">
                        Ordine {index + 1}
                      </span>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          aria-label="Sposta votazione su"
                          disabled={isBusy || index === 0}
                          onClick={() => void movePoll(poll, index, -1)}
                          className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white text-[#06142E] disabled:opacity-25"
                        >
                          <ArrowUp size={16} />
                        </button>

                        <button
                          type="button"
                          aria-label="Sposta votazione giù"
                          disabled={isBusy || index === polls.length - 1}
                          onClick={() => void movePoll(poll, index, 1)}
                          className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white text-[#06142E] disabled:opacity-25"
                        >
                          <ArrowDown size={16} />
                        </button>
                      </div>
                    </div>

                    {editingPollId === poll.id ? (
                      <div className="mt-4 rounded-[16px] bg-[#F5F5F2] p-4">
                        <input
                          value={editingTitle}
                          onChange={(event) => setEditingTitle(event.target.value)}
                          className="min-h-11 w-full rounded-[12px] bg-white px-3 text-sm font-bold text-[#06142E] outline-none"
                        />
                        <textarea
                          value={editingDescription}
                          onChange={(event) => setEditingDescription(event.target.value)}
                          rows={3}
                          className="mt-2 w-full resize-none rounded-[12px] bg-white px-3 py-3 text-sm font-bold text-[#06142E] outline-none"
                        />
                        {poll.type === "best_of_the_month" ? (
                          <select
                            value={editingCompetitionId}
                            disabled={competitionsLoading}
                            onChange={(event) => setEditingCompetitionId(event.target.value)}
                            className="mt-2 min-h-11 w-full rounded-[12px] bg-white px-3 text-sm font-bold text-[#06142E] outline-none"
                          >
                            <option value="">Seleziona competizione...</option>
                            {activeCompetitions.map((competition) => (
                              <option key={competition.id} value={competition.id}>
                                {competition.name}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingPollId(null)}
                            className="min-h-10 rounded-[11px] bg-white text-[9px] font-black uppercase text-[#06142E]"
                          >
                            Annulla
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void saveEdit(poll)}
                            className="min-h-10 rounded-[11px] bg-[#06142E] text-[9px] font-black uppercase text-white disabled:opacity-35"
                          >
                            Salva
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                      <ActionButton
                        label="Sviluppa"
                        icon={<Settings2 size={15} />}
                        disabled={isBusy}
                        onClick={() => router.push(`/admin/games/giochi/${encodeURIComponent(gameId)}/votazioni/${encodeURIComponent(poll.id)}`)}
                      />
                      <ActionButton
                        label="Demo"
                        icon={<FlaskConical size={15} />}
                        disabled={isBusy}
                        onClick={() => router.push(`/admin/games/giochi/${encodeURIComponent(gameId)}/votazioni/${encodeURIComponent(poll.id)}/demo`)}
                      />
                      <ActionButton
                        label="Modifica"
                        icon={<Pencil size={15} />}
                        disabled={isBusy}
                        onClick={() => startEdit(poll)}
                      />
                      <ActionButton
                        label="Reset"
                        icon={<RotateCcw size={15} />}
                        disabled={isBusy}
                        onClick={() => void resetPoll(poll)}
                      />
                      <ActionButton
                        label="Elimina"
                        icon={<Trash2 size={15} />}
                        danger
                        disabled={isBusy}
                        onClick={() => void deletePoll(poll)}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}

function Message({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 rounded-[20px] bg-[#F5F5F2] p-5 text-sm font-bold text-[#06142E]/45">
      {children}
    </div>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
  disabled,
  danger = false,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-10 items-center justify-center gap-1.5 rounded-[11px] px-2 text-[8px] font-black uppercase disabled:opacity-35 ${
        danger ? "bg-red-50 text-red-700" : "bg-[#F5F5F2] text-[#06142E]"
      }`}
    >
      {icon} {label}
    </button>
  );
}

function StatusBadge({ status }: { status: GamesVotingPoll["status"] }) {
  const label = status === "published"
    ? "Pubblicata"
    : status === "closed"
      ? "Chiusa"
      : status === "ready"
        ? "Pronta"
        : "Setup";
  return (
    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[7px] font-black uppercase text-amber-700">
      {label}
    </span>
  );
}

function pollSummary(poll: GamesVotingPoll) {
  if (poll.type === "build_xi") {
    return `${poll.competitionName} · ${poll.seasonName} · ${poll.candidateCount} giocatori`;
  }
  if (poll.type === "best_of_the_month") {
    if (!poll.bestOfMonth) return "Mese e candidati da configurare";
    const count = Object.values(poll.bestOfMonth.awards).reduce((total, award) => total + award.candidates.length, 0);
    return `${poll.competitionName} · ${poll.bestOfMonth.monthLabel} · ${count} candidature complessive`;
  }
  if (poll.type === "score_prediction") {
    return poll.scorePrediction?.match.label ?? "Partita da selezionare";
  }
  if (poll.type === "man_of_the_match") {
    return poll.manOfTheMatch
      ? `${poll.manOfTheMatch.match.homeTeamName} - ${poll.manOfTheMatch.match.awayTeamName} · ${poll.manOfTheMatch.candidates.length}/4 candidati`
      : "Partita e candidati da configurare";
  }
  return poll.ceremonyAward
    ? `${poll.ceremonyAward.awardName} · ${poll.ceremonyAward.candidates.length} candidati`
    : "Premio e candidati da configurare";
}

function titlePlaceholder(type: VotingType) {
  if (type === "build_xi") return "Es. BUILD XI Championship";
  if (type === "best_of_the_month") return "Es. Best Of The Month - Settembre 2026";
  if (type === "score_prediction") return "Es. Indovina il risultato";
  if (type === "man_of_the_match") return "Es. Man Of The Match";
  return "Es. Miglior giocatore della stagione";
}

function descriptionPlaceholder(type: VotingType) {
  if (type === "build_xi") return "Scegli i migliori undici della competizione.";
  if (type === "best_of_the_month") return "Vota Player, Goal e Save Of The Month.";
  if (type === "score_prediction") return "Indovina risultato esatto e miglior marcatore.";
  if (type === "man_of_the_match") return "Scegli il miglior giocatore della partita.";
  return "Vota il tuo candidato per il premio di fine stagione.";
}

function typeHelp(type: VotingType) {
  if (type === "build_xi") return "1 portiere, 3 difensori, 4 centrocampisti e 3 attaccanti. Un solo invio per utente.";
  if (type === "best_of_the_month") {
    return `${BEST_OF_MONTH_AWARD_LABELS.player_of_the_month}, ${BEST_OF_MONTH_AWARD_LABELS.goal_of_the_month} e ${BEST_OF_MONTH_AWARD_LABELS.save_of_the_month}. Finestra automatica di 5 giorni.`;
  }
  if (type === "score_prediction") return "Scegli una partita dei campionati in corso. La votazione si chiude automaticamente al calcio d'inizio.";
  if (type === "man_of_the_match") return "Scegli la partita e 4 candidati. Ogni utente vota un solo giocatore.";
  return "Crea una votazione per ogni premio della cerimonia finale e inserisci i relativi candidati.";
}
