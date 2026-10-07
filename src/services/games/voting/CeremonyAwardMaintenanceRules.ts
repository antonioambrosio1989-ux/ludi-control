export type CeremonyAwardMaintenanceOperation =
  "reset" |
  "delete";

export type CeremonyAwardMaintenanceResolution =
  "start" |
  "already_started" |
  "conflict";

export function resolveCeremonyAwardMaintenanceOperation({
  currentOperation,
  requestedOperation,
}: {
  currentOperation:
    string;
  requestedOperation:
    CeremonyAwardMaintenanceOperation;
}): CeremonyAwardMaintenanceResolution {
  const normalizedCurrent =
    String(
      currentOperation ??
      "",
    ).trim();

  if (
    !normalizedCurrent
  ) {
    return "start";
  }

  if (
    normalizedCurrent ===
    requestedOperation
  ) {
    return "already_started";
  }

  return "conflict";
}
