import { displayableRange, STAFF_MODES, type StaffMode } from './core/notation';
import { parsePitchId, toMidi, type Pitch } from './core/pitch';
import { findPreset } from './core/presets';
import type { AccidentalMode, PitchRange } from './core/range';
import type { KeyValueStorage } from './core/storage';
import { DEFAULT_REGISTER_WEIGHTING, type RegisterWeighting } from './core/weighting';
import { isReadyMode, type PracticeModeId } from './modes';
import { MAX_FIFTHS, parseKeyId } from './theory/key';

export const MANUAL_RANGE = 'manual';

/** Range setting of one staff mode: a preset id or "manual" with its own bounds. */
export interface ModeRange {
  preset: string;
  /** Pitch ids of the manual range, e.g. "C4" */
  low: string;
  high: string;
}

export const RANDOM_KEY = 'random';

/** Key used by key-based exercises (intervals, chords …). */
export interface KeySettings {
  /** A key id such as "Eb-major", or "random". */
  choice: string;
  /** Random keys use at most this many accidentals (0–7). */
  maxAccidentals: number;
  includeMinor: boolean;
  /** A random key changes after this many tasks. */
  changeEvery: number;
}

export type IntervalScope = 'key' | 'chromatic';
export type IntervalDirection = 'up' | 'down' | 'both';
export type IntervalPresentation = 'melodic' | 'harmonic' | 'mixed';

/** Interval types offered in the settings; "TT" = tritone (augmented fourth or diminished fifth). */
export const STANDARD_INTERVALS = ['m2', 'M2', 'm3', 'M3', 'P4', 'TT', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'] as const;
export type StandardInterval = (typeof STANDARD_INTERVALS)[number];

export interface IntervalSettings {
  scope: IntervalScope;
  allowed: StandardInterval[];
  direction: IntervalDirection;
  presentation: IntervalPresentation;
}

export type ChordKinds = 'triads' | 'sevenths' | 'both';

export interface ChordSettings {
  kinds: ChordKinds;
  /** 0 = root position, 1–3 = inversions (3 only for seventh chords). */
  inversions: number[];
  /** Scale degrees 1–7. */
  degrees: number[];
}

export interface KeyQuizSettings {
  /** Signatures with at most this many accidentals (0–7). */
  maxAccidentals: number;
  /** Show the circle of fifths as a help. */
  showCircle: boolean;
}

export interface Settings {
  practice: PracticeModeId;
  staff: StaffMode;
  ranges: Record<StaffMode, ModeRange>;
  /** Accidentals in the single-note exercise. */
  accidentals: AccidentalMode;
  weighting: RegisterWeighting;
  key: KeySettings;
  intervals: IntervalSettings;
  chords: ChordSettings;
  keyQuiz: KeyQuizSettings;
  showNoteNames: boolean;
  showComputerKeys: boolean;
  /** On-screen keyboard: select keys and confirm for tasks with several notes. */
  selectionMode: boolean;
  /** All notes of a chord must be struck within this many ms (0 = no limit). */
  chordWindowMs: number;
}

const STORAGE_KEY = 'prima-vista.settings.v1';
const ACCIDENTAL_MODES: readonly AccidentalMode[] = ['none', 'sharps', 'flats', 'both'];

export function defaultSettings(): Settings {
  return {
    practice: 'notes',
    staff: 'treble',
    ranges: {
      treble: { preset: MANUAL_RANGE, low: 'C4', high: 'G5' },
      bass: { preset: MANUAL_RANGE, low: 'F2', high: 'C4' },
      grand: { preset: 'nord88', low: 'C2', high: 'C6' },
    },
    accidentals: 'none',
    weighting: { ...DEFAULT_REGISTER_WEIGHTING },
    key: { choice: RANDOM_KEY, maxAccidentals: 4, includeMinor: true, changeEvery: 8 },
    intervals: {
      scope: 'key',
      allowed: [...STANDARD_INTERVALS],
      direction: 'both',
      presentation: 'mixed',
    },
    chords: { kinds: 'triads', inversions: [0, 1, 2, 3], degrees: [1, 2, 3, 4, 5, 6, 7] },
    keyQuiz: { maxAccidentals: 7, showCircle: true },
    showNoteNames: false,
    showComputerKeys: true,
    selectionMode: true,
    chordWindowMs: 800,
  };
}

export function loadSettings(storage: KeyValueStorage): Settings {
  try {
    const raw = storage.get(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw) as Record<string, unknown>) : defaultSettings();
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(storage: KeyValueStorage, settings: Settings): void {
  storage.set(STORAGE_KEY, JSON.stringify(settings));
}

/**
 * Validates stored settings and migrates older formats: step 1 (clef/rangeLow/rangeHigh)
 * and step 2, where the staff system was stored as "mode".
 */
export function sanitize(raw: Record<string, unknown>): Settings {
  const d = defaultSettings();
  const staff = raw.staff ?? raw.mode;
  const s: Settings = {
    practice: isReadyMode(raw.practice) ? raw.practice : d.practice,
    staff: typeof staff === 'string' && staff in STAFF_MODES ? (staff as StaffMode) : d.staff,
    ranges: { ...d.ranges },
    accidentals: ACCIDENTAL_MODES.includes(raw.accidentals as AccidentalMode)
      ? (raw.accidentals as AccidentalMode)
      : d.accidentals,
    weighting: { ...d.weighting },
    key: sanitizeKey(raw.key, d.key),
    intervals: sanitizeIntervals(raw.intervals, d.intervals),
    chords: sanitizeChords(raw.chords, d.chords),
    keyQuiz: sanitizeKeyQuiz(raw.keyQuiz, d.keyQuiz),
    showNoteNames: bool(raw.showNoteNames, d.showNoteNames),
    showComputerKeys: bool(raw.showComputerKeys, d.showComputerKeys),
    selectionMode: bool(raw.selectionMode, d.selectionMode),
    chordWindowMs: int(raw.chordWindowMs, 0, 5000, d.chordWindowMs),
  };

  const rawRanges = (raw.ranges ?? {}) as Partial<Record<StaffMode, Partial<ModeRange>>>;
  if (!raw.ranges && typeof raw.rangeLow === 'string' && typeof raw.rangeHigh === 'string') {
    rawRanges.treble = { preset: MANUAL_RANGE, low: raw.rangeLow, high: raw.rangeHigh };
  }
  for (const mode of Object.keys(STAFF_MODES) as StaffMode[]) {
    const r = rawRanges[mode];
    if (!r) continue;
    const candidate = {
      preset: typeof r.preset === 'string' && (r.preset === MANUAL_RANGE || findPreset(r.preset)) ? r.preset : d.ranges[mode].preset,
      low: typeof r.low === 'string' ? r.low : '',
      high: typeof r.high === 'string' ? r.high : '',
    };
    if (!validPair(candidate.low, candidate.high)) {
      candidate.low = d.ranges[mode].low;
      candidate.high = d.ranges[mode].high;
    }
    s.ranges[mode] = candidate;
  }

  const w = (raw.weighting ?? {}) as Partial<RegisterWeighting>;
  if (typeof w.coreLow === 'string' && typeof w.coreHigh === 'string' && validPair(w.coreLow, w.coreHigh, true)) {
    s.weighting.coreLow = w.coreLow;
    s.weighting.coreHigh = w.coreHigh;
  }
  if (typeof w.decayPerOctave === 'number' && w.decayPerOctave >= 0 && w.decayPerOctave <= 1) {
    s.weighting.decayPerOctave = w.decayPerOctave;
  }
  return s;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function int(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : fallback;
}

function oneOf<T extends string>(v: unknown, options: readonly T[], fallback: T): T {
  return options.includes(v as T) ? (v as T) : fallback;
}

function sanitizeKey(raw: unknown, d: KeySettings): KeySettings {
  const r = (raw ?? {}) as Partial<KeySettings>;
  return {
    choice: r.choice === RANDOM_KEY || (typeof r.choice === 'string' && parseKeyId(r.choice)) ? r.choice : d.choice,
    maxAccidentals: int(r.maxAccidentals, 0, MAX_FIFTHS, d.maxAccidentals),
    includeMinor: bool(r.includeMinor, d.includeMinor),
    changeEvery: int(r.changeEvery, 1, 1000, d.changeEvery),
  };
}

function sanitizeIntervals(raw: unknown, d: IntervalSettings): IntervalSettings {
  const r = (raw ?? {}) as Partial<IntervalSettings>;
  const allowed = Array.isArray(r.allowed) ? r.allowed.filter((a) => STANDARD_INTERVALS.includes(a)) : [];
  return {
    scope: oneOf(r.scope, ['key', 'chromatic'], d.scope),
    allowed: allowed.length > 0 ? STANDARD_INTERVALS.filter((i) => allowed.includes(i)) : [...d.allowed],
    direction: oneOf(r.direction, ['up', 'down', 'both'], d.direction),
    presentation: oneOf(r.presentation, ['melodic', 'harmonic', 'mixed'], d.presentation),
  };
}

function intList(v: unknown, min: number, max: number, fallback: number[]): number[] {
  if (!Array.isArray(v)) return [...fallback];
  const list = [...new Set(v.filter((x): x is number => Number.isInteger(x) && x >= min && x <= max))].sort();
  return list.length > 0 ? list : [...fallback];
}

function sanitizeChords(raw: unknown, d: ChordSettings): ChordSettings {
  const r = (raw ?? {}) as Partial<ChordSettings>;
  return {
    kinds: oneOf(r.kinds, ['triads', 'sevenths', 'both'], d.kinds),
    inversions: intList(r.inversions, 0, 3, d.inversions),
    degrees: intList(r.degrees, 1, 7, d.degrees),
  };
}

function sanitizeKeyQuiz(raw: unknown, d: KeyQuizSettings): KeyQuizSettings {
  const r = (raw ?? {}) as Partial<KeyQuizSettings>;
  return {
    maxAccidentals: int(r.maxAccidentals, 0, MAX_FIFTHS, d.maxAccidentals),
    showCircle: bool(r.showCircle, d.showCircle),
  };
}

function validPair(low: string, high: string, allowEqual = false): boolean {
  const l = parsePitchId(low);
  const h = parsePitchId(high);
  if (!l || !h) return false;
  return allowEqual ? toMidi(l) <= toMidi(h) : toMidi(l) < toMidi(h);
}

/** The practice range of the current mode, clipped to what the mode can display. */
export function effectiveRange(settings: Settings, mode: StaffMode = settings.staff): PitchRange {
  const r = settings.ranges[mode];
  const preset = r.preset === MANUAL_RANGE ? undefined : findPreset(r.preset);
  const low = parsePitchId(preset?.low ?? r.low)!;
  const high = parsePitchId(preset?.high ?? r.high)!;
  const limits = displayableRange(mode);
  return { low: maxPitch(low, limits.low), high: minPitch(high, limits.high) };
}

function maxPitch(a: Pitch, b: Pitch): Pitch {
  return toMidi(a) >= toMidi(b) ? a : b;
}

function minPitch(a: Pitch, b: Pitch): Pitch {
  return toMidi(a) <= toMidi(b) ? a : b;
}
