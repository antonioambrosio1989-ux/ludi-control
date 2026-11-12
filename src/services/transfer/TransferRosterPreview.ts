import {
  buildMembershipPeriods,
  type RecordedTransfer,
} from "./TransferHistory";
import {
  validateTransferRequest,
  type MembershipPeriod,
  type TransferRequest,
} from "./TransferPolicy";

export type RosterTransferEntry = {
  playerId: string;
  teamId: string;
  status: string;
};

export type TransferPreview = {
  request: TransferRequest;
  previousTeamId: string;
  nextTeamId: string;
  membershipPeriods: MembershipPeriod[];
};

/**
 * Anteprima pura e senza scritture. La squadra iniziale deve essere
 * quella della prima iscrizione alla stagione, non la squadra attuale.
 * Non altera tabellini, partite, statistiche o documenti Firestore.
 */
export function previewChampionshipTransfer(input: {
  request: TransferRequest;
  seasonStartDate: string;
  initialTeamId: string;
  existingTransfers: RecordedTransfer[];
  seasonRoster: RosterTransferEntry[];
  registeredTeamIds: string[];
}): TransferPreview {
  const {
    request,
    seasonStartDate,
    initialTeamId,
    existingTransfers,
    seasonRoster,
    registeredTeamIds,
  } = input;

  validateTransferRequest(request);

  if (!registeredTeamIds.includes(request.fromTeamId) ||
      !registeredTeamIds.includes(request.toTeamId)) {
    throw new Error("Entrambe le squadre devono essere iscritte alla stagione.");
  }

  const currentEntry = seasonRoster.find(
    entry => entry.playerId === request.playerId && entry.status === "active",
  );
  if (!currentEntry) {
    throw new Error("Il giocatore deve appartenere a una rosa attiva.");
  }
  if (currentEntry.teamId !== request.fromTeamId) {
    throw new Error("La squadra di provenienza non coincide con la rosa attuale.");
  }

  const historyForPlayer = existingTransfers.filter(t => t.playerId === request.playerId);
  if (historyForPlayer.some(t => t.effectiveDate >= request.effectiveDate)) {
    throw new Error("Il trasferimento deve essere successivo agli altri trasferimenti del giocatore.");
  }

  const projected: RecordedTransfer = {
    ...request,
    seasonId: existingTransfers[0]?.seasonId ?? "preview",
    id: "preview",
  };

  const membershipPeriods = buildMembershipPeriods({
    playerId: request.playerId,
    initialTeamId,
    seasonStartDate,
    transfers: [...historyForPlayer, projected],
  });

  return {
    request,
    previousTeamId: request.fromTeamId,
    nextTeamId: request.toTeamId,
    membershipPeriods,
  };
}
