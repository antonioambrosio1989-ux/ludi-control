export function nextWeeklyDeadline(dueAtMs: number, nowMs: number): number {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(dueAtMs)).map((p) => [p.type, p.value]),
  );
  let wall = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
  );
  for (let week = 0; week < 600; week++) {
    wall += 7 * 86400000;
    let instant = wall;
    for (let pass = 0; pass < 2; pass++) {
      const offset = new Intl.DateTimeFormat("en-US", {
        timeZone: "Europe/Rome",
        timeZoneName: "shortOffset",
      })
        .formatToParts(new Date(instant))
        .find((p) => p.type === "timeZoneName")
        ?.value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
      const minutes = offset
        ? (Number(offset[2]) * 60 + Number(offset[3] ?? 0)) *
          (offset[1] === "+" ? 1 : -1)
        : 0;
      instant = wall - minutes * 60000;
    }
    if (instant > nowMs) return instant;
  }
  throw new Error("Scadenza ricorrente non valida.");
}
export function reminderTimes(
  dueAtMs: number,
  offsets: number[],
  nowMs: number,
) {
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
    adminActive &&
    !!task &&
    task.ownerId === reminder.ownerId &&
    task.status === "open" &&
    task.revision === reminder.taskRevision
  );
}
