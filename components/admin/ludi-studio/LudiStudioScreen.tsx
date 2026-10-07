"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CalendarRange,
  Image as ImageIcon,
  Lock,
  Medal,
  Plus,
  Save,
  Share2,
  Sparkles,
  TableProperties,
  Trash2,
  Trophy,
  Type,
  Unlock,
  Upload,
} from "lucide-react";

import AppShell from "@/components/ui/AppShell";
import { useCompetition } from "@/src/contexts/CompetitionContext";
import { useStandings } from "@/src/hooks/useStandings";
import {
  calculateStandings,
} from "@/src/services/standings/StandingsCalculator";
import { useTeams } from "@/src/hooks/useTeams";
import { usePlayers } from "@/src/hooks/usePlayers";
import { useFirebaseIdToken } from "@/src/hooks/useFirebaseIdToken";
import { useUploadThing } from "@/src/utils/uploadthing";

import {
  FirebaseLudiStudioRepository,
} from "@/src/services/ludi-studio/FirebaseLudiStudioRepository";

import type {
  LudiStudioDynamicBinding,
  LudiStudioDynamicImageElement,
  LudiStudioDynamicTextElement,
  LudiStudioElement,
  LudiStudioImageFit,
  LudiStudioRepeaterElement,
  LudiStudioTemplateDefinition,
  LudiStudioTemplateType,
} from "@/src/types/LudiStudio";

import {
  renderLudiStudioSvg,
  type LudiStudioSvgPayload,
  type SvgMatch,
} from "./LudiStudioSvg";
import LudiStudioCanvasEditor from "./LudiStudioCanvasEditor";

import type {
  MatchWizardData,
} from "@/src/types/MatchWizardData";

const TEMPLATE_ITEMS: Array<{
  type: LudiStudioTemplateType;
  label: string;
  description: string;
  icon: typeof CalendarDays;
}> = [
  { type: "matchday", label: "Matchday", description: "Singola partita in programma oggi", icon: CalendarDays },
  { type: "man_of_the_match", label: "Man Of The Match", description: "MVP della singola partita", icon: Medal },
  { type: "score_prediction", label: "Score Prediction", description: "Copertina del pronostico", icon: Sparkles },
  { type: "standings", label: "Classifica", description: "Classifica della competizione", icon: TableProperties },
  { type: "results", label: "Risultati", description: "Risultati della giornata", icon: Trophy },
  { type: "fixtures", label: "Programma", description: "Programma della giornata", icon: CalendarRange },
  { type: "match_report", label: "Tabellino", description: "Grafica condivisa dagli utenti dal Match Report", icon: Share2 },
];

const DYNAMIC_FIELDS: Record<LudiStudioTemplateType, Array<{
  binding: LudiStudioDynamicBinding;
  label: string;
  kind: "text" | "image" | "repeater";
}>> = {
  matchday: [
    { binding: "matchweek", label: "Matchweek", kind: "text" },
    { binding: "matchTime", label: "Ora partita", kind: "text" },
    { binding: "matchDate", label: "Data partita", kind: "text" },
    { binding: "homeTeamLogo", label: "Logo squadra casa", kind: "image" },
    { binding: "awayTeamLogo", label: "Logo squadra ospite", kind: "image" },
    { binding: "homeTeamName", label: "Nome squadra casa", kind: "text" },
    { binding: "awayTeamName", label: "Nome squadra ospite", kind: "text" },
    { binding: "venue", label: "Impianto", kind: "text" },
  ],
  man_of_the_match: [
    { binding: "playerPhoto", label: "Foto giocatore", kind: "image" },
    { binding: "playerName", label: "Nome giocatore", kind: "text" },
    { binding: "playerTeamName", label: "Squadra giocatore", kind: "text" },
    { binding: "playerTeamLogo", label: "Logo squadra giocatore", kind: "image" },
    { binding: "playerRating", label: "Voto", kind: "text" },
    { binding: "matchweek", label: "Matchweek", kind: "text" },
    { binding: "matchScore", label: "Risultato", kind: "text" },
  ],
  score_prediction: [
    { binding: "matchweek", label: "Matchweek", kind: "text" },
    { binding: "matchDate", label: "Data partita", kind: "text" },
    { binding: "matchTime", label: "Ora partita", kind: "text" },
    { binding: "homeTeamLogo", label: "Logo squadra casa", kind: "image" },
    { binding: "awayTeamLogo", label: "Logo squadra ospite", kind: "image" },
    { binding: "homeTeamName", label: "Nome squadra casa", kind: "text" },
    { binding: "awayTeamName", label: "Nome squadra ospite", kind: "text" },
  ],
  standings: [
    { binding: "matchweek", label: "Matchweek di riferimento", kind: "text" },
    ...Array.from(
      { length: 20 },
      (_, index) => {
        const position = index + 1;

        return [
          {
            binding:
              `standing${position}Row` as LudiStudioDynamicBinding,
            label:
              `${position}° posto · Riga classifica`,
            kind:
              "repeater" as const,
          },
        ];
      },
    ).flat(),
    { binding: "standingsTable", label: "Tabella classifica completa", kind: "repeater" },
  ],
  results: [
    { binding: "matchweek", label: "Matchweek", kind: "text" },
    { binding: "resultsList", label: "Lista risultati", kind: "repeater" },
  ],
  fixtures: [
    { binding: "matchweek", label: "Matchweek", kind: "text" },
    { binding: "fixturesList", label: "Lista programma", kind: "repeater" },
  ],
  match_report: [
    { binding: "matchweek", label: "Matchweek", kind: "text" },
    { binding: "matchDate", label: "Data partita", kind: "text" },
    { binding: "matchTime", label: "Ora partita", kind: "text" },
    { binding: "homeTeamLogo", label: "Logo squadra casa", kind: "image" },
    { binding: "awayTeamLogo", label: "Logo squadra ospite", kind: "image" },
    { binding: "homeTeamName", label: "Nome squadra casa", kind: "text" },
    { binding: "homeTeamAlias", label: "Alias squadra casa", kind: "text" },
    { binding: "awayTeamName", label: "Nome squadra ospite", kind: "text" },
    { binding: "awayTeamAlias", label: "Alias squadra ospite", kind: "text" },
    { binding: "homeScore", label: "Gol squadra casa", kind: "text" },
    { binding: "awayScore", label: "Gol squadra ospite", kind: "text" },
    { binding: "matchScore", label: "Risultato completo", kind: "text" },
    { binding: "homeGoalsList", label: "Marcatori casa", kind: "repeater" },
    { binding: "awayGoalsList", label: "Marcatori ospiti", kind: "repeater" },
    { binding: "homeSanctionsList", label: "Sanzioni casa", kind: "repeater" },
    { binding: "awaySanctionsList", label: "Sanzioni ospiti", kind: "repeater" },
    { binding: "playerPhoto", label: "Foto MVP", kind: "image" },
    { binding: "playerName", label: "Nome MVP", kind: "text" },
    { binding: "playerTeamName", label: "Squadra MVP", kind: "text" },
    { binding: "playerTeamLogo", label: "Logo squadra MVP", kind: "image" },
    { binding: "playerRating", label: "Voto MVP", kind: "text" },
  ],
};

type StudioSelectableMatch = {
  id: string | number;
  matchweek: number;
  date: string;
  time: string;
  homeTeamId: string | number;
  awayTeamId: string | number;
  venue?: string;
};

const FONT_OPTIONS = [
  "Arial",
  "Helvetica",
  "Impact",
  "Georgia",
  "Times New Roman",
  "Verdana",
  "Trebuchet MS",
];

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function newId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2)}`;
}

type StudioPlayer = {
  firstName: string;
  lastName: string;
  photoUrl?: string;
};

function studioPlayerName(
  playerId: string | number,
  playersById: Map<string, StudioPlayer>,
) {
  const player =
    playersById.get(
      String(playerId),
    );

  if (!player) {
    return "Giocatore";
  }

  return `${player.firstName} ${player.lastName}`.trim() || "Giocatore";
}

function studioGoalMinute(
  minute: number,
  stoppageTime?: number,
) {
  return stoppageTime && stoppageTime > 0
    ? `${minute}+${stoppageTime}'`
    : `${minute}'`;
}

function buildStudioGoalLines({
  data,
  teamId,
  playersById,
}: {
  data: MatchWizardData;
  teamId: string;
  playersById: Map<string, StudioPlayer>;
}) {
  const grouped =
    new Map<
      string,
      {
        name: string;
        minutes: string[];
        firstMinute: number;
        firstStoppage: number;
      }
    >();

  data.goals
    .filter(
      (goal) =>
        String(goal.teamId) ===
        String(teamId),
    )
    .slice()
    .sort(
      (first, second) =>
        first.minute - second.minute ||
        (first.stoppageTime ?? 0) -
          (second.stoppageTime ?? 0),
    )
    .forEach((goal) => {
      const scorerId =
        String(
          goal.scorerPlayerId,
        );

      const key =
        `${scorerId}:${goal.type}`;

      const name =
        `${studioPlayerName(
          scorerId,
          playersById,
        )}${
          goal.type === "ownGoal"
            ? " (aut.)"
            : ""
        }`;

      const current =
        grouped.get(key);

      if (current) {
        current.minutes.push(
          studioGoalMinute(
            goal.minute,
            goal.stoppageTime,
          ),
        );
        return;
      }

      grouped.set(
        key,
        {
          name,
          minutes: [
            studioGoalMinute(
              goal.minute,
              goal.stoppageTime,
            ),
          ],
          firstMinute:
            goal.minute,
          firstStoppage:
            goal.stoppageTime ??
            0,
        },
      );
    });

  const lines =
    Array.from(
      grouped.values(),
    )
      .sort(
        (first, second) =>
          first.firstMinute -
            second.firstMinute ||
          first.firstStoppage -
            second.firstStoppage,
      )
      .map(
        (entry) =>
          `${entry.name} ${entry.minutes.join(", ")}`,
      );

  return lines.length > 0
    ? lines
    : ["Nessuna rete."];
}

function buildStudioSanctionLines({
  data,
  playerIds,
  playersById,
}: {
  data: MatchWizardData;
  playerIds: Array<string | number>;
  playersById: Map<string, StudioPlayer>;
}) {
  const teamPlayerIds =
    new Set(
      playerIds.map(String),
    );

  const lines =
    Object.values(
      data.performances,
    )
      .filter(
        (performance) =>
          teamPlayerIds.has(
            String(
              performance.playerId,
            ),
          ) &&
          (
            (performance.yellowCards ?? 0) > 0 ||
            (performance.redCards ?? 0) > 0
          ),
      )
      .map((performance) => {
        const sanctions = [
          (performance.yellowCards ?? 0) > 0
            ? `${performance.yellowCards} G`
            : "",
          (performance.redCards ?? 0) > 0
            ? `${performance.redCards} R`
            : "",
        ]
          .filter(Boolean)
          .join(" · ");

        return `${studioPlayerName(
          performance.playerId,
          playersById,
        )} · ${sanctions}`;
      });

  return lines.length > 0
    ? lines
    : ["Nessuno."];
}

function standingRowEffectiveWidth(
  element: LudiStudioRepeaterElement,
) {
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

function normalizeStandingRowWidths(
  template:
    LudiStudioTemplateDefinition,
) {
  let changed =
    false;

  const elements =
    template.elements.map(
      (element) => {
        if (
          element.kind !==
            "repeater" ||
          !/^standing\d+Row$/.test(
            element.binding,
          )
        ) {
          return element;
        }

        const width =
          standingRowEffectiveWidth(
            element,
          );

        if (
          element.width ===
          width
        ) {
          return element;
        }

        changed =
          true;

        return {
          ...element,
          width,
        };
      },
    );

  return {
    template:
      changed
        ? {
            ...template,
            elements,
          }
        : template,
    changed,
  };
}

export default function LudiStudioScreen() {
  const {
    currentSeason,
    selectedCompetition,
    isLoading: competitionLoading,
  } = useCompetition();

  const {
    teams,
    isLoading: teamsLoading,
  } = useTeams();

  const {
    players,
    isLoading: playersLoading,
  } = usePlayers();

  const {
    standings,
    matches,
    reports,
    isLoading: standingsLoading,
  } = useStandings(
    currentSeason?.id,
    currentSeason?.competitionId,
  );

  const { idToken } = useFirebaseIdToken();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [templateType, setTemplateType] = useState<LudiStudioTemplateType>("matchday");

  const [templateState, setTemplateState] = useState<{
    key: string;
    value: LudiStudioTemplateDefinition;
  } | null>(null);

  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  /*
   * Questi due state rappresentano soltanto la preferenza esplicita
   * dell'utente. Il valore effettivo viene derivato dai dati disponibili,
   * evitando setState sincroni dentro useEffect.
   */
  const [selectedMatchweekPreference, setSelectedMatchweek] = useState(1);
  const [selectedMatchIdPreference, setSelectedMatchId] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [playerTeam, setPlayerTeam] = useState("");
  const [playerPhotoUrl, setPlayerPhotoUrl] = useState("");
  const [playerRating, setPlayerRating] = useState("");
  const [uploadTarget, setUploadTarget] = useState<"background" | "static-image" | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTemplateDirty, setIsTemplateDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [todayKey] = useState(() => localDateKey(new Date()));

  const {
    startUpload,
    isUploading,
  } = useUploadThing("playerPhotoUploader", {
    headers: () => ({
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    }),
    onClientUploadComplete(files) {
      const uploaded = files?.[0];
      const url = uploaded?.ufsUrl ?? uploaded?.url;
      if (!url) {
        setError("Upload completato senza URL disponibile.");
        return;
      }

      if (uploadTarget === "background") {
        updateTemplate({ backgroundImageUrl: url });
        setMessage("Sfondo importato. Salva il template per conservarlo.");
      } else if (uploadTarget === "static-image") {
        addStaticImage(url);
      }

      setUploadTarget(null);
      setError(null);
    },
    onUploadError(uploadError) {
      setError(uploadError.message);
      setUploadTarget(null);
    },
  });

  const competitionId = currentSeason?.competitionId ?? selectedCompetition?.id ?? "";
  const competitionName = selectedCompetition?.name ?? "Ludi League";
  const seasonName = currentSeason?.name ?? "";

  const templateKey =
    `${competitionId}::${templateType}`;

  const template =
    templateState?.key === templateKey
      ? templateState.value
      : null;

  useEffect(() => {
    if (!competitionId) return;

    let cancelled = false;

    FirebaseLudiStudioRepository
      .ensureTemplate(
        competitionId,
        templateType,
      )
      .then((value) => {
        if (cancelled) return;

        const normalized =
          normalizeStandingRowWidths(
            value,
          );

        setTemplateState({
          key: templateKey,
          value:
            normalized.template,
        });

        setSelectedElementId(null);
        setIsTemplateDirty(
          normalized.changed,
        );
        setError(null);
      })
      .catch((current) => {
        if (cancelled) return;

        setError(
          current instanceof Error
            ? current.message
            : "Impossibile caricare il template.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [
    competitionId,
    templateKey,
    templateType,
  ]);

  const matchweeks = useMemo(
    () => Array.from(new Set(matches.map((match) => match.matchweek))).sort((a, b) => a - b),
    [matches],
  );

  const selectedMatchweek =
    useMemo(() => {
      if (matchweeks.length === 0) {
        return selectedMatchweekPreference;
      }

      const latestMatchweek =
        matchweeks[
          matchweeks.length - 1
        ];

      if (
        templateType ===
        "fixtures"
      ) {
        return latestMatchweek;
      }

      return matchweeks.includes(
        selectedMatchweekPreference,
      )
        ? selectedMatchweekPreference
        : latestMatchweek;
    }, [
      matchweeks,
      selectedMatchweekPreference,
      templateType,
    ]);

  const teamsById = useMemo(
    () => new Map(teams.map((team) => [String(team.id), team])),
    [teams],
  );

  const reportsByMatchId = useMemo(
    () => new Map(reports.map((report) => [String(report.matchId), report])),
    [reports],
  );

  const standingsAtSelectedMatchweek =
    useMemo(
      () => {
        const matchesThroughMatchweek =
          matches.filter(
            (match) =>
              match.matchweek <=
              selectedMatchweek,
          );

        const matchIds =
          new Set(
            matchesThroughMatchweek.map(
              (match) =>
                String(
                  match.id,
                ),
            ),
          );

        const reportsThroughMatchweek =
          reports.filter(
            (report) =>
              matchIds.has(
                String(
                  report.matchId,
                ),
              ),
          );

        return calculateStandings(
          matchesThroughMatchweek,
          reportsThroughMatchweek,
          {
            competitionId:
              currentSeason?.competitionId,
            teamIds:
              standings.map(
                (standing) =>
                  standing.teamId,
              ),
          },
        );
      },
      [
        matches,
        reports,
        selectedMatchweek,
        currentSeason?.competitionId,
        standings,
      ],
    );

  const playersById = useMemo(
    () =>
      new Map(
        players.map(
          (player) => [
            String(player.id),
            {
              firstName:
                player.firstName,
              lastName:
                player.lastName,
              photoUrl:
                player.photoUrl,
            },
          ],
        ),
      ),
    [players],
  );

  const publishedReportMatches =
    useMemo(
      () =>
        matches.filter(
          (match) =>
            reportsByMatchId.has(
              String(match.id),
            ),
        ),
      [
        matches,
        reportsByMatchId,
      ],
    );

  const weekMatches = useMemo(
    () => matches
      .filter((match) => match.matchweek === selectedMatchweek)
      .slice()
      .sort((a, b) => `${a.date}|${a.time}`.localeCompare(`${b.date}|${b.time}`)),
    [matches, selectedMatchweek],
  );

  const todayMatches = useMemo(
    () => matches
      .filter((match) => match.date === todayKey)
      .slice()
      .sort((a, b) => a.time.localeCompare(b.time)),
    [matches, todayKey],
  );

  const selectableMatches =
    templateType === "matchday"
      ? todayMatches
      : templateType === "match_report"
        ? publishedReportMatches
        : matches;

  const selectedMatchId =
    selectableMatches.some(
      (match) =>
        String(match.id) ===
        selectedMatchIdPreference,
    )
      ? selectedMatchIdPreference
      : selectableMatches[0]
        ? String(
            selectableMatches[0].id,
          )
        : "";

  function toSvgMatch(match: StudioSelectableMatch): SvgMatch {
    const home = teamsById.get(String(match.homeTeamId));
    const away = teamsById.get(String(match.awayTeamId));
    const report =
      reportsByMatchId.get(
        String(match.id),
      );

    const homeScore =
      typeof report?.data.homeScore ===
      "number"
        ? report.data.homeScore
        : undefined;

    const awayScore =
      typeof report?.data.awayScore ===
      "number"
        ? report.data.awayScore
        : undefined;

    return {
      id: String(match.id),
      matchweek: match.matchweek,
      home: {
        name: home?.name || "Casa",
        aliasName: home?.aliasName?.trim() || home?.name || "Casa",
        logoUrl: home?.logoUrl,
      },
      away: {
        name: away?.name || "Ospite",
        aliasName: away?.aliasName?.trim() || away?.name || "Ospite",
        logoUrl: away?.logoUrl,
      },
      date: match.date,
      time: match.time,
      venue: "venue" in match && typeof match.venue === "string" ? match.venue : "Centro Sportivo Ludi",
      homeScore,
      awayScore,
      score:
        typeof homeScore === "number" && typeof awayScore === "number"
          ? `${homeScore} - ${awayScore}`
          : "-",
    };
  }

  const selectedMatch = useMemo(
    () => matches.find((match) => String(match.id) === selectedMatchId),
    [matches, selectedMatchId],
  );

  function buildPayload(): LudiStudioSvgPayload {
    const base = {
      templateType,
      competitionName,
      seasonName,
      title: TEMPLATE_ITEMS.find((item) => item.type === templateType)?.label ?? "Ludi Studio",
    } satisfies Pick<LudiStudioSvgPayload, "templateType" | "competitionName" | "seasonName" | "title">;

    if (templateType === "standings") {
      return {
        ...base,
        subtitle:
          `Matchweek ${selectedMatchweek}`,
        standings:
          standingsAtSelectedMatchweek.map(
            (standing, index) => {
              const team =
                teamsById.get(
                  String(
                    standing.teamId,
                  ),
                );

              return {
                position:
                  index + 1,
                team: {
                  name:
                    team?.name ??
                    "Squadra",
                  aliasName:
                    team?.aliasName?.trim() ||
                    team?.name ||
                    "Squadra",
                  logoUrl:
                    team?.logoUrl,
                },
                points:
                  standing.points,
                played:
                  standing.played,
                wins:
                  standing.won,
                draws:
                  standing.drawn,
                losses:
                  standing.lost,
                goalDifference:
                  standing.goalDifference,
              };
            },
          ),
      };
    }

    if (templateType === "matchday" || templateType === "score_prediction") {
      return {
        ...base,
        match: selectedMatch ? toSvgMatch(selectedMatch) : undefined,
      };
    }

    if (templateType === "match_report") {
      const report =
        selectedMatch
          ? reportsByMatchId.get(
              String(
                selectedMatch.id,
              ),
            )
          : undefined;

      const data =
        report?.data;

      const homeTeam =
        selectedMatch
          ? teamsById.get(
              String(
                selectedMatch.homeTeamId,
              ),
            )
          : undefined;

      const awayTeam =
        selectedMatch
          ? teamsById.get(
              String(
                selectedMatch.awayTeamId,
              ),
            )
          : undefined;

      const mvpId =
        data?.mvpPlayerId !==
        undefined
          ? String(
              data.mvpPlayerId,
            )
          : "";

      const mvpPerformance =
        mvpId && data
          ? Object.values(
              data.performances,
            ).find(
              (performance) =>
                String(
                  performance.playerId,
                ) ===
                mvpId,
            )
          : undefined;

      const mvpIsHome =
        Boolean(
          mvpId &&
          data?.homePresentPlayerIds
            .map(String)
            .includes(mvpId),
        );

      const mvpIsAway =
        Boolean(
          mvpId &&
          data?.awayPresentPlayerIds
            .map(String)
            .includes(mvpId),
        );

      const mvpTeam =
        mvpIsHome
          ? homeTeam
          : mvpIsAway
            ? awayTeam
            : undefined;

      return {
        ...base,
        match:
          selectedMatch
            ? toSvgMatch(
                selectedMatch,
              )
            : undefined,
        homeGoals:
          data &&
          selectedMatch
            ? buildStudioGoalLines({
                data,
                teamId:
                  String(
                    selectedMatch.homeTeamId,
                  ),
                playersById,
              })
            : [],
        awayGoals:
          data &&
          selectedMatch
            ? buildStudioGoalLines({
                data,
                teamId:
                  String(
                    selectedMatch.awayTeamId,
                  ),
                playersById,
              })
            : [],
        homeSanctions:
          data
            ? buildStudioSanctionLines({
                data,
                playerIds:
                  data.homePresentPlayerIds,
                playersById,
              })
            : [],
        awaySanctions:
          data
            ? buildStudioSanctionLines({
                data,
                playerIds:
                  data.awayPresentPlayerIds,
                playersById,
              })
            : [],
        playerName:
          mvpId
            ? studioPlayerName(
                mvpId,
                playersById,
              )
            : "",
        playerTeam:
          mvpTeam?.aliasName?.trim() ||
          mvpTeam?.name ||
          "",
        playerTeamLogoUrl:
          mvpTeam?.logoUrl,
        playerPhotoUrl:
          data?.mvpPhotoUrl ||
          (
            mvpId
              ? playersById.get(
                  mvpId,
                )?.photoUrl
              : undefined
          ),
        playerRating:
          mvpPerformance?.status ===
            "rated"
            ? mvpPerformance.vote
            : "",
      };
    }

    if (templateType === "man_of_the_match") {
      return {
        ...base,
        match: selectedMatch ? toSvgMatch(selectedMatch) : undefined,
        playerName,
        playerTeam,
        playerPhotoUrl,
        playerRating,
      };
    }

    return {
      ...base,
      matches: weekMatches.map(toSvgMatch),
    };
  }

  function updateTemplate(
    patch: Partial<LudiStudioTemplateDefinition>,
  ) {
    setTemplateState(
      (current) => {
        if (
          !current ||
          current.key !==
            templateKey
        ) {
          return current;
        }

        return {
          ...current,
          value: {
            ...current.value,
            ...patch,
          },
        };
      },
    );

    setIsTemplateDirty(true);
  }

  function updateElements(elements: LudiStudioElement[]) {
    updateTemplate({ elements });
  }

  function addStaticText() {
    if (!template) return;
    const id = newId("text");
    const maxZ = Math.max(0, ...template.elements.map((element) => element.zIndex));

    const element: LudiStudioElement = {
      id,
      name: "Testo statico",
      kind: "text",
      source: "static",
      text: "TESTO",
      x: 190,
      y: 260,
      width: 700,
      height: 90,
      opacity: 1,
      rotation: 0,
      zIndex: maxZ + 1,
      fontFamily: "Arial",
      fontSize: 54,
      fontWeight: 900,
      color: "#ffffff",
      align: "center",
      letterSpacing: 0,
      lineHeight: 1.05,
    };

    updateElements([...template.elements, element]);
    setSelectedElementId(id);
  }

  function addStaticImage(imageUrl: string) {
    if (!template) return;
    const id = newId("image");
    const maxZ = Math.max(0, ...template.elements.map((element) => element.zIndex));

    const element: LudiStudioElement = {
      id,
      name: "Immagine statica",
      kind: "image",
      source: "static",
      imageUrl,
      x: 290,
      y: 450,
      width: 500,
      height: 500,
      opacity: 1,
      rotation: 0,
      zIndex: maxZ + 1,
      fit: "contain",
      borderRadius: 0,
    };

    updateElements([...template.elements, element]);
    setSelectedElementId(id);
    setMessage("Immagine aggiunta. Posizionala e salva il template.");
  }

  function addDynamicField(binding: LudiStudioDynamicBinding) {
    if (!template) return;
    const definition = DYNAMIC_FIELDS[templateType].find((field) => field.binding === binding);
    if (!definition) return;

    const id = newId("dynamic");
    const maxZ = Math.max(0, ...template.elements.map((element) => element.zIndex));
    let element: LudiStudioElement;

    if (definition.kind === "image") {
      element = {
        id,
        name: definition.label,
        kind: "image",
        source: "dynamic",
        binding:
          binding as
            LudiStudioDynamicImageElement["binding"],
        x: 340,
        y: 600,
        width: 400,
        height: 400,
        opacity: 1,
        rotation: 0,
        zIndex: maxZ + 1,
        fit: "contain",
        borderRadius: 0,
      };
    } else if (definition.kind === "repeater") {
      const isStandingTeamBinding =
        /^standing\d+Team$/.test(
          binding,
        );

      const isStandingRowBinding =
        /^standing\d+Row$/.test(
          binding,
        );

      element = {
        id,
        name: definition.label,
        kind: "repeater",
        source: "dynamic",
        binding: binding as LudiStudioRepeaterElement["binding"],
        x:
          isStandingRowBinding
            ? 70
            : isStandingTeamBinding
              ? 120
              : 70,
        y:
          isStandingRowBinding
            ? 500
            : isStandingTeamBinding
              ? 500
              : 250,
        width:
          isStandingRowBinding
            ? 780
            : isStandingTeamBinding
              ? 420
              : 940,
        height:
          isStandingRowBinding
            ? 88
            : isStandingTeamBinding
              ? 88
              : template.height - 330,
        opacity: 1,
        rotation: 0,
        zIndex: maxZ + 1,
        rowHeight:
          isStandingRowBinding ||
          isStandingTeamBinding
            ? 88
            : binding === "standingsTable"
              ? 72
              : binding === "fixturesList"
                ? 118
                : binding.endsWith("GoalsList") ||
                    binding.endsWith("SanctionsList")
                  ? 48
                  : 96,
        rowGap:
          isStandingRowBinding ||
          isStandingTeamBinding
            ? 0
            : binding === "fixturesList"
              ? 18
              : binding.endsWith("GoalsList") ||
                  binding.endsWith("SanctionsList")
                ? 8
                : 12,
        maxRows:
          isStandingRowBinding ||
          isStandingTeamBinding
            ? 1
            : binding === "standingsTable"
              ? 12
              : 8,
        logoSize:
          isStandingRowBinding
            ? 58
            : isStandingTeamBinding
              ? 62
              : binding === "standingsTable"
                ? 44
                : binding === "fixturesList"
                  ? 64
                  : binding.endsWith("GoalsList") ||
                      binding.endsWith("SanctionsList")
                    ? 0
                    : 58,
        fontFamily: "Arial",
        fontSize:
          isStandingRowBinding
            ? 30
            : isStandingTeamBinding
              ? 32
              : binding === "fixturesList"
                ? 30
                : binding.endsWith("GoalsList") ||
                    binding.endsWith("SanctionsList")
                  ? 27
                  : 26,
        fontWeight: 900,
        color:
          isStandingRowBinding ||
          isStandingTeamBinding ||
          binding === "fixturesList" ||
          binding === "resultsList" ||
          binding.endsWith("GoalsList") ||
          binding.endsWith("SanctionsList")
            ? "#ffffff"
            : "#07162f",
        surfaceColor:
          isStandingRowBinding ||
          isStandingTeamBinding ||
          binding === "fixturesList" ||
          binding === "resultsList" ||
          binding.endsWith("GoalsList") ||
          binding.endsWith("SanctionsList")
            ? "transparent"
            : "#eef1f4",
        accentColor: "#d9ff43",
        showLogos:
          !(
            binding.endsWith("GoalsList") ||
            binding.endsWith("SanctionsList")
          ),
        showNames: true,
        showDate:
          !isStandingRowBinding &&
          !isStandingTeamBinding &&
          binding !== "standingsTable" &&
          !binding.endsWith("GoalsList") &&
          !binding.endsWith("SanctionsList"),
        showTime:
          !isStandingRowBinding &&
          !isStandingTeamBinding &&
          binding !== "standingsTable" &&
          !binding.endsWith("GoalsList") &&
          !binding.endsWith("SanctionsList"),

        ...(binding === "resultsList"
          ? {
              resultHomeNameWidth: 300,
              resultHomeLogoWidth: 90,
              resultCenterWidth: 160,
              resultAwayLogoWidth: 90,
              resultAwayNameWidth: 300,

              resultHomeNameFontSize: 30,
              resultHomeNameFontWeight: 700,
              resultHomeNameColor: "#ffffff",
              resultHomeNameAlign: "right" as const,

              resultHomeLogoSize: 64,

              resultScoreFontSize: 34,
              resultScoreFontWeight: 900,
              resultScoreColor: "#ffffff",

              resultAwayLogoSize: 64,

              resultAwayNameFontSize: 30,
              resultAwayNameFontWeight: 700,
              resultAwayNameColor: "#ffffff",
              resultAwayNameAlign: "left" as const,
            }
          : {}),

        ...(binding === "fixturesList"
          ? {
              fixtureHomeNameWidth: 300,
              fixtureHomeLogoWidth: 90,
              fixtureCenterWidth: 160,
              fixtureAwayLogoWidth: 90,
              fixtureAwayNameWidth: 300,

              fixtureHomeNameFontSize: 30,
              fixtureHomeNameFontWeight: 700,
              fixtureHomeNameColor: "#ffffff",
              fixtureHomeNameAlign: "right" as const,

              fixtureHomeLogoSize: 64,

              fixtureDateFontSize: 16,
              fixtureDateFontWeight: 700,
              fixtureDateColor: "#ffffff",
              fixtureDateAlign: "center" as const,

              fixtureTimeFontSize: 34,
              fixtureTimeFontWeight: 700,
              fixtureTimeColor: "#ffffff",
              fixtureTimeAlign: "center" as const,

              fixtureAwayLogoSize: 64,

              fixtureAwayNameFontSize: 30,
              fixtureAwayNameFontWeight: 700,
              fixtureAwayNameColor: "#ffffff",
              fixtureAwayNameAlign: "left" as const,
            }
          : {}),

        ...(isStandingRowBinding
          ? {
              standingPositionWidth: 64,
              standingLogoWidth: 82,
              standingTeamWidth: 320,
              standingPlayedWidth: 110,
              standingGoalDifferenceWidth: 100,
              standingPointsWidth: 104,

              standingShowPlayed: true,
              standingShowGoalDifference: true,

              standingPositionFontSize: 30,
              standingPositionFontWeight: 800,
              standingPositionColor: "#ffffff",
              standingPositionAlign: "center" as const,

              standingLogoSize: 58,

              standingTeamFontSize: 32,
              standingTeamFontWeight: 800,
              standingTeamColor: "#ffffff",
              standingTeamAlign: "left" as const,

              standingPointsFontSize: 32,
              standingPointsFontWeight: 900,
              standingPointsColor: "#ffffff",
              standingPointsAlign: "center" as const,

              standingPlayedFontSize: 32,
              standingPlayedFontWeight: 900,
              standingPlayedColor: "#ffffff",
              standingPlayedAlign: "center" as const,

              standingGoalDifferenceFontSize: 32,
              standingGoalDifferenceFontWeight: 900,
              standingGoalDifferenceColor: "#ffffff",
              standingGoalDifferenceAlign: "center" as const,
            }
          : {}),
      };
    } else {
      element = {
        id,
        name: definition.label,
        kind: "text",
        source: "dynamic",
        binding:
          binding as
            LudiStudioDynamicTextElement["binding"],
        fallback: definition.label,
        x: 190,
        y: 350,
        width: 700,
        height: 90,
        opacity: 1,
        rotation: 0,
        zIndex: maxZ + 1,
        fontFamily: "Arial",
        fontSize: 54,
        fontWeight: 900,
        color: "#ffffff",
        align: "center",
        letterSpacing: 0,
        lineHeight: 1.05,
      };
    }

    updateElements([...template.elements, element]);
    setSelectedElementId(id);
  }

  function updateElement(
    id: string,
    patch: Partial<LudiStudioElement>,
  ) {
    if (!template) return;
    updateElements(
      template.elements.map((element) =>
        element.id === id
          ? ({ ...element, ...patch } as LudiStudioElement)
          : element,
      ),
    );
  }

  function removeElement(id: string) {
    if (!template) return;
    updateElements(template.elements.filter((element) => element.id !== id));
    setSelectedElementId(null);
  }

  function moveLayer(id: string, direction: 1 | -1) {
    const current = template?.elements.find((element) => element.id === id);
    if (!current) return;
    updateElement(id, { zIndex: current.zIndex + direction });
  }

  function openUpload(target: "background" | "static-image") {
    setUploadTarget(target);
    fileInputRef.current?.click();
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!idToken) {
      setError("Sessione Admin non disponibile. Ricarica la pagina e riprova.");
      return;
    }
    setError(null);
    await startUpload([file]);
  }

  async function saveTemplate() {
    if (!template) return;
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      await FirebaseLudiStudioRepository.saveTemplate(template);
      setIsTemplateDirty(false);
      setMessage("Template salvato nel database.");
    } catch (current) {
      setError(current instanceof Error ? current.message : "Salvataggio template non riuscito.");
    } finally {
      setIsSaving(false);
    }
  }


  async function downloadAsset() {
    if (!template) return;

    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const renderedSvg =
        renderLudiStudioSvg(
          template,
          buildPayload(),
        );

      /*
       * Prima di trasformare l'SVG in PNG incorporiamo tutte
       * le immagini esterne (sfondo, loghi, foto, ecc.) come
       * data URL. Un SVG caricato tramite blob: non riesce
       * infatti a risolvere in modo affidabile le risorse
       * remote durante il drawImage sul canvas.
       */
      const svg =
        await inlineStudioSvgImages(
          renderedSvg,
        );

      const svgBlob =
        new Blob(
          [svg],
          {
            type:
              "image/svg+xml;charset=utf-8",
          },
        );

      const svgUrl =
        URL.createObjectURL(
          svgBlob,
        );

      try {
        const image =
          await loadStudioImage(
            svgUrl,
          );

        const canvas =
          document.createElement(
            "canvas",
          );

        canvas.width =
          template.width;

        canvas.height =
          template.height;

        const context =
          canvas.getContext(
            "2d",
          );

        if (!context) {
          throw new Error(
            "Canvas non disponibile.",
          );
        }

        context.drawImage(
          image,
          0,
          0,
          canvas.width,
          canvas.height,
        );

        const pngBlob =
          await new Promise<Blob>(
            (
              resolve,
              reject,
            ) => {
              canvas.toBlob(
                (blob) => {
                  if (blob) {
                    resolve(
                      blob,
                    );

                    return;
                  }

                  reject(
                    new Error(
                      "Conversione PNG non riuscita.",
                    ),
                  );
                },
                "image/png",
              );
            },
          );

        const downloadUrl =
          URL.createObjectURL(
            pngBlob,
          );

        try {
          const anchor =
            document.createElement(
              "a",
            );

          anchor.href =
            downloadUrl;

          anchor.download =
            buildStudioDownloadFileName({
              templateType,
              selectedMatchweek,
              selectedMatchId,
            });

          document.body.appendChild(
            anchor,
          );

          anchor.click();
          anchor.remove();
        } finally {
          URL.revokeObjectURL(
            downloadUrl,
          );
        }
      } finally {
        URL.revokeObjectURL(
          svgUrl,
        );
      }

      setMessage(
        "Grafica scaricata sul dispositivo.",
      );
    } catch (current) {
      setError(
        current instanceof Error
          ? current.message
          : "Download grafica non riuscito.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function buildStudioDownloadFileName({
    templateType:
      currentTemplateType,
    selectedMatchweek:
      currentMatchweek,
    selectedMatchId:
      currentMatchId,
  }: {
    templateType:
      LudiStudioTemplateType;
    selectedMatchweek:
      number;
    selectedMatchId:
      string;
  }) {
    const sourceKey =
      currentTemplateType ===
        "matchday" ||
      currentTemplateType ===
        "score_prediction" ||
      currentTemplateType ===
        "man_of_the_match" ||
      currentTemplateType ===
        "match_report"
        ? currentMatchId ||
          "grafica"
        : `mw${currentMatchweek}`;

    return `ludi-studio-${currentTemplateType}-${sourceKey}.png`;
  }

  async function inlineStudioSvgImages(
    svg:
      string,
  ): Promise<string> {
    const parser =
      new DOMParser();

    const document =
      parser.parseFromString(
        svg,
        "image/svg+xml",
      );

    const parserError =
      document.querySelector(
        "parsererror",
      );

    if (parserError) {
      throw new Error(
        "SVG Ludi Studio non valido.",
      );
    }

    const images =
      Array.from(
        document.querySelectorAll(
          "image",
        ),
      );

    const dataUrlBySource =
      new Map<
        string,
        string
      >();

    await Promise.all(
      images.map(
        async (
          image,
        ) => {
          const source =
            image.getAttribute(
              "href",
            ) ??
            image.getAttributeNS(
              "http://www.w3.org/1999/xlink",
              "href",
            );

          if (
            !source ||
            source.startsWith(
              "data:",
            ) ||
            source.startsWith(
              "blob:",
            ) ||
            source.startsWith(
              "#",
            )
          ) {
            return;
          }

          let dataUrl =
            dataUrlBySource.get(
              source,
            );

          if (!dataUrl) {
            const absoluteUrl =
              new URL(
                source,
                window.location.href,
              ).toString();

            const response =
              await fetch(
                absoluteUrl,
                {
                  cache:
                    "force-cache",
                },
              );

            if (!response.ok) {
              throw new Error(
                `Impossibile caricare una risorsa grafica (${response.status}).`,
              );
            }

            const blob =
              await response.blob();

            dataUrl =
              await studioBlobToDataUrl(
                blob,
              );

            dataUrlBySource.set(
              source,
              dataUrl,
            );
          }

          image.setAttribute(
            "href",
            dataUrl,
          );

          image.removeAttributeNS(
            "http://www.w3.org/1999/xlink",
            "href",
          );
        },
      ),
    );

    return new XMLSerializer()
      .serializeToString(
        document.documentElement,
      );
  }

  function studioBlobToDataUrl(
    blob:
      Blob,
  ): Promise<string> {
    return new Promise(
      (
        resolve,
        reject,
      ) => {
        const reader =
          new FileReader();

        reader.onload =
          () => {
            if (
              typeof reader.result ===
              "string"
            ) {
              resolve(
                reader.result,
              );

              return;
            }

            reject(
              new Error(
                "Conversione immagine non riuscita.",
              ),
            );
          };

        reader.onerror =
          () => {
            reject(
              reader.error ??
                new Error(
                  "Lettura immagine non riuscita.",
                ),
            );
          };

        reader.readAsDataURL(
          blob,
        );
      },
    );
  }

  function loadStudioImage(
    source:
      string,
  ): Promise<HTMLImageElement> {
    return new Promise(
      (
        resolve,
        reject,
      ) => {
        const image =
          document.createElement(
            "img",
          );

        image.onload =
          () => {
            resolve(
              image,
            );
          };

        image.onerror =
          () => {
            reject(
              new Error(
                "Impossibile preparare l'immagine per il download.",
              ),
            );
          };

        image.src =
          source;
      },
    );
  }

  const selectedElement = template?.elements.find((element) => element.id === selectedElementId) ?? null;
  const loading =
    competitionLoading ||
    teamsLoading ||
    playersLoading ||
    standingsLoading;

  return (
    <AppShell>
      <main className="min-w-0 pb-10">
        <header className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#06142E]/35">Centro grafico</p>
            <h1 className="mt-1 text-3xl font-black uppercase tracking-[-0.03em] text-[#06142E] sm:text-4xl">Ludi Studio</h1>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-[#06142E]/45">
              Editor visuale condiviso: importa lo sfondo, posiziona gli elementi statici e collega i dati dinamici del sito.
            </p>
          </div>

          {template ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#06142E]/10 bg-white px-3 py-2 text-[10px] font-black uppercase text-[#06142E]/45">
                {template.width} × {template.height}
              </span>

              <span className={`rounded-full px-3 py-2 text-[10px] font-black uppercase ${isTemplateDirty ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>
                {isTemplateDirty ? "Modifiche non salvate" : "Template salvato"}
              </span>
            </div>
          ) : null}
        </header>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => void handleFileSelected(event)}
        />

        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
          {TEMPLATE_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.type === templateType;
            return (
              <button
                key={item.type}
                type="button"
                onClick={() => setTemplateType(item.type)}
                className={`min-h-[132px] rounded-[18px] border p-4 text-left transition ${active ? "border-[#06142E] bg-[#06142E] text-white" : "border-[#06142E]/10 bg-white text-[#06142E]"}`}
              >
                <Icon size={22} />
                <p className="mt-3 text-sm font-black uppercase">{item.label}</p>
                <p className={`mt-1 text-[11px] font-bold ${active ? "text-white/55" : "text-[#06142E]/40"}`}>{item.description}</p>
                <p className={`mt-2 text-[10px] font-black ${active ? "text-[#D9FF43]" : "text-[#06142E]/35"}`}>
                  {item.type === "matchday" ||
                  item.type === "man_of_the_match" ||
                  item.type === "score_prediction" ||
                  item.type === "match_report"
                    ? "1080 × 1920"
                    : "1080 × 1350"}
                </p>
              </button>
            );
          })}
        </section>

        {template ? (
          <section className="mt-5 grid min-w-0 items-start gap-5 xl:grid-cols-[300px_minmax(460px,1fr)_320px] 2xl:grid-cols-[320px_minmax(520px,1fr)_360px]">
            <aside className="min-w-0 space-y-4 xl:sticky xl:top-5 xl:max-h-[calc(100dvh-2.5rem)] xl:overflow-y-auto xl:pr-1">
              <div className="ludi-card p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/40">Sorgente dati</p>
                <h2 className="mt-1 text-xl font-black uppercase text-[#06142E]">
                  {TEMPLATE_ITEMS.find((item) => item.type === templateType)?.label}
                </h2>

                <div className="mt-4 space-y-3">
                  {templateType === "matchday" ? (
                    <>
                      <p className="rounded-[12px] bg-[#06142E]/5 p-3 text-xs font-bold text-[#06142E]/55">
                        Matchday usa esclusivamente le partite in programma oggi ({todayKey}).
                      </p>
                      {todayMatches.length > 0 ? (
                        <MatchSelect
                          label="Partita di oggi"
                          value={selectedMatchId}
                          matches={todayMatches}
                          onChange={setSelectedMatchId}
                          toSvgMatch={toSvgMatch}
                        />
                      ) : (
                        <p className="rounded-[12px] bg-amber-50 p-3 text-sm font-bold text-amber-800">
                          Nessuna partita in programma oggi per questa competizione.
                        </p>
                      )}
                    </>
                  ) : null}

                  {(templateType === "score_prediction" || templateType === "man_of_the_match") ? (
                    <MatchSelect
                      label="Partita"
                      value={selectedMatchId}
                      matches={matches}
                      onChange={setSelectedMatchId}
                      toSvgMatch={toSvgMatch}
                    />
                  ) : null}

                  {templateType === "match_report" ? (
                    publishedReportMatches.length > 0 ? (
                      <>
                        <p className="rounded-[12px] bg-[#06142E]/5 p-3 text-xs font-bold text-[#06142E]/55">
                          Il template usa i dati reali del Match Report pubblicato. Gli utenti genereranno questa grafica automaticamente premendo “Condividi tabellino”.
                        </p>

                        <MatchSelect
                          label="Tabellino di anteprima"
                          value={selectedMatchId}
                          matches={publishedReportMatches}
                          onChange={setSelectedMatchId}
                          toSvgMatch={toSvgMatch}
                        />
                      </>
                    ) : (
                      <p className="rounded-[12px] bg-amber-50 p-3 text-sm font-bold text-amber-800">
                        Nessun tabellino pubblicato disponibile per l’anteprima.
                      </p>
                    )
                  ) : null}

                  {templateType === "results" ||
                  templateType === "standings" ? (
                    <label className="block">
                      <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/45">
                        {templateType === "standings"
                          ? "Matchweek classifica"
                          : "Matchweek"}
                      </span>
                      <select
                        value={selectedMatchweek}
                        onChange={(event) =>
                          setSelectedMatchweek(
                            Number(
                              event.target.value,
                            ),
                          )
                        }
                        className="ludi-input"
                      >
                        {matchweeks.map(
                          (matchweek) => (
                            <option
                              key={matchweek}
                              value={matchweek}
                            >
                              Matchweek {matchweek}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  ) : null}

                  {templateType === "fixtures" ? (
                    <div className="rounded-[12px] bg-[#06142E]/5 p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#06142E]/40">Programma importato automaticamente</p>
                      <p className="mt-1 text-sm font-black text-[#06142E]">
                        {matchweeks.length > 0
                          ? `Matchweek ${matchweeks[matchweeks.length - 1]}`
                          : "Nessuna matchweek disponibile"}
                      </p>
                    </div>
                  ) : null}

                  {templateType === "man_of_the_match" ? (
                    <>
                      <TextField label="Nome giocatore" value={playerName} onChange={setPlayerName} />
                      <TextField label="Squadra" value={playerTeam} onChange={setPlayerTeam} />
                      <TextField label="URL foto giocatore" value={playerPhotoUrl} onChange={setPlayerPhotoUrl} />
                      <TextField label="Voto" value={playerRating} onChange={setPlayerRating} />
                    </>
                  ) : null}
                </div>
              </div>

              <div className="ludi-card p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/40">Elementi</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <ToolButton icon={Upload} label={isUploading && uploadTarget === "background" ? "Upload..." : "Importa sfondo"} onClick={() => openUpload("background")} disabled={isUploading} />
                  <ToolButton icon={Type} label="Testo" onClick={addStaticText} />
                  <ToolButton icon={ImageIcon} label={isUploading && uploadTarget === "static-image" ? "Upload..." : "Immagine"} onClick={() => openUpload("static-image")} disabled={isUploading} />
                </div>

                <label className="mt-3 block">
                  <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/45">Campo dinamico</span>
                  <select
                    defaultValue=""
                    onChange={(event) => {
                      const value = event.target.value as LudiStudioDynamicBinding;
                      if (value) addDynamicField(value);
                      event.target.value = "";
                    }}
                    className="ludi-input"
                  >
                    <option value="">+ Aggiungi campo</option>
                    {DYNAMIC_FIELDS[templateType].map((field) => (
                      <option key={field.binding} value={field.binding}>{field.label}</option>
                    ))}
                  </select>
                </label>

                <div className="mt-4 space-y-2">
                  {template.elements
                    .slice()
                    .sort((a, b) => b.zIndex - a.zIndex)
                    .map((element) => (
                      <button
                        key={element.id}
                        type="button"
                        onClick={() => setSelectedElementId(element.id)}
                        className={`flex w-full items-center justify-between rounded-[11px] px-3 py-2 text-left text-xs font-black ${selectedElementId === element.id ? "bg-[#06142E] text-white" : "bg-[#06142E]/5 text-[#06142E]"}`}
                      >
                        <span className="truncate">{element.name}</span>
                        <span className="text-[9px] opacity-50">{element.kind}</span>
                      </button>
                    ))}
                </div>
              </div>
            </aside>

            <div className="min-w-0">
              <div className="ludi-card p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/40">Editor · Anteprima live</p>
                    <p className="text-sm font-black text-[#06142E]">{template.width} × {template.height}</p>
                  </div>
                  <span className="rounded-full bg-[#06142E]/5 px-3 py-1 text-[10px] font-black uppercase text-[#06142E]/45">
                    Anteprima live
                  </span>
                </div>

                <LudiStudioCanvasEditor
                  template={template}
                  payload={buildPayload()}
                  selectedElementId={selectedElementId}
                  onSelectedElementIdChange={setSelectedElementId}
                  onElementsChange={updateElements}
                />

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => void saveTemplate()} disabled={isSaving || !isTemplateDirty} className="ludi-button-primary min-h-12 disabled:opacity-40">
                    <span className="inline-flex items-center gap-2"><Save size={17} /> Salva template</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void downloadAsset()
                    }
                    disabled={
                      loading ||
                      isSaving ||
                      (
                        (
                          templateType ===
                            "matchday" ||
                          templateType ===
                            "match_report"
                        ) &&
                        !selectedMatchId
                      )
                    }
                    className="min-h-12 rounded-[13px] border border-[#06142E]/10 bg-white px-4 text-sm font-black uppercase text-[#06142E] disabled:opacity-40"
                  >
                    {isSaving
                      ? "Preparazione..."
                      : "Scarica e salva"}
                  </button>
                </div>

                {message ? <p className="mt-3 rounded-[12px] bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</p> : null}
                {error ? <p className="mt-3 rounded-[12px] bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
              </div>
            </div>

            <aside className="min-w-0 xl:sticky xl:top-5 xl:max-h-[calc(100dvh-2.5rem)] xl:overflow-y-auto xl:pl-1">
              <div className="ludi-card p-4 sm:p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/40">Proprietà</p>
                {selectedElement ? (
                  <ElementProperties
                    element={selectedElement}
                    template={template}
                    onChange={(patch) => updateElement(selectedElement.id, patch)}
                    onDelete={() => removeElement(selectedElement.id)}
                    onMoveForward={() => moveLayer(selectedElement.id, 1)}
                    onMoveBackward={() => moveLayer(selectedElement.id, -1)}
                  />
                ) : (
                  <BackgroundProperties
                    template={template}
                    onChange={updateTemplate}
                    onUpload={() => openUpload("background")}
                    uploading={isUploading && uploadTarget === "background"}
                  />
                )}
              </div>
            </aside>
          </section>
        ) : (
          <div className="mt-5 ludi-card p-6 text-center text-sm font-bold text-[#06142E]/45">
            {loading ? "Caricamento Ludi Studio..." : "Seleziona una competizione per iniziare."}
            {error ? <p className="mt-3 text-red-700">{error}</p> : null}
          </div>
        )}
      </main>
    </AppShell>
  );
}

function ToolButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: typeof Plus;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex min-h-11 items-center justify-center gap-2 rounded-[11px] border border-[#06142E]/10 bg-white px-2 text-[10px] font-black uppercase text-[#06142E] disabled:opacity-40">
      <Icon size={15} /> {label}
    </button>
  );
}

function MatchSelect({
  label,
  value,
  matches,
  onChange,
  toSvgMatch,
}: {
  label: string;
  value: string;
  matches: StudioSelectableMatch[];
  onChange: (value: string) => void;
  toSvgMatch: (match: StudioSelectableMatch) => SvgMatch;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/45">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="ludi-input">
        {matches.map((match) => {
          const item = toSvgMatch(match);
          return <option key={String(match.id)} value={String(match.id)}>{item.home.aliasName || item.home.name} - {item.away.aliasName || item.away.name} · {item.time}</option>;
        })}
      </select>
    </label>
  );
}

function BackgroundProperties({
  template,
  onChange,
  onUpload,
  uploading,
}: {
  template: LudiStudioTemplateDefinition;
  onChange: (patch: Partial<LudiStudioTemplateDefinition>) => void;
  onUpload: () => void;
  uploading: boolean;
}) {
  return (
    <div className="mt-4 space-y-4">
      <p className="text-xs font-bold text-[#06142E]/50">Nessun elemento selezionato: stai modificando il canvas.</p>
      <button type="button" onClick={onUpload} disabled={uploading} className="ludi-button-primary w-full disabled:opacity-40">
        <span className="inline-flex items-center gap-2"><Upload size={16} /> {uploading ? "Caricamento..." : "Importa sfondo"}</span>
      </button>
      {template.backgroundImageUrl ? (
        <button type="button" onClick={() => onChange({ backgroundImageUrl: undefined })} className="w-full rounded-[11px] border border-red-200 bg-red-50 px-3 py-3 text-xs font-black uppercase text-red-700">Rimuovi sfondo</button>
      ) : null}
      <ColorField label="Colore canvas" value={template.background} onChange={(background) => onChange({ background })} />
      <SelectField label="Adattamento sfondo" value={template.backgroundFit ?? "cover"} options={["cover", "contain", "fill"]} onChange={(value) => onChange({ backgroundFit: value as LudiStudioImageFit })} />
    </div>
  );
}

function ElementProperties({
  element,
  template,
  onChange,
  onDelete,
  onMoveForward,
  onMoveBackward,
}: {
  element: LudiStudioElement;
  template: LudiStudioTemplateDefinition;
  onChange: (patch: Partial<LudiStudioElement>) => void;
  onDelete: () => void;
  onMoveForward: () => void;
  onMoveBackward: () => void;
}) {
  return (
    <div className="mt-4 space-y-4">
      <TextField label="Nome elemento" value={element.name} onChange={(name) => onChange({ name })} />

      <div className="grid grid-cols-2 gap-2">
        <NumberField label="X" value={element.x} min={0} max={template.width} onChange={(x) => onChange({ x })} />
        <NumberField label="Y" value={element.y} min={0} max={template.height} onChange={(y) => onChange({ y })} />
        <NumberField label="Larghezza" value={element.width} min={10} max={template.width} onChange={(width) => onChange({ width })} />
        <NumberField label="Altezza" value={element.height} min={10} max={template.height} onChange={(height) => onChange({ height })} />
        <NumberField label="Rotazione" value={element.rotation} min={-180} max={180} onChange={(rotation) => onChange({ rotation })} />
        <NumberField label="Opacità %" value={Math.round(element.opacity * 100)} min={0} max={100} onChange={(opacity) => onChange({ opacity: opacity / 100 })} />
      </div>

      {element.kind === "text" ? (
        <>
          {element.source === "static" ? (
            <TextField label="Testo" value={element.text} onChange={(text) => onChange({ text })} />
          ) : null}
          <TextField label="Font" value={element.fontFamily} onChange={(fontFamily) => onChange({ fontFamily })} />
          <div className="flex flex-wrap gap-2">
            {FONT_OPTIONS.map((font) => (
              <button key={font} type="button" onClick={() => onChange({ fontFamily: font })} className={`rounded-full px-3 py-2 text-[10px] font-black ${element.fontFamily === font ? "bg-[#06142E] text-white" : "bg-[#06142E]/5 text-[#06142E]"}`} style={{ fontFamily: font }}>{font}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Font size" value={element.fontSize} min={8} max={250} onChange={(fontSize) => onChange({ fontSize })} />
            <NumberField label="Peso" value={element.fontWeight} min={100} max={900} step={100} onChange={(fontWeight) => onChange({ fontWeight })} />
          </div>
          <ColorField label="Colore" value={element.color} onChange={(color) => onChange({ color })} />
          <SelectField label="Allineamento" value={element.align} options={["left", "center", "right"]} onChange={(align) => onChange({ align: align as "left" | "center" | "right" })} />
        </>
      ) : null}

      {element.kind === "image" ? (
        <>
          <SelectField label="Adattamento" value={element.fit} options={["contain", "cover", "fill"]} onChange={(fit) => onChange({ fit: fit as LudiStudioImageFit })} />
          <NumberField label="Arrotondamento" value={element.borderRadius} min={0} max={300} onChange={(borderRadius) => onChange({ borderRadius })} />
        </>
      ) : null}

      {element.kind === "repeater" ? (
        <RepeaterProperties element={element} onChange={onChange} />
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onMoveForward} className="rounded-[11px] border border-[#06142E]/10 px-3 py-3 text-[10px] font-black uppercase text-[#06142E]"><ArrowUp size={14} className="mx-auto mb-1" />Porta avanti</button>
        <button type="button" onClick={onMoveBackward} className="rounded-[11px] border border-[#06142E]/10 px-3 py-3 text-[10px] font-black uppercase text-[#06142E]"><ArrowDown size={14} className="mx-auto mb-1" />Porta dietro</button>
      </div>

      <button type="button" onClick={() => onChange({ locked: !element.locked })} className="w-full rounded-[11px] border border-[#06142E]/10 px-3 py-3 text-xs font-black uppercase text-[#06142E]">
        <span className="inline-flex items-center gap-2">{element.locked ? <Unlock size={15} /> : <Lock size={15} />}{element.locked ? "Sblocca elemento" : "Blocca elemento"}</span>
      </button>
      <button type="button" onClick={onDelete} className="w-full rounded-[11px] bg-red-50 px-3 py-3 text-xs font-black uppercase text-red-700">
        <span className="inline-flex items-center gap-2"><Trash2 size={15} /> Elimina elemento</span>
      </button>
    </div>
  );
}

function RepeaterProperties({
  element,
  onChange,
}: {
  element: LudiStudioRepeaterElement;
  onChange: (patch: Partial<LudiStudioElement>) => void;
}) {
  const isStandingRow =
    /^standing\d+Row$/.test(
      element.binding,
    );

  if (
    element.binding ===
    "resultsList"
  ) {
    const widths = {
      homeName:
        element.resultHomeNameWidth ??
        300,
      homeLogo:
        element.resultHomeLogoWidth ??
        90,
      center:
        element.resultCenterWidth ??
        160,
      awayLogo:
        element.resultAwayLogoWidth ??
        90,
      awayName:
        element.resultAwayNameWidth ??
        300,
    };

    const updateResultWidth = (
      key:
        | "resultHomeNameWidth"
        | "resultHomeLogoWidth"
        | "resultCenterWidth"
        | "resultAwayLogoWidth"
        | "resultAwayNameWidth",
      value:
        number,
    ) => {
      const nextWidths = {
        ...widths,
        ...(key ===
        "resultHomeNameWidth"
          ? { homeName: value }
          : {}),
        ...(key ===
        "resultHomeLogoWidth"
          ? { homeLogo: value }
          : {}),
        ...(key ===
        "resultCenterWidth"
          ? { center: value }
          : {}),
        ...(key ===
        "resultAwayLogoWidth"
          ? { awayLogo: value }
          : {}),
        ...(key ===
        "resultAwayNameWidth"
          ? { awayName: value }
          : {}),
      };

      onChange({
        [key]:
          value,
        width:
          nextWidths.homeName +
          nextWidths.homeLogo +
          nextWidths.center +
          nextWidths.awayLogo +
          nextWidths.awayName,
      } as Partial<LudiStudioElement>);
    };

    return (
      <div className="space-y-4 rounded-[14px] bg-[#06142E]/[0.04] p-3">
        <div>
          <p className="text-[10px] font-black uppercase text-[#06142E]/40">
            Tabella risultati
          </p>
          <p className="mt-1 text-[11px] font-bold text-[#06142E]/45">
            Modifica la prima riga: le stesse impostazioni vengono applicate automaticamente a tutte le partite.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Altezza riga"
            value={element.rowHeight}
            min={40}
            max={220}
            onChange={(rowHeight) =>
              onChange({
                rowHeight,
              })
            }
          />

          <NumberField
            label="Spazio righe"
            value={element.rowGap}
            min={0}
            max={80}
            onChange={(rowGap) =>
              onChange({
                rowGap,
              })
            }
          />

          <NumberField
            label="Max righe"
            value={element.maxRows}
            min={1}
            max={20}
            onChange={(maxRows) =>
              onChange({
                maxRows,
              })
            }
          />
        </div>

        <StandingTextCellProperties
          title="Squadra casa"
          width={widths.homeName}
          fontSize={
            element.resultHomeNameFontSize ??
            element.fontSize ??
            30
          }
          fontWeight={
            element.resultHomeNameFontWeight ??
            element.fontWeight ??
            700
          }
          color={
            element.resultHomeNameColor ??
            element.color ??
            "#ffffff"
          }
          align={
            element.resultHomeNameAlign ??
            "right"
          }
          onWidth={(value) =>
            updateResultWidth(
              "resultHomeNameWidth",
              value,
            )
          }
          onFontSize={(resultHomeNameFontSize) =>
            onChange({
              resultHomeNameFontSize,
            })
          }
          onFontWeight={(resultHomeNameFontWeight) =>
            onChange({
              resultHomeNameFontWeight,
            })
          }
          onColor={(resultHomeNameColor) =>
            onChange({
              resultHomeNameColor,
            })
          }
          onAlign={(resultHomeNameAlign) =>
            onChange({
              resultHomeNameAlign,
            })
          }
        />

        <FixtureLogoColumnProperties
          title="Logo casa"
          width={widths.homeLogo}
          logoSize={
            element.resultHomeLogoSize ??
            element.logoSize ??
            64
          }
          onWidth={(value) =>
            updateResultWidth(
              "resultHomeLogoWidth",
              value,
            )
          }
          onLogoSize={(resultHomeLogoSize) =>
            onChange({
              resultHomeLogoSize,
            })
          }
        />

        <div className="space-y-3 rounded-[12px] border border-[#06142E]/10 bg-white p-3">
          <p className="text-xs font-black uppercase text-[#06142E]">
            Colonna centrale · Risultato
          </p>

          <NumberField
            label="Larghezza colonna"
            value={widths.center}
            min={60}
            max={400}
            onChange={(value) =>
              updateResultWidth(
                "resultCenterWidth",
                value,
              )
            }
          />

          <FixtureCenterTextProperties
            title="Punteggio · 3 | 3"
            fontSize={
              element.resultScoreFontSize ??
              Math.max(
                24,
                Math.round(
                  element.fontSize *
                    1.12,
                ),
              )
            }
            fontWeight={
              element.resultScoreFontWeight ??
              900
            }
            color={
              element.resultScoreColor ??
              element.color ??
              "#ffffff"
            }
            align="center"
            onFontSize={(resultScoreFontSize) =>
              onChange({
                resultScoreFontSize,
              })
            }
            onFontWeight={(resultScoreFontWeight) =>
              onChange({
                resultScoreFontWeight,
              })
            }
            onColor={(resultScoreColor) =>
              onChange({
                resultScoreColor,
              })
            }
            onAlign={() => {}}
          />

          <p className="text-[10px] font-bold text-[#06142E]/45">
            Il divisore | resta sempre ancorato al centro della colonna, anche con punteggi a doppia cifra.
          </p>
        </div>

        <FixtureLogoColumnProperties
          title="Logo ospite"
          width={widths.awayLogo}
          logoSize={
            element.resultAwayLogoSize ??
            element.logoSize ??
            64
          }
          onWidth={(value) =>
            updateResultWidth(
              "resultAwayLogoWidth",
              value,
            )
          }
          onLogoSize={(resultAwayLogoSize) =>
            onChange({
              resultAwayLogoSize,
            })
          }
        />

        <StandingTextCellProperties
          title="Squadra ospite"
          width={widths.awayName}
          fontSize={
            element.resultAwayNameFontSize ??
            element.fontSize ??
            30
          }
          fontWeight={
            element.resultAwayNameFontWeight ??
            element.fontWeight ??
            700
          }
          color={
            element.resultAwayNameColor ??
            element.color ??
            "#ffffff"
          }
          align={
            element.resultAwayNameAlign ??
            "left"
          }
          onWidth={(value) =>
            updateResultWidth(
              "resultAwayNameWidth",
              value,
            )
          }
          onFontSize={(resultAwayNameFontSize) =>
            onChange({
              resultAwayNameFontSize,
            })
          }
          onFontWeight={(resultAwayNameFontWeight) =>
            onChange({
              resultAwayNameFontWeight,
            })
          }
          onColor={(resultAwayNameColor) =>
            onChange({
              resultAwayNameColor,
            })
          }
          onAlign={(resultAwayNameAlign) =>
            onChange({
              resultAwayNameAlign,
            })
          }
        />
      </div>
    );
  }

  if (
    element.binding ===
    "fixturesList"
  ) {
    const widths = {
      homeName:
        element.fixtureHomeNameWidth ??
        300,
      homeLogo:
        element.fixtureHomeLogoWidth ??
        90,
      center:
        element.fixtureCenterWidth ??
        160,
      awayLogo:
        element.fixtureAwayLogoWidth ??
        90,
      awayName:
        element.fixtureAwayNameWidth ??
        300,
    };

    const updateFixtureWidth = (
      key:
        | "fixtureHomeNameWidth"
        | "fixtureHomeLogoWidth"
        | "fixtureCenterWidth"
        | "fixtureAwayLogoWidth"
        | "fixtureAwayNameWidth",
      value:
        number,
    ) => {
      const nextWidths = {
        ...widths,
        ...(key ===
        "fixtureHomeNameWidth"
          ? { homeName: value }
          : {}),
        ...(key ===
        "fixtureHomeLogoWidth"
          ? { homeLogo: value }
          : {}),
        ...(key ===
        "fixtureCenterWidth"
          ? { center: value }
          : {}),
        ...(key ===
        "fixtureAwayLogoWidth"
          ? { awayLogo: value }
          : {}),
        ...(key ===
        "fixtureAwayNameWidth"
          ? { awayName: value }
          : {}),
      };

      onChange({
        [key]:
          value,
        width:
          nextWidths.homeName +
          nextWidths.homeLogo +
          nextWidths.center +
          nextWidths.awayLogo +
          nextWidths.awayName,
      } as Partial<LudiStudioElement>);
    };

    return (
      <div className="space-y-4 rounded-[14px] bg-[#06142E]/[0.04] p-3">
        <div>
          <p className="text-[10px] font-black uppercase text-[#06142E]/40">
            Tabella programma
          </p>
          <p className="mt-1 text-[11px] font-bold text-[#06142E]/45">
            Modifica la prima riga: le stesse impostazioni vengono applicate automaticamente a tutte le partite.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Altezza riga"
            value={element.rowHeight}
            min={40}
            max={220}
            onChange={(rowHeight) =>
              onChange({
                rowHeight,
              })
            }
          />

          <NumberField
            label="Spazio righe"
            value={element.rowGap}
            min={0}
            max={80}
            onChange={(rowGap) =>
              onChange({
                rowGap,
              })
            }
          />

          <NumberField
            label="Max righe"
            value={element.maxRows}
            min={1}
            max={20}
            onChange={(maxRows) =>
              onChange({
                maxRows,
              })
            }
          />
        </div>

        <StandingTextCellProperties
          title="Squadra casa"
          width={widths.homeName}
          fontSize={
            element.fixtureHomeNameFontSize ??
            element.fontSize ??
            30
          }
          fontWeight={
            element.fixtureHomeNameFontWeight ??
            element.fontWeight ??
            700
          }
          color={
            element.fixtureHomeNameColor ??
            element.color ??
            "#ffffff"
          }
          align={
            element.fixtureHomeNameAlign ??
            "right"
          }
          onWidth={(value) =>
            updateFixtureWidth(
              "fixtureHomeNameWidth",
              value,
            )
          }
          onFontSize={(fixtureHomeNameFontSize) =>
            onChange({ fixtureHomeNameFontSize })
          }
          onFontWeight={(fixtureHomeNameFontWeight) =>
            onChange({ fixtureHomeNameFontWeight })
          }
          onColor={(fixtureHomeNameColor) =>
            onChange({ fixtureHomeNameColor })
          }
          onAlign={(fixtureHomeNameAlign) =>
            onChange({ fixtureHomeNameAlign })
          }
        />

        <FixtureLogoColumnProperties
          title="Logo casa"
          width={widths.homeLogo}
          logoSize={
            element.fixtureHomeLogoSize ??
            element.logoSize ??
            64
          }
          onWidth={(value) =>
            updateFixtureWidth(
              "fixtureHomeLogoWidth",
              value,
            )
          }
          onLogoSize={(fixtureHomeLogoSize) =>
            onChange({ fixtureHomeLogoSize })
          }
        />

        <div className="space-y-3 rounded-[12px] border border-[#06142E]/10 bg-white p-3">
          <p className="text-xs font-black uppercase text-[#06142E]">
            Colonna centrale
          </p>

          <NumberField
            label="Larghezza colonna"
            value={widths.center}
            min={60}
            max={400}
            onChange={(value) =>
              updateFixtureWidth(
                "fixtureCenterWidth",
                value,
              )
            }
          />

          <FixtureCenterTextProperties
            title="Riga 1 · Giorno"
            fontSize={element.fixtureDateFontSize ?? Math.max(13, Math.round(element.fontSize * 0.52))}
            fontWeight={element.fixtureDateFontWeight ?? element.fontWeight ?? 700}
            color={element.fixtureDateColor ?? element.color ?? "#ffffff"}
            align={element.fixtureDateAlign ?? "center"}
            onFontSize={(fixtureDateFontSize) => onChange({ fixtureDateFontSize })}
            onFontWeight={(fixtureDateFontWeight) => onChange({ fixtureDateFontWeight })}
            onColor={(fixtureDateColor) => onChange({ fixtureDateColor })}
            onAlign={(fixtureDateAlign) => onChange({ fixtureDateAlign })}
          />

          <FixtureCenterTextProperties
            title="Riga 2 · Orario"
            fontSize={element.fixtureTimeFontSize ?? Math.max(24, Math.round(element.fontSize * 1.12))}
            fontWeight={element.fixtureTimeFontWeight ?? element.fontWeight ?? 700}
            color={element.fixtureTimeColor ?? element.color ?? "#ffffff"}
            align={element.fixtureTimeAlign ?? "center"}
            onFontSize={(fixtureTimeFontSize) => onChange({ fixtureTimeFontSize })}
            onFontWeight={(fixtureTimeFontWeight) => onChange({ fixtureTimeFontWeight })}
            onColor={(fixtureTimeColor) => onChange({ fixtureTimeColor })}
            onAlign={(fixtureTimeAlign) => onChange({ fixtureTimeAlign })}
          />
        </div>

        <FixtureLogoColumnProperties
          title="Logo ospite"
          width={widths.awayLogo}
          logoSize={element.fixtureAwayLogoSize ?? element.logoSize ?? 64}
          onWidth={(value) => updateFixtureWidth("fixtureAwayLogoWidth", value)}
          onLogoSize={(fixtureAwayLogoSize) => onChange({ fixtureAwayLogoSize })}
        />

        <StandingTextCellProperties
          title="Squadra ospite"
          width={widths.awayName}
          fontSize={element.fixtureAwayNameFontSize ?? element.fontSize ?? 30}
          fontWeight={element.fixtureAwayNameFontWeight ?? element.fontWeight ?? 700}
          color={element.fixtureAwayNameColor ?? element.color ?? "#ffffff"}
          align={element.fixtureAwayNameAlign ?? "left"}
          onWidth={(value) => updateFixtureWidth("fixtureAwayNameWidth", value)}
          onFontSize={(fixtureAwayNameFontSize) => onChange({ fixtureAwayNameFontSize })}
          onFontWeight={(fixtureAwayNameFontWeight) => onChange({ fixtureAwayNameFontWeight })}
          onColor={(fixtureAwayNameColor) => onChange({ fixtureAwayNameColor })}
          onAlign={(fixtureAwayNameAlign) => onChange({ fixtureAwayNameAlign })}
        />
      </div>
    );
  }

  if (isStandingRow) {
    const widths = {
      position:
        element.standingPositionWidth ??
        64,
      logo:
        element.standingLogoWidth ??
        82,
      team:
        element.standingTeamWidth ??
        320,
      played:
        element.standingPlayedWidth ??
        110,
      goalDifference:
        element.standingGoalDifferenceWidth ??
        100,
      points:
        element.standingPointsWidth ??
        104,
    };

    const showPlayed =
      element.standingShowPlayed ??
      true;

    /*
     * Per i template salvati prima di questa modifica la DR
     * resta inizialmente nascosta, così non si altera il layout.
     * Le nuove righe invece nascono con entrambe le colonne attive.
     */
    const showGoalDifference =
      element.standingShowGoalDifference ??
      false;

    const calculateRowWidth = ({
      played = showPlayed,
      goalDifference =
        showGoalDifference,
      nextWidths = widths,
    }: {
      played?: boolean;
      goalDifference?: boolean;
      nextWidths?: typeof widths;
    } = {}) =>
      nextWidths.position +
      nextWidths.logo +
      nextWidths.team +
      (
        played
          ? nextWidths.played
          : 0
      ) +
      (
        goalDifference
          ? nextWidths.goalDifference
          : 0
      ) +
      nextWidths.points;

    const updateWidth = (
      key:
        | "standingPositionWidth"
        | "standingLogoWidth"
        | "standingTeamWidth"
        | "standingPlayedWidth"
        | "standingGoalDifferenceWidth"
        | "standingPointsWidth",
      value:
        number,
    ) => {
      const nextWidths = {
        ...widths,
        ...(key ===
        "standingPositionWidth"
          ? { position: value }
          : {}),
        ...(key ===
        "standingLogoWidth"
          ? { logo: value }
          : {}),
        ...(key ===
        "standingTeamWidth"
          ? { team: value }
          : {}),
        ...(key ===
        "standingPlayedWidth"
          ? { played: value }
          : {}),
        ...(key ===
        "standingGoalDifferenceWidth"
          ? { goalDifference: value }
          : {}),
        ...(key ===
        "standingPointsWidth"
          ? { points: value }
          : {}),
      };

      onChange({
        [key]:
          value,
        width:
          calculateRowWidth({
            nextWidths,
          }),
      } as Partial<LudiStudioElement>);
    };

    return (
      <div className="space-y-4 rounded-[14px] bg-[#06142E]/[0.04] p-3">
        <div>
          <p className="text-[10px] font-black uppercase text-[#06142E]/40">
            Riga classifica
          </p>
          <p className="mt-1 text-[11px] font-bold text-[#06142E]/45">
            Il blocco si sposta come un unico elemento. Le celle interne restano modificabili singolarmente.
          </p>
        </div>

        <StandingTextCellProperties
          title="Posizione"
          width={widths.position}
          fontSize={
            element.standingPositionFontSize ??
            30
          }
          fontWeight={
            element.standingPositionFontWeight ??
            800
          }
          color={
            element.standingPositionColor ??
            "#ffffff"
          }
          align={
            element.standingPositionAlign ??
            "center"
          }
          onWidth={(value) =>
            updateWidth(
              "standingPositionWidth",
              value,
            )
          }
          onFontSize={(standingPositionFontSize) =>
            onChange({
              standingPositionFontSize,
            })
          }
          onFontWeight={(standingPositionFontWeight) =>
            onChange({
              standingPositionFontWeight,
            })
          }
          onColor={(standingPositionColor) =>
            onChange({
              standingPositionColor,
            })
          }
          onAlign={(standingPositionAlign) =>
            onChange({
              standingPositionAlign,
            })
          }
        />

        <div className="space-y-3 rounded-[12px] border border-[#06142E]/10 bg-white p-3">
          <p className="text-xs font-black uppercase text-[#06142E]">
            Logo squadra
          </p>

          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Larghezza cella"
              value={widths.logo}
              min={30}
              max={300}
              onChange={(value) =>
                updateWidth(
                  "standingLogoWidth",
                  value,
                )
              }
            />

            <NumberField
              label="Dimensione logo"
              value={
                element.standingLogoSize ??
                element.logoSize ??
                58
              }
              min={16}
              max={180}
              onChange={(standingLogoSize) =>
                onChange({
                  standingLogoSize,
                  logoSize:
                    standingLogoSize,
                })
              }
            />
          </div>
        </div>

        <StandingTextCellProperties
          title="Squadra (aliasName)"
          width={widths.team}
          fontSize={
            element.standingTeamFontSize ??
            32
          }
          fontWeight={
            element.standingTeamFontWeight ??
            800
          }
          color={
            element.standingTeamColor ??
            "#ffffff"
          }
          align={
            element.standingTeamAlign ??
            "left"
          }
          onWidth={(value) =>
            updateWidth(
              "standingTeamWidth",
              value,
            )
          }
          onFontSize={(standingTeamFontSize) =>
            onChange({
              standingTeamFontSize,
            })
          }
          onFontWeight={(standingTeamFontWeight) =>
            onChange({
              standingTeamFontWeight,
            })
          }
          onColor={(standingTeamColor) =>
            onChange({
              standingTeamColor,
            })
          }
          onAlign={(standingTeamAlign) =>
            onChange({
              standingTeamAlign,
            })
          }
        />

        <div className="space-y-3 rounded-[12px] border border-[#06142E]/10 bg-white p-3">
          <p className="text-xs font-black uppercase text-[#06142E]">
            Colonne opzionali
          </p>

          <ToggleField
            label="Mostra partite giocate"
            value={showPlayed}
            onChange={(standingShowPlayed) =>
              onChange({
                standingShowPlayed,
                width:
                  calculateRowWidth({
                    played:
                      standingShowPlayed,
                  }),
              })
            }
          />

          <ToggleField
            label="Mostra differenza reti"
            value={showGoalDifference}
            onChange={(standingShowGoalDifference) =>
              onChange({
                standingShowGoalDifference,
                width:
                  calculateRowWidth({
                    goalDifference:
                      standingShowGoalDifference,
                  }),
              })
            }
          />
        </div>

        {showPlayed ? (
          <StandingTextCellProperties
            title="Partite giocate"
            width={widths.played}
            fontSize={
              element.standingPlayedFontSize ??
              32
            }
            fontWeight={
              element.standingPlayedFontWeight ??
              900
            }
            color={
              element.standingPlayedColor ??
              "#ffffff"
            }
            align={
              element.standingPlayedAlign ??
              "center"
            }
            onWidth={(value) =>
              updateWidth(
                "standingPlayedWidth",
                value,
              )
            }
            onFontSize={(standingPlayedFontSize) =>
              onChange({
                standingPlayedFontSize,
              })
            }
            onFontWeight={(standingPlayedFontWeight) =>
              onChange({
                standingPlayedFontWeight,
              })
            }
            onColor={(standingPlayedColor) =>
              onChange({
                standingPlayedColor,
              })
            }
            onAlign={(standingPlayedAlign) =>
              onChange({
                standingPlayedAlign,
              })
            }
          />
        ) : null}

        {showGoalDifference ? (
          <StandingTextCellProperties
            title="Differenza reti"
            width={widths.goalDifference}
            fontSize={
              element.standingGoalDifferenceFontSize ??
              32
            }
            fontWeight={
              element.standingGoalDifferenceFontWeight ??
              900
            }
            color={
              element.standingGoalDifferenceColor ??
              "#ffffff"
            }
            align={
              element.standingGoalDifferenceAlign ??
              "center"
            }
            onWidth={(value) =>
              updateWidth(
                "standingGoalDifferenceWidth",
                value,
              )
            }
            onFontSize={(standingGoalDifferenceFontSize) =>
              onChange({
                standingGoalDifferenceFontSize,
              })
            }
            onFontWeight={(standingGoalDifferenceFontWeight) =>
              onChange({
                standingGoalDifferenceFontWeight,
              })
            }
            onColor={(standingGoalDifferenceColor) =>
              onChange({
                standingGoalDifferenceColor,
              })
            }
            onAlign={(standingGoalDifferenceAlign) =>
              onChange({
                standingGoalDifferenceAlign,
              })
            }
          />
        ) : null}

        <StandingTextCellProperties
          title="Punti"
          width={widths.points}
          fontSize={
            element.standingPointsFontSize ??
            32
          }
          fontWeight={
            element.standingPointsFontWeight ??
            900
          }
          color={
            element.standingPointsColor ??
            "#ffffff"
          }
          align={
            element.standingPointsAlign ??
            "center"
          }
          onWidth={(value) =>
            updateWidth(
              "standingPointsWidth",
              value,
            )
          }
          onFontSize={(standingPointsFontSize) =>
            onChange({
              standingPointsFontSize,
            })
          }
          onFontWeight={(standingPointsFontWeight) =>
            onChange({
              standingPointsFontWeight,
            })
          }
          onColor={(standingPointsColor) =>
            onChange({
              standingPointsColor,
            })
          }
          onAlign={(standingPointsAlign) =>
            onChange({
              standingPointsAlign,
            })
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-[14px] bg-[#06142E]/[0.04] p-3">
      <p className="text-[10px] font-black uppercase text-[#06142E]/40">Lista automatica</p>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Altezza riga" value={element.rowHeight} min={30} max={220} onChange={(rowHeight) => onChange({ rowHeight })} />
        <NumberField label="Spazio righe" value={element.rowGap} min={0} max={80} onChange={(rowGap) => onChange({ rowGap })} />
        <NumberField label="Max righe" value={element.maxRows} min={1} max={20} onChange={(maxRows) => onChange({ maxRows })} />
        <NumberField label="Logo" value={element.logoSize} min={20} max={160} onChange={(logoSize) => onChange({ logoSize })} />
        <NumberField label="Font size" value={element.fontSize} min={10} max={80} onChange={(fontSize) => onChange({ fontSize })} />
        <NumberField label="Peso" value={element.fontWeight} min={100} max={900} step={100} onChange={(fontWeight) => onChange({ fontWeight })} />
      </div>
      <TextField label="Font" value={element.fontFamily} onChange={(fontFamily) => onChange({ fontFamily })} />
      <ColorField label="Colore testo" value={element.color} onChange={(color) => onChange({ color })} />
      <ColorField label="Colore riga" value={element.surfaceColor} onChange={(surfaceColor) => onChange({ surfaceColor })} />
      <ToggleField label="Mostra loghi" value={element.showLogos} onChange={(showLogos) => onChange({ showLogos })} />
      <ToggleField label="Mostra nomi" value={element.showNames} onChange={(showNames) => onChange({ showNames })} />
      {element.binding !== "standingsTable" ? (
        <>
          <ToggleField label="Mostra data" value={element.showDate} onChange={(showDate) => onChange({ showDate })} />
          <ToggleField label="Mostra ora" value={element.showTime} onChange={(showTime) => onChange({ showTime })} />
        </>
      ) : null}
    </div>
  );
}

function FixtureLogoColumnProperties({
  title,
  width,
  logoSize,
  onWidth,
  onLogoSize,
}: {
  title: string;
  width: number;
  logoSize: number;
  onWidth: (value: number) => void;
  onLogoSize: (value: number) => void;
}) {
  return (
    <div className="space-y-3 rounded-[12px] border border-[#06142E]/10 bg-white p-3">
      <p className="text-xs font-black uppercase text-[#06142E]">{title}</p>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Larghezza colonna" value={width} min={30} max={300} onChange={onWidth} />
        <NumberField label="Dimensione logo" value={logoSize} min={16} max={180} onChange={onLogoSize} />
      </div>
    </div>
  );
}

function FixtureCenterTextProperties({
  title, fontSize, fontWeight, color, align, onFontSize, onFontWeight, onColor, onAlign,
}: {
  title: string; fontSize: number; fontWeight: number; color: string; align: "left" | "center" | "right";
  onFontSize: (value: number) => void; onFontWeight: (value: number) => void; onColor: (value: string) => void;
  onAlign: (value: "left" | "center" | "right") => void;
}) {
  return (
    <div className="space-y-3 rounded-[10px] bg-[#06142E]/[0.035] p-3">
      <p className="text-[10px] font-black uppercase text-[#06142E]/55">{title}</p>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Font size" value={fontSize} min={8} max={120} onChange={onFontSize} />
        <NumberField label="Peso" value={fontWeight} min={100} max={900} step={100} onChange={onFontWeight} />
        <SelectField label="Allineamento" value={align} options={["left", "center", "right"]} onChange={(value) => onAlign(value as "left" | "center" | "right")} />
      </div>
      <ColorField label="Colore testo" value={color} onChange={onColor} />
    </div>
  );
}

function StandingTextCellProperties({
  title,
  width,
  fontSize,
  fontWeight,
  color,
  align,
  onWidth,
  onFontSize,
  onFontWeight,
  onColor,
  onAlign,
}: {
  title: string;
  width: number;
  fontSize: number;
  fontWeight: number;
  color: string;
  align: "left" | "center" | "right";
  onWidth: (value: number) => void;
  onFontSize: (value: number) => void;
  onFontWeight: (value: number) => void;
  onColor: (value: string) => void;
  onAlign: (
    value:
      | "left"
      | "center"
      | "right",
  ) => void;
}) {
  return (
    <div className="space-y-3 rounded-[12px] border border-[#06142E]/10 bg-white p-3">
      <p className="text-xs font-black uppercase text-[#06142E]">
        {title}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Larghezza cella"
          value={width}
          min={30}
          max={500}
          onChange={onWidth}
        />

        <NumberField
          label="Font size"
          value={fontSize}
          min={8}
          max={120}
          onChange={onFontSize}
        />

        <NumberField
          label="Peso"
          value={fontWeight}
          min={100}
          max={900}
          step={100}
          onChange={onFontWeight}
        />

        <SelectField
          label="Allineamento"
          value={align}
          options={[
            "left",
            "center",
            "right",
          ]}
          onChange={(value) =>
            onAlign(
              value as
                | "left"
                | "center"
                | "right",
            )
          }
        />
      </div>

      <ColorField
        label="Colore testo"
        value={color}
        onChange={onColor}
      />
    </div>
  );
}


function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/45">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="ludi-input" />
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black uppercase text-[#06142E]/40">{label}</span>
      <input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} className="ludi-input" />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const pickerValue = /^#[0-9a-fA-F]{6}$/.test(value)
    ? value
    : "#000000";

  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/45">{label}</span>
      <div className="flex gap-2">
        <input type="color" value={pickerValue} onChange={(event) => onChange(event.target.value)} className="h-12 w-14 rounded-[10px] border border-[#06142E]/10 bg-white p-1" />
        <input value={value} onChange={(event) => onChange(event.target.value)} className="ludi-input min-w-0 flex-1" />
      </div>
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/45">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="ludi-input">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function ToggleField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-[10px] bg-white px-3 py-2 text-xs font-black text-[#06142E]">
      {label}
      <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}
