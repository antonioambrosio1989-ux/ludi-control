import {
  teamAtDate,
  validateTransferRequest,
  type MembershipPeriod,
  type TransferRequest,
} from "./TransferPolicy";

export type RecordedTransfer = TransferRequest & {
  id: string;
  seasonId: string;
};

/**
 * Ricostruisce le appartenenze senza cambiare i dati storici delle rose.
 * `initialTeamId` deve essere la squadra di iscrizione a inizio stagione,
 * non la squadra attuale dopo uno o più trasferimenti.
 */
export function buildMembershipPeriods(input: {
  playerId: string;
  initialTeamId: string;
  seasonStartDate: string;
  transfers: RecordedTransfer[];
}): MembershipPeriod[] {
  const { playerId, initialTeamId, seasonStartDate } = input;
  if (!playerId.trim() || !initialTeamId.trim()) {
    throw new Error("Giocatore e squadra iniziale obbligatori.");
  }
  const transfers = input.transfers
    .filter((transfer) => transfer.playerId === playerId)
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  const periods: MembershipPeriod[] = [];
  let currentTeamId = initialTeamId;
  let from = seasonStartDate;
  for (const transfer of transfers) {
    validateTransferRequest(transfer);
    if (transfer.effectiveDate <= from) {
      throw new Error("La data di trasferimento deve essere successiva all'inizio dell'appartenenza.");
    }
    if (transfer.fromTeamId !== currentTeamId) {
      throw new Error("Storico trasferimenti incoerente: squadra di provenienza non corrispondente.");
    }
    periods.push({ playerId, teamId: currentTeamId, from, until: transfer.effectiveDate });
    currentTeamId = transfer.toTeamId;
    from = transfer.effectiveDate;
  }
  periods.push({ playerId, teamId: currentTeamId, from });
  return periods;
}

export function registeredTeamForMatch(input: {
  playerId: string;
  matchDate: string;
  periods: MembershipPeriod[];
}): string | null {
  return teamAtDate(input.periods, input.playerId, input.matchDate);
}

/** Gli ospiti occasionali NON alterano l'appartenenza ufficiale. */
export function isOccasionalAppearance(input: {
  officialTeamId: string | null;
  appearanceTeamId: string;
}): boolean {
  return input.officialTeamId !== input.appearanceTeamId;
}
