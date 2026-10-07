"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import AppShell from "@/components/ui/AppShell";

import {
  useCompetition,
} from "@/src/contexts/CompetitionContext";

import {
  FirebaseFinalStageMatchRepository,
} from "@/src/services/final-stage/FirebaseFinalStageMatchRepository";

import {
  FirebaseFinalStageMatchReportRepository,
} from "@/src/services/final-stage/FirebaseFinalStageMatchReportRepository";

import {
  FinalStageDisciplinaryPlayersService,
} from "@/src/services/discipline/FinalStageDisciplinaryPlayersService";

import {
  FinalStageDisciplinaryCommunicationService,
} from "@/src/services/discipline/FinalStageDisciplinaryCommunicationService";

import {
  FirebaseFinalStageOfficialCommunicationRepository,
} from "@/src/services/discipline/FirebaseFinalStageOfficialCommunicationRepository";

import {
  DisciplinarySuspensionService,
} from "@/src/services/discipline/DisciplinarySuspensionService";

import type {
  FinalStageOfficialCommunication,
} from "@/src/types/FinalStageOfficialCommunication";

import type {
  MatchweekDisciplinaryPlayer,
} from "@/src/services/discipline/DisciplinaryEngine";

type Props = {
  finalStageWeek:
    number;
};

export default function AdminFinalStageOfficialCommunicationPage({
  finalStageWeek,
}: Props) {
  const {
    currentSeason,
    isLoading:
      competitionLoading,
  } =
    useCompetition();

  const [
    players,
    setPlayers,
  ] =
    useState<
      MatchweekDisciplinaryPlayer[]
    >(
      [],
    );

  const [
    playedTeamIds,
    setPlayedTeamIds,
  ] =
    useState<
      string[]
    >(
      [],
    );

  const [
    communication,
    setCommunication,
  ] =
    useState<
      FinalStageOfficialCommunication | null
    >(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    saving,
    setSaving,
  ] =
    useState(
      false,
    );

  const [
    message,
    setMessage,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const seasonId =
    currentSeason?.id;

  useEffect(
    () => {
      let active =
        true;

      async function load() {
        if (
          competitionLoading ||
          !seasonId
        ) {
          return;
        }

        setLoading(
          true,
        );
        setError(
          null,
        );

        try {
          const [
            matches,
            reports,
            existingCommunication,
          ] =
            await Promise.all([
              FirebaseFinalStageMatchRepository
                .getBySeason(
                  seasonId,
                ),

              FirebaseFinalStageMatchReportRepository
                .getPublished(),

              FirebaseFinalStageOfficialCommunicationRepository
                .getBySeasonAndWeek({
                  seasonId,
                  finalStageWeek,
                }),
            ]);

          const weekData =
            await FinalStageDisciplinaryPlayersService
              .buildWeekData({
                seasonId,
                finalStageWeek,
                matches,
                reports,
              });

          if (
            !active
          ) {
            return;
          }

          setPlayers(
            weekData
              .disciplinaryPlayers,
          );

          setPlayedTeamIds(
            weekData
              .playedTeamIds,
          );

          setCommunication(
            existingCommunication ??
            null,
          );
        } catch (
          currentError
        ) {
          console.error(
            currentError,
          );

          if (
            active
          ) {
            setError(
              currentError instanceof
                Error
                ? currentError
                    .message
                : "Impossibile caricare i dati disciplinari Final Stage.",
            );
          }
        } finally {
          if (
            active
          ) {
            setLoading(
              false,
            );
          }
        }
      }

      void load();

      return () => {
        active =
          false;
      };
    },
    [
      competitionLoading,
      seasonId,
      finalStageWeek,
    ],
  );

  const cardCount =
    useMemo(
      () =>
        players.reduce(
          (
            total,
            player,
          ) =>
            total +
            player.yellowCards +
            player.directRedCards,
          0,
        ),
      [
        players,
      ],
    );

  async function generateDraft() {
    if (
      !seasonId
    ) {
      return;
    }

    setSaving(
      true,
    );
    setError(
      null,
    );
    setMessage(
      null,
    );

    try {
      /*
       * 1) Scontiamo eventuali squalifiche pregresse per ogni
       * partita FS già giocata nella settimana.
       *
       * Il servizio esistente supporta esplicitamente Final Stage:
       * matchweek viene omesso.
       */
      const matches =
        await FirebaseFinalStageMatchRepository
          .getBySeason(
            seasonId,
          );

      const reports =
        await FirebaseFinalStageMatchReportRepository
          .getPublished();

      const weekData =
        await FinalStageDisciplinaryPlayersService
          .buildWeekData({
            seasonId,
            finalStageWeek,
            matches,
            reports,
          });

      for (
        const match of
        weekData.matches
      ) {
        if (
          match.status !==
            "played" &&
          match.status !==
            "walkover"
        ) {
          continue;
        }

        await DisciplinarySuspensionService
          .serveForMatch({
            seasonId,
            matchId:
              String(
                match.id,
              ),
            playedTeamIds: [
              String(
                match.homeTeamId,
              ),
              String(
                match.awayTeamId,
              ),
            ],
          });
      }

      /*
       * 2) Elaboriamo i cartellini FS e generiamo
       * il nuovo stato disciplinare.
       */
      const result =
        await FinalStageDisciplinaryCommunicationService
          .generateDraft({
            seasonId,
            finalStageWeek,
            players:
              weekData
                .disciplinaryPlayers,

            judgeSanctions:
              communication
                ?.judgeSanctions ??
              [],

            clubFines:
              communication
                ?.clubFines ??
              [],
          });

      /*
       * 3) Salviamo la bozza nella collection FS dedicata.
       */
      await FirebaseFinalStageOfficialCommunicationRepository
        .saveDraft(
          result.communication,
        );

      setCommunication(
        result.communication,
      );

      setPlayers(
        weekData
          .disciplinaryPlayers,
      );

      setPlayedTeamIds(
        weekData
          .playedTeamIds,
      );

      setMessage(
        `Bozza FS${finalStageWeek} generata correttamente.`,
      );
    } catch (
      currentError
    ) {
      console.error(
        currentError,
      );

      setError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile generare il comunicato Final Stage.",
      );
    } finally {
      setSaving(
        false,
      );
    }
  }

  async function publish() {
    if (
      !communication
    ) {
      setError(
        "Genera prima la bozza del comunicato.",
      );
      return;
    }

    setSaving(
      true,
    );
    setError(
      null,
    );
    setMessage(
      null,
    );

    try {
      await FirebaseFinalStageOfficialCommunicationRepository
        .publish(
          communication,
        );

      setCommunication({
        ...communication,
        status:
          "published",
        publishedAt:
          new Date()
            .toISOString(),
      });

      setMessage(
        `Comunicato FS${finalStageWeek} pubblicato.`,
      );
    } catch (
      currentError
    ) {
      console.error(
        currentError,
      );

      setError(
        "Impossibile pubblicare il comunicato Final Stage.",
      );
    } finally {
      setSaving(
        false,
      );
    }
  }

  return (
    <AppShell>
      <header className="mb-6">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/40">
          Disciplina · Final Stage
        </p>

        <h1 className="mt-1 text-3xl font-black uppercase text-[#06142E]">
          Comunicato FS{
            finalStageWeek
          }
        </h1>
      </header>

      {loading ? (
        <MessageCard>
          Caricamento dati
          disciplinari...
        </MessageCard>
      ) : error ? (
        <MessageCard error>
          {error}
        </MessageCard>
      ) : (
        <>
          <section className="grid grid-cols-3 gap-3">
            <StatCard
              label="Squadre"
              value={
                playedTeamIds
                  .length
              }
            />

            <StatCard
              label="Giocatori"
              value={
                players.length
              }
            />

            <StatCard
              label="Cartellini"
              value={
                cardCount
              }
            />
          </section>

          <section className="mt-4 rounded-[20px] bg-white p-5">
            <p className="text-xs font-black uppercase text-[#06142E]/40">
              Stato
            </p>

            <p className="mt-2 text-lg font-black text-[#06142E]">
              {
                communication
                  ?.status ===
                  "published"
                  ? "Pubblicato"
                  : communication
                    ? "Bozza"
                    : "Non generato"
              }
            </p>

            <div className="mt-4 grid gap-3">
              <button
                type="button"
                onClick={() => {
                  void generateDraft();
                }}
                disabled={
                  saving
                }
                className="rounded-[13px] bg-[#146BFF] px-4 py-3 text-xs font-black uppercase text-white disabled:opacity-40"
              >
                {
                  saving
                    ? "Elaborazione..."
                    : communication
                      ? "Rigenera comunicato FS"
                      : "Genera comunicato FS"
                }
              </button>

              <button
                type="button"
                onClick={() => {
                  void publish();
                }}
                disabled={
                  saving ||
                  !communication
                }
                className="rounded-[13px] bg-[#06142E] px-4 py-3 text-xs font-black uppercase text-white disabled:opacity-40"
              >
                Pubblica comunicato
              </button>
            </div>
          </section>

          {players.length >
            0 && (
            <section className="mt-4 rounded-[20px] bg-white p-5">
              <h2 className="text-sm font-black uppercase text-[#06142E]">
                Cartellini rilevati
              </h2>

              <div className="mt-3 space-y-2">
                {players.map(
                  (player) => (
                    <article
                      key={
                        `${player.sourceMatchId}-${player.playerId}`
                      }
                      className="rounded-[13px] bg-[#F4F7FB] p-3"
                    >
                      <p className="font-black text-[#06142E]">
                        {
                          player.playerName
                        }
                      </p>

                      <p className="mt-1 text-xs font-bold text-[#06142E]/45">
                        {
                          player.teamName
                        } · 🟨 {
                          player.yellowCards
                        } · 🟥 {
                          player.directRedCards
                        }
                      </p>
                    </article>
                  ),
                )}
              </div>
            </section>
          )}

          {message && (
            <MessageCard>
              {message}
            </MessageCard>
          )}
        </>
      )}
    </AppShell>
  );
}

function StatCard({
  label,
  value,
}: {
  label:
    string;
  value:
    string | number;
}) {
  return (
    <div className="rounded-[16px] bg-white p-4 text-center">
      <p className="text-2xl font-black text-[#06142E]">
        {value}
      </p>

      <p className="mt-1 text-[9px] font-black uppercase text-[#06142E]/40">
        {label}
      </p>
    </div>
  );
}

function MessageCard({
  children,
  error = false,
}: {
  children:
    React.ReactNode;
  error?:
    boolean;
}) {
  return (
    <div
      className={[
        "mt-4 rounded-[16px] p-4 text-center text-sm font-bold",
        error
          ? "bg-red-50 text-red-700"
          : "bg-white text-[#06142E]/55",
      ].join(
        " ",
      )}
    >
      {children}
    </div>
  );
}
