import "server-only";
export const privateHeaders = { "Cache-Control": "private, no-store" };
export function operationsError(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  const messages: Record<string, string> = {
    UNAUTHORIZED: "Sessione non valida.",
    FORBIDDEN: "Accesso riservato agli amministratori.",
    INVALID_INPUT: "Controlla titolo, scadenza e campi dell'attività.",
    NOT_FOUND: "Attività non disponibile.",
    CONFLICT: "L'attività è stata modificata. Aggiorna prima di continuare.",
    AI_NOT_CONFIGURED:
      "Assistente AI da configurare. Puoi già usare le priorità e gli esperimenti suggeriti nella dashboard.",
  };
  const status =
    code === "UNAUTHORIZED"
      ? 401
      : code === "FORBIDDEN"
        ? 403
        : code === "NOT_FOUND"
          ? 404
          : code === "CONFLICT"
            ? 409
            : code === "INVALID_INPUT"
              ? 400
              : 503;
  if (!messages[code]) console.error("[Operations]", error);
  return Response.json(
    { error: messages[code] ?? "Servizio temporaneamente non disponibile." },
    { status, headers: privateHeaders },
  );
}
export async function readOperationsBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_INPUT");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 16000) {
        await reader.cancel();
        throw new Error("INVALID_INPUT");
      }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("INVALID_INPUT");
  } finally {
    reader.releaseLock();
  }
}
