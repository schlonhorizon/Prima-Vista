import { StepMatcher } from '../exercises/matcher';
import type { Exercise, Task } from '../exercises/types';
import type { InputHub } from '../input/inputHub';
import type { NoteEvent } from '../input/types';
import type { StatsStore } from '../stats/statsStore';

export interface TaskResult {
  readonly task: Task;
  readonly correct: boolean;
  /** Reaction time in ms, null if implausibly long (user was away). */
  readonly reactionMs: number | null;
  /** MIDI notes of the wrong answer (empty if correct). */
  readonly played: readonly number[];
  /** Expected MIDI notes of the step that was answered. */
  readonly expected: readonly number[];
}

export interface TrainerCallbacks {
  onTask(task: Task): void;
  onResult(result: TaskResult): void;
}

export interface TrainerTiming {
  /** Pause after a correct answer before the next task. */
  afterCorrectMs: number;
  /** Pause after a wrong answer (time to look at the solution). */
  afterWrongMs: number;
  /** Reaction times above this are not recorded. */
  maxReactionMs: number;
}

const DEFAULT_TIMING: TrainerTiming = { afterCorrectMs: 450, afterWrongMs: 1800, maxReactionMs: 20000 };

/**
 * Runs the practice loop: shows a task, matches input against it step by step,
 * records the result and moves on.
 */
export class Trainer {
  private task: Task | null = null;
  private stepIndex = 0;
  private matcher: StepMatcher | null = null;
  private startedAt = 0;
  private waiting = false;
  private nextTimer: number | undefined;
  private timing: TrainerTiming;

  constructor(
    private exercise: Exercise,
    private hub: InputHub,
    private stats: StatsStore,
    private callbacks: TrainerCallbacks,
    timing: Partial<TrainerTiming> = {},
  ) {
    this.timing = { ...DEFAULT_TIMING, ...timing };
    this.hub.subscribe(this.onNote);
  }

  currentTask(): Task | null {
    return this.task;
  }

  /** Shows a new task immediately (also used after settings changes). */
  next(): void {
    window.clearTimeout(this.nextTimer);
    this.task = this.exercise.nextTask();
    this.stepIndex = 0;
    this.matcher = new StepMatcher(this.task.steps[0]);
    this.waiting = false;
    this.callbacks.onTask(this.task);
    this.startedAt = performance.now();
    // Start timing when the note is actually on screen.
    requestAnimationFrame(() => {
      this.startedAt = performance.now();
    });
  }

  private onNote = (event: NoteEvent): void => {
    if (!this.task || !this.matcher || this.waiting) return;
    const result = this.matcher.handle(event);
    if (result.status === 'pending') return;
    if (result.status === 'correct' && this.stepIndex < this.task.steps.length - 1) {
      this.stepIndex++;
      this.matcher = new StepMatcher(this.task.steps[this.stepIndex]);
      return;
    }
    this.finish(result.status === 'correct', result.status === 'wrong' ? result.played : [], result.time);
  };

  private finish(correct: boolean, played: number[], eventTime: number): void {
    const task = this.task!;
    const now = performance.now();
    // Guard against event timestamps from a different time base.
    const time = eventTime >= this.startedAt - 1000 && eventTime <= now + 1000 ? eventTime : now;
    const elapsed = Math.max(0, time - this.startedAt);
    const reactionMs = elapsed <= this.timing.maxReactionMs ? Math.round(elapsed) : null;
    const expected = this.matcher!.expectedMidi();

    this.waiting = true;
    this.stats.record(task.itemKey, { ok: correct, ms: reactionMs, played });
    this.callbacks.onResult({ task, correct, reactionMs, played, expected });
    this.nextTimer = window.setTimeout(
      () => this.next(),
      correct ? this.timing.afterCorrectMs : this.timing.afterWrongMs,
    );
  }
}
