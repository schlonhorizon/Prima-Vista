import { describe, expect, it } from 'vitest';
import { checkKeyAnswer, KeyQuizExercise, keyPairLabel, signatureLabel } from '../src/exercises/keyQuiz';
import { WeightedSelector } from '../src/exercises/selection';
import { fifthsOf, parseKeyId } from '../src/theory/key';

const key = (id: string) => parseKeyId(id)!;

function exercise(maxAccidentals: number) {
  let seed = 7;
  const random = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  return new KeyQuizExercise(() => ({ staff: 'treble', settings: { maxAccidentals, showCircle: true } }), new WeightedSelector({ random }));
}

describe('KeyQuizExercise', () => {
  it('shows a signature within the limit and is answered by choice', () => {
    const ex = exercise(3);
    const seen = new Set<number>();
    for (let i = 0; i < 300; i++) {
      const t = ex.nextTask();
      expect(t.answer).toBe('choice');
      expect(t.steps).toHaveLength(0);
      const f = fifthsOf(t.key!);
      expect(Math.abs(f)).toBeLessThanOrEqual(3);
      expect(t.itemKey).toBe(`keysig|${f}`);
      seen.add(f);
    }
    expect(seen.size).toBe(7);
  });

  it('accepts only the matching major and relative minor', () => {
    const t = { ...exercise(7).nextTask(), key: key('Eb-major') };
    expect(checkKeyAnswer(t, key('Eb-major'), key('C-minor'))).toBe(true);
    expect(checkKeyAnswer(t, key('Eb-major'), key('G-minor'))).toBe(false);
    expect(checkKeyAnswer(t, key('Bb-major'), key('C-minor'))).toBe(false);
    const sharp = { ...t, key: key('F#-major') };
    expect(checkKeyAnswer(sharp, key('F#-major'), key('D#-minor'))).toBe(true);
    expect(checkKeyAnswer(sharp, key('Gb-major'), key('Eb-minor'))).toBe(false); // enharmonic, but 6 ♭
  });

  it('labels signatures and key pairs in German', () => {
    expect(signatureLabel(-3)).toBe('3 ♭');
    expect(signatureLabel(0)).toBe('keine Vorzeichen');
    expect(keyPairLabel(-3)).toBe('Es-Dur / c-Moll');
    expect(keyPairLabel(7)).toBe('Cis-Dur / ais-Moll');
    expect(keyPairLabel(-7)).toBe('Ces-Dur / as-Moll');
  });

  it('groups statistics into sharp and flat keys', () => {
    const groups = exercise(7).statsGroups();
    expect(groups.map((g) => g.rows.length)).toEqual([8, 7]);
    expect(groups[1].rows[0].cells).toEqual(['1 ♭', 'F-Dur / d-Moll']);
  });
});
