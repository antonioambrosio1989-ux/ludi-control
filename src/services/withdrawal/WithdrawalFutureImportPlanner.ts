/**
 * Fase 8A. Analisi PURA delle nuove gare importate dopo un ritiro.
 * Non scrive Firestore, non modifica match né report, non attribuisce punti.
 */
import {
  calculateWithdrawalPolicy,
  type WithdrawalConfig,
  type WithdrawalPolicy,
} from "./WithdrawalRegistryRules";

export type ImportedFixture = {
  id: string;
  seasonId: string;
  matchweek: number;
  homeTeamId: string | number;
  awayTeamId: string | number;
  status: string;
  matchType?: string;
  date?: string;
  time?: string;
};

export type FutureImportDecisionKind =
  | "void_candidate"
  | "walkover_candidate"
  | "retain_result"
  | "manual_review";

export type FutureImportDecision = {
  matchId: string;
  matchweek: number;
  opponentTeamId: string;
  action: FutureImportDecisionKind;
  reason: string;
  /** Mai attribuire tavolini durante l'import. */
  assignedPoints: 0;
};

export type ImportIssue = {
  code:
    | "invalid_fixture"
    | "conflicting_match_id"
    | "duplicate_fixture"
    | "missing_expected_matchweek";
  matchId?: string;
  message: string;
};

export type WithdrawalFutureImportPlan = {
  seasonId: string;
  withdrawnTeamId: string;
  policy: WithdrawalPolicy;
  decisions: FutureImportDecision[];
  issues: ImportIssue[];
  ignoredUnrelatedMatchIds: string[];
  alreadyPresentMatchIds: string[];
  /** Non è un'autorizzazione al ritiro o alla pubblicazione dei tavolini. */
  safeToApply: false;
};

export type PlanFutureImportsInput = {
  seasonId: string;
  withdrawnTeamId: string;
  config: WithdrawalConfig;
  effectiveMatchweek: number;
  /** Calendario già presente prima dell'import. */
  existingFixtures: readonly ImportedFixture[];
  /** Partite della nuova importazione (anche le ripetizioni). */
  incomingFixtures: readonly ImportedFixture[];
};

function signature(fixture: ImportedFixture): string {
  // I campi che identificano sportivamente una gara. Il giorno/ora possono
  // cambiare per rinvio: se lo stesso ID cambia, chiediamo una riconciliazione.
  return JSON.stringify([
    fixture.seasonId, fixture.matchweek,
    String(fixture.homeTeamId), String(fixture.awayTeamId),
    fixture.matchType ?? "regularSeason", fixture.status,
    fixture.date ?? "", fixture.time ?? "",
  ]);
}

function validFixture(fixture: ImportedFixture, seasonId: string, totalMatchweeks: number): boolean {
  return Boolean(
    fixture.id.trim() && fixture.seasonId === seasonId &&
    Number.isSafeInteger(fixture.matchweek) &&
    fixture.matchweek >= 1 && fixture.matchweek <= totalMatchweeks &&
    String(fixture.homeTeamId).trim() && String(fixture.awayTeamId).trim() &&
    String(fixture.homeTeamId) !== String(fixture.awayTeamId) &&
    fixture.status.trim(),
  );
}

function decision(
  match: ImportedFixture,
  withdrawnTeamId: string,
  policy: WithdrawalPolicy,
  effectiveMatchweek: number,
): FutureImportDecision {
  const opponentTeamId = String(match.homeTeamId) === withdrawnTeamId
    ? String(match.awayTeamId) : String(match.homeTeamId);
  const base = { matchId: match.id, matchweek: match.matchweek, opponentTeamId, assignedPoints: 0 as const };
  if (policy === "void_all") {
    return { ...base, action: "void_candidate", reason: "Regime di annullamento: escludere la gara dai conteggi dopo l'attivazione." };
  }
  if (match.matchweek < effectiveMatchweek) {
    if (["played", "finished", "walkover"].includes(match.status)) {
      return { ...base, action: "retain_result", reason: "Risultato antecedente al ritiro nel ritorno: conservare." };
    }
    return { ...base, action: "manual_review", reason: "Gara arretrata non conclusa: non assegnare automaticamente il tavolino." };
  }
  if (match.status === "scheduled") {
    return { ...base, action: "walkover_candidate", reason: "Tavolino potenziale: valutabile soltanto nella giornata ufficialmente dovuta." };
  }
  return { ...base, action: "manual_review", reason: "Gara rinviata, in corso, cancellata o già conclusa dopo il ritiro: verifica richiesta." };
}

/**
 * Deterministico e idempotente per ID gara: solo nuove gare univoche.
 * Non esegue query e non decide se una giornata sia già maturata.
 */
export function planWithdrawalFutureImports(input: PlanFutureImportsInput): WithdrawalFutureImportPlan {
  const seasonId = input.seasonId.trim();
  const withdrawnTeamId = input.withdrawnTeamId.trim();
  if (!seasonId || !withdrawnTeamId) throw new Error("Stagione o squadra ritirata mancante.");
  const { policy } = calculateWithdrawalPolicy(input.config, input.effectiveMatchweek);
  const existing = new Map<string, string>();
  const incoming = new Map<string, ImportedFixture>();
  const conflictedIds = new Set<string>();
  const issues: ImportIssue[] = [];
  const alreadyPresentMatchIds = new Set<string>();
  const ignoredUnrelatedMatchIds = new Set<string>();
  const issue = (code: ImportIssue["code"], message: string, matchId?: string) => {
    issues.push({ code, message, ...(matchId ? { matchId } : {}) });
  };

  for (const match of input.existingFixtures) {
    if (!validFixture(match, seasonId, input.config.totalMatchweeks)) {
      issue("invalid_fixture", `Gara preesistente non valida: ${match.id}.`, match.id);
      conflictedIds.add(match.id);
      continue;
    }
    if (existing.has(match.id) && existing.get(match.id) !== signature(match)) {
      issue("conflicting_match_id", `Calendario preesistente incoerente per ID ${match.id}.`, match.id);
      conflictedIds.add(match.id);
    }
    existing.set(match.id, signature(match));
  }

  for (const match of input.incomingFixtures) {
    if (!validFixture(match, seasonId, input.config.totalMatchweeks)) {
      issue("invalid_fixture", `Gara importata non valida: ${match.id}.`, match.id);
      conflictedIds.add(match.id);
      continue;
    }
    const previous = incoming.get(match.id);
    if (previous) {
      if (signature(previous) !== signature(match)) {
        issue("conflicting_match_id", `ID ${match.id} ripetuto con dati diversi nell'import.`, match.id);
        conflictedIds.add(match.id);
      } else {
        issue("duplicate_fixture", `Gara ${match.id} ripetuta identica nell'import; conteggiata una volta.`, match.id);
      }
      continue;
    }
    incoming.set(match.id, match);
    if (existing.has(match.id)) {
      alreadyPresentMatchIds.add(match.id);
      if (existing.get(match.id) !== signature(match)) {
        issue("conflicting_match_id", `ID ${match.id} presente con dati differenti: riconciliare prima dell'import.`, match.id);
        conflictedIds.add(match.id);
      }
    }
  }

  const decisions: FutureImportDecision[] = [];
  for (const match of incoming.values()) {
    if (conflictedIds.has(match.id) || alreadyPresentMatchIds.has(match.id)) continue;
    if ((match.matchType ?? "regularSeason") !== "regularSeason" ||
        (String(match.homeTeamId) !== withdrawnTeamId && String(match.awayTeamId) !== withdrawnTeamId)) {
      ignoredUnrelatedMatchIds.add(match.id);
      continue;
    }
    decisions.push(decision(match, withdrawnTeamId, policy, input.effectiveMatchweek));
  }
  decisions.sort((a, b) => a.matchweek - b.matchweek || a.matchId.localeCompare(b.matchId));
  issues.sort((a, b) => a.code.localeCompare(b.code) || (a.matchId ?? "").localeCompare(b.matchId ?? ""));
  return {
    seasonId, withdrawnTeamId, policy, decisions, issues,
    ignoredUnrelatedMatchIds: [...ignoredUnrelatedMatchIds].sort(),
    alreadyPresentMatchIds: [...alreadyPresentMatchIds].sort(),
    safeToApply: false,
  };
}
