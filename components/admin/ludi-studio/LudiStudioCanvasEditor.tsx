"use client";

import {
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import type {
  LudiStudioElement,
  LudiStudioTemplateDefinition,
} from "@/src/types/LudiStudio";

import {
  resolveDynamicImage,
  resolveDynamicText,
  type LudiStudioSvgPayload,
} from "./LudiStudioSvg";

type Props = {
  template: LudiStudioTemplateDefinition;
  payload: LudiStudioSvgPayload;
  selectedElementId: string | null;
  onSelectedElementIdChange: (id: string | null) => void;
  onElementsChange: (elements: LudiStudioElement[]) => void;
};

type DragState = {
  id: string;
  startX: number;
  startY: number;
  elementX: number;
  elementY: number;
};

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

function elementEffectiveWidth(
  element:
    LudiStudioElement,
) {
  if (
    element.kind !==
      "repeater" ||
    !/^standing\d+Row$/.test(
      element.binding,
    )
  ) {
    return element.width;
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

  return (
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
    pointsWidth
  );
}

export default function LudiStudioCanvasEditor({
  template,
  payload,
  selectedElementId,
  onSelectedElementIdChange,
  onElementsChange,
}: Props) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const sortedElements = useMemo(
    () => [...template.elements].sort((a, b) => a.zIndex - b.zIndex),
    [template.elements],
  );

  function updateElement(
    id: string,
    patch: Partial<LudiStudioElement>,
  ) {
    onElementsChange(
      template.elements.map((element) =>
        element.id === id
          ? ({ ...element, ...patch } as LudiStudioElement)
          : element,
      ),
    );
  }

  function pointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
    element: LudiStudioElement,
  ) {
    event.stopPropagation();
    onSelectedElementIdChange(element.id);

    if (element.locked) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      id: element.id,
      startX: event.clientX,
      startY: event.clientY,
      elementX: element.x,
      elementY: element.y,
    });
  }

  function pointerMove(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (!drag || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const scaleX = template.width / rect.width;
    const scaleY = template.height / rect.height;

    const element = template.elements.find((item) => item.id === drag.id);
    if (!element) return;

    const nextX = Math.max(
      0,
      Math.min(
        template.width -
          elementEffectiveWidth(
            element,
          ),
        drag.elementX + (event.clientX - drag.startX) * scaleX,
      ),
    );
    const nextY = Math.max(
      0,
      Math.min(
        template.height - element.height,
        drag.elementY + (event.clientY - drag.startY) * scaleY,
      ),
    );

    updateElement(drag.id, {
      x: Math.round(nextX),
      y: Math.round(nextY),
    });
  }

  function pointerUp() {
    setDrag(null);
  }

  return (
    <div
      ref={canvasRef}
      onPointerDown={() => onSelectedElementIdChange(null)}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={pointerUp}
      className="relative mx-auto w-full max-w-[430px] touch-none overflow-hidden rounded-[22px] bg-[#07162f] shadow-[0_18px_50px_rgba(6,20,46,0.18)] xl:max-w-[520px] 2xl:max-w-[580px]"
      style={{
        aspectRatio: `${template.width} / ${template.height}`,
        backgroundColor: template.background,
      }}
    >
      {template.backgroundImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={template.backgroundImageUrl}
          alt="Sfondo template"
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ objectFit: template.backgroundFit === "fill" ? "fill" : template.backgroundFit ?? "cover" }}
        />
      ) : null}

      {sortedElements.map((element) => {
        const left = `${(element.x / template.width) * 100}%`;
        const top = `${(element.y / template.height) * 100}%`;
        const width =
          `${(elementEffectiveWidth(element) / template.width) * 100}%`;
        const height = `${(element.height / template.height) * 100}%`;
        const selected = selectedElementId === element.id;

        let content: React.ReactNode = null;

        if (element.kind === "text") {
          const raw = element.source === "static"
            ? element.text
            : `${element.prefix ?? ""}${resolveDynamicText(element.binding, payload) || element.fallback || ""}${element.suffix ?? ""}`;

          content = (
            <div
              className="flex h-full w-full items-center"
              style={{
                justifyContent:
                  element.align === "center"
                    ? "center"
                    : element.align === "right"
                      ? "flex-end"
                      : "flex-start",
                fontFamily: element.fontFamily,
                fontSize: `${(element.fontSize / template.width) * 430}px`,
                fontWeight: element.fontWeight,
                color: element.color,
                letterSpacing: `${element.letterSpacing}px`,
                lineHeight: element.lineHeight,
                textAlign: element.align,
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              {raw}
            </div>
          );
        } else if (element.kind === "image") {
          const url = element.source === "static"
            ? element.imageUrl
            : resolveDynamicImage(element.binding, payload);

          content = url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={element.name}
              draggable={false}
              className="pointer-events-none h-full w-full"
              style={{
                objectFit: element.fit === "fill" ? "fill" : element.fit,
                borderRadius: `${(element.borderRadius / template.width) * 430}px`,
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-white/30 bg-white/10 px-2 text-center text-[9px] font-black uppercase text-white/50">
              {element.name}
            </div>
          );
        } else if (
          /^standing\d+Row$/.test(
            element.binding,
          )
        ) {
          const bindingMatch =
            /^standing(\d+)Row$/.exec(
              element.binding,
            );

          const position =
            bindingMatch
              ? Number(
                  bindingMatch[1],
                )
              : 0;

          const standing =
            position >= 1
              ? payload.standings?.[
                  position - 1
                ]
              : undefined;

          const scale =
            430 /
            template.width;

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

          function textCellStyle({
            width,
            fontSize,
            fontWeight,
            color,
            align,
          }: {
            width: number;
            fontSize: number;
            fontWeight: number;
            color: string;
            align:
              | "left"
              | "center"
              | "right";
          }) {
            return {
              width:
                `${width * scale}px`,
              fontSize:
                `${fontSize * scale}px`,
              fontWeight,
              color,
              textAlign:
                align,
              justifyContent:
                align === "center"
                  ? "center"
                  : align === "right"
                    ? "flex-end"
                    : "flex-start",
            } as const;
          }

          const logoSize =
            Math.min(
              element.standingLogoSize ??
                element.logoSize,
              logoWidth,
              element.height,
            ) *
            scale;

          content =
            standing ? (
              <div className="flex h-full w-full min-w-0 items-stretch overflow-hidden">
                <div
                  className="flex shrink-0 items-center overflow-hidden"
                  style={textCellStyle({
                    width:
                      positionWidth,
                    fontSize:
                      element.standingPositionFontSize ??
                      30,
                    fontWeight:
                      element.standingPositionFontWeight ??
                      800,
                    color:
                      element.standingPositionColor ??
                      "#ffffff",
                    align:
                      element.standingPositionAlign ??
                      "center",
                  })}
                >
                  {position}
                </div>

                <div
                  className="flex shrink-0 items-center justify-center overflow-hidden"
                  style={{
                    width:
                      `${logoWidth * scale}px`,
                  }}
                >
                  {standing.team.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={
                        standing.team.logoUrl
                      }
                      alt={
                        standing.team.aliasName ||
                        standing.team.name
                      }
                      draggable={false}
                      className="pointer-events-none object-contain"
                      style={{
                        width:
                          `${logoSize}px`,
                        height:
                          `${logoSize}px`,
                      }}
                    />
                  ) : null}
                </div>

                <div
                  className="flex min-w-0 shrink-0 items-center overflow-hidden whitespace-nowrap"
                  style={textCellStyle({
                    width:
                      teamWidth,
                    fontSize:
                      element.standingTeamFontSize ??
                      32,
                    fontWeight:
                      element.standingTeamFontWeight ??
                      800,
                    color:
                      element.standingTeamColor ??
                      "#ffffff",
                    align:
                      element.standingTeamAlign ??
                      "left",
                  })}
                >
                  <span className="min-w-0 truncate">
                    {standing.team.aliasName ||
                      standing.team.name}
                  </span>
                </div>

                {showPlayed ? (
                  <div
                    className="flex shrink-0 items-center overflow-hidden"
                    style={textCellStyle({
                      width:
                        playedWidth,
                      fontSize:
                        element.standingPlayedFontSize ??
                        32,
                      fontWeight:
                        element.standingPlayedFontWeight ??
                        900,
                      color:
                        element.standingPlayedColor ??
                        "#ffffff",
                      align:
                        element.standingPlayedAlign ??
                        "center",
                    })}
                  >
                    {standing.played ??
                      0}
                  </div>
                ) : null}

                {showGoalDifference ? (
                  <div
                    className="flex shrink-0 items-center overflow-hidden"
                    style={textCellStyle({
                      width:
                        goalDifferenceWidth,
                      fontSize:
                        element.standingGoalDifferenceFontSize ??
                        32,
                      fontWeight:
                        element.standingGoalDifferenceFontWeight ??
                        900,
                      color:
                        element.standingGoalDifferenceColor ??
                        "#ffffff",
                      align:
                        element.standingGoalDifferenceAlign ??
                        "center",
                    })}
                  >
                    {(standing.goalDifference ??
                      0) > 0
                      ? `+${standing.goalDifference ?? 0}`
                      : standing.goalDifference ??
                        0}
                  </div>
                ) : null}

                <div
                  className="flex shrink-0 items-center overflow-hidden"
                  style={textCellStyle({
                    width:
                      pointsWidth,
                    fontSize:
                      element.standingPointsFontSize ??
                      32,
                    fontWeight:
                      element.standingPointsFontWeight ??
                      900,
                    color:
                      element.standingPointsColor ??
                      "#ffffff",
                    align:
                      element.standingPointsAlign ??
                      "center",
                  })}
                >
                  {standing.points}
                </div>
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-xl border-2 border-dashed border-white/40 px-3 text-center text-[10px] font-black uppercase text-white/70">
                Squadra non disponibile
              </div>
            );
        } else if (
          /^standing\d+Team$/.test(
            element.binding,
          )
        ) {
          const bindingMatch =
            /^standing(\d+)Team$/.exec(
              element.binding,
            );

          const position =
            bindingMatch
              ? Number(
                  bindingMatch[1],
                )
              : 0;

          const standing =
            position >= 1
              ? payload.standings?.[
                  position - 1
                ]
              : undefined;

          const logoSizePx =
            Math.min(
              (element.logoSize /
                template.width) *
                430,
              (element.height /
                template.width) *
                430,
            );

          const baseFontSize =
            Math.max(
              8,
              (element.fontSize /
                template.width) *
                430,
            );

          content =
            standing ? (
              <div
                className="flex h-full w-full min-w-0 items-center gap-2 overflow-hidden"
                style={{
                  color:
                    element.color,
                  fontFamily:
                    element.fontFamily,
                  fontWeight:
                    element.fontWeight,
                  fontSize:
                    `${baseFontSize}px`,
                  backgroundColor:
                    element.surfaceColor ===
                    "transparent"
                      ? "transparent"
                      : element.surfaceColor,
                }}
              >
                {element.showLogos &&
                standing.team.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={
                      standing.team.logoUrl
                    }
                    alt={
                      standing.team.aliasName ||
                      standing.team.name
                    }
                    draggable={false}
                    className="pointer-events-none shrink-0 object-contain"
                    style={{
                      width:
                        `${logoSizePx}px`,
                      height:
                        `${logoSizePx}px`,
                    }}
                  />
                ) : null}

                {element.showNames ? (
                  <span className="min-w-0 truncate">
                    {standing.team.aliasName ||
                      standing.team.name}
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-xl border-2 border-dashed border-white/40 px-3 text-center text-[10px] font-black uppercase text-white/70">
                Squadra non disponibile
              </div>
            );
        } else if (
          element.binding === "fixturesList" ||
          element.binding === "resultsList"
        ) {
          const rows = (payload.matches ?? []).slice(0, element.maxRows);
          const isResults =
            element.binding === "resultsList";
          const rowHeightPct = (element.rowHeight / element.height) * 100;
          const rowGapPct = (element.rowGap / element.height) * 100;
          const baseFontSize = Math.max(8, (element.fontSize / template.width) * 430);
          const resultHomeNameWidth =
            element.resultHomeNameWidth ??
            300;
          const resultHomeLogoWidth =
            element.resultHomeLogoWidth ??
            90;
          const resultCenterWidth =
            element.resultCenterWidth ??
            160;
          const resultAwayLogoWidth =
            element.resultAwayLogoWidth ??
            90;
          const resultAwayNameWidth =
            element.resultAwayNameWidth ??
            300;

          const fixtureHomeNameWidth = element.fixtureHomeNameWidth ?? 300;
          const fixtureHomeLogoWidth = element.fixtureHomeLogoWidth ?? 90;
          const fixtureCenterWidth = element.fixtureCenterWidth ?? 160;
          const fixtureAwayLogoWidth = element.fixtureAwayLogoWidth ?? 90;
          const fixtureAwayNameWidth = element.fixtureAwayNameWidth ?? 300;
          const fixtureScale = 430 / template.width;

          content = (
            <div className="h-full w-full overflow-hidden">
              {rows.map((match, index) => (
                <div
                  key={match.id ?? `${match.home.name}-${match.away.name}-${index}`}
                  className="absolute left-0 grid w-full items-center"
                  style={{
                    top: `${index * (rowHeightPct + rowGapPct)}%`,
                    height: `${rowHeightPct}%`,
                    color: element.color,
                    backgroundColor:
                      isResults
                        ? "transparent"
                        : element.surfaceColor === "transparent"
                          ? "transparent"
                          : element.surfaceColor,
                    fontFamily: element.fontFamily,
                    fontWeight: element.fontWeight,
                    fontSize: `${baseFontSize}px`,
                    gridTemplateColumns: isResults
                      ? `${resultHomeNameWidth * fixtureScale}px ${resultHomeLogoWidth * fixtureScale}px ${resultCenterWidth * fixtureScale}px ${resultAwayLogoWidth * fixtureScale}px ${resultAwayNameWidth * fixtureScale}px`
                      : `${fixtureHomeNameWidth * fixtureScale}px ${fixtureHomeLogoWidth * fixtureScale}px ${fixtureCenterWidth * fixtureScale}px ${fixtureAwayLogoWidth * fixtureScale}px ${fixtureAwayNameWidth * fixtureScale}px`,
                  }}
                >
                  <div
                    className="min-w-0 overflow-hidden whitespace-nowrap"
                    style={isResults ? {
                      fontSize:
                        `${(element.resultHomeNameFontSize ?? element.fontSize) * fixtureScale}px`,
                      fontWeight:
                        element.resultHomeNameFontWeight ?? element.fontWeight,
                      color:
                        element.resultHomeNameColor ?? element.color,
                      textAlign:
                        element.resultHomeNameAlign ?? "right",
                    } : {
                      fontSize: `${(element.fixtureHomeNameFontSize ?? element.fontSize) * fixtureScale}px`,
                      fontWeight: element.fixtureHomeNameFontWeight ?? element.fontWeight,
                      color: element.fixtureHomeNameColor ?? element.color,
                      textAlign: element.fixtureHomeNameAlign ?? "right",
                    }}
                  >
                    {element.showNames ? match.home.aliasName || match.home.name : null}
                  </div>

                  <div className="flex items-center justify-center">
                    {element.showLogos && match.home.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={match.home.logoUrl}
                        alt={match.home.aliasName || match.home.name}
                        draggable={false}
                        className="pointer-events-none object-contain"
                        style={{
                          width:
                            isResults
                              ? `${(element.resultHomeLogoSize ?? element.logoSize) * fixtureScale}px`
                              : `${(element.fixtureHomeLogoSize ?? element.logoSize) * fixtureScale}px`,
                          maxWidth:
                            undefined,
                          height:
                            isResults
                              ? `${(element.resultHomeLogoSize ?? element.logoSize) * fixtureScale}px`
                              : `${(element.fixtureHomeLogoSize ?? element.logoSize) * fixtureScale}px`,
                        }}
                      />
                    ) : null}
                  </div>

                  <div className="px-2 leading-none">
                    {isResults ? (
                      <div
                        className="grid grid-cols-[1fr_auto_1fr] items-center"
                        style={{
                          fontSize:
                            `${(element.resultScoreFontSize ?? Math.max(24, Math.round(element.fontSize * 1.12))) * fixtureScale}px`,
                          fontWeight:
                            element.resultScoreFontWeight ?? 900,
                          color:
                            element.resultScoreColor ?? element.color,
                        }}
                      >
                        <span className="text-right">{typeof match.homeScore === "number" ? match.homeScore : "-"}</span>
                        <span className="px-2 text-center">|</span>
                        <span className="text-left">{typeof match.awayScore === "number" ? match.awayScore : "-"}</span>
                      </div>
                    ) : (
                      <>
                        {element.showDate ? (
                          <div style={{
                            fontSize: `${(element.fixtureDateFontSize ?? Math.max(13, Math.round(element.fontSize * 0.52))) * fixtureScale}px`,
                            fontWeight: element.fixtureDateFontWeight ?? element.fontWeight,
                            color: element.fixtureDateColor ?? element.color,
                            textAlign: element.fixtureDateAlign ?? "center",
                          }}>{formatFixtureDate(match.date)}</div>
                        ) : null}
                        {element.showTime ? (
                          <div className="mt-1" style={{
                            fontSize: `${(element.fixtureTimeFontSize ?? Math.max(24, Math.round(element.fontSize * 1.12))) * fixtureScale}px`,
                            fontWeight: element.fixtureTimeFontWeight ?? element.fontWeight,
                            color: element.fixtureTimeColor ?? element.color,
                            textAlign: element.fixtureTimeAlign ?? "center",
                          }}>{match.time}</div>
                        ) : null}
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-center">
                    {element.showLogos && match.away.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={match.away.logoUrl}
                        alt={match.away.aliasName || match.away.name}
                        draggable={false}
                        className="pointer-events-none object-contain"
                        style={{
                          width:
                            isResults
                              ? `${(element.resultAwayLogoSize ?? element.logoSize) * fixtureScale}px`
                              : `${(element.fixtureAwayLogoSize ?? element.logoSize) * fixtureScale}px`,
                          maxWidth:
                            undefined,
                          height:
                            isResults
                              ? `${(element.resultAwayLogoSize ?? element.logoSize) * fixtureScale}px`
                              : `${(element.fixtureAwayLogoSize ?? element.logoSize) * fixtureScale}px`,
                        }}
                      />
                    ) : null}
                  </div>

                  <div
                    className="min-w-0 overflow-hidden whitespace-nowrap"
                    style={isResults ? {
                      fontSize:
                        `${(element.resultAwayNameFontSize ?? element.fontSize) * fixtureScale}px`,
                      fontWeight:
                        element.resultAwayNameFontWeight ?? element.fontWeight,
                      color:
                        element.resultAwayNameColor ?? element.color,
                      textAlign:
                        element.resultAwayNameAlign ?? "left",
                    } : {
                      fontSize: `${(element.fixtureAwayNameFontSize ?? element.fontSize) * fixtureScale}px`,
                      fontWeight: element.fixtureAwayNameFontWeight ?? element.fontWeight,
                      color: element.fixtureAwayNameColor ?? element.color,
                      textAlign: element.fixtureAwayNameAlign ?? "left",
                    }}
                  >
                    {element.showNames ? match.away.aliasName || match.away.name : null}
                  </div>
                </div>
              ))}

              {rows.length === 0 ? (
                <div className="flex h-full w-full items-center justify-center rounded-xl border-2 border-dashed border-white/40 px-3 text-center text-[10px] font-black uppercase text-white/70">
                  Nessuna partita nella matchweek selezionata
                </div>
              ) : null}
            </div>
          );
        } else {
          content = (
            <div className="flex h-full w-full items-center justify-center rounded-xl border-2 border-dashed border-[#D9FF43]/70 bg-[#06142E]/55 px-3 text-center text-[10px] font-black uppercase text-white">
              {element.name}<br />{element.binding}
            </div>
          );
        }

        return (
          <div
            key={element.id}
            onPointerDown={(event) => pointerDown(event, element)}
            className={`absolute select-none ${element.locked ? "cursor-default" : "cursor-move"} ${selected ? "ring-2 ring-[#D9FF43] ring-offset-1 ring-offset-transparent" : ""}`}
            style={{
              left,
              top,
              width,
              height,
              opacity: element.opacity,
              transform: `rotate(${element.rotation}deg)`,
              zIndex: element.zIndex,
            }}
          >
            {content}
            {selected ? (
              <span className="pointer-events-none absolute -left-1 -top-5 rounded bg-[#D9FF43] px-1.5 py-0.5 text-[8px] font-black uppercase text-[#06142E]">
                {element.name}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
