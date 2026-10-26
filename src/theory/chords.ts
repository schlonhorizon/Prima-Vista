import {
  diatonicIndex,
  englishPitchClassName,
  pitch,
  type Pitch,
  type PitchClass,
} from '../core/pitch';
import { intervalBetween, intervalId } from './interval';
import { chordScale, keyId, type Key } from './key';

export type ChordQuality =
  | 'major' | 'minor' | 'diminished' | 'augmented'
  | 'maj7' | 'min7' | 'dom7' | 'halfdim7' | 'dim7' | 'minmaj7' | 'augmaj7';

/** Intervals above the root → quality. */
const QUALITY_BY_INTERVALS: Record<string, ChordQuality> = {
  'M3,P5': 'major',
  'm3,P5': 'minor',
  'm3,d5': 'diminished',
  'M3,A5': 'augmented',
  'M3,P5,M7': 'maj7',
  'm3,P5,m7': 'min7',
  'M3,P5,m7': 'dom7',
  'm3,d5,m7': 'halfdim7',
  'm3,d5,d7': 'dim7',
  'm3,P5,M7': 'minmaj7',
  'M3,A5,M7': 'augmaj7',
};

const SYMBOL_SUFFIX: Record<ChordQuality, string> = {
  major: '', minor: 'm', diminished: '°', augmented: '+',
  maj7: 'maj7', min7: 'm7', dom7: '7', halfdim7: 'm7♭5', dim7: '°7', minmaj7: 'm(maj7)', augmaj7: '+maj7',
};

const ROMAN_SUFFIX: Record<ChordQuality, string> = {
  major: '', minor: '', diminished: '°', augmented: '+',
  maj7: 'maj7', min7: '7', dom7: '7', halfdim7: 'ø7', dim7: '°7', minmaj7: '(maj7)', augmaj7: '+maj7',
};

const LOWER_CASE: ReadonlySet<ChordQuality> = new Set(['minor', 'diminished', 'min7', 'halfdim7', 'dim7', 'minmaj7']);
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/**
 * Harmonic functions (Riemann/Grabner). Seventh chords keep the triad's function,
 * except the dominant (D⁷) and the leading-tone chord (Dv⁹ = dominant ninth without root).
 */
const FUNCTIONS: Record<Key['mode'], readonly string[]> = {
  major: ['T', 'Sp', 'Dp', 'S', 'D', 'Tp', 'Dv'],
  minor: ['t', 's⁶', 'tP', 's', 'D', 'sP', 'Dv'],
};

export interface DiatonicChord {
  readonly key: Key;
  /** Scale degree 1–7 */
  readonly degree: number;
  readonly seventh: boolean;
  /** Root, third, fifth (, seventh) */
  readonly tones: readonly PitchClass[];
  readonly quality: ChordQuality;
}

/** Number of possible inversions: 3 for triads, 4 for seventh chords. */
export function inversionCount(chord: DiatonicChord): number {
  return chord.tones.length;
}

export function diatonicChord(key: Key, degree: number, seventh: boolean): DiatonicChord {
  if (!Number.isInteger(degree) || degree < 1 || degree > 7) throw new RangeError(`Invalid degree ${degree}`);
  const scale = chordScale(key, degree);
  const count = seventh ? 4 : 3;
  const tones = Array.from({ length: count }, (_, i) => scale[(degree - 1 + 2 * i) % 7]);
  return { key, degree, seventh, tones, quality: chordQuality(tones) };
}

/** Quality of stacked tones (root first). */
export function chordQuality(tones: readonly PitchClass[]): ChordQuality {
  const root = pitch(tones[0].step, tones[0].alter, 4);
  const ids = tones.slice(1).map((t) => {
    let p = pitch(t.step, t.alter, 4);
    while (diatonicIndex(p) <= diatonicIndex(root)) p = pitch(p.step, p.alter, p.octave + 1);
    const iv = intervalBetween(root, p);
    return iv ? intervalId(iv) : '?';
  });
  const quality = QUALITY_BY_INTERVALS[ids.join(',')];
  if (!quality) throw new Error(`Unknown chord structure ${ids.join(',')}`);
  return quality;
}

/** Jazz-style symbol: "Cmaj7", "Dm7", "G7", "Bm7♭5", "F♯°". */
export function chordSymbol(chord: DiatonicChord): string {
  return `${englishPitchClassName(chord.tones[0])}${SYMBOL_SUFFIX[chord.quality]}`;
}

/** Roman numeral: "I", "ii", "V7", "viiø7", "III+", "vii°7". */
export function romanNumeral(chord: DiatonicChord): string {
  const base = ROMAN[chord.degree - 1];
  return `${LOWER_CASE.has(chord.quality) ? base.toLowerCase() : base}${ROMAN_SUFFIX[chord.quality]}`;
}

/** Harmonic function: "T", "Tp", "D⁷", "s" … */
export function chordFunction(chord: DiatonicChord): string {
  const fn = FUNCTIONS[chord.key.mode][chord.degree - 1];
  if (!chord.seventh) return fn;
  if (fn === 'D') return 'D⁷';
  if (fn === 'Dv') return 'Dv⁹';
  return fn;
}

export function inversionName(inversion: number): string {
  return inversion === 0 ? 'Grundstellung' : `${inversion}. Umkehrung`;
}

/**
 * Close-position voicing: the tone of the chosen inversion is the bass at
 * `bassOctave`, every further tone is the next one above.
 */
export function voiceChord(chord: DiatonicChord, inversion: number, bassOctave: number): Pitch[] {
  const n = chord.tones.length;
  if (inversion < 0 || inversion >= n) throw new RangeError(`Invalid inversion ${inversion}`);
  const ordered = Array.from({ length: n }, (_, i) => chord.tones[(inversion + i) % n]);
  const result: Pitch[] = [];
  for (const pc of ordered) {
    let p = pitch(pc.step, pc.alter, result.length === 0 ? bassOctave : result[result.length - 1].octave);
    if (result.length > 0) {
      while (diatonicIndex(p) <= diatonicIndex(result[result.length - 1])) p = pitch(p.step, p.alter, p.octave + 1);
    }
    result.push(p);
  }
  return result;
}

/** Stable id for statistics: "C-major|vi|3|1" (key | numeral | 3 or 7 | inversion). */
export function chordElementId(chord: DiatonicChord, inversion: number): string {
  return `${keyId(chord.key)}|${romanNumeral(chord)}|${chord.seventh ? 7 : 3}|${inversion}`;
}

