export function extractYouTubeVideoId(
  value: string,
): string | null {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  try {
    const url = new URL(
      normalizedValue,
    );

    const hostname =
      url.hostname
        .toLowerCase()
        .replace(/^www\./, "");

    if (hostname === "youtu.be") {
      return sanitizeVideoId(
        url.pathname
          .split("/")
          .filter(Boolean)[0],
      );
    }

    if (
      hostname === "youtube.com" ||
      hostname === "m.youtube.com" ||
      hostname ===
        "music.youtube.com"
    ) {
      const queryVideoId =
        url.searchParams.get("v");

      if (queryVideoId) {
        return sanitizeVideoId(
          queryVideoId,
        );
      }

      const pathParts =
        url.pathname
          .split("/")
          .filter(Boolean);

      const supportedPrefixes = [
        "shorts",
        "embed",
        "live",
      ];

      for (
        const prefix of
        supportedPrefixes
      ) {
        const prefixIndex =
          pathParts.indexOf(prefix);

        const candidate =
          pathParts[
            prefixIndex + 1
          ];

        if (
          prefixIndex >= 0 &&
          candidate
        ) {
          return sanitizeVideoId(
            candidate,
          );
        }
      }
    }

    return null;
  } catch {
    return sanitizeVideoId(
      normalizedValue,
    );
  }
}

function sanitizeVideoId(
  value?: string | null,
): string | null {
  if (!value) {
    return null;
  }

  const normalizedValue =
    value
      .trim()
      .split("?")[0]
      .split("&")[0]
      .split("#")[0];

  return /^[a-zA-Z0-9_-]{11}$/.test(
    normalizedValue,
  )
    ? normalizedValue
    : null;
}

export function buildYouTubeEmbedUrl(
  videoId: string,
): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

export function buildYouTubeCoverUrl(
  videoId: string,
): string {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}