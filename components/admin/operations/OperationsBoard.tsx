"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Bell,
  Check,
  Plus,
  Sparkles,
  ArrowRight,
  Clock,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import AppShell from "@/components/ui/AppShell";
import { useAuth } from "@/src/hooks/useAuth";
import { auth } from "@/src/lib/firebase";
import { useCompetition } from "@/src/contexts/CompetitionContext";
import { romeKickoffMs } from "@/src/lib/time/RomeMatchTime";
import type {
  OperationalTask,
  OperationalSuggestion,
  OperationsConnections,
} from "@/src/types/OperationalTask";
type Reminder = {
  id: string;
  taskId: string;
  taskRevision: number;
  status: string;
  reason: string | null;
  dueAtMs: number;
};
type Overview = {
  tasks: OperationalTask[];
  completed: OperationalTask[];
  hasMore: boolean;
  reminders: Reminder[];
  suggestions: OperationalSuggestion[];
  connections: OperationsConnections;
  serverNowMs: number;
  sportingError: string | null;
};
type Brief = { answer: string; question: string; createdAtMs: number };
type Form = {
  title: string;
  notes: string;
  competitionId: string | null;
  category: OperationalTask["category"];
  priority: OperationalTask["priority"];
  due: string;
  reminderMinutes: number[];
  pushEnabled: boolean;
  repeat: OperationalTask["repeat"];
};
const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
function localRome(ms: number) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Rome",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
// Le chiavi YYYY-MM-DD vengono calcolate nel fuso italiano, anche a cavallo dell'ora legale.
function romeDayKey(ms: number): string {
  return localRome(ms).slice(0, 10);
}

function moveCalendarMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const moved = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return `${moved.getUTCFullYear()}-${String(moved.getUTCMonth() + 1).padStart(2, "0")}`;
}

function emptyForm(): Form {
  return {
    title: "",
    notes: "",
    competitionId: null,
    category: "organization",
    priority: "medium",
    due: localRome(Date.now() + 86400000),
    reminderMinutes: [0, 1440],
    pushEnabled: true,
    repeat: "none",
  };
}
const fieldClass =
  "mt-1 w-full rounded-xl border border-[#06142E]/15 bg-white p-3 text-sm";
export default function OperationsBoard() {
  const { user, isLoading } = useAuth();
  if (isLoading)
    return (
      <AppShell>
        <p role="status">Caricamento centro operativo…</p>
      </AppShell>
    );
  if (!user)
    return (
      <AppShell>
        <p>Accedi con il tuo account amministratore.</p>
        <Link href="/admin">Apri centro di controllo</Link>
      </AppShell>
    );
  return (
    <PersonalOperationsBoard
      key={user.uid}
      uid={user.uid}
      displayName={user.displayName ?? ""}
    />
  );
}
function PersonalOperationsBoard({
  uid,
  displayName,
}: {
  uid: string;
  displayName: string;
}) {
  const {
    currentSeason,
    selectedCompetitionId,
    selectedCompetition,
    competitions,
  } = useCompetition();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm);
  const [editing, setEditing] = useState<OperationalTask | null>(null);
  const [tab, setTab] = useState<"today" | "week" | "all" | "growth">("today");
  const [scope, setScope] = useState<"all" | "competition">("all");
  const [calendarMonth, setCalendarMonth] = useState(() => romeDayKey(Date.now()).slice(0, 7));
  const [selectedDay, setSelectedDay] = useState(() => romeDayKey(Date.now()));
  const [now, setNow] = useState(() => Date.now());
  const [question, setQuestion] = useState(
    "Quali sono le tre priorità di oggi e quale esperimento di crescita posso preparare questa settimana?",
  );
  const [brief, setBrief] = useState<Brief | null>(null);
  const sequence = useRef(0);
  const api = useCallback(
    async (path: string, method = "GET", body?: unknown) => {
      if (auth.currentUser?.uid !== uid)
        throw new Error("Sessione cambiata. Riapri il centro operativo.");
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(path, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Operazione non disponibile.");
      return result;
    },
    [uid],
  );
  const seasonId = currentSeason?.id;
  const load = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const value = (await api(
        `/api/admin/operations/tasks${seasonId ? `?season=${encodeURIComponent(seasonId)}` : ""}`,
      )) as Overview;
      if (request === sequence.current) {
        setData(value);
        setNow(value.serverNowMs);
        setError("");
      }
    } catch (e) {
      if (request === sequence.current)
        setError(e instanceof Error ? e.message : "Dati non disponibili.");
    }
  }, [api, seasonId]);
  useEffect(() => {
    const requestSequence = sequence;
    queueMicrotask(() => void load());
    const refresh = () => {
      if (document.visibilityState !== "hidden") void load();
    };
    const interval = window.setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      requestSequence.current++;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);
  useEffect(() => {
    let active = true;
    api("/api/admin/operations/assistant")
      .then((value) => {
        if (active) setBrief(value.brief);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [api]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const [date, time] = form.due.split("T");
      const dueAtMs = romeKickoffMs(date, time);
      if (dueAtMs === null) throw new Error("Scadenza non valida.");
      const task = { ...form, dueAtMs };
      await api(
        "/api/admin/operations/tasks",
        editing ? "PATCH" : "POST",
        editing
          ? {
              id: editing.id,
              revision: editing.revision,
              action: "update",
              task,
            }
          : task,
      );
      setForm(emptyForm());
      setEditing(null);
      setMessage(
        "Attività salvata. Gli anticipi già trascorsi non generano nuovi avvisi.",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvataggio non riuscito.");
    } finally {
      setBusy(false);
    }
  }
  async function mutate(task: OperationalTask, action: "complete" | "archive") {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api("/api/admin/operations/tasks", "PATCH", {
        id: task.id,
        revision: task.revision,
        action,
      });
      setMessage(
        result.nextId
          ? "Attività completata. La prossima ricorrenza è in agenda."
          : action === "complete"
            ? "Attività completata."
            : "Attività archiviata.",
      );
      if (editing?.id === task.id) {
        setEditing(null);
        setForm(emptyForm());
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }
  function edit(task: OperationalTask) {
    setEditing(task);
    setForm({
      title: task.title,
      notes: task.notes,
      competitionId: task.competitionId,
      category: task.category,
      priority: task.priority,
      due: localRome(task.dueAtMs),
      reminderMinutes: task.reminderMinutes,
      pushEnabled: task.pushEnabled,
      repeat: task.repeat,
    });
    document
      .getElementById("operational-task-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function prepare(suggestion: OperationalSuggestion) {
    setEditing(null);
    setForm({
      ...emptyForm(),
      title: suggestion.taskTitle ?? suggestion.title,
      notes:
        suggestion.reason +
        (suggestion.metric ? `\nMetrica: ${suggestion.metric}` : ""),
      due: localRome(suggestion.dueAtMs ?? now + 86400000),
      competitionId: selectedCompetitionId ?? null,
      category: suggestion.kind === "experiment" ? "brand" : "sport",
    });
    document
      .getElementById("operational-task-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function ask() {
    if (aiBusy) return;
    setAiBusy(true);
    setError("");
    try {
      const result = await api("/api/admin/operations/assistant", "POST", {
        question,
        seasonId: currentSeason?.id,
      });
      setBrief(result.brief);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Assistente temporaneamente non disponibile.",
      );
    } finally {
      setAiBusy(false);
    }
  }
  const tasks = (data?.tasks ?? []).filter(
    (task) =>
      scope === "all" ||
      !task.competitionId ||
      task.competitionId === selectedCompetitionId,
  );
  const overdue = tasks.filter((task) => task.dueAtMs < now);
  const today = tasks.filter(
    (task) => task.dueAtMs >= now && task.dueAtMs <= now + 86400000,
  );
  const week = tasks.filter(
    (task) => task.dueAtMs >= now && task.dueAtMs <= now + 7 * 86400000,
  );
  const [calendarYear, calendarMonthNumber] = calendarMonth.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(calendarYear, calendarMonthNumber, 0)).getUTCDate();
  const firstWeekday = (new Date(Date.UTC(calendarYear, calendarMonthNumber - 1, 1)).getUTCDay() + 6) % 7;
  const calendarDays = Array.from({ length: firstWeekday + daysInMonth }, (_, index) =>
    index < firstWeekday ? null : `${calendarMonth}-${String(index - firstWeekday + 1).padStart(2, "0")}`,
  );
  const taskCountsByDay = new Map<string, number>();
  for (const task of tasks) {
    const day = romeDayKey(task.dueAtMs);
    taskCountsByDay.set(day, (taskCountsByDay.get(day) ?? 0) + 1);
  }
  const monthLabel = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(calendarYear, calendarMonthNumber - 1, 1)));
  const visible =
    tab === "all"
      ? tasks.filter((task) => romeDayKey(task.dueAtMs) === selectedDay)
      : tab === "today"
      ? tasks.filter((task) => task.dueAtMs <= now + 86400000)
      : tab === "week"
        ? tasks.filter((task) => task.dueAtMs <= now + 7 * 86400000)
        : tasks;
  return (
    <AppShell>
      <div className="mt-2 space-y-6">
        <header className="rounded-[24px] bg-[#06142E] p-5 text-white sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-white/55">
            La tua regia quotidiana
          </p>
          <h1 className="mt-2 text-3xl font-black">Centro operativo</h1>
          <p className="mt-2 text-sm text-white/75">
            {displayName ? `${displayName}, ecco` : "Ecco"} cosa seguire oggi e
            cosa preparare per le prossime settimane.
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {[
              ["In ritardo", overdue.length],
              ["Entro 24 ore", today.length],
              ["Entro 7 giorni", week.length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-white/10 p-3">
                <p className="text-xl font-black">{data ? value : "—"}</p>
                <p className="mt-1 text-[10px] text-white/65">{label}</p>
              </div>
            ))}
          </div>
        </header>
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
          </p>
        )}
        {message && (
          <p
            role="status"
            className="rounded-xl bg-green-50 p-3 text-sm text-green-900"
          >
            {message}
          </p>
        )}
        {data?.sportingError && (
          <p role="status" className="text-sm text-amber-800">
            {data.sportingError}
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <select
            aria-label="Ambito attività"
            value={scope}
            onChange={(e) => setScope(e.target.value as typeof scope)}
            className="w-full rounded-xl border p-3 text-xs font-bold sm:max-w-[320px]"
          >
            <option value="all">Tutte le mie attività</option>
            <option value="competition">
              {selectedCompetition?.name ?? "Competizione selezionata"} +
              attività generali
            </option>
          </select>
          <button
            type="button"
            onClick={() => void load()}
            aria-label="Aggiorna centro operativo"
            className="rounded-xl border p-2"
          >
            <RefreshCw size={16} />
          </button>
        </div>
        <nav
          aria-label="Viste dell'agenda"
          className="grid grid-cols-2 gap-1 rounded-xl bg-[#F5F5F2] p-1 sm:grid-cols-4"
        >
          {(
            [
              ["today", "Oggi"],
              ["week", "7 giorni"],
              ["all", "Agenda"],
              ["growth", "Crescita"],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={tab === value}
              onClick={() => setTab(value)}
              className={`rounded-lg py-3 text-xs font-bold ${tab === value ? "bg-[#06142E] text-white" : ""}`}
            >
              {label}
            </button>
          ))}
        </nav>
        {!data && !error && (
          <p role="status" className="py-8 text-center">
            Caricamento delle tue attività…
          </p>
        )}
        {tab === "all" && data && (
          <section aria-label="Calendario delle attività" className="rounded-2xl border border-[#06142E]/10 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-black capitalize">{monthLabel}</h2>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => {
                  const current = romeDayKey(Date.now());
                  setCalendarMonth(current.slice(0, 7));
                  setSelectedDay(current);
                }} className="rounded-lg border px-3 py-2 text-xs font-bold">Oggi</button>
                <button type="button" aria-label="Mese precedente" onClick={() => { const month = moveCalendarMonth(calendarMonth, -1); setCalendarMonth(month); setSelectedDay(`${month}-01`); }} className="rounded-lg border p-2"><ChevronLeft size={17} /></button>
                <button type="button" aria-label="Mese successivo" onClick={() => { const month = moveCalendarMonth(calendarMonth, 1); setCalendarMonth(month); setSelectedDay(`${month}-01`); }} className="rounded-lg border p-2"><ChevronRight size={17} /></button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {["L", "M", "M", "G", "V", "S", "D"].map((weekday, index) => (
                <span key={index} className="py-2 text-xs font-bold text-[#06142E]/50">{weekday}</span>
              ))}
              {calendarDays.map((day, index) => day ? (
                <button
                  key={day}
                  type="button"
                  aria-label={`${day}: ${taskCountsByDay.get(day) ?? 0} attività`}
                  aria-pressed={selectedDay === day}
                  onClick={() => setSelectedDay(day)}
                  className={`relative flex min-h-12 flex-col items-center justify-center rounded-xl text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${selectedDay === day ? "bg-[#06142E] text-white" : day === romeDayKey(now) ? "bg-[#F5F5F2] text-[#06142E]" : "text-[#06142E] hover:bg-[#F5F5F2]"}`}
                >
                  <span>{Number(day.slice(-2))}</span>
                  {(taskCountsByDay.get(day) ?? 0) > 0 && (
                    <span className={`mt-1 h-1.5 w-1.5 rounded-full ${selectedDay === day ? "bg-white" : "bg-blue-600"}`} />
                  )}
                </button>
              ) : <span key={`empty-${index}`} aria-hidden="true" />)}
            </div>
            <p className="mt-4 text-xs text-[#06142E]/60">
              {selectedDay.split("-").reverse().join("/")} · {taskCountsByDay.get(selectedDay) ?? 0} attività aperte.
              {data.hasMore ? " Sono visualizzate soltanto le prime 100 attività aperte." : ""}
            </p>
            <button type="button" onClick={() => {
              setEditing(null);
              setForm({ ...emptyForm(), due: `${selectedDay}T09:00` });
              document.getElementById("operational-task-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }} className="mt-3 flex items-center gap-2 text-sm font-bold text-[#06142E]">
              <Plus size={16} /> Nuova attività per questo giorno
            </button>
          </section>
        )}
        {tab !== "growth" && data && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-black">
              <CalendarDays size={19} />
              {tab === "today"
                ? "Da seguire oggi"
                : tab === "week"
                  ? "La settimana davanti a te"
                  : `Attività del ${selectedDay.split("-").reverse().join("/")}`}
            </h2>
            {visible.length === 0 && (
              <p className="rounded-2xl border p-5 text-sm text-[#06142E]/65">
                Nessuna attività in questa vista. Aggiungi una scadenza o
                trasforma un suggerimento in un&apos;attività.
              </p>
            )}
            {visible.map((task) => {
              const failed = (data.reminders ?? []).find(
                (reminder) =>
                  reminder.taskId === task.id &&
                  reminder.taskRevision === task.revision &&
                  ["failed", "skipped"].includes(reminder.status),
              );
              return (
                <article
                  key={task.id}
                  className={`rounded-2xl border p-4 ${task.dueAtMs < now ? "border-amber-300 bg-amber-50/40" : "border-[#06142E]/10"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase text-[#06142E]/55">
                        {
                          {
                            sport: "Sport",
                            editorial: "Contenuti",
                            brand: "Brand",
                            organization: "Organizzazione",
                          }[task.category]
                        }{" "}
                        ·{" "}
                        {
                          {
                            high: "Alta priorità",
                            medium: "Priorità normale",
                            low: "Bassa priorità",
                          }[task.priority]
                        }
                      </p>
                      <h3 className="mt-1 font-black">{task.title}</h3>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void mutate(task, "complete")}
                      aria-label={`Completa ${task.title}`}
                      className="rounded-full bg-[#06142E] p-2 text-white disabled:opacity-40"
                    >
                      <Check size={18} />
                    </button>
                  </div>
                  <p className="mt-2 flex items-center gap-1 text-xs font-bold">
                    <Clock size={13} />
                    {dateFormatter.format(task.dueAtMs)}
                    {task.dueAtMs < now ? " · In ritardo" : ""}
                  </p>
                  {task.notes && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-[#06142E]/65">
                      {task.notes}
                    </p>
                  )}
                  <p className="mt-2 text-[10px] text-[#06142E]/55">
                    {task.repeat === "weekly"
                      ? "Ricorrenza settimanale · "
                      : ""}
                    {task.pushEnabled
                      ? "Promemoria push richiesti"
                      : "Solo agenda"}
                  </p>
                  {failed && (
                    <p role="status" className="mt-2 text-xs text-amber-800">
                      Avviso non consegnato: {failed.reason}{" "}
                      <Link href="/admin/impostazioni" className="underline">
                        Controlla notifiche
                      </Link>
                    </p>
                  )}
                  <div className="mt-3 flex gap-4">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => edit(task)}
                      className="min-h-9 text-xs font-bold"
                    >
                      Modifica / rimanda
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void mutate(task, "archive")}
                      className="min-h-9 text-xs text-[#06142E]/55"
                    >
                      Archivia
                    </button>
                  </div>
                </article>
              );
            })}
            {data.hasMore && (
              <p className="text-xs text-amber-800">
                Sono mostrate le prime 100 attività aperte, ordinate per
                scadenza. Completa o archivia quelle gestite per visualizzare le
                successive.
              </p>
            )}
          </section>
        )}
        {data && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-black">
              <Sparkles size={19} />
              {tab === "growth"
                ? "Esperimenti per il brand"
                : "Il punto dell'assistente"}
            </h2>
            {data.suggestions
              .filter(
                (suggestion) =>
                  tab !== "growth" || suggestion.kind === "experiment",
              )
              .map((suggestion) => (
                <article
                  key={suggestion.id}
                  className="rounded-2xl bg-[#F5F5F2] p-4"
                >
                  <p className="text-[10px] font-black uppercase text-[#06142E]/50">
                    {suggestion.kind === "fact"
                      ? "Segnale operativo"
                      : "Esperimento da valutare"}
                  </p>
                  <h3 className="mt-1 font-black">{suggestion.title}</h3>
                  <p className="mt-2 text-sm text-[#06142E]/65">
                    {suggestion.reason}
                  </p>
                  {suggestion.metric && (
                    <p className="mt-2 text-xs font-bold">
                      Da misurare: {suggestion.metric}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-3">
                    {suggestion.taskTitle && (
                      <button
                        type="button"
                        onClick={() => prepare(suggestion)}
                        className="flex min-h-9 items-center gap-1 text-xs font-bold"
                      >
                        <Plus size={14} />
                        Prepara un&apos;attività
                      </button>
                    )}
                    {suggestion.actionUrl && (
                      <Link
                        href={suggestion.actionUrl}
                        className="flex min-h-9 items-center gap-1 text-xs font-bold"
                      >
                        Apri <ArrowRight size={14} />
                      </Link>
                    )}
                  </div>
                </article>
              ))}
          </section>
        )}
        {data && (
          <section className="rounded-2xl border border-[#06142E]/10 p-4">
            <h2 className="font-black">Collegamenti e dati</h2>
            <p className="mt-2 text-xs text-[#06142E]/60">
              Ludisleague.it · Instagram @ludi_centrosportivo. Nessuna metrica
              viene inventata o sostituita con zero.
            </p>
            {(
              [
                ["website", "Statistiche sito"],
                ["instagram", "Instagram Insights"],
                ["assistant", "Assistente AI"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="mt-4 border-t border-[#06142E]/10 pt-3">
                <p className="text-sm font-bold">
                  {label} ·{" "}
                  {
                    {
                      not_configured: "Da configurare",
                      needs_verification: "Da verificare",
                      configured: "Configurazione presente",
                    }[data.connections[key].status]
                  }
                </p>
                <p className="mt-1 text-xs text-[#06142E]/60">
                  {data.connections[key].message}
                </p>
              </div>
            ))}
            <p className="mt-4 text-xs text-[#06142E]/50">
              Configurazione rilevata {dateFormatter.format(data.serverNowMs)}.
              Questo controllo non certifica le autorizzazioni dei servizi
              esterni.
            </p>
          </section>
        )}
        <section className="rounded-2xl border border-[#06142E]/10 p-4">
          <h2 className="font-black">Chiedi all&apos;assistente</h2>
          <p className="mt-2 text-xs text-[#06142E]/60">
            La domanda e i titoli, categorie e scadenze delle tue attività
            verranno analizzati dall&apos;AI. Le risposte sono proposte: non
            creano attività né pubblicano contenuti da sole.
          </p>
          <label
            htmlFor="operations-question"
            className="mt-3 block text-xs font-bold"
          >
            La tua domanda
          </label>
          <textarea
            id="operations-question"
            maxLength={1200}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            className={fieldClass}
          />
          <button
            type="button"
            disabled={
              aiBusy ||
              !data ||
              data.connections.assistant.status !== "configured" ||
              question.trim().length < 3
            }
            onClick={() => void ask()}
            className="ludi-button-primary mt-3 w-full disabled:opacity-40"
          >
            {aiBusy ? "Preparazione del piano…" : "Analizza e proponi un piano"}
          </button>
          {brief && (
            <div className="mt-4 rounded-xl bg-[#F5F5F2] p-3">
              <p className="text-[10px] font-bold">
                Piano del {dateFormatter.format(brief.createdAtMs)} · potrebbe
                non riflettere gli ultimi aggiornamenti
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                {brief.answer}
              </p>
            </div>
          )}
        </section>
        <form
          id="operational-task-form"
          onSubmit={(event) => void submit(event)}
          className="rounded-2xl bg-[#F5F5F2] p-4"
        >
          <h2 className="flex items-center gap-2 font-black">
            <Plus size={18} />
            {editing ? "Modifica attività" : "Aggiungi un'attività"}
          </h2>
          <label htmlFor="task-title" className="mt-4 block text-xs font-bold">
            Titolo
          </label>
          <input
            id="task-title"
            required
            minLength={3}
            maxLength={140}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className={fieldClass}
            placeholder="Preparare i contenuti della prossima giornata"
          />
          <label htmlFor="task-notes" className="mt-3 block text-xs font-bold">
            Note e risultato atteso
          </label>
          <textarea
            id="task-notes"
            maxLength={2000}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className={fieldClass}
          />
          <label htmlFor="task-due" className="mt-3 block text-xs font-bold">
            Scadenza · ora italiana (Europe/Rome)
          </label>
          <input
            id="task-due"
            type="datetime-local"
            required
            value={form.due}
            onChange={(e) => setForm({ ...form, due: e.target.value })}
            className={fieldClass}
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-xs font-bold">
              Categoria
              <select
                value={form.category}
                onChange={(e) =>
                  setForm({
                    ...form,
                    category: e.target.value as Form["category"],
                  })
                }
                className={fieldClass}
              >
                <option value="organization">Organizzazione</option>
                <option value="sport">Sport</option>
                <option value="editorial">Contenuti</option>
                <option value="brand">Brand e crescita</option>
              </select>
            </label>
            <label className="text-xs font-bold">
              Priorità
              <select
                value={form.priority}
                onChange={(e) =>
                  setForm({
                    ...form,
                    priority: e.target.value as Form["priority"],
                  })
                }
                className={fieldClass}
              >
                <option value="high">Alta</option>
                <option value="medium">Normale</option>
                <option value="low">Bassa</option>
              </select>
            </label>
          </div>
          <label className="mt-3 block text-xs font-bold">
            Competizione
            <select
              value={form.competitionId ?? ""}
              onChange={(e) =>
                setForm({ ...form, competitionId: e.target.value || null })
              }
              className={fieldClass}
            >
              <option value="">Attività generale</option>
              {competitions.map((competition) => (
                <option key={competition.id} value={competition.id}>
                  {competition.name}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-xs font-bold">
            Ricorrenza
            <select
              value={form.repeat}
              onChange={(e) =>
                setForm({ ...form, repeat: e.target.value as Form["repeat"] })
              }
              className={fieldClass}
            >
              <option value="none">Una volta</option>
              <option value="weekly">
                Ogni settimana, alla stessa ora italiana
              </option>
            </select>
          </label>
          <fieldset className="mt-4">
            <legend className="flex items-center gap-1 text-xs font-bold">
              <Bell size={14} />
              Quando ricordarmelo
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(
                [
                  [0, "Alla scadenza"],
                  [60, "1 ora prima"],
                  [1440, "1 giorno prima"],
                  [10080, "1 settimana prima"],
                ] as const
              ).map(([offset, label]) => (
                <label
                  key={offset}
                  className="flex min-h-10 items-center gap-2 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={form.reminderMinutes.includes(offset)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        reminderMinutes: e.target.checked
                          ? [...form.reminderMinutes, offset]
                          : form.reminderMinutes.filter(
                              (value) => value !== offset,
                            ),
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="mt-3 flex min-h-10 items-center gap-2 text-xs font-bold">
            <input
              type="checkbox"
              checked={form.pushEnabled}
              onChange={(e) =>
                setForm({ ...form, pushEnabled: e.target.checked })
              }
            />
            Richiedi promemoria push sui miei dispositivi
          </label>
          <p className="text-xs text-[#06142E]/60">
            Per riceverli abilita le{" "}
            <Link href="/admin/impostazioni" className="underline">
              notifiche nelle impostazioni
            </Link>{" "}
            e autorizza il browser. Gli avvisi partono dal server dopo
            l&apos;attivazione della funzione di promemoria.
          </p>
          <button
            type="submit"
            disabled={busy || !data}
            className="ludi-button-primary mt-4 w-full disabled:opacity-40"
          >
            {busy
              ? "Salvataggio…"
              : editing
                ? "Salva modifiche"
                : "Salva attività e promemoria"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setForm(emptyForm());
              }}
              className="mt-3 min-h-10 w-full text-xs font-bold"
            >
              Annulla modifica
            </button>
          )}
        </form>
        {data?.completed.length ? (
          <details className="rounded-2xl border p-4">
            <summary className="cursor-pointer text-sm font-bold">
              Ultime attività completate ({data.completed.length})
            </summary>
            <ul className="mt-3 space-y-2">
              {data.completed.map((task) => (
                <li key={task.id} className="border-t pt-2 text-sm">
                  <span className="font-bold">{task.title}</span>
                  {task.completedAtMs && (
                    <p className="mt-1 text-xs text-[#06142E]/55">
                      {dateFormatter.format(task.completedAtMs)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </AppShell>
  );
}
