"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { NewsItem } from "@/src/types/NewsItem";
import { getNewsHref, getNewsImage, getNewsLabel, NEWSPAPER_IMAGE, PLAYER_PLACEHOLDER, TEAM_PLACEHOLDER } from "@/src/domain/news/EditorialNews";

export function NewsPicture({ item, large = false }: { item: NewsItem; large?: boolean }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const source = getNewsImage(item);
  const src = failedSource === source ? (item.newsType === "risultato" ? PLAYER_PLACEHOLDER : item.newsType === "intervista" ? TEAM_PLACEHOLDER : NEWSPAPER_IMAGE) : source;
  return (
    <div className={`relative aspect-square shrink-0 overflow-hidden rounded-xl bg-[#eef1f5] ${large ? "w-full max-w-sm" : "w-20 sm:w-20"}`}>
      <Image src={src} alt={item.newsType === "risultato" ? "Migliore in campo" : item.newsType === "intervista" ? "Scudetto della squadra" : "Immagine della news"} fill unoptimized sizes={large ? "384px" : "128px"} className={item.newsType === "intervista" ? "object-contain p-2" : "object-cover"} onError={() => setFailedSource(source)} />
    </div>
  );
}

export default function NewsCard({
  item,
  showImage = true,
  light = false,
}: {
  item: NewsItem;
  showImage?: boolean;
  light?: boolean;
}) {
  const href = getNewsHref(item);

  const articleTheme = light
    ? href
      ? "bg-[#06142E] text-white"
      : "bg-white text-[#06142E]"
    : href
      ? "bg-[#06142E] text-white"
      : "bg-[var(--competition-primary)] text-[var(--competition-text)]";

  const labelTheme = light
    ? href
      ? "bg-white/15 text-white"
      : "bg-[#06142E]/[0.06] text-[#06142E]"
    : href
      ? "bg-white/15"
      : "bg-[var(--competition-text)]/12";

  const content = (
    <article
      className={`relative overflow-hidden rounded-[14px] p-3 shadow-[0_12px_28px_rgba(6,20,46,0.12)] ${articleTheme}`}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -right-20 -top-5 h-75 w-75 rotate-35 rounded-[28px] ${
          light
            ? href
              ? "bg-white/[0.07]"
              : "bg-[#06142E]/[0.025]"
            : "bg-white/5"
        }`}
      />

      <div className="relative flex items-start gap-3">
        {showImage && !href && <NewsPicture item={item} />}

        <div className="min-w-0 flex-1">
          <h2
            className={`inline-flex rounded-[8px] px-2 py-1 text-[10px] font-black uppercase tracking-wide ${labelTheme}`}
          >
            {getNewsLabel(item)}
          </h2>

          <p className="mx-1 mt-2 whitespace-pre-wrap break-words text-[14px] italic leading-tight">
            {item.content}
          </p>
        </div>
      </div>
    </article>
  );

  return href ? (
    <Link
      href={href}
      className={`block rounded-[14px] transition active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-4 ${
        light
          ? "focus-visible:outline-[#06142E]"
          : "focus-visible:outline-red-600"
      }`}
    >
      {content}
    </Link>
  ) : (
    content
  );
}
