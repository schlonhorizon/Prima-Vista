/** Note values of the rhythm notation (VexFlow duration codes). */
export type NoteValue = 'w' | 'h' | 'q' | '8' | '16';

export interface RhythmEvent {
  readonly value: NoteValue;
  readonly dotted: boolean;
  readonly rest: boolean;
  /** Part of an eighth-note triplet (three in the time of two). */
  readonly triplet: boolean;
}

const BEATS: Record<NoteValue, number> = { w: 4, h: 2, q: 1, '8': 0.5, '16': 0.25 };

/** Length in beats (quarter = 1). */
export function eventBeats(e: RhythmEvent): number {
  let beats = BEATS[e.value];
  if (e.dotted) beats *= 1.5;
  if (e.triplet) beats *= 2 / 3;
  return beats;
}

/**
 * Parses a compact rhythm text: tokens w h q 8 16, suffix "d" = dotted, "r" = rest,
 * "t" = triplet eighth (always three in a row), bars separated by "|".
 * Example: "q 8 8 qd 8 | h hr"
 */
export function parseRhythm(text: string): RhythmEvent[][] {
  return text
    .split('|')
    .map((bar) => bar.trim())
    .filter(Boolean)
    .map((bar) =>
      bar.split(/\s+/).map((token) => {
        const m = /^(w|h|q|8|16)(d?)(r?)(t?)$/.exec(token);
        if (!m) throw new Error(`Unknown rhythm token "${token}"`);
        return { value: m[1] as NoteValue, dotted: m[2] === 'd', rest: m[3] === 'r', triplet: m[4] === 't' };
      }),
    );
}

export function barBeats(events: readonly RhythmEvent[]): number {
  return Math.round(events.reduce((sum, e) => sum + eventBeats(e), 0) * 1e6) / 1e6;
}

/** Onsets (in beats from the start) of all events of consecutive bars. */
export function onsets(bars: readonly (readonly RhythmEvent[])[], beatsPerBar = 4): number[][] {
  return bars.map((bar, b) => {
    let pos = b * beatsPerBar;
    return bar.map((e) => {
      const onset = pos;
      pos += eventBeats(e);
      return Math.round(onset * 1e6) / 1e6;
    });
  });
}
