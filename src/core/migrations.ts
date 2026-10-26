import type { KeyValueStorage } from './storage';

/** localStorage keys from before the app was renamed to "Prima Vista". */
const RENAMED_KEYS: ReadonlyArray<readonly [from: string, to: string]> = [
  ['notenleser.settings.v1', 'prima-vista.settings.v1'],
  ['notenleser.stats.v1', 'prima-vista.stats.v1'],
];

/** Moves data stored under old key names to the new ones (once; never overwrites new data). */
export function migrateStorageKeys(storage: KeyValueStorage): void {
  for (const [from, to] of RENAMED_KEYS) {
    const old = storage.get(from);
    if (old === null) continue;
    if (storage.get(to) === null) storage.set(to, old);
    storage.remove(from);
  }
}
