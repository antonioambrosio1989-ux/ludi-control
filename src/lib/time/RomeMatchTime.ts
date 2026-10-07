export function romeKickoffMs(date: string, time: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time))
    return null;
  const wall = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(wall)) return null;
  let instant = wall;
  for (let pass = 0; pass < 2; pass++) {
    const offset =
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Europe/Rome",
        timeZoneName: "shortOffset",
      })
        .formatToParts(new Date(instant))
        .find((part) => part.type === "timeZoneName")?.value ?? "GMT";
    const match = offset.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    const minutes = match
      ? (Number(match[2]) * 60 + Number(match[3] ?? 0)) *
        (match[1] === "+" ? 1 : -1)
      : 0;
    instant = wall - minutes * 60_000;
  }
  return instant;
}
