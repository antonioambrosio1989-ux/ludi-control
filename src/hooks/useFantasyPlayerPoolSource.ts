"use client";

import {
  useMemo,
} from "react";

import {
  usePlayers,
} from "@/src/hooks/usePlayers";

import {
  useSeasons,
} from "@/src/hooks/useSeasons";

import {
  useSeasonPlayers,
} from "@/src/hooks/useSeasonPlayers";

import {
  useTeams,
} from "@/src/hooks/useTeams";

import {
  FantasyPlayerPoolSourceService,
  type FantasyPlayerPoolSource,
} from "@/src/services/fantasy/FantasyPlayerPoolSourceService";

export type UseFantasyPlayerPoolSourceResult = {
  source:
    FantasyPlayerPoolSource | null;

  isLoading:
    boolean;

  error:
    string | null;

  validPlayerSeasonCodes:
    Set<string>;

  validTeamCodes:
    Set<string>;
};

export function useFantasyPlayerPoolSource(
  sportSeasonId:
    string | null | undefined,
): UseFantasyPlayerPoolSourceResult {
  const {
    currentSeason,
    seasons,
    isLoading:
      seasonsLoading,
    error:
      seasonsError,
  } =
    useSeasons();

  const targetSeason =
    useMemo(
      () => {
        if (
          !sportSeasonId
        ) {
          return null;
        }

        return (
          seasons.find(
            (season) =>
              String(
                season.id,
              ) ===
              String(
                sportSeasonId,
              ),
          ) ??
          (
            String(
              currentSeason?.id ??
                "",
            ) ===
            String(
              sportSeasonId,
            )
              ? currentSeason
              : null
          )
        );
      },
      [
        sportSeasonId,
        seasons,
        currentSeason,
      ],
    );

  const {
    players,
    isLoading:
      playersLoading,
    error:
      playersError,
  } =
    usePlayers(
      targetSeason?.competitionId ??
        "__no-competition__",
    );

  const {
    teams,
    isLoading:
      teamsLoading,
    error:
      teamsError,
  } =
    useTeams();

  const {
    seasonPlayers,
    isLoading:
      seasonPlayersLoading,
    error:
      seasonPlayersError,
  } =
    useSeasonPlayers(
      sportSeasonId ??
        undefined,
    );

  const source =
    useMemo(
      () => {
        if (
          !sportSeasonId ||
          !targetSeason
        ) {
          return null;
        }

        const seasonCode =
          resolveSeasonCode(
            targetSeason,
          );

        if (
          !seasonCode
        ) {
          return null;
        }

        try {
          return FantasyPlayerPoolSourceService
            .build(
              {
                seasonId:
                  String(
                    targetSeason.id,
                  ),

                seasonCode,

                seasonPlayers,

                players,

                teams,
              },
            );
        } catch {
          return null;
        }
      },
      [
        sportSeasonId,
        targetSeason,
        seasonPlayers,
        players,
        teams,
      ],
    );

  const sourceError =
    useMemo(
      () => {
        if (
          seasonsError
        ) {
          return seasonsError;
        }

        if (
          playersError
        ) {
          return playersError;
        }

        if (
          teamsError
        ) {
          return teamsError;
        }

        if (
          seasonPlayersError
        ) {
          return seasonPlayersError;
        }

        if (
          sportSeasonId &&
          !seasonsLoading &&
          !targetSeason
        ) {
          return "La stagione sportiva collegata al Fantacalcio non è stata trovata.";
        }

        if (
          targetSeason &&
          !resolveSeasonCode(
            targetSeason,
          )
        ) {
          return "La stagione sportiva non dispone di un codice stagione valido.";
        }

        return null;
      },
      [
        seasonsError,
        playersError,
        teamsError,
        seasonPlayersError,
        sportSeasonId,
        seasonsLoading,
        targetSeason,
      ],
    );

  const isLoading =
    seasonsLoading ||
    playersLoading ||
    teamsLoading ||
    seasonPlayersLoading;

  return {
    source,

    isLoading,

    error:
      sourceError,

    validPlayerSeasonCodes:
      source
        ?.validPlayerSeasonCodes ??
      new Set<string>(),

    validTeamCodes:
      source
        ?.validTeamCodes ??
      new Set<string>(),
  };
}

function resolveSeasonCode(
  season:
    Record<
      string,
      unknown
    >,
): string {
  const possibleValues = [
    season.code,
    season.seasonCode,
    season.slug,
  ];

  for (
    const value
    of possibleValues
  ) {
    if (
      typeof value ===
        "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  const startYear =
    typeof season.startYear ===
      "number"
      ? season.startYear
      : undefined;

  const endYear =
    typeof season.endYear ===
      "number"
      ? season.endYear
      : undefined;

  if (
    startYear &&
    endYear
  ) {
    return `ss${String(
      startYear,
    ).slice(
      -2,
    )}-${String(
      endYear,
    ).slice(
      -2,
    )}`;
  }

  const name =
    typeof season.name ===
      "string"
      ? season.name
      : "";

  const years =
    name.match(
      /(\d{4})\D+(\d{2,4})/,
    );

  if (
    years
  ) {
    const first =
      years[1];

    const second =
      years[2];

    return `ss${first.slice(
      -2,
    )}-${second.slice(
      -2,
    )}`;
  }

  return "";
}