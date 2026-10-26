import { Accidental, Formatter, Renderer, Stave, StaveNote } from 'vexflow/bravura';
import type { Clef } from '../core/clef';
import { toVexKey } from '../core/pitch';
import type { TaskStep } from '../exercises/types';

export type NoteHighlight = 'none' | 'correct' | 'wrong';

const COLORS: Record<NoteHighlight, string> = {
  none: '#1a1a1a',
  correct: '#1f8a4c',
  wrong: '#c62f2f',
};

/** Logical drawing size before scaling. */
const BASE_WIDTH = 260;
const BASE_HEIGHT = 135;
const STAVE_Y = 5;

/** Draws a stave with clef and the notes of a task. */
export class StaffRenderer {
  constructor(private container: HTMLElement) {}

  render(clef: Clef, steps: readonly TaskStep[], highlight: NoteHighlight = 'none'): void {
    this.container.replaceChildren();
    const available = this.container.clientWidth || BASE_WIDTH;
    const scale = Math.max(1, Math.min(2.2, available / BASE_WIDTH));

    const renderer = new Renderer(this.container as HTMLDivElement, Renderer.Backends.SVG);
    renderer.resize(Math.round(BASE_WIDTH * scale), Math.round(BASE_HEIGHT * scale));
    const ctx = renderer.getContext();
    ctx.scale(scale, scale);

    const stave = new Stave(5, STAVE_Y, BASE_WIDTH - 10);
    stave.addClef(clef);
    stave.setContext(ctx).draw();

    const color = COLORS[highlight];
    const notes = steps.map((step) => {
      const note = new StaveNote({ clef, keys: step.pitches.map(toVexKey), duration: 'w' });
      step.pitches.forEach((p, i) => {
        if (p.alter !== 0) note.addModifier(new Accidental(p.alter === 1 ? '#' : 'b'), i);
      });
      note.setStyle({ fillStyle: color, strokeStyle: color });
      if (steps.length === 1) note.setCenterAlignment(true);
      return note;
    });
    if (notes.length > 0) Formatter.FormatAndDraw(ctx, stave, notes);

    const svg = this.container.querySelector('svg');
    svg?.setAttribute('role', 'img');
    svg?.setAttribute('aria-label', 'Notenzeile');
  }
}
