"use client";
import { useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { useFirebaseIdToken } from "@/src/hooks/useFirebaseIdToken";
import { useUploadThing } from "@/src/utils/uploadthing";

type Props = { label: string; imageUrl?: string; disabled?: boolean; onUploaded: (image: {url:string; key:string}) => void; onRemove?: () => void };

export default function LudiWeekImageUploader({label,imageUrl,disabled=false,onUploaded,onRemove}:Props){
 const inputRef=useRef<HTMLInputElement|null>(null); const [error,setError]=useState<string|null>(null);
 const {idToken,isLoading:isLoadingIdToken}=useFirebaseIdToken();
 const {startUpload,isUploading}=useUploadThing("ludiWeekImageUploader",{
  headers:()=>{
    const headers:Record<string,string>={};
    if(idToken){
      headers.Authorization=`Bearer ${idToken}`;
    }
    return headers;
  },
  onUploadError:e=>setError(e.message)
});
 const blocked=disabled||isUploading||isLoadingIdToken||!idToken;
 async function onChange(e:ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];e.target.value="";if(!file)return;if(!["image/jpeg","image/png","image/webp"].includes(file.type)){setError("Usa JPG, PNG o WebP.");return} if(file.size>16*1024*1024){setError("Massimo 16 MB.");return} try{setError(null);const files=await startUpload([file]);const f=files?.[0];if(!f)throw new Error("Upload non riuscito.");const d=f.serverData as {url?:string;key?:string}|undefined;const url=d?.url??f.ufsUrl??f.url;const key=d?.key??f.key;if(!url||!key)throw new Error("URL non disponibile.");onUploaded({url,key});}catch(err){setError(err instanceof Error?err.message:"Upload non riuscito.")}}
 return <div className="rounded-[16px] border border-[#06142E]/10 bg-white p-4"><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={blocked} onChange={onChange}/><p className="text-xs font-black uppercase text-[#06142E]">{label}</p>{imageUrl?<><div className="relative mt-3 aspect-[4/5] overflow-hidden rounded-[13px] bg-[#06142E]/5"><Image src={imageUrl} alt={label} fill unoptimized className="object-cover"/></div><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={blocked} onClick={()=>inputRef.current?.click()} className="rounded-[10px] bg-[#06142E] px-3 py-2 text-xs font-black text-white disabled:opacity-40">{isUploading?"Caricamento...":"Sostituisci"}</button><button type="button" disabled={disabled||isUploading} onClick={onRemove} className="rounded-[10px] bg-red-50 px-3 py-2 text-xs font-black text-red-700 disabled:opacity-40">Rimuovi</button></div></>:<button type="button" disabled={blocked} onClick={()=>inputRef.current?.click()} className="mt-3 min-h-24 w-full rounded-[13px] border-2 border-dashed border-[#06142E]/15 text-xs font-black text-[#06142E]/55 disabled:opacity-40">{isUploading?"Caricamento...":"Carica immagine"}</button>}{error&&<p className="mt-2 text-xs font-bold text-red-600">{error}</p>}</div>
}
