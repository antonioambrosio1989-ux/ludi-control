"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import Image from "next/image";

import ImageEditor from "@/components/admin/images/ImageEditor";

import {
  useFirebaseIdToken,
} from "@/src/hooks/useFirebaseIdToken";

import {
  useUploadThing,
} from "@/src/utils/uploadthing";

type UploadedImage = {
  url: string;
  key: string;
};

type Props = {
  imageUrl?: string;

  disabled?: boolean;

  onUploaded: (
    image: UploadedImage,
  ) => void;

  onRemove?: () => void;
};

const MAX_FILE_SIZE =
  16 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export default function HallOfFameImageUploader({
  imageUrl,
  disabled = false,
  onUploaded,
  onRemove,
}: Props) {
  const inputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const [
    selectedFile,
    setSelectedFile,
  ] =
    useState<File | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  /*
   * ==========================================================
   * FIREBASE AUTH
   * ==========================================================
   *
   * Recuperiamo il Firebase ID token dell'utente autenticato.
   *
   * Il token viene inviato a UploadThing tramite
   * Authorization: Bearer <token>
   *
   * e verificato lato server dal middleware UploadThing.
   * ==========================================================
   */

  const {
    idToken,
    isLoading:
      isLoadingIdToken,
  } =
    useFirebaseIdToken();

  /*
   * ==========================================================
   * UPLOADTHING
   * ==========================================================
   */

  const {
    startUpload,
    isUploading,
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

        onClientUploadComplete: (
          files,
        ) => {
          const uploadedFile =
            files?.[0];

          if (!uploadedFile) {
            setError(
              "Upload completato senza file.",
            );

            return;
          }

          const serverData =
            uploadedFile.serverData as
              | {
                  url?: string;
                  key?: string;
                }
              | undefined;

          const url =
            serverData?.url ??
            uploadedFile.ufsUrl ??
            uploadedFile.url;

          const key =
            serverData?.key ??
            uploadedFile.key;

          if (
            !url ||
            !key
          ) {
            setError(
              "Upload completato senza URL o chiave.",
            );

            return;
          }

          onUploaded({
            url,
            key,
          });

          setSelectedFile(
            null,
          );

          setError(
            null,
          );
        },

        onUploadError: (
          currentError,
        ) => {
          console.error(
            "Errore caricamento Hall of Fame:",
            currentError,
          );

          setError(
            currentError.message ||
              "Impossibile caricare l’immagine.",
          );
        },

        onUploadBegin() {
          setError(
            null,
          );
        },
      },
    );

  /*
   * ==========================================================
   * FILE PICKER
   * ==========================================================
   */

  function openFilePicker() {
    if (
      disabled ||
      isUploading ||
      isLoadingIdToken ||
      !idToken
    ) {
      return;
    }

    inputRef.current?.click();
  }

  function handleFileChange(
    event:
      ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0];

    /*
     * Permette di selezionare
     * nuovamente lo stesso file.
     */
    event.target.value =
      "";

    if (!file) {
      return;
    }

    setError(
      null,
    );

    if (
      !ALLOWED_TYPES.includes(
        file.type,
      )
    ) {
      setError(
        "Formato non valido. Usa JPG, PNG o WebP.",
      );

      return;
    }

    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      setError(
        "L’immagine non può superare 16 MB.",
      );

      return;
    }

    /*
     * NON carichiamo ancora.
     *
     * Prima apriamo ImageEditor.
     */
    setSelectedFile(
      file,
    );
  }

  /*
   * ==========================================================
   * UPLOAD IMMAGINE MODIFICATA
   * ==========================================================
   */

  async function handleEditedImage(
    editedFile:
      File,
  ) {
    setError(
      null,
    );

    /*
     * Non consentiamo l'upload finché
     * Firebase non ha terminato il controllo
     * della sessione.
     */
    if (
      isLoadingIdToken
    ) {
      setError(
        "Autenticazione in corso. Riprova tra qualche secondo.",
      );

      return;
    }

    if (
      !idToken
    ) {
      setError(
        "Sessione amministratore non disponibile. Effettua nuovamente l'accesso.",
      );

      return;
    }

    try {
      const result =
        await startUpload([
          editedFile,
        ]);

      /*
       * Il risultato definitivo viene
       * comunque gestito da
       * onClientUploadComplete.
       */
      if (
        !result ||
        result.length ===
          0
      ) {
        throw new Error(
          "Upload non completato.",
        );
      }
    } catch (
      currentError
    ) {
      console.error(
        "Errore upload Hall of Fame:",
        currentError,
      );

      setError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile caricare l’immagine.",
      );
    }
  }

  /*
   * ==========================================================
   * STATO DISPONIBILITÀ UPLOAD
   * ==========================================================
   */

  const uploadDisabled =
    disabled ||
    isUploading ||
    isLoadingIdToken ||
    !idToken;

  return (
    <>
      <input
        ref={
          inputRef
        }
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={
          uploadDisabled
        }
        onChange={
          handleFileChange
        }
        className="hidden"
      />

      <div className="space-y-4">
        {imageUrl ? (
          <div className="overflow-hidden rounded-[16px] border border-[#06142E]/10">
            <div className="relative aspect-[4/5] max-h-[520px] bg-[#06142E]">
              <Image
                src={
                  imageUrl
                }
                alt="Immagine Hall of Fame"
                fill
                unoptimized
                sizes="(max-width: 768px) 100vw, 500px"
                className="object-cover"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 bg-white p-3">
              <button
                type="button"
                disabled={
                  uploadDisabled
                }
                onClick={
                  openFilePicker
                }
                className="rounded-[10px] bg-[#06142E] px-3 py-2 text-xs font-black text-white disabled:opacity-50"
              >
                {isUploading
                  ? "Caricamento..."
                  : isLoadingIdToken
                    ? "Autenticazione..."
                    : "Modifica"}
              </button>

              {onRemove && (
                <button
                  type="button"
                  disabled={
                    disabled ||
                    isUploading
                  }
                  onClick={
                    onRemove
                  }
                  className="rounded-[10px] bg-red-50 px-3 py-2 text-xs font-black text-red-700 disabled:opacity-50"
                >
                  Rimuovi
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-[16px] border-2 border-dashed border-[#06142E]/15 bg-[#06142E]/[0.02] p-6 text-center">
            <p className="mb-4 text-sm font-bold text-[#06142E]/50">
              Carica la foto del vincitore
            </p>

            <button
              type="button"
              disabled={
                uploadDisabled
              }
              onClick={
                openFilePicker
              }
              className="rounded-[12px] bg-[#0B5FFF] px-5 py-3 text-sm font-black text-white transition hover:bg-[#084bd1] disabled:opacity-50"
            >
              {isUploading
                ? "Caricamento..."
                : isLoadingIdToken
                  ? "Autenticazione..."
                  : "Seleziona immagine"}
            </button>

            <p className="mt-3 text-xs font-bold text-[#06142E]/40">
              JPG, PNG o WebP – massimo 16 MB
            </p>
          </div>
        )}

        {!isLoadingIdToken &&
          !idToken && (
            <div className="rounded-[12px] border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-bold text-amber-800">
                Sessione amministratore non disponibile.
                Effettua nuovamente l&apos;accesso per caricare immagini.
              </p>
            </div>
          )}

        {error && (
          <div className="rounded-[12px] border border-red-200 bg-red-50 p-3">
            <p className="text-xs font-bold text-red-700">
              {error}
            </p>
          </div>
        )}
      </div>

      {selectedFile && (
        <ImageEditor
          file={
            selectedFile
          }
          label="Hall of Fame"
          title="Modifica immagine vincitore"
          defaultAspectRatio="4:5"
          allowedAspectRatios={[
            "1:1",
            "4:5",
            "16:9",
            "9:16",
          ]}
          outputWidth={
            1080
          }
          onCancel={() => {
            if (
              isUploading
            ) {
              return;
            }

            setSelectedFile(
              null,
            );
          }}
          onConfirm={
            handleEditedImage
          }
        />
      )}
    </>
  );
}