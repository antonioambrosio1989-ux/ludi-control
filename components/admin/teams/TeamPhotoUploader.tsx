"use client";

import {
  useState,
} from "react";

import Image from "next/image";

import {
  useFirebaseIdToken,
} from "@/src/hooks/useFirebaseIdToken";

import {
  UploadButton,
} from "@/src/utils/uploadthing";

type Props = {
  value?: string;

  onChange: (
    url: string,
  ) => void;

  onRemove: () => void;
};

export default function TeamPhotoUploader({
  value,
  onChange,
  onRemove,
}: Props) {
  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const {
    idToken,
    isLoading:
      isLoadingIdToken,
  } =
    useFirebaseIdToken();

  return (
    <div>
      <p className="mb-2 text-xs font-black uppercase text-[#06142E]/50">
        Foto squadra
      </p>

      <div className="rounded-[18px] border border-dashed border-[#06142E]/20 bg-[#06142E]/[0.03] p-4">
        {value ? (
          <div>
            <div className="relative aspect-[3/2] w-full overflow-hidden rounded-[16px] bg-white shadow-sm">
              <Image
                src={
                  value
                }
                alt="Anteprima foto squadra"
                fill
                unoptimized
                sizes="430px"
                className="object-cover"
              />
            </div>

            <div className="mt-3">
              <p className="text-sm font-black text-[#06142E]">
                Foto squadra caricata
              </p>

              <p className="mt-1 text-xs font-bold leading-5 text-[#06142E]/45">
                Anteprima in formato 3:2 landscape.
                L&apos;immagine verrà mostrata nello stesso formato nella pagina squadra.
              </p>

              <button
                type="button"
                onClick={
                  onRemove
                }
                className="mt-3 text-xs font-black uppercase text-red-600"
              >
                Rimuovi foto
              </button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-40 flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-[18px] bg-white text-3xl shadow-sm">
              📸
            </div>

            <p className="text-sm font-black text-[#06142E]">
              Carica foto squadra
            </p>

            <p className="mt-1 max-w-xs text-xs font-bold leading-5 text-[#06142E]/45">
              PNG, JPG o WebP.
              Formato visualizzato 3:2 landscape.
              Dimensione massima 16 MB.
            </p>
          </div>
        )}

        <div className="mt-4 flex justify-center">
          {isLoadingIdToken ? (
            <button
              type="button"
              disabled
              className="h-12 w-full rounded-[13px] bg-[#06142E]/40 px-5 text-xs font-black uppercase text-white"
            >
              Autenticazione...
            </button>
          ) : !idToken ? (
            <button
              type="button"
              disabled
              className="h-12 w-full rounded-[13px] bg-[#06142E]/40 px-5 text-xs font-black uppercase text-white"
            >
              Sessione non disponibile
            </button>
          ) : (
            <UploadButton
              endpoint="teamPhotoUploader"

              headers={() => ({
                Authorization:
                  `Bearer ${idToken}`,
              })}

              onClientUploadComplete={(
                files,
              ) => {
                const uploadedFile =
                  files?.[0];

                if (
                  !uploadedFile
                ) {
                  setError(
                    "Upload completato, ma non è stato restituito alcun file.",
                  );

                  return;
                }

                const url =
                  uploadedFile.ufsUrl ??
                  uploadedFile.url;

                if (
                  !url
                ) {
                  setError(
                    "Impossibile recuperare l’URL della foto squadra.",
                  );

                  return;
                }

                onChange(
                  url,
                );

                setError(
                  null,
                );
              }}

              onUploadError={(
                uploadError,
              ) => {
                console.error(
                  "Errore upload foto squadra:",
                  uploadError,
                );

                setError(
                  uploadError.message,
                );
              }}

              onUploadBegin={() => {
                setError(
                  null,
                );
              }}

              appearance={{
                container:
                  "w-full",

                button:
                  "ut-ready:bg-[#06142E] ut-uploading:bg-[#06142E]/60 h-12 w-full rounded-[13px] px-5 text-xs font-black uppercase text-white after:bg-white/20",

                allowedContent:
                  "mt-2 text-[10px] font-bold uppercase text-[#06142E]/35",
              }}

              content={{
                button({
                  ready,
                  isUploading,
                }) {
                  if (
                    isUploading
                  ) {
                    return "Caricamento...";
                  }

                  if (
                    !ready
                  ) {
                    return "Preparazione...";
                  }

                  return value
                    ? "Cambia foto squadra"
                    : "Seleziona foto squadra";
                },

                allowedContent:
                  "Immagine fino a 16 MB",
              }}
            />
          )}
        </div>
      </div>

      {!isLoadingIdToken &&
        !idToken && (
          <div className="mt-3 rounded-[13px] border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-bold text-amber-800">
              Sessione amministratore non disponibile.
              Effettua nuovamente l&apos;accesso per caricare la foto squadra.
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
