import type { StaffMode } from '../core/notation';
import type { KeyQuizSettings } from '../settings';
import type { StatsGroup } from '../stats/statsView';
import { fifthsOf, germanKeyName, keyFromFifths, type Key } from '../theory/key';
import type { Candidate, ItemSelector } from './selection';
import type { Exercise, Task } from './types';

export const KEY_QUIZ_ID = 'keysig';

export interface KeyQuizConfig {
  staff: StaffMode;
  settings: KeyQuizSettings;
}

export function keySigItemKey(fifths: number): string {
  return `${KEY_QUIZ_ID}|${fifths}`;
}

/** "3 ♯", "2 ♭", "keine Vorzeichen" */
export function signatureLabel(fifths: number): string {
  if (fifths === 0) return 'keine Vorzeichen';
  return `${Math.abs(fifths)} ${fifths > 0 ? '♯' : '♭'}`;
}

/** "Es-Dur / c-Moll" */
export function keyPairLabel(fifths: number): string {
  return `${germanKeyName(keyFromFifths(fifths, 'major'))} / ${germanKeyName(keyFromFifths(fifths, 'minor'))}`;
}

/** Answer check: both the major key and its relative minor must match the signature. */
export function checkKeyAnswer(task: Task, major: Key, minor: Key): boolean {
  const fifths = fifthsOf(task.key!);
  return fifthsOf(major) === fifths && fifthsOf(minor) === fifths && major.mode === 'major' && minor.mode === 'minor';
}

/** A key signature is shown; the player names the major key and its relative minor. */
export class KeyQuizExercise implements Exercise {
  readonly id = KEY_QUIZ_ID;

  constructor(
    private getConfig: () => KeyQuizConfig,
    private selector: ItemSelector,
  ) {}

  candidates(): Candidate<number>[] {
    const max = this.getConfig().settings.maxAccidentals;
    const result: Candidate<number>[] = [];
    for (let f = -max; f <= max; f++) result.push({ item: f, key: keySigItemKey(f), baseWeight: 1 });
    return result;
  }

  nextTask(): Task {
    const fifths = this.selector.pick(this.candidates());
    return {
      exerciseId: this.id,
      layout: this.getConfig().staff,
      key: keyFromFifths(fifths, 'major'),
      answer: 'choice',
      steps: [],
      itemKey: keySigItemKey(fifths),
      label: keyPairLabel(fifths),
      detail: signatureLabel(fifths),
    };
  }

  statsGroups(): StatsGroup[] {
    const row = (f: number) => ({ cells: [signatureLabel(f), keyPairLabel(f)], keys: [keySigItemKey(f)] });
    return [
      { title: 'Kreuz-Tonarten', columns: ['Vorzeichen', 'Tonarten'], rows: [0, 1, 2, 3, 4, 5, 6, 7].map(row) },
      { title: 'B-Tonarten', columns: ['Vorzeichen', 'Tonarten'], rows: [-1, -2, -3, -4, -5, -6, -7].map(row) },
    ];
  }
}
