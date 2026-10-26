import { describe, expect, it } from 'vitest';
import { pitch } from '../src/core/pitch';
import { memoryStorage } from '../src/core/storage';
import { StepMatcher } from '../src/exercises/matcher';
import { WeightedSelector } from '../src/exercises/selection';
import type { NoteEvent } from '../src/input/types';
import { averageHitTime, RECENT_LIMIT, StatsStore } from '../src/stats/statsStore';

const on = (midi: number, time = 0): NoteEvent => ({ type: 'on', midi, velocity: 100, time, source: 'computer' });
const off = (midi: number, time = 0): NoteEvent => ({ type: 'off', midi, velocity: 0, time, source: 'computer' });

describe('StepMatcher', () => {
  it('accepts the right note in the right octave only', () => {
    expect(new StepMatcher({ pitches: [pitch('C', 0, 4)] }).handle(on(60, 5))).toEqual({ status: 'correct', time: 5 });
    expect(new StepMatcher({ pitches: [pitch('C', 0, 4)] }).handle(on(72))).toMatchObject({ status: 'wrong', played: [72] });
  });

  it('treats enharmonics as equal', () => {
    expect(new StepMatcher({ pitches: [pitch('D', -1, 4)] }).handle(on(61)).status).toBe('correct');
  });

  it('requires all chord notes held together', () => {
    const m = new StepMatcher({ pitches: [pitch('C', 0, 4), pitch('E', 0, 4), pitch('G', 0, 4)] });
    expect(m.handle(on(60)).status).toBe('pending');
    expect(m.handle(on(64)).status).toBe('pending');
    m.handle(off(60));
    expect(m.handle(on(67)).status).toBe('pending');
    expect(m.handle(on(60)).status).toBe('correct');
  });
});

describe('StatsStore', () => {
  it('records hits, misses, times and confusions and persists them', () => {
    const storage = memoryStorage();
    const store = new StatsStore(storage);
    store.record('note|treble|C4', { ok: true, ms: 800 });
    store.record('note|treble|C4', { ok: true, ms: 1200 });
    store.record('note|treble|C4', { ok: false, ms: 500, played: [62] });
    store.record('note|treble|C4', { ok: true, ms: null });

    const item = new StatsStore(storage).getItem('note|treble|C4')!;
    expect(item.hits).toBe(3);
    expect(item.misses).toBe(1);
    expect(averageHitTime(item)).toBe(1000);
    expect(item.confusions).toEqual({ '62': 1 });
    expect(item.recent.map((a) => a.ok)).toEqual([true, true, false, true]);
  });

  it('caps the recent history', () => {
    const store = new StatsStore(memoryStorage());
    for (let i = 0; i < RECENT_LIMIT + 10; i++) store.record('x', { ok: true, ms: i });
    expect(store.getItem('x')!.recent).toHaveLength(RECENT_LIMIT);
    expect(store.getItem('x')!.recent[0].ms).toBe(10);
  });
});

describe('WeightedSelector repeat avoidance', () => {
  it('does not repeat the previous item', () => {
    const sel = new WeightedSelector({ random: () => 0 });
    const items = ['a', 'b', 'c'].map((s) => ({ item: s, key: s, baseWeight: 1 }));
    const picks = Array.from({ length: 6 }, () => sel.pick(items));
    for (let i = 1; i < picks.length; i++) expect(picks[i]).not.toBe(picks[i - 1]);
  });
});
