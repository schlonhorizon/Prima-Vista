import { CLEFS, type Clef } from './core/clef';
import { parsePitchId, toMidi } from './core/pitch';
import type { AccidentalMode, PitchRange } from './core/range';
import type { KeyValueStorage } from './core/storage';

export interface Settings {
  clef: Clef;
  /** Pitch ids, e.g. "C4" */
  rangeLow: string;
  rangeHigh: string;
  accidentals: AccidentalMode;
  showNoteNames: boolean;
  showComputerKeys: boolean;
}

const STORAGE_KEY = 'notenleser.settings.v1';
const ACCIDENTAL_MODES: readonly AccidentalMode[] = ['none', 'sharps', 'flats', 'both'];

export function defaultSettings(): Settings {
  return {
    clef: 'treble',
    rangeLow: CLEFS.treble.defaultLow,
    rangeHigh: CLEFS.treble.defaultHigh,
    accidentals: 'none',
    showNoteNames: false,
    showComputerKeys: true,
  };
}

export function loadSettings(storage: KeyValueStorage): Settings {
  const defaults = defaultSettings();
  try {
    const raw = storage.get(STORAGE_KEY);
    if (!raw) return defaults;
    const s = { ...defaults, ...(JSON.parse(raw) as Partial<Settings>) };
    if (!(s.clef in CLEFS)) s.clef = defaults.clef;
    if (!ACCIDENTAL_MODES.includes(s.accidentals)) s.accidentals = defaults.accidentals;
    const low = parsePitchId(s.rangeLow);
    const high = parsePitchId(s.rangeHigh);
    if (!low || !high || toMidi(low) >= toMidi(high)) {
      s.rangeLow = CLEFS[s.clef].defaultLow;
      s.rangeHigh = CLEFS[s.clef].defaultHigh;
    }
    s.showNoteNames = Boolean(s.showNoteNames);
    s.showComputerKeys = Boolean(s.showComputerKeys);
    return s;
  } catch {
    return defaults;
  }
}

export function saveSettings(storage: KeyValueStorage, settings: Settings): void {
  storage.set(STORAGE_KEY, JSON.stringify(settings));
}

export function settingsRange(settings: Settings): PitchRange {
  return { low: parsePitchId(settings.rangeLow)!, high: parsePitchId(settings.rangeHigh)! };
}
