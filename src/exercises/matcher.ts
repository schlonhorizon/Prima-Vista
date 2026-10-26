import { toMidi } from '../core/pitch';
import type { NoteEvent } from '../input/types';
import type { TaskStep } from './types';

export type StepResult =
  | { status: 'pending' }
  | { status: 'correct'; time: number }
  | { status: 'wrong'; played: number[]; time: number };

/**
 * Decides whether incoming notes answer one task step. A step is solved once all
 * its pitches are held at the same time (exact octave); any other key is wrong.
 * For a single note the first key press decides.
 */
export class StepMatcher {
  private expected: Set<number>;
  private held = new Set<number>();

  constructor(step: TaskStep) {
    this.expected = new Set(step.pitches.map(toMidi));
  }

  expectedMidi(): number[] {
    return [...this.expected].sort((a, b) => a - b);
  }

  handle(event: NoteEvent): StepResult {
    if (event.type === 'off') {
      this.held.delete(event.midi);
      return { status: 'pending' };
    }
    if (!this.expected.has(event.midi)) {
      return { status: 'wrong', played: [...this.held, event.midi], time: event.time };
    }
    this.held.add(event.midi);
    for (const m of this.expected) if (!this.held.has(m)) return { status: 'pending' };
    return { status: 'correct', time: event.time };
  }
}
