import { germanName, midiToPitch, toMidi } from '../core/pitch';
import type { KeyValueStorage } from '../core/storage';
import { ChordExercise } from '../exercises/chords';
import { IntervalExercise } from '../exercises/intervals';
import { checkKeyAnswer, KeyQuizExercise } from '../exercises/keyQuiz';
import { KeyContext } from '../exercises/keyContext';
import { WeightedSelector } from '../exercises/selection';
import { SingleNoteExercise } from '../exercises/singleNote';
import { taskPitches, type Exercise, type Task } from '../exercises/types';
import { ComputerKeyboardInput, OCTAVE_DOWN_CODE, OCTAVE_UP_CODE } from '../input/computerKeyboard';
import { InputHub } from '../input/inputHub';
import { MidiInput, type MidiStatus } from '../input/midiInput';
import { MODES, type PracticeModeId } from '../modes';
import { StaffRenderer } from '../render/staffRenderer';
import { effectiveRange, loadSettings, saveSettings, type Settings } from '../settings';
import { StatsStore } from '../stats/statsStore';
import { fifthsOf, germanKeyName } from '../theory/key';
import { Trainer, type TaskResult } from '../trainer/trainer';
import { KeyQuizPanel } from './keyQuizPanel';
import { OnScreenKeyboard } from './onScreenKeyboard';
import { SettingsForm } from './settingsForm';
import { StatsTable } from './statsTable';

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

interface SessionStats {
  correct: number;
  wrong: number;
  timeSum: number;
  timeCount: number;
}

/** Settings that only change the display, not the exercise. */
const DISPLAY_ONLY: ReadonlyArray<keyof Settings> = ['showNoteNames', 'showComputerKeys', 'selectionMode'];

export class App {
  private settings: Settings;
  private hub = new InputHub();
  private stats: StatsStore;
  private midi = new MidiInput(this.hub);
  private computerKeys: ComputerKeyboardInput;
  private keyboard: OnScreenKeyboard;
  private staff: StaffRenderer;
  private statsTable: StatsTable;
  private keyContext: KeyContext;
  private exercises: Partial<Record<PracticeModeId, Exercise>>;
  private trainer: Trainer;
  private form!: SettingsForm;
  private keyQuiz!: KeyQuizPanel;
  private session: SessionStats = { correct: 0, wrong: 0, timeSum: 0, timeCount: 0 };

  private feedbackEl = $('feedback');
  private detailEl = $('feedback-detail');

  constructor(private storage: KeyValueStorage) {
    this.settings = loadSettings(storage);
    this.stats = new StatsStore(storage);
    const range = effectiveRange(this.settings);
    const middle = Math.round((toMidi(range.low) + toMidi(range.high)) / 2);
    this.computerKeys = new ComputerKeyboardInput(this.hub, midiToPitch(middle).octave);
    this.keyboard = new OnScreenKeyboard($('keyboard'), this.hub);
    this.staff = new StaffRenderer($('staff'));
    this.statsTable = new StatsTable($('stats-groups'), this.stats);
    this.keyContext = new KeyContext(() => this.settings.key);

    // Later: add an adaptive modifier computed from this.stats (ROADMAP Teil 6).
    const selector = () => new WeightedSelector();
    const common = () => ({
      staff: this.settings.staff,
      range: effectiveRange(this.settings),
      weighting: this.settings.weighting,
    });
    this.exercises = {
      notes: new SingleNoteExercise(
        () => ({ ...common(), mode: this.settings.staff, accidentals: this.settings.accidentals }),
        selector(),
      ),
      intervals: new IntervalExercise(
        () => ({ ...common(), settings: this.settings.intervals, chordWindowMs: this.settings.chordWindowMs }),
        this.keyContext,
        selector(),
      ),
      chords: new ChordExercise(
        () => ({ ...common(), settings: this.settings.chords, chordWindowMs: this.settings.chordWindowMs }),
        this.keyContext,
        selector(),
        () => Object.keys(this.stats.allItems()),
      ),
      keys: new KeyQuizExercise(() => ({ staff: this.settings.staff, settings: this.settings.keyQuiz }), selector()),
    };
    this.trainer = new Trainer(this.exercise(), this.hub, this.stats, {
      onTask: (task) => this.showTask(task),
      onResult: (result) => this.showResult(result),
    });
  }

  start(): void {
    this.midi.onStatusChange((s) => this.renderMidiStatus(s));
    void this.midi.start();

    this.computerKeys.attach();
    this.computerKeys.onChange(() => this.updateKeyboardLabels());
    for (const [id, delta] of [['octave-down', -1], ['octave-up', 1]] as const) {
      $(id).addEventListener('click', (e) => {
        (e.currentTarget as HTMLElement).blur();
        this.computerKeys.setOctave(this.computerKeys.getOctave() + delta);
      });
    }
    this.setupSelection();
    this.keyQuiz = new KeyQuizPanel(
      $('key-quiz'),
      ({ major, minor }) => {
        const task = this.trainer.currentTask();
        if (!task || task.answer !== 'choice' || !task.key) return;
        this.trainer.answerChoice(checkKeyAnswer(task, major, minor), `${germanKeyName(major)} / ${germanKeyName(minor)}`);
      },
      () => this.commit({ ...this.settings, keyQuiz: { ...this.settings.keyQuiz, showCircle: !this.settings.keyQuiz.showCircle } }),
    );

    this.form = new SettingsForm($<HTMLFormElement>('settings'), {
      get: () => this.settings,
      change: (next) => this.commit(next),
      rangeInfo: () => this.rangeInfo(),
    });
    $('reset-stats').addEventListener('click', () => {
      if (window.confirm('Gesamte Statistik (alle Modi) wirklich löschen?')) this.stats.reset();
    });
    this.stats.onChange(() => this.renderStatsTable());

    this.renderModes();
    this.applySettings();
    this.renderSession();
    this.trainer.next();

    let lastWidth = window.innerWidth;
    window.addEventListener('resize', () => {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      const task = this.trainer.currentTask();
      if (task) this.staff.render(task.layout, task.steps, 'none', task.key);
    });
  }

  private exercise(): Exercise {
    return this.exercises[this.settings.practice] ?? this.exercises.notes!;
  }

  // --- Modes -------------------------------------------------------------

  private renderModes(): void {
    const nav = $('modes');
    nav.replaceChildren(
      ...MODES.map((mode) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'mode';
        button.textContent = mode.label;
        button.dataset.mode = mode.id;
        if (!mode.ready || !this.exercises[mode.id]) {
          button.disabled = true;
          button.classList.add('planned');
          button.title = 'In Planung – siehe Roadmap';
        } else {
          button.addEventListener('click', () => {
            button.blur(); // keep the space bar free for confirming a selection
            this.selectMode(mode.id);
          });
        }
        return button;
      }),
    );
    this.updateModeNav();
  }

  private updateModeNav(): void {
    $('modes').querySelectorAll<HTMLButtonElement>('.mode').forEach((b) => {
      const active = b.dataset.mode === this.settings.practice;
      b.classList.toggle('active', active);
      if (active) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
  }

  private selectMode(mode: PracticeModeId): void {
    if (mode === this.settings.practice) return;
    this.commit({ ...this.settings, practice: mode });
  }

  // --- Trainer callbacks -------------------------------------------------

  private showTask(task: Task): void {
    this.staff.render(task.layout, task.steps, 'none', task.key);
    // Name the key for playing tasks; for choice tasks the key is the question.
    $('task-caption').textContent = task.key && task.answer === 'play' ? germanKeyName(task.key) : '';
    this.feedbackEl.textContent = task.message ?? '';
    this.feedbackEl.className = 'feedback';
    this.detailEl.textContent = '';
    const quiz = task.exerciseId === this.exercises.keys?.id;
    $('key-quiz').hidden = !quiz;
    $('keyboard-card').hidden = quiz;
    if (quiz) this.keyQuiz.reset();
    const multi = task.answer === 'play' && taskPitches(task).length > 1;
    this.keyboard.setSelectionMode(this.settings.selectionMode && multi);
    $('selection-bar').hidden = !this.keyboard.isSelecting();
  }

  private showResult(r: TaskResult): void {
    const { task } = r;
    this.staff.render(task.layout, task.steps, r.correct ? 'correct' : 'wrong', task.key);
    const time = r.reactionMs !== null ? ` · ${formatMs(r.reactionMs)}` : '';
    const names = (midis: readonly number[]) => midis.map((m) => germanName(midiToPitch(m))).join(', ');
    if (r.correct) {
      this.session.correct++;
      if (r.reactionMs !== null) {
        this.session.timeSum += r.reactionMs;
        this.session.timeCount++;
      }
      this.feedbackEl.textContent = `Richtig: ${task.label}${time}`;
      this.feedbackEl.className = 'feedback correct';
      this.detailEl.textContent = task.detail ?? '';
      r.expected.forEach((m) => this.keyboard.flash(m, 'correct', 600));
    } else {
      this.session.wrong++;
      const parts: string[] = [];
      if (task.detail) parts.push(task.detail);
      if (r.answerText) parts.push(`deine Antwort: ${r.answerText}`);
      if (r.timeout) parts.push('nicht alle Töne im Zeitfenster');
      const partlyRight = r.played.some((m) => r.expected.includes(m)) || r.timeout;
      if (!partlyRight && r.played.length > 0) parts.push(`gespielt: ${names(r.played)}`);
      else {
        if (r.missing.length > 0) parts.push(`fehlt: ${names(r.missing)}`);
        if (r.extra.length > 0) parts.push(`zu viel: ${names(r.extra)}`);
      }
      this.feedbackEl.textContent = `Falsch – gesucht: ${task.label}`;
      this.feedbackEl.className = 'feedback wrong';
      this.detailEl.textContent = parts.join(' · ');
      r.played.filter((m) => !r.expected.includes(m)).forEach((m) => this.keyboard.flash(m, 'wrong', 1200));
      r.expected.forEach((m) => this.keyboard.flash(m, 'hint', 2400));
    }
    this.keyboard.clearSelection();
    if (task.exerciseId === this.exercises.keys?.id && task.key) this.keyQuiz.showSolution(fifthsOf(task.key));
    $('m-last').textContent = r.reactionMs !== null ? formatMs(r.reactionMs) : '–';
    this.renderSession();
  }

  // --- Selection mode (on-screen keyboard, several notes) -----------------

  private setupSelection(): void {
    const confirm = $<HTMLButtonElement>('confirm-selection');
    this.keyboard.onSelectionChange((selected) => (confirm.disabled = selected.length === 0));
    confirm.addEventListener('click', () => this.keyboard.confirmSelection());
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Space' || !this.keyboard.isSelecting()) return;
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'SUMMARY'].includes(target.tagName)) return;
      e.preventDefault();
      this.keyboard.confirmSelection();
    });
  }

  // --- Rendering ---------------------------------------------------------

  private renderSession(): void {
    const s = this.session;
    const total = s.correct + s.wrong;
    $('m-correct').textContent = String(s.correct);
    $('m-wrong').textContent = String(s.wrong);
    $('m-rate').textContent = total > 0 ? `${Math.round((s.correct / total) * 100)} %` : '–';
    $('m-avg').textContent = s.timeCount > 0 ? formatMs(s.timeSum / s.timeCount) : '–';
  }

  private renderMidiStatus(status: MidiStatus): void {
    const el = $('midi-status');
    let cls = 'info';
    let text: string;
    switch (status.state) {
      case 'pending':
        text = 'MIDI wird gesucht …';
        break;
      case 'connected':
        cls = 'ok';
        text = `MIDI verbunden: ${status.devices.join(', ')}`;
        break;
      case 'no-devices':
        text = 'Kein MIDI-Gerät gefunden – schließe dein Keyboard per USB an. Bis dahin klappt alles mit Maus oder Computertastatur.';
        break;
      case 'denied':
        text = 'MIDI-Zugriff nicht erlaubt – spiel einfach mit Maus oder Computertastatur.';
        break;
      case 'unsupported':
        text = status.insecure
          ? 'MIDI braucht HTTPS oder localhost – spiel einfach mit Maus oder Computertastatur.'
          : 'Dieser Browser unterstützt kein Web MIDI (z. B. Chrome oder Edge verwenden) – Maus und Computertastatur funktionieren trotzdem.';
        break;
    }
    el.className = `midi-status ${cls}`;
    el.innerHTML = '<span class="dot"></span>';
    el.append(text);
  }

  private renderStatsTable(): void {
    this.statsTable.render(this.exercise().statsGroups());
  }

  private updateKeyboardLabels(): void {
    $('pc-octave').textContent = String(this.computerKeys.getOctave());
    $('octave-hint').textContent =
      `Tasten ${this.computerKeys.keyLabel('KeyA')}–${this.computerKeys.keyLabel('KeyK')}, ` +
      `Oktave mit ${this.computerKeys.keyLabel(OCTAVE_DOWN_CODE)} / ${this.computerKeys.keyLabel(OCTAVE_UP_CODE)}`;
    this.keyboard.setLabels({
      noteNames: this.settings.showNoteNames,
      computerKeys: this.settings.showComputerKeys ? this.computerKeys.labelsByMidi() : null,
    });
  }

  private rangeInfo(): string {
    const range = effectiveRange(this.settings);
    return (
      `Geübt wird ${germanName(range.low)}–${germanName(range.high)}. ` +
      'Mehr als 4 Hilfslinien werden mit 8va/8vb notiert.'
    );
  }

  // --- Settings ----------------------------------------------------------

  private commit(next: Settings): void {
    const exerciseKey = (s: Settings) => {
      const copy: Partial<Settings> = { ...s };
      for (const k of DISPLAY_ONLY) delete copy[k];
      return JSON.stringify({ ...copy, keyQuiz: { ...s.keyQuiz, showCircle: null } });
    };
    const modeChanged = next.practice !== this.settings.practice;
    const exerciseChanged = exerciseKey(next) !== exerciseKey(this.settings);
    this.settings = next;
    saveSettings(this.storage, next);
    this.applySettings();
    if (modeChanged) this.trainer.setExercise(this.exercise());
    else if (exerciseChanged) this.trainer.next();
    else {
      // Display-only change: re-evaluate the selection mode for the current task.
      const task = this.trainer.currentTask();
      if (task && !this.trainer.isWaiting()) this.showTask(task);
    }
  }

  private applySettings(): void {
    const range = effectiveRange(this.settings);
    this.keyboard.setRange(toMidi(range.low), toMidi(range.high));
    this.updateKeyboardLabels();
    this.updateModeNav();
    this.keyQuiz.setCircleVisible(this.settings.keyQuiz.showCircle);
    this.form.showFor(this.settings.practice);
    this.form.updateRangeInfo();
    this.renderStatsTable();
  }
}

function formatMs(ms: number): string {
  return ms < 10000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}
