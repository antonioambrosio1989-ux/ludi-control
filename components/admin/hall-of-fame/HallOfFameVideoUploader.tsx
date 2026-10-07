"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import {
  useFirebaseIdToken,
} from "@/src/hooks/useFirebaseIdToken";

import {
  useUploadThing,
} from "@/src/utils/uploadthing";

type UploadedVideo = {
  url: string;
  key: string;
};

type Props = {
  videoUrl?: string;
  posterUrl?: string;
  disabled?: boolean;
  onUploaded: (
    video: UploadedVideo,
  ) => void;
  onRemove?: () => void;
};

const MAX_FILE_SIZE =
  128 * 1024 * 1024;

const ALLOWED_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

export default function HallOfFameVideoUploader({
  videoUrl,
  posterUrl,
  disabled = false,
  onUploaded,
  onRemove,
}: Props) {
  const inputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const [error, setError] =
    useState<string | null>(null);

  const {
    idToken,
    isLoading: isLoadingIdToken,
  } = useFirebaseIdToken();

  const {
    startUpload,
    isUploading,
  } = useUploadThing(
    "hallOfFameVideoUploader",
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

        if (!url || !key) {
          setError(
            "Upload completato senza URL o chiave.",
          );
          return;
        }

        onUploaded({
          url,
          key,
        });

        setError(null);
      },

      onUploadError: (
        currentError,
      ) => {
        console.error(
          "Errore caricamento video Hall of Fame:",
          currentError,
        );

        setError(
          currentError.message ||
            "Impossibile caricare il video.",
        );
      },

      onUploadBegin() {
        setError(null);
      },
    },
  );

  const uploadDisabled =
    disabled ||
    isUploading ||
    isLoadingIdToken ||
    !idToken;

  function openFilePicker() {
    if (uploadDisabled) {
      return;
    }

    inputRef.current?.click();
  }

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    setError(null);

    if (
      !ALLOWED_TYPES.includes(
        file.type,
      )
    ) {
      setError(
        "Formato non valido. Usa MP4, WebM o MOV.",
      );
      return;
    }

    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      setError(
        "Il video non può superare 128 MB.",
      );
      return;
    }

    if (!idToken) {
      setError(
        "Sessione amministratore non disponibile.",
      );
      return;
    }

    try {
      const result =
        await startUpload([
          file,
        ]);

      if (
        !result ||
        result.length === 0
      ) {
        throw new Error(
          "Upload non completato.",
        );
      }
    } catch (currentError) {
      console.error(
        "Errore upload video Hall of Fame:",
        currentError,
      );

      setError(
        currentError instanceof Error
          ? currentError.message
          : "Impossibile caricare il video.",
      );
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        disabled={uploadDisabled}
        onChange={(event) => {
          void handleFileChange(
            event,
          );
        }}
        className="hidden"
      />

      <div className="space-y-4">
        {videoUrl ? (
          <div className="overflow-hidden rounded-[16px] border border-[#06142E]/10">
            <div
              className="relative bg-[#06142E]"
              style={{ aspectRatio: "4 / 5" }}
            >
              <video
                src={videoUrl}
                poster={posterUrl || undefined}
                controls
                playsInline
                preload="metadata"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 bg-white p-3">
              <button
                type="button"
                disabled={uploadDisabled}
                onClick={openFilePicker}
                className="rounded-[10px] bg-[#06142E] px-3 py-2 text-xs font-black text-white disabled:opacity-50"
              >
                {isUploading
                  ? "Caricamento..."
                  : "Sostituisci"}
              </button>

              {onRemove && (
                <button
                  type="button"
                  disabled={disabled || isUploading}
                  onClick={onRemove}
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
              Carica il video del premio
            </p>

            <button
              type="button"
              disabled={uploadDisabled}
              onClick={openFilePicker}
              className="rounded-[12px] bg-[#0B5FFF] px-5 py-3 text-sm font-black text-white transition hover:bg-[#084bd1] disabled:opacity-50"
            >
              {isUploading
                ? "Caricamento..."
                : isLoadingIdToken
                  ? "Autenticazione..."
                  : "Seleziona video"}
            </button>

            <p className="mt-3 text-xs font-bold text-[#06142E]/40">
              MP4, WebM o MOV – massimo 128 MB
            </p>
          </div>
        )}

        {!isLoadingIdToken &&
          !idToken && (
            <div className="rounded-[12px] border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-bold text-amber-800">
                Sessione amministratore non disponibile. Effettua nuovamente l&apos;accesso per caricare video.
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
    </>
  );
}
