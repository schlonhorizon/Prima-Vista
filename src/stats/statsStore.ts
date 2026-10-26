import type { KeyValueStorage } from '../core/storage';

/**
 * Per-item learning statistics, persisted in localStorage.
 *
 * An "item" is whatever an exercise asks for, identified by a string key such
 * as "note|treble|C4", "interval|M3|up|mel" or "keysig|-3". An adaptive selector
 * can read `getItem()` to weight weak items (low hit rate, slow reactions, not
 * seen for a long time). Attempts with help and skipped tasks are counted
 * separately and marked in `recent`, so the adaptive logic can treat them differently.
 */

export interface Attempt {
  /** Unix time in ms */
  readonly t: number;
  readonly ok: boolean;
  /** Reaction time in ms, null if not measurable (e.g. user was away). */
  readonly ms: number | null;
  /** Answered with help (a tip was shown). */
  readonly help?: boolean;
  /** Skipped without an answer. */
  readonly skipped?: boolean;
}

export interface ItemStats {
  /** Answers without help. */
  hits: number;
  misses: number;
  /** Answers given after looking at a tip; kept apart from hits/misses and times. */
  assistedHits: number;
  assistedMisses: number;
  /** Tasks skipped without an answer – neither hit nor miss. */
  skipped: number;
  /** Sum and count of reaction times of correct answers (all time). */
  hitTimeSum: number;
  hitTimeCount: number;
  /** Most recent attempts, newest last, capped at RECENT_LIMIT. */
  recent: Attempt[];
  /** What was played instead, keyed by MIDI numbers joined with "-". */
  confusions: Record<string, number>;
  lastSeen: number;
}

interface StatsData {
  version: 1;
  items: Record<string, ItemStats>;
}

export const RECENT_LIMIT = 50;
const STORAGE_KEY = 'prima-vista.stats.v1';

export interface AttemptInput {
  ok: boolean;
  ms: number | null;
  /** MIDI notes played on a wrong answer. */
  played?: readonly number[];
  /** A tip was used for this attempt. */
  assisted?: boolean;
  /** The task was skipped (ok and ms are ignored). */
  skipped?: boolean;
  t?: number;
}

export class StatsStore {
  private data: StatsData;
  private listeners = new Set<() => void>();

  constructor(private storage: KeyValueStorage) {
    this.data = this.load();
  }

  record(itemKey: string, attempt: AttemptInput): void {
    const item = (this.data.items[itemKey] ??= emptyItem());
    const t = attempt.t ?? Date.now();
    if (attempt.skipped) {
      item.skipped++;
      this.pushRecent(item, { t, ok: false, ms: null, skipped: true });
      item.lastSeen = t;
      this.save();
      return;
    }
    if (attempt.assisted) {
      if (attempt.ok) item.assistedHits++;
      else item.assistedMisses++;
    } else if (attempt.ok) {
      item.hits++;
      if (attempt.ms !== null) {
        item.hitTimeSum += attempt.ms;
        item.hitTimeCount++;
      }
    } else {
      item.misses++;
    }
    if (!attempt.ok && attempt.played && attempt.played.length > 0) {
      const key = [...attempt.played].sort((a, b) => a - b).join('-');
      item.confusions[key] = (item.confusions[key] ?? 0) + 1;
    }
    const ms = attempt.ms === null ? null : Math.round(attempt.ms);
    this.pushRecent(item, attempt.assisted ? { t, ok: attempt.ok, ms, help: true } : { t, ok: attempt.ok, ms });
    item.lastSeen = t;
    this.save();
  }

  private pushRecent(item: ItemStats, attempt: Attempt): void {
    item.recent.push(attempt);
    if (item.recent.length > RECENT_LIMIT) item.recent.splice(0, item.recent.length - RECENT_LIMIT);
  }

  getItem(itemKey: string): Readonly<ItemStats> | undefined {
    return this.data.items[itemKey];
  }

  allItems(): Readonly<Record<string, Readonly<ItemStats>>> {
    return this.data.items;
  }

  reset(): void {
    this.data = { version: 1, items: {} };
    this.save();
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private load(): StatsData {
    const raw = this.storage.get(STORAGE_KEY);
    if (!raw) return { version: 1, items: {} };
    try {
      const parsed = JSON.parse(raw) as Partial<StatsData>;
      if (parsed.version === 1 && parsed.items && typeof parsed.items === 'object') {
        for (const item of Object.values(parsed.items)) Object.assign(item, { ...emptyItem(), ...item });
        return parsed as StatsData;
      }
    } catch {
      // corrupt data – start fresh
    }
    return { version: 1, items: {} };
  }

  private save(): void {
    this.storage.set(STORAGE_KEY, JSON.stringify(this.data));
    this.listeners.forEach((l) => l());
  }
}

function emptyItem(): ItemStats {
  return {
    hits: 0,
    misses: 0,
    assistedHits: 0,
    assistedMisses: 0,
    skipped: 0,
    hitTimeSum: 0,
    hitTimeCount: 0,
    recent: [],
    confusions: {},
    lastSeen: 0,
  };
}

export function averageHitTime(item: Readonly<ItemStats> | undefined): number | null {
  if (!item || item.hitTimeCount === 0) return null;
  return item.hitTimeSum / item.hitTimeCount;
}
