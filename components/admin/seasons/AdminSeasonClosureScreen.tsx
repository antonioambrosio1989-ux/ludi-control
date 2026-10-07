"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  SeasonClosureService,
  type RegularSeasonClosurePreparation,
} from "@/src/services/season/SeasonClosureService";

import AppShell from "../../ui/AppShell";

import {
  TitlePlayoffCreationService,
} from "@/src/services/season/TitlePlayoffCreationService";

import {
  useTeams,
} from "@/src/hooks/useTeams";

import {
  useCompetition,
} from "@/src/contexts/CompetitionContext";

import { MATCH_TIMES } from "@/src/constants/matchTimes";

/*
 * ============================================================
 * SCREEN
 * ============================================================
 */

export default function AdminSeasonClosureScreen() {
  /*
   * ==========================================================
   * STAGIONE
   * ==========================================================
   */

  const {
  selectedCompetition,

  currentSeason,

  isLoading:
    seasonsLoading,

  error:
    seasonsError,
} =
  useCompetition();

  const currentSeasonId =
  currentSeason?.id ??
  null;

const regularSeasonClosed =
  currentSeason
    ?.regularSeasonClosed ===
  true;

  /*
 * ==========================================================
 * SQUADRE
 * ==========================================================
 */

const {
  teams,
} =
  useTeams();

function getTeamName(
  teamId:
    string,
): string {
  return (
    teams.find(
      (
        team,
      ) =>
        String(
          team.id,
        ) ===
        String(
          teamId,
        ),
    )?.name ??
    teamId
  );
}

  /*
   * ==========================================================
   * STATE
   * ==========================================================
   */

  const [
    isClosingRegularSeason,
    setIsClosingRegularSeason,
  ] =
    useState(false);

  const [
    isClosingFinalStage,
    setIsClosingFinalStage,
  ] =
    useState(false);

  const [
    actionError,
    setActionError,
  ] =
    useState<
      string | null
    >(null);

  const [
    actionMessage,
    setActionMessage,
  ] =
    useState<
      string | null
    >(null);

  /*
 * ==========================================================
 * PREPARAZIONE REGULAR SEASON
 * ==========================================================
 */

const [
  regularSeasonPreparation,
  setRegularSeasonPreparation,
] =
  useState<
    RegularSeasonClosurePreparation |
    null
  >(null);

const [
  isPreparingRegularSeason,
  setIsPreparingRegularSeason,
] =
  useState(false);

const [
  preparationError,
  setPreparationError,
] =
  useState<
    string | null
  >(null);

/*
 * ==========================================================
 * CREAZIONE SPAREGGIO
 * ==========================================================
 */

const [
  isCreatingTitlePlayoff,
  setIsCreatingTitlePlayoff,
] =
  useState(false);

const [
  playoffHomeTeamId,
  setPlayoffHomeTeamId,
] =
  useState("");

const [
  playoffAwayTeamId,
  setPlayoffAwayTeamId,
] =
  useState("");

const [
  playoffDate,
  setPlayoffDate,
] =
  useState("");

const [
  playoffTime,
  setPlayoffTime,
] =
  useState(
    "20:30",
  );

const [
  playoffVenue,
  setPlayoffVenue,
] =
  useState(
    "Centro Sportivo Ludi",
  );

  /*
   * ==========================================================
   * STATO GENERALE
   * ==========================================================
   */

  const isBusy =
  isClosingRegularSeason ||
  isClosingFinalStage ||
  isPreparingRegularSeason ||
  isCreatingTitlePlayoff;

  /*
 * ==========================================================
 * PREPARAZIONE CHIUSURA REGULAR SEASON
 * ==========================================================
 */

const refreshRegularSeasonPreparation =
  useCallback(
    async () => {
      if (
        !currentSeasonId ||
        regularSeasonClosed
      ) {
        setRegularSeasonPreparation(
          null,
        );

        setPreparationError(
          null,
        );

        return;
      }

      setIsPreparingRegularSeason(
        true,
      );

      setPreparationError(
        null,
      );

      try {
        const preparation =
          await SeasonClosureService
            .prepareRegularSeasonClosure(
              currentSeasonId,
            );

        setRegularSeasonPreparation(
          preparation,
        );

        /*
         * Se lo spareggio deve essere
         * ancora creato inizializziamo
         * automaticamente casa e ospite.
         */

        if (
          preparation.status ===
          "titlePlayoffRequired"
        ) {
          setPlayoffHomeTeamId(
            preparation
              .candidateTeamIds[0],
          );

          setPlayoffAwayTeamId(
            preparation
              .candidateTeamIds[1],
          );
        }
      } catch (
        error
      ) {
        setRegularSeasonPreparation(
          null,
        );

        setPreparationError(
          error instanceof
            Error
            ? error.message
            : "Impossibile verificare lo stato della Regular Season.",
        );
      } finally {
        setIsPreparingRegularSeason(
          false,
        );
      }
    },
    [
      currentSeasonId,
      regularSeasonClosed,
    ],
  );

useEffect(
  () => {
    const timeoutId =
      window.setTimeout(
        () => {
          void refreshRegularSeasonPreparation();
        },
        0,
      );

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  },
  [
    refreshRegularSeasonPreparation,
  ],
);

  /*
 * ==========================================================
 * CREAZIONE SPAREGGIO TITOLO
 * ==========================================================
 */

async function createTitlePlayoff() {
  if (
    !currentSeason?.id ||
    regularSeasonPreparation
      ?.status !==
      "titlePlayoffRequired" ||
    isBusy
  ) {
    return;
  }

  if (
    !playoffDate
  ) {
    setActionError(
      "Inserisci la data dello spareggio.",
    );

    return;
  }

  if (
    !playoffTime
  ) {
    setActionError(
      "Inserisci l'orario dello spareggio.",
    );

    return;
  }

  setIsCreatingTitlePlayoff(
    true,
  );

  setActionError(
    null,
  );

  setActionMessage(
    null,
  );

  try {
    const result =
      await TitlePlayoffCreationService
        .create({
          seasonId:
            currentSeason.id,

          homeTeamId:
            playoffHomeTeamId,

          awayTeamId:
            playoffAwayTeamId,

          date:
            playoffDate,

          time:
            playoffTime,

          venue:
            playoffVenue,
        });

    setActionMessage(
      [
        "Spareggio per il titolo creato correttamente.",
        "",
        `${getTeamName(
          result.homeTeamId,
        )} - ${getTeamName(
          result.awayTeamId,
        )}`,
        `${result.date} · ${result.time}`,
      ].join(
        "\n",
      ),
    );

    /*
     * Ricarichiamo immediatamente lo stato:
     * titlePlayoffRequired
     * diventerà titlePlayoffExists.
     */

    await refreshRegularSeasonPreparation();
  } catch (
    error
  ) {
    console.error(
      "Errore creazione spareggio titolo:",
      error,
    );

    setActionError(
      error instanceof
        Error
        ? error.message
        : "Impossibile creare lo spareggio per il titolo.",
    );
  } finally {
    setIsCreatingTitlePlayoff(
      false,
    );
  }
}

  /*
   * ==========================================================
   * CHIUSURA REGULAR SEASON
   * ==========================================================
   */

  async function closeRegularSeason() {
    if (
      !currentSeason?.id
    ) {
      setActionError(
        "Nessuna stagione attiva.",
      );

      return;
    }

    /*
 * ========================================================
 * CONTROLLO FINALE PRIMA DELLA CHIUSURA
 * ========================================================
 *
 * Non ci fidiamo dello stato UI:
 * ricalcoliamo sempre la situazione.
 * ========================================================
 */

let preparation:
  RegularSeasonClosurePreparation;

try {
  preparation =
    await SeasonClosureService
      .prepareRegularSeasonClosure(
        currentSeason.id,
      );

  setRegularSeasonPreparation(
    preparation,
  );
} catch (
  error
) {
  setActionError(
    error instanceof
      Error
      ? error.message
      : "Impossibile verificare la Regular Season.",
  );

  return;
}

/*
 * Spareggio ancora da creare.
 */

if (
  preparation.status ===
  "titlePlayoffRequired"
) {
  setPlayoffHomeTeamId(
    preparation
      .candidateTeamIds[0],
  );

  setPlayoffAwayTeamId(
    preparation
      .candidateTeamIds[1],
  );

  setActionError(
    "Prima di chiudere la Regular Season devi creare e disputare lo spareggio per il titolo.",
  );

  return;
}

/*
 * Spareggio esistente ma non ancora
 * concluso/pubblicato.
 */

if (
  preparation.status ===
    "titlePlayoffExists" &&
  (
    (
      preparation
        .titlePlayoff
        .matchStatus !==
        "played" &&
      preparation
        .titlePlayoff
        .matchStatus !==
        "walkover"
    ) ||
    !preparation
      .titlePlayoff
      .reportPublished
  )
) {
  setActionError(
    "Lo spareggio per il titolo deve essere concluso e il relativo tabellino deve essere pubblicato prima della chiusura della Regular Season.",
  );

  return;
}

    const confirmed =
  window.confirm(
    [
      `Chiudere ufficialmente la Regular Season${
        selectedCompetition
          ? ` di ${selectedCompetition.name}`
          : ""
      }?`,
          "",
          "L'operazione:",
          "• determinerà la squadra campione",
          "• assegnerà il titolo ai giocatori ammessi alle fasi finali",
          "• renderà definitiva la chiusura della Regular Season",
          "",
          "Continuare?",
        ].join(
          "\n",
        ),
      );

    if (
      !confirmed
    ) {
      return;
    }

    setIsClosingRegularSeason(
      true,
    );

    setActionError(
      null,
    );

    setActionMessage(
      null,
    );

    try {
      const result =
        await SeasonClosureService.closeRegularSeason(
          currentSeason.id,
        );

      setActionMessage(
        [
          "Regular Season chiusa correttamente.",
          "",
          `Campione: ${result.championTeamName}`,
          `Giocatori premiati: ${result.awardedPlayers}`,
        ].join(
          "\n",
        ),
      );
    } catch (
      error
    ) {
      console.error(
        "Errore chiusura Regular Season:",
        error,
      );

      setActionError(
        error instanceof
          Error
          ? error.message
          : "Impossibile chiudere la Regular Season.",
      );
    } finally {
      setIsClosingRegularSeason(
        false,
      );
    }
  }

  /*
   * ==========================================================
   * CHIUSURA FASI FINALI
   * ==========================================================
   */

  async function closeFinalStage() {
    if (
      !currentSeason?.id
    ) {
      setActionError(
        "Nessuna stagione attiva.",
      );

      return;
    }

    const confirmed =
  window.confirm(
    [
      `Chiudere ufficialmente le fasi finali${
        selectedCompetition
          ? ` di ${selectedCompetition.name}`
          : ""
      }?`,
          "",
          "L'operazione:",
          "• determinerà il vincitore della Champions League",
          "• assegnerà il titolo ai giocatori ammessi alle fasi finali",
          "• renderà definitive le fasi finali",
          "",
          "Continuare?",
        ].join(
          "\n",
        ),
      );

    if (
      !confirmed
    ) {
      return;
    }

    setIsClosingFinalStage(
      true,
    );

    setActionError(
      null,
    );

    setActionMessage(
      null,
    );

    try {
      const result =
        await SeasonClosureService.closeFinalStage(
          currentSeason.id,
        );

      const winnerLines =
  result.winners.map(
    (
      winner,
    ) =>
      `${winner.competitionLabel}: ${winner.winnerTeamName}`,
  );

const achievementLines =
  result.totalAwardedPlayers >
  0
    ? [
        "",
        `Giocatori premiati: ${result.totalAwardedPlayers}`,
      ]
    : [];

setActionMessage(
  [
    "Fasi finali chiuse correttamente.",
    "",
    ...winnerLines,
    ...achievementLines,
  ].join(
    "\n",
  ),
);
    } catch (
      error
    ) {
      console.error(
        "Errore chiusura fasi finali:",
        error,
      );

      setActionError(
        error instanceof
          Error
          ? error.message
          : "Impossibile chiudere le fasi finali.",
      );
    } finally {
      setIsClosingFinalStage(
        false,
      );
    }
  }

  /*
   * ==========================================================
   * LOADING
   * ==========================================================
   */

  if (
    seasonsLoading
  ) {
    return (
      <main className="mx-auto w-full max-w-4xl p-4 pb-28 sm:p-6">
        <section className="rounded-[20px] bg-white p-8 text-center shadow-[0_10px_24px_rgba(6,20,46,0.10)]">
          <p className="text-sm font-bold text-[#06142E]/45">
            Caricamento stagione...
          </p>
        </section>
      </main>
    );
  }

  /*
   * ==========================================================
   * ERROR
   * ==========================================================
   */

  if (
    seasonsError
  ) {
    return (
      <main className="mx-auto w-full max-w-4xl p-4 pb-28 sm:p-6">
        <section className="rounded-[16px] border border-red-200 bg-red-50 p-5">
          <p className="font-black text-red-700">
            Impossibile caricare la stagione
          </p>

          <p className="mt-1 text-sm font-bold text-red-600/70">
            {
              seasonsError
            }
          </p>
        </section>
      </main>
    );
  }

  /*
   * ==========================================================
   * NESSUNA STAGIONE
   * ==========================================================
   */

  if (
    !currentSeason
  ) {
    return (
      <main className="mx-auto w-full max-w-4xl p-4 pb-28 sm:p-6">
        <section className="rounded-[20px] bg-white p-8 text-center shadow-[0_10px_24px_rgba(6,20,46,0.10)]">
          <p className="text-sm font-bold text-[#06142E]/45">
            Nessuna stagione attiva.
          </p>
        </section>
      </main>
    );
  }

  /*
   * ==========================================================
   * RENDER
   * ==========================================================
   */

  return (
    <AppShell>
          <div className="space-y-6">
          {/* ======================================================
              HEADER
              ====================================================== */}
    
          <header className="mt-2 mb-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#06142E]/35">
              Centro di controllo
            </p>
    
            <h1 className="mt-1 text-3xl font-black uppercase tracking-[-0.03em] text-[#06142E] sm:text-4xl">
              Chiusura Ufficiale
            </h1>
    
            <p className="mt-1 max-w-2xl text-sm font-bold leading-6 text-[#06142E]/50">
              Gestisci la chiusura del torneo
            </p>
          </header>

      {/* ======================================================
          STAGIONE CORRENTE
          ====================================================== */}

      <section className="rounded-[20px] bg-[#06142E] p-5 text-white shadow-[0_10px_24px_rgba(6,20,46,0.14)] sm:p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">
  Stagione attiva
  {selectedCompetition
    ? ` · ${selectedCompetition.name}`
    : ""}
</p>

        <h2 className="mt-1 text-2xl font-black uppercase">
          {
            currentSeason.name
          }
        </h2>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SeasonStatusBox
            label="Regular Season"
            closed={
              currentSeason.regularSeasonClosed ===
              true
            }
          />

          <SeasonStatusBox
            label="Fasi finali"
            closed={
              currentSeason.finalStageClosed ===
              true
            }
          />
        </div>
      </section>

      {/* ======================================================
          REGULAR SEASON
          ====================================================== */}

      <section className="rounded-[20px] bg-white p-5 shadow-[0_10px_24px_rgba(6,20,46,0.10)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
              Fase 1
            </p>

            <h2 className="mt-1 text-xl font-black uppercase text-[#06142E]">
              Regular Season
            </h2>

            <p className="mt-2 max-w-xl text-sm font-bold leading-6 text-[#06142E]/50">
              Chiudi la classifica
              definitiva e assegna il
              titolo di Campione
              Regular Season alla rosa
              ufficiale ammessa alle
              fasi finali.
            </p>
          </div>

          <StatusBadge
            closed={
              currentSeason.regularSeasonClosed ===
              true
            }
          />
        </div>

        <div className="mt-5 rounded-[14px] bg-[#F4F7FB] p-4">
          <p className="text-xs font-bold leading-5 text-[#06142E]/55">
            Prima della chiusura verifica
            che tutte le partite siano
            concluse e che la lista dei
            giocatori ammessi alle fasi
            finali sia stata salvata.
          </p>
        </div>

        {/* ======================================================
    PREPARAZIONE REGULAR SEASON
    ====================================================== */}

{currentSeason.regularSeasonClosed !==
  true && (
  <>
    {isPreparingRegularSeason && (
      <div className="mt-5 rounded-[16px] border border-blue-100 bg-blue-50 p-4">
        <p className="text-sm font-bold text-blue-700">
          Verifica classifica e spareggio in corso...
        </p>
      </div>
    )}

    {preparationError && (
      <div className="mt-5 rounded-[16px] border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-bold leading-6 text-amber-700">
          {preparationError}
        </p>
      </div>
    )}

    {regularSeasonPreparation
      ?.status ===
      "readyToClose" && (
      <div className="mt-5 rounded-[16px] border border-green-200 bg-green-50 p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-green-600/60">
          Verifica classifica
        </p>

        <p className="mt-2 text-base font-black text-green-800">
          ✓ Nessuno spareggio necessario
        </p>

        <p className="mt-1 text-sm font-bold text-green-700/70">
          Campione provvisorio:{" "}
          {getTeamName(
            regularSeasonPreparation
              .championCandidateTeamId,
          )}
        </p>
      </div>
    )}

    {regularSeasonPreparation
      ?.status ===
      "titlePlayoffRequired" && (
      <section className="mt-5 rounded-[18px] border-2 border-amber-300 bg-amber-50 p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-600">
          Parità al primo posto
        </p>

        <h3 className="mt-2 text-xl font-black uppercase text-[#06142E]">
          Spareggio per il titolo
        </h3>

        <p className="mt-2 text-sm font-bold leading-6 text-[#06142E]/55">
          La Regular Season non può essere
          chiusa finché lo spareggio non
          viene disputato e pubblicato.
        </p>

        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-[14px] bg-white p-4">
          <p className="text-center text-sm font-black text-[#06142E]">
            {getTeamName(
              playoffHomeTeamId,
            )}
          </p>

          <span className="text-xs font-black uppercase text-[#06142E]/30">
            vs
          </span>

          <p className="text-center text-sm font-black text-[#06142E]">
            {getTeamName(
              playoffAwayTeamId,
            )}
          </p>
        </div>

        <button
          type="button"
          disabled={
            isCreatingTitlePlayoff
          }
          onClick={() => {
            const previousHome =
              playoffHomeTeamId;

            setPlayoffHomeTeamId(
              playoffAwayTeamId,
            );

            setPlayoffAwayTeamId(
              previousHome,
            );
          }}
          className="mt-3 w-full rounded-[12px] bg-[#06142E]/5 px-4 py-3 text-xs font-black uppercase text-[#06142E] disabled:opacity-40"
        >
          ⇄ Inverti casa / ospite
        </button>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
              Data
            </span>

            <input
              type="date"
              value={
                playoffDate
              }
              onChange={(
                event,
              ) => {
                setPlayoffDate(
                  event.target
                    .value,
                );
              }}
              className="ludi-input"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
              Ora
            </span>

            <select
              value={
                playoffTime
              }
              onChange={(
                event,
              ) => {
                setPlayoffTime(
                  event.target
                    .value,
                );
              }}
              className="ludi-input"
            >
              {MATCH_TIMES.map(
                (time) => (
                  <option
                    key={time}
                    value={time}
                  >
                    {time}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>

        <label className="mt-3 block">
          <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
            Campo
          </span>

          <input
            type="text"
            value={
              playoffVenue
            }
            onChange={(
              event,
            ) => {
              setPlayoffVenue(
                event.target
                  .value,
              );
            }}
            className="ludi-input"
          />
        </label>

        <button
          type="button"
          disabled={
            isBusy ||
            !playoffDate ||
            !playoffTime
          }
          onClick={() => {
            void createTitlePlayoff();
          }}
          className="mt-4 w-full rounded-[13px] bg-amber-500 px-5 py-4 text-sm font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isCreatingTitlePlayoff
            ? "Creazione..."
            : "Crea spareggio"}
        </button>
      </section>
    )}

    {regularSeasonPreparation
      ?.status ===
      "titlePlayoffExists" && (
      <section className="mt-5 rounded-[18px] border border-blue-200 bg-blue-50 p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">
          Spareggio per il titolo
        </p>

        <h3 className="mt-2 text-xl font-black text-[#06142E]">
          {getTeamName(
            regularSeasonPreparation
              .titlePlayoff
              .homeTeamId,
          )}
          {" — "}
          {getTeamName(
            regularSeasonPreparation
              .titlePlayoff
              .awayTeamId,
          )}
        </h3>

        <p className="mt-2 text-sm font-bold text-[#06142E]/55">
          {
            regularSeasonPreparation
              .titlePlayoff
              .date
          }
          {" · "}
          {
            regularSeasonPreparation
              .titlePlayoff
              .time
          }
        </p>

        <p className="mt-1 text-sm font-bold text-[#06142E]/45">
          {
            regularSeasonPreparation
              .titlePlayoff
              .venue
          }
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-[12px] bg-white p-3">
            <p className="text-[9px] font-black uppercase text-[#06142E]/35">
              Partita
            </p>

            <p className="mt-1 text-sm font-black text-[#06142E]">
              {regularSeasonPreparation
                .titlePlayoff
                .matchStatus ===
                "played" ||
              regularSeasonPreparation
                .titlePlayoff
                .matchStatus ===
                "walkover"
                ? "✓ Conclusa"
                : "• Da disputare"}
            </p>
          </div>

          <div className="rounded-[12px] bg-white p-3">
            <p className="text-[9px] font-black uppercase text-[#06142E]/35">
              Tabellino
            </p>

            <p className="mt-1 text-sm font-black text-[#06142E]">
              {regularSeasonPreparation
                .titlePlayoff
                .reportPublished
                ? "✓ Pubblicato"
                : "• Da pubblicare"}
            </p>
          </div>
        </div>

        {(
          regularSeasonPreparation
            .titlePlayoff
            .matchStatus !==
            "played" &&
          regularSeasonPreparation
            .titlePlayoff
            .matchStatus !==
            "walkover"
        ) ||
        !regularSeasonPreparation
          .titlePlayoff
          .reportPublished ? (
          <p className="mt-4 text-xs font-bold leading-5 text-blue-700">
            Completa lo spareggio dalla
            gestione Partite e pubblica il
            tabellino. Poi torna qui per
            chiudere la Regular Season.
          </p>
        ) : (
          <p className="mt-4 text-xs font-black uppercase text-green-700">
            ✓ Spareggio completato:
            puoi chiudere la Regular Season.
          </p>
        )}
      </section>
    )}
  </>
)}

        <button
          type="button"
          disabled={
  isBusy ||
  currentSeason.regularSeasonClosed ===
    true ||
  preparationError !==
    null ||
  regularSeasonPreparation ===
    null ||
  regularSeasonPreparation.status ===
    "titlePlayoffRequired" ||
  (
    regularSeasonPreparation.status ===
      "titlePlayoffExists" &&
    (
      (
        regularSeasonPreparation
          .titlePlayoff
          .matchStatus !==
          "played" &&
        regularSeasonPreparation
          .titlePlayoff
          .matchStatus !==
          "walkover"
      ) ||
      !regularSeasonPreparation
        .titlePlayoff
        .reportPublished
    )
  )
}
          onClick={() => {
            void closeRegularSeason();
          }}
          className="mt-5 w-full rounded-[13px] bg-[#0B5FFF] px-5 py-4 text-sm font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {currentSeason.regularSeasonClosed
            ? "Regular Season chiusa"
            : isClosingRegularSeason
              ? "Chiusura..."
              : "Chiudi Regular Season"}
        </button>
      </section>

      {/* ======================================================
          FASI FINALI
          ====================================================== */}

      <section className="rounded-[20px] bg-white p-5 shadow-[0_10px_24px_rgba(6,20,46,0.10)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
              Fase 2
            </p>

            <h2 className="mt-1 text-xl font-black uppercase text-[#06142E]">
              Fasi finali
            </h2>

            <p className="mt-2 max-w-xl text-sm font-bold leading-6 text-[#06142E]/50">
              Chiudi le competizioni
              finali e assegna il titolo
              di Campione Champions
              League ai giocatori della
              squadra vincitrice.
            </p>
          </div>

          <StatusBadge
            closed={
              currentSeason.finalStageClosed ===
              true
            }
          />
        </div>

        {currentSeason.regularSeasonClosed !==
          true && (
          <div className="mt-5 rounded-[14px] bg-amber-50 p-4">
            <p className="text-xs font-bold leading-5 text-amber-700">
              Devi prima chiudere la
              Regular Season.
            </p>
          </div>
        )}

        <button
          type="button"
          disabled={
            isBusy ||
            currentSeason.regularSeasonClosed !==
              true ||
            currentSeason.finalStageClosed ===
              true
          }
          onClick={() => {
            void closeFinalStage();
          }}
          className="mt-5 w-full rounded-[13px] bg-[#06142E] px-5 py-4 text-sm font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {currentSeason.finalStageClosed
            ? "Fasi finali chiuse"
            : isClosingFinalStage
              ? "Chiusura..."
              : "Chiudi fasi finali"}
        </button>
      </section>

      {/* ======================================================
          SUCCESS
          ====================================================== */}

      {actionMessage && (
        <section className="whitespace-pre-line rounded-[16px] border border-green-200 bg-green-50 p-5">
          <p className="text-sm font-bold leading-6 text-green-700">
            {
              actionMessage
            }
          </p>
        </section>
      )}

      {/* ======================================================
          ERROR
          ====================================================== */}

      {actionError && (
        <section className="rounded-[16px] border border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold leading-6 text-red-700">
            {
              actionError
            }
          </p>
        </section>
      )}
    </div>
    </AppShell>
  );
}

/*
 * ============================================================
 * STATO FASE
 * ============================================================
 */

function SeasonStatusBox({
  label,
  closed,
}: {
  label:
    string;

  closed:
    boolean;
}) {
  return (
    <article className="rounded-[14px] border border-white/10 bg-white/[0.06] p-4">
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/40">
        {
          label
        }
      </p>

      <p className="mt-2 text-sm font-black uppercase">
        {closed
          ? "✓ Chiusa"
          : "• Aperta"}
      </p>
    </article>
  );
}

/*
 * ============================================================
 * BADGE STATO
 * ============================================================
 */

function StatusBadge({
  closed,
}: {
  closed:
    boolean;
}) {
  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase ${
        closed
          ? "bg-green-100 text-green-700"
          : "bg-amber-100 text-amber-700"
      }`}
    >
      {closed
        ? "Chiusa"
        : "Aperta"}
    </span>
  );
}
