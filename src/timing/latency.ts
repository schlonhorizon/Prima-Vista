/**
 * Input latency calibration: the player taps along with the metronome; the
 * median offset between taps and the nearest clicks is the latency to subtract
 * from all later taps (positive = taps arrive late).
 */
export function estimateLatency(taps: readonly number[], beats: readonly number[], maxOffsetMs = 250): number | null {
  const offsets = taps
    .map((t) => {
      let nearest = beats[0];
      for (const b of beats) if (Math.abs(t - b) < Math.abs(t - nearest)) nearest = b;
      return t - nearest;
    })
    .filter((o) => Math.abs(o) <= maxOffsetMs)
    .sort((a, b) => a - b);
  if (offsets.length < 4) return null;
  const mid = Math.floor(offsets.length / 2);
  const median = offsets.length % 2 ? offsets[mid] : (offsets[mid - 1] + offsets[mid]) / 2;
  return Math.round(median);
}
