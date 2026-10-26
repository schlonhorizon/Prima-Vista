import { clefPitch } from '../core/clef';
import { displayableRange, PIANO_HIGH, PIANO_LOW, type StaffMode } from '../core/notation';
import { germanName, midiToPitch, pitchId, toMidi } from '../core/pitch';
import { RANGE_PRESETS } from '../core/presets';
import { naturalsBetween } from '../core/range';
import type { KeyValueStorage } from '../core/storage';
import { WeightedSelector } from '../exercises/selection';
import { SingleNoteExercise } from '../exercises/singleNote';
import type { Task } from '../exercises/types';
import { ComputerKeyboardInput, OCTAVE_DOWN_CODE, OCTAVE_UP_CODE } from '../input/computerKeyboard';
import { InputHub } from '../input/inputHub';
import { MidiInput, type MidiStatus } from '../input/midiInput';
import { StaffRenderer } from '../render/staffRenderer';
import { effectiveRange, loadSettings, MANUAL_RANGE, saveSettings, type Settings } from '../settings';
import { StatsStore } from '../stats/statsStore';
import { Trainer, type TaskResult } from '../trainer/trainer';
import { OnScreenKeyboard } from './onScreenKeyboard';
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

export class App {
  private settings: Settings;
  private hub = new InputHub();
  private stats: StatsStore;
  private midi = new MidiInput(this.hub);
  private computerKeys: ComputerKeyboardInput;
  private keyboard: OnScreenKeyboard;
  private staff: StaffRenderer;
  private statsTable: StatsTable;
  private exercise: SingleNoteExercise;
  private trainer: Trainer;
  private session: SessionStats = { correct: 0, wrong: 0, timeSum: 0, timeCount: 0 };

  private feedbackEl = $('feedback');
  private form = $<HTMLFormElement>('settings');

  constructor(private storage: KeyValueStorage) {
    this.settings = loadSettings(storage);
    this.stats = new StatsStore(storage);
    const range = effectiveRange(this.settings);
    const middle = Math.round((toMidi(range.low) + toMidi(range.high)) / 2);
    this.computerKeys = new ComputerKeyboardInput(this.hub, midiToPitch(middle).octave);
    this.keyboard = new OnScreenKeyboard($('keyboard'), this.hub);
    this.staff = new StaffRenderer($('staff'));
    this.statsTable = new StatsTable($('stats-groups'), this.stats);
    this.exercise = new SingleNoteExercise(
      () => ({
        mode: this.settings.mode,
        range: effectiveRange(this.settings),
        accidentals: this.settings.accidentals,
        weighting: this.settings.weighting,
      }),
      // Later: add an adaptive modifier computed from this.stats.
      new WeightedSelector(),
    );
    this.trainer = new Trainer(this.exercise, this.hub, this.stats, {
      onTask: (task) => this.showTask(task),
      onResult: (result) => this.showResult(result),
    });
  }

  start(): void {
    this.midi.onStatusChange((s) => this.renderMidiStatus(s));
    void this.midi.start();

    this.computerKeys.attach();
    this.computerKeys.onChange(() => this.updateKeyboardLabels());
    $('octave-down').addEventListener('click', () => this.computerKeys.setOctave(this.computerKeys.getOctave() - 1));
    $('octave-up').addEventListener('click', () => this.computerKeys.setOctave(this.computerKeys.getOctave() + 1));

    this.setupSettingsForm();
    $('reset-stats').addEventListener('click', () => {
      if (window.confirm('Gesamte Statistik wirklich löschen?')) this.stats.reset();
    });
    this.stats.onChange(() => this.renderStatsTable());

    this.applySettings();
    this.renderSession();
    this.trainer.next();

    let lastWidth = window.innerWidth;
    window.addEventListener('resize', () => {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      const task = this.trainer.currentTask();
      if (task) this.staff.render(task.layout, task.steps);
    });
  }

  // --- Trainer callbacks -------------------------------------------------

  private showTask(task: Task): void {
    this.staff.render(task.layout, task.steps);
    this.feedbackEl.textContent = '';
    this.feedbackEl.className = 'feedback';
  }

  private showResult(r: TaskResult): void {
    const { task } = r;
    this.staff.render(task.layout, task.steps, r.correct ? 'correct' : 'wrong');
    const time = r.reactionMs !== null ? ` · ${formatMs(r.reactionMs)}` : '';
    if (r.correct) {
      this.session.correct++;
      if (r.reactionMs !== null) {
        this.session.timeSum += r.reactionMs;
        this.session.timeCount++;
      }
      this.feedbackEl.textContent = `Richtig: ${task.label}${time}`;
      this.feedbackEl.className = 'feedback correct';
      r.expected.forEach((m) => this.keyboard.flash(m, 'correct', 450));
    } else {
      this.session.wrong++;
      const played = r.played.map((m) => germanName(midiToPitch(m))).join(', ');
      this.feedbackEl.textContent = `Falsch: gespielt ${played}, gesucht ${task.label}`;
      this.feedbackEl.className = 'feedback wrong';
      r.played.forEach((m) => this.keyboard.flash(m, 'wrong', 900));
      r.expected.forEach((m) => this.keyboard.flash(m, 'hint', 1800));
    }
    $('m-last').textContent = r.reactionMs !== null ? formatMs(r.reactionMs) : '–';
    this.renderSession();
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
    this.statsTable.render(this.exercise.candidates());
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

  // --- Settings ----------------------------------------------------------

  private select(name: string): HTMLSelectElement {
    return this.form.elements.namedItem(name) as HTMLSelectElement;
  }

  private input(name: string): HTMLInputElement {
    return this.form.elements.namedItem(name) as HTMLInputElement;
  }

  private setupSettingsForm(): void {
    this.select('rangePreset').replaceChildren(
      ...RANGE_PRESETS.map((p) => new Option(p.label, p.id)),
      new Option('Manuell', MANUAL_RANGE),
    );
    const piano = naturalsBetween(PIANO_LOW, PIANO_HIGH).map((p) => new Option(germanName(p), pitchId(p)));
    this.select('coreLow').replaceChildren(...piano.map((o) => o.cloneNode(true)));
    this.select('coreHigh').replaceChildren(...piano);
    this.writeForm();
    this.form.addEventListener('change', (e) => {
      // Give the keys back to the piano: a focused select would react to letter keys.
      if (e.target instanceof HTMLSelectElement) e.target.blur();
      this.readForm();
    });
    this.form.addEventListener('submit', (e) => e.preventDefault());
  }

  /** Fills the manual range selects with what the current mode can display. */
  private fillRangeOptions(mode: StaffMode): void {
    const limits = displayableRange(mode);
    const options = naturalsBetween(limits.low, limits.high);
    for (const name of ['rangeLow', 'rangeHigh']) {
      this.select(name).replaceChildren(...options.map((p) => new Option(germanName(p), pitchId(p))));
    }
  }

  private writeForm(): void {
    const s = this.settings;
    const range = s.ranges[s.mode];
    this.select('mode').value = s.mode;
    this.fillRangeOptions(s.mode);
    this.select('rangePreset').value = range.preset;
    this.select('rangeLow').value = range.low;
    this.select('rangeHigh').value = range.high;
    this.select('accidentals').value = s.accidentals;
    this.select('coreLow').value = s.weighting.coreLow;
    this.select('coreHigh').value = s.weighting.coreHigh;
    this.input('decayPerOctave').value = String(s.weighting.decayPerOctave);
    this.input('showNoteNames').checked = s.showNoteNames;
    this.input('showComputerKeys').checked = s.showComputerKeys;
    this.updateRangeInfo();
  }

  private updateRangeInfo(): void {
    const manual = this.settings.ranges[this.settings.mode].preset === MANUAL_RANGE;
    this.form.querySelectorAll<HTMLElement>('.manual-only').forEach((el) => (el.hidden = !manual));
    const range = effectiveRange(this.settings);
    const count = this.exercise.candidates().length;
    $('range-info').textContent =
      `Geübt wird ${germanName(range.low)}–${germanName(range.high)} (${count} Töne). ` +
      'Mehr als 4 Hilfslinien werden mit 8va/8vb notiert.';
  }

  private readForm(): void {
    const errorEl = $('settings-error');
    const showError = (message: string) => {
      errorEl.textContent = message;
      errorEl.hidden = false;
    };
    const mode = this.select('mode').value as StaffMode;
    if (mode !== this.settings.mode) {
      // Each mode keeps its own range; load it into the form.
      this.commit({ ...this.settings, mode });
      this.writeForm();
      return;
    }

    const rangeLow = this.select('rangeLow').value;
    const rangeHigh = this.select('rangeHigh').value;
    if (toMidi(clefPitch(rangeLow)) >= toMidi(clefPitch(rangeHigh))) {
      return showError('Die tiefste Note muss unter der höchsten liegen.');
    }
    const coreLow = this.select('coreLow').value;
    const coreHigh = this.select('coreHigh').value;
    if (toMidi(clefPitch(coreLow)) > toMidi(clefPitch(coreHigh))) {
      return showError('Der Anfang der Kernzone muss unter ihrem Ende liegen.');
    }
    const decay = Number(this.input('decayPerOctave').value.replace(',', '.'));
    if (!Number.isFinite(decay) || decay < 0 || decay > 1) {
      return showError('Der Faktor pro Oktave muss zwischen 0 und 1 liegen.');
    }
    errorEl.hidden = true;

    this.commit({
      ...this.settings,
      ranges: {
        ...this.settings.ranges,
        [mode]: { preset: this.select('rangePreset').value, low: rangeLow, high: rangeHigh },
      },
      accidentals: this.select('accidentals').value as Settings['accidentals'],
      weighting: { coreLow, coreHigh, decayPerOctave: decay },
      showNoteNames: this.input('showNoteNames').checked,
      showComputerKeys: this.input('showComputerKeys').checked,
    });
    this.updateRangeInfo();
  }

  private commit(next: Settings): void {
    const exerciseKey = (s: Settings) =>
      JSON.stringify([s.mode, s.ranges[s.mode], s.accidentals, s.weighting]);
    const exerciseChanged = exerciseKey(next) !== exerciseKey(this.settings);
    this.settings = next;
    saveSettings(this.storage, next);
    this.applySettings();
    if (exerciseChanged) this.trainer.next();
  }

  private applySettings(): void {
    const range = effectiveRange(this.settings);
    this.keyboard.setRange(toMidi(range.low), toMidi(range.high));
    this.updateKeyboardLabels();
    this.renderStatsTable();
  }
}

function formatMs(ms: number): string {
  return ms < 10000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}
