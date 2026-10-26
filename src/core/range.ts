import { diatonicIndex, fromDiatonicIndex, pitch, toMidi, type Pitch } from './pitch';

export type AccidentalMode = 'none' | 'sharps' | 'flats' | 'both';

export interface PitchRange {
  /** Inclusive bounds, compared by MIDI number. */
  readonly low: Pitch;
  readonly high: Pitch;
}

/** All natural pitches from low to high (inclusive). */
export function naturalsBetween(low: Pitch, high: Pitch): Pitch[] {
  const result: Pitch[] = [];
  for (let i = diatonicIndex(low); i <= diatonicIndex(high); i++) result.push(fromDiatonicIndex(i));
  return result;
}

/**
 * Candidate pitches for an exercise. Enharmonic oddities (E#, B#, Cb, Fb) are
 * left out; they can be added later as an advanced option.
 */
export function pitchesInRange(range: PitchRange, mode: AccidentalMode): Pitch[] {
  const lowMidi = toMidi(range.low);
  const highMidi = toMidi(range.high);
  const result: Pitch[] = [];
  for (let i = diatonicIndex(range.low) - 1; i <= diatonicIndex(range.high) + 1; i++) {
    const n = fromDiatonicIndex(i);
    const variants: Pitch[] = [n];
    if ((mode === 'sharps' || mode === 'both') && n.step !== 'E' && n.step !== 'B') {
      variants.push(pitch(n.step, 1, n.octave));
    }
    if ((mode === 'flats' || mode === 'both') && n.step !== 'C' && n.step !== 'F') {
      variants.push(pitch(n.step, -1, n.octave));
    }
    for (const v of variants) {
      const m = toMidi(v);
      if (m >= lowMidi && m <= highMidi) result.push(v);
    }
  }
  return result.sort((a, b) => toMidi(a) - toMidi(b) || a.alter - b.alter);
}
