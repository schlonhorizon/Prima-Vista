import { ALL_KEYS, fifthsOf, parseKeyId, sameKey, type Key } from '../theory/key';
import { RANDOM_KEY, type KeySettings } from '../settings';

/**
 * The key shared by all key-based exercises: either a fixed one, or a random key
 * from the pool that changes every `changeEvery` tasks.
 */
export class KeyContext {
  private current: Key | null = null;
  private used = 0;
  private lastSettings = '';

  constructor(
    private getSettings: () => KeySettings,
    private random: () => number = Math.random,
  ) {}

  pool(): Key[] {
    const s = this.getSettings();
    return ALL_KEYS.filter(
      (k) => Math.abs(fifthsOf(k)) <= s.maxAccidentals && (s.includeMinor || k.mode === 'major'),
    );
  }

  /** The key for the next task (counts as one use). */
  next(): Key {
    const s = this.getSettings();
    if (s.choice !== RANDOM_KEY) return parseKeyId(s.choice) ?? ALL_KEYS[7];
    const fingerprint = JSON.stringify(s);
    if (!this.current || fingerprint !== this.lastSettings || this.used >= s.changeEvery) {
      this.current = this.draw();
      this.used = 0;
      this.lastSettings = fingerprint;
    }
    this.used++;
    return this.current;
  }

  /** Key of the current round without using it up (for display). */
  peek(): Key | null {
    const s = this.getSettings();
    return s.choice !== RANDOM_KEY ? parseKeyId(s.choice) : this.current;
  }

  private draw(): Key {
    const pool = this.pool();
    const candidates = pool.length > 1 && this.current ? pool.filter((k) => !sameKey(k, this.current!)) : pool;
    return candidates[Math.floor(this.random() * candidates.length)] ?? pool[0];
  }
}
