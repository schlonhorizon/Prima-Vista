import { describe, expect, it } from 'vitest';
import { chooseOttava, clefForPitch, displayableRange, placePitches, writableRange } from '../src/core/notation';
import { diatonicIndex, parsePitchId, pitchId } from '../src/core/pitch';

const p = (id: string) => parsePitchId(id)!;
const place = (mode: 'treble' | 'bass' | 'grand', id: string) => {
  const [g] = placePitches(mode, [p(id)]);
  return { clef: g.clef, ottava: g.ottava, written: pitchId(g.written[0]) };
};

describe('writableRange (4 ledger lines)', () => {
  it('treble: C3 … A6, bass: E1 … C5', () => {
    expect(writableRange('treble')).toEqual({ low: diatonicIndex(p('C3')), high: diatonicIndex(p('A6')) });
    expect(writableRange('bass')).toEqual({ low: diatonicIndex(p('E1')), high: diatonicIndex(p('C5')) });
  });
});

describe('grand staff placement', () => {
  it('puts C4 and above into the treble staff, below into the bass staff', () => {
    expect(clefForPitch('grand', p('C4'))).toBe('treble');
    expect(clefForPitch('grand', p('B3'))).toBe('bass');
    expect(clefForPitch('grand', p('Bb3'))).toBe('bass');
    expect(clefForPitch('grand', p('C#4'))).toBe('treble');
  });

  it('writes notes within 4 ledger lines normally', () => {
    expect(place('grand', 'A6')).toEqual({ clef: 'treble', ottava: 0, written: 'A6' });
    expect(place('grand', 'E1')).toEqual({ clef: 'bass', ottava: 0, written: 'E1' });
  });

  it('uses 8va / 8vb beyond that', () => {
    expect(place('grand', 'B6')).toEqual({ clef: 'treble', ottava: 1, written: 'B5' });
    expect(place('grand', 'A7')).toEqual({ clef: 'treble', ottava: 1, written: 'A6' });
    expect(place('grand', 'D1')).toEqual({ clef: 'bass', ottava: -1, written: 'D2' });
    expect(place('grand', 'A0')).toEqual({ clef: 'bass', ottava: -1, written: 'A1' });
  });

  it('falls back to 15ma for the top of the piano', () => {
    expect(place('grand', 'C8')).toEqual({ clef: 'treble', ottava: 2, written: 'C6' });
  });
});

describe('single staff modes', () => {
  it('treble: low notes get 8vb', () => {
    expect(place('treble', 'C3').ottava).toBe(0);
    expect(place('treble', 'B2')).toEqual({ clef: 'treble', ottava: -1, written: 'B3' });
  });

  it('bass: high notes get 8va', () => {
    expect(place('bass', 'C5').ottava).toBe(0);
    expect(place('bass', 'D5')).toEqual({ clef: 'bass', ottava: 1, written: 'D4' });
  });

  it('chooseOttava keeps notes inside the staff unshifted', () => {
    expect(chooseOttava([p('G4')], 'treble')).toBe(0);
  });

  it('limits the displayable range to two ottava octaves', () => {
    expect(pitchId(displayableRange('treble').low)).toBe('C1');
    expect(pitchId(displayableRange('treble').high)).toBe('C8');
    expect(pitchId(displayableRange('bass').low)).toBe('A0');
    expect(pitchId(displayableRange('bass').high)).toBe('C7');
    expect(pitchId(displayableRange('grand').low)).toBe('A0');
    expect(pitchId(displayableRange('grand').high)).toBe('C8');
  });

  it('keeps a chord across middle C on one staff', () => {
    const groups = placePitches('grand', ['F##3', 'A#3', 'C#4', 'E4'].map(p));
    expect(groups).toHaveLength(1);
    expect(groups[0].clef).toBe('bass'); // E4 needs 2 ledger lines in bass, F##3 needs 3 in treble
    const low = placePitches('grand', ['G3', 'B3', 'D4'].map(p));
    expect(low.map((g) => g.clef)).toEqual(['bass']);
    // too wide for one staff without ottava: split at C4
    expect(placePitches('grand', ['C2', 'C6'].map(p)).map((g) => g.clef)).toEqual(['treble', 'bass']);
  });
});
