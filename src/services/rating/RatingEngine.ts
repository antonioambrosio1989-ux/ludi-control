export type PlayerRatingStatistics = {
  playerId: string;

  appearances: number;

  averageVote: number;

  goals: number;
  assists: number;
  mvp: number;

  cleanSheets: number;

  yellowCards: number;
  redCards: number;

  /*
   * Variazione complessiva calcolata
   * partita per partita.
   *
   * Regole:
   *
   * MVP            +1
   *
   * voto >= 9      +1
   * voto 8 / 8,5   +0,75
   * voto 7 / 7,5   +0,50
   * voto 6,5       +0,25
   * voto 6          0
   * voto 5,5       -0,25
   * voto 5         -0,50
   * voto 4,5       -0,75
   * voto <= 4      -1
   */
  ratingVariation: number;
};

export type PlayerRatingInput = {
  playerId: string;

  baseRating: number;

  role?: string;

  statistics: PlayerRatingStatistics;
};

export type PlayerRatingResult = {
  playerId: string;

  baseRating: number;
  currentRating: number;

  variation: number;

  performanceScore: number;

  trend:
    | "rising"
    | "stable"
    | "falling";
};

export type TeamRatingPlayer = {
  playerId: string;
  rating: number;

  isAvailable?: boolean;
};

export type TeamStrengthResult = {
  strength: number;

  selectedPlayers: TeamRatingPlayer[];

  selectedPlayersCount: number;
};

const MIN_RATING = 40;
const MAX_RATING = 99;

const DEFAULT_RATING = 70;

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    Math.max(
      value,
      minimum,
    ),
    maximum,
  );
}

function roundRating(
  value: number,
): number {
  return Math.round(value);
}

export function calculatePlayerRating({
  playerId,
  baseRating,
  statistics,
}: PlayerRatingInput): PlayerRatingResult {
  const safeBaseRating =
    clamp(
      Number.isFinite(
        baseRating,
      )
        ? baseRating
        : DEFAULT_RATING,
      MIN_RATING,
      MAX_RATING,
    );

  const rawVariation =
    Number.isFinite(
      statistics.ratingVariation,
    )
      ? statistics.ratingVariation
      : 0;

  const rawCurrentRating =
    clamp(
      safeBaseRating +
        rawVariation,
      MIN_RATING,
      MAX_RATING,
    );

  /*
   * Il rating mostrato al pubblico
   * deve essere sempre un numero intero.
   */
  const roundedBaseRating =
    roundRating(
      safeBaseRating,
    );

  const roundedCurrentRating =
    roundRating(
      rawCurrentRating,
    );

  /*
   * Anche la variazione mostrata viene
   * espressa come differenza tra i due
   * rating interi.
   */
  const roundedVariation =
    roundedCurrentRating -
    roundedBaseRating;

  let trend:
    PlayerRatingResult["trend"] =
      "stable";

  if (
    roundedVariation > 0
  ) {
    trend = "rising";
  }

  if (
    roundedVariation < 0
  ) {
    trend = "falling";
  }

  return {
    playerId,

    baseRating:
      roundedBaseRating,

    currentRating:
      roundedCurrentRating,

    variation:
      roundedVariation,

    /*
     * Manteniamo qui il valore reale
     * della variazione prima
     * dell'arrotondamento.
     */
    performanceScore:
      rawVariation,

    trend,
  };
}

export function calculateTeamStrength(
  players: TeamRatingPlayer[],
): TeamStrengthResult {
  const availablePlayers =
    players
      .filter(
        (player) =>
          player.isAvailable !==
          false,
      )
      .filter(
        (player) =>
          Number.isFinite(
            player.rating,
          ),
      )
      .map((player) => ({
        ...player,

        rating:
          clamp(
            player.rating,
            MIN_RATING,
            MAX_RATING,
          ),
      }))
      .sort(
        (
          firstPlayer,
          secondPlayer,
        ) =>
          secondPlayer.rating -
          firstPlayer.rating,
      );

  const selectedPlayers =
    availablePlayers.slice(
      0,
      5,
    );

  if (
    selectedPlayers.length === 0
  ) {
    return {
      strength: 0,

      selectedPlayers: [],

      selectedPlayersCount: 0,
    };
  }

  const totalRating =
    selectedPlayers.reduce(
      (
        total,
        player,
      ) =>
        total +
        player.rating,
      0,
    );

  return {
    /*
     * Anche la forza squadra viene
     * mostrata come numero intero.
     */
    strength:
      roundRating(
        totalRating /
          selectedPlayers.length,
      ),

    selectedPlayers,

    selectedPlayersCount:
      selectedPlayers.length,
  };
}

export const RatingEngine = {
  calculatePlayerRating,
  calculateTeamStrength,
};