import type { Alter, Pitch, Step } from '../core/pitch';

export type AccidentalMark = 'bb' | 'b' | 'n' | '#' | '##';

const MARKS: Record<Alter, AccidentalMark> = { [-2]: 'bb', [-1]: 'b', 0: 'n', 1: '#', 2: '##' };

/**
 * Which notes need an accidental, given the key signature. Follows the usual rule:
 * an accidental is valid for the same letter in the same octave until the end of
 * the measure; every chord in `chords` belongs to the same measure.
 */
export function accidentalMarks(
  chords: readonly (readonly Pitch[])[],
  signature: Readonly<Record<Step, Alter>>,
): (AccidentalMark | null)[][] {
  const state = new Map<string, Alter>();
  return chords.map((chord) => {
    const marks = chord.map((p) => {
      const current = state.get(`${p.step}${p.octave}`) ?? signature[p.step];
      return current === p.alter ? null : MARKS[p.alter];
    });
    for (const p of chord) state.set(`${p.step}${p.octave}`, p.alter);
    return marks;
  });
}
