/**
 * Spelled pitches. A pitch keeps its letter name and accidental (not just the
 * MIDI number) so that notation, German note names and later intervals/chords
 * can be spelled correctly. Comparison with played keys happens via MIDI.
 */

export const STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
export type Step = (typeof STEPS)[number];
/** -2 = double flat, -1 = flat, 0 = natural, 1 = sharp, 2 = double sharp */
export type Alter = -2 | -1 | 0 | 1 | 2;

/** A pitch without octave, e.g. the tonic of a key or the root of a chord. */
export interface PitchClass {
  readonly step: Step;
  readonly alter: Alter;
}

const ACCIDENTAL_ID: Record<Alter, string> = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' };

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
  return `${pitchClassId(p)}${p.octave}`;
}

/** "C", "F#", "Bb", "C##" … */
export function pitchClassId(p: PitchClass): string {
  return `${p.step}${ACCIDENTAL_ID[p.alter]}`;
}

export function parsePitchId(id: string): Pitch | null {
  const m = /^([A-G])(##|#|bb|b)?(-?\d+)$/.exec(id);
  if (!m) return null;
  return pitch(m[1] as Step, parseAccidental(m[2]), Number(m[3]));
}

export function parsePitchClassId(id: string): PitchClass | null {
  const m = /^([A-G])(##|#|bb|b)?$/.exec(id);
  return m ? { step: m[1] as Step, alter: parseAccidental(m[2]) } : null;
}

function parseAccidental(acc: string | undefined): Alter {
  return ({ '##': 2, '#': 1, b: -1, bb: -2 } as Record<string, Alter>)[acc ?? ''] ?? 0;
}

/** Key string in VexFlow format, e.g. "c#/4". */
export function toVexKey(p: Pitch): string {
  return `${p.step.toLowerCase()}${ACCIDENTAL_ID[p.alter]}/${p.octave}`;
}

export function samePitchClass(a: PitchClass, b: PitchClass): boolean {
  return a.step === b.step && a.alter === b.alter;
}

/** Semitone class 0–11 of a (spelled) pitch class. */
export function chroma(p: PitchClass): number {
  return (((STEP_SEMITONES[p.step] + p.alter) % 12) + 12) % 12;
}

const GERMAN_BASE: Record<Step, string> = { C: 'C', D: 'D', E: 'E', F: 'F', G: 'G', A: 'A', B: 'H' };

/** German flat names, which are irregular for E, A and B (H). */
const GERMAN_FLAT: Record<Step, string> = { C: 'Ces', D: 'Des', E: 'Es', F: 'Fes', G: 'Ges', A: 'As', B: 'B' };
const GERMAN_DOUBLE_FLAT: Record<Step, string> = {
  C: 'Ceses', D: 'Deses', E: 'Eses', F: 'Feses', G: 'Geses', A: 'Asas', B: 'Heses',
};

/** German note name: C, Cis, Cisis, Des, Es, As, H, B, Heses … */
export function germanPitchClassName(p: PitchClass): string {
  switch (p.alter) {
    case 0: return GERMAN_BASE[p.step];
    case 1: return `${GERMAN_BASE[p.step]}is`;
    case 2: return `${GERMAN_BASE[p.step]}isis`;
    case -1: return GERMAN_FLAT[p.step];
    case -2: return GERMAN_DOUBLE_FLAT[p.step];
  }
}

/** German note name, optionally with octave number: "Cis4", "B3". */
export function germanName(p: Pitch, withOctave = true): string {
  const name = germanPitchClassName(p);
  return withOctave ? `${name}${p.octave}` : name;
}

const ENGLISH_ACCIDENTAL: Record<Alter, string> = { [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪' };

/** English name with typographic accidentals, as used in chord symbols: "B♭", "F♯". */
export function englishPitchClassName(p: PitchClass): string {
  return `${p.step}${ENGLISH_ACCIDENTAL[p.alter]}`;
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
