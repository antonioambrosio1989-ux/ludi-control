export type SurvivorCollectiveRoundOutcome =
  | "qualified"
  | "postponed"
  | "eliminated_result"
  | "eliminated_other"
  | "pending";

export function resolveCollectiveSurvivorRound(
  outcomes:
    SurvivorCollectiveRoundOutcome[],
) {
  if (
    outcomes.some(
      (outcome) =>
        outcome ===
        "pending",
    )
  ) {
    return {
      pending:
        true,
      reviveAll:
        false,
      survivingIndexes:
        [] as number[],
    };
  }

  const reviveAll =
    outcomes.length >
      1 &&
    outcomes.every(
      (outcome) =>
        outcome ===
        "eliminated_result",
    );

  if (reviveAll) {
    return {
      pending:
        false,
      reviveAll:
        true,
      survivingIndexes:
        outcomes.map(
          (
            _,
            index,
          ) =>
            index,
        ),
    };
  }

  const survivingIndexes =
    outcomes.flatMap(
      (
        outcome,
        index,
      ) =>
        outcome ===
          "qualified" ||
        outcome ===
          "postponed"
          ? [
              index,
            ]
          : [],
    );

  return {
    pending:
      false,
    reviveAll:
      false,
    survivingIndexes,
  };
}

export function shouldConsumeSurvivorTeam(
  outcome:
    | "pending"
    | "qualified"
    | "eliminated"
    | "postponed",
): boolean {
  return (
    outcome ===
      "qualified" ||
    outcome ===
      "eliminated"
  );
}
