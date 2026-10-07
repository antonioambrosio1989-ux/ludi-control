export type RegulationSection = {
  id: string;
  title: string;
  content: string;
  order: number;
};

export type RegulationStatus =
  | "draft"
  | "published";

export type Regulation = {
  id: string;

  competitionId: string;

  title: string;

  sections: RegulationSection[];

  status: RegulationStatus;

  createdAt?: Date;
  updatedAt?: Date;
  publishedAt?: Date;
};

export type SaveRegulationInput = {
  title: string;

  sections: RegulationSection[];

  status: RegulationStatus;
};
