"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Image from "next/image";

import AppShell from "@/components/ui/AppShell";

import HallOfFameImageUploader from "./HallOfFameImageUploader";
import HallOfFameVideoUploader from "./HallOfFameVideoUploader";

import { FirebaseHallOfFameRepository } from "@/src/services/awards/FirebaseHallOfFameRepository";

import {
  useCompetition,
} from "@/src/contexts/CompetitionContext";

import {
  useSeasonRosterData,
} from "@/src/hooks/useSeasonRosterData";

import type {
  HallOfFameItem,
  HallOfFameSection,
  HallOfFameStatus,
  HallOfFameWinnerType,
} from "@/src/types/HallOfFameItem";

/*
 * ============================================================
 * FORM
 * ============================================================
 */

type HallOfFameAdminItem =
  HallOfFameItem & {
    awardDescription?: string;
  };

type FormState = {
  seasonLabel: string;

  section:
    HallOfFameSection;

  category: string;

  awardDescription: string;

  winnerType:
    HallOfFameWinnerType;

  winnerName: string;

  playerId: string;
  teamId: string;

  imageUrl: string;
  imageKey: string;

  videoUrl: string;
  videoKey: string;

  description: string;

  sortOrder: string;

  status:
    HallOfFameStatus;
};


const SECTION_OPTIONS: Array<{
  value: HallOfFameSection;
  label: string;
}> = [
  {
    value: "bestOfSeason",
    label: "Best Of The Season",
  },
  {
    value: "teamOfSeason",
    label: "Team Of The Season",
  },
  {
    value: "goalAndSave",
    label: "Goal & Save Of The Season",
  },
  {
    value: "otherAwards",
    label: "Altri premi",
  },
];

const EMPTY_FORM: FormState = {
  seasonLabel: "",

  section:
    "bestOfSeason",

  category: "",

  awardDescription: "",

  winnerType:
    "player",

  winnerName: "",

  playerId: "",
  teamId: "",

  imageUrl: "",
  imageKey: "",

  videoUrl: "",
  videoKey: "",

  description: "",

  sortOrder:
    "1",

  status:
    "draft",
};

/*
 * ============================================================
 * SCREEN
 * ============================================================
 */

export default function AdminHallOfFameScreen() {
  /*
   * ----------------------------------------------------------
   * STAGIONI
   * ----------------------------------------------------------
   */

  const {
  currentSeason,
  selectedCompetition,
} =
  useCompetition();

const currentSeasonId =
  currentSeason?.id;

const selectedCompetitionId =
  selectedCompetition?.id;

  /*
   * ----------------------------------------------------------
   * GIOCATORI
   * ----------------------------------------------------------
   */

  const {
  seasonPlayers,
  participatingTeams,

  isLoading:
    rosterLoading,

  loadingError:
    rosterError,
} =
  useSeasonRosterData();

  /*
   * ----------------------------------------------------------
   * STATE
   * ----------------------------------------------------------
   */

  const [
    items,
    setItems,
  ] =
    useState<
      HallOfFameItem[]
    >([]);

  const [
    form,
    setForm,
  ] =
    useState<FormState>(
      EMPTY_FORM,
    );

  const [
    editingItemId,
    setEditingItemId,
  ] =
    useState<
      string | null
    >(null);

  const [
    itemsLoading,
    setItemsLoading,
  ] =
    useState(
      true,
    );

  const [
    itemsError,
    setItemsError,
  ] =
    useState<
      string | null
    >(null);

  const [
    isSaving,
    setIsSaving,
  ] =
    useState(
      false,
    );

  const [
    actionError,
    setActionError,
  ] =
    useState<
      string | null
    >(null);

  const [
    selectedSeasonKey,
    setSelectedSeasonKey,
  ] =
    useState<
      string | null
    >(null);

  /*
   * ==========================================================
   * CARICAMENTO HALL OF FAME
   * ==========================================================
   */

  useEffect(() => {
  if (
    !selectedCompetitionId
  ) {
    return;
  }

  const unsubscribe =
    FirebaseHallOfFameRepository.subscribeAll(
      (
        nextItems,
      ) => {
        const competitionItems =
          nextItems.filter(
            (
              item,
            ) =>
              item.competitionId ===
              selectedCompetitionId,
          );

        setItems(
          competitionItems,
        );

        setItemsError(
          null,
        );

        setItemsLoading(
          false,
        );
      },

      (
        currentError,
      ) => {
        console.error(
          "Errore caricamento Hall of Fame:",
          currentError,
        );

        setItemsError(
          currentError.message,
        );

        setItemsLoading(
          false,
        );
      },
    );

  return unsubscribe;
}, [
  selectedCompetitionId,
]);

  /*
   * ==========================================================
   * PREMIO ATTUALMENTE IN MODIFICA
   * ==========================================================
   *
   * Lo calcoliamo una sola volta.
   *
   * Questo ci permette di mantenere il seasonId
   * originale dei premi storici.
   * ==========================================================
   */

  const visibleItems =
  items.filter(
    (
      item,
    ) =>
      item.competitionId ===
      selectedCompetitionId,
  );
  
  const editingItem =
    useMemo(() => {
      if (
        !editingItemId
      ) {
        return undefined;
      }

      return visibleItems.find(
        (
          item,
        ) =>
          item.id ===
          editingItemId,
      );
    }, [
      editingItemId,
      visibleItems,
    ]);

  /*
   * ==========================================================
   * PREMI ORDINATI
   * ==========================================================
   */

  const sortedItems =
    useMemo(() => {
      return visibleItems
        .slice()
        .sort(
          (
            first,
            second,
          ) => {
            if (
              first.seasonLabel !==
              second.seasonLabel
            ) {
              return second.seasonLabel.localeCompare(
                first.seasonLabel,
                "it",
              );
            }

            return (
              first.sortOrder -
              second.sortOrder
            );
          },
        );
    }, [
      visibleItems,
    ]);

  /*
   * ==========================================================
   * ARCHIVIO RAGGRUPPATO PER STAGIONE
   * ==========================================================
   */

  const seasonGroups =
    useMemo(() => {
      const groups =
        new Map<
          string,
          {
            key: string;
            seasonId: string;
            seasonLabel: string;
            items: HallOfFameItem[];
          }
        >();

      for (
        const item of
        sortedItems
      ) {
        const seasonKey =
          item.seasonId?.trim() ||
          item.seasonLabel.trim();

        const existingGroup =
          groups.get(
            seasonKey,
          );

        if (
          existingGroup
        ) {
          existingGroup.items.push(
            item,
          );

          continue;
        }

        groups.set(
          seasonKey,
          {
            key:
              seasonKey,

            seasonId:
              item.seasonId,

            seasonLabel:
              item.seasonLabel,

            items:
              [
                item,
              ],
          },
        );
      }

      return Array.from(
        groups.values(),
      ).sort(
        (
          first,
          second,
        ) =>
          second.seasonLabel.localeCompare(
            first.seasonLabel,
            "it",
          ),
      );
    }, [
      sortedItems,
    ]);

  const selectedSeasonGroup =
    selectedSeasonKey
      ? seasonGroups.find(
          (
            group,
          ) =>
            group.key ===
            selectedSeasonKey,
        )
      : undefined;

  /*
   * ==========================================================
   * LOADING
   * ==========================================================
   */

  const isLoading =
  rosterLoading ||
  itemsLoading;

const loadingError =
  rosterError ||
  itemsError;

  /*
   * ==========================================================
   * UPDATE FORM
   * ==========================================================
   */

  function updateForm<
    Key extends keyof FormState,
  >(
    key:
      Key,

    value:
      FormState[Key],
  ) {
    setForm(
      (
        current,
      ) => ({
        ...current,

        [key]:
          value,
      }),
    );
  }

  /*
   * ==========================================================
   * RESET FORM
   * ==========================================================
   */

  function resetForm() {
    setForm({
      ...EMPTY_FORM,

      seasonLabel:
        currentSeason?.name ??
        "",
    });

    setEditingItemId(
      null,
    );

    setActionError(
      null,
    );
  }

  /*
   * ==========================================================
   * MODIFICA PREMIO
   * ==========================================================
   */

  function startEditing(
    item:
      HallOfFameItem,
  ) {
    setEditingItemId(
      item.id,
    );

    setForm({
      seasonLabel:
        item.seasonLabel,

      section:
        item.section ??
        "otherAwards",

      category:
        item.category,

      awardDescription:
        (
          item as
            HallOfFameAdminItem
        ).awardDescription ??
        "",

      winnerType:
        item.winnerType,

      winnerName:
        item.winnerName,

      playerId:
        item.playerId ??
        "",

      teamId:
        item.teamId ??
        "",

      imageUrl:
        item.imageUrl ??
        "",

      imageKey:
        item.imageKey ??
        "",

      videoUrl:
        item.videoUrl ??
        "",

      videoKey:
        item.videoKey ??
        "",

      description:
        item.description ??
        "",

      sortOrder:
        String(
          item.sortOrder,
        ),

      status:
        item.status,
    });

    setActionError(
      null,
    );

    window.setTimeout(() => {
      document
        .getElementById(
          `hall-of-fame-edit-${item.id}`,
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 0);
  }

  /*
   * ==========================================================
   * SALVA
   * ==========================================================
   */

  async function saveItem() {
    /*
     * ========================================================
     * STAGIONE DEL PREMIO
     * ========================================================
     *
     * MODIFICA:
     *
     * manteniamo il seasonId già presente
     * nel premio.
     *
     * CREAZIONE:
     *
     * utilizziamo la stagione attiva.
     * ========================================================
     */

    const targetSeasonId =
      editingItem?.seasonId?.trim() ||
      currentSeasonId?.trim();

    const targetCompetitionId =
  editingItem?.competitionId?.trim() ||
  selectedCompetitionId?.trim();

    if (
      !targetSeasonId
    ) {
      setActionError(
        "Impossibile determinare la stagione del premio.",
      );

      return;
    }

    if (
  !targetCompetitionId
) {
  setActionError(
    "Impossibile determinare la competizione del premio.",
  );

  return;
}

    /*
     * Durante la modifica di un premio storico
     * non consentiamo di cambiare liberamente
     * il seasonLabel mantenendo lo stesso seasonId.
     *
     * Il campo è comunque disabilitato nella UI,
     * ma questa verifica protegge anche il salvataggio.
     */

    const targetSeasonLabel =
      editingItem
        ? editingItem.seasonLabel.trim()
        : currentSeason?.name?.trim();

    const sortOrder =
      Number(
        form.sortOrder,
      );

    if (
      !targetSeasonLabel
    ) {
      setActionError(
        "Inserisci la stagione, ad esempio 2026/27.",
      );

      return;
    }

    if (
      !form.section
    ) {
      setActionError(
        "Seleziona la sezione Hall of Fame.",
      );

      return;
    }

    if (
      !form.category.trim()
    ) {
      setActionError(
        "Seleziona o inserisci una categoria.",
      );

      return;
    }

    if (
      !form.winnerName.trim()
    ) {
      setActionError(
        "Inserisci o seleziona il vincitore.",
      );

      return;
    }

    if (
      !Number.isInteger(
        sortOrder,
      ) ||
      sortOrder <
        1
    ) {
      setActionError(
        "Inserisci un ordine di visualizzazione valido.",
      );

      return;
    }

    setIsSaving(
      true,
    );

    setActionError(
      null,
    );

    const input = {
      seasonId:
        targetSeasonId,

      competitionId:
    targetCompetitionId,

      seasonLabel:
        targetSeasonLabel,

      section:
        form.section,

      category:
        form.category.trim(),

      awardDescription:
        form.awardDescription.trim() ||
        undefined,

      winnerType:
        form.winnerType,

      winnerName:
        form.winnerName.trim(),

      playerId:
        form.winnerType ===
        "player"
          ? form.playerId ||
            undefined
          : undefined,

      teamId:
        form.winnerType ===
        "team"
          ? form.teamId ||
            undefined
          : undefined,

      imageUrl:
        form.imageUrl ||
        undefined,

      imageKey:
        form.imageKey ||
        undefined,

      videoUrl:
        form.section === "goalAndSave"
          ? form.videoUrl || undefined
          : undefined,

      videoKey:
        form.section === "goalAndSave"
          ? form.videoKey || undefined
          : undefined,

      description:
        form.description.trim() ||
        undefined,

      sortOrder,

      status:
        form.status,
    };

    try {
      if (
        editingItemId
      ) {
        await FirebaseHallOfFameRepository.update({
          itemId:
            editingItemId,

          ...input,
        });
      } else {
        await FirebaseHallOfFameRepository.create(
          input,
        );
      }

      resetForm();
    } catch (
      error
    ) {
      console.error(
        "Errore salvataggio Hall of Fame:",
        error,
      );

      setActionError(
        error instanceof
          Error
          ? error.message
          : "Impossibile salvare il premio.",
      );
    } finally {
      setIsSaving(
        false,
      );
    }
  }

  /*
   * ==========================================================
   * ELIMINA
   * ==========================================================
   */

  async function removeItem(
    item:
      HallOfFameItem,
  ) {
    const confirmed =
      window.confirm(
        `Eliminare “${item.category} – ${item.winnerName}”?`,
      );

    if (
      !confirmed
    ) {
      return;
    }

    try {
      await FirebaseHallOfFameRepository.remove(
        item.id,
      );

      if (
        editingItemId ===
        item.id
      ) {
        resetForm();
      }
    } catch (
      error
    ) {
      console.error(
        "Errore eliminazione Hall of Fame:",
        error,
      );

      setActionError(
        error instanceof
          Error
          ? error.message
          : "Impossibile eliminare il premio.",
      );
    }
  }

  /*
   * ==========================================================
   * POSSIBILITÀ DI SALVATAGGIO
   * ==========================================================
   *
   * Nuovo premio:
   * serve una stagione attiva.
   *
   * Premio esistente:
   * basta il seasonId già salvato nel documento.
   * ==========================================================
   */

  const canSave =
  editingItem
    ? Boolean(
        editingItem.seasonId?.trim() &&
        editingItem.competitionId?.trim(),
      )
    : Boolean(
        currentSeasonId &&
        selectedCompetitionId,
      );

  /*
   * ==========================================================
   * RENDER
   * ==========================================================
   */

  return (
    <AppShell>
      <div className="space-y-6">
      {/* HEADER */}

      <header className="mt-6 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#06142E]/40">
            Centro di controllo
          </p>

          <h1 className="mt-1 text-3xl font-black uppercase text-[#06142E]">
            Hall of Fame
          </h1>

          <p className="mt-1 max-w-xl text-sm font-bold leading-6 text-[#06142E]/50">
            Gestisci premi,
            riconoscimenti e
            protagonisti delle
            stagioni precedenti.
          </p>
        </div>

      </header>

      {/* ERRORI CARICAMENTO */}

      {loadingError && (
        <section className="rounded-[16px] border border-red-200 bg-red-50 p-5">
          <p className="font-black text-red-700">
            Impossibile caricare
            i dati
          </p>

          <p className="mt-1 text-sm font-bold text-red-600/70">
            {
              loadingError
            }
          </p>
        </section>
      )}

      {/* ======================================================
          ARCHIVIO PREMI PER STAGIONE
          ====================================================== */}

      <section
        id="hall-of-fame-archive">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
              Archivio
            </p>

            <h2 className="mt-1 text-xl font-black uppercase text-[#06142E]">
              {selectedSeasonGroup
                ? selectedSeasonGroup.seasonLabel
                : "Premi per stagione"}
            </h2>

            <p className="mt-1 text-xs font-bold leading-5 text-[#06142E]/40">
              {selectedSeasonGroup
                ? `${selectedSeasonGroup.items.length} premi assegnati`
                : "Seleziona una stagione per visualizzare e gestire i premi assegnati."}
            </p>
          </div>

          {selectedSeasonGroup && (
            <button
              type="button"
              onClick={() => {
                setSelectedSeasonKey(
                  null,
                );

                resetForm();
              }}
              className="shrink-0 rounded-[12px] bg-[#06142E]/5 px-4 py-3 text-[10px] font-black uppercase text-[#06142E]"
            >
              ← Stagioni
            </button>
          )}
        </div>

        {isLoading ? (
          <p className="py-10 text-center text-sm font-bold text-[#06142E]/45">
            Caricamento...
          </p>
        ) : seasonGroups.length ===
          0 ? (
          <p className="py-10 text-center text-sm font-bold text-[#06142E]/45">
            Nessun premio disponibile.
          </p>
        ) : !selectedSeasonGroup ? (
          /*
           * ====================================================
           * CARDS STAGIONI
           * ====================================================
           */
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {seasonGroups.map(
              (
                group,
              ) => {
                return (
                  <button
                    key={
                      group.key
                    }
                    type="button"
                    onClick={() => {
                      setSelectedSeasonKey(
                        group.key,
                      );

                      window.setTimeout(
                        () => {
                          document
                            .getElementById(
                              "hall-of-fame-archive",
                            )
                            ?.scrollIntoView({
                              behavior:
                                "smooth",

                              block:
                                "start",
                            });
                        },
                        0,
                      );
                    }}
                    className="group rounded-[18px] border border-[#06142E]/10 bg-white p-5 text-left shadow-[0_8px_20px_rgba(6,20,46,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(6,20,46,0.10)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>

                        <h3 className="mt-1 text-xl font-black text-[#06142E]">
                          {
                            group.seasonLabel
                          }
                        </h3>
                      </div>

                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#06142E]/5 text-lg font-black text-[#06142E] transition group-hover:bg-[#06142E] group-hover:text-white">
                        →
                      </span>
                    </div>
                  </button>
                );
              },
            )}
          </div>
        ) : (
          /*
           * ====================================================
           * ELENCO PREMI DELLA STAGIONE
           * ====================================================
           */
          <div className="mt-6 space-y-3">
            {selectedSeasonGroup.items.map(
              (
                item,
              ) => {
                const teamName =
                  getAwardTeamName({
                    item,

                    currentSeasonId,

                    seasonPlayers,

                    participatingTeams,
                  });

                const adminItem =
                  item as
                    HallOfFameAdminItem;

                return (
                  <article
                    key={
                      item.id
                    }
                    className="overflow-hidden rounded-[18px] border border-[#06142E]/10 bg-white"
                  >
                    <div className="flex gap-4 p-4">
                      <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-[12px] bg-[#06142E]/5">
                        {item.imageUrl ? (
                          <Image
                            src={
                              item.imageUrl
                            }
                            alt={
                              item.winnerName
                            }
                            fill
                            unoptimized
                            sizes="80px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-2xl opacity-35">
                            🏅
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[#0B5FFF]/8 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-[#0B5FFF]">
                            {getSectionLabel(
                              item.section ??
                                "otherAwards",
                            )}
                          </span>

                          <span
                            className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${
                              item.status ===
                              "published"
                                ? "bg-green-100 text-green-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {item.status ===
                            "published"
                              ? "Pubblicato"
                              : "Bozza"}
                          </span>
                        </div>

                        <h3 className="mt-2 break-words text-base font-black text-[#06142E]">
                          {
                            item.category
                          }
                        </h3>

                        {adminItem.awardDescription && (
                          <p className="mt-1 text-xs font-bold leading-5 text-[#06142E]/45">
                            {
                              adminItem.awardDescription
                            }
                          </p>
                        )}

                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <AwardInfo
                            label="Vincitore"
                            value={
                              item.winnerName
                            }
                          />

                          <AwardInfo
                            label="Squadra"
                            value={
                              teamName
                            }
                          />
                        </div>

                        <p className="mt-3 text-[10px] font-black uppercase tracking-[0.08em] text-[#06142E]/30">
                          Ordine nella sezione:{" "}
                          {
                            item.sortOrder
                          }
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 border-t border-[#06142E]/8 p-3">
                      <button
                        type="button"
                        disabled={
                          isSaving
                        }
                        onClick={() => {
                          startEditing(
                            item,
                          );
                        }}
                        className="rounded-[11px] bg-[#06142E] px-4 py-3 text-xs font-black uppercase text-white disabled:opacity-50"
                      >
                        {editingItemId === item.id
                          ? "In modifica"
                          : "Modifica"}
                      </button>

                      <button
                        type="button"
                        disabled={
                          isSaving
                        }
                        onClick={() => {
                          void removeItem(
                            item,
                          );
                        }}
                        className="rounded-[11px] bg-red-50 px-4 py-3 text-xs font-black uppercase text-red-700 disabled:opacity-50"
                      >
                        Elimina
                      </button>
                    </div>

                    {editingItemId === item.id && (
                      <div
                        id={`hall-of-fame-edit-${item.id}`}
                        className="border-t border-[#06142E]/10 bg-[#F7F9FC] p-3 sm:p-4"
                      >
                              <section className="rounded-[20px] bg-white p-5 shadow-[0_10px_24px_rgba(6,20,46,0.10)] sm:p-6">
                                <div className="mb-6 flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
                                      Gestione premio
                                    </p>

                                    <h2 className="mt-1 text-xl font-black uppercase text-[#06142E]">
                                      {editingItemId
                                        ? "Modifica premio"
                                        : "Nuovo premio"}
                                    </h2>
                                  </div>

                                  {editingItemId && (
                                    <button
                                      type="button"
                                      disabled={
                                        isSaving
                                      }
                                      onClick={
                                        resetForm
                                      }
                                      className="rounded-[10px] bg-[#06142E]/5 px-3 py-2 text-xs font-black text-[#06142E] disabled:opacity-50"
                                    >
                                      Annulla
                                    </button>
                                  )}
                                </div>

                                <div className="grid gap-5">
                                           {form.winnerType ===
                                    "custom" && (
                                    <Field label="Nome vincitore">
                                      <input
                                        type="text"
                                        value={
                                          form.winnerName
                                        }
                                        disabled={
                                          isSaving
                                        }
                                        onChange={(
                                          event,
                                        ) =>
                                          updateForm(
                                            "winnerName",

                                            event.target.value,
                                          )
                                        }
                                        placeholder="Inserisci il nome"
                                        className="admin-input disabled:opacity-50"
                                      />
                                    </Field>
                                  )}

                                  {/* SEZIONE */}

                                  <Field label="Sezione">
                                    <select
                                      value={form.section}
                                      disabled={isSaving}
                                      onChange={(event) => {
                                        const nextSection =
                                          event.target.value as HallOfFameSection;

                                        setForm((current) => ({
                                          ...current,
                                          section: nextSection,
                                        }));
                                      }}
                                      className="admin-input disabled:opacity-50"
                                    >
                                      {SECTION_OPTIONS.map((option) => (
                                        <option
                                          key={option.value}
                                          value={option.value}
                                        >
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>

                                    <p className="mt-2 text-xs font-bold text-[#06142E]/35">
                                      Puoi spostare il premio in un&apos;altra sezione senza reimportare il file Excel.
                                    </p>
                                  </Field>

                                  {/* ORDINE */}

                                  <Field label="Ordine nella sezione">
                                    <input
                                      type="number"
                                      min={
                                        1
                                      }
                                      value={
                                        form.sortOrder
                                      }
                                      disabled={
                                        isSaving
                                      }
                                      onChange={(
                                        event,
                                      ) =>
                                        updateForm(
                                          "sortOrder",

                                          event.target.value,
                                        )
                                      }
                                      className="admin-input disabled:opacity-50"
                                    />

                                    <p className="mt-2 text-xs font-bold text-[#06142E]/35">
                                      1 = primo premio
                                      mostrato nella sezione.
                                    </p>
                                  </Field>

                                  {/* IMMAGINE */}

                                  <Field label="Immagine 4:5">
                                    <HallOfFameImageUploader
                                      imageUrl={
                                        form.imageUrl
                                      }
                                      disabled={
                                        isSaving
                                      }
                                      onUploaded={(
                                        image,
                                      ) => {
                                        setForm(
                                          (
                                            current,
                                          ) => ({
                                            ...current,

                                            imageUrl:
                                              image.url,

                                            imageKey:
                                              image.key,
                                          }),
                                        );
                                      }}
                                      onRemove={() => {
                                        setForm(
                                          (
                                            current,
                                          ) => ({
                                            ...current,

                                            imageUrl:
                                              "",

                                            imageKey:
                                              "",
                                          }),
                                        );
                                      }}
                                    />
                                  </Field>

                                  {form.section === "goalAndSave" && (
                                    <Field label="Video 4:5">
                                      <HallOfFameVideoUploader
                                        videoUrl={form.videoUrl}
                                        posterUrl={form.imageUrl}
                                        disabled={isSaving}
                                        onUploaded={(video) => {
                                          setForm((current) => ({
                                            ...current,
                                            videoUrl: video.url,
                                            videoKey: video.key,
                                          }));
                                        }}
                                        onRemove={() => {
                                          setForm((current) => ({
                                            ...current,
                                            videoUrl: "",
                                            videoKey: "",
                                          }));
                                        }}
                                      />
                                      <p className="mt-2 text-xs font-bold text-[#06142E]/35">
                                        La foto resta la copertina. Se il video manca, la card rimane fotografica.
                                      </p>
                                    </Field>
                                  )}
                                </div>

                                {/* ERROR */}

                                {actionError && (
                                  <p className="mt-5 rounded-[12px] bg-red-50 p-3 text-sm font-bold text-red-700">
                                    {
                                      actionError
                                    }
                                  </p>
                                )}

                                {/* SAVE */}

                                <button
                                  type="button"
                                  disabled={
                                    isSaving ||
                                    !canSave
                                  }
                                  onClick={() => {
                                    void saveItem();
                                  }}
                                  className="mt-6 w-full rounded-[13px] bg-[#0B5FFF] px-5 py-4 text-sm font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {isSaving
                                    ? "Salvataggio..."
                                    : editingItemId
                                      ? "Salva modifiche"
                                      : "Crea premio"}
                                </button>
                              </section>
                      </div>
                    )}
                  </article>
                );
              },
            )}
          </div>
        )}
          
      </section>
    </div>
    </AppShell>
  );
}

/*
 * ============================================================
 * INFO PREMIO
 * ============================================================
 */

function AwardInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#06142E]/30">
        {
          label
        }
      </p>

      <p className="mt-0.5 break-words text-xs font-black text-[#06142E]/65">
        {
          value
        }
      </p>
    </div>
  );
}

/*
 * ============================================================
 * SQUADRA DI APPARTENENZA
 * ============================================================
 */

function getAwardTeamName({
  item,
  currentSeasonId,
  seasonPlayers,
  participatingTeams,
}: {
  item:
    HallOfFameItem;

  currentSeasonId?:
    string;

  seasonPlayers:
    Array<{
      playerId:
        string;

      teamId:
        string;

      status?:
        string;
    }>;

  participatingTeams:
    Array<{
      id:
        string;

      name:
        string;
    }>;
}): string {
  /*
   * Premio assegnato direttamente a una squadra.
   */
  if (
    item.winnerType ===
    "team"
  ) {
    return (
      item.winnerName ||
      "—"
    );
  }

  /*
   * Se il documento possiede già teamId,
   * lo risolviamo direttamente.
   */
  if (
    item.teamId
  ) {
    const team =
      participatingTeams.find(
        (
          currentTeam,
        ) =>
          String(
            currentTeam.id,
          ) ===
          String(
            item.teamId,
          ),
      );

    if (
      team?.name
    ) {
      return team.name;
    }
  }

  /*
   * Per la stagione corrente ricaviamo la squadra
   * dalla rosa stagionale del giocatore.
   */
  if (
    currentSeasonId &&
    item.seasonId ===
      currentSeasonId &&
    item.playerId
  ) {
    const rosterEntry =
      seasonPlayers.find(
        (
          entry,
        ) =>
          String(
            entry.playerId,
          ) ===
            String(
              item.playerId,
            ) &&
          entry.status !==
            "withdrawn",
      );

    if (
      rosterEntry
    ) {
      const team =
        participatingTeams.find(
          (
            currentTeam,
          ) =>
            String(
              currentTeam.id,
            ) ===
            String(
              rosterEntry.teamId,
            ),
        );

      if (
        team?.name
      ) {
        return team.name;
      }
    }
  }

  /*
   * Compatibilità con i premi storici importati da Excel.
   *
   * L'import storico salva nel campo description:
   * "Nome squadra · eventuali note".
   */
  const legacyDescription =
    item.description?.trim();

  if (
    legacyDescription
  ) {
    const [
      possibleTeamName,
    ] =
      legacyDescription.split(
        " · ",
      );

    if (
      possibleTeamName?.trim()
    ) {
      return possibleTeamName.trim();
    }
  }

  return "—";
}

/*
 * ============================================================
 * FIELD
 * ============================================================
 */

function Field({
  label,
  children,
}: {
  label:
    string;

  children:
    React.ReactNode;
}) {
  return (
    <div>
      <span className="mb-2 block text-xs font-black uppercase tracking-wide text-[#06142E]/45">
        {
          label
        }
      </span>

      {
        children
      }
    </div>
  );
}

/*
 * ============================================================
 * LABEL SEZIONE
 * ============================================================
 */

function getSectionLabel(
  section:
    HallOfFameSection,
): string {
  switch (
    section
  ) {
    case "bestOfSeason":
      return "Best Of The Season";

    case "teamOfSeason":
      return "Team Of The Season";

    case "goalAndSave":
      return "Goal & Save";

    case "otherAwards":
      return "Altri premi";

    default:
      return "Altri premi";
  }
}