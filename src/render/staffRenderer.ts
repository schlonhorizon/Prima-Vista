import {
  Accidental,
  Formatter,
  GhostNote,
  Renderer,
  Stave,
  StaveConnector,
  StaveNote,
  Voice,
  type Note,
  type RenderContext,
} from 'vexflow/bravura';
import type { Clef } from '../core/clef';
import { clefsOf, placePitches, type Ottava, type StaffMode } from '../core/notation';
import { toVexKey } from '../core/pitch';
import type { TaskStep } from '../exercises/types';

export type NoteHighlight = 'none' | 'correct' | 'wrong';

const COLORS: Record<NoteHighlight, string> = {
  none: '#1a1a1a',
  correct: '#1f8a4c',
  wrong: '#c62f2f',
};

const OTTAVA_TEXT: Record<Exclude<Ottava, 0>, [string, string]> = {
  1: ['8', 'va'],
  2: ['15', 'ma'],
  [-1]: ['8', 'vb'],
  [-2]: ['15', 'mb'],
};

/** Logical drawing sizes before scaling. Leaves room for 4 ledger lines plus an ottava sign. */
const BASE_WIDTH = 300;
const LAYOUT = {
  single: { height: 190, staveY: [30], left: 10, maxScale: 2 },
  grand: { height: 270, staveY: [25, 125], left: 30, maxScale: 1.4 },
};

/** Draws one stave or a grand staff with the notes of a task. */
export class StaffRenderer {
  constructor(private container: HTMLElement) {}

  render(mode: StaffMode, steps: readonly TaskStep[], highlight: NoteHighlight = 'none'): void {
    this.container.replaceChildren();
    const layout = mode === 'grand' ? LAYOUT.grand : LAYOUT.single;
    const available = this.container.clientWidth || BASE_WIDTH;
    const scale = Math.max(1, Math.min(layout.maxScale, available / BASE_WIDTH));

    const renderer = new Renderer(this.container as HTMLDivElement, Renderer.Backends.SVG);
    renderer.resize(Math.round(BASE_WIDTH * scale), Math.round(layout.height * scale));
    const ctx = renderer.getContext();
    ctx.scale(scale, scale);

    const clefs = clefsOf(mode);
    const staves = new Map<Clef, Stave>();
    clefs.forEach((clef, i) => {
      const stave = new Stave(layout.left, layout.staveY[i], BASE_WIDTH - layout.left - 10);
      stave.addClef(clef).setContext(ctx).draw();
      staves.set(clef, stave);
    });
    if (mode === 'grand') {
      const [top, bottom] = [staves.get('treble')!, staves.get('bass')!];
      new StaveConnector(top, bottom).setType('brace').setContext(ctx).draw();
      new StaveConnector(top, bottom).setType('singleLeft').setContext(ctx).draw();
    }
    if (steps.length === 0) return;

    const color = COLORS[highlight];
    const brackets: Array<{ note: StaveNote; ottava: Exclude<Ottava, 0> }> = [];
    const voices = new Map<Clef, Voice>();
    for (const clef of clefs) {
      const tickables = steps.map((step) => {
        const group = placePitches(mode, step.pitches).find((g) => g.clef === clef);
        let note: Note;
        if (!group) {
          note = new GhostNote({ duration: 'w' });
        } else {
          const staveNote = new StaveNote({ clef, keys: group.written.map(toVexKey), duration: 'w' });
          group.written.forEach((p, i) => {
            if (p.alter !== 0) staveNote.addModifier(new Accidental(p.alter === 1 ? '#' : 'b'), i);
          });
          staveNote.setStyle({ fillStyle: color, strokeStyle: color });
          if (group.ottava !== 0) brackets.push({ note: staveNote, ottava: group.ottava });
          note = staveNote;
        }
        note.setStave(staves.get(clef)!);
        if (steps.length === 1) note.setCenterAlignment(true);
        return note;
      });
      const voice = new Voice({ numBeats: 4 * steps.length, beatValue: 4 }).setMode(Voice.Mode.SOFT);
      voice.addTickables(tickables);
      voices.set(clef, voice);
    }

    const formatter = new Formatter();
    for (const voice of voices.values()) formatter.joinVoices([voice]);
    formatter.formatToStave([...voices.values()], staves.get(clefs[0])!);
    for (const [clef, voice] of voices) voice.draw(ctx, staves.get(clef)!);

    for (const { note, ottava } of brackets) drawOttava(ctx, note, ottava, color);

    const svg = this.container.querySelector('svg');
    svg?.setAttribute('role', 'img');
    svg?.setAttribute('aria-label', mode === 'grand' ? 'Klaviersystem' : 'Notenzeile');
  }
}

/** Writes "8va"/"8vb"/"15ma"/"15mb" just outside the note head (beyond its ledger lines). */
function drawOttava(ctx: RenderContext, note: StaveNote, ottava: Exclude<Ottava, 0>, color: string): void {
  const [number, suffix] = OTTAVA_TEXT[ottava];
  const box = note.getBoundingBox();
  const x = box.getX() - 2;
  const y = ottava > 0 ? box.getY() - 8 : box.getY() + box.getH() + 16;
  ctx.save();
  ctx.setFillStyle(color);
  ctx.setFont('Times New Roman, serif', 14, 'bold', 'italic');
  ctx.fillText(number, x, y);
  ctx.setFont('Times New Roman, serif', 10, 'bold', 'italic');
  ctx.fillText(suffix, x + (number.length === 1 ? 8 : 17), y - 5);
  ctx.restore();
}
