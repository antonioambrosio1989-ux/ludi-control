import {
  NextResponse,
} from "next/server";

import {
  createHash,
} from "node:crypto";

import {
  adminDb,
} from "@/src/lib/firebaseAdmin";

import {
  requireGamesApiAccess,
} from "@/src/lib/requireGamesApiAccess";

/*
 * ============================================================
 * REQUEST
 * ============================================================
 */

type RenameFantasyTeamRequest = {
  fantasyTeamId?:
    string;

  name?:
    string;
};

/*
 * ============================================================
 * RENAME FANTASY TEAM
 * ============================================================
 *
 * La rinomina viene eseguita esclusivamente lato server.
 *
 * La stessa transazione aggiorna:
 * - fantasyTeams;
 * - lock univoco del nome;
 * - lock univoco dell'utente.
 *
 * In questo modo nome e lock non possono divergere.
 * ============================================================
 */

export async function PATCH(
  request:
    Request,
) {
  try {
        /*
     * ========================================================
     * GAMES ACCESS
     * ========================================================
     */

    const access =
      await requireGamesApiAccess(
        request,
        {
          rateLimitProfile:
            "gamesFantasyMutation",
        },
      );

    if (
      !access.ok
    ) {
      return access.response;
    }

    const userId =
      access.decodedToken.uid;

    /*
     * ========================================================
     * BODY
     * ========================================================
     */

    let body:
      RenameFantasyTeamRequest;

    try {
      body =
        (
          await request.json()
        ) as
          RenameFantasyTeamRequest;
    } catch {
      return NextResponse.json(
        {
          error:
            "Richiesta non valida.",
        },
        {
          status:
            400,
        },
      );
    }

    const fantasyTeamId =
      body.fantasyTeamId
        ?.trim() ??
      "";

    const displayName =
      normalizeTeamName(
        body.name ??
          "",
      );

    const normalizedName =
      buildNormalizedTeamName(
        displayName,
      );

    if (
      !fantasyTeamId
    ) {
      return NextResponse.json(
        {
          error:
            "Squadra Fantacalcio non valida.",
        },
        {
          status:
            400,
        },
      );
    }

    if (
      displayName.length <
        3 ||
      displayName.length >
        24
    ) {
      return NextResponse.json(
        {
          error:
            "Il nome della squadra Fantasy deve contenere da 3 a 24 caratteri.",
        },
        {
          status:
            400,
        },
      );
    }

    const teamRef =
      adminDb
        .collection(
          "fantasyTeams",
        )
        .doc(
          fantasyTeamId,
        );

    /*
     * ========================================================
     * LEGACY DUPLICATE PREFLIGHT
     * ========================================================
     *
     * Intercetta anche eventuali squadre create prima
     * dell'introduzione dei lock di unicità.
     * ========================================================
     */

    const teamSnapshot =
      await teamRef.get();

    if (
      !teamSnapshot.exists
    ) {
      return NextResponse.json(
        {
          error:
            "Squadra Fantasy non trovata.",
        },
        {
          status:
            404,
        },
      );
    }

    const team =
      teamSnapshot.data();

    if (
      !team
    ) {
      return NextResponse.json(
        {
          error:
            "Dati della squadra Fantasy non disponibili.",
        },
        {
          status:
            404,
        },
      );
    }

    if (
      team.userId !==
        userId
    ) {
      return NextResponse.json(
        {
          error:
            "Non sei autorizzato a rinominare questa squadra.",
        },
        {
          status:
            403,
        },
      );
    }

    const fantasySeasonId =
      typeof team.fantasySeasonId ===
        "string"
        ? team.fantasySeasonId
        : "";

    if (
      !fantasySeasonId
    ) {
      return NextResponse.json(
        {
          error:
            "Stagione Fantacalcio non valida.",
        },
        {
          status:
            409,
        },
      );
    }

    if (
      team.status ===
        "completed"
    ) {
      return NextResponse.json(
        {
          error:
            "La stagione Fantasy è conclusa.",
        },
        {
          status:
            409,
        },
      );
    }

    const duplicateSnapshot =
      await adminDb
        .collection(
          "fantasyTeams",
        )
        .where(
          "fantasySeasonId",
          "==",
          fantasySeasonId,
        )
        .where(
          "normalizedName",
          "==",
          normalizedName,
        )
        .limit(
          2,
        )
        .get();

    const legacyDuplicate =
      duplicateSnapshot.docs.some(
        (
          snapshot,
        ) =>
          snapshot.id !==
            fantasyTeamId,
      );

    if (
      legacyDuplicate
    ) {
      return NextResponse.json(
        {
          error:
            "Questo nome squadra è già utilizzato nel Fantacalcio.",
        },
        {
          status:
            409,
        },
      );
    }

    /*
     * ========================================================
     * ATOMIC LOCK MOVE
     * ========================================================
     */

    const locksCollection =
      adminDb.collection(
        "fantasyTeamUniquenessLocks",
      );

    const userLockRef =
      locksCollection.doc(
        createUniquenessLockId(
          `user|${fantasySeasonId}|${userId}`,
        ),
      );

    const newNameLockRef =
      locksCollection.doc(
        createUniquenessLockId(
          `name|${fantasySeasonId}|${normalizedName}`,
        ),
      );

    const transactionResult =
      await adminDb.runTransaction(
        async (
          transaction,
        ) => {
          const latestTeamSnapshot =
            await transaction.get(
              teamRef,
            );

          if (
            !latestTeamSnapshot.exists
          ) {
            return {
              status:
                "not_found" as const,
            };
          }

          const latestTeam =
            latestTeamSnapshot.data();

          if (
            !latestTeam
          ) {
            return {
              status:
                "not_found" as const,
            };
          }

          if (
            latestTeam.userId !==
              userId
          ) {
            return {
              status:
                "forbidden" as const,
            };
          }

          if (
            latestTeam.fantasySeasonId !==
              fantasySeasonId
          ) {
            return {
              status:
                "invalid_season" as const,
            };
          }

          if (
            latestTeam.status ===
              "completed"
          ) {
            return {
              status:
                "completed" as const,
            };
          }

          const latestOldNormalizedName =
            buildNormalizedTeamName(
              typeof latestTeam.normalizedName ===
                "string" &&
              latestTeam.normalizedName.trim()
                ? latestTeam.normalizedName
                : String(
                    latestTeam.name ??
                      "",
                  ),
            );

          const latestOldNameLockRef =
            latestOldNormalizedName
              ? locksCollection.doc(
                  createUniquenessLockId(
                    `name|${fantasySeasonId}|${latestOldNormalizedName}`,
                  ),
                )
              : null;

          const newNameLockSnapshot =
            await transaction.get(
              newNameLockRef,
            );

          const userLockSnapshot =
            await transaction.get(
              userLockRef,
            );

          const latestOldNameLockSnapshot =
            latestOldNameLockRef &&
            latestOldNameLockRef.id !==
              newNameLockRef.id
              ? await transaction.get(
                  latestOldNameLockRef,
                )
              : null;

          if (
            newNameLockSnapshot.exists
          ) {
            const existingNameLock =
              newNameLockSnapshot.data();

            if (
              existingNameLock
                ?.fantasyTeamId !==
              fantasyTeamId
            ) {
              return {
                status:
                  "name_taken" as const,
              };
            }
          }

          if (
            userLockSnapshot.exists
          ) {
            const existingUserLock =
              userLockSnapshot.data();

            if (
              existingUserLock
                ?.fantasyTeamId !==
              fantasyTeamId
            ) {
              return {
                status:
                  "user_lock_conflict" as const,
              };
            }
          }

          if (
            latestOldNameLockSnapshot
              ?.exists
          ) {
            const oldNameLock =
              latestOldNameLockSnapshot.data();

            if (
              oldNameLock
                ?.fantasyTeamId ===
              fantasyTeamId &&
              latestOldNameLockRef
            ) {
              transaction.delete(
                latestOldNameLockRef,
              );
            }
          }

          transaction.set(
            newNameLockRef,
            {
              type:
                "name",

              fantasySeasonId,

              normalizedName,

              fantasyTeamId,

              userId,

              updatedAt:
                new Date(),
            },
            {
              merge:
                true,
            },
          );

          transaction.set(
            userLockRef,
            {
              type:
                "user",

              fantasySeasonId,

              userId,

              fantasyTeamId,

              normalizedName,

              updatedAt:
                new Date(),
            },
            {
              merge:
                true,
            },
          );

          transaction.update(
            teamRef,
            {
              name:
                displayName,

              normalizedName,

              updatedAt:
                new Date(),
            },
          );

          return {
            status:
              "renamed" as const,
          };
        },
      );

    if (
      transactionResult.status ===
        "name_taken"
    ) {
      return NextResponse.json(
        {
          error:
            "Questo nome squadra è già utilizzato nel Fantacalcio.",
        },
        {
          status:
            409,
        },
      );
    }

    if (
      transactionResult.status ===
        "forbidden"
    ) {
      return NextResponse.json(
        {
          error:
            "Non sei autorizzato a rinominare questa squadra.",
        },
        {
          status:
            403,
        },
      );
    }

    if (
      transactionResult.status ===
        "not_found"
    ) {
      return NextResponse.json(
        {
          error:
            "Squadra Fantasy non trovata.",
        },
        {
          status:
            404,
        },
      );
    }

    if (
      transactionResult.status ===
        "completed"
    ) {
      return NextResponse.json(
        {
          error:
            "La stagione Fantasy è conclusa.",
        },
        {
          status:
            409,
        },
      );
    }

    if (
      transactionResult.status ===
        "invalid_season" ||
      transactionResult.status ===
        "user_lock_conflict"
    ) {
      return NextResponse.json(
        {
          error:
            "I dati di unicità della squadra Fantasy non sono coerenti.",
        },
        {
          status:
            409,
        },
      );
    }

    return NextResponse.json(
      {
        fantasyTeamId,

        name:
          displayName,

        normalizedName,

        renamed:
          true,
      },
      {
        status:
          200,
      },
    );
  } catch (
    error
  ) {
    console.error(
      "Errore rinomina squadra Fantacalcio:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Impossibile rinominare la squadra Fantacalcio.",
      },
      {
        status:
          500,
      },
    );
  }
}

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function normalizeTeamName(
  value:
    string,
): string {
  return value
    .trim()
    .replace(
      /\s+/g,
      " ",
    );
}

function buildNormalizedTeamName(
  value:
    string,
): string {
  return normalizeTeamName(
    value,
  ).toLocaleLowerCase(
    "it-IT",
  );
}

function createUniquenessLockId(
  value:
    string,
): string {
  return createHash(
    "sha256",
  )
    .update(
      value,
      "utf8",
    )
    .digest(
      "hex",
    );
}
