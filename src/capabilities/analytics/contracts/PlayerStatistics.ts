export type StatsMatchReference = {
  id: string | number;
  seasonId: string | number;
  homeTeamId: string | number;
  awayTeamId: string | number;
};

export type StatsReportReference = {
  matchId: string;

  status:
    | "draft"
    | "published";

  data: {
    homePresentPlayerIds:
      string[];

    awayPresentPlayerIds:
      string[];

    performances:
      Record<
        string,
        {
          playerId: string;

          teamId:
            | string
            | number;

          status:
            | "rated"
            | "sv";

          vote?: number;

          goals: number;
          assists: number;

          yellowCards: number;
          redCards: number;

          directRedCards?: number;

          goalsConceded?: number;
        }
      >;

    mvpPlayerId?: string;
  };
};

export type PlayerSeasonStatistics = {
  playerId: string;
  teamId: string;

  goals: number;
  assists: number;
  mvp: number;
  appearances: number;

  averageRating: number;

  yellowCards: number;
  redCards: number;

  cleanSheetCount: number;
  goalsConceded: number;

  ratingVariation: number;
};