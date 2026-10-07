export type HistoricalPlayerSeasonStats = {
  id: string;

  seasonId: string;
  seasonName: string;

  competitionId: string;

  playerId: string;

  teamId?: string;
  teamName?: string;

  appearances: number;

  goals: number;
  assists: number;
  ownGoals: number;

  averageVote?: number;

  yellowCards: number;
  redCards: number;

  createdAt?: unknown;
  updatedAt?: unknown;
};

export type HistoricalPlayerSeasonStatsInput = {
  seasonId: string;
  seasonName: string;

  competitionId: string;

  playerId: string;

  teamId?: string;
  teamName?: string;

  appearances: number;

  goals: number;
  assists?: number;
  ownGoals?: number;

  averageVote?: number;

  yellowCards?: number;
  redCards?: number;
};