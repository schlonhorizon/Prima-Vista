import type { Pitch } from '../core/pitch';
import { interval, transpose } from './interval';

export type ScaleCategory = 'dur-moll' | 'pentatonik-blues' | 'kirchentonarten' | 'jazz';

export interface ScaleDefinition {
  readonly id: string;
  readonly name: string;
  /** Spelled intervals above the root, root first (P1). */
  readonly intervals: readonly string[];
  readonly category: ScaleCategory;
  /** What the scale is typically used for. */
  readonly description: string;
}

/**
 * Scale catalogue. Seven-tone scales use each letter exactly once, so they are
 * spelled correctly from every root. Add new scales by appending entries.
 */
export const SCALES: readonly ScaleDefinition[] = [
  {
    id: 'major', name: 'Dur', category: 'dur-moll',
    intervals: ['P1', 'M2', 'M3', 'P4', 'P5', 'M6', 'M7'],
    description: 'Grundlage der tonalen Musik; klingt hell und stabil.',
  },
  {
    id: 'natural-minor', name: 'Natürliches Moll', category: 'dur-moll',
    intervals: ['P1', 'M2', 'm3', 'P4', 'P5', 'm6', 'm7'],
    description: 'Moll ohne Leitton (Äolisch); Pop, Rock, Volkslied.',
  },
  {
    id: 'harmonic-minor', name: 'Harmonisches Moll', category: 'dur-moll',
    intervals: ['P1', 'M2', 'm3', 'P4', 'P5', 'm6', 'M7'],
    description: 'Moll mit Leitton; liefert die Dominante (V7) in Moll. Typisch: übermäßige Sekunde.',
  },
  {
    id: 'melodic-minor', name: 'Melodisches Moll', category: 'dur-moll',
    intervals: ['P1', 'M2', 'm3', 'P4', 'P5', 'M6', 'M7'],
    description: 'Klassisch aufwärts mit großer Sexte und Septime; im Jazz („Jazz-Moll“) in beide Richtungen.',
  },
  {
    id: 'major-pentatonic', name: 'Dur-Pentatonik', category: 'pentatonik-blues',
    intervals: ['P1', 'M2', 'M3', 'P5', 'M6'],
    description: 'Fünf Töne ohne Halbtonschritte; Folk, Pop, Country, Improvisation über Dur.',
  },
  {
    id: 'minor-pentatonic', name: 'Moll-Pentatonik', category: 'pentatonik-blues',
    intervals: ['P1', 'm3', 'P4', 'P5', 'm7'],
    description: 'Standard für Rock- und Blues-Improvisation über Moll und Dominanten.',
  },
  {
    id: 'blues', name: 'Blues-Tonleiter', category: 'pentatonik-blues',
    intervals: ['P1', 'm3', 'P4', 'd5', 'P5', 'm7'],
    description: 'Moll-Pentatonik mit „Blue Note“ (verminderte Quinte); Blues, Jazz, Rock.',
  },
  {
    id: 'ionian', name: 'Ionisch', category: 'kirchentonarten',
    intervals: ['P1', 'M2', 'M3', 'P4', 'P5', 'M6', 'M7'],
    description: 'Identisch mit Dur; im Jazz über maj7-Akkorde der I. Stufe.',
  },
  {
    id: 'dorian', name: 'Dorisch', category: 'kirchentonarten',
    intervals: ['P1', 'M2', 'm3', 'P4', 'P5', 'M6', 'm7'],
    description: 'Moll mit großer Sexte; über m7-Akkorde (ii in ii–V–I), Funk, Modal Jazz.',
  },
  {
    id: 'phrygian', name: 'Phrygisch', category: 'kirchentonarten',
    intervals: ['P1', 'm2', 'm3', 'P4', 'P5', 'm6', 'm7'],
    description: 'Moll mit kleiner Sekunde; Flamenco, spanisches Kolorit, Metal.',
  },
  {
    id: 'lydian', name: 'Lydisch', category: 'kirchentonarten',
    intervals: ['P1', 'M2', 'M3', 'A4', 'P5', 'M6', 'M7'],
    description: 'Dur mit übermäßiger Quarte; schwebend, Filmmusik, über maj7♯11.',
  },
  {
    id: 'mixolydian', name: 'Mixolydisch', category: 'kirchentonarten',
    intervals: ['P1', 'M2', 'M3', 'P4', 'P5', 'M6', 'm7'],
    description: 'Dur mit kleiner Septime; über Dominantseptakkorde, Rock, Blues, Folk.',
  },
  {
    id: 'aeolian', name: 'Äolisch', category: 'kirchentonarten',
    intervals: ['P1', 'M2', 'm3', 'P4', 'P5', 'm6', 'm7'],
    description: 'Identisch mit natürlichem Moll; über die vi. Stufe in Dur.',
  },
  {
    id: 'locrian', name: 'Lokrisch', category: 'kirchentonarten',
    intervals: ['P1', 'm2', 'm3', 'P4', 'd5', 'm6', 'm7'],
    description: 'Mit verminderter Quinte; über halbverminderte Akkorde (m7♭5).',
  },
  {
    id: 'bebop-dominant', name: 'Bebop-Dominante', category: 'jazz',
    intervals: ['P1', 'M2', 'M3', 'P4', 'P5', 'M6', 'm7', 'M7'],
    description: 'Mixolydisch mit zusätzlicher großer Septime als Durchgang; Achtel-Linien über V7.',
  },
  {
    id: 'altered', name: 'Alteriert', category: 'jazz',
    intervals: ['P1', 'm2', 'm3', 'd4', 'd5', 'm6', 'm7'],
    description: '7. Modus von melodisch Moll; über alterierte Dominanten (V7alt) mit ♭9, ♯9, ♭5, ♯5.',
  },
];

export function findScale(id: string): ScaleDefinition | undefined {
  return SCALES.find((s) => s.id === id);
}

/** Ascending scale tones from `root` (one octave, without the repeated root). */
export function buildScale(root: Pitch, scale: ScaleDefinition): Pitch[] {
  return scale.intervals.map((id) => transpose(root, interval(id)));
}
