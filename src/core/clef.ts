import { parsePitchId, type Pitch } from './pitch';

export type Clef = 'treble' | 'bass';

export interface ClefInfo {
  readonly id: Clef;
  readonly label: string;
  /** Default practice range. */
  readonly defaultLow: string;
  readonly defaultHigh: string;
  /** Outer limits offered in the range selectors. */
  readonly selectableLow: string;
  readonly selectableHigh: string;
}

export const CLEFS: Record<Clef, ClefInfo> = {
  treble: {
    id: 'treble',
    label: 'Violinschlüssel',
    defaultLow: 'C4',
    defaultHigh: 'G5',
    selectableLow: 'F3',
    selectableHigh: 'C7',
  },
  // Prepared for a later step; not exposed in the UI yet.
  bass: {
    id: 'bass',
    label: 'Bassschlüssel',
    defaultLow: 'F2',
    defaultHigh: 'C4',
    selectableLow: 'C1',
    selectableHigh: 'E4',
  },
};

export function clefPitch(id: string): Pitch {
  const p = parsePitchId(id);
  if (!p) throw new Error(`Invalid pitch id in clef config: ${id}`);
  return p;
}
