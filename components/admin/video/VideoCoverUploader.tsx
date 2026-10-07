"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import Image from "next/image";

import {
  useFirebaseIdToken,
} from "@/src/hooks/useFirebaseIdToken";

import {
  useUploadThing,
} from "@/src/utils/uploadthing";

type Props = {
  value?: string;

  onChange: (
    url: string,
    key?: string,
  ) => void;

  onRemove: () => void;
};

const MAX_FILE_SIZE =
  5 * 1024 * 1024;

const TARGET_RATIO =
  16 / 9;

/*
 * Piccola tolleranza per immagini
 * esportate con dimensioni non
 * perfettamente identiche al 16:9.
 */
const RATIO_TOLERANCE =
  0.025;

export default function VideoCoverUploader({
  value,
  onChange,
  onRemove,
}: Props) {
  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null,
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

  /*
   * ==========================================================
   * FIREBASE AUTH
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
      "VideoCoverUploader",
      {
        headers: () => ({
          ...(idToken
            ? {
                Authorization:
                  `Bearer ${idToken}`,
              }
            : {}),
        }),

        onClientUploadComplete(
          files,
        ) {
          const uploadedFile =
            files?.[0];

          if (!uploadedFile) {
            setError(
              "Il caricamento non ha restituito il file.",
            );

            return;
          }

          const url =
            uploadedFile.ufsUrl ??
            uploadedFile.url;

          if (!url) {
            setError(
              "Impossibile recuperare l'URL della copertina.",
            );

            return;
          }

          onChange(
            url,
            uploadedFile.key,
          );

          setError(
            null,
          );
        },

        onUploadError(
          uploadError,
        ) {
          console.error(
            "Errore caricamento copertina:",
            uploadError,
          );

          setError(
            uploadError.message,
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
   * FILE CHANGE
   * ==========================================================
   */

  async function handleFileChange(
    event:
      ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0];

    event.target.value =
      "";

    if (!file) {
      return;
    }

    setError(
      null,
    );

    /*
     * ========================================================
     * AUTH
     * ========================================================
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

    /*
     * ========================================================
     * TIPO FILE
     * ========================================================
     */

    if (
      !file.type.startsWith(
        "image/",
      )
    ) {
      setError(
        "Seleziona un'immagine JPG, PNG o WebP.",
      );

      return;
    }

    /*
     * ========================================================
     * DIMENSIONE FILE
     * ========================================================
     */

    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      setError(
        "La copertina non può superare 16 MB.",
      );

      return;
    }

    try {
      /*
       * ======================================================
       * DIMENSIONI IMMAGINE
       * ======================================================
       */

      const dimensions =
        await readImageDimensions(
          file,
        );

      const ratio =
        dimensions.width /
        dimensions.height;

      /*
       * ======================================================
       * CONTROLLO 16:9
       * ======================================================
       */

      if (
        Math.abs(
          ratio -
          TARGET_RATIO,
        ) >
        RATIO_TOLERANCE
      ) {
        setError(
          `La copertina deve essere in formato 16:9. Immagine selezionata: ${dimensions.width}×${dimensions.height}.`,
        );

        return;
      }

      /*
       * ======================================================
       * UPLOAD
       * ======================================================
       */

      const result =
        await startUpload([
          file,
        ]);

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
        "Errore preparazione copertina:",
        currentError,
      );

      setError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile caricare la copertina.",
      );
    }
  }

  /*
   * ==========================================================
   * STATO DISPONIBILITÀ UPLOAD
   * ==========================================================
   */

  const uploadDisabled =
    isUploading ||
    isLoadingIdToken ||
    !idToken;

  return (
    <div>
      <p className="mb-2 text-xs font-black uppercase text-[#06142E]/50">
        Copertina personalizzata
      </p>

      <div className="rounded-[18px] border border-dashed border-[#06142E]/15 bg-[#06142E]/[0.03] p-4">
        {value ? (
          <div className="relative aspect-video overflow-hidden rounded-[15px] bg-black">
            <Image
              src={
                value
              }
              alt="Copertina video"
              fill
              unoptimized
              sizes="(max-width: 768px) 100vw, 640px"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-[15px] bg-[#06142E]/5">
            <div className="text-center">
              <p className="text-3xl">
                🎬
              </p>

              <p className="mt-2 text-xs font-black uppercase text-[#06142E]/40">
                Copertina 16:9
              </p>
            </div>
          </div>
        )}

        <input
          ref={
            fileInputRef
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

        <button
          type="button"
          disabled={
            uploadDisabled
          }
          onClick={() => {
            fileInputRef.current
              ?.click();
          }}
          className="mt-4 h-12 w-full rounded-[13px] bg-[#06142E] text-xs font-black uppercase text-white disabled:opacity-40"
        >
          {isUploading
            ? "Caricamento..."
            : isLoadingIdToken
              ? "Autenticazione..."
              : value
                ? "Cambia copertina"
                : "Carica copertina"}
        </button>

        {value && (
          <button
            type="button"
            disabled={
              isUploading
            }
            onClick={
              onRemove
            }
            className="mt-3 w-full text-xs font-black uppercase text-red-600"
          >
            Rimuovi copertina
          </button>
        )}

        <p className="mt-3 text-center text-[10px] font-bold uppercase text-[#06142E]/35">
          JPG, PNG o WebP · 16:9 · massimo 16 MB
        </p>
      </div>

      {!isLoadingIdToken &&
        !idToken && (
          <div className="mt-3 rounded-[13px] border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-bold text-amber-800">
              Sessione amministratore non disponibile.
              Effettua nuovamente l&apos;accesso per caricare immagini.
            </p>
          </div>
        )}

      {error && (
        <div className="mt-3 rounded-[13px] border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-bold text-red-700">
            {error}
          </p>
        </div>
      )}
    </div>
  );
}

function readImageDimensions(
  file: File,
): Promise<{
  width: number;
  height: number;
}> {
  return new Promise(
    (
      resolve,
      reject,
    ) => {
      const objectUrl =
        URL.createObjectURL(
          file,
        );

      const image =
        new window.Image();

      image.onload =
        () => {
          const width =
            image.naturalWidth;

          const height =
            image.naturalHeight;

          URL.revokeObjectURL(
            objectUrl,
          );

          if (
            width <= 0 ||
            height <= 0
          ) {
            reject(
              new Error(
                "Dimensioni immagine non valide.",
              ),
            );

            return;
          }

          resolve({
            width,
            height,
          });
        };

      image.onerror =
        () => {
          URL.revokeObjectURL(
            objectUrl,
          );

          reject(
            new Error(
              "Impossibile leggere l'immagine.",
            ),
          );
        };

      image.src =
        objectUrl;
    },
  );
}