export function resolveSurvivorWinnerUserId({
  totalEntries,
  activeUserIds,
}: {
  totalEntries:
    number;
  activeUserIds:
    string[];
}): string | undefined {
  if (
    totalEntries <
      2 ||
    activeUserIds.length !==
      1
  ) {
    return undefined;
  }

  const userId =
    activeUserIds[0]?.trim() ??
    "";

  return userId ||
    undefined;
}

export function isSurvivorRoundMatchTerminal({
  reportStatus,
  matchStatus,
}: {
  reportStatus:
    string;
  matchStatus:
    string;
}): boolean {
  const normalizedReportStatus =
    reportStatus
      .trim()
      .toLowerCase();

  const normalizedMatchStatus =
    matchStatus
      .trim()
      .toLowerCase();

  return (
    normalizedReportStatus ===
      "played" ||
    normalizedReportStatus ===
      "walkover" ||
    normalizedReportStatus ===
      "postponed" ||
    normalizedReportStatus ===
      "cancelled" ||
    normalizedMatchStatus ===
      "cancelled"
  );
}


export function isSurvivorSelectionNeutralWithoutReport(
  matchStatus:
    unknown,
): boolean {
  return (
    typeof matchStatus ===
      "string" &&
    matchStatus
      .trim()
      .toLowerCase() ===
      "cancelled"
  );
}
