/** Solo presentazione, senza modificare il risultato del motore sportivo. */
export type PreviewNotice = { message: string; severity: "blocking" | "review" | "information" };
export type MatchReportCheck = { matchId: string; matchweek: number; status: string; reportPublished: boolean; homeTeamId: string; awayTeamId: string };

export function classifyWithdrawalNotices(messages: readonly string[]): PreviewNotice[] {
  return [...new Set(messages.map(message => message.trim()).filter(Boolean))].map(message => {
    const normalized = message.toLocaleLowerCase("it");
    const severity: PreviewNotice["severity"] =
      /calendario parziale|gare importate su|giornate non ancora importate|impossibile|incongruen|mancante|manca|duplicat|non risulta|non trovato|non valid|non riconosciut|da ricalcolare cronologicamente|trasferiment|verificare manualmente|richiede|non attesta|assenza di tabellino/.test(normalized)
        ? "blocking"
        : /verific|rinviat|squalific|ammonizion|cartellin|provvediment|segnala/.test(normalized)
          ? "review"
          : "information";
    return { message, severity };
  });
}

export function getMatchReportChecks(
  matches: readonly { id: string; matchweek: number; status: string; homeTeamId: string | number; awayTeamId: string | number; matchType?: string }[],
  publishedReportIds: ReadonlySet<string>,
): MatchReportCheck[] {
  return matches.filter(match => (match.matchType ?? "regularSeason") === "regularSeason" &&
    !publishedReportIds.has(String(match.id))).map(match => ({
      matchId: String(match.id), matchweek: match.matchweek, status: match.status,
      homeTeamId: String(match.homeTeamId), awayTeamId: String(match.awayTeamId), reportPublished: false,
    })).sort((a,b)=>a.matchweek-b.matchweek || a.matchId.localeCompare(b.matchId));
}

export function requiresMissingReportReview(status: string): boolean {
  return status === "finished" || status === "played" || status === "walkover" || status === "live";
}

export function displayIdentity(id: string, names: Readonly<Record<string,string>>): { name: string; unresolved: boolean } {
  const name = names[id]?.trim();
  return { name: name || id, unresolved: !name };
}
