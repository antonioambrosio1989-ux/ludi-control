import type { PlayerProfile } from "@/src/types/PlayerProfile";

type Entry<T> = { value?: T; expiresAt: number; pending?: Promise<T> };

// Memory only. Private/admin profiles never enter this cache.
export class ReadRequestCache<T> {
  private entries = new Map<string, Entry<T>>();
  constructor(private ttlMs = 15_000, private now = Date.now) {}

  peek(key: string): T | undefined {
    const entry = this.entries.get(key);
    return entry && entry.expiresAt > this.now() ? entry.value : undefined;
  }

  invalidate(key: string) { this.entries.delete(key); }

  load(key: string, loader: () => Promise<T>): Promise<T> {
    const cached = this.peek(key);
    if (cached !== undefined) return Promise.resolve(cached);
    const existing = this.entries.get(key);
    if (existing?.pending) return existing.pending;

    const entry: Entry<T> = { expiresAt: 0 };
    const pending = Promise.resolve().then(loader).then((value) => {
      if (this.entries.get(key) === entry) {
        entry.value = value;
        entry.expiresAt = this.now() + this.ttlMs;
        entry.pending = undefined;
      }
      return value;
    }, (error: unknown) => {
      if (this.entries.get(key) === entry) this.entries.delete(key);
      throw error;
    });
    entry.pending = pending;
    this.entries.set(key, entry);
    return pending;
  }
}

export const publicPlayersCache = new ReadRequestCache<PlayerProfile[]>();
