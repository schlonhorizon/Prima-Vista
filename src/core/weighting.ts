import { parsePitchId, toMidi } from './pitch';

/**
 * Register weighting: every pitch inside the core zone has base weight 1.
 * Outside, the weight is multiplied by `decayPerOctave` for every (started)
 * octave of distance, e.g. with C2–C6 and 0.5: C1–C2 and C6–C7 → 0.5,
 * further out → 0.25.
 */
export interface RegisterWeighting {
  /** Pitch ids, e.g. "C2" */
  coreLow: string;
  coreHigh: string;
  /** 0…1 */
  decayPerOctave: number;
}

export const DEFAULT_REGISTER_WEIGHTING: RegisterWeighting = {
  coreLow: 'C2',
  coreHigh: 'C6',
  decayPerOctave: 0.5,
};

export function registerWeight(midi: number, weighting: RegisterWeighting): number {
  const low = parsePitchId(weighting.coreLow);
  const high = parsePitchId(weighting.coreHigh);
  if (!low || !high) return 1;
  const lowMidi = toMidi(low);
  const highMidi = toMidi(high);
  const distance = midi < lowMidi ? lowMidi - midi : midi > highMidi ? midi - highMidi : 0;
  if (distance === 0) return 1;
  return Math.pow(weighting.decayPerOctave, Math.ceil(distance / 12));
}
