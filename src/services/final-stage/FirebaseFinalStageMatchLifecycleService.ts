import type { ExpectedLiveScores } from "@/src/services/match/LiveMatchTransaction";
import {
  FirebaseFinalStageMatchRepository,
} from "@/src/services/final-stage/FirebaseFinalStageMatchRepository";

import {
  selectAutomaticFinalStageLiveMatch,
} from "@/src/services/final-stage/FinalStageMatchLifecycleRules";

import type {
  FinalStageMatch,
} from "@/src/types/FinalStageMatch";

export const FirebaseFinalStageMatchLifecycleService =
  {
    async syncAutomaticLiveState({
      seasonId,
      currentTime =
        new Date(),
    }: {
      seasonId:
        string;

      currentTime?:
        Date;
    }) {
      const normalizedSeasonId =
        seasonId.trim();

      if (
        !normalizedSeasonId
      ) {
        return {
          status:
            "idle" as const,
        };
      }

      const matches =
        await FirebaseFinalStageMatchRepository.getBySeason(
          normalizedSeasonId,
        );

      const selection =
        selectAutomaticFinalStageLiveMatch({
          matches,
          currentTime,
        });

      if (
        selection.status !==
        "start"
      ) {
        return selection;
      }

      const match =
        selection.match;

      try {
        await FirebaseFinalStageMatchRepository.transitionLifecycle({
          matchId:
            String(
              match.id,
            ),

          expectedStatus:
            "scheduled",

          status:
            "live",

          homeScore:
            match.homeScore ??
            0,

          awayScore:
            match.awayScore ??
            0,
        });
      } catch (
        currentError
      ) {
        /*
         * Sync idempotente: due client possono arrivare insieme
         * al +15. La transaction lascia vincere una sola scrittura.
         */
        const refreshedMatches =
          await FirebaseFinalStageMatchRepository.getBySeason(
            normalizedSeasonId,
          );

        const refreshedSelection =
          selectAutomaticFinalStageLiveMatch({
            matches:
              refreshedMatches,
            currentTime,
          });

        if (
          refreshedSelection.status ===
          "already-live"
        ) {
          return refreshedSelection;
        }

        throw currentError;
      }

      return {
        status:
          "started" as const,

        match: {
          ...match,

          status:
            "live" as const,

          homeScore:
            match.homeScore ??
            0,

          awayScore:
            match.awayScore ??
            0,
        },
      };
    },

    async updateLiveScore({
      expectedScores,
      matchId,
      homeScore,
      awayScore,
    }: {
      expectedScores?: ExpectedLiveScores;
      matchId:
        string;

      homeScore:
        number;

      awayScore:
        number;
    }): Promise<void> {
      await FirebaseFinalStageMatchRepository.updateLiveScore({
      expectedScores,
        matchId,
        homeScore,
        awayScore,
      });
    },

    async finishMatch({
      expectedScores,
      matchId,
    }: {
      expectedScores?: ExpectedLiveScores;
      matchId:
        string;
    }): Promise<FinalStageMatch> {
      const match =
        await FirebaseFinalStageMatchRepository.getById(
          matchId,
        );

      if (
        !match
      ) {
        throw new Error(
          "La partita delle fasi finali selezionata non esiste.",
        );
      }

      if (
        match.status !==
        "live"
      ) {
        throw new Error(
          "Puoi terminare soltanto una partita attualmente live.",
        );
      }

      await FirebaseFinalStageMatchRepository.transitionLifecycle({
      expectedScores: expectedScores ?? { homeScore: match.homeScore, awayScore: match.awayScore },
        matchId:
          match.id,

        expectedStatus:
          "live",

        status:
          "finished",

        homeScore:
          match.homeScore ??
          0,

        awayScore:
          match.awayScore ??
          0,
      });

      return {
        ...match,

        status:
          "finished",

        homeScore:
          match.homeScore ??
          0,

        awayScore:
          match.awayScore ??
          0,
      };
    },

    async restoreLive({
      expectedScores,
      matchId,
    }: {
      expectedScores?: ExpectedLiveScores;
      matchId:
        string;
    }): Promise<FinalStageMatch> {
      const match =
        await FirebaseFinalStageMatchRepository.getById(
          matchId,
        );

      if (
        !match
      ) {
        throw new Error(
          "La partita delle fasi finali selezionata non esiste.",
        );
      }

      if (
        match.status !==
        "finished"
      ) {
        throw new Error(
          "Puoi ripristinare il live soltanto per una partita terminata.",
        );
      }

      await FirebaseFinalStageMatchRepository.transitionLifecycle({
      expectedScores: expectedScores ?? { homeScore: match.homeScore, awayScore: match.awayScore },
        matchId:
          match.id,

        expectedStatus:
          "finished",

        status:
          "live",

        homeScore:
          match.homeScore ??
          0,

        awayScore:
          match.awayScore ??
          0,
      });

      return {
        ...match,

        status:
          "live",

        homeScore:
          match.homeScore ??
          0,

        awayScore:
          match.awayScore ??
          0,
      };
    },
  };
