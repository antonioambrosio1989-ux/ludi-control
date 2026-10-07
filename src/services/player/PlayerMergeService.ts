import {
  FirebaseHallOfChampionsRepository,
} from "@/src/services/awards/FirebaseHallOfChampionsRepository";

import {
  FirebaseHallOfFameRepository,
} from "@/src/services/awards/FirebaseHallOfFameRepository";

import {
  FirebaseHistoricalPlayerStatsRepository,
} from "@/src/services/player/FirebaseHistoricalPlayerStatsRepository";

import {
  FirebasePlayerRepository,
} from "@/src/services/player/FirebasePlayerRepository";

import {
  FirebaseSeasonPlayerRepository,
} from "@/src/services/player/FirebaseSeasonPlayerRepository";

import {
  FirebaseMatchReportRepository,
} from "@/src/services/match/FirebaseMatchReportRepository"
/*
 * ============================================================
 * INPUT
 * ============================================================
 */

export type MergePlayerProfilesInput = {
  /*
   * Profilo principale da mantenere.
   */
  targetPlayerId: string;

  /*
   * Profilo duplicato da assorbire
   * e successivamente eliminare.
   */
  sourcePlayerId: string;
  currentSeasonId?: string;
};

/*
 * ============================================================
 * RISULTATO
 * ============================================================
 */

export type MergePlayerProfilesResult = {
  targetPlayerId: string;
  sourcePlayerId: string;

  targetPlayerName: string;
  sourcePlayerName: string;
};

/*
 * ============================================================
 * SERVICE
 * ============================================================
 */

export class PlayerMergeService {
  static async merge({
    targetPlayerId,
    sourcePlayerId,
    currentSeasonId,
  }: MergePlayerProfilesInput): Promise<
    MergePlayerProfilesResult
  > {
    let normalizedTargetPlayerId =
      targetPlayerId.trim();

    let normalizedSourcePlayerId =
      sourcePlayerId.trim();

    /*
     * ========================================================
     * VALIDAZIONE ID
     * ========================================================
     */

    if (
      !normalizedTargetPlayerId ||
      !normalizedSourcePlayerId
    ) {
      throw new Error(
        "Seleziona entrambi i profili da unire.",
      );
    }

    if (
      normalizedTargetPlayerId ===
      normalizedSourcePlayerId
    ) {
      throw new Error(
        "Il profilo principale e il profilo duplicato devono essere diversi.",
      );
    }

    /*
 * ========================================================
 * PROFILO STAGIONE CORRENTE SEMPRE PRINCIPALE
 * ========================================================
 *
 * Se soltanto uno dei due giocatori appartiene
 * alla stagione corrente, quel profilo viene
 * automaticamente mantenuto come target.
 *
 * Questo evita di cambiare il playerId utilizzato
 * dai match report della stagione in corso.
 * ========================================================
 */

if (
  currentSeasonId?.trim()
) {
  const currentSeasonPlayers =
    await FirebaseSeasonPlayerRepository.getBySeasonId(
      currentSeasonId.trim(),
    );

  const targetIsCurrent =
    currentSeasonPlayers.some(
      (seasonPlayer) =>
        String(
          seasonPlayer.playerId,
        ) ===
        String(
          normalizedTargetPlayerId,
        ),
    );

  const sourceIsCurrent =
    currentSeasonPlayers.some(
      (seasonPlayer) =>
        String(
          seasonPlayer.playerId,
        ) ===
        String(
          normalizedSourcePlayerId,
        ),
    );

  /*
   * L'utente aveva scelto come principale
   * il profilo storico, mentre il duplicato
   * appartiene alla stagione corrente.
   *
   * Invertiamo automaticamente i due ID.
   */
  if (
    !targetIsCurrent &&
    sourceIsCurrent
  ) {
    const previousTarget =
      normalizedTargetPlayerId;

    normalizedTargetPlayerId =
      normalizedSourcePlayerId;

    normalizedSourcePlayerId =
      previousTarget;
  }
}

    /*
     * ========================================================
     * RECUPERO PROFILI
     * ========================================================
     */

    const [
      targetPlayer,
      sourcePlayer,
    ] =
      await Promise.all([
        FirebasePlayerRepository.getByIdWithPrivate(
          normalizedTargetPlayerId,
        ),

        FirebasePlayerRepository.getByIdWithPrivate(
          normalizedSourcePlayerId,
        ),
      ]);

    if (
      !targetPlayer
    ) {
      throw new Error(
        "Il profilo principale non esiste.",
      );
    }

    if (
      !sourcePlayer
    ) {
      throw new Error(
        "Il profilo duplicato non esiste.",
      );
    }

    if (
      targetPlayer.competitionId !==
        sourcePlayer.competitionId
    ) {
      throw new Error(
        "Non è possibile unire profili appartenenti a competizioni diverse.",
      );
    }

    const targetPlayerName =
      `${targetPlayer.firstName} ${targetPlayer.lastName}`.trim();

    const sourcePlayerName =
      `${sourcePlayer.firstName} ${sourcePlayer.lastName}`.trim();

    /*
     * ========================================================
     * CONTROLLO IDENTITÀ
     * ========================================================
     *
     * Non blocchiamo necessariamente nomi diversi,
     * perché l'admin potrebbe voler correggere anche
     * un refuso.
     *
     * Blocchiamo invece un conflitto evidente
     * sull'anno di nascita quando entrambi sono presenti.
     * ========================================================
     */

    if (
      targetPlayer.birthYear !==
        undefined &&
      sourcePlayer.birthYear !==
        undefined &&
      targetPlayer.birthYear !==
        sourcePlayer.birthYear
    ) {
      throw new Error(
        [
          "I due profili hanno anni di nascita differenti.",
          "",
          `${targetPlayerName}: ${targetPlayer.birthYear}`,
          `${sourcePlayerName}: ${sourcePlayer.birthYear}`,
          "",
          "Verifica che si tratti realmente della stessa persona prima di procedere.",
        ].join(
          "\n",
        ),
      );
    }

    /*
     * ========================================================
     * 1. COMPLETAMENTO PROFILO PRINCIPALE
     * ========================================================
     *
     * Se il duplicato possiede foto, anno di nascita,
     * piede preferito o altri dati mancanti nel target,
     * li trasferiamo.
     *
     * Il profilo principale ha sempre priorità.
     * ========================================================
     */

    await FirebasePlayerRepository.mergeProfileData({
      targetPlayerId:
        normalizedTargetPlayerId,

      sourcePlayerId:
        normalizedSourcePlayerId,
    });

    /*
     * ========================================================
     * 2. STATISTICHE STORICHE
     * ========================================================
     *
     * historicalPlayerSeasonStats utilizza documentId:
     *
     * seasonId__playerId
     *
     * quindi il repository gestisce autonomamente
     * ricreazione / fusione dei documenti.
     * ========================================================
     */

    await FirebaseHistoricalPlayerStatsRepository.mergePlayerReferences({
      sourcePlayerId:
        normalizedSourcePlayerId,

      targetPlayerId:
        normalizedTargetPlayerId,
    });

    await FirebaseHallOfFameRepository.deduplicatePlayerAwards(
  normalizedTargetPlayerId,
);

    /*
     * ========================================================
     * 3. SEASON PLAYERS
     * ========================================================
     *
     * Aggiorniamo tutte le associazioni stagionali.
     *
     * Se entrambi i profili risultano già presenti
     * nella stessa stagione, il repository gestisce
     * il conflitto.
     * ========================================================
     */

    await FirebaseSeasonPlayerRepository.mergePlayerReferences({
      sourcePlayerId:
        normalizedSourcePlayerId,

      targetPlayerId:
        normalizedTargetPlayerId,
    });

/*
     * ========================================================
     * 4. MATCH REPORT STAGIONE CORRENTE
     * ========================================================
     *
     * I tabellini contengono riferimenti diretti
     * al playerId.
     *
     * Devono essere migrati PRIMA
     * dell'eliminazione del profilo duplicato,
     * altrimenti:
     *
     * - il giocatore scompare dal tabellino
     * - le statistiche correnti si azzerano
     * - il nome può diventare "Giocatore"
     * ========================================================
     */

    await FirebaseMatchReportRepository.mergePlayerReferences({
      sourcePlayerId:
        normalizedSourcePlayerId,

      targetPlayerId:
        normalizedTargetPlayerId,
    });

    /*
     * ========================================================
     * 5. HALL OF FAME
     * ========================================================
     *
     * Tutte le premiazioni individuali devono
     * continuare a puntare allo stesso profilo.
     * ========================================================
     */

    await FirebaseHallOfFameRepository.mergePlayerReferences({
      sourcePlayerId:
        normalizedSourcePlayerId,

      targetPlayerId:
        normalizedTargetPlayerId,
    });

    await FirebaseHallOfFameRepository.deduplicatePlayerAwards(
        normalizedTargetPlayerId,
  );

    /*
     * ========================================================
     * 6. ALBO D'ORO
     * ========================================================
     *
     * Aggiorniamo:
     *
     * - roster[].playerId
     * - finalReport.homePlayers[].playerId
     * - finalReport.awayPlayers[].playerId
     * ========================================================
     */

    await FirebaseHallOfChampionsRepository.mergePlayerReferences({
      sourcePlayerId:
        normalizedSourcePlayerId,

      targetPlayerId:
        normalizedTargetPlayerId,
    });

    /*
     * ========================================================
     * 7. CONTROLLO FINALE
     * ========================================================
     *
     * Verifichiamo che il target esista ancora prima
     * di eliminare definitivamente il duplicato.
     * ========================================================
     */

    const targetAfterMerge =
      await FirebasePlayerRepository.getByIdWithPrivate(
        normalizedTargetPlayerId,
      );

    if (
      !targetAfterMerge
    ) {
      throw new Error(
        "Errore durante l'unione: il profilo principale non è più disponibile.",
      );
    }

    /*
     * ========================================================
     * 8. ELIMINAZIONE PROFILO DUPLICATO
     * ========================================================
     *
     * Questo avviene SOLTANTO dopo che tutti
     * i riferimenti principali sono stati migrati.
     * ========================================================
     */

    await FirebasePlayerRepository.remove(
      normalizedSourcePlayerId,
    );

    return {
      targetPlayerId:
        normalizedTargetPlayerId,

      sourcePlayerId:
        normalizedSourcePlayerId,

      targetPlayerName,

      sourcePlayerName,
    };
  }
}