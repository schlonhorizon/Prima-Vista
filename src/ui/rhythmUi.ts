import type { AudioEngine } from '../audio/audioEngine';
import type { Task } from '../exercises/types';
import { rhythmOutcomes } from '../knowledge/providers';
import type { InputHub } from '../input/inputHub';
import { RhythmRenderer, type RhythmMarks } from '../render/rhythmRenderer';
import { rhythmItemKey } from '../rhythm/cells';
import { evaluateRhythm, type RhythmEvaluation } from '../rhythm/evaluate';
import { expectedNotes, patternBars, type RhythmPattern } from '../rhythm/generator';
import type { RhythmSettings } from '../settings';
import { estimateLatency } from '../timing/latency';
import { Metronome, type BeatInfo } from '../timing/metronome';
import { beatMs, beatToTime, type Transport } from '../timing/transport';
import type { Trainer } from '../trainer/trainer';

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

type Phase = 'idle' | 'ready' | 'countIn' | 'playing' | 'done' | 'calibrating';

interface Run {
  transport: Transport;
  countInBeats: number;
  totalBeats: number;
  expected: number[];
  cellOfNote: number[];
  taps: number[];
  endTimer: number;
}

const START_DELAY_MS = 450;
const CALIBRATION_BPM = 90;
const CALIBRATION_BEATS = 12;

/**
 * Practice loop of the rhythm mode: shows the rhythm, starts metronome and
 * count-in on the first tap, records taps (MIDI, computer keyboard, space bar,
 * tap pad), evaluates them per note and reports the result to the trainer.
 */
export class RhythmUi {
  private phase: Phase = 'idle';
  private task: Task | null = null;
  private run: Run | null = null;
  private metronome: Metronome;
  private notation: RhythmRenderer;
  private resumeBlockedUntil = 0;
  private calibration: { transport: Transport; taps: number[]; beats: number[]; timer: number } | null = null;

  constructor(
    hub: InputHub,
    private audio: AudioEngine,
    private trainer: Trainer,
    private settings: () => RhythmSettings,
    private saveLatency: (ms: number) => void,
  ) {
    this.metronome = new Metronome(audio);
    this.metronome.onBeat((beat) => this.onBeat(beat));
    this.notation = new RhythmRenderer($('staff'));
    hub.subscribe((e) => {
      if (e.type === 'on') this.input(e.time);
    });
    $('rhythm-pad').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.input(e.timeStamp || performance.now());
    });
    $('calibrate-button').addEventListener('click', (e) => {
      (e.currentTarget as HTMLElement).blur();
      void this.startCalibration();
    });
  }

  isActive(): boolean {
    return this.phase !== 'idle';
  }

  /** A rhythm task is shown (or another mode: task = null). */
  show(task: Task | null): void {
    this.stopRun();
    this.task = task;
    if (!task || task.info?.kind !== 'rhythm') {
      this.phase = 'idle';
      return;
    }
    this.phase = 'ready';
    this.notation.render(patternBars(task.info.pattern, task.info.bars));
    this.setStatus('Bereit – tippe, um das Einzählen zu starten.', '');
    this.setCount('');
  }

  /** Redraw after a resize. */
  redraw(): void {
    if (this.task?.info?.kind === 'rhythm' && this.phase !== 'done') {
      this.notation.render(patternBars(this.task.info.pattern, this.task.info.bars));
    }
  }

  /** The task was skipped or the mode left. */
  abort(): void {
    this.stopRun();
    if (this.phase !== 'idle') this.phase = 'done';
  }

  /** Space bar, a key, a MIDI note or the pad. */
  input(time: number): void {
    const t = time - this.settings().latencyMs;
    switch (this.phase) {
      case 'ready':
        void this.startRun();
        break;
      case 'countIn':
      case 'playing':
        this.run?.taps.push(t);
        this.flashPad();
        break;
      case 'done':
        if (performance.now() >= this.resumeBlockedUntil && this.trainer.isHeld()) this.trainer.resume();
        break;
      case 'calibrating':
        this.calibration?.taps.push(time); // raw time: this is what we measure
        this.flashPad();
        break;
    }
  }

  // --- performing ---------------------------------------------------------

  private async startRun(): Promise<void> {
    const task = this.task;
    if (!task || task.info?.kind !== 'rhythm') return;
    const s = this.settings();
    this.phase = 'countIn';
    if (s.sound) {
      await this.audio.ensureRunning();
      this.audio.setVolume(s.volume / 100);
    }
    const pattern: RhythmPattern = task.info.pattern;
    const countInBeats = s.countIn * pattern.beatsPerBar;
    const transport: Transport = {
      bpm: task.info.bpm,
      beatsPerBar: pattern.beatsPerBar,
      startTime: performance.now() + START_DELAY_MS,
    };
    const notes = expectedNotes(pattern);
    const totalBeats = countInBeats + task.info.bars * pattern.beatsPerBar;
    const endTime = beatToTime(transport, totalBeats) + Math.min(300, beatMs(transport) / 2);
    this.run = {
      transport,
      countInBeats,
      totalBeats,
      expected: notes.map((n) => beatToTime(transport, countInBeats + n.beat)),
      cellOfNote: notes.map((n) => n.cellIndex),
      taps: [],
      endTimer: window.setTimeout(() => this.finishRun(), endTime - performance.now()),
    };
    this.metronome.start(transport, { sound: s.sound, lastBeat: totalBeats - 1 });
    this.setStatus(countInBeats > 0 ? 'Einzählen …' : 'Los!', '');
  }

  private onBeat(beat: BeatInfo): void {
    const dot = $('metronome-dot');
    dot.classList.remove('pulse', 'accent');
    void dot.offsetWidth;
    dot.classList.add('pulse');
    if (beat.accent) dot.classList.add('accent');
    if (this.phase === 'calibrating') {
      this.setCount(String(beat.beatInBar + 1));
      return;
    }
    const run = this.run;
    if (!run) return;
    if (beat.index < run.countInBeats) {
      this.setCount(`${beat.beatInBar + 1}`);
      this.setStatus('Einzählen …', '');
    } else {
      this.phase = 'playing';
      const bar = Math.floor((beat.index - run.countInBeats) / run.transport.beatsPerBar) + 1;
      this.setCount(`${beat.beatInBar + 1}`);
      this.setStatus(`Takt ${bar}`, '');
    }
  }

  private finishRun(): void {
    const run = this.run;
    const task = this.task;
    if (!run || !task || task.info?.kind !== 'rhythm') return;
    this.metronome.stop();
    this.run = null;
    this.phase = 'done';
    this.resumeBlockedUntil = performance.now() + 700;
    this.setCount('');

    const s = this.settings();
    // Taps before the first note's window (during count-in) are ignored.
    const window = Math.min(250, beatMs(run.transport) * 0.75);
    const firstExpected = run.expected[0] ?? Infinity;
    const taps = run.taps.filter((t) => t >= firstExpected - window);
    const evaluation = evaluateRhythm(run.expected, taps, s.toleranceMs, window);
    this.showMarks(task, evaluation);

    const pattern = task.info.pattern;
    const records = pattern.cells.map((placed, cellIndex) => {
      const notes = evaluation.notes.filter((_, i) => run.cellOfNote[i] === cellIndex);
      const start = beatToTime(run.transport, run.countInBeats + placed.bar * pattern.beatsPerBar + placed.beat);
      const end = start + placed.cell.beats * beatMs(run.transport);
      const extra = evaluation.extraTaps.some((t) => t >= start - window / 2 && t < end - window / 2);
      const devs = notes.filter((n) => n.deviation !== null).map((n) => Math.abs(n.deviation!));
      return {
        key: rhythmItemKey(placed.cell.id),
        ok: notes.every((n) => n.verdict === 'on') && !extra,
        ms: devs.length > 0 ? devs.reduce((a, b) => a + b, 0) / devs.length : null,
      };
    });
    rhythmOutcomes.set(task, evaluation);
    this.trainer.answerPerformance(evaluation.correct, records, summary(evaluation));
    this.setStatus('Weiter: tippen, Leertaste oder Enter.', '');
  }

  private showMarks(task: Task, evaluation: RhythmEvaluation): void {
    if (task.info?.kind !== 'rhythm') return;
    const marks: RhythmMarks = {
      verdicts: evaluation.notes.map((n) => n.verdict),
      deviations: evaluation.notes.map((n) => n.deviation),
    };
    this.notation.render(patternBars(task.info.pattern, task.info.bars), marks);
  }

  private stopRun(): void {
    this.metronome.stop();
    if (this.run) window.clearTimeout(this.run.endTimer);
    this.run = null;
    if (this.calibration) {
      window.clearTimeout(this.calibration.timer);
      this.calibration = null;
    }
    this.setCount('');
  }

  // --- calibration --------------------------------------------------------

  private async startCalibration(): Promise<void> {
    if (this.phase === 'countIn' || this.phase === 'playing') return;
    const previous = this.phase;
    this.stopRun();
    const s = this.settings();
    if (s.sound) {
      await this.audio.ensureRunning();
      this.audio.setVolume(s.volume / 100);
    }
    this.phase = 'calibrating';
    const transport: Transport = { bpm: CALIBRATION_BPM, beatsPerBar: 4, startTime: performance.now() + START_DELAY_MS };
    const lastBeat = 4 + CALIBRATION_BEATS - 1;
    const beats = Array.from({ length: CALIBRATION_BEATS }, (_, i) => beatToTime(transport, 4 + i));
    const end = beatToTime(transport, lastBeat) + 400;
    this.calibration = {
      transport,
      taps: [],
      beats,
      timer: window.setTimeout(() => {
        const cal = this.calibration;
        this.calibration = null;
        this.metronome.stop();
        this.setCount('');
        const taps = cal ? cal.taps.filter((t) => t >= beats[0] - 300) : [];
        const latency = estimateLatency(taps, beats);
        this.phase = previous === 'done' ? 'done' : 'ready';
        if (this.phase === 'ready' && this.task) this.show(this.task);
        if (latency === null) {
          this.setStatus('Kalibrierung: zu wenige Taps im Takt – bitte noch einmal versuchen.', 'warn');
        } else {
          this.saveLatency(latency);
          this.setStatus(`Kalibriert: Versatz ${latency > 0 ? '+' : ''}${latency} ms wird künftig herausgerechnet.`, 'ok');
        }
      }, end - performance.now()),
    };
    this.metronome.start(transport, { sound: s.sound, lastBeat });
    this.setStatus(`Kalibrierung: nach 4 Schlägen Vorlauf ${CALIBRATION_BEATS}-mal genau mit dem Klick tippen.`, '');
  }

  // --- view ---------------------------------------------------------------

  private setStatus(text: string, kind: '' | 'ok' | 'warn'): void {
    const el = $('rhythm-status');
    el.textContent = text;
    el.dataset.kind = kind;
  }

  private setCount(text: string): void {
    $('rhythm-count').textContent = text;
  }

  private flashPad(): void {
    const pad = $('rhythm-pad');
    pad.classList.remove('tapped');
    void pad.offsetWidth;
    pad.classList.add('tapped');
  }
}

/** "7 von 9 Noten auf den Punkt · 1 zu früh · 1 zu spät" */
export function summary(e: RhythmEvaluation): string {
  const parts = [`${e.onTime} von ${e.notes.length} Noten auf den Punkt`];
  if (e.early) parts.push(`${e.early} zu früh`);
  if (e.late) parts.push(`${e.late} zu spät`);
  if (e.missed) parts.push(`${e.missed} ausgelassen`);
  if (e.extraTaps.length) parts.push(`${e.extraTaps.length} zusätzlich getippt`);
  return parts.join(' · ');
}
