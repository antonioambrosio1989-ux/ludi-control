import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  requireAdminApi,
} from "@/src/lib/requireAdminApi";

import {
  getVotingPoll,
  resolveBuildXiTieBreak,
} from "@/src/server/games/voting/BuildXiServer";

import type {
  BuildXiRole,
} from "@/src/types/GamesVoting";

export const runtime =
  "nodejs";

export async function POST(
  request:
    NextRequest,
  context: {
    params:
      Promise<{
        gameId:
          string;
      }>;
  },
) {
  try {
    const admin =
      await requireAdminApi(
        request,
      );

    const {
      gameId,
    } =
      await context.params;

    const body =
      await request.json() as
        Record<
          string,
          unknown
        >;

    const pollId =
      String(
        body.pollId ??
          "",
      ).trim();

    const role =
      String(
        body.role ??
          "",
      ) as
        BuildXiRole;

    const selectedPlayerIds =
      Array.isArray(
        body.selectedPlayerIds,
      )
        ? body.selectedPlayerIds.map(
            (
              value,
            ) =>
              String(
                value,
              ),
          )
        : [];

    const poll =
      await getVotingPoll(
        pollId,
      );

    if (
      poll.gameId !==
      gameId
    ) {
      throw new Error(
        "VOTING_NOT_FOUND",
      );
    }

    await resolveBuildXiTieBreak({
      pollId,
      role,
      selectedPlayerIds,
      resolvedBy:
        admin.uid,
    });

    return NextResponse.json({
      success:
        true,
    });
  } catch (
    error
  ) {
    const code =
      error instanceof
        Error
        ? error.message
        : "UNKNOWN_ERROR";

    const messages:
      Record<
        string,
        string
      > = {
        VOTING_NOT_FOUND:
          "Votazione non trovata.",
        BUILD_XI_ONLY:
          "Questa operazione è disponibile soltanto per una BUILD XI.",
        BUILD_XI_TIE_BREAK_REQUIRES_CLOSED:
          "Chiudi prima la votazione BUILD XI.",
        BUILD_XI_TIE_NOT_FOUND:
          "Non esiste una parità da risolvere per questo ruolo.",
        INVALID_BUILD_XI_TIE_ROLE:
          "Ruolo BUILD XI non valido.",
        INVALID_BUILD_XI_TIE_SELECTION:
          "La scelta Admin deve contenere esattamente i giocatori necessari tra quelli a pari voti.",
        UNAUTHORIZED:
          "Operazione non autorizzata.",
        FORBIDDEN:
          "Operazione non autorizzata.",
      };

    return NextResponse.json(
      {
        error:
          messages[
            code
          ] ??
          "Impossibile risolvere la parità BUILD XI.",
      },
      {
        status:
          code ===
            "UNAUTHORIZED" ||
          code ===
            "FORBIDDEN"
            ? 403
            : code ===
                "VOTING_NOT_FOUND"
              ? 404
              : 400,
      },
    );
  }
}
