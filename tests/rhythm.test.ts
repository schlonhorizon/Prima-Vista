import { describe, expect, it } from 'vitest';
import { WeightedSelector } from '../src/exercises/selection';
import { RHYTHM_CELLS } from '../src/rhythm/cells';
import { countBar, countRhythm } from '../src/rhythm/counting';
import { barBeats, onsets, parseRhythm } from '../src/rhythm/events';
import { evaluateRhythm } from '../src/rhythm/evaluate';
import { expectedNotes, generateRhythm, patternBars } from '../src/rhythm/generator';
import { estimateLatency } from '../src/timing/latency';
import { beatsInWindow, beatToTime, timeToBeat } from '../src/timing/transport';

function seeded(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

describe('rhythm notation', () => {
  it('parses tokens and computes bar lengths', () => {
    const bars = parseRhythm('q 8 8 qd 8 | 8t 8t 8t 16 16 16 16 hr');
    expect(bars.map(barBeats)).toEqual([4, 4]);
    expect(bars[0][2]).toMatchObject({ value: '8', dotted: false, rest: false });
    expect(bars[0][3]).toMatchObject({ value: 'q', dotted: true });
    expect(bars[1][6]).toMatchObject({ value: '16' });
    expect(onsets(parseRhythm('qd 8 h'))[0]).toEqual([0, 1.5, 2]);
    expect(() => parseRhythm('q x')).toThrow();
  });

  it('defines cells that fit their start beats', () => {
    for (const cell of RHYTHM_CELLS) {
      expect(cell.beats, cell.id).toBeGreaterThan(0);
      for (const start of cell.starts) expect(start + cell.beats, cell.id).toBeLessThanOrEqual(4);
    }
  });
});

describe('rhythm generator', () => {
  it('fills every bar exactly and uses only cells up to the level', () => {
    for (let level = 1; level <= 4; level++) {
      const selector = new WeightedSelector({ random: seeded(level), avoidRepeat: false });
      for (let i = 0; i < 100; i++) {
        const bars = 1 + (i % 4);
        const pattern = generateRhythm(level, bars, selector);
        const events = patternBars(pattern, bars);
        expect(events.map(barBeats)).toEqual(Array(bars).fill(4));
        for (const c of pattern.cells) {
          expect(c.cell.level).toBeLessThanOrEqual(level);
          expect(c.cell.starts).toContain(c.beat);
        }
        for (const bar of events) expect(bar.some((e) => !e.rest)).toBe(true);
      }
    }
  });

  it('lists the expected notes with onsets', () => {
    const quarter = RHYTHM_CELLS.find((c) => c.id === 'quarter')!;
    const syncope = RHYTHM_CELLS.find((c) => c.id === 'syncope')!;
    const pattern = { beatsPerBar: 4, cells: [{ cell: syncope, bar: 0, beat: 0 }, { cell: quarter, bar: 0, beat: 2 }, { cell: quarter, bar: 0, beat: 3 }] };
    expect(expectedNotes(pattern).map((n) => n.beat)).toEqual([0, 0.5, 1.5, 2, 3]);
  });
});

describe('counting', () => {
  it('counts beats, offbeats, sixteenths, triplets and rests', () => {
    expect(countBar(parseRhythm('q 8 8 qr q')[0])).toBe('1 · 2 und · (3) · 4');
    expect(countBar(parseRhythm('16 16 16 16 8t 8t 8t h')[0])).toBe('1 e und e · 2 tri ole · 3 · (4)');
    expect(countBar(parseRhythm('q h q')[0])).toBe('1 · 2 · (3) · 4');
    expect(countBar(parseRhythm('8r 8 qd 8 q')[0])).toBe('(1) und · 2 · (3) und · 4');
    expect(countBar(parseRhythm('8 q 8 h')[0])).toBe('1 und · (2) und · 3 · (4)');
    expect(countRhythm(parseRhythm('w | h h'))).toBe('1 · (2) · (3) · (4)  |  1 · (2) · 3 · (4)');
  });
});

describe('rhythm evaluation', () => {
  const beat = 500; // 120 bpm
  const expected = [0, 500, 1000, 1250, 1500];

  it('accepts taps within the tolerance', () => {
    const r = evaluateRhythm(expected, [10, 480, 1030, 1240, 1495], 50, 250);
    expect(r.correct).toBe(true);
    expect(r.onTime).toBe(5);
    expect(r.notes.map((n) => n.deviation)).toEqual([10, -20, 30, -10, -5]);
  });

  it('classifies early, late, missed and extra taps', () => {
    const r = evaluateRhythm(expected, [-80, 590, 1260, 1900], 50, 250);
    expect(r.notes.map((n) => n.verdict)).toEqual(['early', 'late', 'missed', 'on', 'missed']);
    expect(r.extraTaps).toEqual([1900]);
    expect(r.correct).toBe(false);
    expect([r.early, r.late, r.missed]).toEqual([1, 1, 2]);
    void beat;
  });

  it('does not let one tap count for two notes', () => {
    const r = evaluateRhythm([0, 250], [120], 50, 250);
    expect(r.notes.filter((n) => n.tap !== null)).toHaveLength(1);
  });
});

describe('transport and latency', () => {
  const t = { bpm: 120, beatsPerBar: 4, startTime: 1000 };

  it('converts beats and time', () => {
    expect(beatToTime(t, 2)).toBe(2000);
    expect(timeToBeat(t, 2250)).toBe(2.5);
    expect(beatsInWindow(t, 1400, 2600)).toEqual([1, 2, 3]);
    expect(beatsInWindow(t, 0, 5000, 2)).toEqual([0, 1, 2]);
  });

  it('estimates the input latency as median offset', () => {
    const beats = [0, 500, 1000, 1500, 2000, 2500];
    expect(estimateLatency([40, 545, 1038, 1600, 2042, 2537], beats)).toBe(41);
    expect(estimateLatency([40, 545], beats)).toBeNull(); // too few taps
  });
});
