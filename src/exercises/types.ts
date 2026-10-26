import type { Clef } from '../core/clef';
import type { Pitch } from '../core/pitch';

/**
 * One thing the player has to play. Every exercise type maps onto this shape:
 * - single note:  1 step with 1 pitch
 * - interval:     1 step with 2 pitches (harmonic) or 2 steps (melodic)
 * - chord:        1 step with n pitches
 * - phrase:       n steps, played in order
 */
export interface TaskStep {
  readonly pitches: readonly Pitch[];
}

export interface Task {
  readonly exerciseId: string;
  readonly clef: Clef;
  readonly steps: readonly TaskStep[];
  /** Statistics key for this item, e.g. "note|treble|C4". */
  readonly itemKey: string;
  /** Human-readable answer, e.g. "C4" or "C-Dur". */
  readonly label: string;
}

export interface Exercise {
  readonly id: string;
  readonly name: string;
  nextTask(): Task;
}
