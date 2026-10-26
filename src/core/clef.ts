import { parsePitchId, type Pitch } from './pitch';

export type Clef = 'treble' | 'bass';

export interface ClefInfo {
  readonly id: Clef;
  readonly label: string;
  /** Diatonic position (see diatonicIndex) of the bottom and top staff line. */
  readonly bottomLine: string;
  readonly topLine: string;
}

export const CLEFS: Record<Clef, ClefInfo> = {
  treble: { id: 'treble', label: 'Violinschlüssel', bottomLine: 'E4', topLine: 'F5' },
  bass: { id: 'bass', label: 'Bassschlüssel', bottomLine: 'G2', topLine: 'A3' },
};

export function clefPitch(id: string): Pitch {
  const p = parsePitchId(id);
  if (!p) throw new Error(`Invalid pitch id: ${id}`);
  return p;
}
