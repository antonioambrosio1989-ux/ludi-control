"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CompetitionMatchService,
} from "@/src/services/match/CompetitionMatchService";

import {
  FirebaseFinalStageMatchRepository,
} from "@/src/services/final-stage/FirebaseFinalStageMatchRepository";

import {
  FirebaseFinalStageMatchReportRepository,
  type CloudFinalStageMatchReport,
} from "@/src/services/final-stage/FirebaseFinalStageMatchReportRepository";

import type {
  CloudMatchReport,
} from "@/src/services/match/FirebaseMatchReportRepository";

import type {
  FinalStageMatch,
} from "@/src/types/FinalStageMatch";

import type {
  Match,
} from "@/src/types/Match";

type FinalStageMatchesSnapshot = {
  seasonId:
    string;

  data:
    FinalStageMatch[];

  error:
    string | null;
};

type FinalStageReportsSnapshot = {
  seasonId:
    string;

  data:
    CloudFinalStageMatchReport[];

  error:
    string | null;
};

const EMPTY_MATCHES_SNAPSHOT:
  FinalStageMatchesSnapshot = {
    seasonId:
      "",

    data:
      [],

    error:
      null,
  };

const EMPTY_REPORTS_SNAPSHOT:
  FinalStageReportsSnapshot = {
    seasonId:
      "",

    data:
      [],

    error:
      null,
  };

export function useCompetitionMatches({
  seasonId,
  regularSeasonMatches = [],
  regularSeasonReports = [],
}: {
  seasonId?:
    string;

  regularSeasonMatches?:
    Match[];

  regularSeasonReports?:
    CloudMatchReport[];
}) {
  /*
   * Lo state è associato alla stagione che ha prodotto
   * realmente il dato.
   *
   * In questo modo non dobbiamo "resettare" lo state
   * sincronicamente dentro useEffect quando cambia seasonId:
   * finché non arriva il primo snapshot della nuova stagione,
   * i dati della stagione precedente vengono semplicemente
   * ignorati.
   */
  const [
    matchesSnapshot,
    setMatchesSnapshot,
  ] =
    useState<
      FinalStageMatchesSnapshot
    >(
      EMPTY_MATCHES_SNAPSHOT,
    );

  const [
    reportsSnapshot,
    setReportsSnapshot,
  ] =
    useState<
      FinalStageReportsSnapshot
    >(
      EMPTY_REPORTS_SNAPSHOT,
    );

  useEffect(
    () => {
      if (
        !seasonId
      ) {
        return;
      }

      return FirebaseFinalStageMatchRepository
        .subscribePublishedBySeason(
          seasonId,

          (
            loadedMatches,
          ) => {
            setMatchesSnapshot({
              seasonId,

              data:
                loadedMatches,

              error:
                null,
            });
          },

          (
            currentError,
          ) => {
            setMatchesSnapshot({
              seasonId,

              data:
                [],

              error:
                currentError.message ||
                "Impossibile caricare le partite Final Stage.",
            });
          },
        );
    },
    [
      seasonId,
    ],
  );

  useEffect(
    () => {
      if (
        !seasonId
      ) {
        return;
      }

      return FirebaseFinalStageMatchReportRepository
        .subscribePublishedBySeason(
          seasonId,

          (
            reports,
          ) => {
            setReportsSnapshot({
              seasonId,

              data:
                reports,

              error:
                null,
            });
          },

          (
            currentError,
          ) => {
            setReportsSnapshot({
              seasonId,

              data:
                [],

              error:
                currentError.message ||
                "Impossibile caricare i report Final Stage.",
            });
          },
        );
    },
    [
      seasonId,
    ],
  );

  const finalStageMatches =
    useMemo(
      () =>
        seasonId &&
        matchesSnapshot.seasonId ===
          seasonId
          ? matchesSnapshot.data
          : [],
      [
        matchesSnapshot,
        seasonId,
      ],
    );

  const finalStageReports =
    useMemo(
      () =>
        seasonId &&
        reportsSnapshot.seasonId ===
          seasonId
          ? reportsSnapshot.data
          : [],
      [
        reportsSnapshot,
        seasonId,
      ],
    );

  const matchesError =
    seasonId &&
    matchesSnapshot.seasonId ===
      seasonId
      ? matchesSnapshot.error
      : null;

  const reportsError =
    seasonId &&
    reportsSnapshot.seasonId ===
      seasonId
      ? reportsSnapshot.error
      : null;

  const matchesLoading =
    Boolean(
      seasonId,
    ) &&
    matchesSnapshot.seasonId !==
      seasonId;

  const reportsLoading =
    Boolean(
      seasonId,
    ) &&
    reportsSnapshot.seasonId !==
      seasonId;

  const publishedFinalStageMatches =
    useMemo(
      () =>
        finalStageMatches.filter(
          (match) =>
            match.published,
        ),
      [
        finalStageMatches,
      ],
    );

  const publishedFinalStageReports =
    useMemo(
      () => {
        const publishedMatchIds =
          new Set(
            publishedFinalStageMatches.map(
              (match) =>
                String(
                  match.id,
                ),
            ),
          );

        return finalStageReports.filter(
          (report) =>
            report.status ===
              "published" &&
            publishedMatchIds.has(
              String(
                report.matchId,
              ),
            ),
        );
      },
      [
        finalStageReports,
        publishedFinalStageMatches,
      ],
    );

  const allMatches =
    useMemo(
      () =>
        CompetitionMatchService.merge({
          regularSeasonMatches,
          regularSeasonReports,

          finalStageMatches,
          finalStageReports,
        }),
      [
        regularSeasonMatches,
        regularSeasonReports,
        finalStageMatches,
        finalStageReports,
      ],
    );

  const regularSeason =
    useMemo(
      () =>
        CompetitionMatchService.getRegularSeason(
          allMatches,
        ),
      [
        allMatches,
      ],
    );

  const finalStage =
    useMemo(
      () =>
        CompetitionMatchService.getFinalStage(
          allMatches,
        ),
      [
        allMatches,
      ],
    );

  return {
    allMatches,

    regularSeason,

    finalStage,

    /*
     * Raw data kept temporarily for screens that still need
     * phase-specific fields while the migration proceeds.
     */
    finalStageMatches,
    finalStageReports,

    publishedFinalStageMatches,
    publishedFinalStageReports,

    isFinalStageLoading:
      Boolean(
        seasonId,
      ) &&
      (
        matchesLoading ||
        reportsLoading
      ),

    finalStageError:
      matchesError ||
      reportsError,
  };
}
