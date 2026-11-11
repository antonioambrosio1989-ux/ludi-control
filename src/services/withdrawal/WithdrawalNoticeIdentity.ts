/** Presentazione degli avvisi. Nessuna modifica ai calcoli o ai dati Firebase. */
export function formatWithdrawalNotice(
  message: string,
  playerNames: Readonly<Record<string, string>>,
  showIds = false,
  matchNames: Readonly<Record<string, string>> = {},
): string {
  const withPlayerNames = message.replace(
    /\bGiocatore ([A-Za-z0-9_-]+)(?=:)/g,
    (original, id: string) => {
      const name = playerNames[id]?.trim();
      return name ? `Giocatore ${name}${showIds ? ` (${id})` : ""}` : original;
    },
  );
  // Identificativo del match, non del giocatore. Lo risolviamo solo
  // se compare nell'elenco delle gare prive di report pubblicato.
  return withPlayerNames.replace(
    /\bReport pubblicato mancante per ([A-Za-z0-9_-]+)(?=:)/g,
    (original, id: string) => {
      const name = matchNames[id]?.trim();
      return name ? `Report pubblicato mancante per ${name}${showIds ? ` (${id})` : ""}` : original;
    },
  );
}
