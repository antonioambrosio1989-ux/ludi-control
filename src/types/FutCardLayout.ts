export type FutCardElementKey =
  | "rating"
  | "role"
  | "photo"
  | "name"
  | "nationality"
  | "competitionLogo"
  | "teamLogo";

export type FutCardElementLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
};

export type FutCardLayout = {
  elements: Record<
    FutCardElementKey,
    FutCardElementLayout
  >;
  updatedAt?: unknown;
};
