/** Alias persistente e univoco anche per omonimi: non utilizza l'anno di nascita. */
function toSlug(value: string): string {
  return value.trim().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('it-IT')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildStablePublicPlayerAlias(input: {
  firstName: string;
  lastName: string;
  playerId: string;
}): string {
  const first=toSlug(input.firstName);
  const last=toSlug(input.lastName);
  const id=toSlug(input.playerId);
  if(!first||!last||!id) throw new Error('Impossibile generare alias: dati giocatore incompleti.');
  return [last, first, 'id', id].join('-');
}
