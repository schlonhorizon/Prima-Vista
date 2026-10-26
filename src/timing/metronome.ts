import type { AudioEngine } from '../audio/audioEngine';
import { beatToTime, beatsInWindow, type Transport } from './transport';

export interface BeatInfo {
  /** Beat index from the transport start (0 = first count-in beat). */
  readonly index: number;
  readonly time: number;
  readonly beatInBar: number;
  readonly accent: boolean;
}

export interface MetronomeOptions {
  /** Play clicks (the visual pulse always runs). */
  sound: boolean;
  /** Last beat index to click (inclusive). */
  lastBeat: number;
}

const LOOKAHEAD_MS = 120;
const TICK_MS = 25;

/**
 * Look-ahead scheduler on a Transport: audio clicks are scheduled ahead of time
 * (sample-accurate), visual beat callbacks fire at the beat via timers. Reusable by
 * every timed exercise (rhythm, phrases, reading ahead, sight-reading).
 */
export class Metronome {
  private timer: number | undefined;
  private visualTimers: number[] = [];
  private scheduledUpTo = -1;
  private transport: Transport | null = null;
  private listeners = new Set<(beat: BeatInfo) => void>();

  constructor(private audio: AudioEngine | null) {}

  onBeat(listener: (beat: BeatInfo) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(transport: Transport, options: MetronomeOptions): void {
    this.stop();
    this.transport = transport;
    this.scheduledUpTo = -1;
    const tick = () => {
      const now = performance.now();
      for (const index of beatsInWindow(transport, now - 5, now + LOOKAHEAD_MS, options.lastBeat)) {
        if (index <= this.scheduledUpTo) continue;
        this.scheduledUpTo = index;
        const time = beatToTime(transport, index);
        const beat: BeatInfo = {
          index,
          time,
          beatInBar: index % transport.beatsPerBar,
          accent: index % transport.beatsPerBar === 0,
        };
        if (options.sound) this.audio?.click(time, beat.accent);
        this.visualTimers.push(window.setTimeout(() => this.listeners.forEach((l) => l(beat)), Math.max(0, time - performance.now())));
      }
      if (this.scheduledUpTo >= options.lastBeat) window.clearInterval(this.timer);
    };
    tick();
    this.timer = window.setInterval(tick, TICK_MS);
  }

  stop(): void {
    window.clearInterval(this.timer);
    this.visualTimers.forEach((t) => window.clearTimeout(t));
    this.visualTimers = [];
    this.transport = null;
  }

  isRunning(): boolean {
    return this.transport !== null;
  }
}
