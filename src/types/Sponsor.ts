export type SponsorSocialPlatform =
  | "instagram"
  | "facebook"
  | "tiktok";

export type Sponsor = {
  id:
    string;

  competitionId:
    string;

  name:
    string;

  imageUrl:
    string;

  storagePath?:
    string;

  socialPlatform:
    SponsorSocialPlatform;

  socialUrl:
    string;

  sortOrder:
    number;

  active:
    boolean;

  createdAt?:
    unknown;

  updatedAt?:
    unknown;
};

export type CreateSponsorInput = Omit<
  Sponsor,
  | "id"
  | "createdAt"
  | "updatedAt"
>;

export type UpdateSponsorInput = Partial<
  Omit<
    Sponsor,
    | "id"
    | "competitionId"
    | "createdAt"
    | "updatedAt"
  >
>;
