import {
  createHash,
} from "node:crypto";

export const PERFECT_TICKET_NOTIFICATION_TYPE =
  "ludi_bet_perfect_ticket";

export type PerfectTicketNotificationCandidate = {
  gameId:
    string;
  seasonId:
    string;
  matchweek:
    number;
  userId:
    string;
};

export function perfectTicketNotificationId(
  candidate:
    PerfectTicketNotificationCandidate,
): string {
  return createHash(
    "sha256",
  )
    .update(
      [
        PERFECT_TICKET_NOTIFICATION_TYPE,
        candidate.gameId,
        candidate.seasonId,
        `mw${candidate.matchweek}`,
        candidate.userId,
      ].join(
        ":",
      ),
    )
    .digest(
      "hex",
    );
}

export function buildPerfectTicketNotification({
  candidate,
  displayName,
}: {
  candidate:
    PerfectTicketNotificationCandidate;
  displayName:
    string;
}) {
  return {
    type:
      PERFECT_TICKET_NOTIFICATION_TYPE,
    title:
      "Ludi Bet Club",
    message:
      `${displayName} ha vinto la schedina di questa settimana`,
    userId:
      candidate.userId,
    displayName,
    gameId:
      candidate.gameId,
    seasonId:
      candidate.seasonId,
    matchweek:
      candidate.matchweek,
    read:
      false,
  } as const;
}
