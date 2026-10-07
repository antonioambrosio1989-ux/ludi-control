export type GamesAccessCodeStatus =
  | "available"
  | "redeemed"
  | "disabled";

export type GamesAccessCodeType =
  | "president";

export type GamesAccessCode = {
  id:
    string;

  gamesSeasonId:
    string;

  type:
    GamesAccessCodeType;

  label:
    string;

  status:
    GamesAccessCodeStatus;

  codeHash:
    string;

  redeemedByUserId?:
    string;

  redeemedAt?:
    unknown;

  createdAt?:
    unknown;

  updatedAt?:
    unknown;
};

export type CreateGamesAccessCodeInput = {
  gamesSeasonId:
    string;

  type:
    GamesAccessCodeType;

  label:
    string;
};