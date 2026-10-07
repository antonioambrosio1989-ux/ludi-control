"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import {
  db,
} from "@/src/lib/firebase";

import {
  FirebasePlayerRepository,
} from "@/src/services/player/FirebasePlayerRepository";

import {
  FirebaseSeasonPlayerRepository,
} from "@/src/services/player/FirebaseSeasonPlayerRepository";

import type {
  SeasonPlayerRole,
} from "@/src/types/SeasonPlayer";

type PendingRosterSuggestion = {
  id: string;
  seasonId: string;
  teamId: string;
  teamName: string;
  name: string;
};

type SuggestionDraft = {
  name: string;
  birthYear: string;
  role:
    | SeasonPlayerRole
    | "";
};

const EMPTY_DRAFT:
  SuggestionDraft = {
    name: "",
    birthYear: "",
    role: "",
  };

function getString(
  value: unknown,
) {
  return typeof value ===
      "string" &&
    value.trim()
    ? value.trim()
    : undefined;
}

function normalizeName(
  value: string,
) {
  return value
    .trim()
    .toLocaleLowerCase("it")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /[^a-z0-9]+/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function parseSuggestion(
  id: string,
  value:
    Record<string, unknown>,
): PendingRosterSuggestion | undefined {
  const seasonId =
    getString(
      value.seasonId,
    );

  const teamId =
    getString(
      value.teamId,
    );

  const teamName =
    getString(
      value.teamName,
    );

  const name =
    getString(
      value.name,
    );

  if (
    value.status !== "pending" ||
    !seasonId ||
    !teamId ||
    !teamName ||
    !name
  ) {
    return undefined;
  }

  return {
    id,
    seasonId,
    teamId,
    teamName,
    name,
  };
}

export default function LineupRosterSuggestionsCard({
  seasonId,
}: {
  seasonId?: string;
}) {
  const [
    suggestions,
    setSuggestions,
  ] = useState<
    PendingRosterSuggestion[]
  >([]);

  const [
    drafts,
    setDrafts,
  ] = useState<
    Record<
      string,
      SuggestionDraft
    >
  >({});

  const [
    busyId,
    setBusyId,
  ] = useState<string>();

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null,
  );

  const normalizedSeasonId =
    seasonId?.trim() ?? "";

  useEffect(
    () => {
      if (!normalizedSeasonId) {
        return;
      }

      const suggestionsQuery =
        query(
          collection(
            db,
            "lineupRosterSuggestions",
          ),
          where(
            "seasonId",
            "==",
            normalizedSeasonId,
          ),
        );

      return onSnapshot(
        suggestionsQuery,
        (snapshot) => {
          const nextSuggestions =
            snapshot.docs.flatMap(
              (currentDocument) => {
                const suggestion =
                  parseSuggestion(
                    currentDocument.id,
                    currentDocument.data(),
                  );

                return suggestion
                  ? [suggestion]
                  : [];
              },
            );

          setSuggestions(
            nextSuggestions,
          );

          setErrorMessage(null);

          setDrafts(
            (currentDrafts) => {
              const nextDrafts = {
                ...currentDrafts,
              };

              for (
                const suggestion of
                  nextSuggestions
              ) {
                if (
                  nextDrafts[
                    suggestion.id
                  ]
                ) {
                  continue;
                }

                nextDrafts[
                  suggestion.id
                ] = {
                  ...EMPTY_DRAFT,
                  name:
                    suggestion.name,
                };
              }

              return nextDrafts;
            },
          );
        },
        (error) => {
          console.error(
            "Errore suggerimenti rosa WhatsApp:",
            error,
          );

          setErrorMessage(
            "Impossibile caricare le verifiche dei nuovi giocatori.",
          );
        },
      );
    },
    [normalizedSeasonId],
  );

  const visibleSuggestions =
    normalizedSeasonId
      ? suggestions.filter(
          (suggestion) =>
            suggestion.seasonId ===
            normalizedSeasonId,
        )
      : [];

  const pendingCount =
    visibleSuggestions.length;

  function updateDraft(
    suggestion:
      PendingRosterSuggestion,
    patch:
      Partial<SuggestionDraft>,
  ) {
    setDrafts(
      (current) => ({
        ...current,
        [suggestion.id]: {
          ...EMPTY_DRAFT,
          ...current[
            suggestion.id
          ],
          ...patch,
          name:
            patch.name ??
            current[
              suggestion.id
            ]?.name ??
            suggestion.name,
        },
      }),
    );
  }

  async function keepMatchOnly(
    suggestion:
      PendingRosterSuggestion,
  ) {
    setBusyId(
      suggestion.id,
    );
    setErrorMessage(null);

    try {
      await updateDoc(
        doc(
          db,
          "lineupRosterSuggestions",
          suggestion.id,
        ),
        {
          status:
            "match_only",
          resolvedAt:
            serverTimestamp(),
          updatedAt:
            serverTimestamp(),
        },
      );
    } catch (error) {
      console.error(
        "Errore chiusura suggerimento rosa:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossibile chiudere la verifica.",
      );
    } finally {
      setBusyId(undefined);
    }
  }

  async function addToRoster(
    suggestion:
      PendingRosterSuggestion,
  ) {
    const draft:
      SuggestionDraft =
      drafts[
        suggestion.id
      ] ?? {
        ...EMPTY_DRAFT,
        name:
          suggestion.name,
      };

    const normalizedFullName =
      draft.name
        .replace(/\s+/g, " ")
        .trim();

    const nameParts =
      normalizedFullName
        .split(" ")
        .filter(Boolean);

    if (nameParts.length < 2) {
      setErrorMessage(
        "Per aggiungere il giocatore alla rosa inserisci nome e cognome completi.",
      );
      return;
    }

    if (!draft.role) {
      setErrorMessage(
        "Seleziona il ruolo del giocatore.",
      );
      return;
    }

    const firstName =
      nameParts[0];

    const lastName =
      nameParts
        .slice(1)
        .join(" ");

    let birthYear:
      | number
      | undefined;

    if (draft.birthYear.trim()) {
      birthYear =
        Number(
          draft.birthYear,
        );

      const currentYear =
        new Date().getFullYear();

      if (
        !Number.isInteger(
          birthYear,
        ) ||
        birthYear < 1940 ||
        birthYear > currentYear
      ) {
        setErrorMessage(
          "Inserisci un anno di nascita valido oppure lascia il campo vuoto.",
        );
        return;
      }
    }

    setBusyId(
      suggestion.id,
    );
    setErrorMessage(null);

    try {
      const seasonSnapshot =
        await getDoc(
          doc(
            db,
            "seasons",
            suggestion.seasonId,
          ),
        );

      const competitionId =
        seasonSnapshot.exists()
          ? getString(
              seasonSnapshot.data()
                .competitionId,
            )
          : undefined;

      if (!competitionId) {
        throw new Error(
          "Impossibile determinare la competizione della stagione selezionata.",
        );
      }

      const players =
        (
          await FirebasePlayerRepository.getAllWithPrivate()
        ).filter(
          (player) =>
            player.competitionId ===
            competitionId,
        );

      const sameName =
        players.filter(
          (player) =>
            normalizeName(
              player.firstName,
            ) ===
              normalizeName(
                firstName,
              ) &&
            normalizeName(
              player.lastName,
            ) ===
              normalizeName(
                lastName,
              ),
        );

      let playerId =
        birthYear === undefined
          ? sameName.length === 1
            ? sameName[0]?.id
            : undefined
          : sameName.find(
              (candidate) =>
                candidate.birthYear ===
                  birthYear,
            )?.id;

      if (
        birthYear === undefined &&
        sameName.length > 1
      ) {
        throw new Error(
          "Esistono più giocatori con questo nome. Inserisci l'anno di nascita per scegliere quello corretto.",
        );
      }

      if (!playerId) {
        playerId =
          await FirebasePlayerRepository.create({
            competitionId,
            firstName,
            lastName,
            birthYear,
          });
      }

      const alreadyInRoster =
        await FirebaseSeasonPlayerRepository.exists(
          suggestion.seasonId,
          suggestion.teamId,
          playerId,
        );

      if (!alreadyInRoster) {
        await FirebaseSeasonPlayerRepository.create({
          seasonId:
            suggestion.seasonId,
          playerId,
          teamId:
            suggestion.teamId,
          role:
            draft.role,
        });
      }

      await updateDoc(
        doc(
          db,
          "lineupRosterSuggestions",
          suggestion.id,
        ),
        {
          status:
            "approved",
          playerId,
          resolvedName:
            `${firstName} ${lastName}`,
          role:
            draft.role,
          birthYear:
            birthYear ?? null,
          resolvedAt:
            serverTimestamp(),
          updatedAt:
            serverTimestamp(),
        },
      );
    } catch (error) {
      console.error(
        "Errore aggiunta giocatore dalla dashboard:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossibile aggiungere il giocatore alla rosa.",
      );
    } finally {
      setBusyId(undefined);
    }
  }

  if (!normalizedSeasonId) {
    return null;
  }

  if (
    pendingCount === 0 &&
    !errorMessage
  ) {
    return null;
  }

  return (
    <section className="mb-5">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
            Formazioni WhatsApp
          </p>

          <h2 className="mt-1 text-lg font-black uppercase text-[#06142E]">
            Nuovi giocatori da verificare
          </h2>
        </div>

        {pendingCount > 0 && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black text-amber-800">
            {pendingCount}
          </span>
        )}
      </div>

      {errorMessage && (
        <div className="mb-3 rounded-[13px] border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-bold leading-5 text-red-700">
            {errorMessage}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {visibleSuggestions.map(
          (suggestion) => {
            const draft:
              SuggestionDraft =
              drafts[
                suggestion.id
              ] ?? {
                ...EMPTY_DRAFT,
                name:
                  suggestion.name,
              };

            const isBusy =
              busyId ===
              suggestion.id;

            return (
              <article
                key={suggestion.id}
                className="rounded-[13px] border border-amber-200 bg-amber-50 p-5 shadow-[0_10px_24px_rgba(6,20,46,0.08)]"
              >
                <p className="text-sm font-black leading-6 text-[#06142E]">
                  Il {suggestion.teamName} ha aggiunto un nuovo giocatore alla formazione: {suggestion.name}. Vuoi aggiungerlo alla rosa della squadra?
                </p>

                <p className="mt-2 text-xs font-bold leading-5 text-[#06142E]/50">
                  La risposta WhatsApp non modifica la rosa. Solo un Admin può confermare questa operazione.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <label className="sm:col-span-1">
                    <span className="text-[10px] font-black uppercase text-[#06142E]/45">
                      Nome e cognome
                    </span>

                    <input
                      value={draft.name}
                      disabled={isBusy}
                      onChange={(event) => {
                        updateDraft(
                          suggestion,
                          {
                            name:
                              event.target.value,
                          },
                        );
                      }}
                      className="mt-1 h-11 w-full rounded-[10px] border border-[#06142E]/10 bg-white px-3 text-sm font-bold text-[#06142E] outline-none"
                    />
                  </label>

                  <label>
                    <span className="text-[10px] font-black uppercase text-[#06142E]/45">
                      Anno nascita
                    </span>

                    <input
                      inputMode="numeric"
                      value={draft.birthYear}
                      disabled={isBusy}
                      placeholder="Solo se serve"
                      onChange={(event) => {
                        updateDraft(
                          suggestion,
                          {
                            birthYear:
                              event.target.value.replace(
                                /\D/g,
                                "",
                              ).slice(0, 4),
                          },
                        );
                      }}
                      className="mt-1 h-11 w-full rounded-[10px] border border-[#06142E]/10 bg-white px-3 text-sm font-bold text-[#06142E] outline-none"
                    />
                  </label>

                  <label>
                    <span className="text-[10px] font-black uppercase text-[#06142E]/45">
                      Ruolo
                    </span>

                    <select
                      value={draft.role}
                      disabled={isBusy}
                      onChange={(event) => {
                        updateDraft(
                          suggestion,
                          {
                            role:
                              event.target.value as
                                | SeasonPlayerRole
                                | "",
                          },
                        );
                      }}
                      className="mt-1 h-11 w-full rounded-[10px] border border-[#06142E]/10 bg-white px-3 text-sm font-bold text-[#06142E] outline-none"
                    >
                      <option value="">
                        Seleziona
                      </option>
                      <option value="Portiere">
                        Portiere
                      </option>
                      <option value="Difensore">
                        Difensore
                      </option>
                      <option value="Attaccante">
                        Attaccante
                      </option>
                    </select>
                  </label>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                      void keepMatchOnly(
                        suggestion,
                      );
                    }}
                    className="min-h-11 rounded-[10px] bg-white px-3 text-[10px] font-black uppercase text-[#06142E] disabled:opacity-40"
                  >
                    Solo questa formazione
                  </button>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                      void addToRoster(
                        suggestion,
                      );
                    }}
                    className="min-h-11 rounded-[10px] bg-[#06142E] px-3 text-[10px] font-black uppercase text-white disabled:opacity-40"
                  >
                    {isBusy
                      ? "Salvataggio..."
                      : "Aggiungi alla rosa"}
                  </button>
                </div>
              </article>
            );
          },
        )}
      </div>
    </section>
  );
}
