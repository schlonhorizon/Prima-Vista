import { displayableRange, STAFF_MODES, type StaffMode } from './core/notation';
import { parsePitchId, toMidi, type Pitch } from './core/pitch';
import { findPreset } from './core/presets';
import type { AccidentalMode, PitchRange } from './core/range';
import type { KeyValueStorage } from './core/storage';
import { DEFAULT_REGISTER_WEIGHTING, type RegisterWeighting } from './core/weighting';

export const MANUAL_RANGE = 'manual';

/** Range setting of one staff mode: a preset id or "manual" with its own bounds. */
export interface ModeRange {
  preset: string;
  /** Pitch ids of the manual range, e.g. "C4" */
  low: string;
  high: string;
}

export interface Settings {
  mode: StaffMode;
  ranges: Record<StaffMode, ModeRange>;
  accidentals: AccidentalMode;
  weighting: RegisterWeighting;
  showNoteNames: boolean;
  showComputerKeys: boolean;
}

const STORAGE_KEY = 'prima-vista.settings.v1';
const ACCIDENTAL_MODES: readonly AccidentalMode[] = ['none', 'sharps', 'flats', 'both'];

export function defaultSettings(): Settings {
  return {
    mode: 'treble',
    ranges: {
      treble: { preset: MANUAL_RANGE, low: 'C4', high: 'G5' },
      bass: { preset: MANUAL_RANGE, low: 'F2', high: 'C4' },
      grand: { preset: 'nord88', low: 'C2', high: 'C6' },
    },
    accidentals: 'none',
    weighting: { ...DEFAULT_REGISTER_WEIGHTING },
    showNoteNames: false,
    showComputerKeys: true,
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

/** Validates stored settings and migrates the step-1 format (clef/rangeLow/rangeHigh). */
export function sanitize(raw: Record<string, unknown>): Settings {
  const d = defaultSettings();
  const s: Settings = {
    mode: typeof raw.mode === 'string' && raw.mode in STAFF_MODES ? (raw.mode as StaffMode) : d.mode,
    ranges: { ...d.ranges },
    accidentals: ACCIDENTAL_MODES.includes(raw.accidentals as AccidentalMode)
      ? (raw.accidentals as AccidentalMode)
      : d.accidentals,
    weighting: { ...d.weighting },
    showNoteNames: typeof raw.showNoteNames === 'boolean' ? raw.showNoteNames : d.showNoteNames,
    showComputerKeys: typeof raw.showComputerKeys === 'boolean' ? raw.showComputerKeys : d.showComputerKeys,
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

function validPair(low: string, high: string, allowEqual = false): boolean {
  const l = parsePitchId(low);
  const h = parsePitchId(high);
  if (!l || !h) return false;
  return allowEqual ? toMidi(l) <= toMidi(h) : toMidi(l) < toMidi(h);
}

/** The practice range of the current mode, clipped to what the mode can display. */
export function effectiveRange(settings: Settings, mode: StaffMode = settings.mode): PitchRange {
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
