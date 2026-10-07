const TEMPORARY_GOALKEEPER_PREFIX =
  "__ludi_temp_gk__";

export type TemporaryMatchGoalkeeper = {
  id: string;
  teamId: string;
  firstName: string;
  lastName: string;
  name: string;
  role: "Portiere";
  temporary: true;
};

function safeDecode(
  value: string,
): string {
  try {
    return decodeURIComponent(
      value,
    );
  } catch {
    return value;
  }
}

export function createTemporaryGoalkeeperId({
  teamId,
  firstName,
  lastName,
}: {
  teamId: string | number;
  firstName: string;
  lastName: string;
}): string {
  const normalizedFirstName =
    firstName.trim();

  const normalizedLastName =
    lastName.trim();

  const nonce =
    typeof crypto !==
      "undefined" &&
    typeof crypto.randomUUID ===
      "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`;

  return [
    TEMPORARY_GOALKEEPER_PREFIX,
    encodeURIComponent(
      String(teamId),
    ),
    encodeURIComponent(
      normalizedFirstName,
    ),
    encodeURIComponent(
      normalizedLastName,
    ),
    nonce,
  ].join("|");
}

export function parseTemporaryGoalkeeperId(
  playerId: string | number,
): TemporaryMatchGoalkeeper | null {
  const normalizedId =
    String(playerId);

  const parts =
    normalizedId.split("|");

  if (
    parts.length <
      5 ||
    parts[0] !==
      TEMPORARY_GOALKEEPER_PREFIX
  ) {
    return null;
  }

  const teamId =
    safeDecode(
      parts[1] ?? "",
    );

  const firstName =
    safeDecode(
      parts[2] ?? "",
    ).trim();

  const lastName =
    safeDecode(
      parts[3] ?? "",
    ).trim();

  if (
    !teamId ||
    (!firstName &&
      !lastName)
  ) {
    return null;
  }

  return {
    id:
      normalizedId,
    teamId,
    firstName,
    lastName,
    name:
      `${firstName} ${lastName}`.trim(),
    role:
      "Portiere",
    temporary:
      true,
  };
}

export function isTemporaryGoalkeeperId(
  playerId: string | number,
): boolean {
  return (
    parseTemporaryGoalkeeperId(
      playerId,
    ) !==
    null
  );
}
