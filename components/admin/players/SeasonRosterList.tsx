"use client";

import Image from "next/image";

import type {
  ReactNode,
} from "react";

import type {
  PlayerProfile,
} from "@/src/types/PlayerProfile";

import type {
  SeasonPlayer,
  SeasonPlayerRole,
} from "@/src/types/SeasonPlayer";

type Props = {
  roles:
    SeasonPlayerRole[];

  rosterByRole:
    Record<
      SeasonPlayerRole,
      SeasonPlayer[]
    >;

  players:
    PlayerProfile[];

  removingEntryId:
    string | null;

  editingEntryId:
    string | null;

  editForm:
    ReactNode;

  onRemove: (
    entry:
      SeasonPlayer,
  ) => void;

  onEdit: (
    entry:
      SeasonPlayer,

    player?:
      PlayerProfile,
  ) => void;
};

/*
 * ============================================================
 * LISTA ROSA
 * ============================================================
 */

export default function SeasonRosterList({
  roles,

  rosterByRole,

  players,

  removingEntryId,

  editingEntryId,
  editForm,

  onRemove,
  onEdit,
}: Props) {
  return (
    <section className="grid min-w-0 gap-5 xl:grid-cols-3">
      {roles.map(
        (
          role,
        ) => (
          <RosterRoleSection
            key={
              role
            }
            role={
              role
            }
            entries={
              rosterByRole[
                role
              ]
            }
            players={
              players
            }
            removingEntryId={
              removingEntryId
            }
            editingEntryId={
              editingEntryId
            }
            editForm={
              editForm
            }
            onRemove={
              onRemove
            }
            onEdit={
              onEdit
            }
          />
        ),
      )}
    </section>
  );
}

/*
 * ============================================================
 * SEZIONE RUOLO
 * ============================================================
 */

function RosterRoleSection({
  role,
  entries,
  players,
  removingEntryId,
  editingEntryId,
  editForm,
  onRemove,
  onEdit,
}: {
  role:
    SeasonPlayerRole;

  entries:
    SeasonPlayer[];

  players:
    PlayerProfile[];

  removingEntryId:
    string | null;

  editingEntryId:
    string | null;

  editForm:
    ReactNode;

  onRemove: (
    entry:
      SeasonPlayer,
  ) => void;

  onEdit: (
    entry:
      SeasonPlayer,

    player?:
      PlayerProfile,
  ) => void;
}) {
  return (
    <section className="min-w-0 rounded-[18px] border border-[#06142E]/8 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-[0.15em] text-[#06142E]">
          {getRoleLabel(
            role,
          )}
        </h2>

        <span className="rounded-full bg-[#06142E]/[0.06] px-3 py-1 text-[10px] font-black text-[#06142E]/55">
          {
            entries.length
          }
        </span>
      </div>

      {entries.length >
      0 ? (
        <div className="space-y-3">
          {entries.map(
            (
              entry,
            ) => {
              const player =
                getPlayerProfile(
                  players,

                  entry.playerId,
                );

              const isRemoving =
                removingEntryId ===
                entry.id;

              const isEditing =
                editingEntryId ===
                String(
                  entry.id,
                );

              return (
                <div
                  key={
                    entry.id
                  }
                  className="space-y-3"
                >
                  <article
                    className="flex min-w-0 items-center gap-3 rounded-[15px] border border-[#06142E]/8 bg-[#F8F8F5] p-3"
                  >
                  <PlayerAvatar
                    player={
                      player
                    }
                  />

                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-black text-[#06142E]">
                      {player
                        ? `${player.firstName} ${player.lastName}`
                        : "Giocatore non trovato"}
                    </h3>

                    <p className="mt-1 text-xs font-bold text-[#06142E]/45">
                      {
                        role
                      }

                      {entry.shirtNumber
                        ? ` · #${entry.shirtNumber}`
                        : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onEdit(
                          entry,

                          player,
                        );
                      }}
                      className="rounded-[10px] px-3 py-1.5 text-[10px] font-black uppercase text-[#06142E]"
                    >
                      Modifica
                    </button>

                    <button
                      type="button"
                      disabled={
                        isRemoving
                      }
                      onClick={() => {
                        onRemove(
                          entry,
                        );
                      }}
                      className="rounded-[10px] px-3 py-1.5 text-[10px] font-black uppercase text-red-600 disabled:opacity-35"
                    >
                      {isRemoving
                        ? "Rimozione..."
                        : "Rimuovi"}
                    </button>
                  </div>
                  </article>

                  {isEditing &&
                    editForm}
                </div>
              );
            },
          )}
        </div>
      ) : (
        <div className="rounded-[16px] border border-dashed border-[#06142E]/15 bg-white/50 p-5 text-center">
          <p className="text-xs font-bold text-[#06142E]/40">
            Nessun giocatore in questo ruolo.
          </p>
        </div>
      )}
    </section>
  );
}

/*
 * ============================================================
 * AVATAR GIOCATORE
 * ============================================================
 */

function PlayerAvatar({
  player,
}: {
  player?:
    PlayerProfile;
}) {
  return (
    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#06142E] font-black text-white sm:h-14 sm:w-14">
      {player?.photoUrl ? (
        <Image
          src={
            player.photoUrl
          }
          alt={`${player.firstName} ${player.lastName}`}
          fill
          unoptimized
          sizes="56px"
          className="object-cover"
        />
      ) : (
        getInitials(
          player,
        )
      )}
    </div>
  );
}

/*
 * ============================================================
 * RECUPERO PROFILO
 * ============================================================
 */

function getPlayerProfile(
  players:
    PlayerProfile[],

  playerId:
    string,
) {
  return players.find(
    (
      player,
    ) =>
      String(
        player.id,
      ) ===
      String(
        playerId,
      ),
  );
}

/*
 * ============================================================
 * INIZIALI
 * ============================================================
 */

function getInitials(
  player?:
    PlayerProfile,
) {
  if (
    !player
  ) {
    return "?";
  }

  return `${player.firstName[0] ?? ""}${player.lastName[0] ?? ""}`.toUpperCase();
}

/*
 * ============================================================
 * ETICHETTA RUOLO
 * ============================================================
 */

function getRoleLabel(
  role:
    SeasonPlayerRole,
) {
  if (
    role ===
    "Portiere"
  ) {
    return "Portieri";
  }

  if (
    role ===
    "Difensore"
  ) {
    return "Difensori";
  }

  return "Attaccanti";
}