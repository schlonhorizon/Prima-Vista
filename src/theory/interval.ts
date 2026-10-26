import { diatonicIndex, fromDiatonicIndex, pitch, toMidi, type Alter, type Pitch, type PitchClass } from '../core/pitch';

/** dd = doubly diminished … AA = doubly augmented */
export type IntervalQuality = 'dd' | 'd' | 'm' | 'P' | 'M' | 'A' | 'AA';

/** A spelled interval: number of letter steps (1 = unison, 8 = octave) and quality. */
export interface Interval {
  readonly number: number;
  readonly quality: IntervalQuality;
}

/** Semitones of the major/perfect form of each simple interval number. */
const BASE_SEMITONES = [0, 2, 4, 5, 7, 9, 11];

function simpleNumber(n: number): number {
  return ((n - 1) % 7) + 1;
}

export function isPerfectType(n: number): boolean {
  return [1, 4, 5].includes(simpleNumber(n));
}

const PERFECT_OFFSETS: Partial<Record<IntervalQuality, number>> = { dd: -2, d: -1, P: 0, A: 1, AA: 2 };
const IMPERFECT_OFFSETS: Partial<Record<IntervalQuality, number>> = { dd: -3, d: -2, m: -1, M: 0, A: 1, AA: 2 };

export function interval(id: string): Interval {
  const iv = parseIntervalId(id);
  if (!iv) throw new Error(`Invalid interval id: ${id}`);
  return iv;
}

export function parseIntervalId(id: string): Interval | null {
  const m = /^(dd|d|m|P|M|AA|A)(\d+)$/.exec(id);
  if (!m) return null;
  const iv = { quality: m[1] as IntervalQuality, number: Number(m[2]) };
  return iv.number >= 1 && intervalSemitonesOrNull(iv) !== null ? iv : null;
}

export function intervalId(iv: Interval): string {
  return `${iv.quality}${iv.number}`;
}

function intervalSemitonesOrNull(iv: Interval): number | null {
  const offsets = isPerfectType(iv.number) ? PERFECT_OFFSETS : IMPERFECT_OFFSETS;
  const offset = offsets[iv.quality];
  if (offset === undefined) return null;
  const octaves = Math.floor((iv.number - 1) / 7);
  return BASE_SEMITONES[simpleNumber(iv.number) - 1] + 12 * octaves + offset;
}

export function semitones(iv: Interval): number {
  const s = intervalSemitonesOrNull(iv);
  if (s === null) throw new Error(`Invalid interval ${iv.quality}${iv.number}`);
  return s;
}

/**
 * Interval from `a` to `b` (b must not be lower than a in letter steps).
 * Returns null for qualities beyond doubly augmented/diminished.
 */
export function intervalBetween(a: Pitch, b: Pitch): Interval | null {
  const number = diatonicIndex(b) - diatonicIndex(a) + 1;
  if (number < 1) return null;
  const actual = toMidi(b) - toMidi(a);
  const base = BASE_SEMITONES[simpleNumber(number) - 1] + 12 * Math.floor((number - 1) / 7);
  const offsets = isPerfectType(number) ? PERFECT_OFFSETS : IMPERFECT_OFFSETS;
  const quality = (Object.keys(offsets) as IntervalQuality[]).find((q) => base + offsets[q]! === actual);
  return quality ? { number, quality } : null;
}

/**
 * Transposes a pitch by a spelled interval: first the letter moves by the
 * interval number, then the accidental is chosen to match the semitone count.
 * This keeps every result enharmonically correct (C# + M3 = E#, not F).
 */
export function transpose(p: Pitch, iv: Interval, direction: 1 | -1 = 1): Pitch {
  const target = fromDiatonicIndex(diatonicIndex(p) + direction * (iv.number - 1));
  const wanted = toMidi(p) + direction * semitones(iv);
  const alter = wanted - toMidi(target);
  if (alter < -2 || alter > 2) {
    throw new RangeError(`Cannot spell ${pitchDescription(p)} ${direction > 0 ? '+' : '-'} ${intervalId(iv)}`);
  }
  return pitch(target.step, alter as Alter, target.octave);
}

/** Like transpose, but returns null instead of throwing for triple accidentals. */
export function tryTranspose(p: Pitch, iv: Interval, direction: 1 | -1 = 1): Pitch | null {
  try {
    return transpose(p, iv, direction);
  } catch {
    return null;
  }
}

export function transposePitchClass(pc: PitchClass, iv: Interval, direction: 1 | -1 = 1): PitchClass {
  const t = transpose(pitch(pc.step, pc.alter, 4), iv, direction);
  return { step: t.step, alter: t.alter };
}

function pitchDescription(p: Pitch): string {
  return `${p.step}${p.alter}/${p.octave}`;
}

const NUMBER_NAMES = ['Prime', 'Sekunde', 'Terz', 'Quarte', 'Quinte', 'Sexte', 'Septime', 'Oktave',
  'None', 'Dezime', 'Undezime', 'Duodezime', 'Tredezime'];
const QUALITY_NAMES: Record<IntervalQuality, string> = {
  dd: 'doppelt verminderte', d: 'verminderte', m: 'kleine', P: 'reine', M: 'große', A: 'übermäßige', AA: 'doppelt übermäßige',
};

/** German name, e.g. "große Terz", "reine Quinte", "übermäßige Quarte". */
export function germanIntervalName(iv: Interval): string {
  const name = NUMBER_NAMES[iv.number - 1] ?? `${iv.number}. Intervall`;
  return `${QUALITY_NAMES[iv.quality]} ${name}`;
}
