import type {
  HistoricalSeasonArchiveImport,
} from "@/src/services/season/HistoricalSeasonArchiveExcelParser";

/*
 * ============================================================
 * GIOCATORE AGGREGATO STORICO
 * ============================================================
 */

export type AggregatedHistoricalPlayer = {
  identityKey: string;

  playerSeasonCode: string;

  firstName: string;
  lastName: string;

  birthYear?: number;

  role?: string;

  regularTeamCodes:
    Set<string>;

  championsTeamCodes:
    Set<string>;

  shirtNumbers:
    number[];

  hasRegularSeasonData: boolean;

  /*
   * ==========================================================
   * REGULAR SEASON
   * ==========================================================
   */

  regularAppearances: number;

  regularGoals: number;
  regularAssists: number;

  regularOwnGoals: number;

  regularYellowCards: number;
  regularRedCards: number;

  regularRatedMatches: number;
  regularWeightedVoteTotal: number;

  /*
   * ==========================================================
   * CHAMPIONS
   *
   * Sono già i totali dell'intera
   * fase finale, finale compresa.
   * ==========================================================
   */

  championsAppearances: number;

  championsGoals: number;
  championsAssists: number;

  championsOwnGoals: number;

  championsYellowCards: number;
  championsRedCards: number;

  championsRatedMatches: number;
  championsWeightedVoteTotal: number;

  championsMvps: number;

  playerId?: string;
};

/*
 * ============================================================
 * AGGREGAZIONE GIOCATORI
 * ============================================================
 */

export function aggregateArchivePlayers(
  archive:
    HistoricalSeasonArchiveImport,
): Map<
  string,
  AggregatedHistoricalPlayer
> {
  const result =
    new Map<
      string,
      AggregatedHistoricalPlayer
    >();

  /*
   * ==========================================================
   * REGULAR SEASON
   * ==========================================================
   */

  for (
    const row of
      archive.regularSeasonPlayers
  ) {
    const player =
      getOrCreateAggregatedPlayer({
        result,

        playerSeasonCode:
          row.playerSeasonCode,

        firstName:
          row.firstName,

        lastName:
          row.lastName,

        birthYear:
          row.birthYear,

        role:
          row.role,
      });

    player.hasRegularSeasonData =
      true;

    player.regularTeamCodes.add(
      row.teamCode,
    );

    if (
      row.shirtNumber !==
      undefined
    ) {
      player.shirtNumbers.push(
        row.shirtNumber,
      );
    }

    player.regularAppearances +=
      row.appearances;

    player.regularGoals +=
      row.goals;

    player.regularAssists +=
      row.assists;

    player.regularOwnGoals +=
      row.ownGoals;

    player.regularYellowCards +=
      row.yellowCards;

    player.regularRedCards +=
      row.redCards;

    if (
      row.averageVote !==
        undefined &&
      row.ratedMatches >
        0
    ) {
      player.regularRatedMatches +=
        row.ratedMatches;

      player.regularWeightedVoteTotal +=
        row.averageVote *
        row.ratedMatches;
    }
  }

  /*
   * ==========================================================
   * CHAMPIONS
   * ==========================================================
   */

  for (
    const row of
      archive.championsPlayerStats
  ) {
    const player =
      getOrCreateAggregatedPlayer({
        result,

        playerSeasonCode:
          row.playerSeasonCode,

        firstName:
          row.firstName,

        lastName:
          row.lastName,

        birthYear:
          row.birthYear,

        role:
          row.role,
      });

    player.championsTeamCodes.add(
      row.teamCode,
    );

    if (
      row.shirtNumber !==
      undefined
    ) {
      player.shirtNumbers.push(
        row.shirtNumber,
      );
    }

    player.championsAppearances +=
      row.appearances;

    player.championsGoals +=
      row.goals;

    player.championsAssists +=
      row.assists;

    player.championsOwnGoals +=
      row.ownGoals;

    player.championsYellowCards +=
      row.yellowCards;

    player.championsRedCards +=
      row.redCards;

    player.championsMvps +=
      row.mvps;

    if (
      row.averageVote !==
      undefined
    ) {
      const ratedMatches =
        row.ratedMatches ??
        Math.max(
          0,

          row.appearances -
            (
              row.withoutVote ??
              0
            ),
        );

      if (
        ratedMatches >
        0
      ) {
        player.championsRatedMatches +=
          ratedMatches;

        player.championsWeightedVoteTotal +=
          row.averageVote *
          ratedMatches;
      }
    }
  }

  return result;
}

/*
 * ============================================================
 * CREA / RECUPERA AGGREGAZIONE
 * ============================================================
 */

function getOrCreateAggregatedPlayer({
  result,
  playerSeasonCode,
  firstName,
  lastName,
  birthYear,
  role,
}: {
  result:
    Map<
      string,
      AggregatedHistoricalPlayer
    >;

  playerSeasonCode:
    string;

  firstName:
    string;

  lastName:
    string;

  birthYear?: number;

  role?: string;
}): AggregatedHistoricalPlayer {
  const key =
    getHistoricalPlayerKey({
      playerSeasonCode,

      firstName,

      lastName,

      birthYear,
    });

  const existing =
    result.get(
      key,
    );

  if (
    existing
  ) {
    if (
      existing.birthYear ===
        undefined &&
      birthYear !==
        undefined
    ) {
      existing.birthYear =
        birthYear;

      existing.identityKey =
        createIdentityKey(
          firstName,

          lastName,

          birthYear,
        );
    }

    if (
      !existing.role &&
      role
    ) {
      existing.role =
        role;
    }

    return existing;
  }

  const player:
    AggregatedHistoricalPlayer = {
    identityKey:
      createOptionalIdentityKey(
        firstName,

        lastName,

        birthYear,
      ),

    playerSeasonCode,

    firstName,

    lastName,

    birthYear,

    role,

    regularTeamCodes:
      new Set<string>(),

    championsTeamCodes:
      new Set<string>(),

    shirtNumbers:
      [],

    hasRegularSeasonData:
      false,

    regularAppearances:
      0,

    regularGoals:
      0,

    regularAssists:
      0,

    regularOwnGoals:
      0,

    regularYellowCards:
      0,

    regularRedCards:
      0,

    regularRatedMatches:
      0,

    regularWeightedVoteTotal:
      0,

    championsAppearances:
      0,

    championsGoals:
      0,

    championsAssists:
      0,

    championsOwnGoals:
      0,

    championsYellowCards:
      0,

    championsRedCards:
      0,

    championsRatedMatches:
      0,

    championsWeightedVoteTotal:
      0,

    championsMvps:
      0,
  };

  result.set(
    key,
    player,
  );

  return player;
}

/*
 * ============================================================
 * CHIAVE GIOCATORE STORICO
 * ============================================================
 */

function getHistoricalPlayerKey({
  playerSeasonCode,
  firstName,
  lastName,
  birthYear,
}: {
  playerSeasonCode:
    string;

  firstName:
    string;

  lastName:
    string;

  birthYear?: number;
}) {
  const normalizedCode =
    normalizeText(
      playerSeasonCode,
    );

  if (
    normalizedCode
  ) {
    return normalizedCode;
  }

  return createOptionalIdentityKey(
    firstName,

    lastName,

    birthYear,
  );
}

/*
 * ============================================================
 * CHIAVE NOME
 * ============================================================
 */

function createNameKey(
  firstName:
    string,

  lastName:
    string,
) {
  return `${normalizeText(firstName)}::${normalizeText(lastName)}`;
}

/*
 * ============================================================
 * CHIAVE IDENTITÀ
 * ============================================================
 */

function createIdentityKey(
  firstName:
    string,

  lastName:
    string,

  birthYear:
    number,
) {
  return `${createNameKey(firstName, lastName)}::${birthYear}`;
}

/*
 * ============================================================
 * CHIAVE IDENTITÀ OPZIONALE
 * ============================================================
 */

function createOptionalIdentityKey(
  firstName:
    string,

  lastName:
    string,

  birthYear?: number,
) {
  if (
    birthYear !==
    undefined
  ) {
    return createIdentityKey(
      firstName,

      lastName,

      birthYear,
    );
  }

  return createNameKey(
    firstName,

    lastName,
  );
}

/*
 * ============================================================
 * NORMALIZZAZIONE TESTO
 * ============================================================
 */

function normalizeText(
  value:
    string,
) {
  return value
    .trim()
    .toLocaleLowerCase(
      "it",
    )
    .normalize(
      "NFD",
    )
    .replace(
      /[\u0300-\u036f]/g,

      "",
    )
    .replace(
      /\s+/g,

      " ",
    );
}
