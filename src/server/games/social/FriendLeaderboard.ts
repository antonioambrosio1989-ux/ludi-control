import { resolveGamesLevel } from "@/src/services/games/GamesProfileProgression";
export function buildFriendLeaderboard(
  members: Record<string, { displayName: string }>,
  pointsByUser: Map<string, number>,
  viewerId: string,
) {
  const ranked = Object.entries(members)
    .map(([uid, member]) => ({
      uid,
      displayName: member.displayName,
      ...resolveGamesLevel(pointsByUser.get(uid) ?? 0),
    }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        a.displayName.localeCompare(b.displayName, "it") ||
        a.uid.localeCompare(b.uid),
    );
  return ranked.map((entry) => ({
    displayName: entry.displayName,
    points: entry.points,
    level: entry.level,
    position: ranked.findIndex((other) => other.points === entry.points) + 1,
    isYou: entry.uid === viewerId,
  }));
}
export function normalizeFriendGroupName(value: unknown) {
  if (typeof value !== "string") throw new Error("INVALID_NAME");
  const name = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  if (name.length < 3 || name.length > 40) throw new Error("INVALID_NAME");
  return name;
}
