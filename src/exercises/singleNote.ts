import type { Clef } from '../core/clef';
import { germanName, pitchId, type Pitch } from '../core/pitch';
import { pitchesInRange, type AccidentalMode, type PitchRange } from '../core/range';
import type { ItemSelector } from './selection';
import type { Exercise, Task } from './types';

export interface SingleNoteConfig {
  clef: Clef;
  range: PitchRange;
  accidentals: AccidentalMode;
}

export const SINGLE_NOTE_ID = 'note';

export function singleNoteItemKey(clef: Clef, p: Pitch): string {
  return `${SINGLE_NOTE_ID}|${clef}|${pitchId(p)}`;
}

export class SingleNoteExercise implements Exercise {
  readonly id = SINGLE_NOTE_ID;
  readonly name = 'Einzelnoten';

  constructor(
    private getConfig: () => SingleNoteConfig,
    private selector: ItemSelector,
  ) {}

  candidates(): Pitch[] {
    const { range, accidentals } = this.getConfig();
    return pitchesInRange(range, accidentals);
  }

  nextTask(): Task {
    const { clef } = this.getConfig();
    const p = this.selector.pick(this.candidates(), (c) => singleNoteItemKey(clef, c));
    return {
      exerciseId: this.id,
      clef,
      steps: [{ pitches: [p] }],
      itemKey: singleNoteItemKey(clef, p),
      label: germanName(p),
    };
  }
}
