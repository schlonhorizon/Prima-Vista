import { describe, expect, it } from 'vitest';
import { parsePitchId, pitchId, toMidi } from '../src/core/pitch';
import { pitchesInRange } from '../src/core/range';
import { DEFAULT_REGISTER_WEIGHTING, registerWeight } from '../src/core/weighting';
import { WeightedSelector, type Candidate } from '../src/exercises/selection';
import type { Pitch } from '../src/core/pitch';

const midi = (id: string) => toMidi(parsePitchId(id)!);
const weight = (id: string) => registerWeight(midi(id), DEFAULT_REGISTER_WEIGHTING);

/** Small seeded PRNG so the test is deterministic. */
function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('registerWeight', () => {
  it('is 1 inside the core zone C2–C6', () => {
    for (const id of ['C2', 'G3', 'C4', 'B5', 'C6']) expect(weight(id)).toBe(1);
  });

  it('halves per octave of distance', () => {
    expect(weight('B1')).toBe(0.5);
    expect(weight('C1')).toBe(0.5);
    expect(weight('B0')).toBe(0.25);
    expect(weight('A0')).toBe(0.25);
    expect(weight('C#6')).toBe(0.5);
    expect(weight('C7')).toBe(0.5);
    expect(weight('D7')).toBe(0.25);
    expect(weight('C8')).toBe(0.25);
  });

  it('uses the configured zone and factor', () => {
    const w = { coreLow: 'C3', coreHigh: 'C5', decayPerOctave: 0.1 };
    expect(registerWeight(midi('C3'), w)).toBe(1);
    expect(registerWeight(midi('B2'), w)).toBeCloseTo(0.1);
    expect(registerWeight(midi('B1'), w)).toBeCloseTo(0.01);
    expect(registerWeight(midi('D5'), { ...w, decayPerOctave: 1 })).toBe(1);
  });
});

describe('WeightedSelector frequencies', () => {
  const candidates: Candidate<Pitch>[] = pitchesInRange(
    { low: parsePitchId('A0')!, high: parsePitchId('C8')! },
    'none',
  ).map((p) => ({ item: p, key: pitchId(p), baseWeight: registerWeight(toMidi(p), DEFAULT_REGISTER_WEIGHTING) }));
  const totalWeight = candidates.reduce((s, c) => s + c.baseWeight, 0);
  const draws = 200_000;

  function count(selector: WeightedSelector): Map<string, number> {
    const counts = new Map<string, number>();
    for (let i = 0; i < draws; i++) {
      const p = selector.pick(candidates);
      counts.set(pitchId(p), (counts.get(pitchId(p)) ?? 0) + 1);
    }
    return counts;
  }

  it('draws every note about as often as its weight says', () => {
    const counts = count(new WeightedSelector({ random: mulberry32(42), avoidRepeat: false }));
    for (const c of candidates) {
      const p = c.baseWeight / totalWeight;
      const expected = draws * p;
      const sigma = Math.sqrt(draws * p * (1 - p));
      // 4.5 σ per note: a false alarm is practically impossible with 52 notes.
      expect(Math.abs((counts.get(c.key) ?? 0) - expected), c.key).toBeLessThan(4.5 * sigma);
    }
  });

  it('shows the weight ratios per register band', () => {
    const counts = count(new WeightedSelector({ random: mulberry32(7), avoidRepeat: false }));
    const perNote = (weight: number) => {
      const notes = candidates.filter((c) => c.baseWeight === weight);
      return notes.reduce((s, c) => s + (counts.get(c.key) ?? 0), 0) / notes.length;
    };
    // Average draws per note: core zone : first octave out : further out ≈ 1 : 0.5 : 0.25
    expect(perNote(0.5) / perNote(1)).toBeCloseTo(0.5, 1);
    expect(perNote(0.25) / perNote(1)).toBeCloseTo(0.25, 1);
  });

  it('multiplies modifiers into the weight (hook for adaptive weighting)', () => {
    const items = ['a', 'b'].map((k) => ({ item: k, key: k, baseWeight: 1 }));
    const sel = new WeightedSelector({ random: mulberry32(1), avoidRepeat: false, modifiers: [(k) => (k === 'a' ? 3 : 1)] });
    let a = 0;
    for (let i = 0; i < 40_000; i++) if (sel.pick(items) === 'a') a++;
    expect(a / 40_000).toBeCloseTo(0.75, 1);
  });

  it('falls back to uniform if all weights are 0', () => {
    const items = ['a', 'b'].map((k) => ({ item: k, key: k, baseWeight: 0 }));
    const sel = new WeightedSelector({ random: mulberry32(3), avoidRepeat: false });
    const seen = new Set(Array.from({ length: 50 }, () => sel.pick(items)));
    expect(seen).toEqual(new Set(['a', 'b']));
  });

  it('still picks when every candidate belongs to the same element', () => {
    const items = ['x1', 'x2'].map((item) => ({ item, key: 'same', baseWeight: 1 }));
    const sel = new WeightedSelector({ random: mulberry32(2) });
    for (let i = 0; i < 10; i++) expect(['x1', 'x2']).toContain(sel.pick(items));
  });
});
