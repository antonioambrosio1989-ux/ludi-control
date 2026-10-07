"use client";

import {
  useMemo,
  useState,
} from "react";

import AppShell from "@/components/ui/AppShell";

import { MATCH_TIMES } from "@/src/constants/matchTimes";

import {
  useCompetition,
} from "@/src/contexts/CompetitionContext";

import {
  useSeasonTeams,
} from "@/src/hooks/useSeasonTeams";

import { useTeams } from "@/src/hooks/useTeams";

import { FirebaseMatchRepository } from "@/src/services/match/FirebaseMatchRepository";

import type { Match } from "@/src/types/Match";

type MatchImportPanelProps = {
  seasonId?: string;
  seasonName?: string;
  onCompleted?: () => Promise<void> | void;
};

type EditorMode =
  | "manual"
  | "generator"
  | "board"
  | null;

type DraftMatch = {
  id: string;
  date: string;
  time: string;
  homeTeamId: string;
  awayTeamId: string;
};

type AvailabilityMap =
  Record<string, string[]>;

const WEEK_DAYS = [
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
] as const;

const GENERATOR_MATCH_TIMES = [
  "20:30",
  "21:30",
  "22:30",
] as const;

function createDraftMatch(
  index: number,
): DraftMatch {
  return {
    id: `draft-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
    date: "",
    time: "20:30",
    homeTeamId: "",
    awayTeamId: "",
  };
}

function pairKey(
  firstTeamId: string,
  secondTeamId: string,
) {
  return [
    firstTeamId,
    secondTeamId,
  ]
    .sort()
    .join("|");
}

function dateTimeKey(
  date: string,
  time: string,
) {
  return `${date}|${time}`;
}

function availabilityKey(
  dayIndex: number,
  time: string,
) {
  return `${dayIndex}|${time}`;
}

const PREFERRED_AVAILABILITY_PREFIX =
  "preferred:";

type AvailabilityState =
  | "unavailable"
  | "available"
  | "preferred";

function preferredAvailabilityKey(
  key: string,
) {
  return `${PREFERRED_AVAILABILITY_PREFIX}${key}`;
}

function getAvailabilityState(
  values: string[],
  key: string,
): AvailabilityState {
  if (
    values.includes(
      preferredAvailabilityKey(
        key,
      ),
    )
  ) {
    return "preferred";
  }

  if (
    values.includes(
      key,
    )
  ) {
    return "available";
  }

  return "unavailable";
}

function normalizeAvailabilitySlot(
  value: string,
) {
  return value.startsWith(
    PREFERRED_AVAILABILITY_PREFIX,
  )
    ? value.slice(
        PREFERRED_AVAILABILITY_PREFIX.length,
      )
    : value;
}

function parseLocalDate(
  value: string,
): Date | null {
  const [
    year,
    month,
    day,
  ] = value
    .split("-")
    .map(Number);

  if (
    !year ||
    !month ||
    !day
  ) {
    return null;
  }

  return new Date(
    year,
    month - 1,
    day,
    12,
    0,
    0,
  );
}

function toDateInputValue(
  date: Date,
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1,
    ).padStart(
      2,
      "0",
    );

  const day =
    String(
      date.getDate(),
    ).padStart(
      2,
      "0",
    );

  return `${year}-${month}-${day}`;
}

function addDays(
  value: string,
  amount: number,
) {
  const date =
    parseLocalDate(value);

  if (!date) {
    return "";
  }

  date.setDate(
    date.getDate() +
      amount,
  );

  return toDateInputValue(
    date,
  );
}

function formatCompactDate(
  value: string,
) {
  const date =
    parseLocalDate(value);

  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "it-IT",
    {
      day: "2-digit",
      month: "2-digit",
    },
  ).format(date);
}

function getNextMonday() {
  const date =
    new Date();

  date.setHours(
    12,
    0,
    0,
    0,
  );

  const currentDay =
    date.getDay();

  const daysUntilMonday =
    currentDay === 0
      ? 1
      : currentDay === 1
        ? 7
        : 8 - currentDay;

  date.setDate(
    date.getDate() +
      daysUntilMonday,
  );

  return toDateInputValue(
    date,
  );
}

function sortGeneratedOptions<T extends {
  sortKey: string;
  preferenceScore?: number;
}>(
  values: T[],
  salt: number,
) {
  function score(
    value: string,
  ) {
    let hash =
      2166136261 ^
      salt;

    for (
      let index = 0;
      index <
      value.length;
      index += 1
    ) {
      hash ^=
        value.charCodeAt(
          index,
        );

      hash =
        Math.imul(
          hash,
          16777619,
        );
    }

    return hash >>> 0;
  }

  return values
    .slice()
    .sort(
      (
        first,
        second,
      ) => {
        const preferenceDifference =
          (second.preferenceScore ?? 0) -
          (first.preferenceScore ?? 0);

        if (
          preferenceDifference !== 0
        ) {
          return preferenceDifference;
        }

        return (
          score(
            first.sortKey,
          ) -
          score(
            second.sortKey,
          )
        );
      },
    );
}

function validateMatchweekDraft({
  matches,
  draft,
  matchweek,
}: {
  matches: Match[];
  draft: DraftMatch[];
  matchweek: number;
}) {
  const errors:
    string[] = [];

  if (
    !Number.isInteger(
      matchweek,
    ) ||
    matchweek < 1
  ) {
    errors.push(
      "Inserisci una matchweek valida.",
    );

    return errors;
  }

  const sameMatchweek =
    matches.filter(
      (match) =>
        match.matchweek ===
          matchweek &&
        match.status !==
          "cancelled",
    );

  if (
    sameMatchweek.length >
    0
  ) {
    errors.push(
      `La Matchweek ${matchweek} esiste già. Per modificarla usa la sezione Partite.`,
    );
  }

  if (
    draft.length === 0
  ) {
    errors.push(
      "Inserisci almeno una partita.",
    );
  }

  const usedTeams =
    new Set<string>();

  const usedSlots =
    new Set<string>();

  const usedPairs =
    new Set<string>();

  const existingSlots =
    new Set(
      matches
        .filter(
          (match) =>
            match.status !==
            "cancelled",
        )
        .map(
          (match) =>
            dateTimeKey(
              match.date,
              match.time,
            ),
        ),
    );

  const existingPairs =
    new Set(
      matches
        .filter(
          (match) =>
            match.status !==
            "cancelled",
        )
        .map(
          (match) =>
            pairKey(
              String(
                match.homeTeamId,
              ),
              String(
                match.awayTeamId,
              ),
            ),
        ),
    );

  draft.forEach(
    (
      row,
      index,
    ) => {
      const label =
        `Partita ${index + 1}`;

      if (
        !row.homeTeamId ||
        !row.awayTeamId
      ) {
        errors.push(
          `${label}: seleziona entrambe le squadre.`,
        );

        return;
      }

      if (
        row.homeTeamId ===
        row.awayTeamId
      ) {
        errors.push(
          `${label}: una squadra non può giocare contro sé stessa.`,
        );
      }

      for (
        const teamId of
        [
          row.homeTeamId,
          row.awayTeamId,
        ]
      ) {
        if (
          usedTeams.has(
            teamId,
          )
        ) {
          errors.push(
            `${label}: una squadra compare più di una volta nella stessa giornata.`,
          );
        }

        usedTeams.add(
          teamId,
        );
      }

      if (!row.date) {
        errors.push(
          `${label}: inserisci la data.`,
        );
      }

      if (!row.time) {
        errors.push(
          `${label}: inserisci l'orario.`,
        );
      }

      if (
        row.date &&
        row.time
      ) {
        const slot =
          dateTimeKey(
            row.date,
            row.time,
          );

        if (
          usedSlots.has(
            slot,
          )
        ) {
          errors.push(
            `${label}: giorno e orario sono già occupati da un'altra partita della nuova giornata.`,
          );
        }

        if (
          existingSlots.has(
            slot,
          )
        ) {
          errors.push(
            `${label}: esiste già una partita programmata il ${formatCompactDate(row.date)} alle ${row.time}.`,
          );
        }

        usedSlots.add(
          slot,
        );
      }

      if (
        row.homeTeamId &&
        row.awayTeamId
      ) {
        const key =
          pairKey(
            row.homeTeamId,
            row.awayTeamId,
          );

        if (
          usedPairs.has(
            key,
          )
        ) {
          errors.push(
            `${label}: lo stesso accoppiamento è presente due volte nella nuova giornata.`,
          );
        }

        if (
          existingPairs.has(
            key,
          )
        ) {
          errors.push(
            `${label}: questo accoppiamento è già presente nel calendario della stagione.`,
          );
        }

        usedPairs.add(
          key,
        );
      }
    },
  );

  return Array.from(
    new Set(errors),
  );
}

function buildGeneratedSchedule({
  teamIds,
  matches,
  availability,
  weekStart,
  targetMatchweek,
  salt,
}: {
  teamIds: string[];
  matches: Match[];
  availability:
    AvailabilityMap;
  weekStart: string;
  targetMatchweek: number;
  salt: number;
}) {
  const blockedPairs =
    new Set(
      matches
        .filter(
          (match) =>
            match.status !==
            "cancelled",
        )
        .map(
          (match) =>
            pairKey(
              String(
                match.homeTeamId,
              ),
              String(
                match.awayTeamId,
              ),
            ),
        ),
    );

  const blockedSlots =
    new Set(
      matches
        .filter(
          (match) =>
            match.status !==
            "cancelled",
        )
        .map(
          (match) =>
            dateTimeKey(
              match.date,
              match.time,
            ),
        ),
    );

  const historicalMatches =
    matches.filter(
      (match) =>
        match.status !==
          "cancelled" &&
        match.matchweek <
          targetMatchweek,
    );

  function previousVenueStatus(
    teamId: string,
    matchweek: number,
  ):
    | "home"
    | "away"
    | null {
    const match =
      historicalMatches.find(
        (item) =>
          item.matchweek ===
            matchweek &&
          (
            String(
              item.homeTeamId,
            ) === teamId ||
            String(
              item.awayTeamId,
            ) === teamId
          ),
      );

    if (
      !match
    ) {
      return null;
    }

    return String(
      match.homeTeamId,
    ) === teamId
      ? "home"
      : "away";
  }

  function fallbackHomeTeam(
    firstTeamId: string,
    secondTeamId: string,
  ) {
    const value =
      `${firstTeamId}|${secondTeamId}|${targetMatchweek}|${salt}`;

    let hash =
      2166136261;

    for (
      let index = 0;
      index < value.length;
      index += 1
    ) {
      hash ^=
        value.charCodeAt(
          index,
        );

      hash =
        Math.imul(
          hash,
          16777619,
        );
    }

    return (hash >>> 0) %
      2 ===
      0
      ? firstTeamId
      : secondTeamId;
  }

  function resolveHomeAway(
    firstTeamId: string,
    secondTeamId: string,
  ) {
    const previousMatchweeks =
      Array.from(
        new Set(
          historicalMatches.map(
            (match) =>
              match.matchweek,
          ),
        ),
      ).sort(
        (first, second) =>
          second - first,
      );

    for (
      const previousMatchweek of
      previousMatchweeks
    ) {
      const firstStatus =
        previousVenueStatus(
          firstTeamId,
          previousMatchweek,
        );

      const secondStatus =
        previousVenueStatus(
          secondTeamId,
          previousMatchweek,
        );

      if (
        !firstStatus ||
        !secondStatus ||
        firstStatus ===
          secondStatus
      ) {
        continue;
      }

      /*
       * Se nell'ultimo turno utile una squadra era in casa
       * e l'altra fuori, nella nuova giornata invertiamo i ruoli.
       */
      return firstStatus ===
        "home"
        ? {
            homeTeamId:
              secondTeamId,
            awayTeamId:
              firstTeamId,
          }
        : {
            homeTeamId:
              firstTeamId,
            awayTeamId:
              secondTeamId,
          };
    }

    /*
     * Se non esiste alcun precedente utile, l'assegnazione è casuale
     * ma stabile per la singola generazione; "Rigenera" cambia il salt.
     */
    const homeTeamId =
      fallbackHomeTeam(
        firstTeamId,
        secondTeamId,
      );

    return {
      homeTeamId,
      awayTeamId:
        homeTeamId ===
        firstTeamId
          ? secondTeamId
          : firstTeamId,
    };
  }

  const slots =
    WEEK_DAYS.flatMap(
      (
        _day,
        dayIndex,
      ) =>
        GENERATOR_MATCH_TIMES.map(
          (time) => ({
            dayIndex,
            time,
            date:
              addDays(
                weekStart,
                dayIndex,
              ),
            key:
              availabilityKey(
                dayIndex,
                time,
              ),
          }),
        ),
    ).filter(
      (slot) =>
        slot.date &&
        !blockedSlots.has(
          dateTimeKey(
            slot.date,
            slot.time,
          ),
        ),
    );

  const availableSetByTeam =
    new Map(
      teamIds.map(
        (teamId) => [
          teamId,
          new Set(
            (
              availability[
                teamId
              ] ?? []
            ).map(
              normalizeAvailabilitySlot,
            ),
          ),
        ],
      ),
    );

  const preferredSetByTeam =
    new Map(
      teamIds.map(
        (teamId) => [
          teamId,
          new Set(
            (
              availability[
                teamId
              ] ?? []
            )
              .filter(
                (value) =>
                  value.startsWith(
                    PREFERRED_AVAILABILITY_PREFIX,
                  ),
              )
              .map(
                normalizeAvailabilitySlot,
              ),
          ),
        ],
      ),
    );

  type Candidate = {
    partnerId: string;
    date: string;
    time: string;
    sortKey: string;
    preferenceScore: number;
  };

  const target =
    Math.floor(
      teamIds.length / 2,
    );

  function schedulePreferenceScore(
    schedule: DraftMatch[],
  ) {
    return schedule.reduce(
      (
        total,
        match,
      ) => {
        const dayIndex =
          WEEK_DAYS.findIndex(
            (
              _day,
              index,
            ) =>
              addDays(
                weekStart,
                index,
              ) ===
              match.date,
          );

        if (
          dayIndex < 0
        ) {
          return total;
        }

        const slotKey =
          availabilityKey(
            dayIndex,
            match.time,
          );

        return (
          total +
          (
            preferredSetByTeam
              .get(
                match.homeTeamId,
              )
              ?.has(
                slotKey,
              )
              ? 1
              : 0
          ) +
          (
            preferredSetByTeam
              .get(
                match.awayTeamId,
              )
              ?.has(
                slotKey,
              )
              ? 1
              : 0
          )
        );
      },
      0,
    );
  }

  function usedDayCount(
    schedule: DraftMatch[],
  ) {
    return new Set(
      schedule.map(
        (match) =>
          match.date,
      ),
    ).size;
  }

  function concentrationScore(
    schedule: DraftMatch[],
  ) {
    const counts =
      new Map<string, number>();

    for (
      const match of
      schedule
    ) {
      counts.set(
        match.date,
        (counts.get(
          match.date,
        ) ?? 0) + 1,
      );
    }

    return Array.from(
      counts.values(),
    ).reduce(
      (
        total,
        count,
      ) =>
        total +
        count * count,
      0,
    );
  }

  function isBetterSchedule(
    candidate: DraftMatch[],
    currentBest: DraftMatch[],
  ) {
    if (
      candidate.length !==
      currentBest.length
    ) {
      return (
        candidate.length >
        currentBest.length
      );
    }

    const candidatePreferenceScore =
      schedulePreferenceScore(
        candidate,
      );

    const currentPreferenceScore =
      schedulePreferenceScore(
        currentBest,
      );

    if (
      candidatePreferenceScore !==
      currentPreferenceScore
    ) {
      return (
        candidatePreferenceScore >
        currentPreferenceScore
      );
    }

    const candidateDays =
      usedDayCount(
        candidate,
      );

    const currentDays =
      usedDayCount(
        currentBest,
      );

    if (
      candidateDays !==
      currentDays
    ) {
      return (
        candidateDays <
        currentDays
      );
    }

    return (
      concentrationScore(
        candidate,
      ) >
      concentrationScore(
        currentBest,
      )
    );
  }

  function buildDaySubsets(
    size: number,
  ) {
    const values:
      number[][] = [];

    function visit(
      startIndex: number,
      current: number[],
    ) {
      if (
        current.length ===
        size
      ) {
        values.push(
          current.slice(),
        );

        return;
      }

      for (
        let index =
          startIndex;
        index <
          WEEK_DAYS.length;
        index += 1
      ) {
        current.push(
          index,
        );

        visit(
          index + 1,
          current,
        );

        current.pop();
      }
    }

    visit(
      0,
      [],
    );

    return values;
  }

  function searchWithinDays(
    allowedDays: Set<number>,
  ) {
    const allowedSlots =
      slots.filter(
        (slot) =>
          allowedDays.has(
            slot.dayIndex,
          ),
      );

    function getOptions(
      teamId: string,
      remaining: string[],
      usedSlots: Set<string>,
    ): Candidate[] {
      const teamAvailability =
        availableSetByTeam.get(
          teamId,
        ) ??
        new Set<string>();

      const candidates:
        Candidate[] = [];

      for (
        const partnerId of
        remaining
      ) {
        if (
          partnerId ===
          teamId
        ) {
          continue;
        }

        if (
          blockedPairs.has(
            pairKey(
              teamId,
              partnerId,
            ),
          )
        ) {
          continue;
        }

        const partnerAvailability =
          availableSetByTeam.get(
            partnerId,
          ) ??
          new Set<string>();

        for (
          const slot of
          allowedSlots
        ) {
          const realSlotKey =
            dateTimeKey(
              slot.date,
              slot.time,
            );

          if (
            usedSlots.has(
              realSlotKey,
            )
          ) {
            continue;
          }

          if (
            teamAvailability.has(
              slot.key,
            ) &&
            partnerAvailability.has(
              slot.key,
            )
          ) {
            const preferenceScore =
              (
                preferredSetByTeam
                  .get(
                    teamId,
                  )
                  ?.has(
                    slot.key,
                  )
                  ? 1
                  : 0
              ) +
              (
                preferredSetByTeam
                  .get(
                    partnerId,
                  )
                  ?.has(
                    slot.key,
                  )
                  ? 1
                  : 0
              );

            candidates.push({
              partnerId,
              date:
                slot.date,
              time:
                slot.time,
              preferenceScore,
              sortKey:
                `${teamId}|${partnerId}|${slot.key}`,
            });
          }
        }
      }

      return sortGeneratedOptions(
        candidates,
        salt,
      );
    }

    let localBest:
      DraftMatch[] = [];

    function search(
      remaining: string[],
      usedSlots: Set<string>,
      current: DraftMatch[],
    ) {
      if (
        isBetterSchedule(
          current,
          localBest,
        )
      ) {
        localBest =
          current.slice();
      }

      if (
        localBest.length >=
        target
      ) {
        return;
      }

      if (
        current.length +
          Math.floor(
            remaining.length /
              2,
          ) <=
        localBest.length
      ) {
        return;
      }

      if (
        remaining.length <
        2
      ) {
        return;
      }

      let selectedTeam =
        remaining[0];

      let selectedOptions:
        Candidate[] | null =
        null;

      for (
        const teamId of
        remaining
      ) {
        const options =
          getOptions(
            teamId,
            remaining,
            usedSlots,
          );

        if (
          selectedOptions ===
            null ||
          options.length <
            selectedOptions.length
        ) {
          selectedTeam =
            teamId;

          selectedOptions =
            options;
        }

        if (
          options.length ===
          0
        ) {
          break;
        }
      }

      const options =
        selectedOptions ?? [];

      for (
        const option of
        options
      ) {
        const slotKey =
          dateTimeKey(
            option.date,
            option.time,
          );

        const nextRemaining =
          remaining.filter(
            (teamId) =>
              teamId !==
                selectedTeam &&
              teamId !==
                option.partnerId,
          );

        const nextUsedSlots =
          new Set(
            usedSlots,
          );

        nextUsedSlots.add(
          slotKey,
        );

        const {
          homeTeamId,
          awayTeamId,
        } =
          resolveHomeAway(
            selectedTeam,
            option.partnerId,
          );

        search(
          nextRemaining,
          nextUsedSlots,
          [
            ...current,
            {
              id:
                `generated-${selectedTeam}-${option.partnerId}-${slotKey}`,
              date:
                option.date,
              time:
                option.time,
              homeTeamId,
              awayTeamId,
            },
          ],
        );

        if (
          localBest.length >=
          target
        ) {
          return;
        }
      }

      search(
        remaining.filter(
          (teamId) =>
            teamId !==
            selectedTeam,
        ),
        usedSlots,
        current,
      );
    }

    search(
      teamIds,
      new Set<string>(),
      [],
    );

    return localBest;
  }

  let best:
    DraftMatch[] = [];

  const theoreticalMinimumDays =
    Math.max(
      1,
      Math.ceil(
        target /
          GENERATOR_MATCH_TIMES.length,
      ),
    );

  for (
    let dayCount =
      theoreticalMinimumDays;
    dayCount <=
      WEEK_DAYS.length;
    dayCount += 1
  ) {
    const subsets =
      buildDaySubsets(
        dayCount,
      );

    for (
      const subset of
      subsets
    ) {
      const candidate =
        searchWithinDays(
          new Set(
            subset,
          ),
        );

      if (
        isBetterSchedule(
          candidate,
          best,
        )
      ) {
        best =
          candidate;
      }

      if (
        best.length >=
          target &&
        usedDayCount(
          best,
        ) <=
          dayCount
      ) {
        return best.sort(
          (
            first,
            second,
          ) =>
            `${first.date}|${first.time}`.localeCompare(
              `${second.date}|${second.time}`,
            ),
        );
      }
    }
  }

  return best.sort(
    (
      first,
      second,
    ) =>
      `${first.date}|${first.time}`.localeCompare(
        `${second.date}|${second.time}`,
      ),
  );
}

export default function MatchImportPanel({
  seasonId,
  onCompleted,
}: MatchImportPanelProps) {
  const {
    teams,
    isLoading:
      teamsLoading,
    error:
      teamsError,
  } = useTeams();

  const {
    selectedCompetition,
    currentSeason,
    isLoading:
      competitionLoading,
    error:
      competitionError,
  } = useCompetition();

  const targetSeasonId =
    seasonId ??
    currentSeason?.id ??
    "";

  const {
    entries:
      seasonTeamEntries,
    isLoading:
      seasonTeamsLoading,
    error:
      seasonTeamsError,
  } =
    useSeasonTeams(
      targetSeasonId ||
        undefined,
    );

  const registeredTeamIds =
    useMemo(
      () =>
        new Set(
          seasonTeamEntries.map(
            (entry) =>
              String(
                entry.teamId,
              ),
          ),
        ),
      [
        seasonTeamEntries,
      ],
    );

  const targetSeasonTeams =
    useMemo(
      () =>
        teams.filter(
          (team) =>
            registeredTeamIds.has(
              String(
                team.id,
              ),
            ),
        ),
      [
        teams,
        registeredTeamIds,
      ],
    );

  const teamNameById =
    useMemo(
      () =>
        new Map(
          targetSeasonTeams.map(
            (team) => [
              String(
                team.id,
              ),
              team.aliasName?.trim() ||
                team.name,
            ],
          ),
        ),
      [
        targetSeasonTeams,
      ],
    );

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState<
      string | null
    >(null);

  const [
    importError,
    setImportError,
  ] =
    useState<
      string | null
    >(null);

  const [
    editorMode,
    setEditorMode,
  ] =
    useState<
      EditorMode
    >(null);

  const [
    matchweek,
    setMatchweek,
  ] =
    useState("");

  const [
    manualDraft,
    setManualDraft,
  ] =
    useState<
      DraftMatch[]
    >([]);

  const [
    weekStart,
    setWeekStart,
  ] =
    useState(
      getNextMonday(),
    );

  const [
    availability,
    setAvailability,
  ] =
    useState<
      AvailabilityMap
    >({});

  const [
    generatedDraft,
    setGeneratedDraft,
  ] =
    useState<
      DraftMatch[]
    >([]);

  const [
    generationSalt,
    setGenerationSalt,
  ] =
    useState(1);

  const [
    generatorMessage,
    setGeneratorMessage,
  ] =
    useState<
      string | null
    >(null);

  const [
    isSavingMatchweek,
    setIsSavingMatchweek,
  ] =
    useState(false);

  const [
    boardMatches,
    setBoardMatches,
  ] =
    useState<Match[]>([]);

  const [
    boardSelectedPairs,
    setBoardSelectedPairs,
  ] =
    useState<Set<string>>(
      () => new Set(),
    );

  const [
    isBoardLoading,
    setIsBoardLoading,
  ] =
    useState(false);

  const weekDates =
    useMemo(
      () =>
        WEEK_DAYS.map(
          (
            day,
            dayIndex,
          ) => ({
            day,
            date:
              addDays(
                weekStart,
                dayIndex,
              ),
          }),
        ),
      [
        weekStart,
      ],
    );

  const expectedMatches =
    Math.floor(
      targetSeasonTeams.length /
        2,
    );

  function resetMessages() {
    setImportError(
      null,
    );

    setSuccessMessage(
      null,
    );

    setGeneratorMessage(
      null,
    );

    setBoardSelectedPairs(
      new Set(),
    );
  }

  async function getSuggestedMatchweek() {
    if (
      !targetSeasonId
    ) {
      return 1;
    }

    const matches =
      await FirebaseMatchRepository.getBySeason(
        targetSeasonId,
      );

    if (
      matches.length ===
      0
    ) {
      return 1;
    }

    return (
      Math.max(
        ...matches.map(
          (match) =>
            match.matchweek,
        ),
      ) + 1
    );
  }

  async function openManualEditor() {
    if (
      !targetSeasonId
    ) {
      setImportError(
        "Non è stata selezionata una stagione valida.",
      );

      return;
    }

    resetMessages();

    try {
      const suggested =
        await getSuggestedMatchweek();

      setMatchweek(
        String(
          suggested,
        ),
      );

      setManualDraft(
        Array.from(
          {
            length:
              Math.max(
                1,
                expectedMatches,
              ),
          },
          (
            _value,
            index,
          ) =>
            createDraftMatch(
              index,
            ),
        ),
      );

      setEditorMode(
        "manual",
      );
    } catch (
      currentError
    ) {
      setImportError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile preparare la nuova giornata.",
      );
    }
  }

  async function openGenerator() {
    if (
      !targetSeasonId
    ) {
      setImportError(
        "Non è stata selezionata una stagione valida.",
      );

      return;
    }

    resetMessages();

    try {
      const suggested =
        await getSuggestedMatchweek();

      setMatchweek(
        String(
          suggested,
        ),
      );

      setAvailability(
        Object.fromEntries(
          targetSeasonTeams.map(
            (team) => [
              String(
                team.id,
              ),
              [],
            ],
          ),
        ),
      );

      setGeneratedDraft(
        [],
      );

      setGeneratorMessage(
        null,
      );

      setEditorMode(
        "generator",
      );
    } catch (
      currentError
    ) {
      setImportError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile preparare il generatore.",
      );
    }
  }

  async function openBoard() {
    if (
      !targetSeasonId
    ) {
      setImportError(
        "Non è stata selezionata una stagione valida.",
      );

      return;
    }

    resetMessages();
    setIsBoardLoading(
      true,
    );

    try {
      const matches =
        await FirebaseMatchRepository.getBySeason(
          targetSeasonId,
        );

      setBoardMatches(
        matches.filter(
          (match) =>
            match.status !==
            "cancelled",
        ),
      );

      setBoardSelectedPairs(
        new Set(),
      );

      setEditorMode(
        "board",
      );
    } catch (
      currentError
    ) {
      setImportError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile caricare il tabellone.",
      );
    } finally {
      setIsBoardLoading(
        false,
      );
    }
  }

  function closeEditor() {
    setEditorMode(
      null,
    );

    setGeneratedDraft(
      [],
    );

    setGeneratorMessage(
      null,
    );
  }

  function updateManualRow(
    rowId: string,
    patch:
      Partial<DraftMatch>,
  ) {
    setManualDraft(
      (currentRows) =>
        currentRows.map(
          (row) =>
            row.id === rowId
              ? {
                  ...row,
                  ...patch,
                }
              : row,
        ),
    );
  }

  function addManualRow() {
    setManualDraft(
      (currentRows) => [
        ...currentRows,
        createDraftMatch(
          currentRows.length,
        ),
      ],
    );
  }

  function removeManualRow(
    rowId: string,
  ) {
    setManualDraft(
      (currentRows) =>
        currentRows.filter(
          (row) =>
            row.id !==
            rowId,
        ),
    );
  }

  function toggleAvailability(
    teamId: string,
    dayIndex: number,
    time: string,
  ) {
    const key =
      availabilityKey(
        dayIndex,
        time,
      );

    setAvailability(
      (current) => {
        const currentValues =
          new Set(
            current[
              teamId
            ] ?? [],
          );

        const preferredKey =
          preferredAvailabilityKey(
            key,
          );

        if (
          currentValues.has(
            preferredKey,
          )
        ) {
          currentValues.delete(
            preferredKey,
          );
        } else if (
          currentValues.has(
            key,
          )
        ) {
          currentValues.delete(
            key,
          );

          currentValues.add(
            preferredKey,
          );
        } else {
          currentValues.add(
            key,
          );
        }

        return {
          ...current,
          [teamId]:
            Array.from(
              currentValues,
            ),
        };
      },
    );

    setGeneratedDraft(
      [],
    );

    setGeneratorMessage(
      null,
    );
  }

  function setTeamAvailability(
    teamId: string,
    enabled: boolean,
  ) {
    const allSlots =
      WEEK_DAYS.flatMap(
        (
          _day,
          dayIndex,
        ) =>
          GENERATOR_MATCH_TIMES.map(
            (time) =>
              availabilityKey(
                dayIndex,
                time,
              ),
          ),
      );

    setAvailability(
      (current) => ({
        ...current,
        [teamId]:
          enabled
            ? allSlots
            : [],
      }),
    );

    setGeneratedDraft(
      [],
    );

    setGeneratorMessage(
      null,
    );
  }

  async function handleGenerate() {
    if (
      !targetSeasonId
    ) {
      return;
    }

    const normalizedMatchweek =
      Number(
        matchweek,
      );

    if (
      !Number.isInteger(
        normalizedMatchweek,
      ) ||
      normalizedMatchweek <
        1
    ) {
      setImportError(
        "Inserisci una matchweek valida.",
      );

      return;
    }

    if (!weekStart) {
      setImportError(
        "Seleziona il lunedì della settimana da programmare.",
      );

      return;
    }

    resetMessages();

    try {
      const existingMatches =
        await FirebaseMatchRepository.getBySeason(
          targetSeasonId,
        );

      if (
        existingMatches.some(
          (match) =>
            match.matchweek ===
              normalizedMatchweek &&
            match.status !==
              "cancelled",
        )
      ) {
        setImportError(
          `La Matchweek ${normalizedMatchweek} esiste già. Scegli una nuova giornata.`,
        );

        return;
      }

      const generated =
        buildGeneratedSchedule({
          teamIds:
            targetSeasonTeams.map(
              (team) =>
                String(
                  team.id,
                ),
            ),
          matches:
            existingMatches,
          availability,
          weekStart,
          targetMatchweek:
            normalizedMatchweek,
          salt:
            generationSalt,
        });

      setGeneratedDraft(
        generated,
      );

      const scheduledTeams =
        new Set(
          generated.flatMap(
            (row) => [
              row.homeTeamId,
              row.awayTeamId,
            ],
          ),
        );

      const missingTeams =
        targetSeasonTeams
          .filter(
            (team) =>
              !scheduledTeams.has(
                String(
                  team.id,
                ),
              ),
          )
          .map(
            (team) =>
              team.aliasName?.trim() ||
              team.name,
          );

      if (
        generated.length ===
        0
      ) {
        setGeneratorMessage(
          "Non è stata trovata alcuna combinazione valida. Modifica le disponibilità e riprova.",
        );
      } else if (
        missingTeams.length >
        0
      ) {
        setGeneratorMessage(
          `Giornata parziale: ${generated.length} partite generate. Senza partita: ${missingTeams.join(", ")}.`,
        );
      } else {
        setGeneratorMessage(
          `Giornata completa: ${generated.length} partite generate correttamente.`,
        );
      }
    } catch (
      currentError
    ) {
      setImportError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile generare la giornata.",
      );
    }
  }

  async function saveMatchweek(
    draft: DraftMatch[],
  ) {
    if (
      !targetSeasonId ||
      isSavingMatchweek
    ) {
      return;
    }

    const normalizedMatchweek =
      Number(
        matchweek,
      );

    setIsSavingMatchweek(
      true,
    );

    resetMessages();

    try {
      /*
       * Rileggiamo il calendario immediatamente prima del salvataggio:
       * in questo modo i controlli comprendono anche eventuali modifiche
       * effettuate da un altro pannello admin nel frattempo.
       */
      const existingMatches =
        await FirebaseMatchRepository.getBySeason(
          targetSeasonId,
        );

      const errors =
        validateMatchweekDraft({
          matches:
            existingMatches,
          draft,
          matchweek:
            normalizedMatchweek,
        });

      if (
        errors.length >
        0
      ) {
        setImportError(
          errors.join(
            "\n",
          ),
        );

        return;
      }

      await FirebaseMatchRepository.createMany(
        draft.map(
          (row) => ({
            seasonId:
              targetSeasonId,
            matchType:
              "regularSeason",
            matchweek:
              normalizedMatchweek,
            matchweekId:
              `mw${normalizedMatchweek}`,
            date:
              row.date,
            time:
              row.time,
            venue:
              "Centro Sportivo Ludi",
            homeTeamId:
              row.homeTeamId,
            awayTeamId:
              row.awayTeamId,
          }),
        ),
      );

      setSuccessMessage(
        `Matchweek ${normalizedMatchweek} salvata: ${draft.length} ${
          draft.length === 1
            ? "partita"
            : "partite"
        }.`,
      );

      closeEditor();

      await onCompleted?.();
    } catch (
      currentError
    ) {
      setImportError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile salvare la giornata.",
      );
    } finally {
      setIsSavingMatchweek(
        false,
      );
    }
  }

  const isLoading =
    teamsLoading ||
    seasonTeamsLoading ||
    (!seasonId &&
      competitionLoading) ||
    isSavingMatchweek;

  const messages = (
    <>
      {teamsError && (
        <ErrorMessage
          message={
            teamsError
          }
        />
      )}

      {seasonTeamsError && (
        <ErrorMessage
          message={
            seasonTeamsError
          }
        />
      )}

      {!seasonId &&
        competitionError && (
          <ErrorMessage
            message={
              competitionError
            }
          />
        )}

      {importError && (
        <ErrorMessage
          message={
            importError
          }
        />
      )}

      {successMessage && (
        <div className="rounded-[14px] border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-700">
          {successMessage}
        </div>
      )}
    </>
  );

  return (
    <AppShell>
      
        {/* ======================================================
          HEADER
          ====================================================== */}
        <header className="mb-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#06142E]/35">
            Centro di controllo
          </p>

          <h1 className="mt-1 text-3xl font-black uppercase tracking-[-0.03em] text-[#06142E] sm:text-4xl">
            Calendario
          </h1>

          <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-[#06142E]/45">
            Crea, genera e gestisci le giornate della stagione corrente.
          </p>
        </header>

        <div className="min-w-0 space-y-5">

        <section className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              void openManualEditor();
            }}
            disabled={
              isLoading ||
              !targetSeasonId
            }
            className="ludi-button-primary min-h-16 w-full disabled:cursor-not-allowed disabled:opacity-40"
          >
            Inserisci nuova giornata
          </button>

          <button
            type="button"
            onClick={() => {
              void openGenerator();
            }}
            disabled={
              isLoading ||
              !targetSeasonId
            }
            className="min-h-16 w-full rounded-[13px] border border-[#06142E]/15 bg-white px-5 py-4 text-sm font-black uppercase text-[#06142E] transition hover:bg-[#06142E]/[0.03] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Genera giornata automaticamente
          </button>

          <button
            type="button"
            onClick={() => {
              void openBoard();
            }}
            disabled={
              isLoading ||
              isBoardLoading ||
              !targetSeasonId
            }
            className="min-h-14 w-full rounded-[13px] border border-[#06142E]/15 bg-white px-5 py-3 text-sm font-black uppercase text-[#06142E] transition hover:bg-[#06142E]/[0.03] disabled:cursor-not-allowed disabled:opacity-40 sm:col-span-2"
          >
            {isBoardLoading
              ? "Caricamento tabellone..."
              : "Vedi tabellone"}
          </button>
        </section>

        {editorMode ===
          "board" && (
          <ScheduleBoard
            teams={
              targetSeasonTeams
            }
            matches={
              boardMatches
            }
            isDoubleRound={
              (
                selectedCompetition
                  ?.id ??
                ""
              )
                .toLowerCase()
                .includes(
                  "championship",
                ) ||
              (
                selectedCompetition
                  ?.name ??
                ""
              )
                .toLowerCase()
                .includes(
                  "championship",
                )
            }
            selectedPairs={
              boardSelectedPairs
            }
            setSelectedPairs={
              setBoardSelectedPairs
            }
            onClose={
              closeEditor
            }
          />
        )}

        {editorMode ===
          "manual" && (
          <ManualMatchweekEditor
            matchweek={
              matchweek
            }
            setMatchweek={
              setMatchweek
            }
            rows={
              manualDraft
            }
            teams={
              targetSeasonTeams
            }
            isSaving={
              isSavingMatchweek
            }
            onChangeRow={
              updateManualRow
            }
            onAddRow={
              addManualRow
            }
            onRemoveRow={
              removeManualRow
            }
            onClose={
              closeEditor
            }
            onSave={() => {
              void saveMatchweek(
                manualDraft,
              );
            }}
          />
        )}

        {editorMode ===
          "generator" && (
          <GeneratorEditor
            matchweek={
              matchweek
            }
            setMatchweek={
              setMatchweek
            }
            weekStart={
              weekStart
            }
            setWeekStart={(
              value,
            ) => {
              setWeekStart(
                value,
              );

              setGeneratedDraft(
                [],
              );

              setGeneratorMessage(
                null,
              );
            }}
            weekDates={
              weekDates
            }
            teams={
              targetSeasonTeams
            }
            availability={
              availability
            }
            generatedDraft={
              generatedDraft
            }
            generatorMessage={
              generatorMessage
            }
            teamNameById={
              teamNameById
            }
            isSaving={
              isSavingMatchweek
            }
            onToggleAvailability={
              toggleAvailability
            }
            onSetTeamAvailability={
              setTeamAvailability
            }
            onGenerate={() => {
              void handleGenerate();
            }}
            onRegenerate={() => {
              setGenerationSalt(
                (current) =>
                  current + 1,
              );

              /*
               * handleGenerate usa il valore corrente dello state.
               * Il timeout permette al nuovo salt di essere applicato
               * prima di avviare la nuova ricerca.
               */
              window.setTimeout(
                () => {
                  void handleGenerate();
                },
                0,
              );
            }}
            onClose={
              closeEditor
            }
            onSave={() => {
              void saveMatchweek(
                generatedDraft,
              );
            }}
          />
        )}


        {messages}

      </div>
    </AppShell>
  );
}

function ManualMatchweekEditor({
  matchweek,
  setMatchweek,
  rows,
  teams,
  isSaving,
  onChangeRow,
  onAddRow,
  onRemoveRow,
  onClose,
  onSave,
}: {
  matchweek: string;
  setMatchweek:
    (value: string) =>
      void;
  rows: DraftMatch[];
  teams:
    Array<{
      id: string | number;
      name: string;
      aliasName?: string;
    }>;
  isSaving: boolean;
  onChangeRow:
    (
      rowId: string,
      patch:
        Partial<DraftMatch>,
    ) => void;
  onAddRow:
    () => void;
  onRemoveRow:
    (rowId: string) =>
      void;
  onClose:
    () => void;
  onSave:
    () => void;
}) {
  return (
    <section className="mt-10 w-full min-w-0 max-w-full space-y-5 overflow-x-hidden">
       <div className="w-full min-w-0 max-w-full overflow-hidden">
        <div className="flex w-full min-w-0 max-w-full flex-col gap-3">
          <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#06142E]/40">
            Inserimento manuale
          </p>

          <h2 className="mt-1 text-2xl font-black uppercase text-[#06142E]">
            Nuova giornata
          </h2>

          <p className="mt-1 text-sm font-bold text-[#06142E]/45">
            Ogni squadra può comparire una sola volta. Giorno e orario devono essere liberi.
          </p>
        </div>

        <button
          type="button"
          onClick={
            onClose
          }
          disabled={
            isSaving
          }
          className="max-w-full self-start whitespace-nowrap text-xs font-black uppercase text-[#06142E]/50 disabled:opacity-40 sm:shrink-0"
        >
          Chiudi
        </button>
      </div>

      <label className="mt-3 block max-w-xs">
        <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
          Matchweek
        </span>

        <input
          type="number"
          min={1}
          value={
            matchweek
          }
          onChange={(
            event,
          ) =>
            setMatchweek(
              event.target
                .value,
            )
          }
          className="ludi-input block w-full min-w-0 max-w-full box-border"
        />
      </label>

      <div className="mt-5 space-y-4">
        {rows.map(
          (
            row,
            index,
          ) => (
            <article
              key={
                row.id
              }
              className="min-w-0 max-w-full overflow-hidden rounded-[18px] border border-[#06142E]/10 bg-[#06142E]/[0.025] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-black uppercase text-[#06142E]">
                  Partita{" "}
                  {index +
                    1}
                </h3>

                {rows.length >
                  1 && (
                  <button
                    type="button"
                    onClick={() =>
                      onRemoveRow(
                        row.id,
                      )
                    }
                    className="text-[11px] font-black uppercase text-red-600"
                  >
                    Rimuovi
                  </button>
                )}
              </div>

              <div className="mt-4 grid min-w-0 grid-cols-1 gap-3">
                <label className="block min-w-0">
                  <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
                    Casa
                  </span>

                  <select
                    value={
                      row.homeTeamId
                    }
                    onChange={(
                      event,
                    ) =>
                      onChangeRow(
                        row.id,
                        {
                          homeTeamId:
                            event
                              .target
                              .value,
                        },
                      )
                    }
                    className="ludi-input block w-full min-w-0 max-w-full box-border"
                  >
                    <option value="">
                      Seleziona squadra
                    </option>

                    {teams.map(
                      (
                        team,
                      ) => (
                        <option
                          key={
                            team.id
                          }
                          value={String(
                            team.id,
                          )}
                        >
                          {
                            team.aliasName?.trim() ||
                            team.name
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className="block min-w-0">
                  <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
                    Ospite
                  </span>

                  <select
                    value={
                      row.awayTeamId
                    }
                    onChange={(
                      event,
                    ) =>
                      onChangeRow(
                        row.id,
                        {
                          awayTeamId:
                            event
                              .target
                              .value,
                        },
                      )
                    }
                    className="ludi-input block w-full min-w-0 max-w-full box-border"
                  >
                    <option value="">
                      Seleziona squadra
                    </option>

                    {teams.map(
                      (
                        team,
                      ) => (
                        <option
                          key={
                            team.id
                          }
                          value={String(
                            team.id,
                          )}
                        >
                          {
                            team.aliasName?.trim() ||
                            team.name
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className="block min-w-0">
                  <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
                    Data
                  </span>

                  <input
                    type="date"
                    value={
                      row.date
                    }
                    onChange={(
                      event,
                    ) =>
                      onChangeRow(
                        row.id,
                        {
                          date:
                            event
                              .target
                              .value,
                        },
                      )
                    }
                    className="ludi-input block w-full min-w-0 max-w-full box-border"
                  />
                </label>

                <label className="block min-w-0">
                  <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
                    Ora
                  </span>

                  <select
                    value={
                      row.time
                    }
                    onChange={(
                      event,
                    ) =>
                      onChangeRow(
                        row.id,
                        {
                          time:
                            event
                              .target
                              .value,
                        },
                      )
                    }
                    className="ludi-input block w-full min-w-0 max-w-full box-border"
                  >
                    {MATCH_TIMES.map(
                      (
                        time,
                      ) => (
                        <option
                          key={
                            time
                          }
                          value={
                            time
                          }
                        >
                          {
                            time
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>
            </article>
          ),
        )}
      </div>
      </div>

      <button
        type="button"
        onClick={
          onAddRow
        }
        disabled={
          isSaving
        }
        className="mt-4 w-full rounded-[13px] border border-[#06142E]/15 px-5 py-4 text-sm font-black uppercase text-[#06142E] disabled:opacity-40"
      >
        + Aggiungi partita
      </button>

      <button
        type="button"
        onClick={
          onSave
        }
        disabled={
          isSaving
        }
        className="ludi-button-primary mt-3 w-full disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isSaving
          ? "Salvataggio..."
          : "Salva giornata"}
      </button>
    </section>
  );
}

function formatGeneratedPreviewDate(
  value: string,
): string {
  const [
    yearValue,
    monthValue,
    dayValue,
  ] = value.split("-");

  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return value;
  }

  const date = new Date(
    year,
    month - 1,
    day,
  );

  const weekDays = [
    "Domenica",
    "Lunedi",
    "Martedi",
    "Mercoledi",
    "Giovedi",
    "Venerdi",
    "Sabato",
  ];

  return `${weekDays[date.getDay()]} ${day}`;
}


function ScheduleBoard({
  teams,
  matches,
  isDoubleRound,
  selectedPairs,
  setSelectedPairs,
  onClose,
}: {
  teams:
    Array<{
      id: string | number;
      name: string;
      shortName?: string;
      aliasName?: string;
    }>;
  matches: Match[];
  isDoubleRound: boolean;
  selectedPairs: Set<string>;
  setSelectedPairs:
    (
      value:
        | Set<string>
        | ((
            current:
              Set<string>,
          ) => Set<string>),
    ) => void;
  onClose: () => void;
}) {
  const orderedTeams =
    useMemo(
      () =>
        teams
          .slice()
          .sort(
            (
              first,
              second,
            ) =>
              (
                first.shortName?.trim() ||
                first.aliasName?.trim() ||
                first.name
              ).localeCompare(
                second.shortName?.trim() ||
                  second.aliasName?.trim() ||
                  second.name,
                "it",
              ),
          ),
      [
        teams,
      ],
    );

  const scheduledCounts =
    useMemo(
      () => {
        const counts =
          new Map<
            string,
            number
          >();

        for (
          const match of
          matches
        ) {
          const key =
            pairKey(
              String(
                match.homeTeamId,
              ),
              String(
                match.awayTeamId,
              ),
            );

          counts.set(
            key,
            (counts.get(
              key,
            ) ?? 0) + 1,
          );
        }

        return counts;
      },
      [
        matches,
      ],
    );

  const selectedTeamIds =
    useMemo(
      () => {
        const values =
          new Set<string>();

        for (
          const key of
          selectedPairs
        ) {
          const [
            firstTeamId,
            secondTeamId,
          ] =
            key.split(
              "|",
            );

          if (
            firstTeamId
          ) {
            values.add(
              firstTeamId,
            );
          }

          if (
            secondTeamId
          ) {
            values.add(
              secondTeamId,
            );
          }
        }

        return values;
      },
      [
        selectedPairs,
      ],
    );

  function cellKey(
    rowTeamId: string,
    columnTeamId: string,
  ) {
    return `${rowTeamId}|${columnTeamId}`;
  }

  function isScheduledCell(
    rowIndex: number,
    columnIndex: number,
    rowTeamId: string,
    columnTeamId: string,
  ) {
    const count =
      scheduledCounts.get(
        pairKey(
          rowTeamId,
          columnTeamId,
        ),
      ) ?? 0;

    if (
      count <= 0
    ) {
      return false;
    }

    if (
      !isDoubleRound
    ) {
      return (
        rowIndex <
        columnIndex
      );
    }

    if (
      count >= 2
    ) {
      return true;
    }

    /*
     * Championship:
     * la prima partita già prevista occupa la prima metà
     * del tabellone; la seconda metà resta disponibile
     * per il ritorno finché non viene programmato.
     */
    return (
      rowIndex <
      columnIndex
    );
  }

  function togglePair(
    rowTeamId: string,
    columnTeamId: string,
  ) {
    const key =
      cellKey(
        rowTeamId,
        columnTeamId,
      );

    setSelectedPairs(
      (
        current,
      ) => {
        const next =
          new Set(
            current,
          );

        if (
          next.has(
            key,
          )
        ) {
          next.delete(
            key,
          );

          return next;
        }

        const teamAlreadyUsed =
          Array.from(
            next,
          ).some(
            (
              selectedKey,
            ) => {
              const [
                firstTeamId,
                secondTeamId,
              ] =
                selectedKey.split(
                  "|",
                );

              return (
                firstTeamId ===
                  rowTeamId ||
                secondTeamId ===
                  rowTeamId ||
                firstTeamId ===
                  columnTeamId ||
                secondTeamId ===
                  columnTeamId
              );
            },
          );

        if (
          teamAlreadyUsed
        ) {
          return current;
        }

        next.add(
          key,
        );

        return next;
      },
    );
  }

  return (
    <section className="mt-5 min-w-0 rounded-[16px] border border-[#06142E]/10 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#06142E]/35">
            Supporto calendario
          </p>

          <h2 className="mt-1 text-2xl font-black uppercase text-[#06142E]">
            Tabellone incroci
          </h2>

          <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-[#06142E]/45">
            Seleziona gli incroci da utilizzare come promemoria per la prossima giornata. Ogni squadra può essere selezionata una sola volta.
          </p>
        </div>

        <button
          type="button"
          onClick={
            onClose
          }
          className="self-start rounded-[10px] border border-[#06142E]/10 bg-white px-3 py-2 text-[10px] font-black uppercase text-[#06142E]/55"
        >
          Chiudi
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase">
        <span className="rounded-full border border-[#06142E]/10 bg-[#06142E]/[0.03] px-3 py-2 text-[#06142E]/45">
          Vuota = disponibile
        </span>

        <span className="rounded-full border border-amber-300 bg-amber-100 px-3 py-2 text-amber-900">
          Giallo = selezionata
        </span>

        <span className="rounded-full border border-[#06142E]/20 bg-white px-3 py-2 text-[#06142E]">
          X = già in calendario
        </span>

        <span className="rounded-full bg-black px-3 py-2 text-white">
          Nero = non utilizzabile
        </span>
      </div>

      <div className="no-scrollbar mt-5 w-full overflow-x-auto overscroll-x-contain">
        <table className="border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 min-w-[86px] bg-white" />

              {orderedTeams.map(
                (
                  team,
                ) => {
                  const teamId =
                    String(
                      team.id,
                    );

                  const active =
                    selectedTeamIds.has(
                      teamId,
                    );

                  return (
                    <th
                      key={
                        teamId
                      }
                      className={`min-w-[62px] max-w-[78px] rounded-[8px] px-1 py-2 text-center text-[9px] font-black uppercase leading-tight ${
                        active
                          ? "bg-amber-100 text-amber-900"
                          : "bg-[#06142E]/[0.04] text-[#06142E]"
                      }`}
                    >
                      <span className="block break-words">
                        {team.shortName?.trim() ||
                          team.aliasName?.trim() ||
                          team.name}
                      </span>
                    </th>
                  );
                },
              )}
            </tr>
          </thead>

          <tbody>
            {orderedTeams.map(
              (
                rowTeam,
                rowIndex,
              ) => {
                const rowTeamId =
                  String(
                    rowTeam.id,
                  );

                const rowActive =
                  selectedTeamIds.has(
                    rowTeamId,
                  );

                return (
                  <tr
                    key={
                      rowTeamId
                    }
                  >
                    <th
                      className={`sticky left-0 z-10 min-w-[86px] max-w-[110px] rounded-[8px] px-2 py-2 text-left text-[9px] font-black uppercase leading-tight ${
                        rowActive
                          ? "bg-amber-100 text-amber-900"
                          : "bg-[#F4F6F8] text-[#06142E]"
                      }`}
                    >
                      {rowTeam.shortName?.trim() ||
                        rowTeam.aliasName?.trim() ||
                        rowTeam.name}
                    </th>

                    {orderedTeams.map(
                      (
                        columnTeam,
                        columnIndex,
                      ) => {
                        const columnTeamId =
                          String(
                            columnTeam.id,
                          );

                        const sameTeam =
                          rowTeamId ===
                          columnTeamId;

                        const mirroredBlocked =
                          !isDoubleRound &&
                          rowIndex >
                            columnIndex;

                        const scheduled =
                          !sameTeam &&
                          !mirroredBlocked &&
                          isScheduledCell(
                            rowIndex,
                            columnIndex,
                            rowTeamId,
                            columnTeamId,
                          );

                        const key =
                          cellKey(
                            rowTeamId,
                            columnTeamId,
                          );

                        const selected =
                          selectedPairs.has(
                            key,
                          );

                        const unavailable =
                          sameTeam ||
                          mirroredBlocked;

                        return (
                          <td
                            key={
                              columnTeamId
                            }
                            className="p-0"
                          >
                            <button
                              type="button"
                              disabled={
                                unavailable ||
                                scheduled
                              }
                              onClick={() =>
                                togglePair(
                                  rowTeamId,
                                  columnTeamId,
                                )
                              }
                              className={`flex h-11 w-14 items-center justify-center rounded-[8px] border text-sm font-black transition ${
                                unavailable
                                  ? "cursor-not-allowed border-black bg-black text-black"
                                  : scheduled
                                    ? "cursor-not-allowed border-[#06142E]/15 bg-[#06142E]/[0.06] text-[#06142E]"
                                    : selected
                                      ? "border-amber-300 bg-amber-100 text-amber-900"
                                      : "border-[#06142E]/10 bg-white text-[#06142E]/30 hover:bg-[#06142E]/[0.03]"
                              }`}
                              aria-label={
                                unavailable
                                  ? "Cella non utilizzabile"
                                  : scheduled
                                    ? "Partita già prevista in calendario"
                                    : selected
                                      ? "Deseleziona incrocio"
                                      : "Seleziona incrocio"
                              }
                            >
                              {scheduled
                                ? "X"
                                : ""}
                            </button>
                          </td>
                        );
                      },
                    )}
                  </tr>
                );
              },
            )}
          </tbody>
        </table>
      </div>

      {isDoubleRound && (
        <p className="mt-4 text-xs font-bold leading-5 text-[#06142E]/45">
          Championship: le due metà della matrice rappresentano i due cicli di incontri. La selezione di una cella non modifica la cella speculare.
        </p>
      )}
    </section>
  );
}

function GeneratorEditor({
  matchweek,
  setMatchweek,
  weekStart,
  setWeekStart,
  weekDates,
  teams,
  availability,
  generatedDraft,
  generatorMessage,
  teamNameById,
  isSaving,
  onToggleAvailability,
  onSetTeamAvailability,
  onGenerate,
  onRegenerate,
  onClose,
  onSave,
}: {
  matchweek: string;
  setMatchweek:
    (value: string) =>
      void;
  weekStart: string;
  setWeekStart:
    (value: string) =>
      void;
  weekDates:
    Array<{
      day: string;
      date: string;
    }>;
  teams:
    Array<{
      id: string | number;
      name: string;
      aliasName?: string;
    }>;
  availability:
    AvailabilityMap;
  generatedDraft:
    DraftMatch[];
  generatorMessage:
    string | null;
  teamNameById:
    Map<string, string>;
  isSaving: boolean;
  onToggleAvailability:
    (
      teamId: string,
      dayIndex: number,
      time: string,
    ) => void;
  onSetTeamAvailability:
    (
      teamId: string,
      enabled: boolean,
    ) => void;
  onGenerate:
    () => void;
  onRegenerate:
    () => void;
  onClose:
    () => void;
  onSave:
    () => void;
}) {
  return (
    <section className="mt-10 w-full min-w-0 max-w-full space-y-5 overflow-x-hidden">
      <div className="w-full min-w-0 max-w-full overflow-hidden">
        <div className="flex w-full min-w-0 max-w-full flex-col gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#06142E]/40">
              Generatore calendario
            </p>

            <h2 className="mt-1 text-2xl font-black uppercase text-[#06142E]">
              Disponibilità squadre
            </h2>

            <p className="mt-1 text-sm font-bold text-[#06142E]/45">
              Clicca una volta per la disponibilità, due volte per la preferenza e tre volte per rendere lo slot indisponibile.
            </p>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            disabled={
              isSaving
            }
            className="max-w-full self-start whitespace-nowrap text-xs font-black uppercase text-[#06142E]/50 disabled:opacity-40 sm:shrink-0"
          >
            Chiudi
          </button>
        </div>

        <div className="mt-5 grid min-w-0 grid-cols-1 gap-3">
          <label className="block min-w-0">
            <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
              Matchweek
            </span>

            <input
              type="number"
              min={1}
              value={
                matchweek
              }
              onChange={(
                event,
              ) =>
                setMatchweek(
                  event.target
                    .value,
                )
              }
              className="ludi-input block w-full min-w-0 max-w-full box-border"
            />
          </label>

          <label className="block min-w-0">
            <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
              Settimana
            </span>

            <input
              type="date"
              value={
                weekStart
              }
              onChange={(
                event,
              ) =>
                setWeekStart(
                  event.target
                    .value,
                )
              }
              className="ludi-input block w-full min-w-0 max-w-full box-border"
            />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase">
        <span className="rounded-full border border-[#06142E]/10 bg-[#06142E]/[0.03] px-3 py-2 text-[#06142E]/45">
          — Indisponibile
        </span>

        <span className="rounded-full border border-emerald-300 bg-emerald-100 px-3 py-2 text-emerald-800">
          ✓ Disponibile
        </span>

        <span className="rounded-full border border-sky-400 bg-sky-100 px-3 py-2 text-sky-800">
          ★ Preferenza
        </span>
      </div>

      <div className="space-y-4">
        {teams.map(
          (team) => {
            const teamId =
              String(
                team.id,
              );

            const selectedCount =
              new Set(
                (
                  availability[
                    teamId
                  ] ?? []
                ).map(
                  normalizeAvailabilitySlot,
                ),
              ).size;

            return (
              <article
                key={
                  team.id
                }
                className="ludi-card min-w-0 max-w-full overflow-hidden p-2"
              >
                <div className="flex min-w-0 flex-col gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words text-lg font-black uppercase text-[#06142E]">
                      {
                        team.aliasName?.trim() ||
                        team.name
                      }
                    </h3>

                    <p className="mt-1 text-xs font-bold text-[#06142E]/45">
                      {selectedCount} slot disponibili
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onSetTeamAvailability(
                          teamId,
                          true,
                        )
                      }
                      className="rounded-[10px] bg-[#06142E]/5 px-3 py-2 text-[10px] font-black uppercase text-[#06142E]"
                    >
                      Tutti
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onSetTeamAvailability(
                          teamId,
                          false,
                        )
                      }
                      className="rounded-[10px] bg-[#06142E]/5 px-3 py-2 text-[10px] font-black uppercase text-[#06142E]"
                    >
                      Azzera
                    </button>
                  </div>
                </div>

                <div className="no-scrollbar mt-2 block w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
                  <table className="w-full min-w-[360px] table-fixed border-separate border-spacing-x-2 border-spacing-y-2">
                    <thead>
                      <tr>
                        <th className="w-[35px]" />

                        {weekDates.map(
                          (
                            item,
                          ) => (
                            <th
                              key={
                                item.day
                              }
                              className="pb-1 text-center"
                            >
                              <span className="block text-[10px] font-black uppercase text-[#06142E]/45">
                                {
                                  item.day
                                }
                              </span>

                              <span className="mt-1 block text-xs font-black text-[#06142E]">
                                {formatCompactDate(
                                  item.date,
                                )}
                              </span>
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>

                    <tbody>
                      {GENERATOR_MATCH_TIMES.map(
                        (
                          time,
                        ) => (
                          <tr
                            key={
                              time
                            }
                          >
                            <th className="w-[40px] pr-1 text-left text-xs font-black text-[#06142E]">
                              {
                                time
                              }
                            </th>

                            {weekDates.map(
                              (
                                _item,
                                dayIndex,
                              ) => {
                                const key =
                                  availabilityKey(
                                    dayIndex,
                                    time,
                                  );

                                const state =
                                  getAvailabilityState(
                                    availability[
                                      teamId
                                    ] ??
                                      [],
                                    key,
                                  );

                                const active =
                                  state !==
                                  "unavailable";

                                return (
                                  <td
                                    key={
                                      key
                                    }
                                    className="px-0.5 text-center"
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onToggleAvailability(
                                          teamId,
                                          dayIndex,
                                          time,
                                        )
                                      }
                                      className={`h-8 w-14 rounded-[10px] border text-xs font-black transition ${
                                        state ===
                                        "preferred"
                                          ? "border-sky-400 bg-sky-100 text-sky-800"
                                          : state ===
                                              "available"
                                            ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                                            : "border-[#06142E]/10 bg-[#06142E]/[0.03] text-[#06142E]/35"
                                      }`}
                                      aria-pressed={
                                        active
                                      }
                                      aria-label={
                                        state ===
                                        "preferred"
                                          ? "Preferenza"
                                          : state ===
                                              "available"
                                            ? "Disponibile"
                                            : "Indisponibile"
                                      }
                                    >
                                      {state ===
                                      "preferred"
                                        ? "★"
                                        : state ===
                                            "available"
                                          ? "✓"
                                          : "—"}
                                    </button>
                                  </td>
                                );
                              },
                            )}
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            );
          },
        )}
      </div>

      <button
        type="button"
        onClick={
          onGenerate
        }
        disabled={
          isSaving
        }
        className="ludi-button-primary w-full disabled:opacity-40"
      >
        Genera giornata
      </button>

      {generatorMessage && (
        <div className="rounded-[14px] border border-[#06142E]/10 bg-white p-4 text-sm font-bold text-[#06142E]/70">
          {
            generatorMessage
          }
        </div>
      )}

      {generatedDraft.length >
        0 && (
        <section className="ludi-card min-w-0 max-w-full p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#06142E]/40">
                Anteprima
              </p>

              <h3 className="mt-1 text-2xl font-black uppercase text-[#06142E]">
                Matchweek{" "}
                {
                  matchweek
                }
              </h3>
            </div>

            <button
              type="button"
              onClick={
                onRegenerate
              }
              disabled={
                isSaving
              }
              className="rounded-[11px] border border-[#06142E]/15 px-4 py-3 text-xs font-black uppercase text-[#06142E] disabled:opacity-40"
            >
              Rigenera
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {generatedDraft.map(
              (row) => (
                <article
                  key={
                    row.id
                  }
                  className="min-w-0 rounded-[15px] bg-[#06142E]/[0.045] p-4"
                >
                  <p className="text-xs font-black uppercase text-[#06142E]/45">
                    {formatGeneratedPreviewDate(
                      row.date,
                    )} ·{" "}
                    {row.time}
                  </p>

                  <p className="mt-2 break-words text-base font-black uppercase text-[#06142E]">
                    {teamNameById.get(
                      row.homeTeamId,
                    ) ??
                      "Casa"}
                    {" — "}
                    {teamNameById.get(
                      row.awayTeamId,
                    ) ??
                      "Ospite"}
                  </p>
                </article>
              ),
            )}
          </div>

          <button
            type="button"
            onClick={
              onSave
            }
            disabled={
              isSaving
            }
            className="ludi-button-primary mt-5 w-full disabled:opacity-40"
          >
            {isSaving
              ? "Salvataggio..."
              : "Salva giornata"}
          </button>
        </section>
      )}
    </section>
  );
}

function ErrorMessage({
  message,
}: {
  message: string;
}) {
  return (
    <div className="whitespace-pre-line rounded-[14px] border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
      {message}
    </div>
  );
}
