export type LudiStudioTemplateType =
  | "matchday"
  | "man_of_the_match"
  | "score_prediction"
  | "standings"
  | "results"
  | "fixtures"
  | "match_report";

export const LUDI_STUDIO_CANVAS_SIZES: Record<
  LudiStudioTemplateType,
  { width: 1080; height: 1920 | 1350 }
> = {
  matchday: { width: 1080, height: 1920 },
  man_of_the_match: { width: 1080, height: 1920 },
  score_prediction: { width: 1080, height: 1920 },
  standings: { width: 1080, height: 1350 },
  results: { width: 1080, height: 1350 },
  fixtures: { width: 1080, height: 1350 },
  match_report: { width: 1080, height: 1920 },
};

export function getLudiStudioCanvasSize(
  templateType: LudiStudioTemplateType,
) {
  return LUDI_STUDIO_CANVAS_SIZES[templateType];
}

export type LudiStudioStandingPosition =
  | 1 | 2 | 3 | 4 | 5
  | 6 | 7 | 8 | 9 | 10
  | 11 | 12 | 13 | 14 | 15
  | 16 | 17 | 18 | 19 | 20;

export type LudiStudioStandingTextBinding =
  | `standing${LudiStudioStandingPosition}TeamName`
  | `standing${LudiStudioStandingPosition}Points`
  | `standing${LudiStudioStandingPosition}Played`
  | `standing${LudiStudioStandingPosition}GoalDifference`;

export type LudiStudioStandingImageBinding =
  `standing${LudiStudioStandingPosition}TeamLogo`;

export type LudiStudioStandingTeamBinding =
  `standing${LudiStudioStandingPosition}Team`;

export type LudiStudioStandingRowBinding =
  `standing${LudiStudioStandingPosition}Row`;

export type LudiStudioStandingDynamicBinding =
  | LudiStudioStandingTextBinding
  | LudiStudioStandingImageBinding;

export type LudiStudioDynamicBinding =
  | "competitionName"
  | "seasonName"
  | "matchweek"
  | "matchDate"
  | "matchTime"
  | "venue"
  | "homeTeamName"
  | "homeTeamAlias"
  | "homeTeamLogo"
  | "awayTeamName"
  | "awayTeamAlias"
  | "awayTeamLogo"
  | "homeScore"
  | "awayScore"
  | "matchScore"
  | "playerName"
  | "playerTeamName"
  | "playerTeamLogo"
  | "playerPhoto"
  | "playerRating"
  | "standingsTable"
  | "resultsList"
  | "fixturesList"
  | "homeGoalsList"
  | "awayGoalsList"
  | "homeSanctionsList"
  | "awaySanctionsList"
  | LudiStudioStandingDynamicBinding;

export type LudiStudioTextAlign = "left" | "center" | "right";
export type LudiStudioImageFit = "contain" | "cover" | "fill";

export type LudiStudioBaseElement = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  rotation: number;
  zIndex: number;
  locked?: boolean;
};

export type LudiStudioStaticTextElement = LudiStudioBaseElement & {
  kind: "text";
  source: "static";
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  align: LudiStudioTextAlign;
  letterSpacing: number;
  lineHeight: number;
};

export type LudiStudioDynamicTextElement = LudiStudioBaseElement & {
  kind: "text";
  source: "dynamic";
  binding: Exclude<
    LudiStudioDynamicBinding,
    | "homeTeamLogo"
    | "awayTeamLogo"
    | "playerTeamLogo"
    | "playerPhoto"
    | "standingsTable"
    | "resultsList"
    | "fixturesList"
    | "homeGoalsList"
    | "awayGoalsList"
    | "homeSanctionsList"
    | "awaySanctionsList"
    | LudiStudioStandingImageBinding
  >;
  prefix?: string;
  suffix?: string;
  fallback?: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  align: LudiStudioTextAlign;
  letterSpacing: number;
  lineHeight: number;
};

export type LudiStudioStaticImageElement = LudiStudioBaseElement & {
  kind: "image";
  source: "static";
  imageUrl: string;
  fit: LudiStudioImageFit;
  borderRadius: number;
};

export type LudiStudioDynamicImageElement = LudiStudioBaseElement & {
  kind: "image";
  source: "dynamic";
  binding:
    | "homeTeamLogo"
    | "awayTeamLogo"
    | "playerTeamLogo"
    | "playerPhoto"
    | LudiStudioStandingImageBinding;
  fit: LudiStudioImageFit;
  borderRadius: number;
};

export type LudiStudioRepeaterElement = LudiStudioBaseElement & {
  kind: "repeater";
  source: "dynamic";
  binding:
    | "standingsTable"
    | "resultsList"
    | "fixturesList"
    | "homeGoalsList"
    | "awayGoalsList"
    | "homeSanctionsList"
    | "awaySanctionsList"
    | LudiStudioStandingTeamBinding
    | LudiStudioStandingRowBinding;
  rowHeight: number;
  rowGap: number;
  maxRows: number;
  logoSize: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  surfaceColor: string;
  accentColor: string;
  showLogos: boolean;
  showNames: boolean;
  showDate: boolean;
  showTime: boolean;

  /*
   * Proprietà opzionali usate dalla tabella Programma.
   * Le impostazioni sono per colonna e si applicano a tutte
   * le righe della lista.
   */
  fixtureHomeNameWidth?: number;
  fixtureHomeLogoWidth?: number;
  fixtureCenterWidth?: number;
  fixtureAwayLogoWidth?: number;
  fixtureAwayNameWidth?: number;

  fixtureHomeNameFontSize?: number;
  fixtureHomeNameFontWeight?: number;
  fixtureHomeNameColor?: string;
  fixtureHomeNameAlign?: LudiStudioTextAlign;

  fixtureHomeLogoSize?: number;

  fixtureDateFontSize?: number;
  fixtureDateFontWeight?: number;
  fixtureDateColor?: string;
  fixtureDateAlign?: LudiStudioTextAlign;

  fixtureTimeFontSize?: number;
  fixtureTimeFontWeight?: number;
  fixtureTimeColor?: string;
  fixtureTimeAlign?: LudiStudioTextAlign;

  fixtureAwayLogoSize?: number;

  fixtureAwayNameFontSize?: number;
  fixtureAwayNameFontWeight?: number;
  fixtureAwayNameColor?: string;
  fixtureAwayNameAlign?: LudiStudioTextAlign;

  /*
   * Proprietà opzionali usate dalla tabella Risultati.
   * Come per il Programma, ogni impostazione è per colonna
   * e si applica automaticamente a tutte le righe.
   */
  resultHomeNameWidth?: number;
  resultHomeLogoWidth?: number;
  resultCenterWidth?: number;
  resultAwayLogoWidth?: number;
  resultAwayNameWidth?: number;

  resultHomeNameFontSize?: number;
  resultHomeNameFontWeight?: number;
  resultHomeNameColor?: string;
  resultHomeNameAlign?: LudiStudioTextAlign;

  resultHomeLogoSize?: number;

  resultScoreFontSize?: number;
  resultScoreFontWeight?: number;
  resultScoreColor?: string;

  resultAwayLogoSize?: number;

  resultAwayNameFontSize?: number;
  resultAwayNameFontWeight?: number;
  resultAwayNameColor?: string;
  resultAwayNameAlign?: LudiStudioTextAlign;

  /*
   * Proprietà opzionali usate dalle righe classifica compatte:
   * [pos.] [logo] [aliasName] [PG?] [DR?] [punti]
   *
   * Restano opzionali per non rompere i template già salvati.
   */
  standingPositionWidth?: number;
  standingLogoWidth?: number;
  standingTeamWidth?: number;
  standingPointsWidth?: number;
  standingPlayedWidth?: number;
  standingGoalDifferenceWidth?: number;

  standingShowPlayed?: boolean;
  standingShowGoalDifference?: boolean;

  standingPositionFontSize?: number;
  standingPositionFontWeight?: number;
  standingPositionColor?: string;
  standingPositionAlign?: LudiStudioTextAlign;

  standingLogoSize?: number;

  standingTeamFontSize?: number;
  standingTeamFontWeight?: number;
  standingTeamColor?: string;
  standingTeamAlign?: LudiStudioTextAlign;

  standingPointsFontSize?: number;
  standingPointsFontWeight?: number;
  standingPointsColor?: string;
  standingPointsAlign?: LudiStudioTextAlign;

  standingPlayedFontSize?: number;
  standingPlayedFontWeight?: number;
  standingPlayedColor?: string;
  standingPlayedAlign?: LudiStudioTextAlign;

  standingGoalDifferenceFontSize?: number;
  standingGoalDifferenceFontWeight?: number;
  standingGoalDifferenceColor?: string;
  standingGoalDifferenceAlign?: LudiStudioTextAlign;
};

export type LudiStudioElement =
  | LudiStudioStaticTextElement
  | LudiStudioDynamicTextElement
  | LudiStudioStaticImageElement
  | LudiStudioDynamicImageElement
  | LudiStudioRepeaterElement;

export type LudiStudioTemplateDefinition = {
  id: string;
  competitionId: string;
  templateType: LudiStudioTemplateType;
  width: 1080;
  height: 1920 | 1350;
  background: string;
  foreground: string;
  accent: string;
  surface: string;
  backgroundImageUrl?: string;
  backgroundFit?: LudiStudioImageFit;
  elements: LudiStudioElement[];
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type LudiStudioGeneratedAsset = {
  id: string;
  competitionId: string;
  seasonId: string;
  templateType: LudiStudioTemplateType;
  sourceKey: string;
  matchId?: string;
  matchweek?: number;
  imageUrl?: string;
  imageKey?: string;
  imageDataUrl?: string;
  width: 1080;
  height: 1920 | 1350;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type StudioTeam = {
  id: string;
  name: string;
  aliasName?: string;
  logoUrl?: string;
};

export type StudioMatch = {
  id: string;
  matchweek: number;
  date: string;
  time: string;
  venue?: string;
  homeTeamId: string;
  awayTeamId: string;
};

export type StudioStanding = {
  teamId: string;
  points: number;
  played?: number;
  wins?: number;
  draws?: number;
  losses?: number;
};

function textBase(
  id: string,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
): Omit<
  LudiStudioBaseElement,
  "id" | "name" | "x" | "y" | "width" | "height"
> & Pick<LudiStudioBaseElement, "id" | "name" | "x" | "y" | "width" | "height"> {
  return {
    id,
    name,
    x,
    y,
    width,
    height,
    opacity: 1,
    rotation: 0,
    zIndex: 10,
  };
}

function dynamicText(
  id: string,
  name: string,
  binding: LudiStudioDynamicTextElement["binding"],
  x: number,
  y: number,
  width: number,
  height: number,
  fontSize: number,
): LudiStudioDynamicTextElement {
  return {
    ...textBase(id, name, x, y, width, height),
    kind: "text",
    source: "dynamic",
    binding,
    fallback: name,
    fontFamily: "Arial",
    fontSize,
    fontWeight: 900,
    color: "#ffffff",
    align: "center",
    letterSpacing: 0,
    lineHeight: 1.05,
  };
}

function dynamicImage(
  id: string,
  name: string,
  binding: LudiStudioDynamicImageElement["binding"],
  x: number,
  y: number,
  width: number,
  height: number,
): LudiStudioDynamicImageElement {
  return {
    ...textBase(id, name, x, y, width, height),
    kind: "image",
    source: "dynamic",
    binding,
    fit: "contain",
    borderRadius: 0,
  };
}

function repeater(
  id: string,
  name: string,
  binding: LudiStudioRepeaterElement["binding"],
  height: number,
): LudiStudioRepeaterElement {
  return {
    ...textBase(id, name, binding === "fixturesList" ? 170 : 70, binding === "fixturesList" ? 340 : 260, binding === "fixturesList" ? 740 : 940, binding === "fixturesList" ? 720 : height),
    kind: "repeater",
    source: "dynamic",
    binding,
    rowHeight: binding === "standingsTable" ? 72 : binding === "fixturesList" ? 62 : 96,
    rowGap: binding === "fixturesList" ? 6 : 12,
    maxRows: binding === "standingsTable" ? 12 : binding === "fixturesList" ? 10 : 8,
    logoSize: binding === "standingsTable" ? 44 : binding === "fixturesList" ? 42 : 58,
    fontFamily: "Arial",
    fontSize: binding === "fixturesList" ? 25 : 26,
    fontWeight: binding === "fixturesList" ? 500 : 900,
    color: binding === "fixturesList" ? "#ffffff" : "#07162f",
    surfaceColor: binding === "fixturesList" ? "transparent" : "#eef1f4",
    accentColor: "#d9ff43",
    showLogos: true,
    showNames: true,
    showDate: binding !== "standingsTable",
    showTime: binding !== "standingsTable",
  };
}

function matchReportList(
  id: string,
  name: string,
  binding:
    | "homeGoalsList"
    | "awayGoalsList"
    | "homeSanctionsList"
    | "awaySanctionsList",
  x: number,
  y: number,
  width: number,
  height: number,
): LudiStudioRepeaterElement {
  return {
    ...textBase(
      id,
      name,
      x,
      y,
      width,
      height,
    ),
    kind: "repeater",
    source: "dynamic",
    binding,
    rowHeight: 48,
    rowGap: 8,
    maxRows: 8,
    logoSize: 0,
    fontFamily: "Arial",
    fontSize: 27,
    fontWeight: 800,
    color: "#ffffff",
    surfaceColor: "transparent",
    accentColor: "#d9ff43",
    showLogos: false,
    showNames: true,
    showDate: false,
    showTime: false,
  };
}

export function createDefaultLudiStudioElements(
  templateType: LudiStudioTemplateType,
): LudiStudioElement[] {
  switch (templateType) {
    case "matchday":
      return [
        dynamicText("matchday-matchweek", "Matchweek", "matchweek", 245, 500, 590, 90, 54),
        dynamicText("matchday-time", "Ora partita", "matchTime", 280, 690, 520, 96, 60),
        dynamicImage("matchday-home-logo", "Logo casa", "homeTeamLogo", 150, 900, 300, 300),
        dynamicImage("matchday-away-logo", "Logo ospite", "awayTeamLogo", 630, 900, 300, 300),
      ];

    case "score_prediction":
      return [
        dynamicText("prediction-matchweek", "Matchweek", "matchweek", 240, 420, 600, 80, 46),
        dynamicText("prediction-time", "Ora partita", "matchTime", 300, 570, 480, 80, 52),
        dynamicImage("prediction-home-logo", "Logo casa", "homeTeamLogo", 150, 830, 300, 300),
        dynamicImage("prediction-away-logo", "Logo ospite", "awayTeamLogo", 630, 830, 300, 300),
      ];

    case "man_of_the_match":
      return [
        dynamicImage("motm-player-photo", "Foto giocatore", "playerPhoto", 220, 420, 640, 850),
        dynamicText("motm-player-name", "Nome giocatore", "playerName", 120, 1300, 840, 100, 62),
        dynamicText("motm-player-team", "Squadra", "playerTeamName", 160, 1420, 760, 76, 34),
        dynamicText("motm-rating", "Voto", "playerRating", 390, 1530, 300, 80, 42),
      ];

    case "match_report":
      return [
        dynamicText("report-matchweek", "Matchweek", "matchweek", 220, 120, 640, 70, 38),
        dynamicText("report-date", "Data partita", "matchDate", 220, 205, 640, 62, 30),
        dynamicText("report-time", "Ora partita", "matchTime", 390, 270, 300, 58, 28),

        dynamicImage("report-home-logo", "Logo casa", "homeTeamLogo", 110, 390, 240, 240),
        dynamicImage("report-away-logo", "Logo ospite", "awayTeamLogo", 730, 390, 240, 240),

        dynamicText("report-home-name", "Nome squadra casa", "homeTeamAlias", 55, 645, 370, 62, 32),
        dynamicText("report-away-name", "Nome squadra ospite", "awayTeamAlias", 655, 645, 370, 62, 32),
        dynamicText("report-score", "Risultato", "matchScore", 365, 455, 350, 105, 72),

        matchReportList(
          "report-home-goals",
          "Marcatori casa",
          "homeGoalsList",
          70,
          790,
          440,
          360,
        ),
        matchReportList(
          "report-away-goals",
          "Marcatori ospiti",
          "awayGoalsList",
          570,
          790,
          440,
          360,
        ),

        matchReportList(
          "report-home-sanctions",
          "Sanzioni casa",
          "homeSanctionsList",
          70,
          1210,
          440,
          230,
        ),
        matchReportList(
          "report-away-sanctions",
          "Sanzioni ospiti",
          "awaySanctionsList",
          570,
          1210,
          440,
          230,
        ),

        dynamicImage("report-mvp-photo", "Foto MVP", "playerPhoto", 405, 1480, 270, 270),
        dynamicText("report-mvp-name", "MVP", "playerName", 190, 1760, 700, 70, 40),
        dynamicText("report-mvp-rating", "Voto MVP", "playerRating", 390, 1830, 300, 58, 30),
      ];

    case "standings":
      return [repeater("standings-table", "Tabella classifica", "standingsTable", 980)];

    case "results":
      return [
        dynamicText("results-matchweek", "Matchweek", "matchweek", 240, 130, 600, 74, 38),
        repeater("results-list", "Lista risultati", "resultsList", 1000),
      ];

    case "fixtures":
      return [
        dynamicText("fixtures-matchweek", "Matchweek", "matchweek", 240, 130, 600, 74, 38),
        repeater("fixtures-list", "Lista programma", "fixturesList", 1000),
      ];
  }
}
