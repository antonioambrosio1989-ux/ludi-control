import { buildPublicationNewsFeed } from "@/src/domain/news/PublicationNewsFeed";
import { FirebaseMatchweekAwardsRepository } from "@/src/services/matchweek/FirebaseMatchweekAwardsRepository";
import { FirebaseOfficialCommunicationRepository } from "@/src/services/discipline/FirebaseOfficialCommunicationRepository";
import { FirebaseMatchRepository } from "@/src/services/match/FirebaseMatchRepository";
import { FirebaseMatchReportRepository, type CloudMatchReport } from "@/src/services/match/FirebaseMatchReportRepository";
import type { MatchweekAwardsPublication } from "@/src/types/MatchweekAwardsPublication";
import type { OfficialCommunication } from "@/src/types/OfficialCommunication";
import type { Match } from "@/src/types/Match";
import { isEditorialNews, validateEditorialNews } from "@/src/domain/news/EditorialNews";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";

import type {
  CreateNewsItemInput,
  NewsItem,
  UpdateNewsItemInput,
} from "@/src/types/NewsItem";

const COLLECTION_NAME = "news";

type FirestoreDocument = {
  id: string;
  data: () => Record<string, unknown>;
};

function mapDocument(
  document: FirestoreDocument,
): NewsItem {
  const data = document.data();

  return {
    id: document.id,

    seasonId: String(
      data.seasonId ?? "",
    ),

    matchweek:
  typeof data.matchweek ===
    "number"
    ? data.matchweek
    : undefined,

    newsType: ["risultato", "intervista", "calciomercato", "news"].includes(String(data.newsType)) ? data.newsType as NewsItem["newsType"] : undefined,
    editorial: data.editorial === true,
    matchPhase: data.matchPhase === "finalStage" ? "finalStage" : data.matchPhase === "regularSeason" ? "regularSeason" : undefined,
    matchId: typeof data.matchId === "string" ? data.matchId : undefined,
    teamId: typeof data.teamId === "string" ? data.teamId : undefined,
    category: String(
      data.category ?? "LUDI NEWS",
    ),

    content: String(
      data.content ?? "",
    ),

    badgeLabel: typeof data.badgeLabel ===
      "string"
        ? data.badgeLabel
        : undefined,

    coverUrl:
      typeof data.coverUrl === "string"
        ? data.coverUrl
        : undefined,

    coverKey:
      typeof data.coverKey === "string"
        ? data.coverKey
        : undefined,

    linkUrl:
      typeof data.linkUrl === "string"
        ? data.linkUrl
        : undefined,

    status:
      data.status === "published"
        ? "published"
        : "draft",

    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    publishedAt: data.publishedAt,
  };
}

function getTimestampValue(
  value: unknown,
): number {
  if (typeof value === "string") return Date.parse(value) || 0;
  if (value instanceof Date) return value.getTime();
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }

  return 0;
}

function sortByLatest(
  items: NewsItem[],
): NewsItem[] {
  return items
    .slice()
    .sort((first, second) => {
      const firstDate =
        getTimestampValue(
          first.publishedAt,
        ) ||
        getTimestampValue(
          first.createdAt,
        );

      const secondDate =
        getTimestampValue(
          second.publishedAt,
        ) ||
        getTimestampValue(
          second.createdAt,
        );

      return secondDate - firstDate;
    });
}

export const FirebaseNewsRepository = {
  subscribePublishedBySeason(
    seasonId: string,
    onChange: (
      items: NewsItem[],
    ) => void,
    onError?: (
      error: Error,
    ) => void,
  ): Unsubscribe {
    const newsQuery = query(
      collection(
        db,
        COLLECTION_NAME,
      ),
      where(
        "seasonId",
        "==",
        seasonId,
      ),
      where(
        "status",
        "==",
        "published",
      ),
    );

    let active = true;
    let editorial: NewsItem[] = [];
    let publications: MatchweekAwardsPublication[] = [];
    let communications: OfficialCommunication[] = [];
    let matches: Match[] = [];
    let reports: CloudMatchReport[] = [];
    const emit = () => {
      if (active) onChange(sortByLatest([...editorial, ...buildPublicationNewsFeed({ seasonId, publications, communications, matches, reports })]));
    };
    const fail = (clear: () => void) => (error: Error) => {
      if (!active) return;
      clear(); emit(); onError?.(error);
    };
    const unsubscribers = [
      onSnapshot(newsQuery, (snapshot) => {
        editorial = snapshot.docs.map(mapDocument).filter(isEditorialNews);
        emit();
      }, fail(() => { editorial = []; })),
      FirebaseMatchweekAwardsRepository.subscribePublishedBySeason(seasonId, (items) => { publications = items; emit(); }, fail(() => { publications = []; }), true),
      FirebaseOfficialCommunicationRepository.subscribePublishedBySeason(seasonId, (items) => { communications = items; emit(); }, fail(() => { communications = []; })),
      FirebaseMatchRepository.subscribePublishedBySeason(seasonId, (items) => { matches = items; emit(); }, fail(() => { matches = []; })),
      FirebaseMatchReportRepository.subscribePublishedBySeason(seasonId, (items) => { reports = items; emit(); }, fail(() => { reports = []; })),
    ];
    return () => { active = false; unsubscribers.forEach((unsubscribe) => unsubscribe()); };
  },

  subscribeAllBySeason(
    seasonId: string,
    onChange: (
      items: NewsItem[],
    ) => void,
    onError?: (
      error: Error,
    ) => void,
  ): Unsubscribe {
    const newsQuery = query(
      collection(
        db,
        COLLECTION_NAME,
      ),
      where(
        "seasonId",
        "==",
        seasonId,
      ),
    );

    return onSnapshot(
      newsQuery,

      (snapshot) => {
        const items =
          snapshot.docs.map(
            mapDocument,
          );

        onChange(
          sortByLatest(items),
        );
      },

      (error) => {
        console.error(
          "Errore listener admin news:",
          error,
        );

        onError?.(error);
      },
    );
  },

  async create(
    input: CreateNewsItemInput,
  ): Promise<string> {
    validateEditorialNews(input);
    const reference = await addDoc(
      collection(
        db,
        COLLECTION_NAME,
      ),
      {
        editorial: true,
        newsType: input.newsType,
        matchId: input.matchId ?? null,
        matchPhase: input.matchPhase ?? null,
        teamId: input.teamId ?? null,
        seasonId:
          input.seasonId,

        matchweek:
          input.matchweek ?? null,

        category:
          input.newsType,

        badgeLabel:
          input.badgeLabel ?? null,

        content:
          input.content,

        coverUrl:
          input.coverUrl ?? null,

        coverKey:
          input.coverKey ?? null,

        linkUrl:
          input.linkUrl ?? null,

        status:
          input.status,

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp(),

        publishedAt:
          input.status ===
          "published"
            ? serverTimestamp()
            : null,
      },
    );

    return reference.id;
  },

  async update(
    input: UpdateNewsItemInput,
  ): Promise<void> {
    validateEditorialNews(input);
    const {
      itemId,
      ...data
    } = input;

    const reference = doc(db, COLLECTION_NAME, itemId);
    const existing = await getDoc(reference);
    if (!existing.exists()) throw new Error("La news da modificare non esiste.");
    // The first publication date stays fixed across edits and withdrawals.
    const publishForFirstTime = data.status === "published" && !existing.data().publishedAt;

    await updateDoc(
      doc(
        db,
        COLLECTION_NAME,
        itemId,
      ),
      {
        ...data,
        category: data.newsType,
        editorial: true,
        matchId: data.matchId ?? null,
        matchPhase: data.matchPhase ?? null,
        teamId: data.teamId ?? null,

        coverUrl:
          data.coverUrl ?? null,

        coverKey:
          data.coverKey ?? null,

        badgeLabel:
          data.badgeLabel ?? null,

        linkUrl:
          data.linkUrl ?? null,

        updatedAt:
          serverTimestamp(),

        ...(publishForFirstTime ? { publishedAt: serverTimestamp() } : {}),
      },
    );
  },

  async getPublishedById(
  itemId: string,
): Promise<NewsItem | null> {
  const snapshot = await getDoc(
    doc(
      db,
      COLLECTION_NAME,
      itemId,
    ),
  );

  if (!snapshot.exists()) {
    return null;
  }

  const item = mapDocument(snapshot);

  if (item.status !== "published" || !isEditorialNews(item)) {
    return null;
  }

  return item;
},

  async setStatus(itemId: string, status: "draft"): Promise<void> {
    await updateDoc(doc(db, COLLECTION_NAME, itemId), { status, updatedAt: serverTimestamp() });
  },

  async remove(
    itemId: string,
  ): Promise<void> {
    await deleteDoc(
      doc(
        db,
        COLLECTION_NAME,
        itemId,
      ),
    );
  },
};