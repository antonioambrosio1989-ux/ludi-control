import { auth } from "@/src/lib/firebase";
import { publicationJobId } from "./PublicationJobService";
import {
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import {
  db,
} from "@/src/lib/firebase";

import {
  assertSeasonWritable,
} from "@/src/services/season/SeasonWriteGuard";

import type {
  Match,
} from "@/src/types/Match";

import type {
  FinalStageMatch,
} from "@/src/types/FinalStageMatch";

import type {
  MatchWizardData,
} from "@/src/types/MatchWizardData";

/*
 * ============================================================
 * COLLECTIONS
 * ============================================================
 */

const MATCHES_COLLECTION =
  "matches";

const MATCH_REPORTS_COLLECTION =
  "matchReports";

const FINAL_STAGE_MATCHES_COLLECTION =
  "finalStageMatches";

const FINAL_STAGE_REPORTS_COLLECTION =
  "finalStageMatchReports";

/*
 * ============================================================
 * SERVICE
 * ============================================================
 */

export const AtomicMatchPublicationService =
  {
    /*
     * ========================================================
     * REGULAR SEASON / TITLE PLAYOFF
     * ========================================================
     */

    async publishMatch({
      match,
      report,
      expectedVersion,
    }: {
      match:
        Match;

      report:
        MatchWizardData;
      expectedVersion?: number;
    }): Promise<number> {
      const matchId =
        normalizeRequiredId(
          match.id,
          "partita",
        );

      const reportMatchId =
        normalizeRequiredId(
          report.matchId,
          "Match Report",
        );

      if (
        matchId !==
        reportMatchId
      ) {
        throw new Error(
          "Il tabellino non appartiene alla partita selezionata.",
        );
      }

      const seasonId =
        normalizeRequiredId(
          match.seasonId,
          "stagione",
        );

      validateTeams({
        homeTeamId:
          String(
            match.homeTeamId,
          ),

        awayTeamId:
          String(
            match.awayTeamId,
          ),
      });

      /*
       * Nessuna scrittura deve partire
       * se la stagione non è modificabile.
       */
      await assertSeasonWritable(
        seasonId,
      );

      const matchReference =
        doc(
          db,
          MATCHES_COLLECTION,
          matchId,
        );

      const reportReference =
        doc(
          db,
          MATCH_REPORTS_COLLECTION,
          matchId,
        );

      return runTransaction(
        db,
        async (
          transaction,
        ) => {
          /*
           * Tutte le letture della transaction
           * vengono eseguite prima delle scritture.
           */

          const [
            matchSnapshot,
            reportSnapshot,
          ] =
            await Promise.all([
              transaction.get(
                matchReference,
              ),

              transaction.get(
                reportReference,
              ),
            ]);

          if (
            !matchSnapshot.exists()
          ) {
            throw new Error(
              "La partita selezionata non esiste.",
            );
          }

          const storedMatch =
            matchSnapshot.data();

          if (
            String(
              storedMatch.seasonId ??
                "",
            ) !==
            seasonId
          ) {
            throw new Error(
              "La partita non appartiene alla stagione prevista.",
            );
          }

          const existingReport =
            reportSnapshot.exists()
              ? reportSnapshot.data()
              : undefined;

          const seasonSnapshot = await transaction.get(doc(db,"seasons",seasonId));
          if (seasonSnapshot.data()?.status === "completed") throw new Error("La stagione è conclusa e non può essere modificata.");
          const phase = "regular";
          const jobReference = doc(db,"matchPublicationJobs",publicationJobId(phase,matchId));
          const lockSnapshot = await transaction.get(doc(db,"matchPublicationLocks",seasonId));
          if ((lockSnapshot.data()?.expiresAtMs ?? 0) > Date.now()) throw new Error("È in corso un'elaborazione della stagione. Attendi e riprova.");
          const actualVersion = Number(existingReport?.version ?? 0);
          if (expectedVersion !== undefined && expectedVersion !== actualVersion) {
            throw new Error("Il tabellino è stato modificato da un altro amministratore. Ricarica prima di pubblicare.");
          }
          const nextVersion = calculateNextVersion(existingReport);
          transaction.delete(doc(db,"matchReportDrafts",publicationJobId(phase,matchId)));
          transaction.set(jobReference,{phase,matchId,seasonId,version:nextVersion,status:"pending",attempts:0,error:null,updatedAt:serverTimestamp()});
          transaction.set(doc(db, MATCH_REPORTS_COLLECTION,matchId,"versions",String(nextVersion)),{
            matchId,seasonId,version:nextVersion,data:report,publishedBy:auth.currentUser?.uid ?? null,publishedAt:serverTimestamp(),
          });

          /*
           * ==================================================
           * MATCH REPORT
           * ==================================================
           */

          transaction.set(
            reportReference,
            {
              matchId,

              seasonId,

              status:
                "published",

              version:
                nextVersion,

              data:
                report,

              updatedAt:
                serverTimestamp(),

              publishedAt:
                serverTimestamp(),
            },
            {
              merge:
                true,
            },
          );

          /*
           * ==================================================
           * MATCH
           * ==================================================
           *
           * Aggiorniamo esclusivamente i campi
           * relativi alla pubblicazione.
           *
           * Non riscriviamo calendario, squadre,
           * venue o matchType.
           * ==================================================
           */

          transaction.update(
            matchReference,
            {
              status:
                resolvePublishedStatus(
                  report,
                ),

              published:
                true,

              updatedAt:
                serverTimestamp(),
            },
          );
          return nextVersion;
        },
      );
    },

    /*
     * ========================================================
     * FINAL STAGE
     * ========================================================
     */

    async publishFinalStageMatch({
      match,
      report,
      expectedVersion,
    }: {
      match:
        FinalStageMatch;

      report:
        MatchWizardData;
      expectedVersion?: number;
    }): Promise<number> {
      const matchId =
        normalizeRequiredId(
          match.id,
          "partita delle fasi finali",
        );

      const reportMatchId =
        normalizeRequiredId(
          report.matchId,
          "Match Report",
        );

      if (
        matchId !==
        reportMatchId
      ) {
        throw new Error(
          "Il tabellino non appartiene alla partita selezionata.",
        );
      }

      const seasonId =
        normalizeRequiredId(
          match.seasonId,
          "stagione",
        );

      validateTeams({
        homeTeamId:
          String(
            match.homeTeamId,
          ),

        awayTeamId:
          String(
            match.awayTeamId,
          ),
      });

      await assertSeasonWritable(
        seasonId,
      );

      const matchReference =
        doc(
          db,
          FINAL_STAGE_MATCHES_COLLECTION,
          matchId,
        );

      const reportReference =
        doc(
          db,
          FINAL_STAGE_REPORTS_COLLECTION,
          matchId,
        );

      return runTransaction(
        db,
        async (
          transaction,
        ) => {
          const [
            matchSnapshot,
            reportSnapshot,
          ] =
            await Promise.all([
              transaction.get(
                matchReference,
              ),

              transaction.get(
                reportReference,
              ),
            ]);

          if (
            !matchSnapshot.exists()
          ) {
            throw new Error(
              "La partita delle fasi finali selezionata non esiste.",
            );
          }

          const storedMatch =
            matchSnapshot.data();

          if (
            String(
              storedMatch.seasonId ??
                "",
            ) !==
            seasonId
          ) {
            throw new Error(
              "La partita delle fasi finali non appartiene alla stagione prevista.",
            );
          }

          const existingReport =
            reportSnapshot.exists()
              ? reportSnapshot.data()
              : undefined;

          const seasonSnapshot = await transaction.get(doc(db,"seasons",seasonId));
          if (seasonSnapshot.data()?.status === "completed") throw new Error("La stagione è conclusa e non può essere modificata.");
          const phase = "final";
          const jobReference = doc(db,"matchPublicationJobs",publicationJobId(phase,matchId));
          const lockSnapshot = await transaction.get(doc(db,"matchPublicationLocks",seasonId));
          if ((lockSnapshot.data()?.expiresAtMs ?? 0) > Date.now()) throw new Error("È in corso un'elaborazione della stagione. Attendi e riprova.");
          const actualVersion = Number(existingReport?.version ?? 0);
          if (expectedVersion !== undefined && expectedVersion !== actualVersion) {
            throw new Error("Il tabellino è stato modificato da un altro amministratore. Ricarica prima di pubblicare.");
          }
          const nextVersion = calculateNextVersion(existingReport);
          transaction.delete(doc(db,"matchReportDrafts",publicationJobId(phase,matchId)));
          transaction.set(jobReference,{phase,matchId,seasonId,version:nextVersion,status:"pending",attempts:0,error:null,updatedAt:serverTimestamp()});
          transaction.set(doc(db, FINAL_STAGE_REPORTS_COLLECTION,matchId,"versions",String(nextVersion)),{
            matchId,seasonId,version:nextVersion,data:report,publishedBy:auth.currentUser?.uid ?? null,publishedAt:serverTimestamp(),
          });

          /*
           * ==================================================
           * FINAL STAGE MATCH REPORT
           * ==================================================
           */

          transaction.set(
            reportReference,
            {
              matchId,

              seasonId,

              status:
                "published",

              version:
                nextVersion,

              data:
                report,

              updatedAt:
                serverTimestamp(),

              publishedAt:
                serverTimestamp(),
            },
            {
              merge:
                true,
            },
          );

          /*
           * ==================================================
           * FINAL STAGE MATCH
           * ==================================================
           */

          if (
            report.status ===
            "postponed"
          ) {
            /*
             * Un rinvio non deve alterare
             * eventuali risultati già presenti.
             */

            transaction.update(
              matchReference,
              {
                status:
                  "postponed",

                published:
                  true,

                updatedAt:
                  serverTimestamp(),
              },
            );

            return nextVersion;
          }

          transaction.update(
            matchReference,
            {
              status:
                report.status ===
                "walkover"
                  ? "walkover"
                  : "played",

              published:
                true,

              homeScore:
                report.homeScore,

              awayScore:
                report.awayScore,

              extraTimePlayed:
  report.extraTimePlayed ===
  true,

              /*
               * Manteniamo per ora la stessa
               * semantica del Publish Service
               * esistente: i rigori delle fasi
               * finali provengono dal match.
               */
              homePenalties:
                report.homePenalties ??
                null,

              awayPenalties:
                report.awayPenalties ??
                null,

              updatedAt:
                serverTimestamp(),
            },
          );
          return nextVersion;
        },
      );
    },
  };

/*
 * ============================================================
 * VERSION
 * ============================================================
 */

function calculateNextVersion(
  existing:
    Record<
      string,
      unknown
    > |
    undefined,
): number {
  if (
    !existing
  ) {
    return 1;
  }

  const rawVersion =
    Number(
      existing.version,
    );

  const currentVersion =
    Number.isInteger(
      rawVersion,
    ) &&
    rawVersion >=
      1
      ? rawVersion
      : 1;

  return existing.status ===
    "published"
    ? currentVersion +
        1
    : currentVersion;
}

/*
 * ============================================================
 * MATCH STATUS
 * ============================================================
 */

function resolvePublishedStatus(
  report:
    MatchWizardData,
):
  | "played"
  | "postponed"
  | "walkover" {
  if (
    report.status ===
    "postponed"
  ) {
    return "postponed";
  }

  if (
    report.status ===
    "walkover"
  ) {
    return "walkover";
  }

  return "played";
}

/*
 * ============================================================
 * VALIDATION
 * ============================================================
 */

function normalizeRequiredId(
  value:
    string |
    number,
  label:
    string,
): string {
  const normalized =
    String(
      value ??
        "",
    ).trim();

  if (
    !normalized
  ) {
    throw new Error(
      `ID ${label} non valido.`,
    );
  }

  return normalized;
}

function validateTeams({
  homeTeamId,
  awayTeamId,
}: {
  homeTeamId:
    string;

  awayTeamId:
    string;
}): void {
  const normalizedHomeTeamId =
    homeTeamId.trim();

  const normalizedAwayTeamId =
    awayTeamId.trim();

  if (
    !normalizedHomeTeamId ||
    !normalizedAwayTeamId
  ) {
    throw new Error(
      "Seleziona entrambe le squadre.",
    );
  }

  if (
    normalizedHomeTeamId ===
    normalizedAwayTeamId
  ) {
    throw new Error(
      "Una squadra non può giocare contro sé stessa.",
    );
  }
}