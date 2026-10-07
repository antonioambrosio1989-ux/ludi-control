import type { OperationalTask } from "@/src/types/OperationalTask";
export function validateTaskInput(
  value: unknown,
  now = Date.now(),
): Pick<
  OperationalTask,
  | "title"
  | "notes"
  | "competitionId"
  | "category"
  | "priority"
  | "dueAtMs"
  | "reminderMinutes"
  | "pushEnabled"
  | "repeat"
> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("INVALID_INPUT");
  const input = value as Record<string, unknown>;
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const notes = typeof input.notes === "string" ? input.notes.trim() : "";
  const dueAtMs = input.dueAtMs;
  const offsets = input.reminderMinutes;
  if (
    title.length < 3 ||
    title.length > 140 ||
    notes.length > 2000 ||
    typeof dueAtMs !== "number" ||
    !Number.isFinite(dueAtMs) ||
    dueAtMs < now - 30 * 86400000 ||
    dueAtMs > now + 3 * 366 * 86400000
  )
    throw new Error("INVALID_INPUT");
  if (
    !Array.isArray(offsets) ||
    offsets.length > 4 ||
    !offsets.every((offset) => [0, 60, 1440, 10080].includes(offset))
  )
    throw new Error("INVALID_INPUT");
  if (
    !["sport", "editorial", "brand", "organization"].includes(
      String(input.category),
    ) ||
    !["low", "medium", "high"].includes(String(input.priority)) ||
    !["none", "weekly"].includes(String(input.repeat)) ||
    typeof input.pushEnabled !== "boolean"
  )
    throw new Error("INVALID_INPUT");
  const competitionId = input.competitionId;
  if (
    competitionId !== null &&
    (typeof competitionId !== "string" || !/^[\w-]{1,128}$/.test(competitionId))
  )
    throw new Error("INVALID_INPUT");
  return {
    title,
    notes,
    dueAtMs,
    competitionId,
    category: input.category as OperationalTask["category"],
    priority: input.priority as OperationalTask["priority"],
    repeat: input.repeat as OperationalTask["repeat"],
    reminderMinutes: [...new Set(offsets as number[])].sort((a, b) => b - a),
    pushEnabled: input.pushEnabled,
  };
}
