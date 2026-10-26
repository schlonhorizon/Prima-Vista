import { clefForPitch, type StaffMode } from '../core/notation';
import { germanName, pitchId, toMidi, type Pitch } from '../core/pitch';
import { pitchesInRange, type AccidentalMode, type PitchRange } from '../core/range';
import { registerWeight, type RegisterWeighting } from '../core/weighting';
import type { Candidate, ItemSelector } from './selection';
import type { Exercise, Task } from './types';

export interface SingleNoteConfig {
  mode: StaffMode;
  range: PitchRange;
  accidentals: AccidentalMode;
  weighting: RegisterWeighting;
}

export const SINGLE_NOTE_ID = 'note';

/**
 * Stats key. It contains the clef the note is read in, so C5 read in the
 * treble clef counts the same in treble and grand staff mode.
 */
export function singleNoteItemKey(mode: StaffMode, p: Pitch): string {
  return `${SINGLE_NOTE_ID}|${clefForPitch(mode, p)}|${pitchId(p)}`;
}

export class SingleNoteExercise implements Exercise {
  readonly id = SINGLE_NOTE_ID;
  readonly name = 'Einzelnoten';

  constructor(
    private getConfig: () => SingleNoteConfig,
    private selector: ItemSelector,
  ) {}

  candidates(): Candidate<Pitch>[] {
    const { mode, range, accidentals, weighting } = this.getConfig();
    return pitchesInRange(range, accidentals).map((p) => ({
      item: p,
      key: singleNoteItemKey(mode, p),
      baseWeight: registerWeight(toMidi(p), weighting),
    }));
  }

  nextTask(): Task {
    const { mode } = this.getConfig();
    const p = this.selector.pick(this.candidates());
    return {
      exerciseId: this.id,
      layout: mode,
      steps: [{ pitches: [p] }],
      itemKey: singleNoteItemKey(mode, p),
      label: germanName(p),
    };
  }
}
