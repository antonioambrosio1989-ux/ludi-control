export type PlayerAchievementCompetition =
  | "regularSeason"
  | "championsLeague";

export type PlayerAchievement = {
  id: string;

  seasonId: string;
  seasonLabel: string;

  competitionId: string;
  competition:
    PlayerAchievementCompetition;

  title:
    string;

  teamId:
    string;

  teamName:
    string;

  createdAt?:
    unknown;
};