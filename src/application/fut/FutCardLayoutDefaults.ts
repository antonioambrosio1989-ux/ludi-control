import type {
  FutCardTemplate,
} from "@/src/application/fut/FutCardResolver";

import type {
  FutCardElementLayout,
  FutCardLayout,
} from "@/src/types/FutCardLayout";

export const FUT_CARD_TEMPLATES: FutCardTemplate[] = [
  "player-bronze",
  "player-silver",
  "player-gold",
  "player-emerald",

  "totw-bronze",
  "totw-silver",
  "totw-gold",
  "totw-emerald",

  "potm",
  "gotm",
  "sotm",

  "champions",
  "europa",
  "conference",

  "champions-final",
  "europa-final",
  "conference-final",
];

const BASE_ELEMENTS: FutCardLayout["elements"] = {
  rating: {
    x: 13,
    y: 14,
    width: 19,
    height: 10,
    fontSize: 34,
  },

  role: {
    x: 13,
    y: 25,
    width: 19,
    height: 6,
    fontSize: 12,
  },

  photo: {
    x: 31,
    y: 18,
    width: 49,
    height: 48,
  },

  name: {
    x: 17,
    y: 66,
    width: 66,
    height: 8,
    fontSize: 18,
  },

  nationality: {
    x: 27,
    y: 75,
    width: 10,
    height: 8,
  },

  competitionLogo: {
    x: 45,
    y: 75,
    width: 10,
    height: 8,
  },

  teamLogo: {
    x: 63,
    y: 75,
    width: 10,
    height: 8,
  },
};

export function getDefaultFutCardLayout(): FutCardLayout {
  return {
    elements: {
      rating:
        cloneElement(
          BASE_ELEMENTS.rating,
        ),

      role:
        cloneElement(
          BASE_ELEMENTS.role,
        ),

      photo:
        cloneElement(
          BASE_ELEMENTS.photo,
        ),

      name:
        cloneElement(
          BASE_ELEMENTS.name,
        ),

      nationality:
        cloneElement(
          BASE_ELEMENTS.nationality,
        ),

      competitionLogo:
        cloneElement(
          BASE_ELEMENTS.competitionLogo,
        ),

      teamLogo:
        cloneElement(
          BASE_ELEMENTS.teamLogo,
        ),
    },
  };
}

/*
 * Le grafiche FUT condividono tutte lo stesso layout.
 * Cambia esclusivamente il colore dei testi.
 *
 * Card base = chiare.
 * Le card speciali vengono considerate scure.
 */
export function getFutCardTextColor(
  template: FutCardTemplate,
) {
  if (
    template ===
    "player-bronze" ||
    template ===
    "player-silver" ||
    template ===
    "player-gold"
  ) {
    return "#06142E";
  }

  /*
   * player-emerald e tutte le card speciali
   * utilizzano testo chiaro.
   */
  return "#FFFFFF";
}

export function sanitizeFutCardElementLayout({
  value,
  fallback,
}: {
  value: unknown;
  fallback: FutCardElementLayout;
}): FutCardElementLayout {
  const source =
    value &&
    typeof value ===
      "object"
      ? value as Record<
          string,
          unknown
        >
      : {};

  return {
    x:
      clampPercent(
        getFiniteNumber(
          source.x,
          fallback.x,
        ),
      ),

    y:
      clampPercent(
        getFiniteNumber(
          source.y,
          fallback.y,
        ),
      ),

    width:
      clampSize(
        getFiniteNumber(
          source.width,
          fallback.width,
        ),
      ),

    height:
      clampSize(
        getFiniteNumber(
          source.height,
          fallback.height,
        ),
      ),

    fontSize:
      fallback.fontSize ===
        undefined
        ? undefined
        : clampFontSize(
            getFiniteNumber(
              source.fontSize,
              fallback.fontSize,
            ),
          ),
  };
}

function cloneElement(
  element: FutCardElementLayout,
): FutCardElementLayout {
  return {
    ...element,
  };
}

function getFiniteNumber(
  value: unknown,
  fallback: number,
) {
  return typeof value ===
      "number" &&
    Number.isFinite(
      value,
    )
    ? value
    : fallback;
}

function clampPercent(
  value: number,
) {
  return Math.min(
    100,
    Math.max(
      0,
      value,
    ),
  );
}

function clampSize(
  value: number,
) {
  return Math.min(
    100,
    Math.max(
      2,
      value,
    ),
  );
}

function clampFontSize(
  value: number,
) {
  return Math.min(
    80,
    Math.max(
      6,
      value,
    ),
  );
}
