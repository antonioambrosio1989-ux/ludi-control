"use client";

import {
  useEffect,
  type ReactNode,
} from "react";

import {
  useCompetition,
} from "@/src/contexts/CompetitionContext";

/*
 * ============================================================
 * COMPETITION THEME
 * ============================================================
 *
 * Espone globalmente i colori della competizione corrente
 * attraverso CSS variables.
 *
 * Tutti i componenti generali dell'app potranno utilizzare:
 *
 * --competition-primary
 * --competition-text
 *
 * Eccezioni:
 * - profilo giocatore
 * - profilo squadra
 *
 * che continueranno a utilizzare i colori della squadra.
 * ============================================================
 */

export function CompetitionTheme({
  children,
}: {
  children:
    ReactNode;
}) {
  const {
    primaryColor,
    textColor,
  } =
    useCompetition();

  useEffect(
    () => {
      const root =
        document.documentElement;

      root.style.setProperty(
        "--competition-primary",
        primaryColor,
      );

      root.style.setProperty(
        "--competition-text",
        textColor,
      );
    },

    [
      primaryColor,
      textColor,
    ],
  );

  return (
    <>
      {children}
    </>
  );
}