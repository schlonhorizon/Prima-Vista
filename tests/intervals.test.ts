import { describe, expect, it } from 'vitest';
import { parsePitchId, pitchClassId, pitchId, toMidi, type Pitch } from '../src/core/pitch';
import { IntervalExercise, standardInterval } from '../src/exercises/intervals';
import { KeyContext } from '../src/exercises/keyContext';
import { StepMatcher } from '../src/exercises/matcher';
import { WeightedSelector } from '../src/exercises/selection';
import type { NoteEvent } from '../src/input/types';
import { accidentalMarks } from '../src/render/accidentals';
import { defaultSettings, type IntervalSettings, type KeySettings } from '../src/settings';
import { interval, intervalBetween } from '../src/theory/interval';
import { fifthsOf, keySignature, keyTones, parseKeyId, samePitchClassInKey } from './helpers';

const p = (id: string) => parsePitchId(id)!;
const on = (midi: number, time = 0): NoteEvent => ({ type: 'on', midi, velocity: 100, time, source: 'computer' });
const off = (midi: number, time = 0): NoteEvent => ({ type: 'off', midi, velocity: 0, time, source: 'computer' });

function seeded(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function exercise(intervals: Partial<IntervalSettings>, key: Partial<KeySettings> = {}, range = ['C3', 'C6']) {
  const d = defaultSettings();
  const keySettings = { ...d.key, ...key };
  const ctx = new KeyContext(() => keySettings, seeded(5));
  return new IntervalExercise(
    () => ({
      staff: 'grand',
      range: { low: p(range[0]), high: p(range[1]) },
      weighting: d.weighting,
      settings: { ...d.intervals, ...intervals },
      chordWindowMs: 800,
    }),
    ctx,
    new WeightedSelector({ random: seeded(9) }),
  );
}

describe('accidentalMarks', () => {
  const sig = (fifths: number) => keySignature(fifths);
  it('omits accidentals that are in the key signature', () => {
    expect(accidentalMarks([[p('F#4')], [p('C#4')]], sig(2))).toEqual([[null], [null]]);
    expect(accidentalMarks([[p('F4')]], sig(2))).toEqual([['n']]);
    expect(accidentalMarks([[p('Bb4')]], sig(0))).toEqual([['b']]);
    expect(accidentalMarks([[p('C##5')]], sig(5))).toEqual([['##']]);
  });

  it('keeps an accidental for the rest of the measure in the same octave', () => {
    expect(accidentalMarks([[p('F#4')], [p('F#4')], [p('F4')]], sig(0))).toEqual([['#'], [null], ['n']]);
    expect(accidentalMarks([[p('F#4')], [p('F#5')]], sig(0))).toEqual([['#'], ['#']]);
  });
});

describe('StepMatcher with chord window', () => {
  const step = { pitches: [p('C4'), p('E4'), p('G4')] };

  it('reports missing and extra notes on a wrong key', () => {
    const m = new StepMatcher(step, 800);
    m.handle(on(60, 0));
    const r = m.handle(on(65, 10));
    expect(r).toMatchObject({ status: 'wrong', reason: 'wrong-note', missing: [64, 67], extra: [65] });
  });

  it('starts the window with the first note and expires', () => {
    const m = new StepMatcher(step, 800);
    expect(m.deadline()).toBeNull();
    m.handle(on(60, 100));
    expect(m.deadline()).toBe(900);
    m.handle(on(64, 200));
    expect(m.expire(900)).toMatchObject({ status: 'wrong', reason: 'timeout', missing: [67], extra: [] });
  });

  it('restarts the window after all keys are released', () => {
    const m = new StepMatcher(step, 800);
    m.handle(on(60, 0));
    m.handle(off(60, 50));
    expect(m.deadline()).toBeNull();
    m.handle(on(60, 2000));
    expect(m.deadline()).toBe(2800);
  });

  it('has no window for single notes or when disabled', () => {
    const single = new StepMatcher({ pitches: [p('C4')] }, 800);
    expect(single.handle(on(60, 5)).status).toBe('correct');
    const noWindow = new StepMatcher(step, 0);
    noWindow.handle(on(60));
    expect(noWindow.deadline()).toBeNull();
  });
});

describe('standardInterval', () => {
  it('maps tritones and rejects unusual intervals', () => {
    expect(standardInterval(interval('A4'))).toBe('TT');
    expect(standardInterval(interval('d5'))).toBe('TT');
    expect(standardInterval(interval('M3'))).toBe('M3');
    expect(standardInterval(interval('A2'))).toBeNull();
    expect(standardInterval(interval('d7'))).toBeNull();
  });
});

describe('IntervalExercise', () => {
  const pitchesOf = (t: { steps: readonly { pitches: readonly Pitch[] }[] }) => t.steps.flatMap((s) => s.pitches);

  it('uses only tones of the key and the configured intervals', () => {
    const ex = exercise({ allowed: ['M3', 'P5'] }, { choice: 'E-major' });
    const tones = keyTones(parseKeyId('E-major')!).map(pitchClassId);
    for (let i = 0; i < 200; i++) {
      const t = ex.nextTask();
      expect(t.key && fifthsOf(t.key)).toBe(4);
      const [a, b] = pitchesOf(t).sort((x, y) => toMidi(x) - toMidi(y));
      for (const x of [a, b]) expect(tones).toContain(pitchClassId(x));
      const iv = intervalBetween(a, b)!;
      expect(['M3', 'P5']).toContain(`${iv.quality}${iv.number}`);
      expect(samePitchClassInKey(a, b)).toBe(false);
    }
  });

  it('follows presentation and direction', () => {
    const up = exercise({ presentation: 'melodic', direction: 'up' }, { choice: 'C-major' });
    for (let i = 0; i < 50; i++) {
      const t = up.nextTask();
      expect(t.steps).toHaveLength(2);
      expect(toMidi(t.steps[1].pitches[0])).toBeGreaterThan(toMidi(t.steps[0].pitches[0]));
      expect(t.label).toMatch(/aufwärts$/);
    }
    const harm = exercise({ presentation: 'harmonic' }, { choice: 'C-major' });
    for (let i = 0; i < 50; i++) {
      const t = harm.nextTask();
      expect(t.steps).toHaveLength(1);
      expect(t.steps[0].pitches).toHaveLength(2);
      expect(t.itemKey).toMatch(/\|harm$/);
    }
  });

  it('spells chromatic intervals correctly without key signature', () => {
    const ex = exercise({ scope: 'chromatic', allowed: ['M3'], presentation: 'harmonic' });
    for (let i = 0; i < 200; i++) {
      const t = ex.nextTask();
      expect(t.key).toBeNull();
      const [a, b] = t.steps[0].pitches;
      expect(intervalBetween(a, b)).toEqual({ number: 3, quality: 'M' });
      expect(Math.abs(b.alter)).toBeLessThanOrEqual(1);
    }
  });

  it('stays within the range and uses the minor leading tone', () => {
    const ex = exercise({ allowed: ['m2'] }, { choice: 'A-minor' }, ['E4', 'B4']);
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      for (const x of pitchesOf(ex.nextTask())) {
        expect(toMidi(x)).toBeGreaterThanOrEqual(toMidi(p('E4')));
        expect(toMidi(x)).toBeLessThanOrEqual(toMidi(p('B4')));
        seen.add(pitchId(x));
      }
    }
    expect(seen).toContain('G#4'); // G#–A is a leitereigene kleine Sekunde in a-Moll
  });

  it('changes a random key after the configured number of tasks', () => {
    const ex = exercise({}, { choice: 'random', changeEvery: 3, maxAccidentals: 7 });
    const keys = Array.from({ length: 9 }, () => {
      const k = ex.nextTask().key!;
      return `${pitchClassId(k.tonic)}-${k.mode}`;
    });
    expect(keys[0]).toBe(keys[1]);
    expect(keys[1]).toBe(keys[2]);
    expect(keys[3]).not.toBe(keys[2]);
    expect(keys[3]).toBe(keys[5]);
  });
});
