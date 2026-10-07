import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/src/lib/requireAdminApi";
import {
  changeVotingStatus,
  createBuildXiWorkbook,
  createVotingPoll,
  deleteVotingPoll,
  getMatchVotingPlayerCandidates,
  getVotingAdminPreview,
  getVotingPoll,
  importBuildXiWorkbook,
  listVotingPolls,
  resetVotingPoll,
  reorderVotingPolls,
  updateBestOfMonthConfig,
  updateCeremonyAwardConfig,
  updateManOfTheMatchConfig,
  updateScorePredictionConfig,
  updateVotingMetadata,
} from "@/src/server/games/voting/BuildXiServer";
import type {
  BestOfMonthAwardKey,
  VotingCandidate,
  VotingStatus,
  VotingType,
} from "@/src/types/GamesVoting";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ gameId: string }> },
) {
  try {
    await requireAdminApi(request);
    const { gameId } = await context.params;
    const pollId = request.nextUrl.searchParams.get("pollId");
    const matchId = request.nextUrl.searchParams.get("matchId");
    const players = request.nextUrl.searchParams.get("players");

    if (matchId && (players === "lineup" || players === "roster")) {
      return NextResponse.json(
        { candidates: await getMatchVotingPlayerCandidates(matchId, players) },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (request.nextUrl.searchParams.get("preview") === "1" && pollId) {
      const preview = await getVotingAdminPreview(pollId);
      if (preview.poll.gameId !== gameId) throw new Error("VOTING_NOT_FOUND");
      return NextResponse.json(preview, { headers: { "Cache-Control": "no-store" } });
    }

    if (request.nextUrl.searchParams.get("download") === "template" && pollId) {
      await assertPollBelongsToGame(pollId, gameId);
      const poll = await getVotingPoll(pollId);
      if (poll.type !== "build_xi") throw new Error("BUILD_XI_ONLY");
      const bytes = await createBuildXiWorkbook(pollId);
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="build-xi-${pollId}.xlsx"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json(
      { polls: await listVotingPolls(gameId) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ gameId: string }> },
) {
  try {
    const admin = await requireAdminApi(request);
    const { gameId } = await context.params;
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const pollId = String(formData.get("pollId") ?? "");
      const file = formData.get("file");
      if (!pollId || !(file instanceof File)) throw new Error("FILE_REQUIRED");
      await assertPollBelongsToGame(pollId, gameId);
      const poll = await importBuildXiWorkbook(pollId, await file.arrayBuffer());
      return NextResponse.json({ poll });
    }

    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "create");

    if (action === "create") {
      const pollId = await createVotingPoll({
        gameId,
        title: String(body.title ?? ""),
        description: String(body.description ?? ""),
        competitionId: String(body.competitionId ?? ""),
        type: String(body.type ?? "ceremony_award") as VotingType,
        createdBy: admin.uid,
      });
      return NextResponse.json({ pollId }, { status: 201 });
    }

    if (action === "reorder") {
      const orderedPollIds = Array.isArray(body.orderedPollIds)
        ? body.orderedPollIds.map(String)
        : [];

      await reorderVotingPolls(gameId, orderedPollIds);
      return NextResponse.json({ success: true });
    }

    const pollId = String(body.pollId ?? "");
    await assertPollBelongsToGame(pollId, gameId);

    if (action === "metadata") {
      await updateVotingMetadata(pollId, {
        title: body.title === undefined ? undefined : String(body.title),
        description: body.description === undefined ? undefined : String(body.description),
        competitionId: body.competitionId === undefined ? undefined : String(body.competitionId),
      });
      return NextResponse.json({ success: true });
    }

    if (action === "best-of-month-config") {
      const awardsRecord = asRecord(body.awards);
      const awards: Partial<Record<BestOfMonthAwardKey, VotingCandidate[]>> = {};
      for (const key of ["player_of_the_month", "goal_of_the_month", "save_of_the_month"] as BestOfMonthAwardKey[]) {
        awards[key] = Array.isArray(awardsRecord[key])
          ? awardsRecord[key] as VotingCandidate[]
          : [];
      }
      await updateBestOfMonthConfig(pollId, {
        monthKey: String(body.monthKey ?? ""),
        opensAtMs: Number(body.opensAtMs ?? 0),
        awards,
      });
      return NextResponse.json({ success: true });
    }

    if (action === "score-prediction-config") {
      await updateScorePredictionConfig(pollId, {
        matchId: String(body.matchId ?? ""),
        posterImageUrl: String(body.posterImageUrl ?? ""),
        scorerOptions: Array.isArray(body.scorerOptions)
          ? body.scorerOptions as VotingCandidate[]
          : [],
      });
      return NextResponse.json({ success: true });
    }

    if (action === "motm-config") {
      await updateManOfTheMatchConfig(pollId, {
        matchId: String(body.matchId ?? ""),
        candidates: Array.isArray(body.candidates)
          ? body.candidates as VotingCandidate[]
          : [],
      });
      return NextResponse.json({ success: true });
    }

    if (action === "ceremony-config") {
      await updateCeremonyAwardConfig(pollId, {
        awardName: String(body.awardName ?? ""),
        candidates: Array.isArray(body.candidates)
          ? body.candidates as VotingCandidate[]
          : [],
      });
      return NextResponse.json({ success: true });
    }

    if (action === "status") {
      await changeVotingStatus(pollId, String(body.status ?? "") as VotingStatus);
      return NextResponse.json({ success: true });
    }

    if (action === "reset") {
      await resetVotingPoll(pollId);
      return NextResponse.json({ success: true });
    }

    if (action === "delete") {
      await deleteVotingPoll(pollId);
      return NextResponse.json({ success: true });
    }

    throw new Error("INVALID_ACTION");
  } catch (error) {
    return apiError(error);
  }
}

async function assertPollBelongsToGame(pollId: string, gameId: string) {
  if (!pollId) throw new Error("VOTING_NOT_FOUND");
  const poll = await getVotingPoll(pollId);
  if (poll.gameId !== gameId) throw new Error("VOTING_NOT_FOUND");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function apiError(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  const unauthorized = code === "UNAUTHORIZED" || code === "FORBIDDEN";
  const messages: Record<string, string> = {
    TITLE_REQUIRED: "Inserisci il titolo della votazione.",
    INVALID_VOTING_TYPE: "Seleziona un tipo di votazione valido.",
    ACTIVE_COMPETITION_REQUIRED: "Seleziona una competizione attiva.",
    ACTIVE_SEASON_REQUIRED: "La competizione non ha una stagione attiva.",
    DUPLICATE_BUILD_XI: "Esiste già una BUILD XI aperta per questa competizione e stagione.",
    FILE_REQUIRED: "Seleziona il file Excel compilato.",
    INVALID_WORKBOOK: "Il file Excel non contiene il foglio Giocatori votabili.",
    INVALID_CANDIDATE_ROWS: "Il file contiene giocatori duplicati, modificati o non eleggibili.",
    INCOMPLETE_CANDIDATE_LIST: "Il file deve contenere tutti i giocatori esportati.",
    BUILD_XI_ONLY: "Questa operazione è disponibile soltanto per una votazione BUILD XI.",
    INVALID_MONTH: "Seleziona il mese della votazione.",
    INVALID_VOTING_WINDOW: "Imposta una data e un orario di apertura validi.",
    MATCH_NOT_FOUND: "Partita non trovata tra le competizioni in corso.",
    MATCH_ALREADY_STARTED: "La partita selezionata è già iniziata.",
    MOTM_EXACTLY_FOUR: "Man Of The Match richiede esattamente 4 candidati.",
    AWARD_NAME_REQUIRED: "Inserisci il nome del premio.",
    DUPLICATE_CANDIDATE: "Lo stesso candidato non può essere inserito due volte.",
    CANDIDATES_REQUIRED: "Inserisci i candidati della votazione.",
    VOTING_NOT_READY: "Completa la configurazione della votazione prima di pubblicarla.",
    VOTING_NOT_EDITABLE: "Questa votazione non è più modificabile.",
    VOTING_NOT_FOUND: "Votazione non trovata.",
    INVALID_VOTING_ORDER: "Impossibile salvare il nuovo ordine delle votazioni.",
  };
  const detail = code.startsWith("INVALID_BUILD_XI_ROLE:")
    ? `Ruolo BUILD XI non valido per ${code.split(":").slice(1).join(":")}.`
    : code.startsWith("NOT_ENOUGH_ROLE:")
      ? `Non ci sono abbastanza giocatori nel reparto ${code.split(":")[1]}.`
      : messages[code] ?? (unauthorized ? "Operazione non autorizzata." : "Impossibile completare l'operazione.");

  return NextResponse.json(
    { error: detail },
    { status: unauthorized ? 403 : code === "VOTING_NOT_FOUND" ? 404 : 400 },
  );
}
