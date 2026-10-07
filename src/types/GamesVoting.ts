import type {
  FutCardResolution,
} from "@/src/application/fut/FutCardResolver";

export type VotingStatus =
  | "planned"
  | "setup"
  | "ready"
  | "published"
  | "closed"
  | "archived";

export type VotingType =
  | "build_xi"
  | "best_of_the_month"
  | "score_prediction"
  | "man_of_the_match"
  | "ceremony_award";

export const VOTING_TYPE_LABELS: Record<VotingType, string> = {
  build_xi: "Build XI",
  best_of_the_month: "Best Of The Month",
  score_prediction: "Score Prediction",
  man_of_the_match: "Man Of The Match",
  ceremony_award: "Ceremony Awards",
};

export type BuildXiRole =
  | "goalkeeper"
  | "defender"
  | "midfielder"
  | "forward";

export type VotingCandidate = {
  id: string;
  label: string;
  description?: string;
  imageUrl?: string;
  playerId?: string;
  teamId?: string;
  teamName?: string;
};

export type BestOfMonthAwardKey =
  | "player_of_the_month"
  | "goal_of_the_month"
  | "save_of_the_month";

export const BEST_OF_MONTH_AWARD_LABELS: Record<BestOfMonthAwardKey, string> = {
  player_of_the_month: "Player Of The Month",
  goal_of_the_month: "Goal Of The Month",
  save_of_the_month: "Save Of The Month",
};


export type BestOfMonthDecisionStatus =
  | "pending"
  | "finalized";

export type BestOfMonthPollResult = {
  topCandidateIds: string[];
  isTie: boolean;
  resolvedWinnerId?: string;
  winnerId?: string;
};

export type BestOfMonthAwardDecision = {
  awardKey: BestOfMonthAwardKey;
  pollResult: BestOfMonthPollResult;
  refereeCandidateId: string;
  organizer1CandidateId: string;
  organizer2CandidateId: string;
  pointsByCandidateId: Record<string, number>;
  winnerCandidateId: string;
  winnerPlayerId: string;
  tieBreak: "public_poll" | null;
  status: BestOfMonthDecisionStatus;
  finalizedAtMs?: number;
};

export type BestOfMonthPublicWinner = {
  awardKey: BestOfMonthAwardKey;
  candidate: VotingCandidate;
  playerId: string;
  finalizedAtMs?: number;
};

export type BestOfMonthAwardConfig = {
  key: BestOfMonthAwardKey;
  title: string;
  candidates: VotingCandidate[];
};

export type BestOfMonthConfig = {
  monthKey: string;
  monthLabel: string;
  opensAtMs: number;
  closesAtMs: number;
  awards: Record<BestOfMonthAwardKey, BestOfMonthAwardConfig>;
};

export type VotingMatchOption = {
  id: string;
  seasonId: string;
  competitionId: string;
  competitionName: string;
  date: string;
  time: string;
  kickoffAtMs: number;
  homeTeamId: string;
  homeTeamName: string;
  homeTeamLogoUrl?: string;
  awayTeamId: string;
  awayTeamName: string;
  awayTeamLogoUrl?: string;
  label: string;
  isUpcoming: boolean;
};

export type ScorePredictionConfig = {
  match: VotingMatchOption;
  posterImageUrl?: string;
  scorerOptions: VotingCandidate[];
};

export type ManOfTheMatchConfig = {
  match: VotingMatchOption;
  candidates: VotingCandidate[];
};

export type CeremonyAwardConfig = {
  awardName: string;
  candidates: VotingCandidate[];
};

export type GamesVotingPoll = {
  id: string;
  gameId: string;
  title: string;
  description?: string;
  type: VotingType;
  competitionId: string;
  competitionName: string;
  competitionIds?: string[];
  competitionNames?: string[];
  seasonId: string;
  seasonName: string;
  status: VotingStatus;
  displayOrder: number;

  /* BUILD XI */
  candidateCount: number;
  roleCounts: Record<BuildXiRole, number>;
  eligibilityRate: number;

  /* BEST OF THE MONTH */
  bestOfMonth?: BestOfMonthConfig;

  /* DECISIONI BEST OF THE MONTH */
  bestOfMonthDecisions?: Partial<Record<BestOfMonthAwardKey, BestOfMonthAwardDecision>>;

  /* SCORE PREDICTION */
  scorePrediction?: ScorePredictionConfig;

  /* MAN OF THE MATCH */
  manOfTheMatch?: ManOfTheMatchConfig;

  /* CEREMONY AWARDS */
  ceremonyAward?: CeremonyAwardConfig;

  createdAt?: unknown;
  publishedAt?: unknown;
  closedAt?: unknown;
};

export type BuildXiCandidate = {
  playerId: string;
  seasonPlayerId: string;
  teamId: string;
  playerName: string;
  teamName: string;
  originalRole: string;
  buildXiRole: BuildXiRole;
  appearances: number;
  availableTeamMatches: number;
  appearanceRate: number;
  photoUrl?: string;

  /*
   * Snapshot FUT congelato insieme ai candidati BUILD XI.
   * In questo modo la votazione mostra la stessa card anche se
   * rating/premi cambiano dopo la pubblicazione.
   */
  futRating?: number;
  futCard?: FutCardResolution;
  teamLogoUrl?: string;
  competitionName?: string;
  competitionLogoUrl?: string;
};

export type BuildXiLineup = {
  goalkeeperId: string;
  defenderIds: [string, string, string];
  midfielderIds: [string, string, string, string];
  forwardIds: [string, string, string];
};

export type BuildXiSubmission = {
  votingId: string;
  userId: string;
  gameId: string;
  competitionId: string;
  type: "build_xi";
  lineup: BuildXiLineup;
  locked: true;
  submittedAt?: unknown;
};

export type BestOfMonthSubmission = {
  votingId: string;
  userId: string;
  gameId: string;
  type: "best_of_the_month";
  awardKey: BestOfMonthAwardKey;
  optionId: string;
  locked: true;
  submittedAt?: unknown;
};

export type ScorePredictionSubmission = {
  votingId: string;
  userId: string;
  gameId: string;
  type: "score_prediction";
  homeScore: number;
  awayScore: number;
  topScorerPlayerId: string | null;
  locked: true;
  submittedAt?: unknown;
};

export type SingleChoiceVotingSubmission = {
  votingId: string;
  userId: string;
  gameId: string;
  type: "man_of_the_match" | "ceremony_award";
  optionId: string;
  locked: true;
  submittedAt?: unknown;
};

export type GamesVotingSubmission =
  | BuildXiSubmission
  | BestOfMonthSubmission
  | ScorePredictionSubmission
  | SingleChoiceVotingSubmission;

export type RankedVotingCandidate = VotingCandidate & {
  votes: number;
  percentage: number;
};


export type VotingResultUser = {
  userId: string;
  displayName: string;
};

export type ScorePredictionAdminResult = {
  status: "pending" | "completed";
  matchId: string;
  matchLabel: string;
  actualHomeScore?: number;
  actualAwayScore?: number;
  topScorerPlayerIds: string[];
  topScorers: VotingCandidate[];
  exactScoreWinners: VotingResultUser[];
  topScorerWinners: VotingResultUser[];
  perfectWinners: VotingResultUser[];
};

export type ScorePredictionPublicResult = {
  status: "pending" | "completed";
  matchId: string;
  matchLabel: string;
  actualHomeScore?: number;
  actualAwayScore?: number;
  topScorers: VotingCandidate[];
  exactScoreWinnerCount: number;
  topScorerWinnerCount: number;
  perfectWinnerCount: number;
  ownResult?: {
    exactScore: boolean;
    topScorer: boolean;
    perfect: boolean;
  };
};

export type BuildXiRankedCandidate = {
  playerId: string;
  playerName: string;
  teamName: string;
  role: BuildXiRole;
  votes: number;
  percentage: number;
  rank: number;
  isFinalSelection: boolean;
  isAdminSelection: boolean;
  tiedAtCutoff: boolean;
};

export type BuildXiTieBreak = {
  role: BuildXiRole;
  candidateIds: string[];
  requiredSelections: number;
  selectedPlayerIds: string[];
  resolved: boolean;
};

export type BuildXiTieBreakDecisions =
  Partial<
    Record<
      BuildXiRole,
      string[]
    >
  >;

export type BuildXiVotingResult = {
  byRole: Record<
    BuildXiRole,
    BuildXiRankedCandidate[]
  >;
  finalLineup?: BuildXiLineup;
  tieRoles: BuildXiRole[];
  tieBreaks: Partial<
    Record<
      BuildXiRole,
      BuildXiTieBreak
    >
  >;
  invalidSubmissionCount: number;
};

export type ManOfTheMatchAdminResult = {
  winnerCandidateIds: string[];
  isTie: boolean;
  winners: RankedVotingCandidate[];
};

export type CeremonyAwardAdminResult = {
  winnerCandidateIds: string[];
  isTie: boolean;
  winners: RankedVotingCandidate[];
};

export type CeremonyAwardPublicResult = {
  status: "completed";
  awardName: string;
  totalVotes: number;
  ranking: RankedVotingCandidate[];
  winnerCandidateIds: string[];
  isTie: boolean;
  winners: RankedVotingCandidate[];
  ownVoteCandidateId?: string;
};

export type ManOfTheMatchPublicResult = {
  status: "completed";
  totalVotes: number;
  ranking: RankedVotingCandidate[];
  winnerCandidateIds: string[];
  isTie: boolean;
  winners: RankedVotingCandidate[];
  ownVoteCandidateId?: string;
};

export type VotingAdminResults = {
  submissionCount: number;
  buildXi?: BuildXiVotingResult;
  awards?: Partial<Record<BestOfMonthAwardKey, RankedVotingCandidate[]>>;
  choices?: RankedVotingCandidate[];
  scorePrediction?: ScorePredictionAdminResult;
  manOfTheMatch?: ManOfTheMatchAdminResult;
  ceremonyAward?: CeremonyAwardAdminResult;
};

export const BUILD_XI_ROLE_LABELS: Record<BuildXiRole, string> = {
  goalkeeper: "Portiere",
  defender: "Difensore",
  midfielder: "Centrocampista",
  forward: "Attaccante",
};

export const BUILD_XI_REQUIRED_ROLE_COUNTS: Record<BuildXiRole, number> = {
  goalkeeper: 1,
  defender: 3,
  midfielder: 4,
  forward: 3,
};
