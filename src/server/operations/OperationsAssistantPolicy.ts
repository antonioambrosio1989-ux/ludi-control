import type {
  OperationalSuggestion,
  OperationalTask,
} from "@/src/types/OperationalTask";
export function buildOperationalSuggestions(
  tasks: OperationalTask[],
  now: number,
): OperationalSuggestion[] {
  const open = tasks
    .filter((task) => task.status === "open")
    .sort((a, b) => a.dueAtMs - b.dueAtMs);
  const overdue = open.filter((task) => task.dueAtMs < now);
  const imminent = open.filter(
    (task) => task.dueAtMs >= now && task.dueAtMs <= now + 86400000,
  );
  const suggestions: OperationalSuggestion[] = [];
  if (overdue.length)
    suggestions.push({
      id: "overdue",
      kind: "fact",
      title: `${overdue.length} attività in ritardo`,
      reason: `Inizia da «${overdue[0].title}» oppure assegna una nuova scadenza realistica.`,
      actionUrl: "/admin/operativo",
    });
  if (imminent.length)
    suggestions.push({
      id: "today",
      kind: "fact",
      title: `${imminent.length} scadenze nelle prossime 24 ore`,
      reason: `La prima è «${imminent[0].title}».`,
      actionUrl: "/admin/operativo",
    });
  suggestions.push({
    id: "growth-highlights",
    kind: "experiment",
    title: "Prova una rubrica settimanale dei protagonisti",
    reason:
      "Prepara un video breve con un gol o una parata e una storia del protagonista. Coinvolgi squadra e giocatore nella condivisione; confronta i risultati con contenuti simili, senza attribuire la crescita al format prima di averla misurata.",
    metric:
      "Condivisioni per account raggiunto e visite al sito da link tracciati.",
    taskTitle:
      "Preparare un contenuto dedicato al protagonista della settimana",
    dueAtMs: now + 3 * 86400000,
  });
  suggestions.push({
    id: "growth-links",
    kind: "experiment",
    title: "Collega un contenuto al centro partita",
    reason:
      "Prova una call to action verso una partita o una votazione con un link tracciato. Valuta quante visite si trasformano in partecipazioni, oltre alle visualizzazioni.",
    metric: "Sessioni dalla campagna e partecipazioni effettive.",
    taskTitle: "Preparare una campagna Instagram con link al centro partita",
    dueAtMs: now + 7 * 86400000,
  });
  return suggestions;
}
