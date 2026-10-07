import type {
  LudiStudioDynamicBinding,
  LudiStudioElement,
  LudiStudioImageFit,
  LudiStudioRepeaterElement,
  LudiStudioTemplateDefinition,
  LudiStudioTemplateType,
} from "@/src/types/LudiStudio";

export type SvgTeam = {
  name: string;
  aliasName?: string;
  logoUrl?: string;
};

export type SvgMatch = {
  id?: string;
  matchweek?: number;
  home: SvgTeam;
  away: SvgTeam;
  date: string;
  time: string;
  venue?: string;
  homeScore?: number;
  awayScore?: number;
  score?: string;
};

export type SvgStanding = {
  position: number;
  team: SvgTeam;
  points: number;
  played?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  goalDifference?: number;
};

export type LudiStudioSvgPayload = {
  templateType: LudiStudioTemplateType;
  competitionName: string;
  seasonName?: string;
  title?: string;
  subtitle?: string;
  match?: SvgMatch;
  matches?: SvgMatch[];
  standings?: SvgStanding[];
  playerName?: string;
  playerTeam?: string;
  playerTeamLogoUrl?: string;
  playerPhotoUrl?: string;
  playerRating?: string | number;

  homeGoals?: string[];
  awayGoals?: string[];
  homeSanctions?: string[];
  awaySanctions?: string[];
};

function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function attr(value: unknown) {
  return esc(value);
}

function objectFit(
  fit: LudiStudioImageFit,
): string {
  if (fit === "fill") return "none";
  return fit === "cover" ? "xMidYMid slice" : "xMidYMid meet";
}

export function resolveDynamicText(
  binding: LudiStudioDynamicBinding,
  payload: LudiStudioSvgPayload,
): string {
  const match = payload.match ?? payload.matches?.[0];

  const standingBinding =
    /^standing(\d+)(TeamName|Points|Played|GoalDifference)$/.exec(
      binding,
    );

  if (standingBinding) {
    const position =
      Number(
        standingBinding[1],
      );

    const field =
      standingBinding[2];

    const standing =
      Number.isInteger(position) &&
      position >= 1
        ? payload.standings?.[
            position - 1
          ]
        : undefined;

    if (!standing) {
      return "";
    }

    if (
      field ===
      "TeamName"
    ) {
      return (
        standing.team.aliasName ||
        standing.team.name ||
        ""
      );
    }

    if (
      field ===
      "Played"
    ) {
      return String(
        standing.played ??
        0,
      );
    }

    if (
      field ===
      "GoalDifference"
    ) {
      const goalDifference =
        standing.goalDifference ??
        0;

      return goalDifference > 0
        ? `+${goalDifference}`
        : String(
            goalDifference,
          );
    }

    return String(
      standing.points,
    );
  }

  switch (binding) {
    case "competitionName": return payload.competitionName ?? "";
    case "seasonName": return payload.seasonName ?? "";
    case "matchweek": return match?.matchweek ? `Matchweek ${match.matchweek}` : payload.subtitle ?? "";
    case "matchDate": return match?.date ?? "";
    case "matchTime": return match?.time ?? "";
    case "venue": return match?.venue ?? "";
    case "homeTeamName":
      return payload.templateType === "matchday"
        ? match?.home.aliasName ?? match?.home.name ?? ""
        : match?.home.name ?? "";
    case "homeTeamAlias":
      return match?.home.aliasName ?? match?.home.name ?? "";
    case "awayTeamName":
      return payload.templateType === "matchday"
        ? match?.away.aliasName ?? match?.away.name ?? ""
        : match?.away.name ?? "";
    case "awayTeamAlias":
      return match?.away.aliasName ?? match?.away.name ?? "";
    case "homeScore": return typeof match?.homeScore === "number" ? String(match.homeScore) : "";
    case "awayScore": return typeof match?.awayScore === "number" ? String(match.awayScore) : "";
    case "matchScore": return match?.score ?? "";
    case "playerName": return payload.playerName ?? "";
    case "playerTeamName": return payload.playerTeam ?? "";
    case "playerRating": return payload.playerRating == null ? "" : String(payload.playerRating);
    default: return "";
  }
}

export function resolveDynamicImage(
  binding: LudiStudioDynamicBinding,
  payload: LudiStudioSvgPayload,
): string {
  const match = payload.match ?? payload.matches?.[0];

  const standingLogoBinding =
    /^standing(\d+)TeamLogo$/.exec(
      binding,
    );

  if (standingLogoBinding) {
    const position =
      Number(
        standingLogoBinding[1],
      );

    const standing =
      Number.isInteger(position) &&
      position >= 1
        ? payload.standings?.[
            position - 1
          ]
        : undefined;

    return (
      standing?.team.logoUrl ??
      ""
    );
  }

  switch (binding) {
    case "homeTeamLogo": return match?.home.logoUrl ?? "";
    case "awayTeamLogo": return match?.away.logoUrl ?? "";
    case "playerTeamLogo": return payload.playerTeamLogoUrl ?? "";
    case "playerPhoto": return payload.playerPhotoUrl ?? "";
    default: return "";
  }
}

function background(
  template: LudiStudioTemplateDefinition,
) {
  const image = template.backgroundImageUrl
    ? `<image href="${attr(template.backgroundImageUrl)}" x="0" y="0" width="${template.width}" height="${template.height}" preserveAspectRatio="${objectFit(template.backgroundFit ?? "cover")}"/>`
    : "";

  return `<rect width="${template.width}" height="${template.height}" fill="${attr(template.background)}"/>${image}`;
}

function renderTextElement(
  element: Extract<LudiStudioElement, { kind: "text" }>,
  payload: LudiStudioSvgPayload,
) {
  const raw = element.source === "static"
    ? element.text
    : `${element.prefix ?? ""}${resolveDynamicText(element.binding, payload) || element.fallback || ""}${element.suffix ?? ""}`;

  const anchor = element.align === "center"
    ? "middle"
    : element.align === "right"
      ? "end"
      : "start";

  const x = element.align === "center"
    ? element.x + element.width / 2
    : element.align === "right"
      ? element.x + element.width
      : element.x;

  const y = element.y + element.height * 0.76;
  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;

  return `<g opacity="${element.opacity}" transform="rotate(${element.rotation} ${cx} ${cy})">
    <text x="${x}" y="${y}" text-anchor="${anchor}" fill="${attr(element.color)}" font-family="${attr(element.fontFamily)}" font-size="${element.fontSize}" font-weight="${element.fontWeight}" letter-spacing="${element.letterSpacing}">${esc(raw)}</text>
  </g>`;
}

function renderImageElement(
  element: Extract<LudiStudioElement, { kind: "image" }>,
  payload: LudiStudioSvgPayload,
) {
  const url = element.source === "static"
    ? element.imageUrl
    : resolveDynamicImage(element.binding, payload);

  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;
  const clipId = `clip-${element.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  if (!url) {
    return `<g opacity="${element.opacity}" transform="rotate(${element.rotation} ${cx} ${cy})">
      <rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" rx="${element.borderRadius}" fill="#ffffff" opacity="0.08"/>
    </g>`;
  }

  return `<g opacity="${element.opacity}" transform="rotate(${element.rotation} ${cx} ${cy})">
    <defs><clipPath id="${clipId}"><rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" rx="${element.borderRadius}"/></clipPath></defs>
    <image href="${attr(url)}" x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" preserveAspectRatio="${objectFit(element.fit)}" clip-path="url(#${clipId})"/>
  </g>`;
}

function renderStandingRow(
  element: LudiStudioRepeaterElement,
  payload: LudiStudioSvgPayload,
) {
  const bindingMatch =
    /^standing(\d+)Row$/.exec(
      element.binding,
    );

  if (!bindingMatch) {
    return "";
  }

  const position =
    Number(
      bindingMatch[1],
    );

  const standing =
    Number.isInteger(position) &&
    position >= 1
      ? payload.standings?.[
          position - 1
        ]
      : undefined;

  if (!standing) {
    return "";
  }

  const positionWidth =
    element.standingPositionWidth ??
    64;

  const logoWidth =
    element.standingLogoWidth ??
    82;

  const teamWidth =
    element.standingTeamWidth ??
    320;

  const playedWidth =
    element.standingPlayedWidth ??
    110;

  const goalDifferenceWidth =
    element.standingGoalDifferenceWidth ??
    100;

  const pointsWidth =
    element.standingPointsWidth ??
    104;

  const showPlayed =
    element.standingShowPlayed ??
    true;

  const showGoalDifference =
    element.standingShowGoalDifference ??
    false;

  const rowHeight =
    element.height;

  const verticalCenter =
    element.y +
    rowHeight /
      2;

  function textCell({
    value,
    x,
    width,
    fontSize,
    fontWeight,
    color,
    align,
  }: {
    value: string;
    x: number;
    width: number;
    fontSize: number;
    fontWeight: number;
    color: string;
    align: "left" | "center" | "right";
  }) {
    const anchor =
      align === "center"
        ? "middle"
        : align === "right"
          ? "end"
          : "start";

    const textX =
      align === "center"
        ? x +
          width /
            2
        : align === "right"
          ? x +
            width
          : x;

    const baseline =
      element.y +
      rowHeight *
        0.67;

    return `<text x="${textX}" y="${baseline}" text-anchor="${anchor}" fill="${attr(color)}" font-family="${attr(element.fontFamily)}" font-size="${fontSize}" font-weight="${fontWeight}">${esc(value)}</text>`;
  }

  let cursorX =
    element.x;

  const positionCellX =
    cursorX;

  cursorX +=
    positionWidth;

  const logoCellX =
    cursorX;

  cursorX +=
    logoWidth;

  const teamCellX =
    cursorX;

  cursorX +=
    teamWidth;

  const playedCellX =
    cursorX;

  if (showPlayed) {
    cursorX +=
      playedWidth;
  }

  const goalDifferenceCellX =
    cursorX;

  if (showGoalDifference) {
    cursorX +=
      goalDifferenceWidth;
  }

  const pointsCellX =
    cursorX;

  const logoSize =
    Math.min(
      element.standingLogoSize ??
        element.logoSize,
      logoWidth,
      rowHeight,
    );

  const logoX =
    logoCellX +
    (
      logoWidth -
      logoSize
    ) /
      2;

  const logoY =
    verticalCenter -
    logoSize /
      2;

  const teamName =
    standing.team.aliasName ||
    standing.team.name ||
    "";

  const rowWidth =
    positionWidth +
    logoWidth +
    teamWidth +
    (
      showPlayed
        ? playedWidth
        : 0
    ) +
    (
      showGoalDifference
        ? goalDifferenceWidth
        : 0
    ) +
    pointsWidth;

  const cx =
    element.x +
    rowWidth /
      2;

  const cy =
    element.y +
    element.height /
      2;

  return `<g opacity="${element.opacity}" transform="rotate(${element.rotation} ${cx} ${cy})">
    ${textCell({
      value: String(position),
      x: positionCellX,
      width: positionWidth,
      fontSize: element.standingPositionFontSize ?? 30,
      fontWeight: element.standingPositionFontWeight ?? 800,
      color: element.standingPositionColor ?? "#ffffff",
      align: element.standingPositionAlign ?? "center",
    })}
    ${standing.team.logoUrl ? `<image href="${attr(standing.team.logoUrl)}" x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>` : ""}
    ${textCell({
      value: teamName,
      x: teamCellX,
      width: teamWidth,
      fontSize: element.standingTeamFontSize ?? 32,
      fontWeight: element.standingTeamFontWeight ?? 800,
      color: element.standingTeamColor ?? "#ffffff",
      align: element.standingTeamAlign ?? "left",
    })}
    ${showPlayed ? textCell({
      value: String(standing.played ?? 0),
      x: playedCellX,
      width: playedWidth,
      fontSize: element.standingPlayedFontSize ?? 32,
      fontWeight: element.standingPlayedFontWeight ?? 900,
      color: element.standingPlayedColor ?? "#ffffff",
      align: element.standingPlayedAlign ?? "center",
    }) : ""}
    ${showGoalDifference ? textCell({
      value:
        (standing.goalDifference ?? 0) > 0
          ? `+${standing.goalDifference ?? 0}`
          : String(standing.goalDifference ?? 0),
      x: goalDifferenceCellX,
      width: goalDifferenceWidth,
      fontSize: element.standingGoalDifferenceFontSize ?? 32,
      fontWeight: element.standingGoalDifferenceFontWeight ?? 900,
      color: element.standingGoalDifferenceColor ?? "#ffffff",
      align: element.standingGoalDifferenceAlign ?? "center",
    }) : ""}
    ${textCell({
      value: String(standing.points),
      x: pointsCellX,
      width: pointsWidth,
      fontSize: element.standingPointsFontSize ?? 32,
      fontWeight: element.standingPointsFontWeight ?? 900,
      color: element.standingPointsColor ?? "#ffffff",
      align: element.standingPointsAlign ?? "center",
    })}
  </g>`;
}

function renderStandingTeam(
  element: LudiStudioRepeaterElement,
  payload: LudiStudioSvgPayload,
) {
  const bindingMatch =
    /^standing(\d+)Team$/.exec(
      element.binding,
    );

  if (!bindingMatch) {
    return "";
  }

  const position =
    Number(
      bindingMatch[1],
    );

  const standing =
    Number.isInteger(position) &&
    position >= 1
      ? payload.standings?.[
          position - 1
        ]
      : undefined;

  if (!standing) {
    return "";
  }

  const logoSize =
    Math.min(
      element.logoSize,
      element.height,
    );

  const logoX =
    element.x;

  const logoY =
    element.y +
    (
      element.height -
      logoSize
    ) /
      2;

  const textX =
    logoX +
    logoSize +
    Math.max(
      14,
      element.fontSize *
        0.5,
    );

  const baseline =
    element.y +
    element.height *
      0.66;

  const name =
    standing.team.aliasName ||
    standing.team.name ||
    "";

  return `<g>
    ${element.showLogos && standing.team.logoUrl ? `<image href="${attr(standing.team.logoUrl)}" x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>` : ""}
    ${element.showNames ? `<text x="${textX}" y="${baseline}" fill="${attr(element.color)}" font-family="${attr(element.fontFamily)}" font-size="${element.fontSize}" font-weight="${element.fontWeight}">${esc(name)}</text>` : ""}
  </g>`;
}

function renderStandings(
  element: LudiStudioRepeaterElement,
  payload: LudiStudioSvgPayload,
) {
  const rows = (payload.standings ?? []).slice(0, element.maxRows);

  return rows.map((row, index) => {
    const y = element.y + index * (element.rowHeight + element.rowGap);
    const logoX = element.x + 62;
    const textX = element.x + 62 + element.logoSize + 18;

    return `<g>
      <rect x="${element.x}" y="${y}" width="${element.width}" height="${element.rowHeight}" rx="${Math.min(18, element.rowHeight / 3)}" fill="${attr(element.surfaceColor)}"/>
      <text x="${element.x + 24}" y="${y + element.rowHeight * 0.67}" fill="${attr(element.color)}" font-family="${attr(element.fontFamily)}" font-size="${Math.max(18, element.fontSize - 2)}" font-weight="${element.fontWeight}">${row.position}</text>
      ${element.showLogos && row.team.logoUrl ? `<image href="${attr(row.team.logoUrl)}" x="${logoX}" y="${y + (element.rowHeight - element.logoSize) / 2}" width="${element.logoSize}" height="${element.logoSize}" preserveAspectRatio="xMidYMid meet"/>` : ""}
      ${element.showNames ? `<text x="${textX}" y="${y + element.rowHeight * 0.67}" fill="${attr(element.color)}" font-family="${attr(element.fontFamily)}" font-size="${element.fontSize}" font-weight="${element.fontWeight}">${esc(row.team.aliasName || row.team.name)}</text>` : ""}
      <text x="${element.x + element.width - 28}" y="${y + element.rowHeight * 0.67}" text-anchor="end" fill="${attr(element.color)}" font-family="${attr(element.fontFamily)}" font-size="${element.fontSize}" font-weight="900">${row.points}</text>
    </g>`;
  }).join("");
}


function formatFixtureDate(dateValue: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) return dateValue;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const labels = ["DOM", "LUN", "MAR", "MER", "GIO", "VEN", "SAB"];
  return `${labels[weekday] ?? ""} ${day}`.trim();
}

function renderMatchRows(
  element: LudiStudioRepeaterElement,
  payload: LudiStudioSvgPayload,
  results: boolean,
) {
  const rows = (payload.matches ?? []).slice(0, element.maxRows);

  return rows.map((match, index) => {
    const y = element.y + index * (element.rowHeight + element.rowGap);

    /*
     * Fixtures e Risultati condividono lo stesso schema:
     *
     * [squadra casa] [logo casa] [CENTRO] [logo ospite] [squadra ospite]
     *
     * Nel programma il centro contiene giorno + ora.
     * Nei risultati contiene:
     *
     *      homeScore | awayScore
     *
     * Il divisore "|" è un elemento autonomo ancorato esattamente
     * al centro della colonna risultato: anche con punteggi a doppia
     * cifra non può spostarsi.
     */
    if (
      element.binding === "fixturesList" ||
      element.binding === "resultsList"
    ) {
      const nameBaseline =
        y +
        element.rowHeight *
          0.61;

      const surface =
        results ||
        element.surfaceColor === "transparent"
          ? ""
          : `<rect x="${element.x}" y="${y}" width="${element.width}" height="${element.rowHeight}" rx="${Math.min(20, element.rowHeight / 3)}" fill="${attr(element.surfaceColor)}"/>`;

      const homeName =
        match.home.aliasName ||
        match.home.name;

      const awayName =
        match.away.aliasName ||
        match.away.name;

      if (results) {
        const homeNameWidth =
          element.resultHomeNameWidth ??
          300;

        const homeLogoWidth =
          element.resultHomeLogoWidth ??
          90;

        const centerWidth =
          element.resultCenterWidth ??
          160;

        const awayLogoWidth =
          element.resultAwayLogoWidth ??
          90;

        const awayNameWidth =
          element.resultAwayNameWidth ??
          300;

        const homeNameX =
          element.x;

        const homeLogoCellX =
          homeNameX +
          homeNameWidth;

        const centerCellX =
          homeLogoCellX +
          homeLogoWidth;

        const awayLogoCellX =
          centerCellX +
          centerWidth;

        const awayNameX =
          awayLogoCellX +
          awayLogoWidth;

        const resultTextX = ({
          x,
          width,
          align,
        }: {
          x: number;
          width: number;
          align:
            | "left"
            | "center"
            | "right";
        }) =>
          align === "center"
            ? x +
              width /
                2
            : align === "right"
              ? x +
                width
              : x;

        const resultAnchor = (
          align:
            | "left"
            | "center"
            | "right",
        ) =>
          align === "center"
            ? "middle"
            : align === "right"
              ? "end"
              : "start";

        const homeNameAlign =
          element.resultHomeNameAlign ??
          "right";

        const awayNameAlign =
          element.resultAwayNameAlign ??
          "left";

        const homeLogoSize =
          Math.min(
            element.resultHomeLogoSize ??
              element.logoSize,
            homeLogoWidth,
            element.rowHeight,
          );

        const awayLogoSize =
          Math.min(
            element.resultAwayLogoSize ??
              element.logoSize,
            awayLogoWidth,
            element.rowHeight,
          );

        const homeLogoX =
          homeLogoCellX +
          (
            homeLogoWidth -
            homeLogoSize
          ) /
            2;

        const awayLogoX =
          awayLogoCellX +
          (
            awayLogoWidth -
            awayLogoSize
          ) /
            2;

        const homeLogoY =
          y +
          (
            element.rowHeight -
            homeLogoSize
          ) /
            2;

        const awayLogoY =
          y +
          (
            element.rowHeight -
            awayLogoSize
          ) /
            2;

        const scoreSize =
          element.resultScoreFontSize ??
          Math.max(
            24,
            Math.round(
              element.fontSize *
                1.12,
            ),
          );

        const scoreGap =
          Math.max(
            24,
            Math.round(
              scoreSize *
                0.72,
            ),
          );

        const resultCenterX =
          centerCellX +
          centerWidth /
            2;

        const homeScore =
          typeof match.homeScore ===
          "number"
            ? String(
                match.homeScore,
              )
            : "-";

        const awayScore =
          typeof match.awayScore ===
          "number"
            ? String(
                match.awayScore,
              )
            : "-";

        const scoreBaseline =
          y +
          element.rowHeight *
            0.64;

        return `<g>
          ${surface}
          ${element.showNames ? `<text x="${resultTextX({ x: homeNameX, width: homeNameWidth, align: homeNameAlign })}" y="${nameBaseline}" text-anchor="${resultAnchor(homeNameAlign)}" fill="${attr(element.resultHomeNameColor ?? element.color)}" font-family="${attr(element.fontFamily)}" font-size="${element.resultHomeNameFontSize ?? element.fontSize}" font-weight="${element.resultHomeNameFontWeight ?? element.fontWeight}">${esc(homeName)}</text>` : ""}
          ${element.showLogos && match.home.logoUrl ? `<image href="${attr(match.home.logoUrl)}" x="${homeLogoX}" y="${homeLogoY}" width="${homeLogoSize}" height="${homeLogoSize}" preserveAspectRatio="xMidYMid meet"/>` : ""}

          <text x="${resultCenterX - scoreGap}" y="${scoreBaseline}" text-anchor="end" fill="${attr(element.resultScoreColor ?? element.color)}" font-family="${attr(element.fontFamily)}" font-size="${scoreSize}" font-weight="${element.resultScoreFontWeight ?? 900}">${esc(homeScore)}</text>
          <text x="${resultCenterX}" y="${scoreBaseline}" text-anchor="middle" fill="${attr(element.resultScoreColor ?? element.color)}" font-family="${attr(element.fontFamily)}" font-size="${scoreSize}" font-weight="${element.resultScoreFontWeight ?? 900}">|</text>
          <text x="${resultCenterX + scoreGap}" y="${scoreBaseline}" text-anchor="start" fill="${attr(element.resultScoreColor ?? element.color)}" font-family="${attr(element.fontFamily)}" font-size="${scoreSize}" font-weight="${element.resultScoreFontWeight ?? 900}">${esc(awayScore)}</text>

          ${element.showLogos && match.away.logoUrl ? `<image href="${attr(match.away.logoUrl)}" x="${awayLogoX}" y="${awayLogoY}" width="${awayLogoSize}" height="${awayLogoSize}" preserveAspectRatio="xMidYMid meet"/>` : ""}
          ${element.showNames ? `<text x="${resultTextX({ x: awayNameX, width: awayNameWidth, align: awayNameAlign })}" y="${nameBaseline}" text-anchor="${resultAnchor(awayNameAlign)}" fill="${attr(element.resultAwayNameColor ?? element.color)}" font-family="${attr(element.fontFamily)}" font-size="${element.resultAwayNameFontSize ?? element.fontSize}" font-weight="${element.resultAwayNameFontWeight ?? element.fontWeight}">${esc(awayName)}</text>` : ""}
        </g>`;
      }

      const homeNameWidth = element.fixtureHomeNameWidth ?? 300;
      const homeLogoWidth = element.fixtureHomeLogoWidth ?? 90;
      const centerWidth = element.fixtureCenterWidth ?? 160;
      const awayLogoWidth = element.fixtureAwayLogoWidth ?? 90;
      const awayNameWidth = element.fixtureAwayNameWidth ?? 300;

      const homeNameX = element.x;
      const homeLogoCellX = homeNameX + homeNameWidth;
      const centerCellX = homeLogoCellX + homeLogoWidth;
      const awayLogoCellX = centerCellX + centerWidth;
      const awayNameX = awayLogoCellX + awayLogoWidth;

      const fixtureTextX = ({ x, width, align }: { x: number; width: number; align: "left" | "center" | "right" }) =>
        align === "center" ? x + width / 2 : align === "right" ? x + width : x;
      const fixtureAnchor = (align: "left" | "center" | "right") =>
        align === "center" ? "middle" : align === "right" ? "end" : "start";

      const homeNameAlign = element.fixtureHomeNameAlign ?? "right";
      const awayNameAlign = element.fixtureAwayNameAlign ?? "left";
      const dateAlign = element.fixtureDateAlign ?? "center";
      const timeAlign = element.fixtureTimeAlign ?? "center";

      const homeLogoSize = Math.min(element.fixtureHomeLogoSize ?? element.logoSize, homeLogoWidth, element.rowHeight);
      const awayLogoSize = Math.min(element.fixtureAwayLogoSize ?? element.logoSize, awayLogoWidth, element.rowHeight);
      const homeLogoX = homeLogoCellX + (homeLogoWidth - homeLogoSize) / 2;
      const awayLogoX = awayLogoCellX + (awayLogoWidth - awayLogoSize) / 2;
      const homeLogoY = y + (element.rowHeight - homeLogoSize) / 2;
      const awayLogoY = y + (element.rowHeight - awayLogoSize) / 2;

      const dateLabel = formatFixtureDate(match.date);
      const dateFontSize = element.fixtureDateFontSize ?? Math.max(13, Math.round(element.fontSize * 0.52));
      const timeFontSize = element.fixtureTimeFontSize ?? Math.max(24, Math.round(element.fontSize * 1.12));

      return `<g>
        ${surface}
        ${element.showNames ? `<text x="${fixtureTextX({ x: homeNameX, width: homeNameWidth, align: homeNameAlign })}" y="${nameBaseline}" text-anchor="${fixtureAnchor(homeNameAlign)}" fill="${attr(element.fixtureHomeNameColor ?? element.color)}" font-family="${attr(element.fontFamily)}" font-size="${element.fixtureHomeNameFontSize ?? element.fontSize}" font-weight="${element.fixtureHomeNameFontWeight ?? element.fontWeight}">${esc(homeName)}</text>` : ""}
        ${element.showLogos && match.home.logoUrl ? `<image href="${attr(match.home.logoUrl)}" x="${homeLogoX}" y="${homeLogoY}" width="${homeLogoSize}" height="${homeLogoSize}" preserveAspectRatio="xMidYMid meet"/>` : ""}
        ${element.showDate ? `<text x="${fixtureTextX({ x: centerCellX, width: centerWidth, align: dateAlign })}" y="${y + element.rowHeight * 0.37}" text-anchor="${fixtureAnchor(dateAlign)}" fill="${attr(element.fixtureDateColor ?? element.color)}" font-family="${attr(element.fontFamily)}" font-size="${dateFontSize}" font-weight="${element.fixtureDateFontWeight ?? element.fontWeight}">${esc(dateLabel)}</text>` : ""}
        ${element.showTime ? `<text x="${fixtureTextX({ x: centerCellX, width: centerWidth, align: timeAlign })}" y="${y + element.rowHeight * 0.73}" text-anchor="${fixtureAnchor(timeAlign)}" fill="${attr(element.fixtureTimeColor ?? element.color)}" font-family="${attr(element.fontFamily)}" font-size="${timeFontSize}" font-weight="${element.fixtureTimeFontWeight ?? element.fontWeight}">${esc(match.time)}</text>` : ""}
        ${element.showLogos && match.away.logoUrl ? `<image href="${attr(match.away.logoUrl)}" x="${awayLogoX}" y="${awayLogoY}" width="${awayLogoSize}" height="${awayLogoSize}" preserveAspectRatio="xMidYMid meet"/>` : ""}
        ${element.showNames ? `<text x="${fixtureTextX({ x: awayNameX, width: awayNameWidth, align: awayNameAlign })}" y="${nameBaseline}" text-anchor="${fixtureAnchor(awayNameAlign)}" fill="${attr(element.fixtureAwayNameColor ?? element.color)}" font-family="${attr(element.fontFamily)}" font-size="${element.fixtureAwayNameFontSize ?? element.fontSize}" font-weight="${element.fixtureAwayNameFontWeight ?? element.fontWeight}">${esc(awayName)}</text>` : ""}
      </g>`;
    }

    return "";
  }).join("");
}

function renderTextRows(
  element: LudiStudioRepeaterElement,
  rows: string[],
  align: "left" | "right",
) {
  const visibleRows =
    rows.slice(
      0,
      element.maxRows,
    );

  const textAnchor =
    align === "right"
      ? "end"
      : "start";

  const textX =
    align === "right"
      ? element.x +
        element.width
      : element.x;

  return visibleRows
    .map(
      (
        row,
        index,
      ) => {
        const y =
          element.y +
          index *
            (
              element.rowHeight +
              element.rowGap
            );

        const baseline =
          y +
          element.rowHeight *
            0.68;

        const surface =
          element.surfaceColor !==
          "transparent"
            ? `<rect x="${element.x}" y="${y}" width="${element.width}" height="${element.rowHeight}" rx="${Math.min(
                14,
                element.rowHeight / 3,
              )}" fill="${attr(
                element.surfaceColor,
              )}"/>`
            : "";

        return `<g>
          ${surface}
          <text
            x="${textX}"
            y="${baseline}"
            text-anchor="${textAnchor}"
            fill="${attr(element.color)}"
            font-family="${attr(element.fontFamily)}"
            font-size="${element.fontSize}"
            font-weight="${element.fontWeight}"
          >${esc(row)}</text>
        </g>`;
      },
    )
    .join("");
}

function renderRepeaterElement(
  element: LudiStudioRepeaterElement,
  payload: LudiStudioSvgPayload,
) {
  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;

  let body = "";

  if (
    /^standing\d+Row$/.test(
      element.binding,
    )
  ) {
    body =
      renderStandingRow(
        element,
        payload,
      );
  }

  if (
    /^standing\d+Team$/.test(
      element.binding,
    )
  ) {
    body =
      renderStandingTeam(
        element,
        payload,
      );
  }

  if (element.binding === "standingsTable") {
    body = renderStandings(element, payload);
  }

  if (element.binding === "resultsList") {
    body = renderMatchRows(element, payload, true);
  }

  if (element.binding === "fixturesList") {
    body = renderMatchRows(element, payload, false);
  }

  if (element.binding === "homeGoalsList") {
    body = renderTextRows(
      element,
      payload.homeGoals ?? [],
      "right",
    );
  }

  if (element.binding === "awayGoalsList") {
    body = renderTextRows(
      element,
      payload.awayGoals ?? [],
      "left",
    );
  }

  if (element.binding === "homeSanctionsList") {
    body = renderTextRows(
      element,
      payload.homeSanctions ?? [],
      "right",
    );
  }

  if (element.binding === "awaySanctionsList") {
    body = renderTextRows(
      element,
      payload.awaySanctions ?? [],
      "left",
    );
  }

  return `<g opacity="${element.opacity}" transform="rotate(${element.rotation} ${cx} ${cy})">${body}</g>`;
}

function renderElement(
  element: LudiStudioElement,
  payload: LudiStudioSvgPayload,
) {
  if (element.kind === "text") return renderTextElement(element, payload);
  if (element.kind === "image") return renderImageElement(element, payload);
  return renderRepeaterElement(element, payload);
}

export function renderLudiStudioSvg(
  template: LudiStudioTemplateDefinition,
  payload: LudiStudioSvgPayload,
) {
  const sorted = [...template.elements].sort((a, b) => a.zIndex - b.zIndex);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${template.width}" height="${template.height}" viewBox="0 0 ${template.width} ${template.height}">
    ${background(template)}
    ${sorted.map((element) => renderElement(element, payload)).join("\n")}
  </svg>`;
}

export function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
