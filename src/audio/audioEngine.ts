/**
 * Web Audio output, purely synthetic (no sample files). Times are given on the
 * performance.now() clock and converted to the audio clock, so all timing in the
 * app shares one base with the input events.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  /** Creates/resumes the AudioContext; call from a user gesture (browser autoplay rules). */
  async ensureRunning(): Promise<boolean> {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return false;
        this.ctx = new Ctor({ latencyHint: 'interactive' });
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state !== 'running') await this.ctx.resume();
      return this.ctx.state === 'running';
    } catch {
      return false;
    }
  }

  setVolume(volume: number): void {
    if (this.master) this.master.gain.value = Math.max(0, Math.min(1, volume));
  }

  /** Converts a performance.now() time (ms) to AudioContext time (s). */
  toAudioTime(perfMs: number): number {
    const ctx = this.ctx!;
    const stamp = typeof ctx.getOutputTimestamp === 'function' ? ctx.getOutputTimestamp() : null;
    if (stamp && stamp.performanceTime && stamp.contextTime !== undefined) {
      return stamp.contextTime + (perfMs - stamp.performanceTime) / 1000;
    }
    return ctx.currentTime + (perfMs - performance.now()) / 1000;
  }

  /** A short wooden click; accented clicks are higher and a little louder. */
  click(perfMs: number, accent: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || ctx.state !== 'running') return;
    const t = Math.max(ctx.currentTime, this.toAudioTime(perfMs));
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(accent ? 1760 : 1320, t);
    osc.frequency.exponentialRampToValueAtTime(accent ? 1100 : 880, t + 0.03);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.9 : 0.6, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.07);
  }
}
