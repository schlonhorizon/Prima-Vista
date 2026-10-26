import {
  Annotation,
  AnnotationVerticalJustify,
  Beam,
  Dot,
  Formatter,
  Fraction,
  Renderer,
  Stave,
  StaveNote,
  Tuplet,
  Voice,
} from 'vexflow/bravura';
import type { RhythmEvent } from '../rhythm/events';
import type { NoteVerdict } from '../rhythm/evaluate';

/** Result marks per played note (in order of the notes, rests excluded). */
export interface RhythmMarks {
  verdicts: readonly NoteVerdict[];
  deviations: readonly (number | null)[];
}

const COLORS: Record<NoteVerdict | 'none', string> = {
  none: '#141414',
  on: '#1d6a4a',
  early: '#2b4c7e',
  late: '#8a1f33',
  missed: '#8a7a5a',
};

const BAR_WIDTH = 230;
const FIRST_EXTRA = 55; // clef + time signature
const ROW_HEIGHT = 120;
const MAX_BARS_PER_ROW = 2;

/** Rhythm notation on a single line (percussion clef, all notes on the middle line). */
export class RhythmRenderer {
  constructor(private container: HTMLElement, private options: { maxScale?: number } = {}) {}

  render(bars: readonly (readonly RhythmEvent[])[], marks: RhythmMarks | null = null): void {
    this.container.replaceChildren();
    if (bars.length === 0) return;
    const available = this.container.clientWidth || 600;
    // Narrow screens: one bar per row so the notes stay readable.
    const perRow = Math.min(available < 520 ? 1 : MAX_BARS_PER_ROW, bars.length);
    const rows = Math.ceil(bars.length / perRow);
    const logicalWidth = FIRST_EXTRA + perRow * BAR_WIDTH + 10;
    const logicalHeight = rows * ROW_HEIGHT + (marks ? 18 : 0);
    const scale = Math.max(0.55, Math.min(this.options.maxScale ?? 1.6, available / logicalWidth));

    const renderer = new Renderer(this.container as HTMLDivElement, Renderer.Backends.SVG);
    renderer.resize(Math.round(logicalWidth * scale), Math.round(logicalHeight * scale));
    const ctx = renderer.getContext();
    ctx.scale(scale, scale);

    let noteIndex = 0;
    bars.forEach((events, b) => {
      const row = Math.floor(b / perRow);
      const col = b % perRow;
      const first = col === 0;
      const x = 5 + (first ? 0 : FIRST_EXTRA + col * BAR_WIDTH);
      const width = BAR_WIDTH + (first ? FIRST_EXTRA : 0);
      const stave = new Stave(x, row * ROW_HEIGHT - 10, width);
      // Rhythm line: a regular staff with only the middle line visible (notes sit on it).
      stave.setConfigForLines([0, 1, 2, 3, 4].map((i) => ({ visible: i === 2 })));
      if (first) stave.addClef('percussion');
      if (b === 0) stave.addTimeSignature('4/4');
      stave.setContext(ctx).draw();

      const notes = events.map((e) => {
        const note = new StaveNote({
          keys: ['b/4'],
          duration: `${e.value}${e.rest ? 'r' : ''}`,
          dots: e.dotted ? 1 : 0,
          clef: 'percussion',
          alignCenter: e.rest && e.value === 'w',
          stemDirection: 1, // rhythm notation: all stems up
        });
        if (e.dotted) Dot.buildAndAttach([note], { all: true });
        if (!e.rest && marks) {
          const verdict = marks.verdicts[noteIndex] ?? 'missed';
          const color = COLORS[verdict];
          note.setStyle({ fillStyle: color, strokeStyle: color });
          const dev = marks.deviations[noteIndex];
          const label = verdict === 'missed' ? '–' : verdict === 'on' ? '✓' : `${dev! > 0 ? '+' : ''}${dev}`;
          note.addModifier(
            new Annotation(label).setVerticalJustification(AnnotationVerticalJustify.BOTTOM).setFont('Source Sans 3', 10, 'bold'),
          );
        }
        if (!e.rest) noteIndex++;
        return note;
      });

      // Triplets: groups of three consecutive triplet notes.
      const tuplets: Tuplet[] = [];
      const tripletBeams: Beam[] = [];
      for (let i = 0; i < events.length; i++) {
        if (events[i].triplet && events[i + 1]?.triplet && events[i + 2]?.triplet) {
          const group = notes.slice(i, i + 3);
          tuplets.push(new Tuplet(group, { numNotes: 3, notesOccupied: 2, bracketed: false }));
          tripletBeams.push(new Beam(group));
          i += 2;
        }
      }
      const voice = new Voice({ numBeats: 4, beatValue: 4 }).setMode(Voice.Mode.SOFT);
      voice.addTickables(notes);
      const plain = notes.filter((_, i) => !events[i].triplet);
      const beams = Beam.generateBeams(plain, { groups: [new Fraction(1, 4)], stemDirection: 1 });
      new Formatter().joinVoices([voice]).format([voice], width - (stave.getNoteStartX() - x) - 32);
      voice.draw(ctx, stave);
      [...beams, ...tripletBeams].forEach((beam) => beam.setContext(ctx).draw());
      tuplets.forEach((t) => t.setContext(ctx).draw());
    });

    const svg = this.container.querySelector('svg');
    svg?.setAttribute('role', 'img');
    svg?.setAttribute('aria-label', 'Rhythmus');
  }
}
