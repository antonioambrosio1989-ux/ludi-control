export type DemoCalendarResult = {
  createdMatchIds: string[];
  registeredPendingWalkovers: number;
  awardedWalkovers: 0;
};

export function isLocalDemoHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
}

export function shouldUseDemoAtomicImport(input: {
  enabled: boolean;
  development: boolean;
  hostname: string;
}): boolean {
  return input.enabled && input.development && isLocalDemoHost(input.hostname);
}

export function validateDemoCalendarResponse(value: unknown, expectedCount: number): DemoCalendarResult {
  if (!value || typeof value !== 'object') throw new Error('Risposta importazione non valida.');
  const data = value as Record<string, unknown>;
  if (data.ok !== true || !Array.isArray(data.createdMatchIds) ||
      data.createdMatchIds.length !== expectedCount ||
      !data.createdMatchIds.every((id): id is string => typeof id === 'string' && id.length > 0) ||
      new Set(data.createdMatchIds).size !== expectedCount ||
      !Number.isSafeInteger(data.registeredPendingWalkovers) ||
      Number(data.registeredPendingWalkovers) < 0 ||
      data.awardedWalkovers !== 0) {
    throw new Error('Risposta importazione incoerente. Verificare l’emulatore prima di ripetere.');
  }
  return {
    createdMatchIds: data.createdMatchIds as string[],
    registeredPendingWalkovers: Number(data.registeredPendingWalkovers),
    awardedWalkovers: 0,
  };
}
