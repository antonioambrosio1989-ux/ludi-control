import type {
  FinalStageMatch,
} from "@/src/types/FinalStageMatch";

/*
 * ============================================================
 * CANDIDATE
 * ============================================================
 */

export type FinalStageTwoLegTieCandidate =
  Pick<
    FinalStageMatch,
    | "seasonId"
    | "competition"
    | "round"
    | "leg"
    | "matchOrder"
    | "homeTeamId"
    | "awayTeamId"
  > & {
    id?:
      string;
  };

/*
 * ============================================================
 * VALIDATOR
 * ============================================================
 */

export function assertFinalStageTwoLegTieConsistency({
  candidate,
  allMatches,
}: {
  candidate:
    FinalStageTwoLegTieCandidate;

  allMatches:
    FinalStageMatch[];
}): void {
  /*
   * ==========================================================
   * SOLO QUARTI / SEMIFINALI
   * ==========================================================
   *
   * Il formato ufficiale viene già validato dal
   * FinalStageCompetitionFormatResolver.
   *
   * Qui controlliamo solamente la coerenza tra
   * le due gare dello stesso doppio confronto.
   * ==========================================================
   */

  if (
    candidate.round !==
      "quarterfinal" &&
    candidate.round !==
      "semifinal"
  ) {
    return;
  }

  if (
    candidate.leg !==
      "first" &&
    candidate.leg !==
      "second"
  ) {
    return;
  }

  if (
    candidate.matchOrder ===
      undefined ||
    !Number.isInteger(
      candidate.matchOrder,
    ) ||
    candidate.matchOrder <
      1
  ) {
    throw new Error(
      "Il doppio confronto richiede un ordine partita valido.",
    );
  }

  /*
   * ==========================================================
   * PARTITE DELLO STESSO DOPPIO CONFRONTO
   * ==========================================================
   */

  const sameTieMatches =
    allMatches.filter(
      (
        match,
      ) => {
        if (
          candidate.id &&
          String(
            match.id,
          ) ===
            String(
              candidate.id,
            )
        ) {
          return false;
        }

        return (
          String(
            match.seasonId,
          ) ===
            String(
              candidate.seasonId,
            ) &&
          match.competition ===
            candidate.competition &&
          match.round ===
            candidate.round &&
          match.matchOrder ===
            candidate.matchOrder
        );
      },
    );

  /*
   * ==========================================================
   * UNA SOLA ANDATA / UN SOLO RITORNO
   * ==========================================================
   */

  const sameLegMatches =
    sameTieMatches.filter(
      (
        match,
      ) =>
        match.leg ===
        candidate.leg,
    );

  if (
    sameLegMatches.length >
    0
  ) {
    throw new Error(
      candidate.leg ===
        "first"
        ? "Esiste già la gara di andata di questo doppio confronto."
        : "Esiste già la gara di ritorno di questo doppio confronto.",
    );
  }

  const oppositeLeg =
    candidate.leg ===
      "first"
      ? "second"
      : "first";

  const oppositeMatches =
    sameTieMatches.filter(
      (
        match,
      ) =>
        match.leg ===
        oppositeLeg,
    );

  if (
    oppositeMatches.length >
    1
  ) {
    throw new Error(
      "Il doppio confronto contiene più di una gara per la stessa fase.",
    );
  }

  /*
   * ==========================================================
   * NESSUNA CONTROPARTE ANCORA PRESENTE
   * ==========================================================
   */

  if (
    oppositeMatches.length ===
    0
  ) {
    return;
  }

  const oppositeMatch =
    oppositeMatches[0];

  /*
   * ==========================================================
   * STESSE SQUADRE
   * ==========================================================
   *
   * Non imponiamo l'inversione casa/trasferta.
   *
   * L'unica regola strutturale è che le due gare
   * appartengano alle stesse due squadre.
   * ==========================================================
   */

  if (
    !haveSameTeamSet(
      candidate,
      oppositeMatch,
    )
  ) {
    throw new Error(
      "La gara di andata e la gara di ritorno devono coinvolgere le stesse squadre.",
    );
  }
}

/*
 * ============================================================
 * UPDATE CONSISTENCY
 * ============================================================
 *
 * Oltre a validare la nuova configurazione della partita,
 * protegge un doppio confronto già formato.
 *
 * Se esiste già la gara opposta, non è consentito
 * modificare una sola delle due partite in modo da:
 *
 * - cambiare competizione;
 * - cambiare turno;
 * - cambiare matchOrder;
 * - cambiare le squadre del confronto;
 * - trasformare andata/ritorno in un altro tipo di gara.
 * ============================================================
 */

export function assertFinalStageTwoLegTieUpdateConsistency({
  existingMatch,
  candidate,
  allMatches,
}: {
  existingMatch:
    FinalStageMatch;

  candidate:
    FinalStageTwoLegTieCandidate;

  allMatches:
    FinalStageMatch[];
}): void {
  /*
   * ==========================================================
   * VALIDAZIONE DELLA NUOVA CONFIGURAZIONE
   * ==========================================================
   */

  assertFinalStageTwoLegTieConsistency({
    candidate: {
      ...candidate,

      id:
        existingMatch.id,
    },

    allMatches,
  });

  /*
   * ==========================================================
   * LA PARTITA ORIGINALE NON APPARTENEVA A UN DOPPIO CONFRONTO
   * ==========================================================
   */

  if (
    existingMatch.round !==
      "quarterfinal" &&
    existingMatch.round !==
      "semifinal"
  ) {
    return;
  }

  if (
    existingMatch.leg !==
      "first" &&
    existingMatch.leg !==
      "second"
  ) {
    return;
  }

  /*
   * ==========================================================
   * CERCA LA GARA OPPOSTA DEL VECCHIO CONFRONTO
   * ==========================================================
   */

  const oppositeLeg =
    existingMatch.leg ===
      "first"
      ? "second"
      : "first";

  const existingOppositeMatches =
    allMatches.filter(
      (
        match,
      ) =>
        String(
          match.id,
        ) !==
          String(
            existingMatch.id,
          ) &&
        String(
          match.seasonId,
        ) ===
          String(
            existingMatch.seasonId,
          ) &&
        match.competition ===
          existingMatch.competition &&
        match.round ===
          existingMatch.round &&
        match.matchOrder ===
          existingMatch.matchOrder &&
        match.leg ===
          oppositeLeg,
    );

  if (
    existingOppositeMatches.length >
    1
  ) {
    throw new Error(
      "Il doppio confronto contiene più di una gara opposta.",
    );
  }

  /*
   * ==========================================================
   * LA COPPIA NON È ANCORA FORMATA
   * ==========================================================
   *
   * Se la gara opposta non esiste ancora, la partita può
   * essere riposizionata purché la nuova configurazione sia
   * valida.
   * ==========================================================
   */

  if (
    existingOppositeMatches.length ===
    0
  ) {
    return;
  }

  const oppositeMatch =
    existingOppositeMatches[0];

  /*
   * ==========================================================
   * PROTEZIONE DELLA COPPIA ESISTENTE
   * ==========================================================
   */

  const keepsSameTie =
    candidate.competition ===
      oppositeMatch.competition &&
    candidate.round ===
      oppositeMatch.round &&
    candidate.matchOrder ===
      oppositeMatch.matchOrder &&
    (
      candidate.leg ===
        "first" ||
      candidate.leg ===
        "second"
    ) &&
    candidate.leg !==
      oppositeMatch.leg &&
    haveSameTeamSet(
      candidate,
      oppositeMatch,
    );

  if (
    !keepsSameTie
  ) {
    throw new Error(
      "Non puoi modificare la struttura di una gara senza mantenere coerente il relativo doppio confronto.",
    );
  }
}

/*
 * ============================================================
 * REMOVE CONSISTENCY
 * ============================================================
 *
 * Una gara di un doppio confronto non può essere eliminata
 * se esiste già la relativa gara opposta.
 *
 * In questo modo non possiamo lasciare:
 *
 * - un ritorno senza andata;
 * - un'andata senza ritorno.
 * ============================================================
 */

export function assertFinalStageTwoLegTieRemovalConsistency({
  match,
  allMatches,
}: {
  match:
    FinalStageMatch;

  allMatches:
    FinalStageMatch[];
}): void {
  if (
    match.round !==
      "quarterfinal" &&
    match.round !==
      "semifinal"
  ) {
    return;
  }

  if (
    match.leg !==
      "first" &&
    match.leg !==
      "second"
  ) {
    return;
  }

  const oppositeLeg =
    match.leg ===
      "first"
      ? "second"
      : "first";

  const oppositeMatch =
    allMatches.find(
      (
        currentMatch,
      ) =>
        String(
          currentMatch.id,
        ) !==
          String(
            match.id,
          ) &&
        String(
          currentMatch.seasonId,
        ) ===
          String(
            match.seasonId,
          ) &&
        currentMatch.competition ===
          match.competition &&
        currentMatch.round ===
          match.round &&
        currentMatch.matchOrder ===
          match.matchOrder &&
        currentMatch.leg ===
          oppositeLeg,
    );

  if (
    oppositeMatch
  ) {
    throw new Error(
      "Non puoi eliminare una sola gara di un doppio confronto già formato.",
    );
  }
}

/*
 * ============================================================
 * TEAM SET
 * ============================================================
 */

function haveSameTeamSet(
  first: {
    homeTeamId:
      string | number;

    awayTeamId:
      string | number;
  },

  second: {
    homeTeamId:
      string | number;

    awayTeamId:
      string | number;
  },
): boolean {
  const firstTeams =
    new Set([
      String(
        first.homeTeamId,
      ),

      String(
        first.awayTeamId,
      ),
    ]);

  const secondTeams =
    new Set([
      String(
        second.homeTeamId,
      ),

      String(
        second.awayTeamId,
      ),
    ]);

  if (
    firstTeams.size !==
      2 ||
    secondTeams.size !==
      2
  ) {
    return false;
  }

  return Array.from(
    firstTeams,
  ).every(
    (
      teamId,
    ) =>
      secondTeams.has(
        teamId,
      ),
  );
}