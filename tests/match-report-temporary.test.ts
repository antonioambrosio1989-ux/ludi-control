import { describe, expect, it } from "vitest";

import {
  createTemporaryGoalkeeperId,
  createTemporaryLineupGuestId,
  parseTemporaryGoalkeeperId,
  parseTemporaryLineupGuestId,
  isTemporaryMatchPlayerId,
} from "@/src/services/match/TemporaryMatchPlayer";

import {
  MatchReportDisciplineAdapter,
} from "@/src/services/discipline/MatchReportDisciplineAdapter";

describe("Match Report - giocatori provvisori", () => {
  const guestId = createTemporaryLineupGuestId({
    teamId: "team-home",
    guestId: "guest-123",
    name: "Mario Rossi",
    role: "Attaccante",
  });

  const goalkeeperId = createTemporaryGoalkeeperId({
    teamId: "team-away",
    firstName: "Luigi",
    lastName: "Verdi",
  });

  it("riconosce il giocatore provvisorio approvato", () => {
    expect(isTemporaryMatchPlayerId(guestId)).toBe(true);

    expect(parseTemporaryLineupGuestId(guestId)).toMatchObject({
      teamId: "team-home",
      name: "Mario Rossi",
      role: "Attaccante",
      temporary: true,
    });
  });

  it("riconosce il portiere temporaneo", () => {
    expect(isTemporaryMatchPlayerId(goalkeeperId)).toBe(true);

    expect(parseTemporaryGoalkeeperId(goalkeeperId)).toMatchObject({
      teamId: "team-away",
      name: "Luigi Verdi",
      role: "Portiere",
      temporary: true,
    });
  });

  it("non identifica un tesserato ufficiale come provvisorio", () => {
    expect(isTemporaryMatchPlayerId("player-123")).toBe(false);
  });

  it("rifiuta ID provvisori incompleti", () => {
    expect(isTemporaryMatchPlayerId("__ludi_temp_lineup_guest__|x")).toBe(false);
    expect(isTemporaryMatchPlayerId("__ludi_temp_gk__|x")).toBe(false);
  });

  it("esclude entrambi i provvisori dalla disciplina", () => {
    const report = {
      matchId: "test-match-001",
      performances: {
        [guestId]: {
          playerId: guestId,
          teamId: "team-home",
          yellowCards: 2,
          directRedCards: 1,
        },
        [goalkeeperId]: {
          playerId: goalkeeperId,
          teamId: "team-away",
          yellowCards: 1,
          directRedCards: 1,
        },
      },
    } as unknown as Parameters<
      typeof MatchReportDisciplineAdapter.extract
    >[0];

    expect(MatchReportDisciplineAdapter.extract(report)).toEqual([]);
  });

  it("mantiene i cartellini dei tesserati ufficiali", () => {
    const report = {
      matchId: "test-match-002",
      performances: {
        "player-123": {
          playerId: "player-123",
          teamId: "team-home",
          yellowCards: 2,
          directRedCards: 1,
        },
        [guestId]: {
          playerId: guestId,
          teamId: "team-home",
          yellowCards: 1,
          directRedCards: 1,
        },
      },
    } as unknown as Parameters<
      typeof MatchReportDisciplineAdapter.extract
    >[0];

    const result = MatchReportDisciplineAdapter.extract(report);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      playerId: "player-123",
      teamId: "team-home",
      yellowCards: 2,
      directRedCards: 1,
    });
  });
});
