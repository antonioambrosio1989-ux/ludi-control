export type CommunicationSanction = {
  id: string;

  playerId: string;
  playerName: string;

  teamId?: string;
  teamName: string;

  suspensionMatches: number;

  reason?: string;
};

export type CommunicationWarning = {
  id: string;

  playerId: string;
  playerName: string;

  teamId?: string;
  teamName: string;

  yellowCards: number;
};

export type OfficialCommunication = {
  id: string;

  seasonId: string;
  matchweek: number;

  title: string;

  judgeSanctions:
    CommunicationSanction[];

  directRedSanctions:
    CommunicationSanction[];

  accumulationSanctions:
    CommunicationSanction[];

  warnings:
    CommunicationWarning[];

  clubFines: CommunicationClubFine[];

  status:
    | "draft"
    | "published";

  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
};

export type CommunicationClubFineType =
  | "walkover"
  | "facilityDamage"
  | "other";

export type CommunicationClubFine = {
  id: string;

  teamId?: string;
  teamName: string;

  type: CommunicationClubFineType;

  amount?: number;

  reason: string;
};