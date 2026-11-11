import { describe, expect, it } from "vitest";
import { formatWithdrawalNotice } from "./WithdrawalNoticeIdentity";

describe("Fase 6C FIX: nomi negli avvisi", () => {
  const names = { abc123: "Cristian Fattorusso", XYZ_7: "Giuseppe Ranieri" };
  it("mostra il nome al posto dell'ID del giocatore", () => {
    expect(formatWithdrawalNotice("Giocatore abc123: ciclo ammonizioni da ricalcolare cronologicamente.", names))
      .toBe("Giocatore Cristian Fattorusso: ciclo ammonizioni da ricalcolare cronologicamente.");
  });
  it("mantiene la causa e la gravità originale dell'avviso", () => {
    const message = "Giocatore XYZ_7: ammonizioni da verificare.";
    expect(formatWithdrawalNotice(message, names)).toBe("Giocatore Giuseppe Ranieri: ammonizioni da verificare.");
  });
  it("su richiesta mostra anche ID", () => {
    expect(formatWithdrawalNotice("Giocatore abc123: revisione", names, true))
      .toBe("Giocatore Cristian Fattorusso (abc123): revisione");
  });
  it("non inventa nomi per ID non risolti", () => {
    expect(formatWithdrawalNotice("Giocatore sconosciuto: revisione", names))
      .toBe("Giocatore sconosciuto: revisione");
  });
  it("non sostituisce identificativi di report o partite", () => {
    expect(formatWithdrawalNotice("Report pubblicato mancante per abc123: verifica.", names))
      .toBe("Report pubblicato mancante per abc123: verifica.");
  });
  it("sostituisce più giocatori senza alterare altri dati", () => {
    expect(formatWithdrawalNotice("Giocatore abc123: Gialli. Giocatore XYZ_7: Rosso.", names))
      .toBe("Giocatore Cristian Fattorusso: Gialli. Giocatore Giuseppe Ranieri: Rosso.");
  });
});
