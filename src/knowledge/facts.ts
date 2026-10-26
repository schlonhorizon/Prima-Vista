import { CLEFS, clefPitch, type Clef } from '../core/clef';
import { placePitches, type StaffMode } from '../core/notation';
import { diatonicIndex, germanName, germanPitchClassName, type Pitch } from '../core/pitch';
import { section } from './content';
import { fill } from './markdown';

/** Where a written note sits, from the bottom line: "auf der 2. Linie", "im 3. Zwischenraum" … */
export function staffPosition(written: Pitch, clef: Clef): string {
  const d = diatonicIndex(written) - diatonicIndex(clefPitch(CLEFS[clef].bottomLine));
  if (d >= 0 && d <= 8) return d % 2 === 0 ? `auf der ${d / 2 + 1}. Linie` : `im ${(d + 1) / 2}. Zwischenraum`;
  const below = d < 0;
  const k = below ? -d : d - 8;
  const side = below ? 'unter' : 'über';
  if (k % 2 === 0) return `auf der ${k / 2}. Hilfslinie ${side} dem System`;
  if (k === 1) return `direkt ${side} dem System`;
  return `${side} der ${(k - 1) / 2}. Hilfslinie ${side} dem System`;
}

/** True if the written note sits on a line (staff line or ledger line). */
export function onLine(written: Pitch, clef: Clef): boolean {
  const d = diatonicIndex(written) - diatonicIndex(clefPitch(CLEFS[clef].bottomLine));
  return ((d % 2) + 2) % 2 === 0;
}

interface Landmark {
  pitch: string;
  where: string;
}

/** Orientation notes per clef ("Orientierungsnoten"). */
const LANDMARKS: Record<Clef, Landmark[]> = {
  treble: [
    { pitch: 'A3', where: 'zwei Hilfslinien unter dem System' },
    { pitch: 'C4', where: 'eine Hilfslinie unter dem System' },
    { pitch: 'G4', where: '2. Linie – um sie kringelt sich der G-Schlüssel' },
    { pitch: 'C5', where: '3. Zwischenraum' },
    { pitch: 'F5', where: 'oberste Linie' },
    { pitch: 'A5', where: 'eine Hilfslinie über dem System' },
    { pitch: 'C6', where: 'zwei Hilfslinien über dem System' },
  ],
  bass: [
    { pitch: 'C2', where: 'zwei Hilfslinien unter dem System' },
    { pitch: 'E2', where: 'eine Hilfslinie unter dem System' },
    { pitch: 'G2', where: 'unterste Linie' },
    { pitch: 'C3', where: '2. Zwischenraum' },
    { pitch: 'F3', where: '4. Linie – zwischen den Punkten des F-Schlüssels' },
    { pitch: 'C4', where: 'eine Hilfslinie über dem System' },
    { pitch: 'E4', where: 'zwei Hilfslinien über dem System' },
  ],
};

/** Nearest orientation note; with `excludeSelf` never the note itself (tips must not reveal it). */
export function nearestLandmark(
  written: Pitch,
  clef: Clef,
  excludeSelf = false,
): { name: string; where: string; distance: number } {
  const d = diatonicIndex(written);
  const candidates = LANDMARKS[clef].filter((l) => !excludeSelf || diatonicIndex(clefPitch(l.pitch)) !== d);
  let best = candidates[0];
  for (const l of candidates) {
    if (Math.abs(diatonicIndex(clefPitch(l.pitch)) - d) < Math.abs(diatonicIndex(clefPitch(best.pitch)) - d)) best = l;
  }
  const lp = clefPitch(best.pitch);
  return { name: germanName(lp), where: best.where, distance: d - diatonicIndex(lp) };
}

/** "zwei Stufen über G4" / "genau G4" */
export function distanceText(distance: number, landmark: string): string {
  if (distance === 0) return `genau die Orientierungsnote ${landmark}`;
  const n = Math.abs(distance);
  const words = ['', 'eine Stufe', 'zwei Stufen', 'drei Stufen', 'vier Stufen'];
  return `${words[n] ?? `${n} Stufen`} ${distance > 0 ? 'über' : 'unter'} ${landmark}`;
}

const OCTAVE_NAMES = [
  'Subkontra-Oktave', 'Kontra-Oktave', 'große Oktave', 'kleine Oktave', 'eingestrichene Oktave',
  'zweigestrichene Oktave', 'dreigestrichene Oktave', 'viergestrichene Oktave', 'fünfgestrichene Oktave',
];

export function octaveName(p: Pitch): string {
  return OCTAVE_NAMES[p.octave] ?? `${p.octave}. Oktave`;
}

/** Explains an accidental, e.g. "Das Kreuz (♯) erhöht F um einen Halbton zu Fis." */
export function accidentalText(p: Pitch): string {
  if (p.alter === 0) return '';
  const stem = germanPitchClassName({ step: p.step, alter: 0 });
  const ids: Record<number, string> = { 1: 'kreuz', 2: 'doppelkreuz', [-1]: 'be', [-2]: 'doppelbe' };
  return fill(section('knowledge/notes', `vorzeichen.${ids[p.alter]}`), { stamm: stem, name: germanPitchClassName(p) });
}

/** Clef and written pitch of a single note in the given staff system. */
export function placement(layout: StaffMode, p: Pitch): { clef: Clef; written: Pitch; ottava: number } {
  const [g] = placePitches(layout, [p]);
  return { clef: g.clef, written: g.written[0], ottava: g.ottava };
}

export const CLEF_NAMES: Record<Clef, string> = { treble: 'Violinschlüssel', bass: 'Bassschlüssel' };

/** Lists words naturally: "A, B und C". */
export function listText(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} und ${items[items.length - 1]}`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
