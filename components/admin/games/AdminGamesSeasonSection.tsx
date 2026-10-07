"use client";

import {
  getGamesSeasonTemporalStatus,
  toGamesDate,
} from "@/src/services/games/GamesSeasonStatusService";

import type {
  useAdminGamesSeasons,
} from "@/src/hooks/useAdminGamesSeasons";

type SeasonsHook =
  ReturnType<
    typeof useAdminGamesSeasons
  >;

type ManagedGamesSeason =
  SeasonsHook["managedGamesSeason"];

type GamesSeason =
  SeasonsHook["gamesSeasons"][number];

type GeneratedSeasonIdentity = {
  id:
    string;

  name:
    string;
};

type Props = {
  managedGamesSeason:
    ManagedGamesSeason;

  activeGamesSeasonId:
    string | null;

  seasonsLoading:
    boolean;

  isSaving:
    boolean;

  duplicateGamesSeason:
    GamesSeason | null;

  generatedSeasonIdentity:
    GeneratedSeasonIdentity | null;

  seasonStartsAt:
    string;

  seasonEndsAt:
    string;

  onSeasonStartsAtChange:
    (
      value:
        string,
    ) => void;

  onSeasonEndsAtChange:
    (
      value:
        string,
    ) => void;

  onCreateGamesSeason:
    () => void | Promise<void>;

  onDeleteGamesSeason:
    (input: {
      gamesSeasonId:
        string;

      gamesSeasonName:
        string;
    }) => void | Promise<void>;
};

export default function AdminGamesSeasonSection({
  managedGamesSeason,
  activeGamesSeasonId,
  seasonsLoading,
  isSaving,
  duplicateGamesSeason,
  generatedSeasonIdentity,
  seasonStartsAt,
  seasonEndsAt,
  onSeasonStartsAtChange,
  onSeasonEndsAtChange,
  onCreateGamesSeason,
  onDeleteGamesSeason,
}: Props) {
  return (
    <section className="rounded-[24px] bg-white p-6 shadow-[0_12px_30px_rgba(6,20,46,0.08)]">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
        Games Season
      </p>

      <h2 className="mt-2 text-2xl font-black uppercase text-[#06142E]">
        {managedGamesSeason
          ? managedGamesSeason.name
          : "Crea e attiva"}
      </h2>

      {seasonsLoading ? (
        <p className="mt-5 text-sm font-bold text-[#06142E]/45">
          Caricamento...
        </p>
      ) : managedGamesSeason ? (
        <ManagedSeasonCard
          gamesSeason={
            managedGamesSeason
          }
          isActive={
            activeGamesSeasonId ===
            managedGamesSeason.id
          }
          isDeleting={
            isSaving
          }
          onDelete={() => {
            void onDeleteGamesSeason({
              gamesSeasonId:
                managedGamesSeason.id,
              gamesSeasonName:
                managedGamesSeason.name,
            });
          }}
        />
      ) : (
        <>
          {duplicateGamesSeason && (
            <div className="mt-4 rounded-[18px] border border-red-200 bg-red-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-red-700/60">
                Vecchia Games Season rilevata
              </p>

              <p className="mt-1 text-base font-black text-red-700">
                {duplicateGamesSeason.name}
              </p>

              <p className="mt-2 text-xs font-bold leading-5 text-[#06142E]/45">
                Il documento esiste ancora nel database ma non è più considerato una Games Season gestita. Per questo il form è visibile, ma la creazione viene bloccata perché l&apos;ID è già occupato.
              </p>

              <button
                type="button"
                disabled={
                  isSaving
                }
                onClick={() => {
                  void onDeleteGamesSeason({
                    gamesSeasonId:
                      duplicateGamesSeason.id,
                    gamesSeasonName:
                      duplicateGamesSeason.name,
                  });
                }}
                className="mt-4 min-h-11 w-full rounded-[12px] bg-red-600 px-4 text-[10px] font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSaving
                  ? "Eliminazione..."
                  : "Elimina vecchia Games Season"}
              </button>
            </div>
          )}

          <p className="mt-2 text-sm font-bold leading-6 text-[#06142E]/45">
            Una sola Games Season per stagione sportiva. Il nome viene generato automaticamente dalle date.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <DateField
              label="Data inizio"
              value={
                seasonStartsAt
              }
              onChange={
                onSeasonStartsAtChange
              }
            />

            <DateField
              label="Data fine"
              value={
                seasonEndsAt
              }
              onChange={
                onSeasonEndsAtChange
              }
            />
          </div>

          <div className="mt-5 rounded-[16px] bg-[#F5F5F2] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#06142E]/35">
              Nome generato
            </p>

            <p className="mt-1 text-lg font-black text-[#06142E]">
              {generatedSeasonIdentity
                ?.name ??
                "Games —"}
            </p>

            <p className="mt-1 text-[10px] font-bold text-[#06142E]/30">
              Premier League · Championship · League One
            </p>
          </div>

          <button
            type="button"
            disabled={
              isSaving ||
              !generatedSeasonIdentity ||
              Boolean(
                duplicateGamesSeason,
              )
            }
            onClick={() => {
              void onCreateGamesSeason();
            }}
            className="mt-6 min-h-12 w-full rounded-[13px] bg-[#06142E] px-5 text-sm font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving
              ? "Salvataggio..."
              : "Crea e attiva"}
          </button>
        </>
      )}
    </section>
  );
}

function ManagedSeasonCard({
  gamesSeason,
  isActive,
  isDeleting,
  onDelete,
}: {
  gamesSeason:
    NonNullable<
      ManagedGamesSeason
    >;

  isActive:
    boolean;

  isDeleting:
    boolean;

  onDelete:
    () => void;
}) {
  const temporalStatus =
    getGamesSeasonTemporalStatus(
      gamesSeason,
    );

  return (
    <div className="mt-5 rounded-[18px] bg-[#06142E] p-5 text-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">
            Periodo
          </p>

          <p className="mt-2 text-lg font-black">
            {formatDateRange(
              gamesSeason.startsAt,
              gamesSeason.endsAt,
            )}
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-[9px] font-black uppercase ${
            isActive
              ? "bg-emerald-400/15 text-emerald-300"
              : "bg-amber-300/15 text-amber-200"
          }`}
        >
          {isActive
            ? "Attiva"
            : temporalStatus ===
                "upcoming"
              ? "Programmata"
              : "Configurata"}
        </span>
      </div>

      <p className="mt-4 text-xs font-bold leading-5 text-white/50">
        Tutte le competizioni sono incluse automaticamente. Alla data di fine i Games non saranno più visibili al pubblico; il catalogo giochi resterà salvato.
      </p>

      <div className="mt-5 border-t border-white/10 pt-4">
        <button
          type="button"
          disabled={
            isDeleting
          }
          onClick={
            onDelete
          }
          className="min-h-11 w-full rounded-[12px] bg-red-500/15 px-4 text-[10px] font-black uppercase text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isDeleting
            ? "Eliminazione..."
            : "Elimina Games Season"}
        </button>

        <p className="mt-2 text-[9px] font-bold leading-4 text-white/30">
          Elimina soltanto la Games Season corrente. Il catalogo permanente dei giochi resta salvato.
        </p>
      </div>
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label:
    string;

  value:
    string;

  onChange:
    (
      value:
        string,
    ) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-black uppercase text-[#06142E]/45">
        {label}
      </span>

      <input
        type="date"
        value={
          value
        }
        onChange={(
          event,
        ) =>
          onChange(
            event.target.value,
          )
        }
        className="mt-2 min-h-11 w-full rounded-[12px] bg-[#F5F5F2] px-4 text-sm font-bold text-[#06142E] outline-none"
      />
    </label>
  );
}

function formatDateRange(
  startsAt:
    unknown,

  endsAt:
    unknown,
): string {
  const start =
    toGamesDate(
      startsAt,
    );

  const end =
    toGamesDate(
      endsAt,
    );

  if (
    !start ||
    !end
  ) {
    return "Periodo non definito";
  }

  const formatter =
    new Intl.DateTimeFormat(
      "it-IT",
      {
        day:
          "2-digit",

        month:
          "2-digit",

        year:
          "numeric",
      },
    );

  return `${formatter.format(
    start,
  )} → ${formatter.format(
    end,
  )}`;
}
