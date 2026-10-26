import { StepMatcher, type StepResult } from '../exercises/matcher';
import { taskPitches, type Exercise, type Task } from '../exercises/types';
import { toMidi } from '../core/pitch';
import type { InputHub } from '../input/inputHub';
import type { NoteEvent } from '../input/types';
import type { StatsStore } from '../stats/statsStore';

export interface TaskResult {
  readonly task: Task;
  readonly correct: boolean;
  /** Reaction time in ms, null if implausibly long (user was away). */
  readonly reactionMs: number | null;
  /** Wrong answers: what was played, what was missing, what was too much (MIDI). */
  readonly played: readonly number[];
  readonly missing: readonly number[];
  readonly extra: readonly number[];
  readonly timeout: boolean;
  /** All MIDI notes of the task (for highlighting the solution). */
  readonly expected: readonly number[];
  /** Text of a choice answer, e.g. "D-Dur / h-Moll". */
  readonly answerText?: string;
  /** A tip was shown before the answer. */
  readonly assisted: boolean;
  /** The task was skipped; the solution is shown, nothing counts as a mistake. */
  readonly skipped: boolean;
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

const DEFAULT_TIMING: TrainerTiming = { afterCorrectMs: 650, afterWrongMs: 2400, maxReactionMs: 20000 };

/**
 * Runs the practice loop: shows a task, matches input against it step by step
 * (or receives a choice answer), records the result and moves on.
 */
export class Trainer {
  private task: Task | null = null;
  private stepIndex = 0;
  private matcher: StepMatcher | null = null;
  private startedAt = 0;
  private waiting = false;
  /** Waiting after an answer and not advancing until resume() (e.g. explanation open). */
  private held = false;
  private assisted = false;
  private timingValid = true;
  private nextTimer: number | undefined;
  private windowTimer: number | undefined;
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

  isWaiting(): boolean {
    return this.waiting;
  }

  isHeld(): boolean {
    return this.held;
  }

  /** Marks the running task as answered with help (a tip was shown). */
  markAssisted(): void {
    if (this.task && !this.waiting) this.assisted = true;
  }

  /** The reaction time of the running task will not be recorded (e.g. a lesson was read). */
  invalidateTiming(): void {
    if (this.task && !this.waiting) this.timingValid = false;
  }

  /** Stops the automatic advance after an answer. Returns false if no answer is pending. */
  hold(): boolean {
    if (!this.waiting) return false;
    window.clearTimeout(this.nextTimer);
    this.held = true;
    return true;
  }

  /** Continues after hold(). */
  resume(): void {
    if (this.held) this.next();
  }

  setExercise(exercise: Exercise): void {
    this.exercise = exercise;
    this.next();
  }

  /** Shows a new task immediately (also used after settings changes). */
  next(): void {
    window.clearTimeout(this.nextTimer);
    window.clearTimeout(this.windowTimer);
    this.task = this.exercise.nextTask();
    this.stepIndex = 0;
    this.matcher = this.task.steps.length > 0 ? this.newMatcher() : null;
    this.waiting = false;
    this.held = false;
    this.assisted = false;
    this.timingValid = true;
    this.callbacks.onTask(this.task);
    this.startedAt = performance.now();
    // Start timing when the task is actually on screen.
    requestAnimationFrame(() => {
      this.startedAt = performance.now();
    });
  }

  /** Skips the running task: records it as skipped and shows the solution. */
  skip(): void {
    const task = this.task;
    if (!task || this.waiting || task.message) return;
    this.waiting = true;
    window.clearTimeout(this.windowTimer);
    for (const key of task.statsKeys ?? [task.itemKey]) this.stats.record(key, { ok: false, ms: null, skipped: true });
    this.callbacks.onResult({
      task,
      correct: false,
      reactionMs: null,
      expected: taskPitches(task).map(toMidi),
      played: [],
      missing: [],
      extra: [],
      timeout: false,
      assisted: this.assisted,
      skipped: true,
    });
    if (!this.held) this.nextTimer = window.setTimeout(() => this.next(), this.timing.afterWrongMs);
  }

  /**
   * Result of a performed task (rhythm): the exercise UI evaluates the timing and
   * reports one record per element (pattern). The trainer then waits until resume().
   */
  answerPerformance(
    correct: boolean,
    records: readonly { key: string; ok: boolean; ms: number | null }[],
    answerText: string,
  ): void {
    const task = this.task;
    if (!task || task.answer !== 'perform' || this.waiting) return;
    this.waiting = true;
    this.held = true;
    for (const r of records) this.stats.record(r.key, { ok: r.ok, ms: r.ms, assisted: this.assisted });
    this.callbacks.onResult({
      task,
      correct,
      reactionMs: null,
      expected: [],
      played: [],
      missing: [],
      extra: [],
      timeout: false,
      assisted: this.assisted,
      skipped: false,
      answerText,
    });
  }

  /** Answer for choice tasks (e.g. key recognition). */
  answerChoice(correct: boolean, answerText: string): void {
    if (!this.task || this.task.answer !== 'choice' || this.waiting) return;
    this.finish(correct, performance.now(), { played: [], missing: [], extra: [], timeout: false, answerText });
  }

  private newMatcher(): StepMatcher {
    return new StepMatcher(this.task!.steps[this.stepIndex], this.task!.chordWindowMs ?? 0);
  }

  private onNote = (event: NoteEvent): void => {
    // While held, any key on the piano continues – handy without a computer keyboard.
    // Performed tasks (rhythm) handle continuing themselves (taps would race).
    if (this.held && event.type === 'on' && this.task?.answer !== 'perform') {
      this.resume();
      return;
    }
    if (!this.task || this.task.answer !== 'play' || !this.matcher || this.waiting) return;
    this.handleResult(this.matcher.handle(event));
  };

  private handleResult(result: StepResult): void {
    window.clearTimeout(this.windowTimer);
    if (result.status === 'pending') {
      const deadline = this.matcher!.deadline();
      if (deadline !== null) {
        const matcher = this.matcher!;
        this.windowTimer = window.setTimeout(() => {
          if (this.matcher === matcher && !this.waiting) this.handleResult(matcher.expire(performance.now()));
        }, Math.max(0, deadline - performance.now()));
      }
      return;
    }
    if (result.status === 'correct' && this.stepIndex < this.task!.steps.length - 1) {
      this.stepIndex++;
      this.matcher = this.newMatcher();
      return;
    }
    if (result.status === 'correct') {
      this.finish(true, result.time, { played: [], missing: [], extra: [], timeout: false });
    } else {
      this.finish(false, result.time, {
        played: result.played,
        missing: result.missing,
        extra: result.extra,
        timeout: result.reason === 'timeout',
      });
    }
  }

  private finish(
    correct: boolean,
    eventTime: number,
    details: Pick<TaskResult, 'played' | 'missing' | 'extra' | 'timeout' | 'answerText'>,
  ): void {
    const task = this.task!;
    const now = performance.now();
    // Guard against event timestamps from a different time base.
    const time = eventTime >= this.startedAt - 1000 && eventTime <= now + 1000 ? eventTime : now;
    const elapsed = Math.max(0, time - this.startedAt);
    const reactionMs = this.timingValid && elapsed <= this.timing.maxReactionMs ? Math.round(elapsed) : null;

    this.waiting = true;
    window.clearTimeout(this.windowTimer);
    this.stats.record(task.itemKey, { ok: correct, ms: reactionMs, played: details.played, assisted: this.assisted });
    this.callbacks.onResult({
      task,
      correct,
      reactionMs,
      assisted: this.assisted,
      skipped: false,
      expected: taskPitches(task).map(toMidi),
      ...details,
    });
    // onResult may already have held the trainer (explanation shown automatically).
    if (!this.held) {
      this.nextTimer = window.setTimeout(
        () => this.next(),
        correct ? this.timing.afterCorrectMs : this.timing.afterWrongMs,
      );
    }
  }
}
