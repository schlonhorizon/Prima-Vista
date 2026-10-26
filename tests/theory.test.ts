import { describe, expect, it } from 'vitest';
import {
  chroma,
  germanName,
  germanPitchClassName,
  parsePitchId,
  pitchClassId,
  pitchId,
  STEPS,
  toMidi,
  type PitchClass,
} from '../src/core/pitch';
import {
  chordFunction,
  chordSymbol,
  diatonicChord,
  inversionName,
  romanNumeral,
  voiceChord,
} from '../src/theory/chords';
import { germanIntervalName, interval, intervalBetween, intervalId, semitones, transpose } from '../src/theory/interval';
import {
  ALL_KEYS,
  fifthsOf,
  germanKeyName,
  keyFromFifths,
  keyScale,
  keySignature,
  keyTones,
  parseKeyId,
  keyId,
  relativeKey,
  vexKeySpec,
} from '../src/theory/key';
import { buildScale, SCALES, findScale } from '../src/theory/scales';

const p = (id: string) => parsePitchId(id)!;
const ids = (pcs: readonly PitchClass[]) => pcs.map(pitchClassId).join(' ');
const key = (id: string) => parseKeyId(id)!;

describe('pitch names', () => {
  it('names double accidentals in German', () => {
    expect(germanName(p('C##4'))).toBe('Cisis4');
    expect(germanName(p('Bbb3'))).toBe('Heses3');
    expect(germanName(p('Ebb3'))).toBe('Eses3');
    expect(germanName(p('Abb3'))).toBe('Asas3');
    expect(germanName(p('Fb3'))).toBe('Fes3');
    expect(germanName(p('B#3'))).toBe('His3');
    expect(toMidi(p('B#3'))).toBe(60);
    expect(toMidi(p('Cb4'))).toBe(59);
    expect(pitchId(p('F##2'))).toBe('F##2');
  });
});

describe('intervals', () => {
  it('computes semitones', () => {
    expect(['P1', 'm2', 'M2', 'm3', 'M3', 'P4', 'A4', 'd5', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'].map((i) => semitones(interval(i))))
      .toEqual([0, 1, 2, 3, 4, 5, 6, 6, 7, 8, 9, 10, 11, 12]);
    expect(semitones(interval('M10'))).toBe(16);
    expect(semitones(interval('d7'))).toBe(9);
  });

  it('measures the interval between two spelled pitches', () => {
    expect(intervalId(intervalBetween(p('C4'), p('E4'))!)).toBe('M3');
    expect(intervalId(intervalBetween(p('C#4'), p('E#4'))!)).toBe('M3');
    expect(intervalId(intervalBetween(p('C4'), p('F#4'))!)).toBe('A4');
    expect(intervalId(intervalBetween(p('C4'), p('Gb4'))!)).toBe('d5');
    expect(intervalId(intervalBetween(p('E4'), p('E5'))!)).toBe('P8');
    expect(intervalId(intervalBetween(p('B3'), p('C4'))!)).toBe('m2');
  });

  it('transposes with correct spelling', () => {
    expect(pitchId(transpose(p('C#4'), interval('M3')))).toBe('E#4');
    expect(pitchId(transpose(p('Ab3'), interval('M3')))).toBe('C4');
    expect(pitchId(transpose(p('D#4'), interval('M7')))).toBe('C##5');
    expect(pitchId(transpose(p('C4'), interval('m3'), -1))).toBe('A3');
    expect(pitchId(transpose(p('Gb4'), interval('P5'), -1))).toBe('Cb4');
    expect(() => transpose(p('B##4'), interval('A2'))).toThrow();
  });

  it('names intervals in German', () => {
    expect(germanIntervalName(interval('M3'))).toBe('große Terz');
    expect(germanIntervalName(interval('P5'))).toBe('reine Quinte');
    expect(germanIntervalName(interval('A4'))).toBe('übermäßige Quarte');
    expect(germanIntervalName(interval('m2'))).toBe('kleine Sekunde');
    expect(germanIntervalName(interval('P8'))).toBe('reine Oktave');
  });
});

describe('keys', () => {
  it('has 15 major and 15 minor keys', () => {
    expect(ALL_KEYS.filter((k) => k.mode === 'major').map((k) => germanKeyName(k))).toEqual([
      'Ces-Dur', 'Ges-Dur', 'Des-Dur', 'As-Dur', 'Es-Dur', 'B-Dur', 'F-Dur', 'C-Dur',
      'G-Dur', 'D-Dur', 'A-Dur', 'E-Dur', 'H-Dur', 'Fis-Dur', 'Cis-Dur',
    ]);
    expect(ALL_KEYS.filter((k) => k.mode === 'minor').map((k) => germanKeyName(k))).toEqual([
      'as-Moll', 'es-Moll', 'b-Moll', 'f-Moll', 'c-Moll', 'g-Moll', 'd-Moll', 'a-Moll',
      'e-Moll', 'h-Moll', 'fis-Moll', 'cis-Moll', 'gis-Moll', 'dis-Moll', 'ais-Moll',
    ]);
  });

  it('pairs relative keys', () => {
    expect(germanKeyName(relativeKey(key('Eb-major')))).toBe('c-Moll');
    expect(germanKeyName(relativeKey(key('F#-minor')))).toBe('A-Dur');
    expect(germanKeyName(relativeKey(key('C#-major')))).toBe('ais-Moll');
    expect(germanKeyName(relativeKey(key('Cb-major')))).toBe('as-Moll');
  });

  it('round-trips ids and signatures', () => {
    for (const k of ALL_KEYS) {
      expect(parseKeyId(keyId(k))).toEqual(k);
      expect(keyFromFifths(fifthsOf(k), k.mode)).toEqual(k);
    }
    expect(parseKeyId('D#-major')).toBeNull(); // would need 9 sharps
    expect(vexKeySpec(-3)).toBe('Eb');
    expect(vexKeySpec(7)).toBe('C#');
  });

  it('spells every scale with seven different letters matching the key signature', () => {
    for (const k of ALL_KEYS) {
      const scale = keyScale(k);
      expect(new Set(scale.map((s) => s.step)).size, germanKeyName(k)).toBe(7);
      const sig = keySignature(fifthsOf(k));
      for (const tone of scale) expect(tone.alter, `${germanKeyName(k)} ${pitchClassId(tone)}`).toBe(sig[tone.step]);
    }
  });

  it('uses Eis and His in Cis-Dur, Fes and Ces in Ces-Dur', () => {
    expect(ids(keyScale(key('C#-major')))).toBe('C# D# E# F# G# A# B#');
    expect(keyScale(key('C#-major')).map(germanPitchClassName)).toContain('Eis');
    expect(keyScale(key('C#-major')).map(germanPitchClassName)).toContain('His');
    expect(ids(keyScale(key('Cb-major')))).toBe('Cb Db Eb Fb Gb Ab Bb');
    expect(ids(keyScale(key('Gb-major')))).toBe('Gb Ab Bb Cb Db Eb F');
    expect(ids(keyScale(key('F#-major')))).toBe('F# G# A# B C# D# E#');
  });

  it('raises the leading tone in minor with double sharps where needed', () => {
    expect(ids(keyTones(key('A-minor')))).toBe('A B C D E F G G#');
    expect(ids(keyTones(key('D#-minor')))).toBe('D# E# F# G# A# B C# C##');
    expect(ids(keyTones(key('A#-minor')))).toBe('A# B# C# D# E# F# G# G##');
    expect(ids(keyTones(key('G#-minor')))).toBe('G# A# B C# D# E F# F##');
    expect(ids(keyTones(key('Eb-minor')))).toBe('Eb F Gb Ab Bb Cb Db D');
  });

  it('keeps semitone classes consistent', () => {
    // C# major and Db major sound the same
    expect(keyScale(key('C#-major')).map(chroma)).toEqual(keyScale(key('Db-major')).map(chroma));
    expect(keyScale(key('B-major')).map(chroma)).toEqual(keyScale(key('Cb-major')).map(chroma));
  });
});

describe('scale catalogue', () => {
  const from = (id: string, root = 'C4') => buildScale(p(root), findScale(id)!).map((x) => pitchClassId(x)).join(' ');

  it('builds every scale from C', () => {
    expect(from('major')).toBe('C D E F G A B');
    expect(from('natural-minor')).toBe('C D Eb F G Ab Bb');
    expect(from('harmonic-minor')).toBe('C D Eb F G Ab B');
    expect(from('melodic-minor')).toBe('C D Eb F G A B');
    expect(from('major-pentatonic')).toBe('C D E G A');
    expect(from('minor-pentatonic')).toBe('C Eb F G Bb');
    expect(from('blues')).toBe('C Eb F Gb G Bb');
    expect(from('dorian')).toBe('C D Eb F G A Bb');
    expect(from('phrygian')).toBe('C Db Eb F G Ab Bb');
    expect(from('lydian')).toBe('C D E F# G A B');
    expect(from('mixolydian')).toBe('C D E F G A Bb');
    expect(from('locrian')).toBe('C Db Eb F Gb Ab Bb');
    expect(from('bebop-dominant')).toBe('C D E F G A Bb B');
    expect(from('altered')).toBe('C Db Eb Fb Gb Ab Bb');
  });

  it('spells scales correctly from remote roots', () => {
    expect(from('harmonic-minor', 'G#4')).toBe('G# A# B C# D# E F##');
    expect(from('lydian', 'F#4')).toBe('F# G# A# B# C# D# E#');
    expect(from('altered', 'G4')).toBe('G Ab Bb Cb Db Eb F');
  });

  it('describes every scale and uses unique letters in seven-tone scales', () => {
    for (const s of SCALES) {
      expect(s.description.length).toBeGreaterThan(10);
      if (s.intervals.length === 7) {
        for (const r of STEPS) {
          const tones = buildScale(p(`${r}4`), s);
          expect(new Set(tones.map((t) => t.step)).size, `${s.id} on ${r}`).toBe(7);
        }
      }
    }
  });
});

describe('diatonic chords', () => {
  const symbols = (k: string, seventh: boolean) =>
    [1, 2, 3, 4, 5, 6, 7].map((d) => chordSymbol(diatonicChord(key(k), d, seventh))).join(' ');
  const romans = (k: string, seventh: boolean) =>
    [1, 2, 3, 4, 5, 6, 7].map((d) => romanNumeral(diatonicChord(key(k), d, seventh))).join(' ');
  const functions = (k: string, seventh: boolean) =>
    [1, 2, 3, 4, 5, 6, 7].map((d) => chordFunction(diatonicChord(key(k), d, seventh))).join(' ');

  it('builds triads and sevenths in C major', () => {
    expect(symbols('C-major', false)).toBe('C Dm Em F G Am B°');
    expect(symbols('C-major', true)).toBe('Cmaj7 Dm7 Em7 Fmaj7 G7 Am7 Bm7♭5');
    expect(romans('C-major', false)).toBe('I ii iii IV V vi vii°');
    expect(romans('C-major', true)).toBe('Imaj7 ii7 iii7 IVmaj7 V7 vi7 viiø7');
    expect(functions('C-major', false)).toBe('T Sp Dp S D Tp Dv');
    expect(functions('C-major', true)).toBe('T Sp Dp S D⁷ Tp Dv⁹');
  });

  it('builds minor chords with dominant from harmonic minor', () => {
    expect(symbols('A-minor', false)).toBe('Am B° C Dm E F G♯°');
    expect(symbols('A-minor', true)).toBe('Am7 Bm7♭5 Cmaj7 Dm7 E7 Fmaj7 G♯°7');
    expect(romans('A-minor', true)).toBe('i7 iiø7 IIImaj7 iv7 V7 VImaj7 vii°7');
    expect(functions('A-minor', false)).toBe('t s⁶ tP s D sP Dv');
  });

  it('spells chords enharmonically correct in remote keys', () => {
    expect(symbols('C#-major', true)).toBe('C♯maj7 D♯m7 E♯m7 F♯maj7 G♯7 A♯m7 B♯m7♭5');
    expect(symbols('Cb-major', false)).toBe('C♭ D♭m E♭m F♭ G♭ A♭m B♭°');
    expect(symbols('D#-minor', true)).toBe('D♯m7 E♯m7♭5 F♯maj7 G♯m7 A♯7 Bmaj7 C𝄪°7');
    expect(diatonicChord(key('Eb-minor'), 7, true).tones.map(pitchClassId).join(' ')).toBe('D F Ab Cb');
  });

  it('voices inversions in close position', () => {
    const am = diatonicChord(key('C-major'), 6, false);
    expect(voiceChord(am, 0, 3).map(pitchId)).toEqual(['A3', 'C4', 'E4']);
    expect(voiceChord(am, 1, 4).map(pitchId)).toEqual(['C4', 'E4', 'A4']);
    expect(voiceChord(am, 2, 4).map(pitchId)).toEqual(['E4', 'A4', 'C5']);
    const g7 = diatonicChord(key('C-major'), 5, true);
    expect(voiceChord(g7, 3, 3).map(pitchId)).toEqual(['F3', 'G3', 'B3', 'D4']);
    const bsharp = diatonicChord(key('C#-major'), 7, false);
    expect(voiceChord(bsharp, 0, 3).map(pitchId)).toEqual(['B#3', 'D#4', 'F#4']);
    expect(inversionName(0)).toBe('Grundstellung');
    expect(inversionName(1)).toBe('1. Umkehrung');
  });

  it('works for every key, degree and inversion', () => {
    for (const k of ALL_KEYS) {
      for (let d = 1; d <= 7; d++) {
        for (const seventh of [false, true]) {
          const c = diatonicChord(k, d, seventh);
          expect(chordSymbol(c)).toBeTruthy();
          for (let inv = 0; inv < c.tones.length; inv++) {
            const v = voiceChord(c, inv, 4);
            for (let i = 1; i < v.length; i++) expect(toMidi(v[i])).toBeGreaterThan(toMidi(v[i - 1]));
          }
        }
      }
    }
  });
});
