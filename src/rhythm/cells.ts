import { barBeats, parseRhythm, type RhythmEvent } from './events';

/**
 * Rhythm patterns ("cells") – the elements a rhythm is built from and the unit of
 * the statistics. Each cell lasts whole beats and may only start on certain beats
 * of the bar (0-based), so the notation stays conventional.
 */
export interface RhythmCell {
  readonly id: string;
  readonly name: string;
  /** Level 1 = Viertel/Halbe … 4 = Triolen/Sechzehntel */
  readonly level: number;
  readonly beats: number;
  readonly events: readonly RhythmEvent[];
  /** Allowed start beats within a 4/4 bar. */
  readonly starts: readonly number[];
}

function cell(id: string, name: string, level: number, rhythm: string, starts?: number[]): RhythmCell {
  const events = parseRhythm(rhythm)[0];
  const rounded = Math.round(barBeats(events) * 1000) / 1000;
  return { id, name, level, beats: rounded, events, starts: starts ?? [0, 1, 2, 3].filter((b) => b + rounded <= 4) };
}

export const RHYTHM_LEVELS: Record<number, string> = {
  1: 'Viertel und Halbe',
  2: 'Achtel und Pausen',
  3: 'Punktierungen und Synkopen',
  4: 'Triolen und Sechzehntel',
};

export const RHYTHM_CELLS: readonly RhythmCell[] = [
  cell('quarter', 'Viertel', 1, 'q'),
  cell('half', 'Halbe', 1, 'h', [0, 2]),
  cell('whole', 'Ganze', 1, 'w', [0]),
  cell('eighths', 'Zwei Achtel', 2, '8 8'),
  cell('quarter-rest', 'Viertelpause', 2, 'qr'),
  cell('half-rest', 'Halbe Pause', 2, 'hr', [0, 2]),
  cell('rest-eighth', 'Achtelpause + Achtel', 2, '8r 8'),
  cell('eighth-rest', 'Achtel + Achtelpause', 2, '8 8r'),
  cell('dotted-quarter-eighth', 'Punktierte Viertel + Achtel', 3, 'qd 8', [0, 2]),
  cell('syncope', 'Synkope (Achtel – Viertel – Achtel)', 3, '8 q 8', [0, 2]),
  cell('dotted-half', 'Punktierte Halbe', 3, 'hd', [0, 1]),
  cell('quarter-half-quarter', 'Synkope (Viertel – Halbe – Viertel)', 3, 'q h q', [0]),
  cell('triplet', 'Achteltriole', 4, '8t 8t 8t'),
  cell('sixteenths', 'Vier Sechzehntel', 4, '16 16 16 16'),
  cell('eighth-sixteenths', 'Achtel + zwei Sechzehntel', 4, '8 16 16'),
  cell('sixteenths-eighth', 'Zwei Sechzehntel + Achtel', 4, '16 16 8'),
  cell('dotted-eighth-sixteenth', 'Punktierte Achtel + Sechzehntel', 4, '8d 16'),
];

export function findCell(id: string): RhythmCell | undefined {
  return RHYTHM_CELLS.find((c) => c.id === id);
}

export function rhythmItemKey(cellId: string): string {
  return `rhythm|${cellId}`;
}
