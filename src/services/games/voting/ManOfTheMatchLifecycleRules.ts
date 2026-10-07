import type {
  VotingMatchOption,
} from "@/src/types/GamesVoting";

export function assertManOfTheMatchMatchIdentity({
  stored,
  current,
}: {
  stored:
    VotingMatchOption;
  current:
    VotingMatchOption;
}): void {
  /*
   * Data e orario possono essere modificati: il MOTM resta collegato
   * alla stessa partita. Non consentiamo invece di riutilizzare la
   * configurazione se cambia l'identità sportiva del match.
   */
  if (
    stored.id !==
      current.id ||
    stored.seasonId !==
      current.seasonId ||
    stored.competitionId !==
      current.competitionId ||
    stored.homeTeamId !==
      current.homeTeamId ||
    stored.awayTeamId !==
      current.awayTeamId
  ) {
    throw new Error(
      "MOTM_MATCH_CHANGED",
    );
  }
}
