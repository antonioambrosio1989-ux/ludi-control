export type CompetitionStatus =
  | "active"
  | "inactive";

/*
 * ============================================================
 * FUNZIONALITÀ DISPONIBILI
 * ============================================================
 */

export type CompetitionFeatures = {
  ludiTv: boolean;
  ludiWeek: boolean;
  canvaStudio: boolean;
};

/*
 * ============================================================
 * COMPETIZIONE
 * ============================================================
 */

export type Competition = {
  id: string;

  name: string;
  shortName: string;

  status: CompetitionStatus;

  primaryColor?: string;
  secondaryColor?: string;
  textColor?: string;
  logoUrl?: string;

  features: CompetitionFeatures;

  createdAt?: unknown;
  updatedAt?: unknown;
};

/*
 * ============================================================
 * CREAZIONE
 * ============================================================
 */

export type CreateCompetitionInput = {
  id: string;

  name: string;
  shortName: string;

  primaryColor?: string;
  secondaryColor?: string;
  textColor?: string;
  logoUrl?: string;

  features?: Partial<
    CompetitionFeatures
  >;
};

/*
 * ============================================================
 * AGGIORNAMENTO
 * ============================================================
 */

export type UpdateCompetitionInput = {
  competitionId: string;

  name: string;
  shortName: string;

  status: CompetitionStatus;

  primaryColor?: string;
  secondaryColor?: string;
  textColor?: string;
  logoUrl?: string;

  features: CompetitionFeatures;
};