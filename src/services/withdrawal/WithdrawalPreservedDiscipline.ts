import type { CloudMatchReport } from "../match/FirebaseMatchReportRepository";

/**
 * Discipline remains valid even when the corresponding match is voided for
 * sporting purposes. Reports are read from the original, published snapshot.
 * This intentionally does not add appearances, votes, goals, assists or MVPs.
 */
export function preservedDisciplineForPlayer(
  playerId: string,
  originalPublishedReports: readonly CloudMatchReport[],
  excludedMatchIds: ReadonlySet<string>,
): { yellowCards: number; redCards: number; directRedCards: number } {
  let yellowCards = 0;
  let redCards = 0;
  let directRedCards = 0;
  for (const report of originalPublishedReports) {
    if (report.status !== "published" || !excludedMatchIds.has(String(report.matchId))) continue;
    const performance = Object.values(report.data.performances ?? {}).find(
      entry => String(entry.playerId) === playerId,
    );
    if (!performance) continue;
    for (const value of [performance.yellowCards, performance.redCards, performance.directRedCards]) {
      if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
        throw new Error("Sanzioni nel tabellino annullato non verificabili.");
      }
    }
    yellowCards += performance.yellowCards ?? 0;
    redCards += performance.redCards ?? 0;
    directRedCards += performance.directRedCards ?? 0;
  }
  return { yellowCards, redCards, directRedCards };
}
