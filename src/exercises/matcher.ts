import { toMidi } from '../core/pitch';
import type { NoteEvent } from '../input/types';
import type { TaskStep } from './types';

export type StepResult =
  | { status: 'pending' }
  | { status: 'correct'; time: number }
  | {
      status: 'wrong';
      time: number;
      reason: 'wrong-note' | 'timeout';
      /** Everything held at the moment of the mistake, including the wrong key. */
      played: number[];
      /** Expected notes that were not (yet) held. */
      missing: number[];
      /** Played notes that are not part of the step. */
      extra: number[];
    };

/**
 * Decides whether incoming notes answer one task step. A step is solved once all
 * its pitches are held at the same time (exact octave); any other key is wrong.
 * For a single note the first key press decides. With a time window, all notes
 * of a multi-note step must be struck within `windowMs` of the first one.
 */
export class StepMatcher {
  private expected: Set<number>;
  private held = new Set<number>();
  private firstOn: number | null = null;

  constructor(step: TaskStep, private windowMs = 0) {
    this.expected = new Set(step.pitches.map(toMidi));
  }

  expectedMidi(): number[] {
    return [...this.expected].sort((a, b) => a - b);
  }

  /** Time by which the step must be complete, or null if no window is running. */
  deadline(): number | null {
    if (this.windowMs <= 0 || this.expected.size < 2 || this.firstOn === null) return null;
    return this.firstOn + this.windowMs;
  }

  handle(event: NoteEvent): StepResult {
    if (event.type === 'off') {
      this.held.delete(event.midi);
      if (this.held.size === 0) this.firstOn = null;
      return { status: 'pending' };
    }
    if (!this.expected.has(event.midi)) {
      const played = [...this.held, event.midi].sort((a, b) => a - b);
      return { status: 'wrong', reason: 'wrong-note', time: event.time, ...this.diff(played) };
    }
    if (this.held.size === 0) this.firstOn = event.time;
    this.held.add(event.midi);
    for (const m of this.expected) if (!this.held.has(m)) return { status: 'pending' };
    return { status: 'correct', time: event.time };
  }

  /** Called when the deadline has passed without the step being completed. */
  expire(now: number): StepResult {
    const played = [...this.held].sort((a, b) => a - b);
    return { status: 'wrong', reason: 'timeout', time: now, ...this.diff(played) };
  }

  private diff(played: number[]): { played: number[]; missing: number[]; extra: number[] } {
    return {
      played,
      missing: this.expectedMidi().filter((m) => !played.includes(m)),
      extra: played.filter((m) => !this.expected.has(m)),
    };
  }
}
