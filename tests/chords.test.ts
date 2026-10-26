import { describe, expect, it } from 'vitest';
import { parsePitchId, pitchClassId, toMidi } from '../src/core/pitch';
import { ChordExercise, describeChord } from '../src/exercises/chords';
import { KeyContext } from '../src/exercises/keyContext';
import { WeightedSelector } from '../src/exercises/selection';
import { defaultSettings, sanitize, type ChordSettings } from '../src/settings';
import { diatonicChord } from '../src/theory/chords';
import { keyScale, parseKeyId } from '../src/theory/key';

const p = (id: string) => parsePitchId(id)!;

function seeded(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function exercise(chords: Partial<ChordSettings>, keyChoice = 'C-major', range = ['C3', 'C6'], known: string[] = []) {
  const d = defaultSettings();
  const keySettings = { ...d.key, choice: keyChoice };
  return new ChordExercise(
    () => ({
      staff: 'grand',
      range: { low: p(range[0]), high: p(range[1]) },
      weighting: d.weighting,
      settings: { ...d.chords, ...chords },
      chordWindowMs: 800,
    }),
    new KeyContext(() => keySettings, seeded(3)),
    new WeightedSelector({ random: seeded(11) }),
    () => known,
  );
}

describe('ChordExercise', () => {
  it('describes the chord after the answer', () => {
    const am = diatonicChord(parseKeyId('C-major')!, 6, false);
    expect(describeChord(am, 1)).toBe('Am, vi, Tp, 1. Umkehrung');
    const g7 = diatonicChord(parseKeyId('C-major')!, 5, true);
    expect(describeChord(g7, 0)).toBe('G7, V7, D⁷, Grundstellung');
  });

  it('plays one step with all chord tones, inside the range', () => {
    const ex = exercise({ kinds: 'both' }, 'Ab-major', ['F3', 'F5']);
    for (let i = 0; i < 300; i++) {
      const t = ex.nextTask();
      expect(t.steps).toHaveLength(1);
      const notes = t.steps[0].pitches;
      expect([3, 4]).toContain(notes.length);
      for (const n of notes) {
        expect(toMidi(n)).toBeGreaterThanOrEqual(toMidi(p('F3')));
        expect(toMidi(n)).toBeLessThanOrEqual(toMidi(p('F5')));
      }
      // all notes ascending (close position)
      for (let j = 1; j < notes.length; j++) expect(toMidi(notes[j])).toBeGreaterThan(toMidi(notes[j - 1]));
    }
  });

  it('respects selected degrees, kinds and inversions', () => {
    const ex = exercise({ kinds: 'triads', degrees: [2, 5], inversions: [1] });
    for (let i = 0; i < 100; i++) {
      const t = ex.nextTask();
      expect(t.label).toMatch(/^(Dm, ii, Sp|G, V, D), 1\. Umkehrung$/);
      expect(t.itemKey).toMatch(/^chord\|C-major\|(ii|V)\|3\|1$/);
    }
  });

  it('skips the 3rd inversion for triads', () => {
    const t = exercise({ kinds: 'triads', inversions: [3] }).nextTask();
    expect(t.answer).toBe('choice');
    expect(t.steps).toHaveLength(0);
  });

  it('uses only key tones (harmonic minor for V and vii°)', () => {
    const ex = exercise({ kinds: 'sevenths' }, 'F#-minor');
    const allowed = [...keyScale(parseKeyId('F#-minor')!).map(pitchClassId), 'E#'];
    for (let i = 0; i < 200; i++) {
      for (const n of ex.nextTask().steps[0].pitches) expect(allowed).toContain(pitchClassId(n));
    }
  });

  it('groups statistics by key and by inversion', () => {
    const groups = exercise({}, 'C-major', ['C3', 'C6'], ['chord|Eb-major|ii|3|2', 'note|treble|C4']).statsGroups();
    expect(groups.map((g) => g.title)).toEqual(['Es-Dur', 'C-Dur', 'Nach Lage (alle Tonarten)']);
    expect(groups[1].rows[5].cells).toEqual(['vi', 'Am', 'Tp']);
    expect(groups[1].rows[11].keys).toHaveLength(4); // G7: four inversions
    expect(groups[2].rows[2].keys).toEqual(['chord|Eb-major|ii|3|2']);
  });

  it('sanitizes chord settings', () => {
    expect(sanitize({ chords: { kinds: 'ninths', inversions: [5, 1, 1], degrees: [] } }).chords).toEqual({
      kinds: 'triads',
      inversions: [1],
      degrees: [1, 2, 3, 4, 5, 6, 7],
    });
  });
});
