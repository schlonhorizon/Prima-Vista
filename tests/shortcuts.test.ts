import { describe, expect, it } from 'vitest';
import { memoryStorage } from '../src/core/storage';
import { PIANO_CODES } from '../src/input/computerKeyboard';
import { StatsStore } from '../src/stats/statsStore';
import { matches, SHORTCUTS, type ShortcutId } from '../src/ui/shortcuts';

const ev = (code: string, key = '', shiftKey = false) => ({ code, key, shiftKey }) as KeyboardEvent;

describe('shortcuts', () => {
  it('never use a key of the computer piano', () => {
    for (const [id, s] of Object.entries(SHORTCUTS)) {
      if (s.code) expect(PIANO_CODES, id).not.toContain(s.code);
    }
  });

  it('are unique', () => {
    const codes = Object.values(SHORTCUTS).map((s) => s.code ?? `key:${'key' in s ? s.key : ''}`);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('match by code (layout independent) and "?" by character', () => {
    expect(matches(ev('KeyN'), 'tip')).toBe(true);
    expect(matches(ev('KeyN', 'N', true), 'tip')).toBe(false);
    expect(matches(ev('Minus', '?', true), 'help')).toBe(true); // German layout: Shift+ß
    expect(matches(ev('NumpadEnter'), 'next')).toBe(true);
    const ids: ShortcutId[] = ['tip', 'explain', 'lesson', 'skip'];
    expect(ids.map((id) => SHORTCUTS[id].display)).toEqual(['N', 'M', 'B', '→']);
  });
});

describe('skipped tasks in the statistics', () => {
  it('count neither as hit nor as miss', () => {
    const store = new StatsStore(memoryStorage());
    store.record('x', { ok: true, ms: 400 });
    store.record('x', { ok: false, ms: null, skipped: true });
    const item = store.getItem('x')!;
    expect([item.hits, item.misses, item.skipped]).toEqual([1, 0, 1]);
    expect(item.recent[1]).toMatchObject({ skipped: true, ms: null });
    expect(item.confusions).toEqual({});
  });
});
