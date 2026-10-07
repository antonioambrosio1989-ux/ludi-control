/** Display labels shared by generated quizzes and previously saved questions. */
export function localizeQuizText(value: string): string {
  return value
    .replace(/The\s+Best\s+Ludi\s+Goalkeeper/gi, "MIGLIOR PORTIERE")
    .replace(/The\s+Best\s+Ludi\s+Player/gi, "MIGLIOR GIOCATORE")
    .replace(/The\s+Best\s+Ludi\s+Scorer/gi, "MIGLIOR MARCATORE");
}
