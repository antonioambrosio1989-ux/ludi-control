export type MatchweekAwardsStatus =
  | "draft"
  | "published";

export type MatchweekAwardsPlayerSnapshot = {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  role: string;
};

export type MatchweekAwardsLineup = {
  goalkeeperPlayerId?: string;
  defenderPlayerIds: string[];
  forwardPlayerIds: string[];

  /**
   * Se presente, rappresenta i quattro giocatori di movimento
   * realmente selezionati dall'Admin. Può contenere qualsiasi
   * combinazione di difensori e attaccanti.
   *
   * defenderPlayerIds / forwardPlayerIds restano valorizzati
   * per compatibilità con i dati storici.
   */
  outfieldPlayerIds?: string[];
};

export type MatchweekAwardsPublication = {
  id: string;

  seasonId: string;
  matchweek: number;

  suggestedMvpPlayerId?: string;
  confirmedMvpPlayerId?: string;
  confirmedMvpPlayer?: MatchweekAwardsPlayerSnapshot;

  suggestedLineup:
    MatchweekAwardsLineup;

  confirmedLineup:
    MatchweekAwardsLineup;

  /**
   * Snapshot storico dei 5 giocatori realmente scelti.
   * Conserva nome, squadra e ruolo oltre al playerId così
   * da poter costruire statistiche storiche in futuro.
   */
  confirmedTeamOfWeekPlayers:
    MatchweekAwardsPlayerSnapshot[];

  topFiveConfirmed?: boolean;
  playerOfTheWeekConfirmed?: boolean;
  topFiveImageUrl?: string;
  topFiveImageKey?: string;
  playerOfTheWeekImageUrl?: string;
  playerOfTheWeekImageKey?: string;

  /** Goal of the Week remains optional and is resolved from Instagram. */
  ludiWeekPublished?: boolean;
  ludiWeekInstagramPostIds?: { gotw?: string };

  status: MatchweekAwardsStatus;

  createdAt?: unknown;
  updatedAt?: unknown;
};

export type SaveMatchweekAwardsInput = {
  seasonId: string;
  matchweek: number;

  suggestedMvpPlayerId?: string;
  confirmedMvpPlayerId?: string;
  confirmedMvpPlayer?: MatchweekAwardsPlayerSnapshot;

  suggestedLineup:
    MatchweekAwardsLineup;

  confirmedLineup:
    MatchweekAwardsLineup;

  confirmedTeamOfWeekPlayers:
    MatchweekAwardsPlayerSnapshot[];

  topFiveConfirmed?: boolean;
  playerOfTheWeekConfirmed?: boolean;
  topFiveImageUrl?: string;
  topFiveImageKey?: string;
  playerOfTheWeekImageUrl?: string;
  playerOfTheWeekImageKey?: string;

  /** Goal of the Week remains optional and is resolved from Instagram. */
  ludiWeekPublished?: boolean;
  ludiWeekInstagramPostIds?: { gotw?: string };

  status: MatchweekAwardsStatus;
};
