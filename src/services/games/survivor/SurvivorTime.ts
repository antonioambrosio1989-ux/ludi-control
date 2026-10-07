/**
 * Helper temporali puri per League One Survivor.
 *
 * Le chiavi sono nel formato lessicograficamente ordinabile:
 * YYYY-MM-DD HH:mm
 *
 * Tutti i confronti sono eseguiti nel fuso Europe/Rome.
 */
export function currentRomeDateTimeKey(
  date:
    Date = new Date(),
): string {
  const parts =
    new Intl.DateTimeFormat(
      "sv-SE",
      {
        timeZone:
          "Europe/Rome",
        year:
          "numeric",
        month:
          "2-digit",
        day:
          "2-digit",
        hour:
          "2-digit",
        minute:
          "2-digit",
        hour12:
          false,
      },
    ).formatToParts(
      date,
    );

  const value =
    Object.fromEntries(
      parts.map(
        (part) => [
          part.type,
          part.value,
        ],
      ),
    );

  return `${value.year}-${value.month}-${value.day} ${value.hour}:${value.minute}`;
}

export function isSurvivorRoundClosedAt(
  closesAtKey:
    string,
  now:
    Date = new Date(),
): boolean {
  return (
    currentRomeDateTimeKey(
      now,
    ) >=
    closesAtKey
  );
}
