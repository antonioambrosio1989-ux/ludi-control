export type OperationalRepeat = "none" | "weekly" | "monthly" | "yearly";

const ROME_TZ = "Europe/Rome";
const ROME_WALL_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: ROME_TZ,
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const ROME_OFFSET_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: ROME_TZ, timeZoneName: "shortOffset",
});

function romeParts(ms: number) {
  const parts = Object.fromEntries(
    ROME_WALL_FORMAT.formatToParts(new Date(ms)).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    hour: Number(parts.hour), minute: Number(parts.minute),
  };
}

function romeOffsetMinutes(instant: number): number {
  const match = ROME_OFFSET_FORMAT.formatToParts(new Date(instant))
    .find((part) => part.type === "timeZoneName")?.value
    .match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) throw new Error("Impossibile determinare il fuso orario italiano.");
  return (Number(match[2]) * 60 + Number(match[3] ?? 0)) * (match[1] === "+" ? 1 : -1);
}

// Converte un orario di parete italiano in un istante. Negli orari inesistenti
// del cambio DST primaverile sceglie la prima ora disponibile dopo il salto.
function romeInstant(year: number, month: number, day: number, hour: number, minute: number): number {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  let instant = wall - romeOffsetMinutes(wall) * 60_000;
  for (let pass = 0; pass < 4; pass++) {
    const next = wall - romeOffsetMinutes(instant) * 60_000;
    if (next === instant) return instant;
    instant = next;
  }
  // DST gap: usa l'offset antecedente per avanzare alla prima ora valida.
  return wall - romeOffsetMinutes(wall - 86400000) * 60_000;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Conserva giorno e ora dell'evento originario, anche dopo mesi corti e anni non bisestili. */
export function nextRecurringDeadline(
  dueAtMs: number,
  nowMs: number,
  repeat: Exclude<OperationalRepeat, "none">,
  originAtMs: number = dueAtMs,
): number {
  const origin = romeParts(originAtMs);
  const current = romeParts(dueAtMs);
  if (!Number.isFinite(dueAtMs) || !Number.isFinite(nowMs) || !Number.isFinite(originAtMs)) {
    throw new Error("Scadenza ricorrente non valida.");
  }
  const weeklyWall = Date.UTC(current.year, current.month - 1, current.day);
  for (let offset = 1; offset <= 1200; offset++) {
    let year: number;
    let month: number;
    let day: number;
    if (repeat === "weekly") {
      const date = new Date(weeklyWall + offset * 7 * 86400000);
      year = date.getUTCFullYear(); month = date.getUTCMonth() + 1; day = date.getUTCDate();
    } else if (repeat === "monthly") {
      const date = new Date(Date.UTC(current.year, current.month - 1 + offset, 1));
      year = date.getUTCFullYear(); month = date.getUTCMonth() + 1;
      day = Math.min(origin.day, daysInMonth(year, month));
    } else {
      year = current.year + offset; month = origin.month;
      day = Math.min(origin.day, daysInMonth(year, month));
    }
    const next = romeInstant(year, month, day, origin.hour, origin.minute);
    if (next > nowMs) return next;
  }
  throw new Error("Scadenza ricorrente non valida.");
}

export function nextWeeklyDeadline(dueAtMs: number, nowMs: number): number {
  return nextRecurringDeadline(dueAtMs, nowMs, "weekly");
}

export function reminderTimes(dueAtMs: number, offsets: number[], nowMs: number) {
  return [...new Set(offsets)]
    .map((offset) => ({ offset, sendAtMs: dueAtMs - offset * 60000 }))
    .filter((item) => item.sendAtMs >= nowMs);
}

export function reminderStillValid(
  reminder: { ownerId: string; taskRevision: number },
  task: { ownerId: string; revision: number; status: string } | undefined,
  adminActive: boolean,
) {
  return (
    adminActive && !!task && task.ownerId === reminder.ownerId &&
    task.status === "open" && task.revision === reminder.taskRevision
  );
}
