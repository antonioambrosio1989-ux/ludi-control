"use client";

import Image from "next/image";
import {
  useEffect,
  useState,
} from "react";

import {
  getDefaultFutCardLayout,
  getFutCardTextColor,
} from "@/src/application/fut/FutCardLayoutDefaults";

import type {
  FutCardResolution,
} from "@/src/application/fut/FutCardResolver";

import {
  FirebaseFutCardLayoutRepository,
} from "@/src/services/fut/FirebaseFutCardLayoutRepository";

import type {
  FutCardElementLayout,
  FutCardLayout,
} from "@/src/types/FutCardLayout";

const PLAYER_PLACEHOLDER_URL =
  "/players/player-placeholder.png";

type Props = {
  card: FutCardResolution;
  rating: number;
  playerName: string;
  playerPhotoUrl?: string | null;
  role?: string;
  teamName?: string;
  teamLogoUrl?: string | null;
  competitionName?: string;
  competitionLogoUrl?: string | null;

  /*
   * Il profilo usa il comportamento storico.
   * BUILD XI può passare un layout condiviso e la variante compact,
   * evitando una subscription Firestore per ogni card visualizzata.
   */
  layoutOverride?: FutCardLayout;
  variant?: "profile" | "compact";
  priority?: boolean;
};

export default function FutPlayerCard({
  card,
  rating,
  playerName,
  playerPhotoUrl,
  role,
  teamName,
  teamLogoUrl,
  competitionName,
  competitionLogoUrl,
  layoutOverride,
  variant = "profile",
  priority,
}: Props) {
  const [
    internalLayout,
    setInternalLayout,
  ] =
    useState<
      FutCardLayout
    >(
      () =>
        getDefaultFutCardLayout(),
    );

  useEffect(() => {
    if (layoutOverride) {
      return;
    }

    return FirebaseFutCardLayoutRepository.subscribe(
      setInternalLayout,
    );
  }, [
    layoutOverride,
  ]);

  const layout =
    layoutOverride ??
    internalLayout;

  const displayRole =
    getFutRoleLabel(
      role,
    );

  const playerImageUrl =
    playerPhotoUrl?.trim() ||
    PLAYER_PLACEHOLDER_URL;

  const textColor =
    getFutCardTextColor(
      card.template,
    );

  return (
    <section
      className="flex justify-center"
      style={
        variant ===
        "profile"
          ? {
              marginTop:
                "-40px",
              marginBottom:
                "0px",
            }
          : undefined
      }
    >
      <div
        className={
          variant ===
          "profile"
            ? "relative w-full max-w-[250px]"
            : "relative w-full"
        }
        style={{
          aspectRatio:
            "3 / 4",
          containerType:
            "inline-size",
        }}
      >
        <Image
          src={
            card.imageUrl
          }
          alt={`Carta FUT ${playerName}`}
          fill
          priority={
            priority ??
            variant ===
              "profile"
          }
          unoptimized
          sizes={
            variant ===
            "profile"
              ? "310px"
              : "160px"
          }
          className="pointer-events-none select-none object-contain"
        />

        <FutTextElement
          layout={
            layout.elements.rating
          }
          textColor={
            textColor
          }
          className="font-black leading-none"
        >
          {Math.round(
            rating,
          )}
        </FutTextElement>

        <FutTextElement
          layout={
            layout.elements.role
          }
          textColor={
            textColor
          }
          className="font-black uppercase tracking-[0.08em]"
        >
          {
            displayRole
          }
        </FutTextElement>

        <div
          className="absolute z-[5] overflow-hidden"
          style={
            getElementStyle(
              layout.elements.photo,
            )
          }
        >
          <Image
            src={
              playerImageUrl
            }
            alt={
              playerName
            }
            fill
            unoptimized
            sizes="180px"
            className="object-contain object-bottom"
          />
        </div>

        <FutTextElement
          layout={
            layout.elements.name
          }
          textColor={
            textColor
          }
          className="truncate font-black uppercase tracking-[-0.02em]"
        >
          {
            playerName
          }
        </FutTextElement>

        <div
          className="absolute z-10 flex items-center justify-center"
          style={
            getElementStyle(
              layout.elements.nationality,
            )
          }
          title="Italia"
        >
          <ItalyFlag />
        </div>

        <div
          className="absolute z-10"
          style={
            getElementStyle(
              layout.elements.competitionLogo,
            )
          }
        >
          <LogoBubble
            imageUrl={
              competitionLogoUrl
            }
            fallbackText={
              getCompetitionInitials(
                competitionName,
              )
            }
            alt={
              competitionName
                ? `Logo ${competitionName}`
                : "Logo competizione"
            }
            textColor={
              textColor
            }
          />
        </div>

        <div
          className="absolute z-10"
          style={
            getElementStyle(
              layout.elements.teamLogo,
            )
          }
        >
          <LogoBubble
            imageUrl={
              teamLogoUrl
            }
            fallbackText={
              getCompetitionInitials(
                teamName,
              )
            }
            alt={
              teamName
                ? `Logo ${teamName}`
                : "Logo squadra"
            }
            textColor={
              textColor
            }
          />
        </div>
      </div>
    </section>
  );
}

function FutTextElement({
  layout,
  textColor,
  className,
  children,
}: {
  layout:
    FutCardElementLayout;

  textColor:
    string;

  className:
    string;

  children:
    React.ReactNode;
}) {
  return (
    <div
      className={`absolute z-10 flex items-center justify-center text-center ${className}`}
      style={{
        ...getElementStyle(
          layout,
        ),

        color:
          textColor,

        fontSize:
          layout.fontSize ===
            undefined
            ? undefined
            : `${(
                layout.fontSize /
                310
              ) *
              100}cqw`,
      }}
    >
      {
        children
      }
    </div>
  );
}

function ItalyFlag() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div
        className="flex overflow-hidden"
        style={{
          width:
            "10.5cqw",

          aspectRatio:
            "3 / 2",
        }}
      >
        <div
          className="h-full flex-1"
          style={{
            backgroundColor:
              "#009246",
          }}
        />

        <div
          className="h-full flex-1"
          style={{
            backgroundColor:
              "#FFFFFF",
          }}
        />

        <div
          className="h-full flex-1"
          style={{
            backgroundColor:
              "#CE2B37",
          }}
        />
      </div>
    </div>
  );
}

function LogoBubble({
  imageUrl,
  fallbackText,
  alt,
  textColor,
}: {
  imageUrl?: string | null;
  fallbackText: string;
  alt: string;
  textColor: string;
}) {
  if (
    !imageUrl?.trim()
  ) {
    return (
      <div
        className="flex h-full w-full items-center justify-center p-1 text-[2.6cqw] font-black uppercase"
        style={{
          color:
            textColor,
        }}
      >
        {
          fallbackText
        }
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Image
        src={
          imageUrl
        }
        alt={
          alt
        }
        fill
        unoptimized
        sizes="48px"
        className="object-contain p-[10%]"
      />
    </div>
  );
}

function getElementStyle(
  layout:
    FutCardElementLayout,
) {
  return {
    left:
      `${layout.x}%`,

    top:
      `${layout.y}%`,

    width:
      `${layout.width}%`,

    height:
      `${layout.height}%`,
  };
}

function getFutRoleLabel(
  role?: string,
) {
  const normalized =
    role
      ?.trim()
      .toLocaleLowerCase(
        "it",
      ) ?? "";

  if (
    normalized.includes(
      "port",
    )
  ) {
    return "POR";
  }

  if (
    normalized.includes(
      "dif",
    )
  ) {
    return "DIF";
  }

  if (
    normalized.includes(
      "att",
    )
  ) {
    return "ATT";
  }

  return "PL";
}

function getCompetitionInitials(
  value?: string,
) {
  const words =
    value
      ?.trim()
      .split(/\s+/)
      .filter(Boolean) ??
    [];

  if (
    words.length ===
    0
  ) {
    return "LUDI";
  }

  return words
    .slice(
      0,
      3,
    )
    .map(
      (
        word,
      ) =>
        word[0],
    )
    .join("")
    .toUpperCase();
}
