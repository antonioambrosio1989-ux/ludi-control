import "server-only";
import type { OperationsConnections } from "@/src/types/OperationalTask";
export function getOperationsConnections(): OperationsConnections {
  const ga = !!process.env.GA4_PROPERTY_ID?.trim();
  const account =
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim() ||
    process.env.INSTAGRAM_USER_ID?.trim();
  const ig = !!account && !!process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  const mismatch =
    !!process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID &&
    !!process.env.INSTAGRAM_USER_ID &&
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID.trim() !==
      process.env.INSTAGRAM_USER_ID.trim();
  const ai =
    !!process.env.OPENAI_API_KEY?.trim() &&
    !!process.env.OPENAI_OPERATIONS_MODEL?.trim();
  return {
    website: {
      status: ga ? "needs_verification" : "not_configured",
      message: ga
        ? "Proprietà GA4 indicata. Raccolta eventi e accesso ai report ancora da verificare."
        : "Statistiche del sito da configurare: nessun collegamento GA4 indicato.",
    },
    instagram: {
      status: ig ? "needs_verification" : "not_configured",
      message: mismatch
        ? "Gli identificativi Instagram per lettura e pubblicazione sono diversi: verificare che indichino l'account corretto."
        : ig
          ? "Configurazione Instagram presente; autorizzazioni Insights e account professionale ancora da verificare."
          : "Collegamento Instagram da configurare per leggere gli Insights.",
    },
    assistant: {
      status: ai ? "configured" : "not_configured",
      message: ai
        ? "Assistente AI configurato; le richieste analizzeranno titoli e scadenze delle tue attività. Nessun contenuto viene pubblicato automaticamente."
        : "Priorità e suggerimenti operativi disponibili. Per le domande libere configura chiave e modello OpenAI sul server.",
    },
  };
}
