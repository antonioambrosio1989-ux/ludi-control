export type Team = {
  id: string;
  name: string;
  slug: string;

  shortName?: string;
  aliasName?: string;
  nickname?: string;
  logoUrl?: string;
  teamPhotoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  presidentName?: string;
  captainPlayerId?: string;

  createdAt?: unknown;
  updatedAt?: unknown;
};

export type CreateTeamInput = {
  name: string;

  shortName?: string;
  aliasName?: string;
  nickname?: string;
  logoUrl?: string;
  teamPhotoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  presidentName?: string;
  captainPlayerId?: string;
};

export type UpdateTeamInput = {
  name?: string;

  shortName?: string;
  aliasName?: string;
  nickname?: string;
  logoUrl?: string;
  teamPhotoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  presidentName?: string;
  captainPlayerId?: string;
};
