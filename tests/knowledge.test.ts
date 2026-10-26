import { describe, expect, it } from 'vitest';
import { parsePitchId } from '../src/core/pitch';
import { barBeats, parseRhythm } from '../src/rhythm/events';
import { memoryStorage } from '../src/core/storage';
import { ChordExercise } from '../src/exercises/chords';
import { IntervalExercise } from '../src/exercises/intervals';
import { KeyContext } from '../src/exercises/keyContext';
import { KeyQuizExercise } from '../src/exercises/keyQuiz';
import { RhythmExercise } from '../src/exercises/rhythm';
import { WeightedSelector } from '../src/exercises/selection';
import { SingleNoteExercise } from '../src/exercises/singleNote';
import type { Exercise, Task } from '../src/exercises/types';
import { contentFile, contentPaths, section } from '../src/knowledge/content';
import { accidentalText, nearestLandmark, staffPosition } from '../src/knowledge/facts';
import { documentTitle, fill, parseNotation, parseSections, placeholders, renderMarkdown } from '../src/knowledge/markdown';
import {
  chordKnowledge,
  intervalKnowledge,
  KNOWLEDGE,
  keyKnowledge,
  noteKnowledge,
  rhythmKnowledge,
  rhythmOutcomes,
} from '../src/knowledge/providers';
import { evaluateRhythm } from '../src/rhythm/evaluate';
import { defaultSettings } from '../src/settings';
import { StatsStore } from '../src/stats/statsStore';
import { parseKeyId } from '../src/theory/key';

const p = (id: string) => parsePitchId(id)!;

function seeded(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function allExercises(): Exercise[] {
  const d = defaultSettings();
  const range = { low: p('A0'), high: p('C8') };
  const keys = new KeyContext(() => ({ ...d.key, maxAccidentals: 7, changeEvery: 1 }), seeded(4));
  const sel = () => new WeightedSelector({ random: seeded(8) });
  return [
    new SingleNoteExercise(() => ({ mode: 'grand', range, accidentals: 'both', weighting: d.weighting }), sel()),
    new IntervalExercise(
      () => ({ staff: 'grand', range, weighting: d.weighting, settings: d.intervals, chordWindowMs: 0 }),
      keys,
      sel(),
    ),
    new IntervalExercise(
      () => ({ staff: 'treble', range: { low: p('C4'), high: p('C6') }, weighting: d.weighting, settings: { ...d.intervals, scope: 'chromatic' }, chordWindowMs: 0 }),
      keys,
      sel(),
    ),
    new ChordExercise(
      () => ({ staff: 'grand', range: { low: p('C2'), high: p('C6') }, weighting: d.weighting, settings: { ...d.chords, kinds: 'both' }, chordWindowMs: 0 }),
      keys,
      sel(),
      () => [],
    ),
    new KeyQuizExercise(() => ({ staff: 'grand', settings: { maxAccidentals: 7, showCircle: true } }), sel()),
    new RhythmExercise(() => ({ ...d.rhythm, level: 4, bars: 4 }), new WeightedSelector({ random: seeded(5), avoidRepeat: false })),
  ];
}

describe('markdown', () => {
  it('splits sections and fills placeholders', () => {
    const sections = parseSections('Kopf\n<!-- Kommentar -->\n## a\nText {x}\n\n## b.c\nMehr');
    expect([...sections.keys()]).toEqual(['a', 'b.c']);
    expect(fill(sections.get('a')!, { x: 'eins' })).toBe('Text eins');
    expect(placeholders('{a} und {b} und {a}')).toEqual(['a', 'b']);
  });

  it('renders headings, lists, quotes and emphasis, escaping HTML', () => {
    const html = renderMarkdown('# Titel\n\nEin **fetter** und *kursiver* Text <script>.\n\n- eins\n- zwei\n\n> Merksatz');
    expect(html).toContain('<h2>Titel</h2>');
    expect(html).toContain('<strong>fetter</strong>');
    expect(html).toContain('<em>kursiver</em>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('<ul><li>eins</li><li>zwei</li></ul>');
    expect(html).toContain('<blockquote><p>Merksatz</p></blockquote>');
  });

  it('turns notation blocks into placeholders', () => {
    const html = renderMarkdown('```noten\nsystem: bass\ntonart: D-major\nnoten: C3 E3+G3\ntext: Beispiel\n```');
    expect(html).toContain('class="notation-example"');
    expect(parseNotation('system: grand\nnoten: C4+E4 G4')).toEqual({
      system: 'grand', key: null, steps: [['C4', 'E4'], ['G4']], rhythm: null, caption: '',
    });
  });
});

describe('content files', () => {
  it('has a lesson for every knowledge provider', () => {
    for (const provider of Object.values(KNOWLEDGE)) {
      expect(documentTitle(contentFile(provider.lesson))).not.toBe('');
    }
  });

  it('uses only valid notes and keys in notation examples', () => {
    for (const path of contentPaths()) {
      const blocks = [...contentFile(path).matchAll(/```noten\n([\s\S]*?)```/g)].map((m) => parseNotation(m[1]));
      for (const b of blocks) {
        if (b.key) expect(parseKeyId(b.key), `${path}: ${b.key}`).not.toBeNull();
        for (const id of b.steps.flat()) expect(parsePitchId(id), `${path}: ${id}`).not.toBeNull();
        if (b.rhythm) {
          for (const bar of parseRhythm(b.rhythm)) expect(barBeats(bar), `${path}: ${b.rhythm}`).toBe(4);
        }
      }
    }
  });

  it('reports missing sections', () => {
    expect(() => section('knowledge/keys', 'gibt-es-nicht')).toThrow(/gibt-es-nicht/);
  });
});

describe('knowledge providers', () => {
  it('produce complete tips and explanations for many real tasks of every mode', () => {
    for (const exercise of allExercises()) {
      const provider = KNOWLEDGE[exercise.id];
      expect(provider, exercise.id).toBeDefined();
      for (let i = 0; i < 150; i++) {
        const task: Task = exercise.nextTask();
        const tip = provider.tip(task);
        const explanation = provider.explain(task);
        expect(tip, task.label).toBeTruthy();
        expect(explanation, task.label).toBeTruthy();
        for (const text of [tip!, explanation!]) {
          expect(text, `${task.itemKey}: ${text}`).not.toMatch(/\{[a-zA-Z][\w-]*\}|undefined|NaN|: \?/);
        }
      }
    }
  });

  it('never gives away the answer in the tip', () => {
    for (const exercise of allExercises()) {
      const provider = KNOWLEDGE[exercise.id];
      for (let i = 0; i < 100; i++) {
        const task = exercise.nextTask();
        const tip = provider.tip(task)!;
        if (task.info?.kind === 'keysig') {
          expect(tip).not.toContain('-Dur');
          expect(tip).not.toContain('-Moll');
        } else {
          expect(tip, task.label).not.toContain(task.label);
        }
      }
    }
  });

  it('explains a key signature with the right rule', () => {
    const task = (fifths: number) => ({ ...allExercises()[4].nextTask(), info: { kind: 'keysig' as const, fifths } });
    expect(keyKnowledge.explain(task(3))).toContain('Das letzte ist **Gis**, einen Halbton darüber liegt **A**');
    expect(keyKnowledge.explain(task(-4))).toContain('Das vorletzte ist **As** → As-Dur');
    expect(keyKnowledge.explain(task(-1))).toContain('ein b = F-Dur');
    expect(keyKnowledge.explain(task(3))).toContain('**A-Dur / fis-Moll**');
    expect(keyKnowledge.explain(task(-3))).toContain('vor **H**'); // leading tone of c-Moll
  });

  it('explains chords with thirds, function and inversion', () => {
    const key = parseKeyId('C-major')!;
    const chordExercise = allExercises()[3];
    const am = { kind: 'chord' as const, chord: { key, degree: 6, seventh: false, tones: [p('A4'), p('C4'), p('E4')].map(({ step, alter }) => ({ step, alter })), quality: 'minor' as const }, inversion: 1, pitches: ['C4', 'E4', 'A4'].map(p) };
    const task = { ...chordExercise.nextTask(), key, info: am };
    const text = chordKnowledge.explain(task)!;
    expect(text).toContain('A–C: kleine Terz, C–E: große Terz');
    expect(text).toContain('Tonikaparallele');
    expect(text).toContain('Zwischen E und A entsteht dadurch eine Quarte');
    expect(chordKnowledge.tip(task)).toContain('keine Note von der Vorzeichnung betroffen');
  });

  it('explains intervals with semitones, sound and line/space picture', () => {
    const exercise = allExercises()[1];
    const task = exercise.nextTask();
    const info = { kind: 'interval' as const, lower: p('E4'), upper: p('G#4'), interval: { number: 3, quality: 'M' as const }, standard: 'M3', presentation: 'up' as const };
    const text = intervalKnowledge.explain({ ...task, layout: 'treble', key: parseKeyId('E-major')!, info })!;
    expect(text).toContain('**Große Terz** aufwärts: E4 – Gis4. Das sind **4 Halbtonschritte**');
    expect(text).toContain('beide auf Linien');
    expect(text).toContain('unten E (1. Stufe), oben Gis (3. Stufe)');
    expect(text).toContain('kleine Sexte');
    expect(intervalKnowledge.tip({ ...task, layout: 'treble', key: parseKeyId('E-major')!, info })).toContain('gilt hier für Gis');
  });

  it('describes note positions and landmarks', () => {
    expect(staffPosition(p('G4'), 'treble')).toBe('auf der 2. Linie');
    expect(staffPosition(p('C5'), 'treble')).toBe('im 3. Zwischenraum');
    expect(staffPosition(p('C4'), 'treble')).toBe('auf der 1. Hilfslinie unter dem System');
    expect(staffPosition(p('D4'), 'treble')).toBe('direkt unter dem System');
    expect(staffPosition(p('B3'), 'treble')).toBe('unter der 1. Hilfslinie unter dem System');
    expect(staffPosition(p('B5'), 'treble')).toBe('über der 1. Hilfslinie über dem System');
    expect(staffPosition(p('F3'), 'bass')).toBe('auf der 4. Linie');
    expect(nearestLandmark(p('B4'), 'treble')).toMatchObject({ name: 'C5', distance: -1 });
    expect(accidentalText(p('Bb4'))).toContain('erniedrigt H um einen Halbton zu **B**');
    const t = allExercises()[0].nextTask();
    expect(noteKnowledge.explain({ ...t, layout: 'treble', info: { kind: 'note', pitch: p('C8') } })).toContain('8va');
  });
});

describe('rhythm knowledge', () => {
  it('explains the performance with tendency', () => {
    const exercise = allExercises()[5];
    const task = exercise.nextTask();
    const expected = [0, 500, 1000];
    rhythmOutcomes.set(task, evaluateRhythm(expected, [-40, 460, 950], 30, 250));
    const text = rhythmKnowledge.explain(task)!;
    expect(text).toContain('0 von 3 Noten auf den Punkt – 3 zu früh');
    expect(text).toContain('43 ms zu früh');
    expect(text).toContain('**So wird gezählt:**');
  });
});

describe('statistics with help', () => {
  it('counts attempts with a tip separately', () => {
    const store = new StatsStore(memoryStorage());
    store.record('x', { ok: true, ms: 500 });
    store.record('x', { ok: true, ms: 900, assisted: true });
    store.record('x', { ok: false, ms: 900, assisted: true });
    const item = store.getItem('x')!;
    expect([item.hits, item.misses, item.assistedHits, item.assistedMisses]).toEqual([1, 0, 1, 1]);
    expect(item.hitTimeCount).toBe(1); // times with help do not count
    expect(item.recent.map((a) => a.help ?? false)).toEqual([false, true, true]);
  });

  it('loads statistics stored before help existed', () => {
    const storage = memoryStorage();
    storage.set('prima-vista.stats.v1', JSON.stringify({ version: 1, items: { y: { hits: 2, misses: 1, hitTimeSum: 10, hitTimeCount: 2, recent: [], confusions: {}, lastSeen: 1 } } }));
    expect(new StatsStore(storage).getItem('y')).toMatchObject({ hits: 2, assistedHits: 0, assistedMisses: 0 });
  });
});
