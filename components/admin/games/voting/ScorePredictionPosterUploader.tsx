"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";

import ImageEditor from "@/components/admin/images/ImageEditor";
import { useFirebaseIdToken } from "@/src/hooks/useFirebaseIdToken";
import { useUploadThing } from "@/src/utils/uploadthing";

const MAX_FILE_SIZE = 16 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function ScorePredictionPosterUploader({
  value,
  disabled = false,
  onChange,
}: {
  value?: string;
  disabled?: boolean;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { idToken, isLoading: isLoadingIdToken } = useFirebaseIdToken();

  const { startUpload, isUploading } = useUploadThing("playerPhotoUploader", {
    headers: () => ({
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    }),
    onClientUploadComplete(files) {
      const uploadedFile = files?.[0];
      const url = uploadedFile?.ufsUrl ?? uploadedFile?.url;
      if (!url) {
        setError("Upload completato senza URL dell'immagine.");
        return;
      }
      onChange(url);
      setSelectedFile(null);
      setError(null);
    },
    onUploadError(currentError) {
      setError(currentError.message || "Impossibile caricare la locandina.");
    },
    onUploadBegin() {
      setError(null);
    },
  });

  const uploadDisabled = disabled || isUploading || isLoadingIdToken || !idToken;

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Formato non valido. Usa JPG, PNG o WebP.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("L'immagine non può superare 16 MB.");
      return;
    }
    setSelectedFile(file);
  }

  async function uploadEditedImage(file: File) {
    if (!idToken) {
      setError("Sessione amministratore non disponibile.");
      return;
    }
    try {
      await startUpload([file]);
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "Impossibile caricare la locandina.");
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        disabled={uploadDisabled}
        onChange={handleFileChange}
      />

      <div className="mt-3 rounded-[18px] border border-[#06142E]/10 bg-[#F5F5F2] p-4">
        {value ? (
          <div className="mx-auto w-full max-w-[260px] overflow-hidden rounded-[18px] bg-[#06142E] shadow-[0_12px_28px_rgba(6,20,46,0.16)]">
            <div className="aspect-[9/16]">
              <img src={value} alt="Locandina Score Prediction" className="h-full w-full object-cover" />
            </div>
          </div>
        ) : (
          <div className="mx-auto flex aspect-[9/16] w-full max-w-[260px] items-center justify-center rounded-[18px] border-2 border-dashed border-[#06142E]/15 bg-white">
            <div className="px-5 text-center">
              <ImagePlus className="mx-auto h-8 w-8 text-[#06142E]/25" />
              <p className="mt-3 text-xs font-black uppercase text-[#06142E]/40">Locandina 9:16</p>
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={uploadDisabled}
            onClick={() => inputRef.current?.click()}
            className="flex min-h-11 items-center justify-center gap-2 rounded-[12px] bg-[#06142E] px-4 text-[10px] font-black uppercase text-white disabled:opacity-35"
          >
            {isUploading ? <LoaderCircle size={16} className="animate-spin" /> : <ImagePlus size={16} />}
            {isUploading ? "Caricamento..." : value ? "Cambia locandina" : "Carica locandina"}
          </button>

          {value ? (
            <button
              type="button"
              disabled={disabled || isUploading}
              onClick={() => onChange("")}
              className="flex min-h-11 items-center justify-center gap-2 rounded-[12px] bg-red-50 px-4 text-[10px] font-black uppercase text-red-700 disabled:opacity-35"
            >
              <Trash2 size={16} /> Rimuovi
            </button>
          ) : null}
        </div>

        <p className="mt-3 text-center text-[10px] font-bold leading-4 text-[#06142E]/40">
          Formato fisso 9:16 · ritaglio 1080×1920 · JPG, PNG o WebP.
        </p>
        {error ? <p className="mt-3 text-center text-xs font-bold text-red-600">{error}</p> : null}
      </div>

      {selectedFile ? (
        <ImageEditor
          file={selectedFile}
          title="Locandina Score Prediction"
          label="Formato 9:16"
          defaultAspectRatio="9:16"
          allowedAspectRatios={["9:16"]}
          outputWidth={1080}
          onCancel={() => setSelectedFile(null)}
          onConfirm={uploadEditedImage}
        />
      ) : null}
    </>
  );
}
