"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";

import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";

import AppShell from "@/components/ui/AppShell";

import {
  useAuth,
} from "@/src/hooks/useAuth";

import {
  useCompetition,
} from "@/src/contexts/CompetitionContext";

import {
  storage,
} from "@/src/lib/firebase";

import {
  FirebaseSponsorRepository,
} from "@/src/services/sponsor/FirebaseSponsorRepository";

import type {
  Sponsor,
  SponsorSocialPlatform,
} from "@/src/types/Sponsor";

const MAX_FILE_SIZE =
  5 * 1024 * 1024;

type SponsorFormState = {
  name:
    string;

  socialPlatform:
    SponsorSocialPlatform;

  socialUrl:
    string;

  sortOrder:
    string;

  active:
    boolean;
};

const EMPTY_FORM:
  SponsorFormState = {
    name:
      "",

    socialPlatform:
      "instagram",

    socialUrl:
      "",

    sortOrder:
      "0",

    active:
      true,
  };

export default function AdminSponsorsScreen() {
  const {
    isAdmin,

    isLoading:
      authLoading,
  } =
    useAuth();

  const {
    selectedCompetition,
    selectedCompetitionId,

    isLoading:
      competitionLoading,
  } =
    useCompetition();

  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const imagePreviewUrlRef =
    useRef<string | null>(
      null,
    );

  const [
    sponsors,
    setSponsors,
  ] =
    useState<
      Sponsor[]
    >(
      [],
    );

  const [
    form,
    setForm,
  ] =
    useState<
      SponsorFormState
    >(
      EMPTY_FORM,
    );

  const [
    selectedFile,
    setSelectedFile,
  ] =
    useState<
      File | null
    >(
      null,
    );

  const [
    imagePreviewUrl,
    setImagePreviewUrl,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    editingSponsorId,
    setEditingSponsorId,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(
      true,
    );

  const [
    isSaving,
    setIsSaving,
  ] =
    useState(
      false,
    );

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const editingSponsor =
    useMemo(
      () =>
        sponsors.find(
          (
            sponsor,
          ) =>
            sponsor.id ===
            editingSponsorId,
        ),
      [
        sponsors,
        editingSponsorId,
      ],
    );

  useEffect(
    () => {
      if (
        authLoading ||
        competitionLoading
      ) {
        return;
      }

      if (
        !isAdmin ||
        !selectedCompetitionId
      ) {
        return;
      }

      const unsubscribe =
        FirebaseSponsorRepository.subscribeByCompetition(
          selectedCompetitionId,

          (
            loadedSponsors,
          ) => {
            setSponsors(
              loadedSponsors,
            );

            setError(
              null,
            );

            setIsLoading(
              false,
            );
          },

          (
            currentError,
          ) => {
            setError(
              currentError.message,
            );

            setIsLoading(
              false,
            );
          },
        );

      return unsubscribe;
    },
    [
      authLoading,
      competitionLoading,
      isAdmin,
      selectedCompetitionId,
    ],
  );



  useEffect(
    () => {
      return () => {
        if (
          imagePreviewUrlRef.current
        ) {
          URL.revokeObjectURL(
            imagePreviewUrlRef.current,
          );
        }
      };
    },
    [],
  );

  if (
    authLoading ||
    competitionLoading
  ) {
    return (
      <AppShell>
        <MessageCard>
          Caricamento sponsor...
        </MessageCard>
      </AppShell>
    );
  }

  if (
    !isAdmin
  ) {
    return (
      <AppShell>
        <MessageCard error>
          Accesso riservato agli amministratori.
        </MessageCard>
      </AppShell>
    );
  }

  if (
    !selectedCompetitionId
  ) {
    return (
      <AppShell>
        <MessageCard error>
          Seleziona una competizione.
        </MessageCard>
      </AppShell>
    );
  }

  function handleFileChange(
    event:
      ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0] ??
      null;

    setError(
      null,
    );

    if (
      !file
    ) {
      if (
        imagePreviewUrlRef.current
      ) {
        URL.revokeObjectURL(
          imagePreviewUrlRef.current,
        );

        imagePreviewUrlRef.current =
          null;
      }

      setImagePreviewUrl(
        null,
      );

      setSelectedFile(
        null,
      );

      return;
    }

    if (
      !file.type.startsWith(
        "image/",
      )
    ) {
      setError(
        "Seleziona un file immagine.",
      );

      event.target.value =
        "";

      return;
    }

    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      setError(
        "L'immagine non può superare 5 MB.",
      );

      event.target.value =
        "";

      return;
    }

    if (
      imagePreviewUrlRef.current
    ) {
      URL.revokeObjectURL(
        imagePreviewUrlRef.current,
      );
    }

    const nextPreviewUrl =
      URL.createObjectURL(
        file,
      );

    imagePreviewUrlRef.current =
      nextPreviewUrl;

    setImagePreviewUrl(
      nextPreviewUrl,
    );

    setSelectedFile(
      file,
    );
  }

  function startEditing(
    sponsor:
      Sponsor,
  ) {
    setEditingSponsorId(
      sponsor.id,
    );

    setForm({
      name:
        sponsor.name,

      socialPlatform:
        sponsor.socialPlatform,

      socialUrl:
        sponsor.socialUrl,

      sortOrder:
        String(
          sponsor.sortOrder,
        ),

      active:
        sponsor.active,
    });

    if (
      imagePreviewUrlRef.current
    ) {
      URL.revokeObjectURL(
        imagePreviewUrlRef.current,
      );

      imagePreviewUrlRef.current =
        null;
    }

    setImagePreviewUrl(
      null,
    );

    setSelectedFile(
      null,
    );

    setError(
      null,
    );

    setSuccessMessage(
      null,
    );

    if (
      fileInputRef.current
    ) {
      fileInputRef.current.value =
        "";
    }

    window.scrollTo({
      top:
        0,

      behavior:
        "smooth",
    });
  }

  function resetForm() {
    setForm(
      EMPTY_FORM,
    );

    setEditingSponsorId(
      null,
    );

    if (
      imagePreviewUrlRef.current
    ) {
      URL.revokeObjectURL(
        imagePreviewUrlRef.current,
      );

      imagePreviewUrlRef.current =
        null;
    }

    setImagePreviewUrl(
      null,
    );

    setSelectedFile(
      null,
    );

    if (
      fileInputRef.current
    ) {
      fileInputRef.current.value =
        "";
    }
  }

  async function handleSave() {
    if (
      isSaving ||
      !selectedCompetitionId
    ) {
      return;
    }

    const normalizedName =
      form.name.trim();

    const normalizedSocialUrl =
      normalizeUrl(
        form.socialUrl,
      );

    const sortOrder =
      Number(
        form.sortOrder,
      );

    if (
      !normalizedName
    ) {
      setError(
        "Inserisci il nome dello sponsor.",
      );

      return;
    }

    if (
      !normalizedSocialUrl
    ) {
      setError(
        "Inserisci il link della pagina social.",
      );

      return;
    }

    if (
      !Number.isFinite(
        sortOrder,
      )
    ) {
      setError(
        "L'ordine deve essere un numero.",
      );

      return;
    }

    if (
      !editingSponsor &&
      !selectedFile
    ) {
      setError(
        "Carica l'immagine dello sponsor.",
      );

      return;
    }

    setIsSaving(
      true,
    );

    setError(
      null,
    );

    setSuccessMessage(
      null,
    );

    let uploadedStoragePath:
      string | undefined;

    try {
      let imageUrl =
        editingSponsor?.imageUrl ??
        "";

      let storagePath =
        editingSponsor?.storagePath;

      if (
        selectedFile
      ) {
        uploadedStoragePath =
          buildSponsorStoragePath({
            competitionId:
              selectedCompetitionId,

            sponsorName:
              normalizedName,

            file:
              selectedFile,
          });

        const storageReference =
          ref(
            storage,
            uploadedStoragePath,
          );

        await uploadBytes(
          storageReference,
          selectedFile,
          {
            contentType:
              selectedFile.type,
          },
        );

        imageUrl =
          await getDownloadURL(
            storageReference,
          );

        storagePath =
          uploadedStoragePath;
      }

      if (
        editingSponsor
      ) {
        const previousStoragePath =
          editingSponsor.storagePath;

        await FirebaseSponsorRepository.update(
          editingSponsor.id,
          {
            name:
              normalizedName,

            imageUrl,

            storagePath,

            socialPlatform:
              form.socialPlatform,

            socialUrl:
              normalizedSocialUrl,

            sortOrder,

            active:
              form.active,
          },
        );

        if (
          selectedFile &&
          previousStoragePath &&
          previousStoragePath !==
            storagePath
        ) {
          await safelyDeleteStorageFile(
            previousStoragePath,
          );
        }

        setSuccessMessage(
          "Sponsor aggiornato.",
        );
      } else {
        await FirebaseSponsorRepository.create({
          competitionId:
            selectedCompetitionId,

          name:
            normalizedName,

          imageUrl,

          storagePath,

          socialPlatform:
            form.socialPlatform,

          socialUrl:
            normalizedSocialUrl,

          sortOrder,

          active:
            form.active,
        });

        setSuccessMessage(
          "Sponsor aggiunto.",
        );
      }

      resetForm();
    } catch (
      currentError
    ) {
      console.error(
        "Errore salvataggio sponsor:",
        currentError,
      );

      if (
        uploadedStoragePath
      ) {
        await safelyDeleteStorageFile(
          uploadedStoragePath,
        );
      }

      setError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile salvare lo sponsor.",
      );
    } finally {
      setIsSaving(
        false,
      );
    }
  }

  async function handleDelete(
    sponsor:
      Sponsor,
  ) {
    if (
      isSaving
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Eliminare lo sponsor "${sponsor.name}"?`,
      );

    if (
      !confirmed
    ) {
      return;
    }

    setIsSaving(
      true,
    );

    setError(
      null,
    );

    setSuccessMessage(
      null,
    );

    try {
      await FirebaseSponsorRepository.delete(
        sponsor.id,
      );

      if (
        sponsor.storagePath
      ) {
        await safelyDeleteStorageFile(
          sponsor.storagePath,
        );
      }

      if (
        editingSponsorId ===
        sponsor.id
      ) {
        resetForm();
      }

      setSuccessMessage(
        "Sponsor eliminato.",
      );
    } catch (
      currentError
    ) {
      console.error(
        "Errore eliminazione sponsor:",
        currentError,
      );

      setError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile eliminare lo sponsor.",
      );
    } finally {
      setIsSaving(
        false,
      );
    }
  }

  const displayedImageUrl =
    imagePreviewUrl ??
    editingSponsor
      ?.imageUrl ??
    null;

  return (
    <AppShell>
      <header className="mt-6 mb-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#06142E]/40">
          Centro di controllo
        </p>

        <h1 className="mt-1 text-3xl font-black uppercase text-[#06142E]">
          Sponsor
        </h1>

        <p className="mt-1 text-sm font-bold text-[#06142E]/50">
          Gestisci gli sponsor della{" "}
          {selectedCompetition
            ?.name ??
            "competizione"}
        </p>
      </header>

      <section className="mb-5 rounded-[18px] bg-white p-5 shadow-[0_10px_24px_rgba(6,20,46,0.10)]">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black uppercase text-[#06142E]">
              {editingSponsor
                ? "Modifica sponsor"
                : "Nuovo sponsor"}
            </h2>

            <p className="mt-1 text-xs font-bold text-[#06142E]/45">
              Carica il logo e collega la pagina social.
            </p>
          </div>

          {editingSponsor && (
            <button
              type="button"
              disabled={
                isSaving
              }
              onClick={
                resetForm
              }
              className="rounded-[10px] bg-[#06142E]/5 px-3 py-2 text-[10px] font-black uppercase text-[#06142E]/55 disabled:opacity-50"
            >
              Annulla
            </button>
          )}
        </div>

        <div className="space-y-4">
          <Field
            label="Nome sponsor"
          >
            <input
              value={
                form.name
              }
              disabled={
                isSaving
              }
              onChange={
                (
                  event,
                ) => {
                  setForm(
                    (
                      current,
                    ) => ({
                      ...current,

                      name:
                        event.target.value,
                    }),
                  );
                }
              }
              placeholder="Es. Ludi Sport"
              className="admin-input"
            />
          </Field>

          <Field
            label="Immagine"
          >
            <input
              ref={
                fileInputRef
              }
              type="file"
              accept="image/*"
              disabled={
                isSaving
              }
              onChange={
                handleFileChange
              }
              className="block w-full text-xs font-bold text-[#06142E]/55 file:mr-3 file:rounded-[10px] file:border-0 file:bg-[#06142E] file:px-4 file:py-3 file:text-xs file:font-black file:uppercase file:text-white"
            />

            <p className="mt-2 text-[10px] font-bold text-[#06142E]/35">
              JPG, PNG, WEBP o altro formato immagine. Max 5 MB.
            </p>

            {displayedImageUrl && (
              <div className="mt-3 flex h-32 items-center justify-center overflow-hidden rounded-[13px] border border-[#06142E]/10 bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    displayedImageUrl
                  }
                  alt="Anteprima sponsor"
                  className="h-full w-full object-contain"
                />
              </div>
            )}
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Social"
            >
              <select
                value={
                  form.socialPlatform
                }
                disabled={
                  isSaving
                }
                onChange={
                  (
                    event,
                  ) => {
                    setForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        socialPlatform:
                          event.target.value as
                            SponsorSocialPlatform,
                      }),
                    );
                  }
                }
                className="admin-input"
              >
                <option value="instagram">
                  Instagram
                </option>

                <option value="facebook">
                  Facebook
                </option>

                <option value="tiktok">
                  TikTok
                </option>
              </select>
            </Field>

            <Field
              label="Ordine"
            >
              <input
                type="number"
                value={
                  form.sortOrder
                }
                disabled={
                  isSaving
                }
                onChange={
                  (
                    event,
                  ) => {
                    setForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        sortOrder:
                          event.target.value,
                      }),
                    );
                  }
                }
                className="admin-input"
              />
            </Field>
          </div>

          <Field
            label="Link pagina social"
          >
            <input
              type="url"
              value={
                form.socialUrl
              }
              disabled={
                isSaving
              }
              onChange={
                (
                  event,
                ) => {
                  setForm(
                    (
                      current,
                    ) => ({
                      ...current,

                      socialUrl:
                        event.target.value,
                    }),
                  );
                }
              }
              placeholder="https://www.instagram.com/..."
              className="admin-input"
            />
          </Field>

          <label className="flex items-center gap-3 rounded-[13px] bg-[#06142E]/5 p-4">
            <input
              type="checkbox"
              checked={
                form.active
              }
              disabled={
                isSaving
              }
              onChange={
                (
                  event,
                ) => {
                  setForm(
                    (
                      current,
                    ) => ({
                      ...current,

                      active:
                        event.target.checked,
                    }),
                  );
                }
              }
              className="h-5 w-5"
            />

            <span className="text-sm font-black text-[#06142E]">
              Sponsor visibile nella Home
            </span>
          </label>

          {error && (
            <MessageCard error>
              {error}
            </MessageCard>
          )}

          {successMessage && (
            <div className="rounded-[13px] bg-emerald-50 p-4 text-center text-sm font-black text-emerald-700">
              {successMessage}
            </div>
          )}

          <button
            type="button"
            disabled={
              isSaving
            }
            onClick={
              () => {
                void handleSave();
              }
            }
            className="flex min-h-12 w-full items-center justify-center rounded-[13px] bg-[var(--competition-primary)] px-5 text-sm font-black uppercase text-[var(--competition-text)] transition active:scale-[0.98] disabled:opacity-50"
          >
            {isSaving
              ? "Salvataggio..."
              : editingSponsor
                ? "Salva modifiche"
                : "Aggiungi sponsor"}
          </button>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="text-lg font-black uppercase text-[#06142E]">
            Sponsor inseriti
          </h2>

          <span className="text-xs font-black text-[#06142E]/40">
            {sponsors.length}
          </span>
        </div>

        {isLoading ? (
          <MessageCard>
            Caricamento sponsor...
          </MessageCard>
        ) : sponsors.length ===
          0 ? (
          <MessageCard>
            Nessuno sponsor inserito.
          </MessageCard>
        ) : (
          <div className="space-y-3">
            {sponsors.map(
              (
                sponsor,
              ) => (
                <article
                  key={
                    sponsor.id
                  }
                  className="rounded-[16px] bg-white p-4 shadow-[0_8px_20px_rgba(6,20,46,0.08)]"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-20 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-[#06142E]/10 bg-white p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          sponsor.imageUrl
                        }
                        alt={
                          sponsor.name
                        }
                        className="h-full w-full object-contain"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-black text-[#06142E]">
                        {sponsor.name}
                      </h3>

                      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#06142E]/40">
                        {getSocialLabel(
                          sponsor.socialPlatform,
                        )}
                        {" · "}
                        Ordine{" "}
                        {sponsor.sortOrder}
                      </p>

                      <p
                        className={`mt-2 text-[10px] font-black uppercase ${
                          sponsor.active
                            ? "text-emerald-600"
                            : "text-[#06142E]/30"
                        }`}
                      >
                        {sponsor.active
                          ? "Visibile"
                          : "Nascosto"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <a
                      href={
                        sponsor.socialUrl
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-10 items-center justify-center rounded-[10px] bg-[#06142E]/5 px-2 text-[10px] font-black uppercase text-[#06142E]/60"
                    >
                      Apri link
                    </a>

                    <button
                      type="button"
                      disabled={
                        isSaving
                      }
                      onClick={
                        () => {
                          startEditing(
                            sponsor,
                          );
                        }
                      }
                      className="min-h-10 rounded-[10px] bg-[#06142E] px-2 text-[10px] font-black uppercase text-white disabled:opacity-50"
                    >
                      Modifica
                    </button>

                    <button
                      type="button"
                      disabled={
                        isSaving
                      }
                      onClick={
                        () => {
                          void handleDelete(
                            sponsor,
                          );
                        }
                      }
                      className="min-h-10 rounded-[10px] bg-red-50 px-2 text-[10px] font-black uppercase text-red-600 disabled:opacity-50"
                    >
                      Elimina
                    </button>
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

function Field({
  label,
  children,
}: {
  label:
    string;

  children:
    ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-[#06142E]/45">
        {label}
      </span>

      {children}
    </label>
  );
}

function MessageCard({
  children,
  error = false,
}: {
  children:
    ReactNode;

  error?:
    boolean;
}) {
  return (
    <div
      className={`rounded-[13px] p-5 text-center text-sm font-bold ${
        error
          ? "bg-red-50 text-red-700"
          : "bg-white text-[#06142E]/45"
      }`}
    >
      {children}
    </div>
  );
}

function normalizeUrl(
  value:
    string,
) {
  const normalized =
    value.trim();

  if (
    !normalized
  ) {
    return "";
  }

  if (
    /^https?:\/\//i.test(
      normalized,
    )
  ) {
    return normalized;
  }

  return `https://${normalized}`;
}

function buildSponsorStoragePath({
  competitionId,
  sponsorName,
  file,
}: {
  competitionId:
    string;

  sponsorName:
    string;

  file:
    File;
}) {
  const safeCompetitionId =
    sanitizeStorageSegment(
      competitionId,
    );

  const safeSponsorName =
    sanitizeStorageSegment(
      sponsorName,
    );

  const extension =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(
        /[^a-z0-9]/g,
        "",
      ) ||
    "img";

  return `sponsors/${safeCompetitionId}/${Date.now()}-${safeSponsorName}.${extension}`;
}

function sanitizeStorageSegment(
  value:
    string,
) {
  return value
    .trim()
    .toLowerCase()
    .normalize(
      "NFD",
    )
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /[^a-z0-9]+/g,
      "-",
    )
    .replace(
      /^-+|-+$/g,
      "",
    ) ||
    "sponsor";
}

async function safelyDeleteStorageFile(
  storagePath:
    string,
) {
  try {
    await deleteObject(
      ref(
        storage,
        storagePath,
      ),
    );
  } catch (
    currentError
  ) {
    console.warn(
      "Impossibile eliminare il vecchio file sponsor:",
      currentError,
    );
  }
}

function getSocialLabel(
  platform:
    SponsorSocialPlatform,
) {
  switch (
    platform
  ) {
    case "facebook":
      return "Facebook";

    case "tiktok":
      return "TikTok";

    default:
      return "Instagram";
  }
}
