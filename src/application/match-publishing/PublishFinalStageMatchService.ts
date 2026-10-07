import { PublicationJobService } from "@/src/services/match/PublicationJobService";
import {
  AtomicMatchPublicationService,
} from "@/src/services/match/AtomicMatchPublicationService";

import {
  DisciplinaryMatchProcessingService,
} from "@/src/services/discipline/DisciplinaryMatchProcessingService";

import {
  MatchReportDisciplineAdapter,
} from "@/src/services/discipline/MatchReportDisciplineAdapter";

import {
  assertFinalStageMatchFormat,
} from "@/src/services/final-stage/FinalStageCompetitionFormatResolver";

import {
  MatchweekDisciplinaryPlayersService,
} from "@/src/services/discipline/MatchweekDisciplinaryPlayersService";

import {
  planFinalStageBracketAdvancement,
  type FinalStageBracketAdvancementPlan,
} from "@/src/services/final-stage/FinalStageBracketAdvancementPlanner";

import {
  FirebaseFinalStageMatchRepository,
} from "@/src/services/final-stage/FirebaseFinalStageMatchRepository";

import {
  resolveFinalStageQualification,
} from "@/src/services/final-stage/FinalStageQualificationResolver";

import type {
  FinalStageMatch,
} from "@/src/types/FinalStageMatch";

import type {
  MatchWizardData,
} from "@/src/types/MatchWizardData";

/*
 * ============================================================
 * RESULT
 * ============================================================
 */

export type PublishFinalStageMatchResult = {
  success:
    true;

  matchId:
    string;

  reportStatus:
    "published";

  processing?: {status:"completed"|"failed";error?:string};

  advancement?:
    FinalStageBracketAdvancementPlan;
};

/*
 * ============================================================
 * SERVICE
 * ============================================================
 */

export class PublishFinalStageMatchService {
  static async publish({
    match,
    report,
    expectedVersion,
  }: {
    match:
      FinalStageMatch;

    report:
      MatchWizardData;
    expectedVersion?: number;
  }): Promise<
    PublishFinalStageMatchResult
  > {
    /*
     * ========================================================
     * CONTROLLO MATCH
     * ========================================================
     */

    if (
      String(
        match.id,
      ) !==
      String(
        report.matchId,
      )
    ) {
      throw new Error(
        "Il tabellino non appartiene alla partita selezionata.",
      );
    }

    /*
 * ============================================================
 * FORMATO FINAL STAGE
 * ============================================================
 *
 * Difesa aggiuntiva in fase di pubblicazione.
 *
 * Anche un vecchio documento Firestore deve rispettare
 * il formato ufficiale corrente:
 *
 * - quarti       -> andata / ritorno
 * - semifinali   -> andata / ritorno
 * - finale       -> gara secca
 *
 * In questo modo il percorso di pubblicazione non può
 * aggirare le validazioni del repository.
 * ============================================================
 */

assertFinalStageMatchFormat({
  competition:
    match.competition,

  round:
    match.round,

  leg:
    match.leg,

  matchOrder:
    match.matchOrder,
});

/*
 * ============================================================
 * FINALE - TEMPI SUPPLEMENTARI
 * ============================================================
 *
 * Le finali vengono disputate in gara secca.
 *
 * In caso di parità:
 *
 * tempi regolamentari
 *        ↓
 * tempi supplementari
 *        ↓
 * eventuali calci di rigore
 *
 * Questa validazione è eseguita anche lato service,
 * quindi non può essere aggirata dal Wizard.
 * ============================================================
 */

const isSingleMatchFinal =
  match.round ===
    "final" &&
  match.leg ===
    "single";

if (
  isSingleMatchFinal &&
  report.status ===
    "played"
) {
  const finalIsTied =
    report.homeScore ===
    report.awayScore;

  /*
   * ==========================================================
   * PARITÀ SENZA SUPPLEMENTARI
   * ==========================================================
   */

  if (
    finalIsTied &&
    report.extraTimePlayed !==
      true
  ) {
    throw new Error(
      "La finale è terminata in parità: devono essere giocati i tempi supplementari prima degli eventuali calci di rigore.",
    );
  }

  /*
   * ==========================================================
   * RIGORI CON RISULTATO NON IN PARITÀ
   * ==========================================================
   *
   * Se dopo il tempo di gioco esiste già una squadra
   * vincente, i calci di rigore non devono essere presenti.
   * ==========================================================
   */

  if (
    !finalIsTied &&
    (
      report.homePenalties !==
        undefined ||
      report.awayPenalties !==
        undefined
    )
  ) {
    throw new Error(
      "I calci di rigore possono essere inseriti solo se la finale è ancora in parità dopo i tempi supplementari.",
    );
  }
}

    /*
 * ========================================================
 * VALIDAZIONE QUALIFICAZIONE
 * ========================================================
 *
 * Prima di rendere ufficiale il Match Report
 * verifichiamo che una gara a eliminazione
 * diretta produca uno stato coerente.
 *
 * In particolare:
 *
 * - gara secca pari -> rigori obbligatori;
 * - andata -> nessuna qualificazione;
 * - ritorno -> risultato aggregato;
 * - aggregato pari -> rigori obbligatori;
 * - ritorno senza andata valida -> pubblicazione bloccata.
 *
 * Il controllo avviene PRIMA del commit atomico:
 * nessun risultato incoerente può diventare ufficiale.
 * ========================================================
 */

let seasonMatchesForAdvancement:
  FinalStageMatch[] =
    [];

if (
  report.status !==
    "postponed" &&
  match.round !==
    "group"
) {
  if (
    report.status !==
      "played" &&
    report.status !==
      "walkover"
  ) {
    throw new Error(
      "Una partita delle fasi finali può essere pubblicata come giocata, vittoria a tavolino o rinviata.",
    );
  }

  /*
   * Costruiamo l'anteprima esatta del documento
   * che diventerebbe ufficiale dopo la pubblicazione.
   */
  const previewMatch:
    FinalStageMatch = {
    ...match,

    status:
      report.status,

    published:
      true,

    homeScore:
      report.homeScore,

    awayScore:
      report.awayScore,

    extraTimePlayed:
  report.extraTimePlayed ===
  true,

    homePenalties:
      report.homePenalties,

    awayPenalties:
      report.awayPenalties,
  };

  seasonMatchesForAdvancement =
  await FirebaseFinalStageMatchRepository
    .getBySeason(
      match.seasonId,
    );

const seasonMatches =
  seasonMatchesForAdvancement;

  const qualification =
    resolveFinalStageQualification({
      match:
        previewMatch,

      allMatches:
        seasonMatches,
    });

  /*
   * ======================================================
   * ANDATA
   * ======================================================
   *
   * È corretto che dopo l'andata non esista
   * ancora una squadra qualificata.
   * ======================================================
   */

  if (
    match.leg ===
    "first"
  ) {
    if (
      qualification.status !==
        "pending" ||
      qualification.reason !==
        "secondLegRequired"
    ) {
      throw new Error(
        "La gara di andata non presenta uno stato valido per la pubblicazione.",
      );
    }
  }

  /*
   * ======================================================
   * GARA SECCA / RITORNO
   * ======================================================
   */

  if (
    match.leg ===
      "single" ||
    match.leg ===
      "second"
  ) {
    if (
      qualification.status ===
      "penaltiesRequired"
    ) {
      throw new Error(
        match.leg ===
          "second"
          ? "Il risultato aggregato è in parità: inserisci il risultato dei calci di rigore prima di pubblicare."
          : "La partita è terminata in parità: inserisci il risultato dei calci di rigore prima di pubblicare.",
      );
    }

    if (
      qualification.status ===
      "pending"
    ) {
      if (
        qualification.reason ===
        "firstLegNotCompleted"
      ) {
        throw new Error(
          "Non puoi pubblicare il ritorno prima che la gara di andata sia conclusa e pubblicata.",
        );
      }

      throw new Error(
        "Il confronto non è ancora completo e non può produrre una qualificazione.",
      );
    }

    if (
      qualification.status !==
      "qualified"
    ) {
      throw new Error(
        "Impossibile determinare la squadra qualificata.",
      );
    }
  }
}

    /*
     * ========================================================
     * PUBBLICAZIONE ATOMICA
     * ========================================================
     *
     * Match Report e stato/risultato della
     * partita vengono pubblicati nello stesso
     * commit Firestore.
     *
     * In questo modo non può esistere:
     *
     * - un report pubblicato senza match aggiornato;
     * - un match aggiornato senza report pubblicato.
     * ========================================================
     */

    const version = await AtomicMatchPublicationService
      .publishFinalStageMatch({
        match,
        report,
        expectedVersion,
      });
      
    /*
 * ========================================================
 * STATO POST-PUBBLICAZIONE
 * ========================================================
 *
 * Il parametro "match" contiene ancora lo stato precedente
 * alla pubblicazione.
 *
 * Creiamo quindi in memoria la versione esatta appena
 * pubblicata, senza effettuare una seconda lettura Firestore.
 * ========================================================
 */

    const work = () => this.processPublished({match,report,seasonMatchesForAdvancement});
    try {
      return typeof version === "number"
        ? await PublicationJobService.run("final",String(match.id),version,work)
        : await work();
    } catch (error) {
      console.error("Tabellino pubblicato; elaborazione fasi finali da recuperare",error);
      return {success:true,matchId:String(match.id),reportStatus:"published",processing:{status:"failed",error:error instanceof Error?error.message:"Elaborazione non completata"}};
    }
  }

  static async processPublished({match,report,seasonMatchesForAdvancement}: {
    match: FinalStageMatch; report: MatchWizardData; seasonMatchesForAdvancement: FinalStageMatch[];
  }): Promise<PublishFinalStageMatchResult> {
const publishedMatch:
  FinalStageMatch = {
  ...match,

  status:
    report.status,

  published:
    true,

  homeScore:
    report.homeScore,

  awayScore:
    report.awayScore,

  extraTimePlayed:
  report.extraTimePlayed ===
  true,

  homePenalties:
    report.homePenalties,

  awayPenalties:
    report.awayPenalties,
};

const seasonMatchesAfterPublication =
  seasonMatchesForAdvancement
    .some(
      (
        currentMatch,
      ) =>
        String(
          currentMatch.id,
        ) ===
        String(
          match.id,
        ),
    )
    ? seasonMatchesForAdvancement
        .map(
          (
            currentMatch,
          ) =>
            String(
              currentMatch.id,
            ) ===
            String(
              match.id,
            )
              ? publishedMatch
              : currentMatch,
        )
    : [
        ...seasonMatchesForAdvancement,
        publishedMatch,
      ];

      /*
 * ========================================================
 * AVANZAMENTO TABELLONE
 * ========================================================
 */

let advancement:
  FinalStageBracketAdvancementPlan |
  undefined;

const canAdvanceBracket =
  (
    publishedMatch.round ===
      "quarterfinal" ||
    publishedMatch.round ===
      "semifinal"
  ) &&
  (
    publishedMatch.leg ===
      "single" ||
    publishedMatch.leg ===
      "second"
  ) &&
  (
    publishedMatch.status ===
      "played" ||
    publishedMatch.status ===
      "finished" ||
    publishedMatch.status ===
      "walkover"
  );

if (
  canAdvanceBracket
) {
  advancement =
    planFinalStageBracketAdvancement({
      sourceMatch:
        publishedMatch,

      allMatches:
        seasonMatchesAfterPublication,
    });
}

    /*
     * ========================================================
     * PARTITA RINVIATA
     * ========================================================
     *
     * La pubblicazione atomica è già stata
     * completata.
     *
     * Una partita rinviata non deve:
     *
     * - scontare squalifiche;
     * - processare cartellini;
     * - generare nuova disciplina.
     * ========================================================
     */

    if (
      report.status ===
      "postponed"
    ) {
      return {
        success:
          true,

        matchId:
          String(
            match.id,
          ),

        reportStatus:
          "published",

        advancement,
      };
    }

    /*
     * ========================================================
     * DISCIPLINA FASI FINALI
     * ========================================================
     *
     * Le fasi finali utilizzano lo stesso
     * motore disciplinare della Regular Season.
     *
     * Non viene passata alcuna Matchweek:
     *
     * - l'idempotenza usa il matchId;
     * - lo sconto delle squalifiche usa il matchId;
     * - i nuovi cartellini vengono associati
     *   direttamente alla partita.
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
     * IMPORTANTE
     * ========================================================
     *
     * Il processamento disciplinare viene
     * eseguito sopra tramite il servizio
     * dedicato e condiviso.
     *
     * Continuiamo invece a NON avviare:
     *
     * - loadMatchPublishingContext
     * - buildMatchProcessingContext
     * - createMatchProcessingOrchestrator
     *
     * perché quel processamento generale è
     * ancora costruito specificamente per la
     * Regular Season.
     *
     * Statistiche e ranking delle fasi finali
     * continuano ad essere gestiti dai relativi
     * servizi dedicati.
     * ========================================================
     */

    return {
      success:
        true,

      matchId:
        String(
          match.id,
        ),

      reportStatus:
        "published",

      advancement,
    };
  }
}