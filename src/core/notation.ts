import { CLEFS, clefPitch, type Clef } from './clef';
import { diatonicIndex, fromDiatonicIndex, pitch, type Pitch } from './pitch';

/** Which staff system is shown. */
export type StaffMode = 'treble' | 'bass' | 'grand';

export const STAFF_MODES: Record<StaffMode, { label: string }> = {
  treble: { label: 'Violinschlüssel' },
  bass: { label: 'Bassschlüssel' },
  grand: { label: 'Klaviersystem' },
};

/** Ledger lines drawn normally; notes further out get an ottava sign. */
export const MAX_LEDGER_LINES = 4;
/** Largest octave shift (2 = 15ma/15mb). */
export const MAX_OTTAVA = 2;

/** Lowest pitch the piano covers (A0) and highest (C8). */
export const PIANO_LOW = clefPitch('A0');
export const PIANO_HIGH = clefPitch('C8');

/** In the grand staff, pitches from this one upwards go to the treble staff. */
export const GRAND_SPLIT = clefPitch('C4');

/**
 * Octave shift of the written note: +1 = 8va (sounds an octave higher than
 * written), -1 = 8vb, ±2 = 15ma/15mb.
 */
export type Ottava = -2 | -1 | 0 | 1 | 2;

export interface StaffGroup {
  readonly clef: Clef;
  readonly ottava: Ottava;
  /** Sounding pitches. */
  readonly pitches: readonly Pitch[];
  /** Pitches as written on the staff (shifted by the ottava). */
  readonly written: readonly Pitch[];
}

/** Diatonic positions that fit on the staff with at most `ledgerLines` ledger lines. */
export function writableRange(clef: Clef, ledgerLines = MAX_LEDGER_LINES): { low: number; high: number } {
  const info = CLEFS[clef];
  // Each ledger line is two diatonic steps away; a note may hang just outside the last one.
  const reach = ledgerLines * 2 + 1;
  return {
    low: diatonicIndex(clefPitch(info.bottomLine)) - reach,
    high: diatonicIndex(clefPitch(info.topLine)) + reach,
  };
}

export function clefsOf(mode: StaffMode): Clef[] {
  return mode === 'grand' ? ['treble', 'bass'] : [mode];
}

export function clefForPitch(mode: StaffMode, p: Pitch): Clef {
  if (mode !== 'grand') return mode;
  return diatonicIndex(p) >= diatonicIndex(GRAND_SPLIT) ? 'treble' : 'bass';
}

/** Smallest octave shift that brings all pitches within the writable range (capped at ±2). */
export function chooseOttava(pitches: readonly Pitch[], clef: Clef): Ottava {
  if (pitches.length === 0) return 0;
  const { low, high } = writableRange(clef);
  const indices = pitches.map(diatonicIndex);
  const max = Math.max(...indices);
  const min = Math.min(...indices);
  if (max > high) return Math.min(MAX_OTTAVA, Math.ceil((max - high) / 7)) as Ottava;
  if (min < low) return -Math.min(MAX_OTTAVA, Math.ceil((low - min) / 7)) as Ottava;
  return 0;
}

export function shiftOctaves(p: Pitch, octaves: number): Pitch {
  return pitch(p.step, p.alter, p.octave + octaves);
}

/** Ledger lines a pitch needs on a clef (0 inside the staff). */
export function ledgerLines(p: Pitch, clef: Clef): number {
  const d = diatonicIndex(p);
  const bottom = diatonicIndex(clefPitch(CLEFS[clef].bottomLine));
  const top = diatonicIndex(clefPitch(CLEFS[clef].topLine));
  if (d > top) return Math.floor((d - top) / 2);
  if (d < bottom) return Math.floor((bottom - d) / 2);
  return 0;
}

/**
 * Staff for a whole chord in the grand staff when it crosses middle C: one hand
 * reads a chord best on one staff. Returns null if it does not fit on either
 * staff within the ledger-line limit (then the notes are split at C4).
 */
function grandStaffForChord(pitches: readonly Pitch[]): Clef | null {
  const clefs = new Set(pitches.map((p) => clefForPitch('grand', p)));
  if (clefs.size < 2) return null;
  const fits = (['treble', 'bass'] as const).filter((clef) => {
    const { low, high } = writableRange(clef);
    return pitches.every((p) => diatonicIndex(p) >= low && diatonicIndex(p) <= high);
  });
  if (fits.length === 0) return null;
  const cost = (clef: Clef) => Math.max(...pitches.map((p) => ledgerLines(p, clef)));
  return fits.reduce((best, clef) => (cost(clef) < cost(best) ? clef : best));
}

/** Distributes the pitches of one step onto the staves of a mode. */
export function placePitches(mode: StaffMode, pitches: readonly Pitch[]): StaffGroup[] {
  const together = mode === 'grand' ? grandStaffForChord(pitches) : null;
  return clefsOf(mode)
    .map((clef) => {
      const own = together
        ? together === clef ? [...pitches] : []
        : pitches.filter((p) => clefForPitch(mode, p) === clef);
      const ottava = chooseOttava(own, clef);
      return { clef, ottava, pitches: own, written: own.map((p) => shiftOctaves(p, -ottava)) };
    })
    .filter((g) => g.pitches.length > 0);
}

/** Range of pitches a mode can show (writable range ± two octaves of ottava, within the piano). */
export function displayableRange(mode: StaffMode): { low: Pitch; high: Pitch } {
  const clefs = clefsOf(mode);
  const low = Math.min(...clefs.map((c) => writableRange(c).low)) - 7 * MAX_OTTAVA;
  const high = Math.max(...clefs.map((c) => writableRange(c).high)) + 7 * MAX_OTTAVA;
  return {
    low: low > diatonicIndex(PIANO_LOW) ? fromDiatonicIndex(low) : PIANO_LOW,
    high: high < diatonicIndex(PIANO_HIGH) ? fromDiatonicIndex(high) : PIANO_HIGH,
  };
}

