"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import Image from "next/image";

import {
  ImagePlus,
  LoaderCircle,
  Save,
  Trash2,
  Trophy,
} from "lucide-react";

import AppShell from "@/components/ui/AppShell";
import { useCompetition } from "@/src/contexts/CompetitionContext";

import ImageEditor from "../images/ImageEditor";

import {
  useFirebaseIdToken,
} from "@/src/hooks/useFirebaseIdToken";

import {
  useUploadThing,
} from "@/src/utils/uploadthing";

import {
  FirebaseHallOfChampionsRepository,
} from "@/src/services/awards/FirebaseHallOfChampionsRepository";

import type {
  HallOfChampionsEntry,
} from "@/src/types/HallOfChampionsEntry";


/*
 * ============================================================
 * FORM
 * ============================================================
 */

type HallOfChampionsForm = {
  winnerPhotoUrl: string;
  winnerPhotoKey: string;

  finalMvpPhotoUrl: string;
  finalMvpPhotoKey: string;
};

type SaveStatus =
  | "idle"
  | "saving"
  | "saved";

const EMPTY_FORM:
  HallOfChampionsForm = {
  winnerPhotoUrl: "",
  winnerPhotoKey: "",

  finalMvpPhotoUrl: "",
  finalMvpPhotoKey: "",
};

/*
 * ============================================================
 * COMPONENTE
 * ============================================================
 */

export default function AdminHallOfChampionsScreen() {
  const { selectedCompetitionId, isLoading: competitionLoading } = useCompetition();
  const [
    entries,
    setEntries,
  ] =
    useState<
      HallOfChampionsEntry[]
    >([]);

  const [
    form,
    setForm,
  ] =
    useState<HallOfChampionsForm>(
      EMPTY_FORM,
    );

  const [
    editingEntryId,
    setEditingEntryId,
  ] =
    useState<
      string | null
    >(null);

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(true);

  const [
    saveStatus,
    setSaveStatus,
  ] =
    useState<SaveStatus>(
      "idle",
    );

  const [
    deletingEntryId,
    setDeletingEntryId,
  ] =
    useState<
      string | null
    >(null);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<
      string | null
    >(null);

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState<
      string | null
    >(null);

  /*
   * ==========================================================
   * FILE TEMPORANEI EDITOR
   * ==========================================================
   */

  const [
    winnerPhotoFile,
    setWinnerPhotoFile,
  ] =
    useState<
      File | null
    >(null);

  const [
    mvpPhotoFile,
    setMvpPhotoFile,
  ] =
    useState<
      File | null
    >(null);

  /*
   * ==========================================================
   * STATO UPLOAD
   * ==========================================================
   */

  const [
    isUploadingWinnerPhoto,
    setIsUploadingWinnerPhoto,
  ] =
    useState(false);

  const [
    isUploadingMvpPhoto,
    setIsUploadingMvpPhoto,
  ] =
    useState(false);

  /*
   * ==========================================================
   * INPUT FILE
   * ==========================================================
   */

  const winnerPhotoInputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const mvpPhotoInputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  /*
   * ==========================================================
   * UPLOADTHING
   * ==========================================================
   */

  const {
  idToken,
  isLoading: isLoadingIdToken,
} = useFirebaseIdToken();
  
  const {
  startUpload:
    startHallOfFameImageUpload,
} =
  useUploadThing(
    "hallOfFameImageUploader",
    {
      headers: () => ({
        ...(idToken
          ? {
              Authorization:
                `Bearer ${idToken}`,
            }
          : {}),
      }),

      onUploadError(
        uploadError,
      ) {
        console.error(
          "Errore UploadThing Albo d'Oro:",
          uploadError,
        );

        setErrorMessage(
          uploadError.message,
        );
      },
    },
  );

  const cupByCompetition: Record<string, string> = {
    "premier-league": "champions league",
    championship: "europa league",
    "league-one": "conference league",
  };
  const selectedCup = selectedCompetitionId
    ? cupByCompetition[selectedCompetitionId]
    : undefined;
  // Il nome del torneo distingue anche gli archivi legacy, il cui
  // competitionId viene normalizzato dal mapper a Premier League.
  const visibleEntries = selectedCup
    ? entries.filter((entry) =>
        entry.competitionName.toLowerCase().replace(/\s+/g, " ").includes(selectedCup),
      )
    : [];

  /*
   * ==========================================================
   * CARICAMENTO EDIZIONI
   * ==========================================================
   */

  useEffect(() => {
    const unsubscribe =
      FirebaseHallOfChampionsRepository.subscribeAll(
        (
          nextEntries,
        ) => {
          setEntries(
            nextEntries,
          );

          setIsLoading(
            false,
          );
        },

        (
          error,
        ) => {
          console.error(
            "Errore caricamento Albo d'Oro:",
            error,
          );

          setErrorMessage(
            error.message,
          );

          setIsLoading(
            false,
          );
        },
      );

    return unsubscribe;
  }, []);

  /*
   * ==========================================================
   * FORM
   * ==========================================================
   */

  function updateForm<
    Field extends
      keyof HallOfChampionsForm,
  >(
    field: Field,

    value:
      HallOfChampionsForm[Field],
  ) {
    setForm(
      (
        currentForm,
      ) => ({
        ...currentForm,

        [field]:
          value,
      }),
    );

    setSaveStatus(
      "idle",
    );
  }

  function resetForm() {
    setForm(
      EMPTY_FORM,
    );

    setEditingEntryId(
      null,
    );

    setWinnerPhotoFile(
      null,
    );

    setMvpPhotoFile(
      null,
    );

    setErrorMessage(
      null,
    );

    setSaveStatus(
      "idle",
    );
  }

  /*
   * ==========================================================
   * MODIFICA EDIZIONE
   * ==========================================================
   */

  function startEditing(
    entry:
      HallOfChampionsEntry,
  ) {
    setEditingEntryId(
      entry.id,
    );

    setForm({
      winnerPhotoUrl:
        entry.winnerPhotoUrl ??
        "",

      winnerPhotoKey:
        entry.winnerPhotoKey ??
        "",

      finalMvpPhotoUrl:
        entry.finalMvpPhotoUrl ??
        "",

      finalMvpPhotoKey:
        entry.finalMvpPhotoKey ??
        "",
    });

    setWinnerPhotoFile(
      null,
    );

    setMvpPhotoFile(
      null,
    );

    setErrorMessage(
      null,
    );

    setSuccessMessage(
      null,
    );

  }

  /*
   * ==========================================================
   * UPLOAD FOTO VINCITORI
   * ==========================================================
   */

  async function uploadWinnerPhoto(
    editedFile: File,
  ) {
    setIsUploadingWinnerPhoto(
      true,
    );

    setErrorMessage(
      null,
    );

    if (
  isLoadingIdToken
) {
  setErrorMessage(
    "Autenticazione in corso. Riprova tra qualche secondo.",
  );

  return;
}

if (
  !idToken
) {
  setErrorMessage(
    "Sessione amministratore non disponibile. Effettua nuovamente l'accesso.",
  );

  return;
}

    try {
      const uploadedFiles =
        await startHallOfFameImageUpload(
          [
            editedFile,
          ],
        );

      const uploadedFile =
        uploadedFiles?.[0];

      if (
        !uploadedFile
      ) {
        throw new Error(
          "Upload della foto vincitori non riuscito.",
        );
      }

      const url =
        uploadedFile.ufsUrl ??
        uploadedFile.url;

      if (
        !url
      ) {
        throw new Error(
          "URL della foto vincitori non disponibile.",
        );
      }

      updateForm(
        "winnerPhotoUrl",
        url,
      );

      updateForm(
        "winnerPhotoKey",
        uploadedFile.key ??
        "",
      );

      setWinnerPhotoFile(
        null,
      );
    } catch (
      currentError
    ) {
      console.error(
        "Errore upload foto vincitori:",
        currentError,
      );

      setErrorMessage(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile caricare la foto vincitori.",
      );
    } finally {
      setIsUploadingWinnerPhoto(
        false,
      );
    }
  }

  /*
   * ==========================================================
   * UPLOAD FOTO MVP
   * ==========================================================
   */

  async function uploadMvpPhoto(
    editedFile: File,
  ) {
    setIsUploadingMvpPhoto(
      true,
    );

    setErrorMessage(
      null,
    );

    if (
  isLoadingIdToken
) {
  setErrorMessage(
    "Autenticazione in corso. Riprova tra qualche secondo.",
  );

  return;
}

if (
  !idToken
) {
  setErrorMessage(
    "Sessione amministratore non disponibile. Effettua nuovamente l'accesso.",
  );

  return;
}

    try {
      const uploadedFiles =
        await startHallOfFameImageUpload(
          [
            editedFile,
          ],
        );

      const uploadedFile =
        uploadedFiles?.[0];

      if (
        !uploadedFile
      ) {
        throw new Error(
          "Upload della foto MVP non riuscito.",
        );
      }

      const url =
        uploadedFile.ufsUrl ??
        uploadedFile.url;

      if (
        !url
      ) {
        throw new Error(
          "URL della foto MVP non disponibile.",
        );
      }

      updateForm(
        "finalMvpPhotoUrl",
        url,
      );

      updateForm(
        "finalMvpPhotoKey",
        uploadedFile.key ??
        "",
      );

      setMvpPhotoFile(
        null,
      );
    } catch (
      currentError
    ) {
      console.error(
        "Errore upload foto MVP:",
        currentError,
      );

      setErrorMessage(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile caricare la foto MVP.",
      );
    } finally {
      setIsUploadingMvpPhoto(
        false,
      );
    }
  }

  /*
   * ==========================================================
   * SALVATAGGIO
   *
   * IMPORTANTE:
   *
   * vengono modificati ESCLUSIVAMENTE
   * i campi multimediali.
   *
   * Tutti i dati sportivi vengono preservati.
   * ==========================================================
   */

  async function handleSubmit(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      saveStatus ===
      "saving"
    ) {
      return;
    }

    if (
      !editingEntryId ||
      !visibleEntries.some((entry) => entry.id === editingEntryId)
    ) {
      setErrorMessage(
        "Seleziona un'edizione dall'archivio.",
      );

      return;
    }

    setErrorMessage(
      null,
    );

    setSuccessMessage(
      null,
    );

    setSaveStatus(
      "saving",
    );

    try {
      const existingEntry =
        await FirebaseHallOfChampionsRepository.getById(
          editingEntryId,
        );

      if (
        !existingEntry
      ) {
        throw new Error(
          "La voce dell'Albo d'Oro non esiste.",
        );
      }

      await FirebaseHallOfChampionsRepository.update({
        entryId:
          existingEntry.id,

        /*
         * DATI STAGIONE
         */

        seasonId:
          existingEntry.seasonId,

        seasonName:
          existingEntry.seasonName,

        competitionId:
          existingEntry.competitionId,

        competitionName:
          existingEntry.competitionName,

        /*
         * SQUADRE
         */

        championTeamId:
          existingEntry.championTeamId,

        championTeamName:
          existingEntry.championTeamName,

        runnerUpTeamId:
          existingEntry.runnerUpTeamId,

        runnerUpTeamName:
          existingEntry.runnerUpTeamName,

        /*
         * RISULTATO
         */

        championScore:
          existingEntry.championScore,

        runnerUpScore:
          existingEntry.runnerUpScore,

        championPenalties:
          existingEntry.championPenalties,

        runnerUpPenalties:
          existingEntry.runnerUpPenalties,

        /*
         * DATI EXCEL
         */

        finalGoals:
          existingEntry.finalGoals,

        finalReport:
          existingEntry.finalReport,

        roster:
          existingEntry.roster,

        /*
         * UNICI CAMPI MODIFICABILI
         */

        winnerPhotoUrl:
          form.winnerPhotoUrl.trim() ||
          undefined,

        winnerPhotoKey:
          form.winnerPhotoKey.trim() ||
          undefined,

        finalMvpPhotoUrl:
          form.finalMvpPhotoUrl.trim() ||
          undefined,

        finalMvpPhotoKey:
          form.finalMvpPhotoKey.trim() ||
          undefined,
      });

      setSuccessMessage(
        "Foto dell'Albo d'Oro aggiornate.",
      );

      setSaveStatus(
        "saved",
      );

      resetForm();
    } catch (
      error
    ) {
      console.error(
        "Errore salvataggio Albo d'Oro:",
        error,
      );

      setErrorMessage(
        error instanceof
          Error
          ? error.message
          : "Impossibile salvare l'Albo d'Oro.",
      );

      setSaveStatus(
        "idle",
      );
    }
  }

  /*
   * ==========================================================
   * ELIMINAZIONE EDIZIONE
   * ==========================================================
   */

  async function handleDelete(
    entry:
      HallOfChampionsEntry,
  ) {
    if (
      deletingEntryId
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        [
          `Eliminare ${entry.competitionName} - ${entry.seasonName}?`,

          "",

          "L'operazione non può essere annullata.",
        ].join(
          "\n",
        ),
      );

    if (
      !confirmed
    ) {
      return;
    }

    setDeletingEntryId(
      entry.id,
    );

    setErrorMessage(
      null,
    );

    try {
      await FirebaseHallOfChampionsRepository.remove(
        entry.id,
      );

      if (
        editingEntryId ===
        entry.id
      ) {
        resetForm();
      }

      setSuccessMessage(
        "Voce eliminata.",
      );
    } catch (
      error
    ) {
      console.error(
        "Errore eliminazione Albo d'Oro:",
        error,
      );

      setErrorMessage(
        error instanceof
          Error
          ? error.message
          : "Impossibile eliminare la voce.",
      );
    } finally {
      setDeletingEntryId(
        null,
      );
    }
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

        <header className="mt-6 mb-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#06142E]/40">
            Centro di controllo
          </p>

          <h1 className="mt-1 text-3xl font-black uppercase text-[#06142E]">
            Albo d&apos;oro
          </h1>

          <p className="mt-1 max-w-2xl text-sm font-bold leading-6 text-[#06142E]/50">
            Gestisci esclusivamente le foto delle edizioni storiche
          </p>
        </header>

        {/* MESSAGGI */}

        {errorMessage && (
          <MessageBox
            type="error"
            message={errorMessage}
          />
        )}

        {successMessage && (
          <MessageBox
            type="success"
            message={successMessage}
          />
        )}

        {/* FORM / ARCHIVIO */}

        <form
          onSubmit={handleSubmit}
          className="mb-7"
        >
          <section>
            <div className="mb-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#06142E]/40">
                Archivio
              </p>

              <h2 className="mt-1 text-2xl font-black uppercase text-[#06142E]">
                Edizioni inserite
              </h2>
            </div>

            {isLoading || competitionLoading ? (
              <div className="ludi-card p-6 text-center">
                <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[#06142E]/40" />

                <p className="mt-3 text-sm font-bold text-[#06142E]/45">
                  Caricamento Albo d&apos;Oro...
                </p>
              </div>
            ) : visibleEntries.length === 0 ? (
              <div className="ludi-card p-8 text-center">
                <Trophy className="mx-auto h-10 w-10 text-[#06142E]/20" />

                <p className="mt-3 font-black text-[#06142E]">
                  Nessuna edizione inserita per questa competizione.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {visibleEntries.map((entry) => {
                  const isEditing =
                    editingEntryId === entry.id;

                  return (
                    <article
                      key={entry.id}
                      className="ludi-card overflow-hidden"
                    >
                      <div className="p-5">
                        {/* STAGIONE */}

                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/40">
                          {entry.seasonName}
                        </p>

                        <h3 className="mt-1 text-xl font-black uppercase text-[#06142E]">
                          {entry.competitionName}
                        </h3>

                        {/* FINALE */}

                        <p className="mt-3 text-sm font-black text-[#06142E]">
                          {entry.championTeamName}{" "}
                          {entry.championScore}
                          {" - "}
                          {entry.runnerUpScore}{" "}
                          {entry.runnerUpTeamName}
                        </p>

                        <div className="mt-3 grid grid-cols-2 gap-3">
                          {/* MODIFICA */}

                          <button
                            type="button"
                            disabled={
                              deletingEntryId !== null ||
                              saveStatus === "saving" ||
                              isUploadingWinnerPhoto ||
                              isUploadingMvpPhoto
                            }
                            onClick={() =>
                              startEditing(entry)
                            }
                            className={`rounded-[13px] px-4 py-3 text-xs font-black uppercase text-white disabled:opacity-40 ${
                              isEditing
                                ? "bg-[#0B5FFF]"
                                : "bg-[#06142E]"
                            }`}
                          >
                            {isEditing
                              ? "Foto in modifica"
                              : "Gestisci foto"}
                          </button>

                          {/* ELIMINA */}

                          <button
                            type="button"
                            disabled={
                              deletingEntryId !== null ||
                              saveStatus === "saving" ||
                              isUploadingWinnerPhoto ||
                              isUploadingMvpPhoto
                            }
                            onClick={() => {
                              void handleDelete(entry);
                            }}
                            className="rounded-[13px] bg-red-50 px-4 py-3 text-xs font-black uppercase text-red-600 disabled:opacity-40"
                          >
                            {deletingEntryId === entry.id
                              ? "Eliminazione..."
                              : "Elimina"}
                          </button>
                        </div>

                        {/* ==================================================
                            GESTIONE FOTO DELLA STAGIONE SELEZIONATA
                            ================================================== */}

                        {isEditing && (
                          <div className="mt-5 space-y-5 border-t border-[#06142E]/10 pt-5">
                            {/* FOTO VINCITORI */}

                            <AdminCard title="Foto vincitori">
                              {form.winnerPhotoUrl ? (
                                <div className="mb-4 overflow-hidden rounded-[16px] bg-[#06142E]/5">
                                  <div className="relative aspect-[3/2]">
                                    <Image
                                      src={form.winnerPhotoUrl}
                                      alt="Foto squadra vincitrice"
                                      fill
                                      unoptimized
                                      sizes="(max-width: 768px) 100vw, 720px"
                                      className="object-cover"
                                    />
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      updateForm(
                                        "winnerPhotoUrl",
                                        "",
                                      );

                                      updateForm(
                                        "winnerPhotoKey",
                                        "",
                                      );
                                    }}
                                    className="flex w-full items-center justify-center gap-2 px-4 py-3 text-xs font-black uppercase text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Rimuovi foto
                                  </button>
                                </div>
                              ) : (
                                <div className="mb-4 flex aspect-[3/2] items-center justify-center rounded-[16px] bg-[#06142E]/5">
                                  <div className="text-center">
                                    <ImagePlus className="mx-auto h-8 w-8 text-[#06142E]/25" />

                                    <p className="mt-2 text-xs font-black uppercase text-[#06142E]/35">
                                      Foto squadra campione
                                    </p>
                                  </div>
                                </div>
                              )}

                              <input
                                ref={winnerPhotoInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(event) => {
                                  const file =
                                    event.target.files?.[0];

                                  event.target.value = "";

                                  if (!file) {
                                    return;
                                  }

                                  setWinnerPhotoFile(file);
                                }}
                              />

                              <button
                                type="button"
                                disabled={
                                  isUploadingWinnerPhoto ||
                                  isLoadingIdToken ||
                                  !idToken
                                }
                                onClick={() => {
                                  winnerPhotoInputRef.current?.click();
                                }}
                                className="flex h-12 w-full items-center justify-center gap-2 rounded-[13px] bg-[#06142E] px-4 text-xs font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {isUploadingWinnerPhoto ? (
                                  <LoaderCircle className="h-4 w-4 animate-spin" />
                                ) : (
                                  <ImagePlus className="h-4 w-4" />
                                )}

                                {isUploadingWinnerPhoto
                                  ? "Caricamento..."
                                  : form.winnerPhotoUrl
                                    ? "Cambia foto"
                                    : "Carica foto"}
                              </button>

                              <p className="mt-3 text-center text-xs font-bold text-[#06142E]/40">
                                Formato fisso 3:2.
                              </p>
                            </AdminCard>

                            {/* FOTO MVP */}

                            <AdminCard title="Foto MVP finale">
                              {form.finalMvpPhotoUrl ? (
                                <div className="mb-4 overflow-hidden rounded-[16px] bg-[#06142E]/5">
                                  <div className="relative aspect-[4/5]">
                                    <Image
                                      src={form.finalMvpPhotoUrl}
                                      alt="Foto MVP della finale"
                                      fill
                                      unoptimized
                                      sizes="(max-width: 768px) 100vw, 620px"
                                      className="object-cover"
                                    />
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      updateForm(
                                        "finalMvpPhotoUrl",
                                        "",
                                      );

                                      updateForm(
                                        "finalMvpPhotoKey",
                                        "",
                                      );
                                    }}
                                    className="flex w-full items-center justify-center gap-2 px-4 py-3 text-xs font-black uppercase text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Rimuovi foto
                                  </button>
                                </div>
                              ) : (
                                <div className="mb-4 flex aspect-[4/5] items-center justify-center rounded-[16px] bg-[#06142E]/5">
                                  <div className="text-center">
                                    <ImagePlus className="mx-auto h-8 w-8 text-[#06142E]/25" />

                                    <p className="mt-2 text-xs font-black uppercase text-[#06142E]/35">
                                      Foto MVP della finale
                                    </p>
                                  </div>
                                </div>
                              )}

                              <input
                                ref={mvpPhotoInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(event) => {
                                  const file =
                                    event.target.files?.[0];

                                  event.target.value = "";

                                  if (!file) {
                                    return;
                                  }

                                  setMvpPhotoFile(file);
                                }}
                              />

                              <button
                                type="button"
                                disabled={
                                  isUploadingMvpPhoto ||
                                  isLoadingIdToken ||
                                  !idToken
                                }
                                onClick={() => {
                                  mvpPhotoInputRef.current?.click();
                                }}
                                className="flex h-12 w-full items-center justify-center gap-2 rounded-[13px] bg-[#06142E] px-4 text-xs font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {isUploadingMvpPhoto ? (
                                  <LoaderCircle className="h-4 w-4 animate-spin" />
                                ) : (
                                  <ImagePlus className="h-4 w-4" />
                                )}

                                {isUploadingMvpPhoto
                                  ? "Caricamento..."
                                  : form.finalMvpPhotoUrl
                                    ? "Cambia foto MVP"
                                    : "Carica foto MVP"}
                              </button>

                              <p className="mt-3 text-center text-xs font-bold text-[#06142E]/40">
                                Formato fisso verticale 4:5.
                              </p>
                            </AdminCard>

                            {/* SALVA */}

                            <button
                              type="submit"
                              disabled={
                                saveStatus === "saving" ||
                                isUploadingWinnerPhoto ||
                                isUploadingMvpPhoto
                              }
                              className="ludi-button-primary flex h-14 w-full items-center justify-center gap-2 disabled:opacity-40"
                            >
                              {saveStatus === "saving" ? (
                                <LoaderCircle className="h-5 w-5 animate-spin" />
                              ) : (
                                <Save className="h-5 w-5" />
                              )}

                              {saveStatus === "saving"
                                ? "Salvataggio..."
                                : "Salva foto"}
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </form>
      </div>

      {/* ======================================================
          EDITOR FOTO VINCITORI
          ====================================================== */}

      {winnerPhotoFile && (
        <ImageEditor
          file={
            winnerPhotoFile
          }
          title="Foto vincitori"
          label="Albo d'Oro"
          defaultAspectRatio="3:2"
          allowedAspectRatios={[
            "3:2",
          ]}
          outputWidth={
            1500
          }
          onCancel={() => {
            setWinnerPhotoFile(
              null,
            );
          }}
          onConfirm={async (
            editedFile,
          ) => {
            await uploadWinnerPhoto(
              editedFile,
            );
          }}
        />
      )}

      {/* ======================================================
          EDITOR FOTO MVP
          ====================================================== */}

      {mvpPhotoFile && (
        <ImageEditor
          file={
            mvpPhotoFile
          }
          title="Foto MVP finale"
          label="Albo d'Oro"
          defaultAspectRatio="4:5"
          allowedAspectRatios={[
            "4:5",
          ]}
          outputWidth={
            1200
          }
          onCancel={() => {
            setMvpPhotoFile(
              null,
            );
          }}
          onConfirm={async (
            editedFile,
          ) => {
            await uploadMvpPhoto(
              editedFile,
            );
          }}
        />
      )}
    </AppShell>
  );
}

/*
 * ============================================================
 * CARD
 * ============================================================
 */

function AdminCard({
  title,
  children,
}: {
  title:
    string;

  children:
    React.ReactNode;
}) {
  return (
    <section className="rounded-[18px] bg-white p-5 shadow-[0_10px_26px_rgba(6,20,46,0.08)]">
      <h2 className="mb-5 text-xl font-black uppercase text-[#06142E]">
        {title}
      </h2>

      {children}
    </section>
  );
}

/*
 * ============================================================
 * MESSAGGI
 * ============================================================
 */

function MessageBox({
  type,
  message,
}: {
  type:
    | "error"
    | "success";

  message:
    string;
}) {
  return (
    <div
      className={`mb-5 rounded-[14px] border p-4 ${
        type ===
        "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-green-200 bg-green-50 text-green-700"
      }`}
    >
      <p className="text-sm font-bold">
        {message}
      </p>
    </div>
  );
}