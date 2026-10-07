"use client";

import Image from "next/image";

import type {
  PlayerProfile,
} from "@/src/types/PlayerProfile";

/*
 * ============================================================
 * PROPS
 * ============================================================
 */

type Props = {
  players:
    PlayerProfile[];

  targetPlayerId:
    string;

  setTargetPlayerId: (
    value:
      string,
  ) => void;

  sourcePlayerId:
    string;

  setSourcePlayerId: (
    value:
      string,
  ) => void;

  targetPlayer?:
    PlayerProfile;

  sourcePlayer?:
    PlayerProfile;

  isMerging:
    boolean;

  mergeError:
    string | null;

  setMergeError: (
    value:
      string | null,
  ) => void;

  mergeSuccess:
    string | null;

  setMergeSuccess: (
    value:
      string | null,
  ) => void;

  onMerge:
    () => void;
};

/*
 * ============================================================
 * MERGE PANEL
 * ============================================================
 */

export default function AdminPlayerMergePanel({
  players,

  targetPlayerId,
  setTargetPlayerId,

  sourcePlayerId,
  setSourcePlayerId,

  targetPlayer,
  sourcePlayer,

  isMerging,

  mergeError,
  setMergeError,

  mergeSuccess,
  setMergeSuccess,

  onMerge,
}: Props) {
  return (
    <section className="mb-5 overflow-hidden rounded-[18px] bg-white shadow-[0_10px_26px_rgba(6,20,46,0.10)]">
      <div className="bg-[#06142E] p-5 text-white">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-yellow-300">
          Gestione duplicati
        </p>

        <h2 className="mt-1 text-2xl font-black uppercase">
          Unisci profili
        </h2>

        <p className="mt-2 text-xs font-bold leading-5 text-white/55">
          Scegli il profilo definitivo da mantenere e il duplicato da assorbire.
        </p>
      </div>

      <div className="p-5">
        {/*
         * ======================================================
         * TARGET
         * ======================================================
         */}

        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
            1. Profilo da mantenere
          </span>

          <select
            value={
              targetPlayerId
            }
            disabled={
              isMerging
            }
            onChange={(
              event,
            ) => {
              setTargetPlayerId(
                event.target.value,
              );

              setMergeError(
                null,
              );

              setMergeSuccess(
                null,
              );
            }}
            className="ludi-input"
          >
            <option value="">
              Seleziona il profilo principale
            </option>

            {players.map(
              (
                player,
              ) => (
                <option
                  key={
                    player.id
                  }
                  value={
                    player.id
                  }
                >
                  {formatPlayerSelectLabel(
                    player,
                  )}
                </option>
              ),
            )}
          </select>
        </label>

        {targetPlayer && (
          <div className="mt-3">
            <MergePlayerCard
              player={
                targetPlayer
              }
              label="Questo profilo verrà mantenuto"
              type="target"
            />
          </div>
        )}

        {/*
         * ======================================================
         * FRECCIA
         * ======================================================
         */}

        <div className="my-5 text-center">
          <span className="text-2xl text-[#06142E]/25">
            ↑
          </span>

          <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#06142E]/30">
            I dati confluiranno nel profilo superiore
          </p>
        </div>

        {/*
         * ======================================================
         * SOURCE
         * ======================================================
         */}

        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
            2. Profilo duplicato da eliminare
          </span>

          <select
            value={
              sourcePlayerId
            }
            disabled={
              isMerging
            }
            onChange={(
              event,
            ) => {
              setSourcePlayerId(
                event.target.value,
              );

              setMergeError(
                null,
              );

              setMergeSuccess(
                null,
              );
            }}
            className="ludi-input"
          >
            <option value="">
              Seleziona il profilo duplicato
            </option>

            {players
              .filter(
                (
                  player,
                ) =>
                  String(
                    player.id,
                  ) !==
                  String(
                    targetPlayerId,
                  ),
              )
              .map(
                (
                  player,
                ) => (
                  <option
                    key={
                      player.id
                    }
                    value={
                      player.id
                    }
                  >
                    {formatPlayerSelectLabel(
                      player,
                    )}
                  </option>
                ),
              )}
          </select>
        </label>

        {sourcePlayer && (
          <div className="mt-3">
            <MergePlayerCard
              player={
                sourcePlayer
              }
              label="Questo profilo verrà eliminato"
              type="source"
            />
          </div>
        )}

        {/*
         * ======================================================
         * DATI TRASFERITI
         * ======================================================
         */}

        <div className="mt-5 rounded-[14px] border border-[#06142E]/8 bg-[#F4F7FB] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#06142E]/40">
            Dati trasferiti
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-[#06142E]/65">
            <span>
              ✓ Statistiche storiche
            </span>

            <span>
              ✓ Stagioni
            </span>

            <span>
              ✓ Premi
            </span>

            <span>
              ✓ Albo d&apos;Oro
            </span>

            <span>
              ✓ Foto mancanti
            </span>

            <span>
              ✓ Dati profilo
            </span>
          </div>
        </div>

        {/*
         * ======================================================
         * WARNING
         * ======================================================
         */}

        <div className="mt-4 rounded-[14px] border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-black uppercase text-amber-700">
            ⚠️ Operazione irreversibile
          </p>

          <p className="mt-1 text-xs font-bold leading-5 text-amber-700/70">
            Al termine dell&apos;operazione il profilo duplicato verrà eliminato definitivamente.
          </p>
        </div>

        {/*
         * ======================================================
         * ERROR
         * ======================================================
         */}

        {mergeError && (
          <div className="mt-4 rounded-[13px] border border-red-200 bg-red-50 p-4">
            <p className="whitespace-pre-line text-sm font-bold text-red-700">
              {
                mergeError
              }
            </p>
          </div>
        )}

        {/*
         * ======================================================
         * SUCCESS
         * ======================================================
         */}

        {mergeSuccess && (
          <div className="mt-4 rounded-[13px] border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-bold text-green-700">
              ✓ {
                mergeSuccess
              }
            </p>
          </div>
        )}

        {/*
         * ======================================================
         * BUTTON
         * ======================================================
         */}

        <button
          type="button"
          disabled={
            isMerging ||
            !targetPlayerId ||
            !sourcePlayerId ||
            targetPlayerId ===
              sourcePlayerId
          }
          onClick={() => {
            void onMerge();
          }}
          className="mt-5 flex h-14 w-full items-center justify-center rounded-[13px] bg-[#06142E] text-xs font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-35"
        >
          {isMerging
            ? "Unione in corso..."
            : "Unisci i due profili"}
        </button>
      </div>
    </section>
  );
}

/*
 * ============================================================
 * MERGE PLAYER CARD
 * ============================================================
 */

function MergePlayerCard({
  player,
  label,
  type,
}: {
  player:
    PlayerProfile;

  label:
    string;

  type:
    | "target"
    | "source";
}) {
  return (
    <article
      className={`rounded-[15px] border p-4 ${
        type ===
        "target"
          ? "border-green-200 bg-green-50"
          : "border-red-200 bg-red-50"
      }`}
    >
      <p
        className={`text-[9px] font-black uppercase tracking-[0.12em] ${
          type ===
          "target"
            ? "text-green-700/55"
            : "text-red-700/55"
        }`}
      >
        {
          label
        }
      </p>

      <div className="mt-3 flex items-center gap-3">
        <PlayerAvatar
          firstName={
            player.firstName
          }
          lastName={
            player.lastName
          }
          photoUrl={
            player.photoUrl
          }
        />

        <div className="min-w-0">
          <p className="text-base font-black text-[#06142E]">
            {
              player.firstName
            }{" "}
            {
              player.lastName
            }
          </p>

          <p className="mt-1 text-xs font-bold text-[#06142E]/45">
            Anno{" "}
            {player.birthYear ??
              "non disponibile"}
          </p>

          <p className="mt-1 break-all text-[9px] font-bold text-[#06142E]/30">
            ID:{" "}
            {
              player.id
            }
          </p>
        </div>
      </div>
    </article>
  );
}

/*
 * ============================================================
 * SELECT LABEL
 * ============================================================
 */

function formatPlayerSelectLabel(
  player:
    PlayerProfile,
) {
  const birthYear =
    player.birthYear !==
    undefined
      ? ` · ${player.birthYear}`
      : "";

  return `${player.lastName} ${player.firstName}${birthYear}`;
}

/*
 * ============================================================
 * AVATAR
 * ============================================================
 */

function PlayerAvatar({
  firstName,
  lastName,
  photoUrl,
}: {
  firstName:
    string;

  lastName:
    string;

  photoUrl?:
    string;
}) {
  return (
    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[17px] bg-[#06142E] text-base font-black text-white">
      {photoUrl ? (
        <Image
          src={
            photoUrl
          }
          alt={`${firstName} ${lastName}`}
          fill
          unoptimized
          sizes="64px"
          className="object-cover"
        />
      ) : (
        getInitials(
          firstName,
          lastName,
        )
      )}
    </div>
  );
}

/*
 * ============================================================
 * INIZIALI
 * ============================================================
 */

function getInitials(
  firstName:
    string,

  lastName:
    string,
) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}