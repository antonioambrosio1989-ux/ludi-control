"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  useAuth,
} from "@/src/hooks/useAuth";

import {
  FirebasePlayerRepository,
} from "@/src/services/player/FirebasePlayerRepository";

import type {
  PlayerProfile,
} from "@/src/types/PlayerProfile";

type PublicPlayerPhotoFile = {
  fileName: string;
  publicUrl: string;
  key: string;
};

type PhotoMatch = {
  player: PlayerProfile;
  file: PublicPlayerPhotoFile;
};

type PhotoConflict = {
  player: PlayerProfile;
  files: PublicPlayerPhotoFile[];
  reason: string;
};

type Props = {
  players: PlayerProfile[];

  onCompleted:
    () =>
      Promise<void> |
      void;
};

const IMAGE_EXTENSIONS =
  /\.(avif|gif|jpe?g|png|webp)$/i;

export default function PlayerPublicPhotoAssociationPanel({
  players,
  onCompleted,
}: Props) {
  const {
    user,
  } =
    useAuth();

  const [
    isAnalyzing,
    setIsAnalyzing,
  ] =
    useState(false);

  const [
    isApplying,
    setIsApplying,
  ] =
    useState(false);

  const [
    matches,
    setMatches,
  ] =
    useState<
      PhotoMatch[]
    >([]);

  const [
    conflicts,
    setConflicts,
  ] =
    useState<
      PhotoConflict[]
    >([]);

  const [
    missingPlayers,
    setMissingPlayers,
  ] =
    useState<
      PlayerProfile[]
    >([]);

  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(
      null,
    );

  const [
    message,
    setMessage,
  ] =
    useState<
      string |
      null
    >(
      null,
    );

  const alreadyLinkedCount =
    useMemo(
      () =>
        matches.filter(
          ({ player, file }) =>
            player.photoUrl ===
            file.publicUrl,
        ).length,
      [
        matches,
      ],
    );

  const toUpdateCount =
    matches.length -
    alreadyLinkedCount;

  async function analyze() {
    if (
      isAnalyzing ||
      isApplying
    ) {
      return;
    }

    setIsAnalyzing(
      true,
    );

    setError(
      null,
    );

    setMessage(
      null,
    );

    try {
      if (!user) {
        throw new Error(
          "Sessione Admin non disponibile.",
        );
      }

      const token =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/admin/player-public-photos",
          {
            method:
              "GET",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },

            cache:
              "no-store",
          },
        );

      if (
        !response.ok
      ) {
        throw new Error(
          "Impossibile leggere la cartella public/players.",
        );
      }

      const payload =
        await response.json() as {
          files?:
            PublicPlayerPhotoFile[];
        };

      const files =
        Array.isArray(
          payload.files,
        )
          ? payload.files.filter(
              (file) =>
                Boolean(
                  file?.fileName &&
                  file?.publicUrl &&
                  file?.key,
                ),
            )
          : [];

      const filesByKey =
        new Map<
          string,
          PublicPlayerPhotoFile[]
        >();

      for (
        const file of files
      ) {
        const current =
          filesByKey.get(
            file.key,
          ) ?? [];

        current.push(
          file,
        );

        filesByKey.set(
          file.key,
          current,
        );
      }

      const sameNamePlayerCounts =
        new Map<
          string,
          number
        >();

      for (
        const player of players
      ) {
        const baseKey =
          createPlayerPhotoKey({
            firstName:
              player.firstName,

            lastName:
              player.lastName,
          });

        sameNamePlayerCounts.set(
          baseKey,

          (
            sameNamePlayerCounts.get(
              baseKey,
            ) ??
            0
          ) +
            1,
        );
      }

      const nextMatches:
        PhotoMatch[] = [];

      const nextConflicts:
        PhotoConflict[] =
        [];

      const nextMissing:
        PlayerProfile[] =
        [];

      for (
        const player of players
      ) {
        const baseKey =
          createPlayerPhotoKey({
            firstName:
              player.firstName,

            lastName:
              player.lastName,
          });

        const birthYearKey =
          typeof player.birthYear ===
          "number"
            ? createPlayerPhotoKey({
                firstName:
                  player.firstName,

                lastName:
                  player.lastName,

                birthYear:
                  player.birthYear,
              })
            : null;

        const yearMatches =
          birthYearKey
            ? filesByKey.get(
                birthYearKey,
              ) ?? []
            : [];

        if (
          yearMatches.length ===
          1
        ) {
          nextMatches.push({
            player,
            file:
              yearMatches[0],
          });

          continue;
        }

        if (
          yearMatches.length >
          1
        ) {
          nextConflicts.push({
            player,
            files:
              yearMatches,

            reason:
              "Più immagini coincidono con cognome-nome-anno.",
          });

          continue;
        }

        const baseMatches =
          filesByKey.get(
            baseKey,
          ) ?? [];

        if (
          baseMatches.length ===
          0
        ) {
          nextMissing.push(
            player,
          );

          continue;
        }

        if (
          baseMatches.length >
          1
        ) {
          nextConflicts.push({
            player,
            files:
              baseMatches,

            reason:
              "Più immagini coincidono con cognome-nome.",
          });

          continue;
        }

        if (
          (
            sameNamePlayerCounts.get(
              baseKey,
            ) ??
            0
          ) >
          1
        ) {
          nextConflicts.push({
            player,
            files:
              baseMatches,

            reason:
              "Esistono più giocatori con lo stesso nome: usa cognome-nome-annodinascita per evitare associazioni errate.",
          });

          continue;
        }

        nextMatches.push({
          player,
          file:
            baseMatches[0],
        });
      }

      setMatches(
        nextMatches,
      );

      setConflicts(
        nextConflicts,
      );

      setMissingPlayers(
        nextMissing,
      );

      setMessage(
        `Analisi completata: ${nextMatches.length} foto riconosciute, ${nextConflicts.length} conflitti, ${nextMissing.length} senza immagine.`,
      );
    } catch (
      currentError
    ) {
      setMatches(
        [],
      );

      setConflicts(
        [],
      );

      setMissingPlayers(
        [],
      );

      setError(
        currentError instanceof Error
          ? currentError.message
          : "Impossibile analizzare le foto giocatori.",
      );
    } finally {
      setIsAnalyzing(
        false,
      );
    }
  }

  async function applyMatches() {
    if (
      isApplying ||
      matches.length ===
      0
    ) {
      return;
    }

    const pendingMatches =
      matches.filter(
        ({ player, file }) =>
          player.photoUrl !==
          file.publicUrl,
      );

    if (
      pendingMatches.length ===
      0
    ) {
      setMessage(
        "Tutte le foto riconosciute sono già associate correttamente.",
      );

      return;
    }

    const confirmed =
      window.confirm(
        [
          `Associare ${pendingMatches.length} foto ai profili giocatore?`,
          "",
          "Le immagini verranno collegate usando i file presenti in public/players.",
          "I conflitti non verranno modificati.",
        ].join(
          "\n",
        ),
      );

    if (
      !confirmed
    ) {
      return;
    }

    setIsApplying(
      true,
    );

    setError(
      null,
    );

    setMessage(
      null,
    );

    let updated =
      0;

    const failed:
      string[] = [];

    try {
      for (
        const {
          player,
          file,
        } of pendingMatches
      ) {
        try {
          await FirebasePlayerRepository.update({
            playerId:
              player.id,

            photoUrl:
              file.publicUrl,
          });

          updated +=
            1;
        } catch (
          currentError
        ) {
          failed.push(
            `${player.lastName} ${player.firstName}`,
          );

          console.error(
            "Errore associazione foto giocatore:",
            currentError,
          );
        }
      }

      await onCompleted();

      setMessage(
        failed.length >
          0
          ? `Associate ${updated} foto. ${failed.length} profili non sono stati aggiornati.`
          : `Associate correttamente ${updated} foto profilo.`,
      );
    } finally {
      setIsApplying(
        false,
      );
    }
  }

  return (
    <section className="mb-5 rounded-[18px] border border-[#06142E]/10 bg-white p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#06142E]/40">
        Foto profilo
      </p>

      <h2 className="mt-1 text-lg font-black uppercase text-[#06142E]">
        Associa da public/players
      </h2>

      <p className="mt-1 text-xs font-bold leading-5 text-[#06142E]/50">
        Riconosce file chiamati cognome-nome oppure cognome-nome-annodinascita.
        Il formato con anno ha sempre priorità.
      </p>

      <button
        type="button"
        disabled={
          isAnalyzing ||
          isApplying
        }
        onClick={() => {
          void analyze();
        }}
        className="mt-4 h-11 w-full rounded-[13px] border border-[#06142E]/15 bg-white px-4 text-xs font-black uppercase text-[#06142E] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isAnalyzing
          ? "Analisi foto..."
          : matches.length >
              0 ||
            conflicts.length >
              0 ||
            missingPlayers.length >
              0
            ? "Rianalizza foto"
            : "Analizza public/players"}
      </button>

      {error && (
        <div className="mt-3 rounded-[13px] border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-bold text-red-700">
            {
              error
            }
          </p>
        </div>
      )}

      {message && (
        <div className="mt-3 rounded-[13px] border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-bold text-emerald-700">
            {
              message
            }
          </p>
        </div>
      )}

      {(matches.length >
        0 ||
        conflicts.length >
          0 ||
        missingPlayers.length >
          0) && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-4 gap-2">
            <Stat
              label="Trovate"
              value={
                matches.length
              }
            />

            <Stat
              label="Da associare"
              value={
                toUpdateCount
              }
            />

            <Stat
              label="Conflitti"
              value={
                conflicts.length
              }
            />

            <Stat
              label="Assenti"
              value={
                missingPlayers.length
              }
            />
          </div>

          {conflicts.length >
            0 && (
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">
                Conflitti — nessuna modifica automatica
              </p>

              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {conflicts.map(
                  (
                    conflict,
                  ) => (
                    <div
                      key={
                        conflict
                          .player
                          .id
                      }
                      className="rounded-[12px] border border-amber-200 bg-amber-50 p-3"
                    >
                      <p className="text-sm font-black text-[#06142E]">
                        {
                          conflict
                            .player
                            .lastName
                        }{" "}
                        {
                          conflict
                            .player
                            .firstName
                        }
                        {conflict
                          .player
                          .birthYear
                          ? ` · ${conflict.player.birthYear}`
                          : ""}
                      </p>

                      <p className="mt-1 text-[11px] font-bold text-amber-700">
                        {
                          conflict.reason
                        }
                      </p>

                      <p className="mt-1 text-[10px] font-bold text-[#06142E]/40">
                        {conflict.files
                          .map(
                            (file) =>
                              file.fileName,
                          )
                          .join(
                            " · ",
                          )}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}

          {matches.length >
            0 && (
            <button
              type="button"
              disabled={
                isApplying ||
                toUpdateCount ===
                  0
              }
              onClick={() => {
                void applyMatches();
              }}
              className="h-11 w-full rounded-[13px] bg-[#06142E] px-4 text-xs font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isApplying
                ? "Associazione..."
                : toUpdateCount ===
                    0
                  ? "Foto già associate"
                  : `Associa ${toUpdateCount} foto`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
}: {
  label:
    string;

  value:
    number;
}) {
  return (
    <div className="rounded-[12px] bg-[#06142E]/[0.035] p-2 text-center">
      <p className="text-lg font-black text-[#06142E]">
        {
          value
        }
      </p>

      <p className="mt-1 text-[8px] font-black uppercase text-[#06142E]/40">
        {
          label
        }
      </p>
    </div>
  );
}

function createPlayerPhotoKey({
  firstName,
  lastName,
  birthYear,
}: {
  firstName:
    string;

  lastName:
    string;

  birthYear?:
    number;
}) {
  return [
    normalizeKeyPart(
      lastName,
    ),

    normalizeKeyPart(
      firstName,
    ),

    ...(typeof birthYear ===
    "number"
      ? [
          String(
            birthYear,
          ),
        ]
      : []),
  ]
    .filter(
      Boolean,
    )
    .join(
      "-",
    );
}

function normalizeKeyPart(
  value: string,
) {
  return value
    .trim()
    .toLocaleLowerCase(
      "it",
    )
    .normalize(
      "NFD",
    )
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /['’`]/g,
      "",
    )
    .replace(
      /[^a-z0-9]+/g,
      "-",
    )
    .replace(
      /^-+|-+$/g,
      "",
    );
}

export function normalizePublicPlayerPhotoFileName(
  fileName: string,
) {
  const withoutExtension =
    fileName.replace(
      IMAGE_EXTENSIONS,
      "",
    );

  return normalizeKeyPart(
    withoutExtension,
  );
}
