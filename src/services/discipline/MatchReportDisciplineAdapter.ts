import type {
  MatchweekDisciplinaryPlayer,
} from "@/src/services/discipline/DisciplinaryEngine";

import type {
  MatchWizardData,
  MatchWizardPlayerPerformance,
} from "@/src/types/MatchWizardData";

/*
 * ============================================================
 * SERVICE
 * ============================================================
 */

export const MatchReportDisciplineAdapter =
  {
    extract(
      report:
        MatchWizardData,
    ): MatchweekDisciplinaryPlayer[] {
      const matchId =
        String(
          report.matchId,
        ).trim();

      if (
        !matchId
      ) {
        throw new Error(
          "Il Match Report disciplinare non ha un matchId valido.",
        );
      }

      const performances =
        Object.values(
          report.performances ??
            {},
        ) as
          MatchWizardPlayerPerformance[];

      const playersById =
        new Map<
          string,
          MatchweekDisciplinaryPlayer
        >();

      performances.forEach(
        (
          performance,
        ) => {
          const playerId =
            String(
              performance.playerId ??
                "",
            ).trim();

          const teamId =
            String(
              performance.teamId ??
                "",
            ).trim();

          if (
            !playerId ||
            !teamId
          ) {
            return;
          }

          /*
           * ==================================================
           * CARTELLINI GIALLI
           * ==================================================
           *
           * Massimo 2 nella stessa partita.
           *
           * Il secondo giallo continua a essere
           * conteggiato come giallo disciplinare.
           * ==================================================
           */

          const yellowCards =
            sanitizeYellowCards(
              performance.yellowCards,
            );

          /*
           * ==================================================
           * ROSSO DIRETTO
           * ==================================================
           *
           * ATTENZIONE:
           *
           * NON usiamo performance.redCards.
           *
           * Quel campo rappresenta il conteggio
           * complessivo statistico dei rossi e
           * può comprendere anche un'espulsione
           * per doppia ammonizione.
           *
           * Soltanto directRedCards genera
           * automaticamente una squalifica
           * per rosso diretto.
           * ==================================================
           */

          const directRedCards =
            sanitizeDirectRedCards(
              performance
                .directRedCards,
            );

          if (
            yellowCards ===
              0 &&
            directRedCards ===
              0
          ) {
            return;
          }

          const existing =
            playersById.get(
              playerId,
            );

          /*
           * Lo stesso giocatore non può
           * appartenere a due squadre diverse
           * nella stessa partita.
           */
          if (
            existing &&
            existing.teamId !==
              teamId
          ) {
            throw new Error(
              `Il giocatore ${playerId} risulta associato a più squadre nello stesso Match Report.`,
            );
          }

          if (
            !existing
          ) {
            playersById.set(
              playerId,
              {
                playerId,

                /*
                 * I nomi reali verranno
                 * risolti dal servizio
                 * dedicato prima del
                 * processamento persistente.
                 */
                playerName:
                  playerId,

                teamId,

                teamName:
                  teamId,

                yellowCards,

                directRedCards,

                sourceMatchId:
                  matchId,
              },
            );

            return;
          }

          /*
           * Difesa da eventuali duplicati
           * anomali nelle performances.
           *
           * Usiamo il massimo e non la somma,
           * per non conteggiare due volte lo
           * stesso cartellino.
           */
          playersById.set(
            playerId,
            {
              ...existing,

              yellowCards:
                Math.max(
                  existing
                    .yellowCards,

                  yellowCards,
                ),

              directRedCards:
                Math.max(
                  existing
                    .directRedCards,

                  directRedCards,
                ),
            },
          );
        },
      );

      return Array.from(
        playersById.values(),
      );
    },
  };

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function sanitizeYellowCards(
  value:
    unknown,
): number {
  const numericValue =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      numericValue,
    ) ||
    numericValue <=
      0
  ) {
    return 0;
  }

  return Math.min(
    2,

    Math.floor(
      numericValue,
    ),
  );
}

function sanitizeDirectRedCards(
  value:
    unknown,
): number {
  const numericValue =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      numericValue,
    ) ||
    numericValue <=
      0
  ) {
    return 0;
  }

  return 1;
}