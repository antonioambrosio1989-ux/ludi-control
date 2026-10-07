import { PublicationJobService } from "@/src/services/match/PublicationJobService";
import {
  DisciplinaryMatchProcessingService,
} from "@/src/services/discipline/DisciplinaryMatchProcessingService";

import {
  AtomicMatchPublicationService,
} from "@/src/services/match/AtomicMatchPublicationService";

import {
  MatchReportDisciplineAdapter,
} from "@/src/services/discipline/MatchReportDisciplineAdapter";

import {
  MatchweekDisciplinaryPlayersService,
} from "@/src/services/discipline/MatchweekDisciplinaryPlayersService";

import {
  MatchReportStorage,
} from "@/src/services/match/MatchReportStorage";

import {
  buildMatchProcessingContext,
} from "../match-processing/builders/MatchProcessingContextBuilder";

import {
  createMatchProcessingOrchestrator,
} from "../match-processing/createMatchProcessingOrchestrator";

import {
  loadMatchPublishingContext,
} from "./loaders/MatchPublishingContextLoader";

import type {
  PublishMatchCommand,
} from "./contracts/PublishMatchCommand";

import type {
  PublishMatchResult,
} from "./contracts/PublishMatchResult";

/*
 * ============================================================
 * SERVICE
 * ============================================================
 */

export class PublishMatchService {
  /*
   * ==========================================================
   * PUBLISH
   * ==========================================================
   */

  static async publish({
    match,
    report,
    expectedVersion,
  }: PublishMatchCommand): Promise<
    PublishMatchResult
  > {
    /*
 * ========================================================
 * PUBBLICAZIONE ATOMICA
 * ========================================================
 *
 * Match Report e stato della partita vengono
 * pubblicati nello stesso commit Firestore.
 * ========================================================
 */

const version = await AtomicMatchPublicationService
  .publishMatch({
    match,
    report,
    expectedVersion,
  });

    try {
      if (typeof version === "number") {
        return await PublicationJobService.run("regular",String(match.id),version,async () => {
          const result = await this.processPublished({match,report});
          if (result.processing.status === "failed") throw new Error(result.processing.error);
          return result;
        });
      }
      return await this.processPublished({match,report});
    } catch (error) {
      return {success:true,matchId:String(match.id),reportStatus:"published",processing:{status:"failed",error:error instanceof Error ? error.message : "Elaborazione da recuperare."}};
    }
  }

  static async processPublished({match,report}: PublishMatchCommand): Promise<PublishMatchResult> {
    try {
    /*
     * ========================================================
     * PARTITA RINVIATA
     * ========================================================
     *
     * Una partita rinviata:
     *
     * - viene pubblicata;
     * - viene marcata postponed;
     * - NON processa disciplina;
     * - NON processa statistiche/rating/analytics.
     * ========================================================
     */

    if (
      report.status ===
      "postponed"
    ) {
      
      MatchReportStorage.publish(
        report,
      );

      return {
        success:
          true,

        matchId:
          String(
            match.id,
          ),

        reportStatus:
          "published",

        processing: {
          status:
            "completed",
        },
      };
    }

    /*
     * ========================================================
     * PARTITA CONCLUSA
     * ========================================================
     */

    MatchReportStorage.publish(
      report,
    );

    /*
     * ========================================================
     * DISCIPLINA
     * ========================================================
     *
     * Questo punto viene raggiunto solamente
     * da partite effettivamente concluse.
     *
     * Vale sia per:
     *
     * - Regular Season
     * - titlePlayoff
     *
     * Una partita postponed è già uscita
     * dal metodo tramite il return precedente.
     * ========================================================
     */

    const rawDisciplinaryPlayers =
      MatchReportDisciplineAdapter
        .extract(
          report,
        );

    const disciplinaryPlayers =
      await MatchweekDisciplinaryPlayersService
        .resolveNames(
          rawDisciplinaryPlayers,
        );

    await DisciplinaryMatchProcessingService
      .process({
        seasonId:
          String(
            match.seasonId,
          ),

        matchId:
          String(
            match.id,
          ),

        matchweek:
          Number(
            match.matchweek,
          ),

        homeTeamId:
          String(
            match.homeTeamId,
          ),

        awayTeamId:
          String(
            match.awayTeamId,
          ),

        players:
          disciplinaryPlayers,
      });

    /*
     * ========================================================
     * PROCESSAMENTO APPLICATIVO
     * ========================================================
     *
     * Un errore in Analytics, Rating o negli
     * altri motori non annulla la pubblicazione
     * già conclusa.
     * ========================================================
     */

      const loadedData =
        await loadMatchPublishingContext(
          match,
        );

      const processingContext =
        await buildMatchProcessingContext({
          match,

          report:
            loadedData.report,

          season:
            loadedData.season,

          teams:
            loadedData.teams,

          players:
            loadedData.players,

          seasonPlayers:
            loadedData.seasonPlayers,

          seasonTeams:
            loadedData.seasonTeams,
        });

      const orchestrator =
        createMatchProcessingOrchestrator();

      const processingResult =
        await orchestrator.process(
          processingContext,
        );

      console.info(
        "[Publish Match] Processing completed:",
        {
          matchId:
            String(
              match.id,
            ),

          result:
            processingResult,
        },
      );

      return {
        success:
          true,

        matchId:
          String(
            match.id,
          ),

        reportStatus:
          "published",

        processing: {
          status:
            "completed",

          result:
            processingResult,
        },
      };
    } catch (
      processingError
    ) {
      console.error(
        "[Publish Match] Processing failed:",
        processingError,
      );

      return {
        success:
          true,

        matchId:
          String(
            match.id,
          ),

        reportStatus:
          "published",

        processing: {
          status:
            "failed",

          error:
            processingError instanceof
              Error
              ? processingError.message
              : "Errore sconosciuto durante il processamento della partita.",
        },
      };
    }
  }
}