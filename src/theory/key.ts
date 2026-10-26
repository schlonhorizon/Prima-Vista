import {
  germanPitchClassName,
  parsePitchClassId,
  pitchClassId,
  samePitchClass,
  type Alter,
  type PitchClass,
  type Step,
} from '../core/pitch';
import { interval, transposePitchClass } from './interval';

export type KeyMode = 'major' | 'minor';

export interface Key {
  readonly tonic: PitchClass;
  readonly mode: KeyMode;
}

export const MIN_FIFTHS = -7;
export const MAX_FIFTHS = 7;

const P5 = interval('P5');
const M2 = interval('M2');
const m3 = interval('m3');
const M3 = interval('M3');
const P4 = interval('P4');
const M6 = interval('M6');
const M7 = interval('M7');
const m6 = interval('m6');
const m7 = interval('m7');

const SHARP_ORDER: readonly Step[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER: readonly Step[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

/** Major tonic for a number of fifths (−7 = Ces, 0 = C, 7 = Cis). */
function majorTonic(fifths: number): PitchClass {
  let pc: PitchClass = { step: 'C', alter: 0 };
  for (let i = 0; i < Math.abs(fifths); i++) pc = transposePitchClass(pc, P5, fifths > 0 ? 1 : -1);
  return pc;
}

/** Key with the given signature (−7 … 7 fifths; negative = flats). */
export function keyFromFifths(fifths: number, mode: KeyMode): Key {
  if (!Number.isInteger(fifths) || fifths < MIN_FIFTHS || fifths > MAX_FIFTHS) {
    throw new RangeError(`No key with ${fifths} fifths`);
  }
  const major = majorTonic(fifths);
  return { tonic: mode === 'major' ? major : transposePitchClass(major, m3, -1), mode };
}

/** All 15 major and 15 minor keys, ordered by signature. */
export const ALL_KEYS: readonly Key[] = (['major', 'minor'] as const).flatMap((mode) =>
  Array.from({ length: MAX_FIFTHS - MIN_FIFTHS + 1 }, (_, i) => keyFromFifths(i + MIN_FIFTHS, mode)),
);

export function fifthsOf(key: Key): number {
  for (let f = MIN_FIFTHS; f <= MAX_FIFTHS; f++) {
    if (samePitchClass(keyFromFifths(f, key.mode).tonic, key.tonic)) return f;
  }
  throw new RangeError(`Key ${keyId(key)} needs more than 7 accidentals`);
}

/** Alteration of each letter in the key signature. */
export function keySignature(fifths: number): Record<Step, Alter> {
  const sig: Record<Step, Alter> = { C: 0, D: 0, E: 0, F: 0, G: 0, A: 0, B: 0 };
  const order = fifths >= 0 ? SHARP_ORDER : FLAT_ORDER;
  for (let i = 0; i < Math.abs(fifths); i++) sig[order[i]] = fifths >= 0 ? 1 : -1;
  return sig;
}

export function relativeKey(key: Key): Key {
  return keyFromFifths(fifthsOf(key), key.mode === 'major' ? 'minor' : 'major');
}

export function keyId(key: Key): string {
  return `${pitchClassId(key.tonic)}-${key.mode}`;
}

export function parseKeyId(id: string): Key | null {
  const m = /^([A-G](?:##|#|bb|b)?)-(major|minor)$/.exec(id);
  const tonic = m ? parsePitchClassId(m[1]) : null;
  if (!m || !tonic) return null;
  const key = { tonic, mode: m[2] as KeyMode };
  try {
    fifthsOf(key);
    return key;
  } catch {
    return null;
  }
}

export function sameKey(a: Key, b: Key): boolean {
  return a.mode === b.mode && samePitchClass(a.tonic, b.tonic);
}

/** "Cis-Dur", "es-Moll", "B-Dur", "b-Moll" (German convention: minor in lower case). */
export function germanKeyName(key: Key): string {
  const name = germanPitchClassName(key.tonic);
  return key.mode === 'major' ? `${name}-Dur` : `${name.toLowerCase()}-Moll`;
}

/** Diatonic scale of the key: major, or natural minor. */
export function keyScale(key: Key): PitchClass[] {
  const ivs = key.mode === 'major' ? [M2, M3, P4, P5, M6, M7] : [M2, m3, P4, P5, m6, m7];
  return [key.tonic, ...ivs.map((iv) => transposePitchClass(key.tonic, iv))];
}

/**
 * Scale used to build chords: in minor, degrees V and VII take the raised
 * leading tone from harmonic minor (common practice).
 */
export function chordScale(key: Key, degree: number): PitchClass[] {
  const scale = keyScale(key);
  if (key.mode === 'minor' && (degree === 5 || degree === 7)) scale[6] = transposePitchClass(key.tonic, M7);
  return scale;
}

/** Tones that belong to the key: the scale, plus the raised 7th in minor. */
export function keyTones(key: Key): PitchClass[] {
  const tones = keyScale(key);
  if (key.mode === 'minor') tones.push(transposePitchClass(key.tonic, M7));
  return tones;
}

/** VexFlow key signature name for a number of fifths. */
export function vexKeySpec(fifths: number): string {
  return ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'][fifths - MIN_FIFTHS];
}
