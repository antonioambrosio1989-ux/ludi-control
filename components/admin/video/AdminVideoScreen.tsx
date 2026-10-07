"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import AppShell from "@/components/ui/AppShell";

import VideoCoverUploader from "./VideoCoverUploader";

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

type VideoForm = {
  contentType: string;

  title: string;

  youtubeUrl: string;

  coverUrl: string;

  coverKey: string;

  status:
    VideoStatus;
};

const EMPTY_FORM: VideoForm = {
  contentType:
    "Goal Parade",

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

export default function AdminVideoeScreen() {
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
        currentSeason?.id,
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
    useState<VideoForm>(
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
    editingLegacyMatchweek,
    setEditingLegacyMatchweek,
  ] =
    useState<
      number | undefined
    >(undefined);

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

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

  const visibleItems =
    currentSeasonId
      ? items
      : [];

  const effectiveItemsLoading =
    Boolean(
      currentSeasonId,
    ) &&
    isLoadingItems;

  const effectiveItemsError =
    currentSeasonId
      ? itemsError
      : null;

  useEffect(() => {
  if (
    !currentSeasonId
  ) {
    return;
  }

  const unsubscribe =
    FirebaseVideoRepository.subscribeAllBySeason(
      currentSeasonId,

      "video",

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
          "Errore caricamento Video.",
          currentError,
        );

        setItemsError(
          currentError instanceof
            Error
            ? currentError.message
            : "Impossibile caricare i video.",
        );

        setIsLoadingItems(
          false,
        );
      },
    );

  return unsubscribe;
}, [
  currentSeasonId,
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
      keyof VideoForm,
  >(
    field:
      Field,

    value:
      VideoForm[Field],
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

    setEditingLegacyMatchweek(
      undefined,
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

    setEditingLegacyMatchweek(
      item.matchweek >
        0
        ? item.matchweek
        : undefined,
    );

    setForm({
      contentType:
        item.contentType ??
        "Goal Parade",

      title:
        item.title ?? "",

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
  !currentSeasonId
) {
      if (
  !currentSeasonId
) {
  setActionError(
    "Non esiste una stagione corrente.",
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
          "video" as const,

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

        /*
         * Manteniamo soltanto
         * l'eventuale matchweek
         * appartenente a un vecchio
         * Goal Parade.
         */
        matchweek:
          editingLegacyMatchweek,
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
          "Video aggiornato correttamente.",
        );
      } else {
        await FirebaseVideoRepository.create(
          commonInput,
        );

        setSuccessMessage(
          "Video creato correttamente.",
        );
      }

      resetForm();
    } catch (currentError) {
      console.error(
        "Errore salvataggio Video:",
        currentError,
      );

      setActionError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile salvare il video.",
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
      "Video";

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
        "Video eliminato correttamente.",
      );
    } catch (currentError) {
      console.error(
        "Errore eliminazione Video:",
        currentError,
      );

      setActionError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile eliminare il video.",
      );
    } finally {
      setDeletingItemId(
        null,
      );
    }
  }

  const isLoading =
    competitionLoading ||
    effectiveItemsLoading;

  return (
    <AppShell>
      <header className="mt-6 mb-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#06142E]/40">
          Centro di controllo
        </p>

        <h1 className="mt-1 text-3xl font-black uppercase text-[#06142E]">
          Video
        </h1>

        <p className="mt-2 text-sm font-bold leading-6 text-[#06142E]/50">
          Gestisci i contenuti video
          pubblicati su YouTube.
        </p>
      </header>

      {competitionError && (
        <ErrorMessage
          message={
            competitionError
          }
        />
      )}

      {effectiveItemsError && (
        <ErrorMessage
          message={
            effectiveItemsError
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
          {
            successMessage
          }
        </div>
      )}

      <form
        onSubmit={
          handleSubmit
        }
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
                ? "Modifica video"
                : "Aggiungi video"}
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
    value={form.contentType}
    onChange={(event) => {
      updateForm(
        "contentType",
        event.target.value,
      );
    }}
    className="ludi-input"
    required
  >
    <option value="Goal Parade">
      Goal Parade
    </option>

    <option value="Save Parade">
      Save Parade
    </option>

    <option value="Goal Collection">
      Goal Collection
    </option>

    <option value="Save Collection">
      Save Collection
    </option>

    <option value="Top Goals">
      Top Goals
    </option>

    <option value="Top Saves">
      Top Saves
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
              placeholder="Es. I migliori gol della settimana"
            />

            <p className="mt-2 text-xs font-bold text-[#06142E]/40">
              Facoltativo. Se resta
              vuoto verrà mostrato il
              tipo di contenuto.
            </p>
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

            <p className="mt-2 text-xs font-bold leading-5 text-[#06142E]/40">
              Sono accettati link
              YouTube, youtu.be,
              Shorts, Live ed Embed.
            </p>
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
                Pubblicata
              </option>
            </select>
          </label>
        </div>

        {form.youtubeUrl.trim() &&
          !youtubeVideoId && (
            <div className="mt-4 rounded-[14px] border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">
              Il link YouTube
              inserito non è valido.
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
                  title="Anteprima video"
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
                    alt="Copertina video"
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
            !currentSeason ||
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
              : "Crea video"}
        </button>
      </form>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#06142E]/40">
              Archivio stagione
            </p>

            <h2 className="mt-1 text-2xl font-black uppercase text-[#06142E]">
              Video caricati
            </h2>
          </div>

          <span className="rounded-full bg-[#06142E]/5 px-3 py-2 text-xs font-black text-[#06142E]">
            {
              visibleItems.length
            }
          </span>
        </div>

        {isLoading ? (
          <div className="ludi-card p-6 text-center">
            <p className="font-black text-[#06142E]">
              Caricamento video...
            </p>
          </div>
        ) : visibleItems.length ===
          0 ? (
          <div className="ludi-card p-6 text-center">
            <p className="font-black text-[#06142E]">
              Nessun video presente.
            </p>

            <p className="mt-2 text-sm font-bold text-[#06142E]/45">
              Inserisci il primo
              contenuto video.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleItems.map(
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
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#06142E]/40">
                            {
                              item.contentType
                            }
                          </p>

                          <h3 className="mt-1 text-xl font-black uppercase text-[#06142E]">
                            {
                              displayTitle
                            }
                          </h3>

                          {item.matchweek >
                            0 && (
                            <p className="mt-1 text-[10px] font-bold uppercase text-[#06142E]/35">
                              Contenuto storico ·
                              Matchweek{" "}
                              {
                                item.matchweek
                              }
                            </p>
                          )}
                        </div>

                        <span
                          className={
                            item.status ===
                            "published"
                              ? "rounded-full bg-green-100 px-3 py-2 text-[10px] font-black uppercase text-green-700"
                              : "rounded-full bg-amber-100 px-3 py-2 text-[10px] font-black uppercase text-amber-700"
                          }
                        >
                          {item.status ===
                          "published"
                            ? "Pubblicata"
                            : "Bozza"}
                        </span>
                      </div>

                      <a
                        href={
                          item.youtubeUrl
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-flex text-sm font-black text-red-600 hover:underline"
                      >
                        Apri su YouTube
                      </a>

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