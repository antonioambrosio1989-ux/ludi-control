"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import {
  useFirebaseIdToken,
} from "@/src/hooks/useFirebaseIdToken";

import Image from "next/image";

import {
  useUploadThing,
} from "@/src/utils/uploadthing";

import ImageEditor from "@/components/admin/images/ImageEditor";

type Props = {
  value?: string;

  playerName?: string;

  label?: string;

  enableEditor?: boolean;

  defaultAspectRatio?: "1:1" | "4:5" | "9:16";

  onChange: (
    url: string,
  ) => void;

  onRemove: () => void;
};

export default function PlayerPhotoUploader({
  value,
  playerName,
  label = "Foto giocatore",
  enableEditor = false,
  defaultAspectRatio = "1:1",
  onChange,
  onRemove,
}: Props) {
  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const [
    selectedFile,
    setSelectedFile,
  ] = useState<File | null>(
    null,
  );

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  const {
  idToken,
  isLoading: isLoadingIdToken,
} = useFirebaseIdToken();

  const {
    startUpload,
    isUploading,
  } = useUploadThing(
  "playerPhotoUploader",
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
            "Il caricamento è terminato senza restituire il file.",
          );

          return;
        }

        const url =
          uploadedFile.ufsUrl ??
          uploadedFile.url;

        if (!url) {
          setError(
            "Impossibile recuperare l'URL della foto.",
          );

          return;
        }

        onChange(
          url,
        );

        setSelectedFile(
          null,
        );

        setError(
          null,
        );
      },

      onUploadError(
        uploadError,
      ) {
        console.error(
          "Errore caricamento foto:",
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

  async function uploadPhoto(
    file: File,
  ) {
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
    if (
      file.size >
      16 * 1024 * 1024
    ) {
      setError(
        "La foto elaborata supera il limite di 16 MB.",
      );

      return;
    }

    try {
      await startUpload([
        file,
      ]);
    } catch (currentError) {
      console.error(
        "Errore upload foto:",
        currentError,
      );

      setError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile caricare la foto.",
      );
    }
  }

  function handleFileSelected(
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

    if (
      file.size >
      16 * 1024 * 1024
    ) {
      setError(
        "La foto supera il limite massimo di 16 MB.",
      );

      return;
    }

    if (
      enableEditor
    ) {
      setSelectedFile(
        file,
      );

      return;
    }

    void uploadPhoto(
      file,
    );
  }

  return (
    <div>
      <p className="mb-2 text-xs font-black uppercase text-[#06142E]/60">
        {label}
      </p>

      <div className="rounded-[18px] border border-dashed border-[#06142E]/20 bg-[#06142E]/[0.03] p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm">
            {value ? (
              <Image
                src={
                  value
                }
                alt={
                  playerName
                    ? `Foto di ${playerName}`
                    : label
                }
                fill
                unoptimized
                sizes="96px"
                className="object-cover"
              />
            ) : (
              <span className="text-4xl">
                👤
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-[#06142E]">
              {value
                ? "Foto caricata"
                : "Aggiungi una foto"}
            </p>

            <p className="mt-1 text-xs font-bold leading-5 text-[#06142E]/60">
              JPG, PNG o WebP.
              Massimo 16 MB.
            </p>

            {enableEditor && (
              <p className="mt-1 text-[10px] font-bold leading-4 text-[#06142E]/40">
                Ritaglio 1:1, 4:5 o
                9:16 · zoom ·
                rimozione sfondo.
              </p>
            )}

            {value && (
              <button
                type="button"
                onClick={
                  onRemove
                }
                className="mt-3 text-xs font-black uppercase text-red-600"
              >
                Rimuovi foto
              </button>
            )}
          </div>
        </div>

        <input
          ref={
            fileInputRef
          }
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={
            handleFileSelected
          }
          className="hidden"
        />

        <button
          type="button"
          disabled={
            isUploading ||
            isLoadingIdToken ||
            !idToken
          }
          onClick={() => {
            fileInputRef.current
              ?.click();
          }}
          className="mt-4 h-12 w-full rounded-[13px] bg-[#06142E] px-5 text-xs font-black uppercase text-white disabled:cursor-not-allowed disabled:bg-[#06142E]/40"
        >
          {isUploading
            ? "Caricamento..."
            : value
              ? "Cambia foto"
              : "Seleziona foto"}
        </button>

        <p className="mt-2 text-center text-[10px] font-black uppercase text-[#06142E]/40">
          Immagine fino a 16 MB
        </p>
      </div>

      {error && (
        <div className="mt-3 rounded-[13px] border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-bold text-red-700">
            {error}
          </p>
        </div>
      )}

      {selectedFile && (
        <ImageEditor
          file={
            selectedFile
          }
          defaultAspectRatio={defaultAspectRatio}
          onCancel={() => {
            setSelectedFile(
              null,
            );
          }}
          onConfirm={async (
            editedFile: File,
          ) => {
            await uploadPhoto(
              editedFile,
            );

            setSelectedFile(
              null,
            );
          }}
        />
      )}
    </div>
  );
}