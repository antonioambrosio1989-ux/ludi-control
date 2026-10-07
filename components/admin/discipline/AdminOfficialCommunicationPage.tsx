"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import AdminOfficialCommunicationScreen, {
  type DisciplinaryPlayerOption,
} from "@/components/admin/discipline/AdminOfficialCommunicationScreen";

import {
  FirebaseSeasonPlayerRepository,
} from "@/src/services/player/FirebaseSeasonPlayerRepository";

import {
  FirebasePlayerRepository,
} from "@/src/services/player/FirebasePlayerRepository";

import {
  FirebaseTeamRepository,
} from "@/src/services/team/FirebaseTeamRepository";

import {
  useCompetition,
} from "@/src/contexts/CompetitionContext";

/*
 * ============================================================
 * PROPS
 * ============================================================
 */

type AdminOfficialCommunicationPageProps = {
  matchweekParam:
    string;
};

/*
 * ============================================================
 * ADMIN OFFICIAL COMMUNICATION PAGE
 * ============================================================
 */

export default function AdminOfficialCommunicationPage({
  matchweekParam,
}: AdminOfficialCommunicationPageProps) {
  /*
   * ==========================================================
   * COMPETITION
   * ==========================================================
   */

  const {
    currentSeason,

    isLoading:
      competitionLoading,

    error:
      competitionError,
  } =
    useCompetition();

    const currentSeasonId =
  currentSeason?.id;

  /*
   * ==========================================================
   * MATCHWEEK
   * ==========================================================
   */

  const matchweek =
    useMemo(
      () =>
        parseMatchweek(
          matchweekParam,
        ),
      [
        matchweekParam,
      ],
    );

  /*
   * ==========================================================
   * STATE
   * ==========================================================
   */

  const [
  playerOptions,
  setPlayerOptions,
] =
  useState<
    DisciplinaryPlayerOption[]
  >(
    [],
  );

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(
      true,
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

  /*
 * ==========================================================
 * LOAD DISCIPLINARY DATA
 * ==========================================================
 */

useEffect(
  () => {
    if (
      competitionLoading ||
      !currentSeasonId ||
      !matchweek
    ) {
      return;
    }

    const seasonId =
  currentSeasonId;

    let active =
      true;

    async function loadDisciplinaryData() {
      setIsLoading(
        true,
      );

      setError(
        null,
      );

      try {
        /*
         * ==================================================
         * PARTITE + TABELLINI PUBBLICATI
         * ==================================================
         */

        const [
  seasonPlayers,
  players,
  teams,
] =
  await Promise.all([
    FirebaseSeasonPlayerRepository
      .getBySeasonId(
        seasonId,
      ),

    FirebasePlayerRepository
      .getAll(),

    FirebaseTeamRepository
      .getAll(),
  ]);

        if (
          !active
        ) {
          return;
        }

        /*
 * ==================================================
 * GIOCATORI SELEZIONABILI PER IL GIUDICE SPORTIVO
 * ==================================================
 */

const playersById =
  new Map(
    players.map(
      (
        player,
      ) => [
        String(
          player.id,
        ),
        player,
      ],
    ),
  );

const teamsById =
  new Map(
    teams.map(
      (
        team,
      ) => [
        String(
          team.id,
        ),
        team,
      ],
    ),
  );

const currentPlayerOptions:
  DisciplinaryPlayerOption[] =
  seasonPlayers
    .filter(
      (
        entry,
      ) =>
        entry.status !==
        "withdrawn",
    )
    .flatMap(
      (
        entry,
      ) => {
        const player =
          playersById.get(
            String(
              entry.playerId,
            ),
          );

        const team =
          teamsById.get(
            String(
              entry.teamId,
            ),
          );

        if (
          !player ||
          !team
        ) {
          return [];
        }

        return [
          {
            playerId:
              String(
                entry.playerId,
              ),

            playerName:
              `${player.firstName} ${player.lastName}`.trim(),

            teamId:
              String(
                entry.teamId,
              ),

            teamName:
              team.name,
          },
        ];
      },
    )
    .sort(
      (
        first,
        second,
      ) =>
        first.teamName.localeCompare(
          second.teamName,
          "it",
        ) ||
        first.playerName.localeCompare(
          second.playerName,
          "it",
        ),
    );

setPlayerOptions(
  currentPlayerOptions,
);

      } catch (
        currentError
      ) {
        console.error(
          "Errore caricamento dati disciplinari:",
          currentError,
        );

        if (
          !active
        ) {
          return;
        }

        setPlayerOptions(
  [],
);

        setError(
          currentError instanceof
            Error
            ? currentError.message
            : "Impossibile caricare i dati disciplinari.",
        );
      } finally {
        if (
          active
        ) {
          setIsLoading(
            false,
          );
        }
      }
    }

    void loadDisciplinaryData();

    return () => {
      active =
        false;
    };
  },
  [
    competitionLoading,
    currentSeasonId,
    matchweek,
  ],
);

  /*
   * ==========================================================
   * LOADING
   * ==========================================================
   */

  if (
  competitionLoading ||
  (
    Boolean(
      currentSeasonId &&
      matchweek
    ) &&
    isLoading
  )
) {
    return (
      <main className="min-h-screen bg-[#F2F5FA] px-4 pb-32 pt-5">
        <div className="mx-auto w-full max-w-3xl">
          <section className="rounded-[24px] bg-white px-5 py-12 text-center shadow-sm">
            <p className="text-sm font-black text-[#06142E]/45">
              Caricamento comunicato disciplinare...
            </p>
          </section>
        </div>
      </main>
    );
  }

  /*
   * ==========================================================
   * ERROR
   * ==========================================================
   */

  const pageError =
    competitionError ||
    error;

  if (
    pageError ||
    !currentSeasonId ||
    !matchweek
  ) {
    return (
      <main className="min-h-screen bg-[#F2F5FA] px-4 pb-32 pt-5">
        <div className="mx-auto w-full max-w-3xl">
          <section className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-6 shadow-sm">
            <p className="text-sm font-black text-red-700">
              {pageError ??
                "Comunicato disciplinare non disponibile."}
            </p>
          </section>
        </div>
      </main>
    );
  }

  /*
   * ==========================================================
   * RENDER
   * ==========================================================
   */

  return (
    <AdminOfficialCommunicationScreen
  seasonId={
    currentSeasonId
  }
  matchweek={
    matchweek
  }
  playerOptions={
    playerOptions
  }
/>
  );
}

/*
 * ============================================================
 * PARSE MATCHWEEK
 * ============================================================
 */

function parseMatchweek(
  value:
    string,
): number | null {
  const normalizedValue =
    value
      .trim()
      .toLowerCase()
      .replace(
        /^mw/,
        "",
      );

  const matchweek =
    Number(
      normalizedValue,
    );

  if (
    !Number.isInteger(
      matchweek,
    ) ||
    matchweek <
      1
  ) {
    return null;
  }

  return matchweek;
}