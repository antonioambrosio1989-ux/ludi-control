import { NextRequest, NextResponse } from "next/server";

type InstagramApiMedia = {
  id: string;
  caption?: string;
  media_type:
    | "IMAGE"
    | "VIDEO"
    | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp?: string;
};

type InstagramApiResponse = {
  data?: InstagramApiMedia[];
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
};

export type InstagramPost = {
  id: string;
  caption: string;
  mediaType:
    | "IMAGE"
    | "VIDEO"
    | "CAROUSEL_ALBUM";
  imageUrl: string;
  permalink: string;
  timestamp?: string;
  videoUrl?: string;
};

export type LudiTvCategory =
  | "interviews"
  | "podcast"
  | "celebrations"
  | "goalOfTheDay"
  | "highlights";

export type LudiTvPost =
  InstagramPost & {
    category:
      LudiTvCategory;
  };

function extractHashtags(
  caption: string,
): string[] {
  const matches =
    caption
      .toLowerCase()
      .match(
        /#[\p{L}\p{N}_]+/gu,
      );

  return matches ?? [];
}

function mapInstagramPost(
  media: InstagramApiMedia,
): InstagramPost {
  const imageUrl =
    media.media_type ===
    "VIDEO"
      ? media.thumbnail_url ??
        ""
      : media.media_url ??
        "";

  return {
    id:
      media.id,

    caption:
      media.caption ??
      "",

    mediaType:
      media.media_type,

    imageUrl,

    videoUrl:
      media.media_type ===
      "VIDEO"
        ? media.media_url
        : undefined,

    permalink:
      media.permalink,

    timestamp:
      media.timestamp,
  };
}

function getLudiTvCategory(
  hashtags: string[],
): LudiTvCategory | null {
  if (
    hashtags.includes(
      "#intervista",
    ) ||
    hashtags.includes(
      "#interviste",
    )
  ) {
    return "interviews";
  }

  if (
    hashtags.includes(
      "#podcast",
    )
  ) {
    return "podcast";
  }

  if (
    hashtags.includes(
      "#celebration",
    ) ||
    hashtags.includes(
      "#celebrations",
    )
  ) {
    return "celebrations";
  }

  if (
    hashtags.includes(
      "#gotd",
    ) ||
    hashtags.includes(
      "#goaloftheday",
    )
  ) {
    return "goalOfTheDay";
  }

  if (
    hashtags.includes(
      "#highlights",
    ) ||
    hashtags.includes(
      "#highlight",
    )
  ) {
    return "highlights";
  }

  return null;
}

function getCompetitionHashtag(
  competitionId: string | null,
): string {
  switch (
    competitionId
  ) {
    case "championship":
      return "#ludichampionship";

    case "league-one":
      return "#ludileagueone";

    case "premier-league":
    default:
      return "#ludipremierleague";
  }
}

function getFeatureHashtagPrefix(
  type: string | null,
): string | null {
  if (type === "gotw") {
    return "#gotw";
  }

  if (type === "totw") {
    return "#totw";
  }

  if (type === "potw") {
    return "#potw";
  }

  return null;
}

export async function GET(
  request: NextRequest,
) {
  const accessToken =
    process.env.INSTAGRAM_ACCESS_TOKEN
      ?.trim();

  /*
   * L'ID dell'account Instagram Business non è un segreto.
   * Manteniamo comunque la variabile d'ambiente come priorità,
   * ma usiamo l'account Ludi come fallback per evitare che un
   * deployment senza INSTAGRAM_USER_ID venga considerato
   * completamente non configurato.
   */
  const instagramUserId =
    process.env.INSTAGRAM_USER_ID
      ?.trim() ||
    "17841401339772801";

  if (
    !accessToken
  ) {
    console.error(
      "[Instagram] INSTAGRAM_ACCESS_TOKEN assente nel deployment corrente.",
    );

    return NextResponse.json(
      {
        posts: [],
        post: null,
        error:
          "Instagram non configurato sul deployment.",
      },
      {
        status: 503,
      },
    );
  }

  const searchParams =
    request.nextUrl.searchParams;

  const type =
    searchParams.get("type");

  const matchweekParam =
  searchParams.get("matchweek");

const competitionId =
  searchParams.get(
    "competitionId",
  );

const matchweek =
  matchweekParam
    ? Number(matchweekParam)
    : null;

const requiredHashtag =
  getCompetitionHashtag(
    competitionId,
  );

  const featurePrefix =
    getFeatureHashtagPrefix(type);

  const featureHashtag =
    featurePrefix &&
    matchweek !== null &&
    Number.isFinite(matchweek)
      ? `${featurePrefix}${matchweek}`
      : null;

  const fields = [
    "id",
    "caption",
    "media_type",
    "media_url",
    "thumbnail_url",
    "permalink",
    "timestamp",
  ].join(",");

  const endpoint =
    new URL(
      `https://graph.instagram.com/${instagramUserId}/media`,
    );

  endpoint.searchParams.set(
    "fields",
    fields,
  );

  endpoint.searchParams.set(
    "limit",
    type === "luditv"
      ? "50"
      : "25",
  );

  endpoint.searchParams.set(
    "access_token",
    accessToken,
  );

  try {
    const response = await fetch(
      endpoint,
      {
        next: {
          // Le feature di Matchweek Hub vengono ricontrollate
          // più spesso così un nuovo GOTW compare senza dover
          // ripubblicare la giornata.
          revalidate:
            featureHashtag
              ? 60
              : 180,
        },
      },
    );

    const payload =
      (await response.json()) as
        InstagramApiResponse;

    if (
      !response.ok ||
      payload.error
    ) {
      console.error(
        "Errore Instagram API:",
        payload.error ??
          response.statusText,
      );

      return NextResponse.json(
        {
          posts: [],
          post: null,
          error:
            payload.error?.message ??
            "Instagram non disponibile.",
        },
        {
          status: response.status,
        },
      );
    }

    const allPosts =
      (payload.data ?? [])
        .map(mapInstagramPost)
        .filter(
          (post) =>
            Boolean(
              post.permalink &&
                (
                  post.imageUrl ||
                  (
                    post.mediaType ===
                      "VIDEO" &&
                    post.videoUrl
                  )
                ),
            ),
        );

    const ludiPosts =
      allPosts.filter((post) => {
        const hashtags =
          extractHashtags(
            post.caption,
          );

        return hashtags.includes(
          requiredHashtag,
        );
      });

    /*
     * Feed generale Home / Instagram
     */

    /*
 * ==========================================================
 * LUDI TV
 * ==========================================================
 */

if (
  type === "luditv"
) {
  const tvPosts:
    LudiTvPost[] =
    ludiPosts
      .filter(
        (post) =>
          post.mediaType ===
          "VIDEO" &&
          Boolean(
            post.videoUrl,
          ),
      )
      .map(
        (post) => {
          const hashtags =
            extractHashtags(
              post.caption,
            );

          const category =
            getLudiTvCategory(
              hashtags,
            );

          if (
            !category
          ) {
            return null;
          }

          return {
            ...post,
            category,
          };
        },
      )
      .filter(
        (
          post,
        ): post is LudiTvPost =>
          post !== null,
      );

  return NextResponse.json({
    posts:
      tvPosts,
  });
}

    if (!featureHashtag) {
      return NextResponse.json({
        posts: ludiPosts.slice(0, 5),
        post: null,
      });
    }

    /*
     * Contenuto specifico:
     * gotw / totw / potw per matchweek
     */
    const selectedPost =
      ludiPosts.find((post) => {
        const hashtags =
          extractHashtags(
            post.caption,
          );

        return hashtags.includes(
          featureHashtag,
        );
      }) ?? null;

    return NextResponse.json({
      posts: [],
      post: selectedPost,
    });
  } catch (error) {
    console.error(
      "Errore caricamento Instagram:",
      error,
    );

    return NextResponse.json(
      {
        posts: [],
        post: null,
        error:
          "Impossibile collegarsi a Instagram.",
      },
      {
        status: 500,
      },
    );
  }
}