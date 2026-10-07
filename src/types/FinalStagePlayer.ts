/*
 * ============================================================
 * FINAL STAGE PLAYER
 * ============================================================
 */

export type FinalStagePlayer = {
  id: string;

  seasonId: string;

  teamId: string;
  playerId: string;

  role:
    | "Portiere"
    | "Difensore"
    | "Attaccante";

  shirtNumber?: number;

  createdAt?: unknown;
  updatedAt?: unknown;
};

/*
 * ============================================================
 * CREATE
 * ============================================================
 */

export type CreateFinalStagePlayerInput = {
  seasonId: string;

  teamId: string;
  playerId: string;

  role:
    | "Portiere"
    | "Difensore"
    | "Attaccante";

  shirtNumber?: number;
};

/*
 * ============================================================
 * UPDATE
 * ============================================================
 */

export type UpdateFinalStagePlayerInput = {
  finalStagePlayerId: string;

  teamId: string;

  role:
    | "Portiere"
    | "Difensore"
    | "Attaccante";

  shirtNumber?: number;
};