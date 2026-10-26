import { RHYTHM_CELLS, RHYTHM_LEVELS, rhythmItemKey } from '../rhythm/cells';
import { countRhythm } from '../rhythm/counting';
import { generateRhythm, patternBars } from '../rhythm/generator';
import type { RhythmSettings } from '../settings';
import type { StatsGroup } from '../stats/statsView';
import type { ItemSelector } from './selection';
import type { Exercise, Task } from './types';

export const RHYTHM_ID = 'rhythm';

/** Rhythms of 1–4 bars, played in time on any key; statistics per pattern (cell). */
export class RhythmExercise implements Exercise {
  readonly id = RHYTHM_ID;

  constructor(
    private getSettings: () => RhythmSettings,
    private selector: ItemSelector,
  ) {}

  nextTask(): Task {
    const s = this.getSettings();
    const pattern = generateRhythm(s.level, s.bars, this.selector);
    const keys = [...new Set(pattern.cells.map((c) => rhythmItemKey(c.cell.id)))];
    return {
      exerciseId: this.id,
      layout: 'treble',
      key: null,
      steps: [],
      answer: 'perform',
      itemKey: `${RHYTHM_ID}|level${s.level}`,
      statsKeys: keys,
      label: `${s.bars} ${s.bars === 1 ? 'Takt' : 'Takte'} · ${s.bpm} Schläge pro Minute`,
      detail: countRhythm(patternBars(pattern, s.bars)),
      info: { kind: 'rhythm', pattern, bars: s.bars, bpm: s.bpm },
    };
  }

  statsGroups(): StatsGroup[] {
    return [1, 2, 3, 4].map((level) => ({
      title: `Stufe ${level}: ${RHYTHM_LEVELS[level]}`,
      columns: ['Muster', 'Zählen'],
      timeLabel: 'Ø Abweichung',
      rows: RHYTHM_CELLS.filter((c) => c.level === level).map((c) => ({
        cells: [c.name, countRhythm([c.events])],
        keys: [rhythmItemKey(c.id)],
      })),
    }));
  }
}
