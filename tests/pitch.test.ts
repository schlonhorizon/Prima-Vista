import { describe, expect, it } from 'vitest';
import { germanName, midiToPitch, parsePitchId, pitch, pitchId, toMidi, toVexKey } from '../src/core/pitch';
import { pitchesInRange } from '../src/core/range';

describe('pitch', () => {
  it('converts to MIDI', () => {
    expect(toMidi(pitch('C', 0, 4))).toBe(60);
    expect(toMidi(pitch('G', 0, 5))).toBe(79);
    expect(toMidi(pitch('B', -1, 3))).toBe(58);
    expect(toMidi(pitch('C', 1, 4))).toBe(61);
  });

  it('round-trips ids', () => {
    for (const id of ['C4', 'F#4', 'Bb3', 'G5']) expect(pitchId(parsePitchId(id)!)).toBe(id);
    expect(parsePitchId('X4')).toBeNull();
  });

  it('formats VexFlow keys and German names', () => {
    expect(toVexKey(pitch('F', 1, 4))).toBe('f#/4');
    expect(germanName(pitch('B', 0, 4))).toBe('H4');
    expect(germanName(pitch('B', -1, 4))).toBe('B4');
    expect(germanName(pitch('E', -1, 4))).toBe('Es4');
    expect(germanName(pitch('A', -1, 4))).toBe('As4');
    expect(germanName(pitch('D', -1, 4))).toBe('Des4');
    expect(germanName(pitch('F', 1, 4))).toBe('Fis4');
  });

  it('spells MIDI with sharps', () => {
    expect(pitchId(midiToPitch(60))).toBe('C4');
    expect(pitchId(midiToPitch(70))).toBe('A#4');
  });
});

describe('pitchesInRange', () => {
  const range = { low: pitch('C', 0, 4), high: pitch('G', 0, 5) };

  it('lists naturals C4–G5 by default', () => {
    expect(pitchesInRange(range, 'none').map(pitchId)).toEqual(
      ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5'],
    );
  });

  it('adds accidentals within the MIDI range', () => {
    const ids = pitchesInRange(range, 'both').map(pitchId);
    expect(ids).toContain('C#4');
    expect(ids).toContain('Bb4');
    expect(ids).not.toContain('Cb4');
    expect(ids).not.toContain('E#4');
    expect(ids).not.toContain('G#5');
    expect(ids).toContain('Gb5');
  });
});
