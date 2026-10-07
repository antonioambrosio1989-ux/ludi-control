export type BestOfTheMonthStatus =
  | "draft"
  | "published";

export type BestOfTheMonthItem = {
  id:
    string;

  seasonId:
    string;

  competitionId:
    string;

  month:
    string;

  title?:
    string;

  imageUrl:
    string;

  imageKey?:
    string;

  order:
    number;

  status:
    BestOfTheMonthStatus;

  createdAt?:
    unknown;

  updatedAt?:
    unknown;

  publishedAt?:
    unknown;
};
