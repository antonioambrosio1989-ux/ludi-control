"use client";

import { useState } from "react";

type Props = {
  logoUrl?: string;
  teamName?: string;
  size?: number;
  className?: string;
};

export default function TeamLogo({
  logoUrl,
  teamName = "Squadra",
  size = 48,
  className = "",
}: Props) {
  const [imageError, setImageError] =
    useState(false);

  const initial =
    teamName.trim().charAt(0).toUpperCase() ||
    "S";

  const style = {
    width: size,
    height: size,
  };

  if (logoUrl && !imageError) {
    return (
      <div
        style={style}
        className={`flex flex-shrink-0 items-center justify-center overflow-hidden ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={`Logo ${teamName}`}
          className="h-full w-full object-contain"
          onError={() => {
            setImageError(true);
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={style}
      title={teamName}
      className={`flex flex-shrink-0 items-center justify-center rounded-full bg-[#0B5B78] text-base font-black uppercase text-white ${className}`}
    >
      {initial}
    </div>
  );
}