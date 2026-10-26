import { describe, expect, it } from 'vitest';
import { migrateStorageKeys } from '../src/core/migrations';
import { memoryStorage } from '../src/core/storage';

describe('migrateStorageKeys', () => {
  it('moves data from the old "notenleser" keys', () => {
    const s = memoryStorage();
    s.set('notenleser.settings.v1', '{"mode":"grand"}');
    s.set('notenleser.stats.v1', '{"version":1,"items":{}}');
    migrateStorageKeys(s);
    expect(s.get('prima-vista.settings.v1')).toBe('{"mode":"grand"}');
    expect(s.get('prima-vista.stats.v1')).toBe('{"version":1,"items":{}}');
    expect(s.get('notenleser.settings.v1')).toBeNull();
    expect(s.get('notenleser.stats.v1')).toBeNull();
  });

  it('never overwrites data already stored under the new key', () => {
    const s = memoryStorage();
    s.set('notenleser.stats.v1', 'old');
    s.set('prima-vista.stats.v1', 'new');
    migrateStorageKeys(s);
    expect(s.get('prima-vista.stats.v1')).toBe('new');
    expect(s.get('notenleser.stats.v1')).toBeNull();
  });

  it('does nothing without old data', () => {
    const s = memoryStorage();
    migrateStorageKeys(s);
    expect(s.get('prima-vista.settings.v1')).toBeNull();
  });
});
