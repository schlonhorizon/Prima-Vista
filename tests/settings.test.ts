import { describe, expect, it } from 'vitest';
import { pitchId } from '../src/core/pitch';
import { defaultSettings, effectiveRange, sanitize } from '../src/settings';

describe('settings', () => {
  it('uses the Nord Stage 4 preset in grand staff mode by default', () => {
    const s = { ...defaultSettings(), mode: 'grand' as const };
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
    expect(s.mode).toBe('treble');
    expect(s.ranges.treble).toEqual({ preset: 'manual', low: 'D4', high: 'A5' });
    expect(s.accidentals).toBe('sharps');
    expect(s.ranges.grand.preset).toBe('nord88');
  });

  it('rejects invalid values', () => {
    const s = sanitize({ mode: 'alto', weighting: { coreLow: 'C6', coreHigh: 'C2', decayPerOctave: 3 } });
    expect(s.mode).toBe('treble');
    expect(s.weighting).toEqual(defaultSettings().weighting);
  });
});
