/** Regole pure: nessun accesso a Firestore e nessuna modifica alle rose. */
export type MembershipPeriod = {
  playerId: string;
  teamId: string;
  /** Data civile Europe/Rome inclusiva, formato YYYY-MM-DD. */
  from: string;
  /** Data civile Europe/Rome esclusiva, formato YYYY-MM-DD. */
  until?: string;
};

export type TransferRequest = {
  competitionSlug: string;
  effectiveDate: string;
  playerId: string;
  fromTeamId: string;
  toTeamId: string;
};

function isIsoCivilDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

/** Controlli strutturali: NON autorizzano da soli un trasferimento. */
export function validateTransferRequest(req: TransferRequest): void {
  if (typeof req.competitionSlug !== "string" || !req.competitionSlug.trim()) {
    throw new Error("Competizione obbligatoria.");
  }
  if (!isIsoCivilDate(req.effectiveDate)) {
    throw new Error("Data effettiva non valida.");
  }
  if (!req.playerId?.trim() || !req.fromTeamId?.trim() || !req.toTeamId?.trim()) {
    throw new Error("Giocatore e squadre sono obbligatori.");
  }
  if (req.fromTeamId === req.toTeamId) {
    throw new Error("Le squadre di provenienza e destinazione devono essere diverse.");
  }
}

/** Alias legacy mantenuto per i componenti ancora in migrazione. */
export const validateChampionshipTransfer = validateTransferRequest;

/** Ritorna la squadra valida alla data della gara; non interpreta partecipazioni occasionali. */
export function teamAtDate(periods: MembershipPeriod[], playerId: string, matchDate: string): string | null {
  if (!isIsoCivilDate(matchDate)) return null;
  const active = periods.filter(p =>
    p.playerId === playerId && p.from <= matchDate && (!p.until || matchDate < p.until)
  );
  if (active.length > 1) throw new Error("Storico trasferimenti incoerente: più squadre alla stessa data.");
  return active[0]?.teamId ?? null;
}
