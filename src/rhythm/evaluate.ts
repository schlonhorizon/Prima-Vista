export type NoteVerdict = 'on' | 'early' | 'late' | 'missed';

export interface NoteResult {
  /** Expected time (ms, performance.now base). */
  readonly expected: number;
  /** Matched tap time, already corrected for input latency. */
  readonly tap: number | null;
  /** tap − expected in ms (negative = early). */
  readonly deviation: number | null;
  readonly verdict: NoteVerdict;
}

export interface RhythmEvaluation {
  readonly notes: readonly NoteResult[];
  /** Taps that belong to no note (too many). */
  readonly extraTaps: readonly number[];
  readonly correct: boolean;
  readonly onTime: number;
  readonly early: number;
  readonly late: number;
  readonly missed: number;
  /** Mean deviation of matched notes (ms, signed: negative = tendency to rush). */
  readonly meanDeviation: number | null;
}

/**
 * Matches taps to expected onsets. Every note owns a window reaching halfway to
 * its neighbours (at most `maxWindowMs`); inside it the closest tap counts. Taps
 * within the tolerance are "on the point", others early or late; unmatched taps
 * are extra. Correct = every note on the point and no extra taps.
 */
export function evaluateRhythm(
  expected: readonly number[],
  taps: readonly number[],
  toleranceMs: number,
  maxWindowMs: number,
): RhythmEvaluation {
  const sortedTaps = [...taps].sort((a, b) => a - b);
  const used = new Set<number>();
  const notes: NoteResult[] = expected.map((time, i) => {
    const before = i > 0 ? (time - expected[i - 1]) / 2 : maxWindowMs;
    const after = i < expected.length - 1 ? (expected[i + 1] - time) / 2 : maxWindowMs;
    const lo = time - Math.max(toleranceMs, Math.min(maxWindowMs, before));
    const hi = time + Math.max(toleranceMs, Math.min(maxWindowMs, after));
    let best = -1;
    sortedTaps.forEach((t, k) => {
      if (used.has(k) || t < lo || t >= hi) return;
      if (best < 0 || Math.abs(t - time) < Math.abs(sortedTaps[best] - time)) best = k;
    });
    if (best < 0) return { expected: time, tap: null, deviation: null, verdict: 'missed' };
    used.add(best);
    const deviation = Math.round(sortedTaps[best] - time);
    const verdict: NoteVerdict = Math.abs(deviation) <= toleranceMs ? 'on' : deviation < 0 ? 'early' : 'late';
    return { expected: time, tap: sortedTaps[best], deviation, verdict };
  });
  const extraTaps = sortedTaps.filter((_, k) => !used.has(k));
  const count = (v: NoteVerdict) => notes.filter((n) => n.verdict === v).length;
  const deviations = notes.filter((n) => n.deviation !== null).map((n) => n.deviation!);
  return {
    notes,
    extraTaps,
    correct: count('on') === notes.length && extraTaps.length === 0,
    onTime: count('on'),
    early: count('early'),
    late: count('late'),
    missed: count('missed'),
    meanDeviation: deviations.length > 0 ? Math.round(deviations.reduce((a, b) => a + b, 0) / deviations.length) : null,
  };
}
