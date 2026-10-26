import type { StaffMode } from '../core/notation';
import type { Pitch } from '../core/pitch';
import type { StatsGroup } from '../stats/statsView';
import type { DiatonicChord } from '../theory/chords';
import type { Interval } from '../theory/interval';
import type { Key } from '../theory/key';

/** What a task is about, in music theory terms – used by tips, explanations and lessons. */
export type TaskInfo =
  | { readonly kind: 'note'; readonly pitch: Pitch }
  | {
      readonly kind: 'interval';
      readonly lower: Pitch;
      readonly upper: Pitch;
      readonly interval: Interval;
      /** Standard id (m2 … P8, TT = tritone) */
      readonly standard: string;
      readonly presentation: 'up' | 'down' | 'harm';
    }
  | { readonly kind: 'chord'; readonly chord: DiatonicChord; readonly inversion: number; readonly pitches: readonly Pitch[] }
  | { readonly kind: 'keysig'; readonly fifths: number };

/**
 * One thing the player has to do. Every exercise type maps onto this shape:
 * - single note:  1 step with 1 pitch
 * - interval:     1 step with 2 pitches (harmonic) or 2 steps (melodic)
 * - chord:        1 step with n pitches
 * - phrase:       n steps, played in order
 * - key quiz:     no steps, answered by choice
 */
export interface TaskStep {
  readonly pitches: readonly Pitch[];
}

export interface Task {
  readonly exerciseId: string;
  /** Staff system the task is shown on; notes are placed per staff by the renderer. */
  readonly layout: StaffMode;
  /** Key whose signature is shown; null = no key (no signature). */
  readonly key: Key | null;
  readonly steps: readonly TaskStep[];
  /** "play" = answered on the piano, "choice" = answered with buttons. */
  readonly answer: 'play' | 'choice';
  /** Statistics key for this item, e.g. "note|treble|C4". */
  readonly itemKey: string;
  /** Human-readable solution, e.g. "C4" or "große Terz aufwärts". */
  readonly label: string;
  /** Additional explanation shown after the answer. */
  readonly detail?: string;
  /** Message shown instead of a task, e.g. when the settings leave nothing to practise. */
  readonly message?: string;
  /** Theory data for the knowledge layer. */
  readonly info?: TaskInfo;
  /**
   * Statistics keys a skip is recorded under; defaults to [itemKey]. Tasks made of
   * several elements (e.g. a rhythm of several patterns) list all of them.
   */
  readonly statsKeys?: readonly string[];
  /** All notes of a step must be struck within this window (ms); 0 = no limit. */
  readonly chordWindowMs?: number;
}

export interface Exercise {
  readonly id: string;
  nextTask(): Task;
  /** Statistics of this exercise, grouped for the table. */
  statsGroups(): StatsGroup[];
}

/** All MIDI notes of a task, in order of appearance. */
export function taskPitches(task: Task): Pitch[] {
  return task.steps.flatMap((s) => s.pitches);
}
