import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  authenticateQuizUser: vi.fn(), finalizeCompletedInProgressAttempt: vi.fn(),
  getSeasonLeaderboard: vi.fn(), getActiveQuizSeasonLeaderboard: vi.fn(),
  loadWeeklyQuizContext: vi.fn(), enforceUserApiRateLimit: vi.fn(),
}));
vi.mock("@/src/lib/apiRateLimit", () => ({ enforceUserApiRateLimit: mocks.enforceUserApiRateLimit }));
vi.mock("@/src/server/games/quiz/GamesQuizServer", () => ({
  ...mocks,
  QuizHttpError: class extends Error { constructor(public status: number, message: string) { super(message); } },
  getQuizErrorResponse: (error: { status?: number; message: string }) => ({ status: error.status ?? 500, message: error.message }),
}));
import { GET } from "./route";
function request(query = "gamesSeasonId=season") {
  return GET(new Request(`http://localhost/api/games/quiz/quiz?${query}`), { params: Promise.resolve({ gameId: "quiz" }) });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.authenticateQuizUser.mockResolvedValue({ uid: "user" });
  mocks.enforceUserApiRateLimit.mockResolvedValue(null);
  mocks.loadWeeklyQuizContext.mockResolvedValue({ gameId: "quiz", gamesSeasonId: "season", weekId: "week", canParticipate: true });
  mocks.finalizeCompletedInProgressAttempt.mockResolvedValue(null);
  mocks.getSeasonLeaderboard.mockResolvedValue([{ userId: "leader" }]);
  mocks.getActiveQuizSeasonLeaderboard.mockResolvedValue([{ userId: "leader" }]);
});
describe("Weekly Challenge progressive loading", () => {
  it("returns playable metadata without waiting for the ranking", async () => {
    mocks.getSeasonLeaderboard.mockImplementation(() => new Promise(() => {}));
    const response = await request("gamesSeasonId=season&includeLeaderboard=false");
    const data = await response.json();
    expect(data.participation.canStart).toBe(true);
    expect(data.seasonLeaderboard).toEqual([]);
    expect(mocks.getSeasonLeaderboard).not.toHaveBeenCalled();
  });
  it("preserves completed attempts returned by recovery", async () => {
    mocks.finalizeCompletedInProgressAttempt.mockResolvedValue({ status: "completed", score: 700 });
    const data = await (await request("gamesSeasonId=season&includeLeaderboard=false")).json();
    expect(data.participation.canStart).toBe(false);
    expect(data.myWeeklyResult.score).toBe(700);
  });
  it("loads the ranking separately with authentication and rate limiting", async () => {
    const data = await (await request("gamesSeasonId=season&section=leaderboard")).json();
    expect(data.seasonLeaderboard).toEqual([{ userId: "leader" }]);
    expect(mocks.authenticateQuizUser).toHaveBeenCalledOnce();
    expect(mocks.enforceUserApiRateLimit).toHaveBeenCalledOnce();
    expect(mocks.getActiveQuizSeasonLeaderboard).toHaveBeenCalledWith({ gamesSeasonId: "season", gameId: "quiz" });
    expect(mocks.loadWeeklyQuizContext).not.toHaveBeenCalled();
    expect(mocks.finalizeCompletedInProgressAttempt).not.toHaveBeenCalled();
  });
  it("keeps the full response for existing clients", async () => {
    const data = await (await request()).json();
    expect(data.seasonLeaderboard).toEqual([{ userId: "leader" }]);
  });
  it("rejects a missing season in the separate ranking request", async () => {
    expect((await request("section=leaderboard")).status).toBe(400);
    expect(mocks.getActiveQuizSeasonLeaderboard).not.toHaveBeenCalled();
  });
  it("does not load ranking data when access authentication fails", async () => {
    mocks.authenticateQuizUser.mockRejectedValue({ status: 401, message: "Accesso richiesto" });
    expect((await request("gamesSeasonId=season&section=leaderboard")).status).toBe(401);
    expect(mocks.getActiveQuizSeasonLeaderboard).not.toHaveBeenCalled();
  });
});
