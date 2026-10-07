"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import AppShell from "@/components/ui/AppShell";
import VideoCoverUploader from "@/components/admin/video/VideoCoverUploader";

import {
  useCompetition,
} from "@/src/contexts/CompetitionContext";

import {
  FirebaseVideoRepository,
} from "@/src/services/video/FirebaseVideoRepository";

import {
  buildYouTubeCoverUrl,
  buildYouTubeEmbedUrl,
  extractYouTubeVideoId,
} from "@/src/services/video/YouTubeUtils";

import type {
  VideoItem,
  VideoStatus,
} from "@/src/types/VideoItem";

type LudiTvForm = {
  contentType: string;
  title: string;
  youtubeUrl: string;
  coverUrl: string;
  coverKey: string;
  status: VideoStatus;
};

const EMPTY_FORM: LudiTvForm = {
  contentType:
    "Intervista",

  title:
    "",

  youtubeUrl:
    "",

  coverUrl:
    "",

  coverKey:
    "",

  status:
    "draft",
};

export default function AdminLudiTvScreen() {
  const {
    currentSeason,

    selectedCompetition,

    isLoading:
      competitionLoading,

    error:
      competitionError,
  } =
    useCompetition();

  const currentSeasonId =
    currentSeason?.id;

  const isLudiTvEnabled = Boolean(selectedCompetition);

  const [
    items,
    setItems,
  ] =
    useState<
      VideoItem[]
    >([]);

  const [
    isLoadingItems,
    setIsLoadingItems,
  ] =
    useState(
      Boolean(
        currentSeasonId,
      ),
    );

  const [
    itemsError,
    setItemsError,
  ] =
    useState<
      string | null
    >(null);

  const [
    form,
    setForm,
  ] =
    useState<LudiTvForm>(
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
    actionError,
    setActionError,
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

  useEffect(() => {
    if (
      !currentSeasonId ||
      !isLudiTvEnabled
    ) {
      return;
    }

    const unsubscribe =
      FirebaseVideoRepository
        .subscribeAllBySeason(
          currentSeasonId,

          "ludi-tv",

          (
            nextItems,
          ) => {
            setItems(
              nextItems,
            );

            setItemsError(
              null,
            );

            setIsLoadingItems(
              false,
            );
          },

          (
            currentError,
          ) => {
            console.error(
              "Errore caricamento Ludi TV.",
              currentError,
            );

            setItemsError(
              currentError instanceof
                Error
                ? currentError.message
                : "Impossibile caricare i contenuti Ludi TV.",
            );

            setIsLoadingItems(
              false,
            );
          },
        );

    return unsubscribe;
  }, [
    currentSeasonId,
    isLudiTvEnabled,
  ]);

  const youtubeVideoId =
    useMemo(
      () =>
        extractYouTubeVideoId(
          form.youtubeUrl,
        ),
      [
        form.youtubeUrl,
      ],
    );

  const previewCoverUrl =
    useMemo(() => {
      const customCoverUrl =
        form.coverUrl.trim();

      if (
        customCoverUrl
      ) {
        return customCoverUrl;
      }

      if (
        youtubeVideoId
      ) {
        return buildYouTubeCoverUrl(
          youtubeVideoId,
        );
      }

      return "";
    }, [
      form.coverUrl,
      youtubeVideoId,
    ]);

  function updateForm<
    Field extends
      keyof LudiTvForm,
  >(
    field:
      Field,

    value:
      LudiTvForm[Field],
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
  }

  function resetForm() {
    setForm(
      EMPTY_FORM,
    );

    setEditingItemId(
      null,
    );

    setActionError(
      null,
    );
  }

  function startEditing(
    item:
      VideoItem,
  ) {
    setEditingItemId(
      item.id,
    );

    setForm({
      contentType:
        item.contentType ||
        "Intervista",

      title:
        item.title ??
        "",

      youtubeUrl:
        item.youtubeUrl ??
        "",

      coverUrl:
        item.coverUrl ??
        "",

      coverKey:
        item.coverKey ??
        "",

      status:
        item.status,
    });

    setActionError(
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

  async function handleSubmit(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      isSaving ||
      !currentSeasonId ||
      !isLudiTvEnabled
    ) {
      if (
        !currentSeasonId
      ) {
        setActionError(
          "Non esiste una stagione corrente.",
        );
      } else if (
        !isLudiTvEnabled
      ) {
        setActionError(
          "Ludi TV non è attiva senza una competizione selezionata.",
        );
      }

      return;
    }

    const normalizedContentType =
      form.contentType.trim();

    if (
      normalizedContentType.length <
      2
    ) {
      setActionError(
        "Inserisci il tipo di contenuto.",
      );

      return;
    }

    const normalizedYouTubeUrl =
      form.youtubeUrl.trim();

    const normalizedVideoId =
      extractYouTubeVideoId(
        normalizedYouTubeUrl,
      );

    if (
      !normalizedVideoId
    ) {
      setActionError(
        "Inserisci un link YouTube valido.",
      );

      return;
    }

    setIsSaving(
      true,
    );

    setActionError(
      null,
    );

    setSuccessMessage(
      null,
    );

    try {
      const commonInput = {
        seasonId:
          currentSeasonId,

        section:
          "ludi-tv" as const,

        contentType:
          normalizedContentType,

        title:
          form.title.trim() ||
          undefined,

        youtubeUrl:
          normalizedYouTubeUrl,

        youtubeVideoId:
          normalizedVideoId,

        coverUrl:
          form.coverUrl.trim() ||
          undefined,

        coverKey:
          form.coverKey.trim() ||
          undefined,

        status:
          form.status,

        matchweek:
          0,
      };

      if (
        editingItemId
      ) {
        await FirebaseVideoRepository.update(
          {
            itemId:
              editingItemId,

            ...commonInput,
          },
        );

        setSuccessMessage(
          "Contenuto Ludi TV aggiornato correttamente.",
        );
      } else {
        await FirebaseVideoRepository.create(
          commonInput,
        );

        setSuccessMessage(
          "Contenuto Ludi TV creato correttamente.",
        );
      }

      resetForm();
    } catch (currentError) {
      console.error(
        "Errore salvataggio Ludi TV:",
        currentError,
      );

      setActionError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile salvare il contenuto Ludi TV.",
      );
    } finally {
      setIsSaving(
        false,
      );
    }
  }

  async function handleDelete(
    item:
      VideoItem,
  ) {
    if (
      deletingItemId
    ) {
      return;
    }

    const displayTitle =
      item.title ||
      item.contentType ||
      "Contenuto";

    const confirmed =
      window.confirm(
        [
          `Eliminare "${displayTitle}"?`,
          "",
          "Questa operazione non può essere annullata.",
        ].join(
          "\n",
        ),
      );

    if (
      !confirmed
    ) {
      return;
    }

    setDeletingItemId(
      item.id,
    );

    setActionError(
      null,
    );

    setSuccessMessage(
      null,
    );

    try {
      await FirebaseVideoRepository.remove(
        item.id,
      );

      if (
        editingItemId ===
        item.id
      ) {
        resetForm();
      }

      setSuccessMessage(
        "Contenuto Ludi TV eliminato correttamente.",
      );
    } catch (currentError) {
      console.error(
        "Errore eliminazione Ludi TV:",
        currentError,
      );

      setActionError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile eliminare il contenuto Ludi TV.",
      );
    } finally {
      setDeletingItemId(
        null,
      );
    }
  }

  const isLoading =
    competitionLoading ||
    (
      Boolean(
        currentSeasonId,
      ) &&
      isLoadingItems
    );

  if (
    !competitionLoading &&
    !isLudiTvEnabled
  ) {
    return (
      <AppShell>
        <section className="rounded-[20px] bg-white p-7 text-center shadow-[0_10px_24px_rgba(6,20,46,0.08)]">
          <p className="text-sm font-black text-[#06142E]">
            Ludi TV non è disponibile
            senza una competizione selezionata.
          </p>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="mt-6 mb-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#06142E]/40">
          Centro di controolo
        </p>

        <h1 className="mt-1 text-3xl font-black uppercase text-[#06142E]">
          Ludi TV
        </h1>

        <p className="mt-2 text-sm font-bold leading-6 text-[#06142E]/50">
          Gestisci interviste e altri contenuti editoriali.
        </p>
      </header>

      {competitionError && (
        <ErrorMessage
          message={
            competitionError
          }
        />
      )}

      {itemsError && (
        <ErrorMessage
          message={
            itemsError
          }
        />
      )}

      {actionError && (
        <ErrorMessage
          message={
            actionError
          }
        />
      )}

      {successMessage && (
        <div className="mb-5 rounded-[14px] border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-700">
          {successMessage}
        </div>
      )}

      <form
        onSubmit={
          handleSubmit
        }
        className="mb-3"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#06142E]/40">
              {editingItemId
                ? "Modifica contenuto"
                : "Nuovo contenuto"}
            </p>

            <h2 className="mt-1 text-xl font-black uppercase text-[#06142E]">
              {editingItemId
                ? "Modifica Ludi TV"
                : "Aggiungi a Ludi TV"}
            </h2>
          </div>

          {editingItemId && (
            <button
              type="button"
              onClick={
                resetForm
              }
              disabled={
                isSaving
              }
              className="rounded-[12px] bg-[#06142E]/5 px-3 py-2 text-[10px] font-black uppercase text-[#06142E] disabled:opacity-40"
            >
              Annulla
            </button>
          )}
        </div>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
              Tipo contenuto
            </span>

            <select
              value={
                form.contentType
              }
              onChange={(event) => {
                updateForm(
                  "contentType",
                  event.target.value,
                );
              }}
              className="ludi-input"
              required
            >
              <option value="Intervista">
                Intervista
              </option>

              <option value="Backstage">
                Highlights
              </option>

              <option value="Celebration">
                Celebration
              </option>

              <option value="Goal of the Day">
                Goal of the Day
              </option>

              <option value="Backstage">
                Backstage
              </option>

              <option value="Altro">
                Altro
              </option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
              Titolo
            </span>

            <input
              type="text"
              value={
                form.title
              }
              onChange={(event) => {
                updateForm(
                  "title",
                  event.target.value,
                );
              }}
              className="ludi-input"
              placeholder="Es. Intervista post partita"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
              Link YouTube
            </span>

            <input
              type="text"
              value={
                form.youtubeUrl
              }
              onChange={(event) => {
                updateForm(
                  "youtubeUrl",
                  event.target.value,
                );
              }}
              className="ludi-input"
              placeholder="https://www.youtube.com/watch?v=..."
              required
            />
          </label>

          <VideoCoverUploader
            value={
              form.coverUrl ||
              undefined
            }
            onChange={(
              url,
              key,
            ) => {
              updateForm(
                "coverUrl",
                url,
              );

              updateForm(
                "coverKey",
                key ?? "",
              );
            }}
            onRemove={() => {
              updateForm(
                "coverUrl",
                "",
              );

              updateForm(
                "coverKey",
                "",
              );
            }}
          />

          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
              Stato
            </span>

            <select
              value={
                form.status
              }
              onChange={(event) => {
                updateForm(
                  "status",
                  event.target
                    .value as
                    VideoStatus,
                );
              }}
              className="ludi-input"
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

        {form.youtubeUrl.trim() &&
          !youtubeVideoId && (
            <div className="mt-4 rounded-[14px] border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">
              Il link YouTube inserito
              non è valido.
            </div>
          )}

        {youtubeVideoId && (
          <section className="mt-5">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-[#06142E]/40">
              Anteprima video
            </p>

            <div className="overflow-hidden rounded-[18px] bg-black">
              <div className="aspect-video">
                <iframe
                  src={
                    buildYouTubeEmbedUrl(
                      youtubeVideoId,
                    )
                  }
                  title="Anteprima Ludi TV"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
            </div>

            {previewCoverUrl && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-[#06142E]/40">
                  Copertina utilizzata
                </p>

                <div className="aspect-video overflow-hidden rounded-[14px] bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      previewCoverUrl
                    }
                    alt="Copertina Ludi TV"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            )}
          </section>
        )}

        <button
          type="submit"
          disabled={
            isSaving ||
            !currentSeasonId ||
            !youtubeVideoId ||
            form.contentType
              .trim()
              .length <
              2
          }
          className="ludi-button-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSaving
            ? "Salvataggio..."
            : editingItemId
              ? "Salva modifiche"
              : "Crea contenuto"}
        </button>
      </form>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#06142E]/40">
              Archivio stagione
            </p>

            <h2 className="mt-1 text-2xl font-black uppercase text-[#06142E]">
              Contenuti Ludi TV
            </h2>
          </div>

          <span className="rounded-full bg-[#06142E]/5 px-3 py-2 text-xs font-black text-[#06142E]">
            {items.length}
          </span>
        </div>

        {isLoading ? (
          <div className="ludi-card p-6 text-center">
            <p className="font-black text-[#06142E]">
              Caricamento contenuti...
            </p>
          </div>
        ) : items.length ===
          0 ? (
          <div className="ludi-card p-6 text-center">
            <p className="font-black text-[#06142E]">
              Nessun contenuto presente.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map(
              (item) => {
                const itemCoverUrl =
                  item.coverUrl ||
                  (
                    item.youtubeVideoId
                      ? buildYouTubeCoverUrl(
                          item.youtubeVideoId,
                        )
                      : ""
                  );

                const displayTitle =
                  item.title ||
                  item.contentType;

                return (
                  <article
                    key={
                      item.id
                    }
                    className="ludi-card overflow-hidden"
                  >
                    {itemCoverUrl && (
                      <div className="aspect-video overflow-hidden bg-black">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            itemCoverUrl
                          }
                          alt={
                            displayTitle
                          }
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}

                    <div className="p-5">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#06142E]/40">
                        {item.contentType}
                      </p>

                      <h3 className="mt-1 text-xl font-black uppercase text-[#06142E]">
                        {displayTitle}
                      </h3>

                      <span
                        className={
                          item.status ===
                          "published"
                            ? "mt-3 inline-flex rounded-full bg-green-100 px-3 py-2 text-[10px] font-black uppercase text-green-700"
                            : "mt-3 inline-flex rounded-full bg-amber-100 px-3 py-2 text-[10px] font-black uppercase text-amber-700"
                        }
                      >
                        {item.status ===
                        "published"
                          ? "Pubblicato"
                          : "Bozza"}
                      </span>

                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            startEditing(
                              item,
                            );
                          }}
                          disabled={
                            isSaving ||
                            deletingItemId !==
                            null
                          }
                          className="rounded-[13px] bg-[#06142E] px-4 py-3 text-xs font-black uppercase text-white disabled:opacity-40"
                        >
                          Modifica
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            void handleDelete(
                              item,
                            );
                          }}
                          disabled={
                            isSaving ||
                            deletingItemId !==
                            null
                          }
                          className="rounded-[13px] bg-red-50 px-4 py-3 text-xs font-black uppercase text-red-700 disabled:opacity-40"
                        >
                          {deletingItemId ===
                          item.id
                            ? "Eliminazione..."
                            : "Elimina"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              },
            )}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function ErrorMessage({
  message,
}: {
  message: string;
}) {
  return (
    <div className="mb-5 rounded-[14px] border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
      {message}
    </div>
  );
}