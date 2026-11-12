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


/**
 * Preselezione presenze dal documento matchLineups.
 * Si importano soltanto le formazioni pubblicate; gli ospiti generici
 * non sono convertiti impropriamente in portieri. Il portiere guest
 * designato viene invece rappresentato con l'ID temporaneo già
 * compreso dall'editor del tabellino.
 * Non modifica mai la rosa stagionale né Firestore.
 */
export function buildWhatsAppLineupPrefill(value: unknown): {
  homePresentPlayerIds: string[];
  awayPresentPlayerIds: string[];
} {
  const record = (input: unknown): Record<string, unknown> =>
    input && typeof input === "object" && !Array.isArray(input)
      ? input as Record<string, unknown>
      : {};
  const text = (input: unknown): string =>
    typeof input === "string" ? input.trim() : "";

  const parseSide = (sideValue: unknown): string[] => {
    const side = record(sideValue);
    if (side.status !== "published") return [];

    const ids = Array.isArray(side.playerIds)
      ? side.playerIds.map(text).filter(Boolean)
      : [];
    const goalkeeper = record(side.goalkeeper);
    const selectedGoalkeeperId =
      goalkeeper.kind === "guest"
        ? text(goalkeeper.guestPlayerId)
        : text(side.goalkeeperId);

    if (selectedGoalkeeperId && Array.isArray(side.guestPlayers)) {
      const guest = side.guestPlayers
        .map(record)
        .find((candidate) => text(candidate.id) === selectedGoalkeeperId);
      if (guest) {
        let firstName = text(guest.firstName);
        let lastName = text(guest.lastName);
        // Legacy: nome WhatsApp non sempre separato in firstName/lastName.
        // Formato del portiere provvisorio: COGNOME NOME.
        if (!firstName || !lastName) {
          const parts = text(guest.name).split(/\s+/).filter(Boolean);
          if (parts.length >= 2) {
            lastName ||= parts[0];
            firstName ||= parts.slice(1).join(" ");
          }
        }
        const teamId = text(side.teamId);
        if (teamId && firstName && lastName) {
          ids.push(createTemporaryGoalkeeperId({
            teamId,
            firstName,
            lastName,
          }));
        }
      }
    }

    return [...new Set(ids)];
  };

  const lineup = record(value);
  return {
    homePresentPlayerIds: parseSide(lineup.home),
    awayPresentPlayerIds: parseSide(lineup.away),
  };
}
