import { describe, expect, it } from 'vitest';
import { pitchId } from '../src/core/pitch';
import { defaultSettings, effectiveRange, sanitize } from '../src/settings';

describe('settings', () => {
  it('uses the Nord Stage 4 preset in grand staff mode by default', () => {
    const s = { ...defaultSettings(), staff: 'grand' as const };
    const r = effectiveRange(s);
    expect([pitchId(r.low), pitchId(r.high)]).toEqual(['A0', 'C8']);
  });

  it('clips a preset to what a single clef can display', () => {
    const s = defaultSettings();
    s.ranges.treble.preset = 'nord88';
    const r = effectiveRange(s);
    expect([pitchId(r.low), pitchId(r.high)]).toEqual(['C1', 'C8']);
  });

  it('migrates step-1 settings', () => {
    const s = sanitize({ clef: 'treble', rangeLow: 'D4', rangeHigh: 'A5', accidentals: 'sharps' });
    expect(s.staff).toBe('treble');
    expect(s.ranges.treble).toEqual({ preset: 'manual', low: 'D4', high: 'A5' });
    expect(s.accidentals).toBe('sharps');
    expect(s.ranges.grand.preset).toBe('nord88');
  });

  it('rejects invalid values', () => {
    const s = sanitize({ mode: 'alto', weighting: { coreLow: 'C6', coreHigh: 'C2', decayPerOctave: 3 } });
    expect(s.staff).toBe('treble');
    expect(s.weighting).toEqual(defaultSettings().weighting);
  });

  it('migrates the staff system from "mode" to "staff"', () => {
    expect(sanitize({ mode: 'grand' }).staff).toBe('grand');
    expect(sanitize({ mode: 'grand', staff: 'bass' }).staff).toBe('bass');
  });

  it('validates key and interval settings', () => {
    const s = sanitize({
      practice: 'rhythm',
      key: { choice: 'D#-major', maxAccidentals: 9, includeMinor: false, changeEvery: 0 },
      intervals: { scope: 'key', allowed: ['P5', 'X9', 'm3'], direction: 'up', presentation: 'flute' },
    });
    expect(s.practice).toBe('notes'); // planned modes cannot be selected
    expect(s.key).toEqual({ choice: 'random', maxAccidentals: 4, includeMinor: false, changeEvery: 8 });
    expect(s.intervals.allowed).toEqual(['m3', 'P5']);
    expect(s.intervals.direction).toBe('up');
    expect(s.intervals.presentation).toBe('mixed');
    expect(sanitize({ key: { choice: 'Eb-minor' } }).key.choice).toBe('Eb-minor');
  });
});
