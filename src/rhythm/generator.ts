import type { Candidate, ItemSelector } from '../exercises/selection';
import { RHYTHM_CELLS, rhythmItemKey, type RhythmCell } from './cells';
import { eventBeats, type RhythmEvent } from './events';

export const BEATS_PER_BAR = 4;

/** A cell placed in a bar. */
export interface PlacedCell {
  readonly cell: RhythmCell;
  readonly bar: number;
  /** Start beat within the bar (0-based). */
  readonly beat: number;
}

export interface RhythmPattern {
  readonly beatsPerBar: number;
  readonly cells: readonly PlacedCell[];
}

/** Events of each bar, in order. */
export function patternBars(pattern: RhythmPattern, bars: number): RhythmEvent[][] {
  const result: RhythmEvent[][] = Array.from({ length: bars }, () => []);
  for (const placed of pattern.cells) result[placed.bar].push(...placed.cell.events);
  return result;
}

export function barCount(pattern: RhythmPattern): number {
  return pattern.cells.reduce((max, c) => Math.max(max, c.bar + 1), 0);
}

/**
 * Builds a rhythm of `bars` 4/4 bars from the cells up to `level`. Cells of the
 * highest level are weighted double so the new material shows up often.
 */
export function generateRhythm(level: number, bars: number, selector: ItemSelector): RhythmPattern {
  for (let attempt = 0; attempt < 20; attempt++) {
    const cells: PlacedCell[] = [];
    for (let bar = 0; bar < bars; bar++) {
      let beat = 0;
      while (beat < BEATS_PER_BAR - 1e-9) {
        const candidates: Candidate<RhythmCell>[] = RHYTHM_CELLS.filter(
          (c) => c.level <= level && c.starts.includes(beat) && beat + c.beats <= BEATS_PER_BAR + 1e-9,
        ).map((c) => ({ item: c, key: rhythmItemKey(c.id), baseWeight: c.level === level ? 2 : 1 }));
        const cell = selector.pick(candidates);
        cells.push({ cell, bar, beat });
        beat += cell.beats;
      }
    }
    // Every bar needs at least one note to play.
    const barsWithNotes = new Set(cells.filter((c) => c.cell.events.some((e) => !e.rest)).map((c) => c.bar));
    if (barsWithNotes.size === bars) return { beatsPerBar: BEATS_PER_BAR, cells };
  }
  // Fallback: plain quarters
  const quarter = RHYTHM_CELLS.find((c) => c.id === 'quarter')!;
  const cells: PlacedCell[] = [];
  for (let bar = 0; bar < bars; bar++) for (let beat = 0; beat < 4; beat++) cells.push({ cell: quarter, bar, beat });
  return { beatsPerBar: BEATS_PER_BAR, cells };
}

/** Played notes (no rests) with onset in beats from the start and their cell index. */
export function expectedNotes(pattern: RhythmPattern): { beat: number; cellIndex: number }[] {
  const notes: { beat: number; cellIndex: number }[] = [];
  pattern.cells.forEach((placed, cellIndex) => {
    let pos = placed.bar * pattern.beatsPerBar + placed.beat;
    for (const e of placed.cell.events) {
      if (!e.rest) notes.push({ beat: Math.round(pos * 1e6) / 1e6, cellIndex });
      pos += eventBeats(e);
    }
  });
  return notes;
}
