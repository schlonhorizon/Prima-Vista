import type { StaffMode } from '../core/notation';
import { diatonicIndex, fromDiatonicIndex, germanName, pitch, toMidi, type Pitch } from '../core/pitch';
import { pitchesInRange, type PitchRange } from '../core/range';
import { registerWeight, type RegisterWeighting } from '../core/weighting';
import {
  STANDARD_INTERVALS,
  type IntervalSettings,
  type StandardInterval,
} from '../settings';
import type { StatsGroup } from '../stats/statsView';
import { germanIntervalName, interval, intervalBetween, intervalId, tryTranspose, type Interval } from '../theory/interval';
import { keyId, keyTones, type Key } from '../theory/key';
import type { KeyContext } from './keyContext';
import type { Candidate, ItemSelector } from './selection';
import type { Exercise, Task } from './types';

export const INTERVAL_ID = 'interval';

export interface IntervalConfig {
  staff: StaffMode;
  range: PitchRange;
  weighting: RegisterWeighting;
  settings: IntervalSettings;
  chordWindowMs: number;
}

type Presentation = 'up' | 'down' | 'harm';

interface Realization {
  lower: Pitch;
  upper: Pitch;
  interval: Interval;
  standard: StandardInterval;
  presentation: Presentation;
}

/** Names of the standard intervals for settings and statistics. */
export const STANDARD_INTERVAL_NAMES: Record<StandardInterval, string> = {
  m2: 'kleine Sekunde', M2: 'große Sekunde', m3: 'kleine Terz', M3: 'große Terz', P4: 'reine Quarte',
  TT: 'Tritonus', P5: 'reine Quinte', m6: 'kleine Sexte', M6: 'große Sexte', m7: 'kleine Septime',
  M7: 'große Septime', P8: 'Oktave',
};

const PRESENTATION_LABEL: Record<Presentation, string> = {
  up: 'Melodisch aufwärts',
  down: 'Melodisch abwärts',
  harm: 'Harmonisch',
};

/** Maps a spelled interval onto the standard list (A4 and d5 → tritone); null for others. */
export function standardInterval(iv: Interval): StandardInterval | null {
  const id = intervalId(iv);
  if (id === 'A4' || id === 'd5') return 'TT';
  return (STANDARD_INTERVALS as readonly string[]).includes(id) ? (id as StandardInterval) : null;
}

export function intervalItemKey(standard: StandardInterval, presentation: Presentation): string {
  return presentation === 'harm'
    ? `${INTERVAL_ID}|${standard}|harm`
    : `${INTERVAL_ID}|${standard}|${presentation}|mel`;
}

/**
 * Intervals: two notes in a row (melodic) or together (harmonic), either from
 * the tones of a key or chromatic without key signature.
 */
export class IntervalExercise implements Exercise {
  readonly id = INTERVAL_ID;
  private cache: { fingerprint: string; candidates: Candidate<Realization>[] } | null = null;

  constructor(
    private getConfig: () => IntervalConfig,
    private keys: KeyContext,
    private selector: ItemSelector,
  ) {}

  presentations(): Presentation[] {
    const { direction, presentation } = this.getConfig().settings;
    const melodic: Presentation[] = direction === 'up' ? ['up'] : direction === 'down' ? ['down'] : ['up', 'down'];
    if (presentation === 'melodic') return melodic;
    if (presentation === 'harmonic') return ['harm'];
    return [...melodic, 'harm'];
  }

  candidates(key: Key | null): Candidate<Realization>[] {
    const config = this.getConfig();
    const fingerprint = JSON.stringify([config, key && keyId(key)]);
    if (this.cache?.fingerprint === fingerprint) return this.cache.candidates;

    const allowed = new Set(config.settings.allowed);
    const presentations = this.presentations();
    const pairs = key ? keyPairs(config.range, key) : chromaticPairs(config.range, allowed);
    const candidates: Candidate<Realization>[] = [];
    for (const [lower, upper] of pairs) {
      const iv = intervalBetween(lower, upper);
      const standard = iv && standardInterval(iv);
      if (!iv || !standard || !allowed.has(standard)) continue;
      const weight = (registerWeight(toMidi(lower), config.weighting) + registerWeight(toMidi(upper), config.weighting)) / 2;
      for (const presentation of presentations) {
        candidates.push({
          item: { lower, upper, interval: iv, standard, presentation },
          key: intervalItemKey(standard, presentation),
          baseWeight: weight,
        });
      }
    }
    this.cache = { fingerprint, candidates };
    return candidates;
  }

  nextTask(): Task {
    const config = this.getConfig();
    const key = config.settings.scope === 'key' ? this.keys.next() : null;
    let candidates = this.candidates(key);
    if (candidates.length === 0 && key) candidates = this.candidates(null);
    if (candidates.length === 0) return this.emptyTask(config.staff);
    const r = this.selector.pick(candidates);
    const name = germanIntervalName(r.interval);
    const label =
      r.presentation === 'harm' ? `${name} (harmonisch)` : `${name} ${r.presentation === 'up' ? 'aufwärts' : 'abwärts'}`;
    const notes = r.presentation === 'down' ? [r.upper, r.lower] : [r.lower, r.upper];
    return {
      exerciseId: this.id,
      layout: config.staff,
      key,
      answer: 'play',
      steps: r.presentation === 'harm' ? [{ pitches: [r.lower, r.upper] }] : notes.map((p) => ({ pitches: [p] })),
      itemKey: intervalItemKey(r.standard, r.presentation),
      label,
      detail: notes.map((p) => germanName(p)).join(' – '),
      chordWindowMs: config.chordWindowMs,
    };
  }

  statsGroups(): StatsGroup[] {
    const presentations: Presentation[] = ['up', 'down', 'harm'];
    return presentations.map((presentation) => ({
      title: PRESENTATION_LABEL[presentation],
      columns: ['Intervall'],
      rows: STANDARD_INTERVALS.map((standard) => ({
        cells: [STANDARD_INTERVAL_NAMES[standard]],
        keys: [intervalItemKey(standard, presentation)],
      })),
    }));
  }

  /** Fallback when the range is too small for any allowed interval. */
  private emptyTask(staff: StaffMode): Task {
    return {
      exerciseId: this.id,
      layout: staff,
      key: null,
      answer: 'choice',
      steps: [],
      itemKey: `${INTERVAL_ID}|none`,
      label: '',
      message: 'Im gewählten Tonumfang passt kein ausgewähltes Intervall – bitte Einstellungen anpassen.',
    };
  }
}

/** All ordered pairs (lower < upper, at most an octave apart) of key tones in range. */
function keyPairs(range: PitchRange, key: Key): [Pitch, Pitch][] {
  const tones = keyTones(key);
  const pitches: Pitch[] = [];
  for (let i = diatonicIndex(range.low) - 1; i <= diatonicIndex(range.high) + 1; i++) {
    const natural = fromDiatonicIndex(i);
    for (const t of tones) {
      if (t.step !== natural.step) continue;
      const p = pitch(t.step, t.alter, natural.octave);
      if (toMidi(p) >= toMidi(range.low) && toMidi(p) <= toMidi(range.high)) pitches.push(p);
    }
  }
  const pairs: [Pitch, Pitch][] = [];
  for (const a of pitches) {
    for (const b of pitches) {
      const steps = diatonicIndex(b) - diatonicIndex(a);
      if (steps >= 1 && steps <= 7 && toMidi(b) > toMidi(a)) pairs.push([a, b]);
    }
  }
  return pairs;
}

/** Chromatic pairs: any lower note (♮, ♯, ♭) plus each allowed interval, avoiding double accidentals. */
function chromaticPairs(range: PitchRange, allowed: Set<StandardInterval>): [Pitch, Pitch][] {
  const ivs = [...allowed].flatMap((s) => (s === 'TT' ? ['A4', 'd5'] : [s])).map(interval);
  const pairs: [Pitch, Pitch][] = [];
  for (const lower of pitchesInRange(range, 'both')) {
    for (const iv of ivs) {
      const upper = tryTranspose(lower, iv);
      if (!upper || Math.abs(upper.alter) > 1 || toMidi(upper) > toMidi(range.high)) continue;
      pairs.push([lower, upper]);
    }
  }
  return pairs;
}
