import { NextRequest, NextResponse } from "next/server";

import { requireGamesApiAccess } from "@/src/lib/requireGamesApiAccess";
import {
  getPublishedVotingRuntime,
  getVotingPoll,
  submitBestOfMonthVote,
  submitBuildXi,
  submitScorePrediction,
  submitSingleChoiceVote,
} from "@/src/server/games/voting/BuildXiServer";
import type {
  BestOfMonthAwardKey,
  BuildXiLineup,
} from "@/src/types/GamesVoting";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ gameId: string; pollId: string }> },
) {
  const { gameId } = await context.params;
  const access = await requireGamesApiAccess(request, { gameId, rateLimitProfile: "gamesQuizRead" });
  if (!access.ok) return access.response;
  try {
    const { pollId } = await context.params;
    const poll = await getVotingPoll(pollId);
    if (poll.gameId !== gameId) throw new Error("VOTING_NOT_FOUND");
    return NextResponse.json(
      await getPublishedVotingRuntime(pollId, access.decodedToken.uid),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return runtimeError(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ gameId: string; pollId: string }> },
) {
  const { gameId } = await context.params;
  const access = await requireGamesApiAccess(request, { gameId, rateLimitProfile: "gamesFantasyMutation" });
  if (!access.ok) return access.response;
  try {
    const { pollId } = await context.params;
    const poll = await getVotingPoll(pollId);
    if (poll.gameId !== gameId) throw new Error("VOTING_NOT_FOUND");
    const body = await request.json() as Record<string, unknown>;

    if (poll.type === "build_xi") {
      if (!body.lineup) throw new Error("INVALID_LINEUP");
      await submitBuildXi(pollId, access.decodedToken.uid, body.lineup as BuildXiLineup);
    } else if (poll.type === "best_of_the_month") {
      await submitBestOfMonthVote(
        pollId,
        access.decodedToken.uid,
        String(body.awardKey ?? "") as BestOfMonthAwardKey,
        String(body.optionId ?? ""),
      );
    } else if (poll.type === "score_prediction") {
      await submitScorePrediction(pollId, access.decodedToken.uid, {
        homeScore: Number(body.homeScore),
        awayScore: Number(body.awayScore),
        topScorerPlayerId:
          body.topScorerPlayerId === null || body.topScorerPlayerId === undefined
            ? body.firstScorerPlayerId === null || body.firstScorerPlayerId === undefined
              ? null
              : String(body.firstScorerPlayerId)
            : String(body.topScorerPlayerId),
      });
    } else {
      await submitSingleChoiceVote(
        pollId,
        access.decodedToken.uid,
        String(body.optionId ?? ""),
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return runtimeError(error);
  }
}

function runtimeError(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  const messages: Record<string, string> = {
    VOTING_NOT_FOUND: "Votazione non trovata.",
    VOTING_NOT_PUBLISHED: "Questa votazione non è ancora disponibile.",
    VOTING_NOT_OPEN: "La votazione non è aperta in questo momento.",
    ALREADY_SUBMITTED: "Hai già inviato il tuo voto e non puoi modificarlo.",
    INVALID_LINEUP: "Completa tutti gli undici posti prima dell'invio.",
    INVALID_LINEUP_ROLE: "Uno o più giocatori non appartengono al reparto corretto.",
    INVALID_AWARD: "Premio mensile non valido.",
    INVALID_OPTION: "Selezione non valida.",
    INVALID_SCORE: "Inserisci un risultato valido.",
    INVALID_TOP_SCORER: "Seleziona il miglior marcatore tra i giocatori disponibili.",
    INVALID_SUBMISSION_TYPE: "Il formato del voto non corrisponde a questa votazione.",
  };
  return NextResponse.json(
    { error: messages[code] ?? "Impossibile completare l'operazione." },
    { status: code === "ALREADY_SUBMITTED" ? 409 : code === "VOTING_NOT_FOUND" ? 404 : 400 },
  );
}
