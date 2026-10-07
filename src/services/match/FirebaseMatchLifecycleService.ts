import {
  FirebaseMatchRepository,
} from "@/src/services/match/FirebaseMatchRepository";

import {
  assertLiveScore,
  selectAutomaticLiveMatch,
} from "@/src/services/match/MatchLifecycleRules";

import type {
  Match,
} from "@/src/types/Match";

export type AutomaticLiveSyncResult =
  | {
      status:
        "already-live";
      match:
        Match;
    }
  | {
      status:
        "started";
      match:
        Match;
    }
  | {
      status:
        "idle";
    };

/*
 * ============================================================
 * MATCH LIFECYCLE SERVICE
 * ============================================================
 *
 * Responsabilità:
 *
 * 1. avvio automatico a orario calendario + 15 minuti;
 * 2. una sola partita LIVE per il matchday;
 * 3. aggiornamento punteggio esclusivamente mentre è LIVE;
 * 4. fine partita manuale LIVE -> FINISHED;
 * 5. ripristino manuale FINISHED -> LIVE.
 *
 * Nessun timer chiude automaticamente la partita.
 * ============================================================
 */
export const FirebaseMatchLifecycleService = {
  async syncAutomaticLiveState({
    seasonId,
    currentTime =
      new Date(),
  }: {
    seasonId: string;
    currentTime?: Date;
  }): Promise<
    AutomaticLiveSyncResult
  > {
    const normalizedSeasonId =
      seasonId.trim();

    if (!normalizedSeasonId) {
      throw new Error(
        "La stagione non è stata specificata.",
      );
    }

    const matches =
      await FirebaseMatchRepository.getBySeason(
        normalizedSeasonId,
      );

    const selection =
      selectAutomaticLiveMatch({
        matches,
        currentTime,
      });

    if (
      selection.status ===
      "idle"
    ) {
      return selection;
    }

    if (
      selection.status ===
      "already-live"
    ) {
      return selection;
    }

    const match =
      selection.match;

    try {
      await FirebaseMatchRepository.transitionLifecycle({
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
       * Due client possono sincronizzare nello stesso istante.
       * La transaction del repository lascia vincere una sola
       * scrittura. Il secondo client rilegge lo stato e, se una
       * gara risulta già live, restituisce un esito idempotente
       * invece di trasformare una race corretta in errore UI.
       */
      const refreshedMatches =
        await FirebaseMatchRepository.getBySeason(
          normalizedSeasonId,
        );

      const refreshedSelection =
        selectAutomaticLiveMatch({
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
        "started",
      match: {
        ...match,
        status:
          "live",
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
    matchId,
    homeScore,
    awayScore,
  }: {
    matchId: string;
    homeScore: number;
    awayScore: number;
  }): Promise<void> {
    assertLiveScore(
      homeScore,
      awayScore,
    );

    await FirebaseMatchRepository.updateLiveScore({
      matchId,
      homeScore,
      awayScore,
    });
  },

  async finishMatch({
    matchId,
  }: {
    matchId: string;
  }): Promise<void> {
    const match =
      await requireMatch(
        matchId,
      );

    if (
      match.status !==
      "live"
    ) {
      throw new Error(
        "Puoi terminare soltanto una partita attualmente live.",
      );
    }

    await FirebaseMatchRepository.transitionLifecycle({
      matchId:
        String(
          match.id,
        ),
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
  },

  async restoreLive({
    matchId,
  }: {
    matchId: string;
  }): Promise<void> {
    const match =
      await requireMatch(
        matchId,
      );

    if (
      match.status !==
      "finished"
    ) {
      throw new Error(
        "Il ripristino live è disponibile soltanto dopo Fine partita.",
      );
    }

    await FirebaseMatchRepository.transitionLifecycle({
      matchId:
        String(
          match.id,
        ),
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
  },
};

async function requireMatch(
  matchId: string,
): Promise<Match> {
  const normalizedMatchId =
    String(
      matchId ?? "",
    ).trim();

  if (!normalizedMatchId) {
    throw new Error(
      "La partita non è stata specificata.",
    );
  }

  const match =
    await FirebaseMatchRepository.getById(
      normalizedMatchId,
    );

  if (!match) {
    throw new Error(
      "La partita selezionata non esiste.",
    );
  }

  return match;
}
