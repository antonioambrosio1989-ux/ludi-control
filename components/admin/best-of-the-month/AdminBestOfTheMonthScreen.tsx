"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import Image from "next/image";

import {
  ImagePlus,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

import AppShell from "@/components/ui/AppShell";

import {
  useCompetition,
} from "@/src/contexts/CompetitionContext";

import {
  useFirebaseIdToken,
} from "@/src/hooks/useFirebaseIdToken";

import {
  useUploadThing,
} from "@/src/utils/uploadthing";

import {
  FirebaseBestOfTheMonthRepository,
} from "@/src/services/awards/FirebaseBestOfTheMonthRepository";

import type {
  BestOfTheMonthItem,
  BestOfTheMonthStatus,
} from "@/src/types/BestOfTheMonthItem";

/*
 * ============================================================
 * FORM
 * ============================================================
 */

type BestOfTheMonthForm = {
  month:
    string;

  title:
    string;

  imageUrl:
    string;

  imageKey:
    string;

  order:
    string;

  status:
    BestOfTheMonthStatus;
};

function getCurrentMonthValue() {
  const now =
    new Date();

  return [
    now.getFullYear(),

    String(
      now.getMonth() +
        1,
    ).padStart(
      2,
      "0",
    ),
  ].join(
    "-",
  );
}

function createEmptyForm():
  BestOfTheMonthForm {
  return {
    month:
      getCurrentMonthValue(),

    title:
      "",

    imageUrl:
      "",

    imageKey:
      "",

    order:
      "1",

    status:
      "draft",
  };
}

/*
 * ============================================================
 * SCREEN
 * ============================================================
 */

export default function AdminBestOfTheMonthScreen() {
  const {
    currentSeason,

    selectedCompetition,

    isLoading:
      competitionLoading,
  } =
    useCompetition();

  const hasCompetition = Boolean(selectedCompetition);

  const [
    items,
    setItems,
  ] =
    useState<
      BestOfTheMonthItem[]
    >([]);

  const [
  loadedSeasonId,
  setLoadedSeasonId,
] =
  useState<
    string | null
  >(null);

  const [
    form,
    setForm,
  ] =
    useState<
      BestOfTheMonthForm
    >(
      createEmptyForm,
    );

  const [
    editingItemId,
    setEditingItemId,
  ] =
    useState<
      string | null
    >(null);

  const [
    isUploading,
    setIsUploading,
  ] =
    useState(false);

  const [
    isSaving,
    setIsSaving,
  ] =
    useState(false);

  const [
    deletingItemId,
    setDeletingItemId,
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

  const fileInputRef =
    useRef<
      HTMLInputElement | null
    >(null);

  /*
   * ==========================================================
   * AUTH UPLOADTHING
   * ==========================================================
   */

  const {
    idToken,

    isLoading:
      isLoadingIdToken,
  } =
    useFirebaseIdToken();

  const {
    startUpload,
  } =
    useUploadThing(
      "bestOfTheMonthImageUploader",

      {
        headers:
          () => ({
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
            "Errore UploadThing Best Of The Month:",
            uploadError,
          );

          setErrorMessage(
            uploadError.message,
          );
        },
      },
    );

  /*
 * ==========================================================
 * SUBSCRIPTION
 * ==========================================================
 */

useEffect(
  () => {
    if (
      !hasCompetition ||
      !currentSeason?.id
    ) {
      return;
    }

    const seasonId =
      currentSeason.id;

    const unsubscribe =
      FirebaseBestOfTheMonthRepository.subscribeAdminBySeason({
        seasonId,

        onChange(
          nextItems,
        ) {
          setItems(
            nextItems,
          );

          setLoadedSeasonId(
            seasonId,
          );
        },

        onError(
          currentError,
        ) {
          setErrorMessage(
            currentError.message,
          );

          setLoadedSeasonId(
            seasonId,
          );
        },
      });

    return unsubscribe;
  },

  [
    currentSeason?.id,
    hasCompetition,
  ],
);

const visibleItems =
  currentSeason?.id &&
  loadedSeasonId ===
    currentSeason.id
    ? items
    : [];

const isLoadingItems =
  Boolean(
    hasCompetition &&
    currentSeason?.id,
  ) &&
  loadedSeasonId !==
    currentSeason?.id;

  /*
   * ==========================================================
   * FORM HELPERS
   * ==========================================================
   */

  function updateForm<
    Field extends
      keyof BestOfTheMonthForm,
  >(
    field:
      Field,

    value:
      BestOfTheMonthForm[Field],
  ) {
    setForm(
      (
        current,
      ) => ({
        ...current,

        [field]:
          value,
      }),
    );

    setSuccessMessage(
      null,
    );
  }

  function resetForm() {
    setForm(
      createEmptyForm(),
    );

    setEditingItemId(
      null,
    );

    setErrorMessage(
      null,
    );
  }

  function startEditing(
    item:
      BestOfTheMonthItem,
  ) {
    setEditingItemId(
      item.id,
    );

    setForm({
      month:
        item.month,

      title:
        item.title ??
        "",

      imageUrl:
        item.imageUrl,

      imageKey:
        item.imageKey ??
        "",

      order:
        String(
          item.order,
        ),

      status:
        item.status,
    });

    setErrorMessage(
      null,
    );

    setSuccessMessage(
      null,
    );

    window.scrollTo({
      top:
        0,

      behavior:
        "smooth",
    });
  }

  /*
   * ==========================================================
   * UPLOAD IMMAGINE
   * ==========================================================
   */

  async function uploadImage(
  file:
    File,
) {
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

  setIsUploading(
    true,
  );

  setErrorMessage(
    null,
  );

  try {
    const uploadedFiles =
      await startUpload(
        [
          file,
        ],
      );

    const uploadedFile =
      uploadedFiles?.[0];

    if (
      !uploadedFile
    ) {
      throw new Error(
        "Upload immagine non riuscito.",
      );
    }

    const url =
      uploadedFile.ufsUrl ??
      uploadedFile.url;

    if (
      !url
    ) {
      throw new Error(
        "URL immagine non disponibile.",
      );
    }

    setForm(
      (
        current,
      ) => ({
        ...current,

        imageUrl:
          url,

        imageKey:
          uploadedFile.key ??
          "",
      }),
    );
  } catch (
    currentError
  ) {
    console.error(
      "Errore upload Best Of The Month:",
      currentError,
    );

    setErrorMessage(
      currentError instanceof
        Error
        ? currentError.message
        : "Impossibile caricare l'immagine.",
    );
  } finally {
    setIsUploading(
      false,
    );
  }
}

  /*
   * ==========================================================
   * SAVE
   * ==========================================================
   */

  async function handleSubmit(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !currentSeason?.id ||
      !selectedCompetition?.id ||
      isSaving
    ) {
      return;
    }

    const normalizedOrder =
      Number(
        form.order,
      );

    if (
      !form.month
    ) {
      setErrorMessage(
        "Seleziona il mese.",
      );

      return;
    }

    if (
      !form.imageUrl.trim()
    ) {
      setErrorMessage(
        "Carica l'immagine 4:5.",
      );

      return;
    }

    if (
      !Number.isInteger(
        normalizedOrder,
      ) ||
      normalizedOrder <
        1
    ) {
      setErrorMessage(
        "Inserisci un ordine valido.",
      );

      return;
    }

    setIsSaving(
      true,
    );

    setErrorMessage(
      null,
    );

    setSuccessMessage(
      null,
    );

    try {
      if (
        editingItemId
      ) {
        await FirebaseBestOfTheMonthRepository.update({
          itemId:
            editingItemId,

          month:
            form.month,

          title:
            form.title,

          imageUrl:
            form.imageUrl,

          imageKey:
            form.imageKey,

          order:
            normalizedOrder,

          status:
            form.status,
        });

        setSuccessMessage(
          "Best Of The Month aggiornato correttamente.",
        );
      } else {
        await FirebaseBestOfTheMonthRepository.create({
          seasonId:
            currentSeason.id,

          competitionId:
            selectedCompetition.id,

          month:
            form.month,

          title:
            form.title,

          imageUrl:
            form.imageUrl,

          imageKey:
            form.imageKey,

          order:
            normalizedOrder,

          status:
            form.status,
        });

        setSuccessMessage(
          "Best Of The Month creato correttamente.",
        );
      }

      setForm(
        createEmptyForm(),
      );

      setEditingItemId(
        null,
      );
      
    } catch (
      currentError
    ) {
      console.error(
        "Errore salvataggio Best Of The Month:",
        currentError,
      );

      setErrorMessage(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile salvare il contenuto.",
      );
    } finally {
      setIsSaving(
        false,
      );
    }
  }

  /*
   * ==========================================================
   * DELETE
   * ==========================================================
   */

  async function handleDelete(
    item:
      BestOfTheMonthItem,
  ) {
    if (
      deletingItemId
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Eliminare questo contenuto Best Of The Month?",
      );

    if (
      !confirmed
    ) {
      return;
    }

    setDeletingItemId(
      item.id,
    );

    setErrorMessage(
      null,
    );

    setSuccessMessage(
      null,
    );

    try {
      await FirebaseBestOfTheMonthRepository.remove(
        item.id,
      );

      if (
        editingItemId ===
        item.id
      ) {
        resetForm();
      }

      setSuccessMessage(
        "Contenuto eliminato.",
      );
    } catch (
      currentError
    ) {
      setErrorMessage(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile eliminare il contenuto.",
      );
    } finally {
      setDeletingItemId(
        null,
      );
    }
  }

  /*
   * ==========================================================
   * LOADING COMPETIZIONE
   * ==========================================================
   */

  if (
    competitionLoading
  ) {
    return (
      <AppShell>
        <div className="rounded-[13px] bg-white p-6 text-center shadow-[0_10px_24px_rgba(6,20,46,0.10)]">
          <p className="text-sm font-bold text-[#06142E]/45">
            Caricamento...
          </p>
        </div>
      </AppShell>
    );
  }

  /*
   * ==========================================================
   * COMPETIZIONE SELEZIONATA
   * ==========================================================
   */

  if (
    !hasCompetition
  ) {
    return (
      <AppShell>
        <header className="mb-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#06142E]/40">
            Admin
          </p>

          <h1 className="mt-1 text-3xl font-black uppercase text-[#06142E]">
            Best Of The Month
          </h1>
        </header>

        <div className="rounded-[13px] bg-white p-6 shadow-[0_10px_24px_rgba(6,20,46,0.10)]">
          <p className="font-black text-[#06142E]">
            Seleziona una competizione.
          </p>

          <p className="mt-2 text-sm font-bold text-[#06142E]/45">
            Seleziona una competizione per gestire Best Of The Month.
          </p>
        </div>
      </AppShell>
    );
  }

  /*
   * ==========================================================
   * RENDER
   * ==========================================================
   */

  return (
    <AppShell>
      <header className="mt-6 mb-6">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#06142E]/40">
          Centro di controllo
        </p>

        <h1 className="mt-1 text-3xl font-black uppercase text-[#06142E]">
          Best Of The Month
        </h1>

        <p className="mt-2 text-sm font-bold text-[#06142E]/45">
          Carica le grafiche mensili in formato 4:5 e scegli quali pubblicare in Home.
        </p>
      </header>

      {/* ======================================================
          FORM
          ====================================================== */}

      <form
        onSubmit={
          handleSubmit
        }
        className="mb-7 w-full min-w-0 max-w-full overflow-hidden"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
              Gestione contenuto
            </p>

            <h2 className="mt-1 text-xl font-black uppercase text-[#06142E]">
              {editingItemId
                ? "Modifica"
                : "Nuovo contenuto"}
            </h2>
          </div>

          {editingItemId && (
            <button
              type="button"
              onClick={
                resetForm
              }
              className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#06142E]/5 text-[#06142E]"
              aria-label="Annulla modifica"
            >
              <X
                size={
                  18
                }
              />
            </button>
          )}
        </div>

        <div className="grid min-w-0 max-w-full gap-4">
          <label className="block min-w-0 max-w-full">
            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#06142E]/45">
              Mese
            </span>

            <input
              type="month"
              value={
                form.month
              }
              onChange={
                (
                  event,
                ) => {
                  updateForm(
                    "month",
                    event.target.value,
                  );
                }
              }
              className="mt-2 h-12 w-full min-w-0 max-w-full rounded-[13px] border border-[#06142E]/10 bg-white px-4 text-sm font-black text-[#06142E] outline-none focus:border-[#06142E]/30"
              style={{
                boxSizing:
                  "border-box",
              }}
            />
          </label>

          <label className="block min-w-0 max-w-full">
            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#06142E]/45">
              Titolo opzionale
            </span>

            <input
              type="text"
              value={
                form.title
              }
              onChange={
                (
                  event,
                ) => {
                  updateForm(
                    "title",
                    event.target.value,
                  );
                }
              }
              placeholder="Es. Player Of The Month"
              className="mt-2 h-12 w-full min-w-0 max-w-full rounded-[13px] border border-[#06142E]/10 bg-white px-4 text-sm font-black text-[#06142E] outline-none placeholder:text-[#06142E]/25 focus:border-[#06142E]/30"
            />
          </label>

          <div className="grid min-w-0 grid-cols-2 gap-3">
            <label className="block min-w-0">
              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#06142E]/45">
                Ordine
              </span>

              <input
                type="number"
                min={
                  1
                }
                step={
                  1
                }
                value={
                  form.order
                }
                onChange={
                  (
                    event,
                  ) => {
                    updateForm(
                      "order",
                      event.target.value,
                    );
                  }
                }
                className="mt-2 h-12 w-full min-w-0 max-w-full rounded-[13px] border border-[#06142E]/10 bg-white px-4 text-sm font-black text-[#06142E] outline-none focus:border-[#06142E]/30"
              />
            </label>

            <label className="block min-w-0">
              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#06142E]/45">
                Stato
              </span>

              <select
                value={
                  form.status
                }
                onChange={
                  (
                    event,
                  ) => {
                    updateForm(
                      "status",
                      event.target.value as
                        BestOfTheMonthStatus,
                    );
                  }
                }
                className="mt-2 h-12 w-full min-w-0 max-w-full rounded-[13px] border border-[#06142E]/10 bg-white px-4 text-sm font-black text-[#06142E] outline-none focus:border-[#06142E]/30"
              >
                <option value="draft">
                  Bozza
                </option>

                <option value="published">
                  Pubblicato
                </option>
              </select>
            </label>
          </div>
        </div>

        {/* ====================================================
            IMAGE
            ==================================================== */}

        <div className="mt-5">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#06142E]/45">
            Immagine 4:5
          </p>

          <input
            ref={
              fileInputRef
            }
            type="file"
            accept="image/*"
            className="hidden"
            onChange={
  (
    event,
  ) => {
    const file =
      event.target.files?.[0];

    if (
      file
    ) {
      void uploadImage(
        file,
      );
    }

    event.currentTarget.value =
      "";
  }
}
          />

          {form.imageUrl ? (
            <div className="mt-3 grid grid-cols-[130px_1fr] gap-4">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[14px] bg-[#06142E]/5">
                <Image
                  src={
                    form.imageUrl
                  }
                  alt="Anteprima Best Of The Month"
                  fill
                  unoptimized
                  sizes="130px"
                  className="object-cover"
                />
              </div>

              <div className="flex flex-col justify-center gap-3">
                <button
                  type="button"
                  disabled={
                    isUploading
                  }
                  onClick={
                    () => {
                      fileInputRef.current?.click();
                    }
                  }
                  className="min-h-11 rounded-[12px] bg-[#06142E]/5 px-4 text-xs font-black uppercase text-[#06142E] disabled:opacity-40"
                >
                  Cambia immagine
                </button>

                <button
                  type="button"
                  onClick={
                    () => {
                      updateForm(
                        "imageUrl",
                        "",
                      );

                      updateForm(
                        "imageKey",
                        "",
                      );
                    }
                  }
                  className="min-h-11 rounded-[12px] bg-red-50 px-4 text-xs font-black uppercase text-red-700"
                >
                  Rimuovi
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={
                isUploading
              }
              onClick={
                () => {
                  fileInputRef.current?.click();
                }
              }
              className="mt-3 flex aspect-[4/5] w-[170px] flex-col items-center justify-center rounded-[16px] border-2 border-dashed border-[#06142E]/15 bg-[#06142E]/[0.025] text-[#06142E]/45 transition active:scale-[0.99] disabled:opacity-40"
            >
              <ImagePlus
                size={
                  30
                }
              />

              <span className="mt-3 text-[10px] font-black uppercase">
                Carica immagine
              </span>
            </button>
          )}

          {isUploading && (
            <p className="mt-3 text-xs font-bold text-[#06142E]/45">
              Caricamento immagine...
            </p>
          )}
        </div>

        {errorMessage && (
          <div className="mt-5 rounded-[13px] bg-red-50 p-4">
            <p className="text-xs font-bold text-red-700">
              {errorMessage}
            </p>
          </div>
        )}

        {successMessage && (
          <div className="mt-5 rounded-[13px] bg-emerald-50 p-4">
            <p className="text-xs font-bold text-emerald-800">
              {successMessage}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={
            isSaving ||
            isUploading ||
            !currentSeason?.id
          }
          className="mt-5 min-h-12 w-full rounded-[13px] bg-[#06142E] px-5 text-sm font-black uppercase text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSaving
            ? "Salvataggio..."
            : editingItemId
              ? "Salva modifiche"
              : "Crea contenuto"}
        </button>
      </form>

      {/* ======================================================
          ARCHIVIO
          ====================================================== */}

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
              Archivio stagione
            </p>

            <h2 className="mt-1 text-2xl font-black uppercase text-[#06142E]">
              Contenuti caricati
            </h2>
          </div>

          <span className="rounded-full bg-[#06142E]/5 px-3 py-2 text-xs font-black text-[#06142E]">
            {visibleItems.length}
          </span>
        </div>

        {isLoadingItems ? (
          <div className="rounded-[13px] bg-white p-6 text-center shadow-[0_10px_24px_rgba(6,20,46,0.08)]">
            <p className="text-sm font-bold text-[#06142E]/45">
              Caricamento...
            </p>
          </div>
        ) : visibleItems.length ===
          0 ? (
          <div className="rounded-[13px] bg-white p-6 text-center shadow-[0_10px_24px_rgba(6,20,46,0.08)]">
            <p className="font-black text-[#06142E]">
              Nessun contenuto presente.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleItems.map(
              (
                item,
              ) => (
                <article
                  key={
                    item.id
                  }
                  className="grid grid-cols-[105px_1fr] gap-4 rounded-[13px] bg-white p-4 shadow-[0_10px_24px_rgba(6,20,46,0.08)]"
                >
                  <div className="relative aspect-[4/5] overflow-hidden rounded-[12px] bg-[#06142E]/5">
                    <Image
                      src={
                        item.imageUrl
                      }
                      alt={
                        item.title?.trim() ||
                        "Best Of The Month"
                      }
                      fill
                      unoptimized
                      sizes="105px"
                      className="object-cover"
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#06142E]/35">
                          {formatMonth(
                            item.month,
                          )}
                        </p>

                        <h3 className="mt-1 truncate text-base font-black text-[#06142E]">
                          {item.title?.trim() ||
                            "Best Of The Month"}
                        </h3>

                        <p className="mt-1 text-xs font-bold text-[#06142E]/40">
                          Ordine{" "}
                          {item.order}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-[7px] px-2 py-1 text-[9px] font-black uppercase ${
                          item.status ===
                          "published"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {item.status ===
                        "published"
                          ? "Pubblicato"
                          : "Bozza"}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={
                          () => {
                            startEditing(
                              item,
                            );
                          }
                        }
                        className="flex min-h-10 items-center justify-center gap-2 rounded-[11px] bg-[#06142E]/5 px-3 text-[10px] font-black uppercase text-[#06142E]"
                      >
                        <Pencil
                          size={
                            14
                          }
                        />
                        Modifica
                      </button>

                      <button
                        type="button"
                        disabled={
                          deletingItemId ===
                          item.id
                        }
                        onClick={
                          () => {
                            void handleDelete(
                              item,
                            );
                          }
                        }
                        className="flex min-h-10 items-center justify-center gap-2 rounded-[11px] bg-red-50 px-3 text-[10px] font-black uppercase text-red-700 disabled:opacity-40"
                      >
                        <Trash2
                          size={
                            14
                          }
                        />
                        {deletingItemId ===
                        item.id
                          ? "..."
                          : "Elimina"}
                      </button>
                    </div>
                  </div>
                </article>
              ),
            )}
          </div>
        )}
      </section>
    </AppShell>
  );
}

/*
 * ============================================================
 * FORMAT MESE
 * ============================================================
 */

function formatMonth(
  value:
    string,
) {
  const parsed =
    new Date(
      `${value}-01T12:00:00`,
    );

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "it-IT",

    {
      month:
        "long",

      year:
        "numeric",
    },
  ).format(
    parsed,
  );
}
