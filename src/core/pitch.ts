/**
 * Spelled pitches. A pitch keeps its letter name and accidental (not just the
 * MIDI number) so that notation, German note names and later intervals/chords
 * can be spelled correctly. Comparison with played keys happens via MIDI.
 */

export const STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
export type Step = (typeof STEPS)[number];
/** -1 = flat, 0 = natural, 1 = sharp */
export type Alter = -1 | 0 | 1;

export interface Pitch {
  readonly step: Step;
  readonly alter: Alter;
  /** Scientific octave: C4 is middle C (MIDI 60). */
  readonly octave: number;
}

const STEP_SEMITONES: Record<Step, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function pitch(step: Step, alter: Alter, octave: number): Pitch {
  return { step, alter, octave };
}

export function toMidi(p: Pitch): number {
  return (p.octave + 1) * 12 + STEP_SEMITONES[p.step] + p.alter;
}

/** Position on the staff, counted in diatonic steps (C0 = 0). */
export function diatonicIndex(p: Pitch): number {
  return p.octave * 7 + STEPS.indexOf(p.step);
}

export function fromDiatonicIndex(index: number, alter: Alter = 0): Pitch {
  const octave = Math.floor(index / 7);
  return pitch(STEPS[index - octave * 7], alter, octave);
}

/** Stable id used for storage keys and settings, e.g. "C4", "F#4", "Bb3". */
export function pitchId(p: Pitch): string {
  const acc = p.alter === 1 ? '#' : p.alter === -1 ? 'b' : '';
  return `${p.step}${acc}${p.octave}`;
}

export function parsePitchId(id: string): Pitch | null {
  const m = /^([A-G])(#|b)?(-?\d+)$/.exec(id);
  if (!m) return null;
  const alter: Alter = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return pitch(m[1] as Step, alter, Number(m[3]));
}

/** Key string in VexFlow format, e.g. "c#/4". */
export function toVexKey(p: Pitch): string {
  const acc = p.alter === 1 ? '#' : p.alter === -1 ? 'b' : '';
  return `${p.step.toLowerCase()}${acc}/${p.octave}`;
}

const GERMAN_BASE: Record<Step, string> = { C: 'C', D: 'D', E: 'E', F: 'F', G: 'G', A: 'A', B: 'H' };

/** German note name: C, Cis, Des, Es, As, H, B … optionally with octave number. */
export function germanName(p: Pitch, withOctave = true): string {
  let name: string;
  if (p.alter === 0) name = GERMAN_BASE[p.step];
  else if (p.alter === 1) name = `${GERMAN_BASE[p.step]}is`;
  else if (p.step === 'B') name = 'B';
  else if (p.step === 'E' || p.step === 'A') name = `${p.step}s`;
  else name = `${GERMAN_BASE[p.step]}es`;
  return withOctave ? `${name}${p.octave}` : name;
}

const SHARP_SPELLING: ReadonlyArray<readonly [Step, Alter]> = [
  ['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0],
  ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0],
];

/** Spells a MIDI number with sharps (used to name what was actually played). */
export function midiToPitch(midi: number): Pitch {
  const pc = ((midi % 12) + 12) % 12;
  const [step, alter] = SHARP_SPELLING[pc];
  return pitch(step, alter, Math.floor(midi / 12) - 1);
}

export function isBlackKey(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);
}
