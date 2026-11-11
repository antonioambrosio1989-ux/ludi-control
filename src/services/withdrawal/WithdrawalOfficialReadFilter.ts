/**
 * Phase 9D - safe, read-only boundary for official calculations.
 * Does NOT fetch Firebase data, change fixtures, or activate withdrawals.
 * Callers must supply a server-validated, complete snapshot of registrations.
 * Never pass an incomplete/partially loaded list of registrations.
 */

export type OfficialMatchReference = {
  id: string | number;
  seasonId: string | number;
  matchType?: string;
  homeTeamId: string | number;
  awayTeamId: string | number;
};

export type OfficialReportReference = {
  matchId: string | number;
};

export type VerifiedWithdrawalRegistration = {
  seasonId: string;
  teamId: string;
  state: string;
  effectsApplied: boolean;
  policy: string;
};

export type OfficialReadFilterInput<
  M extends OfficialMatchReference,
  R extends OfficialReportReference,
> = {
  seasonId: string;
  matches: readonly M[];
  reports: readonly R[];
  registrations: readonly VerifiedWithdrawalRegistration[];
  /** Set ONLY by a trusted server-side loader after complete snapshot validation. */
  registrationSnapshotComplete: boolean;
};

export type OfficialReadFilterResult<
  M extends OfficialMatchReference,
  R extends OfficialReportReference,
> = {
  matches: M[];
  reports: R[];
  excludedMatchIds: string[];
  excludedReportMatchIds: string[];
  retainedMatchCount: number;
  warnings: string[];
};

function id(value: string | number): string {
  return String(value).trim();
}

function isRegularSeason(match: OfficialMatchReference): boolean {
  return match.matchType === undefined || match.matchType === "regularSeason";
}

/**
 * A deliberately conservative selector: only applied cancellations may alter
 * official inputs. Unknown active states/policies reject the entire snapshot.
 * A second-leg withdrawal does NOT filter past played games; its walkovers are
 * separate persisted, matchweek-gated decisions and are NOT created here.
 */
export function selectOfficialWithdrawalInputs<
  M extends OfficialMatchReference,
  R extends OfficialReportReference,
>(input: OfficialReadFilterInput<M, R>): OfficialReadFilterResult<M, R> {
  if (!input.registrationSnapshotComplete) {
    throw new Error("Registro ritiri non completo: lettura ufficiale non certificabile.");
  }
  const seasonId = input.seasonId.trim();
  if (!seasonId) throw new Error("ID stagione mancante.");

  const cancelledTeamIds = new Set<string>();
  const activeTeamIds = new Set<string>();
  for (const item of input.registrations) {
    if (item.seasonId !== seasonId) {
      throw new Error("Registro ritiri contiene una stagione diversa.");
    }
    const teamId = item.teamId.trim();
    if (!teamId) throw new Error("Registro ritiri contiene una squadra senza ID.");
    // Draft/cancelled entries must never alter published statistics.
    if (item.state === "draft_pending_activation" || item.state === "cancelled") {
      if (item.effectsApplied) throw new Error("Bozza o ritiro annullato con effetti applicati: dati incoerenti.");
      continue;
    }
    if (item.state !== "active") {
      throw new Error(`Stato ritiro sconosciuto: ${item.state}`);
    }
    if (!item.effectsApplied) {
      throw new Error("Ritiro attivo senza conferma degli effetti sportivi: operazione non conclusa.");
    }
    if (activeTeamIds.has(teamId)) throw new Error("Più ritiri attivi per la stessa squadra.");
    activeTeamIds.add(teamId);
    if (item.policy === "void_all") {
      cancelledTeamIds.add(teamId);
    } else if (item.policy !== "retain_and_walkover") {
      throw new Error(`Policy di ritiro sconosciuta: ${item.policy}`);
    }
  }

  const matchIds = new Set<string>();
  const excluded = new Set<string>();
  const matches: M[] = [];
  for (const match of input.matches) {
    if (id(match.seasonId) !== seasonId) throw new Error("Partita di altra stagione nel calcolo ufficiale.");
    const matchId = id(match.id);
    if (!matchId || matchIds.has(matchId)) throw new Error("ID partita mancante o duplicato.");
    matchIds.add(matchId);
    if (
      isRegularSeason(match) &&
      (cancelledTeamIds.has(id(match.homeTeamId)) || cancelledTeamIds.has(id(match.awayTeamId)))
    ) {
      excluded.add(matchId);
    } else {
      matches.push(match);
    }
  }

  const reports: R[] = [];
  const excludedReportMatchIds: string[] = [];
  const warnings: string[] = [];
  for (const report of input.reports) {
    const matchId = id(report.matchId);
    if (excluded.has(matchId)) {
      excludedReportMatchIds.push(matchId);
    } else {
      reports.push(report);
      if (!matchIds.has(matchId)) warnings.push(`Tabellino orfano: ${matchId}`);
    }
  }

  return {
    matches,
    reports,
    excludedMatchIds: [...excluded].sort(),
    excludedReportMatchIds: [...new Set(excludedReportMatchIds)].sort(),
    retainedMatchCount: matches.length,
    warnings,
  };
}
