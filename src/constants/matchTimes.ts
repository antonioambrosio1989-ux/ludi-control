export const MATCH_TIMES = [
  "20:30",
  "21:00",
  "21:30",
  "22:00",
  "22:30",
] as const;

export type MatchTime =
  (typeof MATCH_TIMES)[number];

export function isMatchTime(
  value: string,
): value is MatchTime {
  return MATCH_TIMES.some(
    (time) => time === value,
  );
}
