import type { StaffMode } from '../core/notation';
import { germanName, toMidi, type Pitch } from '../core/pitch';
import type { PitchRange } from '../core/range';
import { registerWeight, type RegisterWeighting } from '../core/weighting';
import type { ChordSettings } from '../settings';
import type { StatsGroup } from '../stats/statsView';
import {
  chordElementId,
  chordFunction,
  chordSymbol,
  diatonicChord,
  inversionName,
  romanNumeral,
  voiceChord,
  type DiatonicChord,
} from '../theory/chords';
import { fifthsOf, germanKeyName, keyId, parseKeyId, type Key } from '../theory/key';
import type { KeyContext } from './keyContext';
import type { Candidate, ItemSelector } from './selection';
import type { Exercise, Task } from './types';

export const CHORD_ID = 'chord';

export interface ChordConfig {
  staff: StaffMode;
  range: PitchRange;
  weighting: RegisterWeighting;
  settings: ChordSettings;
  chordWindowMs: number;
}

interface Realization {
  chord: DiatonicChord;
  inversion: number;
  pitches: Pitch[];
}

export function chordItemKey(chord: DiatonicChord, inversion: number): string {
  return `${CHORD_ID}|${chordElementId(chord, inversion)}`;
}

/** "Am, vi, Tp, 1. Umkehrung" */
export function describeChord(chord: DiatonicChord, inversion: number): string {
  return `${chordSymbol(chord)}, ${romanNumeral(chord)}, ${chordFunction(chord)}, ${inversionName(inversion)}`;
}

/**
 * Diatonic chords of the key in close position: triads and/or seventh chords,
 * root position and inversions; exactly the written notes must be played.
 */
export class ChordExercise implements Exercise {
  readonly id = CHORD_ID;
  private cache: { fingerprint: string; candidates: Candidate<Realization>[] } | null = null;

  constructor(
    private getConfig: () => ChordConfig,
    private keys: KeyContext,
    private selector: ItemSelector,
    /** All statistics keys stored so far (to list keys practised earlier). */
    private knownKeys: () => string[],
  ) {}

  candidates(key: Key): Candidate<Realization>[] {
    const config = this.getConfig();
    const fingerprint = JSON.stringify([config, keyId(key)]);
    if (this.cache?.fingerprint === fingerprint) return this.cache.candidates;

    const { kinds, inversions, degrees } = config.settings;
    const sevenths = kinds === 'triads' ? [false] : kinds === 'sevenths' ? [true] : [false, true];
    const low = toMidi(config.range.low);
    const high = toMidi(config.range.high);
    const candidates: Candidate<Realization>[] = [];
    for (const degree of degrees) {
      for (const seventh of sevenths) {
        const chord = diatonicChord(key, degree, seventh);
        for (const inversion of inversions) {
          if (inversion >= chord.tones.length) continue;
          for (let octave = config.range.low.octave - 1; octave <= config.range.high.octave; octave++) {
            const pitches = voiceChord(chord, inversion, octave);
            const midis = pitches.map(toMidi);
            if (midis[0] < low || midis[midis.length - 1] > high) continue;
            const weight = midis.reduce((sum, m) => sum + registerWeight(m, config.weighting), 0) / midis.length;
            candidates.push({ item: { chord, inversion, pitches }, key: chordItemKey(chord, inversion), baseWeight: weight });
          }
        }
      }
    }
    this.cache = { fingerprint, candidates };
    return candidates;
  }

  nextTask(): Task {
    const config = this.getConfig();
    const key = this.keys.next();
    const candidates = this.candidates(key);
    if (candidates.length === 0) {
      return {
        exerciseId: this.id,
        layout: config.staff,
        key,
        answer: 'choice',
        steps: [],
        itemKey: `${CHORD_ID}|none`,
        label: '',
      message: 'Im gewählten Tonumfang passt kein ausgewählter Akkord – bitte Einstellungen anpassen.',
      };
    }
    const r = this.selector.pick(candidates);
    return {
      exerciseId: this.id,
      layout: config.staff,
      key,
      answer: 'play',
      steps: [{ pitches: r.pitches }],
      itemKey: chordItemKey(r.chord, r.inversion),
      label: describeChord(r.chord, r.inversion),
      detail: r.pitches.map((p) => germanName(p)).join(' – '),
      chordWindowMs: config.chordWindowMs,
    };
  }

  /** One group per key (current key and keys practised before), plus totals per inversion. */
  statsGroups(): StatsGroup[] {
    const known = this.knownKeys().filter((k) => k.startsWith(`${CHORD_ID}|`));
    const keyIds = new Set(known.map((k) => k.split('|')[1]));
    const current = this.keys.peek();
    if (current) keyIds.add(keyId(current));
    const keys = [...keyIds]
      .map((id) => parseKeyId(id))
      .filter((k): k is Key => k !== null)
      .sort((a, b) => fifthsOf(a) - fifthsOf(b) || a.mode.localeCompare(b.mode));

    const groups: StatsGroup[] = keys.map((key) => ({
      title: germanKeyName(key),
      columns: ['Stufe', 'Akkord', 'Funktion'],
      rows: [false, true].flatMap((seventh) =>
        [1, 2, 3, 4, 5, 6, 7].map((degree) => {
          const chord = diatonicChord(key, degree, seventh);
          return {
            cells: [romanNumeral(chord), chordSymbol(chord), chordFunction(chord)],
            keys: [0, 1, 2, 3].slice(0, chord.tones.length).map((inv) => chordItemKey(chord, inv)),
          };
        }),
      ),
    }));
    if (known.length > 0) {
      groups.push({
        title: 'Nach Lage (alle Tonarten)',
        columns: ['Lage'],
        rows: [0, 1, 2, 3].map((inv) => ({
          cells: [inversionName(inv)],
          keys: known.filter((k) => k.endsWith(`|${inv}`)),
        })),
      });
    }
    return groups;
  }
}
