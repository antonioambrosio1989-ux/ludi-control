import { describe, expect, it } from "vitest";
import { formatWithdrawalNotice } from "./WithdrawalNoticeIdentity";

describe("Fase 6C: nomi delle gare negli avvisi", () => {
  const matches = { m_01: "Middlesbrough – Stoke City (giornata 1)", m02: "Millwall – Stoke City (giornata 2)" };
  const players = { p01: "Diego Nappo" };
  it("sostituisce l'ID del primo match mantenendo il motivo", () => {
    expect(formatWithdrawalNotice("Report pubblicato mancante per m_01: impossibile attestare la gara disputata.", players, false, matches))
      .toBe("Report pubblicato mancante per Middlesbrough – Stoke City (giornata 1): impossibile attestare la gara disputata.");
  });
  it("mostra anche l'ID su richiesta", () => {
    expect(formatWithdrawalNotice("Report pubblicato mancante per m02: verifica.", players, true, matches))
      .toBe("Report pubblicato mancante per Millwall – Stoke City (giornata 2) (m02): verifica.");
  });
  it("mantiene gli ID non presenti nelle gare", () => {
    expect(formatWithdrawalNotice("Report pubblicato mancante per sconosciuto: verifica.", players, false, matches))
      .toBe("Report pubblicato mancante per sconosciuto: verifica.");
  });
  it("preserva la risoluzione dei giocatori e le altre informazioni", () => {
    expect(formatWithdrawalNotice("Giocatore p01: gialli. Report pubblicato mancante per m02: verifica.", players, false, matches))
      .toBe("Giocatore Diego Nappo: gialli. Report pubblicato mancante per Millwall – Stoke City (giornata 2): verifica.");
  });
  it("non cambia gli avvisi quando non viene fornita una mappa delle partite", () => {
    expect(formatWithdrawalNotice("Report pubblicato mancante per m02: verifica.", players))
      .toBe("Report pubblicato mancante per m02: verifica.");
  });
});
