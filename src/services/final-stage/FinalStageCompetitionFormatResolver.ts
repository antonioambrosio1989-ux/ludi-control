import type {
  FinalStageCompetition,
  FinalStageLeg,
  FinalStageRound,
} from "@/src/types/FinalStageMatch";

/*
 * ============================================================
 * TYPES
 * ============================================================
 */

export type FinalStageTieFormat =
  | "twoLeg"
  | "single";

export type FinalStageTieBreaker =
  | "aggregatePenalties"
  | "extraTimeThenPenalties";

export type FinalStageRoundFormat = {
  competition:
    FinalStageCompetition;

  round:
    "quarterfinal" |
    "semifinal" |
    "final";

  tieFormat:
    FinalStageTieFormat;

  allowedLegs:
    FinalStageLeg[];

  tieBreaker:
    FinalStageTieBreaker;

  requiresMatchOrder:
    true;
};

/*
 * ============================================================
 * COMPETITIONS
 * ============================================================
 */

const SUPPORTED_COMPETITIONS:
  FinalStageCompetition[] = [
    "championsLeague",
    "europaLeague",
    "conferenceLeague",
    "ludiFootballLeagueCup",
  ];

/*
 * ============================================================
 * RESOLVER
 * ============================================================
 */

export function resolveFinalStageRoundFormat({
  competition,
  round,
}: {
  competition:
    FinalStageCompetition;

  round:
    FinalStageRound;
}): FinalStageRoundFormat {
  if (
    !SUPPORTED_COMPETITIONS
      .includes(
        competition,
      )
  ) {
    throw new Error(
      "Competizione delle fasi finali non riconosciuta.",
    );
  }

  /*
   * La fase a gironi resta nel tipo legacy
   * per compatibilità con eventuali dati
   * precedenti, ma non è ammessa nel nuovo
   * formato delle Final Stage.
   */

  if (
    round ===
    "group"
  ) {
    throw new Error(
      "Le Final Stage attuali non prevedono una fase a gironi.",
    );
  }

  /*
   * ==========================================================
   * QUARTI / SEMIFINALI
   * ==========================================================
   *
   * Tutte le competizioni:
   *
   * - andata;
   * - ritorno;
   * - nessun gol in trasferta;
   * - parità aggregata -> rigori nel ritorno.
   * ==========================================================
   */

  if (
    round ===
      "quarterfinal" ||
    round ===
      "semifinal"
  ) {
    return {
      competition,

      round,

      tieFormat:
        "twoLeg",

      allowedLegs: [
        "first",
        "second",
      ],

      tieBreaker:
        "aggregatePenalties",

      requiresMatchOrder:
        true,
    };
  }

  /*
   * ==========================================================
   * FINALE
   * ==========================================================
   *
   * - gara secca;
   * - pareggio -> supplementari;
   * - ulteriore parità -> rigori.
   * ==========================================================
   */

  return {
    competition,

    round:
      "final",

    tieFormat:
      "single",

    allowedLegs: [
      "single",
    ],

    tieBreaker:
      "extraTimeThenPenalties",

    requiresMatchOrder:
      true,
  };
}

/*
 * ============================================================
 * VALIDATION
 * ============================================================
 */

export function assertFinalStageMatchFormat({
  competition,
  round,
  leg,
  matchOrder,
}: {
  competition:
    FinalStageCompetition;

  round:
    FinalStageRound;

  leg:
    FinalStageLeg;

  matchOrder?:
    number;
}): void {
  const format =
    resolveFinalStageRoundFormat({
      competition,
      round,
    });

  if (
    !format.allowedLegs
      .includes(
        leg,
      )
  ) {
    throw new Error(
      format.tieFormat ===
        "twoLeg"
        ? "Quarti e semifinali devono essere disputati con gara di andata e ritorno."
        : "La finale deve essere disputata in gara secca.",
    );
  }

  if (
    matchOrder ===
      undefined ||
    !Number.isInteger(
      matchOrder,
    ) ||
    matchOrder <
      1
  ) {
    throw new Error(
      "Per questo turno è obbligatorio indicare un ordine partita valido.",
    );
  }
}