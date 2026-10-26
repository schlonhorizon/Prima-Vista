import { diatonicIndex, germanName, germanPitchClassName, samePitchClass, type Pitch, type PitchClass } from '../core/pitch';
import type { Task, TaskInfo } from '../exercises/types';
import {
  chordFunction,
  chordSymbol,
  inversionName,
  romanNumeral,
  type ChordQuality,
  type DiatonicChord,
} from '../theory/chords';
import {
  germanIntervalName,
  interval,
  intervalBetween,
  semitones,
  transposePitchClass,
  type Interval,
} from '../theory/interval';
import { fifthsOf, germanKeyName, keyFromFifths, keyScale, keySignature, type Key } from '../theory/key';
import { section } from './content';
import {
  accidentalText,
  capitalize,
  CLEF_NAMES,
  distanceText,
  listText,
  nearestLandmark,
  octaveName,
  onLine,
  placement,
  staffPosition,
} from './facts';
import { fill } from './markdown';

/** Tips, explanations and the lesson of one practice mode. */
export interface KnowledgeProvider {
  /** Content path of the lesson, e.g. "lessons/keys". */
  readonly lesson: string;
  /** Hint during the task (Markdown) – helps without giving away the answer. */
  tip(task: Task): string | null;
  /** Explanation after the answer (Markdown). */
  explain(task: Task): string | null;
}

/** Builds text from a template section of content/knowledge/<file>.md. */
function text(file: string, id: string, vars: Record<string, string> = {}): string {
  return fill(section(`knowledge/${file}`, id), vars);
}

function info<K extends TaskInfo['kind']>(task: Task, kind: K): Extract<TaskInfo, { kind: K }> | null {
  return task.info?.kind === kind ? (task.info as Extract<TaskInfo, { kind: K }>) : null;
}

/** Notes of `pitches` whose accidental comes from the key signature, as German names. */
function affectedBySignature(pitches: readonly Pitch[], key: Key | null): string[] {
  if (!key) return [];
  const sig = keySignature(fifthsOf(key));
  const names = pitches.filter((p) => p.alter !== 0 && sig[p.step] === p.alter).map((p) => germanPitchClassName(p));
  return [...new Set(names)];
}

function signatureHint(file: string, pitches: readonly Pitch[], key: Key | null): string {
  if (!key) return '';
  const affected = affectedBySignature(pitches, key);
  return affected.length > 0
    ? text(file, 'tipp.vorzeichnung', { toene: listText(affected) })
    : text(file, 'tipp.vorzeichnung-keine');
}

/** Degree of a pitch in the key, e.g. "3. Stufe" (raised 7th in minor: "erhöhte 7. Stufe (Leitton)"). */
function degreeText(p: PitchClass, key: Key): string {
  const scale = keyScale(key);
  const index = scale.findIndex((s) => samePitchClass(s, p));
  if (index >= 0) return `${index + 1}. Stufe`;
  if (key.mode === 'minor' && samePitchClass(transposePitchClass(key.tonic, interval('M7')), p)) {
    return 'erhöhte 7. Stufe (Leitton)';
  }
  return 'leiterfremd';
}

// --- Single notes ---------------------------------------------------------

export const noteKnowledge: KnowledgeProvider = {
  lesson: 'lessons/notes',

  tip(task) {
    const i = info(task, 'note');
    if (!i) return null;
    const { clef, written } = placement(task.layout, i.pitch);
    const landmark = nearestLandmark(written, clef, true);
    return text('notes', 'tipp', {
      schluessel: CLEF_NAMES[clef],
      orientierung: `${landmark.name} (${landmark.where})`,
      merksatz: text('notes', `merksatz.${clef}`),
    });
  },

  explain(task) {
    const i = info(task, 'note');
    if (!i) return null;
    const { clef, written, ottava } = placement(task.layout, i.pitch);
    const landmark = nearestLandmark(written, clef);
    return text('notes', 'erklaerung', {
      name: germanName(i.pitch),
      oktave: octaveName(i.pitch),
      schluessel: CLEF_NAMES[clef],
      lage: staffPosition(written, clef),
      orientierung: `${capitalize(distanceText(landmark.distance, landmark.name))} (${landmark.name}: ${landmark.where}).`,
      vorzeichen: accidentalText(i.pitch),
      oktavierung: ottava === 0 ? '' : text('notes', ottava > 0 ? 'oktavierung.hoch' : 'oktavierung.tief', {
        notiert: germanName(written),
      }),
    });
  },
};

// --- Intervals ------------------------------------------------------------

const QUALITY_INVERSION: Record<Interval['quality'], Interval['quality']> = {
  dd: 'AA', d: 'A', m: 'M', P: 'P', M: 'm', A: 'd', AA: 'dd',
};

function complementName(iv: Interval): string {
  if (iv.number > 8) return '';
  if (iv.number === 8) return 'reine Prime';
  return germanIntervalName({ number: 9 - iv.number, quality: QUALITY_INVERSION[iv.quality] });
}

/** Line/space picture of two notes on the same staff; empty if they are on different staves. */
function lineSpaceText(task: Task, lower: Pitch, upper: Pitch, number: number): string {
  const a = placement(task.layout, lower);
  const b = placement(task.layout, upper);
  if (a.clef !== b.clef || a.ottava !== b.ottava) return '';
  const la = onLine(a.written, a.clef);
  const lb = onLine(b.written, b.clef);
  const picture = la && lb ? 'beide auf Linien' : !la && !lb ? 'beide in Zwischenräumen' : 'eine auf einer Linie, eine im Zwischenraum';
  return text('intervals', la === lb ? 'notenbild.ungerade' : 'notenbild.gerade', { bild: picture, zahl: String(number) });
}

export const intervalKnowledge: KnowledgeProvider = {
  lesson: 'lessons/intervals',

  tip(task) {
    const i = info(task, 'interval');
    if (!i) return null;
    const a = placement(task.layout, i.lower);
    const b = placement(task.layout, i.upper);
    const sameStaff = a.clef === b.clef && a.ottava === b.ottava;
    return text('intervals', 'tipp', {
      linien: sameStaff ? text('intervals', onLine(a.written, a.clef) === onLine(b.written, b.clef) ? 'tipp.gleich' : 'tipp.verschieden') : '',
      vorzeichnung: signatureHint('intervals', [i.lower, i.upper], task.key),
    });
  },

  explain(task) {
    const i = info(task, 'interval');
    if (!i) return null;
    const direction = i.presentation === 'harm' ? 'zusammen angeschlagen' : i.presentation === 'up' ? 'aufwärts' : 'abwärts';
    const [first, second] = i.presentation === 'down' ? [i.upper, i.lower] : [i.lower, i.upper];
    return text('intervals', 'erklaerung', {
      name: capitalize(germanIntervalName(i.interval)),
      richtung: direction,
      toene: `${germanName(first)} – ${germanName(second)}`,
      halbtoene: String(semitones(i.interval)),
      klang: text('intervals', `${i.standard}.klang`),
      beispiel: text('intervals', `${i.standard}.beispiel`),
      notenbild: lineSpaceText(task, i.lower, i.upper, i.interval.number),
      tonart: task.key
        ? text('intervals', 'stufen', {
            tonart: germanKeyName(task.key),
            unten: `${germanPitchClassName(i.lower)} (${degreeText(i.lower, task.key)})`,
            oben: `${germanPitchClassName(i.upper)} (${degreeText(i.upper, task.key)})`,
          })
        : '',
      umkehrung: complementName(i.interval),
    });
  },
};

// --- Chords ---------------------------------------------------------------

const QUALITY_NAMES: Record<ChordQuality, string> = {
  major: 'Dur-Dreiklang', minor: 'Moll-Dreiklang', diminished: 'verminderter Dreiklang', augmented: 'übermäßiger Dreiklang',
  maj7: 'großer Septakkord (maj7)', min7: 'Moll-Septakkord (m7)', dom7: 'Dominantseptakkord (7)',
  halfdim7: 'halbverminderter Septakkord (m7♭5)', dim7: 'verminderter Septakkord (°7)',
  minmaj7: 'Moll-Dur-Septakkord (m(maj7))', augmaj7: 'übermäßiger großer Septakkord (+maj7)',
};

/** "A–C kleine Terz, C–E große Terz" */
function thirdsText(chord: DiatonicChord): string {
  const parts: string[] = [];
  for (let k = 1; k < chord.tones.length; k++) {
    const a = chord.tones[k - 1];
    const b = chord.tones[k];
    const lower: Pitch = { ...a, octave: 4 };
    let upper: Pitch = { ...b, octave: 4 };
    if (diatonicIndex(upper) <= diatonicIndex(lower)) upper = { ...b, octave: 5 };
    const iv = intervalBetween(lower, upper);
    parts.push(`${germanPitchClassName(a)}–${germanPitchClassName(b)}: ${iv ? germanIntervalName(iv) : '?'}`);
  }
  return parts.join(', ');
}

/** Why the inversion looks as it does, with the concrete notes. */
function inversionText(chord: DiatonicChord, inversion: number, pitches: readonly Pitch[]): string {
  const root = germanPitchClassName(chord.tones[0]);
  if (inversion === 0) return text('chords', 'lage.0', { grundton: root });
  const bass = germanPitchClassName(chord.tones[inversion]);
  // The root sits on top of the only fourth (triads) or second (seventh chords) in close position.
  const gapNumber = chord.seventh ? 2 : 4;
  let below = '';
  for (let k = 1; k < pitches.length; k++) {
    const iv = intervalBetween(pitches[k - 1], pitches[k]);
    if (iv?.number === gapNumber && samePitchClass(pitches[k], chord.tones[0])) below = germanPitchClassName(pitches[k - 1]);
  }
  return text('chords', chord.seventh ? 'lage.sept' : 'lage.drei', {
    bass,
    grundton: root,
    unten: below,
    figur: text('chords', `figur.${chord.seventh ? 7 : 3}.${inversion}`),
  });
}

export const chordKnowledge: KnowledgeProvider = {
  lesson: 'lessons/chords',

  tip(task) {
    const i = info(task, 'chord');
    if (!i) return null;
    return text('chords', 'tipp', {
      regel: text('chords', i.chord.seventh ? 'tipp.sept' : 'tipp.drei'),
      vorzeichnung: signatureHint('chords', i.pitches, task.key),
    });
  },

  explain(task) {
    const i = info(task, 'chord');
    if (!i) return null;
    const fn = chordFunction(i.chord);
    return text('chords', 'erklaerung', {
      symbol: chordSymbol(i.chord),
      stufe: romanNumeral(i.chord),
      funktion: fn,
      tonart: germanKeyName(i.chord.key),
      toene: i.pitches.map((p) => germanName(p)).join(' – '),
      art: QUALITY_NAMES[i.chord.quality],
      terzen: thirdsText(i.chord),
      funktionstext: text('chords', `funktion.${fn}`),
      lage: inversionName(i.inversion),
      lagetext: inversionText(i.chord, i.inversion, i.pitches),
    });
  },
};

// --- Key signatures -------------------------------------------------------

const SHARP_NAMES = ['Fis', 'Cis', 'Gis', 'Dis', 'Ais', 'Eis', 'His'];
const FLAT_NAMES = ['B', 'Es', 'As', 'Des', 'Ges', 'Ces', 'Fes'];

export const keyKnowledge: KnowledgeProvider = {
  lesson: 'lessons/keys',

  tip(task) {
    const i = info(task, 'keysig');
    if (!i) return null;
    const n = Math.abs(i.fifths);
    const id = i.fifths === 0 ? 'tipp.keine' : i.fifths > 0 ? 'tipp.kreuze' : i.fifths === -1 ? 'tipp.ein-b' : 'tipp.bs';
    return text('keys', id, { anzahl: String(n) });
  },

  explain(task) {
    const i = info(task, 'keysig');
    if (!i) return null;
    const f = i.fifths;
    const major = keyFromFifths(f, 'major');
    const minor = keyFromFifths(f, 'minor');
    const leadingTone = transposePitchClass(minor.tonic, interval('M7'));
    const vars: Record<string, string> = {
      anzahl: String(Math.abs(f)),
      dur: germanKeyName(major),
      moll: germanKeyName(minor),
      durton: germanPitchClassName(major.tonic),
      mollton: germanPitchClassName(minor.tonic),
      leitton: germanPitchClassName(leadingTone),
    };
    let rule: string;
    if (f === 0) rule = text('keys', 'regel.keine', vars);
    else if (f > 0) {
      rule = text('keys', 'regel.kreuze', {
        ...vars,
        liste: listText(SHARP_NAMES.slice(0, f)),
        letztes: SHARP_NAMES[f - 1],
      });
    } else if (f === -1) rule = text('keys', 'regel.ein-b', vars);
    else {
      rule = text('keys', 'regel.bs', {
        ...vars,
        liste: listText(FLAT_NAMES.slice(0, -f)),
        vorletztes: FLAT_NAMES[-f - 2],
      });
    }
    return text('keys', 'erklaerung', { ...vars, regel: rule });
  },
};

/** Knowledge per exercise id. */
export const KNOWLEDGE: Readonly<Record<string, KnowledgeProvider>> = {
  note: noteKnowledge,
  interval: intervalKnowledge,
  chord: chordKnowledge,
  keysig: keyKnowledge,
};
