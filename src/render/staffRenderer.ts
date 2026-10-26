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
import { toVexKey, type Pitch } from '../core/pitch';
import type { TaskStep } from '../exercises/types';
import { fifthsOf, keySignature, vexKeySpec, type Key } from '../theory/key';
import { accidentalMarks } from './accidentals';

export type NoteHighlight = 'none' | 'correct' | 'wrong';

const COLORS: Record<NoteHighlight, string> = {
  none: '#141414',
  // Emerald and bordeaux, dark enough for strong contrast on the ivory sheet.
  correct: '#1d6a4a',
  wrong: '#8a1f33',
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
  private baseWidth: number;
  private maxScale: number;
  private fitHeight: boolean;

  /**
   * `baseWidth`: logical width before scaling (wider for longer examples); `maxScale` caps the zoom;
   * `fitHeight` crops the drawing to its content instead of reserving room for extreme notes
   * (for static examples – the practice staff keeps a stable height).
   */
  constructor(
    private container: HTMLElement,
    options: { baseWidth?: number; maxScale?: number; fitHeight?: boolean } = {},
  ) {
    this.baseWidth = options.baseWidth ?? BASE_WIDTH;
    this.maxScale = options.maxScale ?? Infinity;
    this.fitHeight = options.fitHeight ?? false;
  }

  render(
    mode: StaffMode,
    steps: readonly TaskStep[],
    highlight: NoteHighlight = 'none',
    key: Key | null = null,
  ): void {
    this.container.replaceChildren();
    const layout = mode === 'grand' ? LAYOUT.grand : LAYOUT.single;
    const available = this.container.clientWidth || this.baseWidth;
    const scale = Math.max(0.6, Math.min(layout.maxScale, this.maxScale, available / this.baseWidth));

    const renderer = new Renderer(this.container as HTMLDivElement, Renderer.Backends.SVG);
    renderer.resize(Math.round(this.baseWidth * scale), Math.round(layout.height * scale));
    const ctx = renderer.getContext();
    ctx.scale(scale, scale);

    const fifths = key ? fifthsOf(key) : 0;
    const signature = keySignature(fifths);
    const clefs = clefsOf(mode);
    const staves = new Map<Clef, Stave>();
    clefs.forEach((clef, i) => {
      const stave = new Stave(layout.left, layout.staveY[i], this.baseWidth - layout.left - 10);
      stave.addClef(clef);
      if (fifths !== 0) stave.addKeySignature(vexKeySpec(fifths));
      stave.setContext(ctx).draw();
      staves.set(clef, stave);
    });
    if (mode === 'grand') {
      const [top, bottom] = [staves.get('treble')!, staves.get('bass')!];
      new StaveConnector(top, bottom).setType('brace').setContext(ctx).draw();
      new StaveConnector(top, bottom).setType('singleLeft').setContext(ctx).draw();
    }
    if (steps.length === 0) {
      if (this.fitHeight) this.cropTo(staves, new Map(), false, scale);
      return;
    }

    const color = COLORS[highlight];
    const brackets: Array<{ note: StaveNote; ottava: Exclude<Ottava, 0> }> = [];
    const voices = new Map<Clef, Voice>();
    for (const clef of clefs) {
      const groups = steps.map((step) => placePitches(mode, step.pitches).find((g) => g.clef === clef));
      // Accidentals are decided per staff over the whole measure, relative to the key signature.
      const marks = accidentalMarks(groups.map((g) => (g ? g.written : ([] as Pitch[]))), signature);
      const tickables = groups.map((group, stepIndex) => {
        let note: Note;
        if (!group) {
          note = new GhostNote({ duration: 'w' });
        } else {
          const staveNote = new StaveNote({ clef, keys: group.written.map(toVexKey), duration: 'w' });
          marks[stepIndex].forEach((mark, i) => {
            if (mark) staveNote.addModifier(new Accidental(mark), i);
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

    // Align the staves of a grand staff and leave some air after the signature for note sequences.
    const startX = Math.max(...[...staves.values()].map((st) => st.getNoteStartX())) + (steps.length > 1 ? 18 : 0);
    for (const st of staves.values()) st.setNoteStartX(startX);

    const formatter = new Formatter();
    for (const voice of voices.values()) formatter.joinVoices([voice]);
    formatter.formatToStave([...voices.values()], staves.get(clefs[0])!);
    for (const [clef, voice] of voices) voice.draw(ctx, staves.get(clef)!);

    for (const { note, ottava } of brackets) drawOttava(ctx, note, ottava, color);
    if (this.fitHeight) this.cropTo(staves, voices, brackets.length > 0, scale);

    const svg = this.container.querySelector('svg');
    svg?.setAttribute('role', 'img');
    svg?.setAttribute('aria-label', mode === 'grand' ? 'Klaviersystem' : 'Notenzeile');
  }

  /** Shrinks the SVG to the staves and notes actually drawn. */
  private cropTo(staves: Map<Clef, Stave>, voices: Map<Clef, Voice>, ottava: boolean, scale: number): void {
    const svg = this.container.querySelector('svg');
    if (!svg) return;
    let top = Infinity;
    let bottom = -Infinity;
    for (const stave of staves.values()) {
      top = Math.min(top, stave.getYForLine(0) - 22); // room for clef and key signature
      bottom = Math.max(bottom, stave.getYForLine(4) + 22);
    }
    for (const voice of voices.values()) {
      for (const note of voice.getTickables()) {
        if (!(note instanceof StaveNote)) continue;
        const box = note.getBoundingBox();
        top = Math.min(top, box.getY() - (ottava ? 22 : 8));
        bottom = Math.max(bottom, box.getY() + box.getH() + (ottava ? 22 : 8));
      }
    }
    const height = bottom - top;
    svg.setAttribute('viewBox', `0 ${top} ${this.baseWidth} ${height}`);
    svg.setAttribute('height', String(Math.round(height * scale)));
    svg.style.height = `${Math.round(height * scale)}px`;
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
