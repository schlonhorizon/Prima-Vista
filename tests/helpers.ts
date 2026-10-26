import { samePitchClass, type Pitch } from '../src/core/pitch';

export { fifthsOf, keySignature, keyTones, parseKeyId } from '../src/theory/key';

/** True if two pitches have the same letter and accidental (a prime, not a real interval). */
export function samePitchClassInKey(a: Pitch, b: Pitch): boolean {
  return samePitchClass(a, b) && a.octave === b.octave;
}
