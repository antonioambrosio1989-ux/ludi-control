export type MvpCarouselEntry = {
  playerId: string;
  matchId: string;

  firstName: string;
  lastName: string;

  photoUrl?: string;

  /*
   * Ludi Rating attuale.
   */
  rating?: number;

  homeTeamName: string;
  awayTeamName: string;

  homeTeamLogoUrl?: string;
  awayTeamLogoUrl?: string;

  homeScore: number;
  awayScore: number;

  matchweek: number;
};
