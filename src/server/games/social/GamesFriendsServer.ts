import "server-only";
import { randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/src/lib/firebaseAdmin";
import { getGamesSeasonScores } from "@/src/server/games/profile/GamesProfileServer";
import {
  buildFriendLeaderboard,
  normalizeFriendGroupName,
} from "./FriendLeaderboard";
type Member = { displayName: string };
type Group = {
  name: string;
  seasonId: string;
  ownerId: string;
  members: Record<string, Member>;
};
const indexRef = (uid: string, season: string) =>
  adminDb.collection("gamesFriendMemberships").doc(`${uid}__${season}`);
const groupRef = (id: string) =>
  adminDb.collection("gamesFriendGroups").doc(id);
export async function listFriendGroups(uid: string, season: string) {
  const index = await indexRef(uid, season).get();
  const ids = (index.data()?.groupIds ?? []) as string[];
  const groups = await Promise.all(
    ids.slice(0, 5).map((id) => groupRef(id).get()),
  );
  return groups
    .filter(
      (doc) =>
        doc.exists &&
        doc.data()?.seasonId === season &&
        Object.hasOwn(doc.data()?.members ?? {}, uid),
    )
    .map((doc) => ({
      id: doc.id,
      name: doc.data()!.name,
      members: Object.keys(doc.data()!.members).length,
    }));
}
export async function getFriendGroup(uid: string, season: string, id: string) {
  const snapshot = await groupRef(id).get();
  const group = snapshot.data() as Group | undefined;
  if (!group || group.seasonId !== season || !Object.hasOwn(group.members, uid))
    throw new Error("GROUP_NOT_AVAILABLE");
  return {
    id,
    name: group.name,
    isOwner: group.ownerId === uid,
    entries: buildFriendLeaderboard(
      group.members,
      new Map(await getGamesSeasonScores(season)),
      uid,
    ),
  };
}
export async function mutateFriendGroup({
  uid,
  season,
  action,
  name,
  id,
}: {
  uid: string;
  season: string;
  action: string;
  name?: unknown;
  id?: string;
}) {
  if (!["create", "join", "leave"].includes(action))
    throw new Error("INVALID_ACTION");
  if (action !== "create" && (!id || !/^[a-f0-9]{16}$/.test(id)))
    throw new Error("GROUP_NOT_AVAILABLE");
  const groupId = action === "create" ? randomBytes(8).toString("hex") : id!;
  const profile = await adminDb.collection("users").doc(uid).get();
  const displayName = String(
    profile.data()?.displayName ?? "Partecipante",
  ).slice(0, 40);
  const validName = action === "create" ? normalizeFriendGroupName(name) : null;
  await adminDb.runTransaction(async (transaction) => {
    const [groupSnapshot, indexSnapshot] = await Promise.all([
      transaction.get(groupRef(groupId)),
      transaction.get(indexRef(uid, season)),
    ]);
    const group = groupSnapshot.data() as Group | undefined;
    const groupIds = (indexSnapshot.data()?.groupIds ?? []) as string[];
    if (action === "create") {
      if (groupIds.length >= 5) throw new Error("GROUP_LIMIT");
      transaction.create(groupRef(groupId), {
        name: validName,
        seasonId: season,
        ownerId: uid,
        members: { [uid]: { displayName } },
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.set(indexRef(uid, season), {
        groupIds: [...groupIds, groupId],
      });
      return;
    }
    if (!group || group.seasonId !== season)
      throw new Error("GROUP_NOT_AVAILABLE");
    if (action === "join") {
      if (Object.hasOwn(group.members, uid)) return;
      if (groupIds.length >= 5) throw new Error("GROUP_LIMIT");
      if (Object.keys(group.members).length >= 50)
        throw new Error("GROUP_FULL");
      transaction.update(groupRef(groupId), {
        members: { ...group.members, [uid]: { displayName } },
      });
      transaction.set(indexRef(uid, season), {
        groupIds: [...groupIds, groupId],
      });
    } else {
      if (!Object.hasOwn(group.members, uid))
        throw new Error("GROUP_NOT_AVAILABLE");
      const members = { ...group.members };
      delete members[uid];
      const remaining = Object.keys(members);
      if (remaining.length)
        transaction.update(groupRef(groupId), {
          members,
          ownerId: group.ownerId === uid ? remaining[0] : group.ownerId,
        });
      else transaction.delete(groupRef(groupId));
      transaction.set(indexRef(uid, season), {
        groupIds: groupIds.filter((value) => value !== groupId),
      });
    }
  });
  return groupId;
}
