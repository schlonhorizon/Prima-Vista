import { eventBeats, type RhythmEvent } from './events';

/**
 * Counting syllables as spoken while playing: "1 und 2 und", sixteenths "1 e und e",
 * triplets "1 tri ole". Rests are shown in parentheses.
 */
export function syllable(beatInBar: number): string {
  const whole = Math.floor(beatInBar + 1e-6);
  const frac = beatInBar - whole;
  const near = (x: number) => Math.abs(frac - x) < 0.02;
  if (near(0)) return String(whole + 1);
  if (near(0.5)) return 'und';
  if (near(0.25) || near(0.75)) return 'e';
  if (near(1 / 3)) return 'tri';
  if (near(2 / 3)) return 'ole';
  return '·';
}

/**
 * "1 · 2 und · (3) · 4" for one bar. Every beat is counted: beats without an onset
 * (rests, held notes) and silent beats before an off-beat onset appear in parentheses.
 */
export function countBar(events: readonly RhythmEvent[], beatsPerBar = 4): string {
  const groups: string[][] = [];
  let pos = 0;
  let lastBeat = -1;
  const openBeat = (beat: number, onBeat: boolean) => {
    // Silent beats in between (held notes) are counted in parentheses.
    for (let b = lastBeat + 1; b < beat; b++) groups.push([`(${b + 1})`]);
    groups.push(onBeat ? [] : [`(${beat + 1})`]);
    lastBeat = beat;
  };
  for (const e of events) {
    const beat = Math.floor(pos + 1e-6);
    const s = syllable(pos);
    if (beat !== lastBeat) openBeat(beat, /^\d$/.test(s));
    groups[groups.length - 1].push(e.rest ? `(${s})` : s);
    pos += eventBeats(e);
  }
  for (let b = lastBeat + 1; b < beatsPerBar; b++) groups.push([`(${b + 1})`]);
  return groups.map((g) => g.join(' ')).join(' · ');
}

/** All bars, separated by " | ". */
export function countRhythm(bars: readonly (readonly RhythmEvent[])[]): string {
  return bars.map((bar) => countBar(bar)).join('  |  ');
}
