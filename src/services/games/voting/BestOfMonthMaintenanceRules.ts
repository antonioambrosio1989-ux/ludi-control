export type BestOfMonthMaintenanceOperation =
  | "reset"
  | "delete";

export function readBestOfMonthMaintenanceOperation(
  value:
    unknown,
): BestOfMonthMaintenanceOperation |
  null {
  return value ===
      "reset" ||
    value ===
      "delete"
    ? value
    : null;
}

export function assertBestOfMonthNotInMaintenance(
  value:
    unknown,
): void {
  if (
    readBestOfMonthMaintenanceOperation(
      value,
    )
  ) {
    throw new Error(
      "BEST_OF_MONTH_MAINTENANCE_IN_PROGRESS",
    );
  }
}

export function assertBestOfMonthMaintenanceCanStart({
  current,
  requested,
}: {
  current:
    unknown;
  requested:
    BestOfMonthMaintenanceOperation;
}): void {
  const normalized =
    readBestOfMonthMaintenanceOperation(
      current,
    );

  if (
    normalized &&
    normalized !==
      requested
  ) {
    throw new Error(
      "BEST_OF_MONTH_MAINTENANCE_CONFLICT",
    );
  }
}
