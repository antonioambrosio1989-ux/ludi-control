/**
 * Fase 9E — Ponte puro verso i calcolatori reali di Ludi Control.
 * Non legge Firestore, non abilita ritiri e non scrive dati.
 * Chiamare solo con un registro completo e verificato da codice server affidabile.
 * Non utilizzare registrationSnapshotComplete=true per snapshot parziali o client-supplied.
 */
import type { Match } from "../../types/Match";
import type { CloudMatchReport } from "../match/FirebaseMatchReportRepository";
import type { Team } from "../../types/Team";
import type { FinalStageMatch } from "../../types/FinalStageMatch";
import type { CloudFinalStageMatchReport } from "../final-stage/FirebaseFinalStageMatchReportRepository";
import { calculateStandings, type CalculateStandingsOptions } from "../standings/StandingsCalculator";
import { calculateFirebasePlayerStats } from "../stats/FirebasePlayerStatsCalculator";
import {
  selectOfficialWithdrawalInputs,
  type VerifiedWithdrawalRegistration,
} from "./WithdrawalOfficialReadFilter";

export type OfficialCalculationBridgeInput = {
  seasonId: string;
  matches: readonly Match[];
  reports: readonly CloudMatchReport[];
  registrations: readonly VerifiedWithdrawalRegistration[];
  /** SOLO se il backend ha letto e validato l'intera collezione stagionale. */
  registrationSnapshotComplete: boolean;
  standingsOptions?: CalculateStandingsOptions;
  players?: readonly {
    playerId: string;
    teams: Team[];
    role?: string;
    finalStageMatches?: FinalStageMatch[];
    finalStageReports?: CloudFinalStageMatchReport[];
  }[];
};

export function calculateOfficialWithdrawalAwareData(input: OfficialCalculationBridgeInput) {
  const selected = selectOfficialWithdrawalInputs({
    seasonId: input.seasonId,
    matches: input.matches,
    reports: input.reports,
    registrations: input.registrations,
    registrationSnapshotComplete: input.registrationSnapshotComplete,
  });
  // Un report orfano indica un input incompleto: non si pubblicano calcoli parziali.
  if (selected.warnings.length > 0) {
    throw new Error(`Calcolo ufficiale bloccato: ${selected.warnings.join("; ")}`);
  }

  const standings = calculateStandings(selected.matches, selected.reports, input.standingsOptions);
  const playerResults = (input.players ?? []).map(player => ({
    playerId: player.playerId,
    ...calculateFirebasePlayerStats({
      playerId: player.playerId,
      matches: selected.matches,
      reports: selected.reports,
      teams: player.teams,
      role: player.role,
      finalStageMatches: player.finalStageMatches,
      finalStageReports: player.finalStageReports,
    }),
  }));
  return {
    standings,
    playerResults,
    excludedMatchIds: selected.excludedMatchIds,
    excludedReportMatchIds: selected.excludedReportMatchIds,
    retainedMatchCount: selected.retainedMatchCount,
  };
}
