export type SeasonTeamContact = {
  id: string;
  seasonId: string;
  teamId: string;

  presidentPhoneE164?: string;
  whatsappOptIn: boolean;

  createdAt?: unknown;
  updatedAt?: unknown;
};

export type SaveSeasonTeamContactInput = {
  seasonId: string;
  teamId: string;

  presidentPhone?: string;
  whatsappOptIn: boolean;
};
