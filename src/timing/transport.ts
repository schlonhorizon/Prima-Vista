/**
 * Musical time ↔ clock time. All times are in milliseconds on the
 * performance.now() clock – the same base as MIDI, keyboard and pointer event
 * timestamps – so input can be compared directly. Shared by rhythm exercises and
 * later by phrases, reading ahead and the sight-reading mode.
 */
export interface Transport {
  readonly bpm: number;
  readonly beatsPerBar: number;
  /** Clock time of beat 0 (ms). */
  readonly startTime: number;
}

export function beatMs(t: Pick<Transport, 'bpm'>): number {
  return 60000 / t.bpm;
}

export function beatToTime(t: Transport, beat: number): number {
  return t.startTime + beat * beatMs(t);
}

export function timeToBeat(t: Transport, time: number): number {
  return (time - t.startTime) / beatMs(t);
}

/** Beat indices whose time falls into [from, to). */
export function beatsInWindow(t: Transport, from: number, to: number, lastBeat = Infinity): number[] {
  const first = Math.max(0, Math.ceil(timeToBeat(t, from) - 1e-9));
  const result: number[] = [];
  for (let b = first; b <= lastBeat && beatToTime(t, b) < to; b++) result.push(b);
  return result;
}
