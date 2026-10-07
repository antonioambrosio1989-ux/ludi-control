export type GamesProfileSummary = {
  displayName: string;
  points: number;
  level: number;
  levelStartPoints: number;
  nextLevelPoints: number;
  levelProgressPercent: number;
  position: number | null;
  participants: number;
};

export type GamesProfileResponse = {
  profile: GamesProfileSummary;
};
