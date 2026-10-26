import { CLEFS, clefPitch } from '../core/clef';
import { germanName, midiToPitch, pitchId, toMidi } from '../core/pitch';
import { naturalsBetween } from '../core/range';
import type { KeyValueStorage } from '../core/storage';
import { UniformSelector } from '../exercises/selection';
import { SingleNoteExercise, singleNoteItemKey } from '../exercises/singleNote';
import type { Task } from '../exercises/types';
import { ComputerKeyboardInput, OCTAVE_DOWN_CODE, OCTAVE_UP_CODE } from '../input/computerKeyboard';
import { InputHub } from '../input/inputHub';
import { MidiInput, type MidiStatus } from '../input/midiInput';
import { StaffRenderer } from '../render/staffRenderer';
import { loadSettings, saveSettings, settingsRange, type Settings } from '../settings';
import { averageHitTime, StatsStore } from '../stats/statsStore';
import { Trainer, type TaskResult } from '../trainer/trainer';
import { OnScreenKeyboard } from './onScreenKeyboard';

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
  private exercise: SingleNoteExercise;
  private trainer: Trainer;
  private session: SessionStats = { correct: 0, wrong: 0, timeSum: 0, timeCount: 0 };

  private feedbackEl = $('feedback');
  private form = $<HTMLFormElement>('settings');

  constructor(private storage: KeyValueStorage) {
    this.settings = loadSettings(storage);
    this.stats = new StatsStore(storage);
    this.computerKeys = new ComputerKeyboardInput(this.hub, clefPitch(this.settings.rangeLow).octave);
    this.keyboard = new OnScreenKeyboard($('keyboard'), this.hub);
    this.staff = new StaffRenderer($('staff'));
    this.exercise = new SingleNoteExercise(
      () => ({ clef: this.settings.clef, range: settingsRange(this.settings), accidentals: this.settings.accidentals }),
      new UniformSelector(),
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
      if (task) this.staff.render(task.clef, task.steps);
    });
  }

  // --- Trainer callbacks -------------------------------------------------

  private showTask(task: Task): void {
    this.staff.render(task.clef, task.steps);
    this.feedbackEl.textContent = '';
    this.feedbackEl.className = 'feedback';
  }

  private showResult(r: TaskResult): void {
    const { task } = r;
    this.staff.render(task.clef, task.steps, r.correct ? 'correct' : 'wrong');
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
    const body = $('stats-body');
    body.replaceChildren();
    for (const p of this.exercise.candidates()) {
      const item = this.stats.getItem(singleNoteItemKey(this.settings.clef, p));
      const hits = item?.hits ?? 0;
      const misses = item?.misses ?? 0;
      const total = hits + misses;
      const rate = total > 0 ? hits / total : null;
      const avg = averageHitTime(item);
      const tr = document.createElement('tr');
      const cells = [
        germanName(p),
        String(hits),
        String(misses),
        rate === null ? '–' : `${Math.round(rate * 100)} %`,
        avg === null ? '–' : formatMs(avg),
      ];
      for (const [i, text] of cells.entries()) {
        const td = document.createElement('td');
        td.textContent = text;
        if (i === 3 && rate !== null && total >= 3 && rate < 0.7) td.className = 'weak';
        tr.appendChild(td);
      }
      body.appendChild(tr);
    }
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

  private setupSettingsForm(): void {
    const clef = CLEFS[this.settings.clef];
    const options = naturalsBetween(clefPitch(clef.selectableLow), clefPitch(clef.selectableHigh));
    for (const name of ['rangeLow', 'rangeHigh'] as const) {
      const select = this.form.elements.namedItem(name) as HTMLSelectElement;
      select.replaceChildren(
        ...options.map((p) => new Option(germanName(p), pitchId(p))),
      );
    }
    this.writeForm();
    this.form.addEventListener('change', (e) => {
      // Give the keys back to the piano: a focused select would react to letter keys.
      if (e.target instanceof HTMLSelectElement) e.target.blur();
      this.readForm();
    });
    this.form.addEventListener('submit', (e) => e.preventDefault());
  }

  private writeForm(): void {
    const f = this.form.elements;
    (f.namedItem('rangeLow') as HTMLSelectElement).value = this.settings.rangeLow;
    (f.namedItem('rangeHigh') as HTMLSelectElement).value = this.settings.rangeHigh;
    (f.namedItem('accidentals') as HTMLSelectElement).value = this.settings.accidentals;
    (f.namedItem('showNoteNames') as HTMLInputElement).checked = this.settings.showNoteNames;
    (f.namedItem('showComputerKeys') as HTMLInputElement).checked = this.settings.showComputerKeys;
  }

  private readForm(): void {
    const f = this.form.elements;
    const next: Settings = {
      ...this.settings,
      rangeLow: (f.namedItem('rangeLow') as HTMLSelectElement).value,
      rangeHigh: (f.namedItem('rangeHigh') as HTMLSelectElement).value,
      accidentals: (f.namedItem('accidentals') as HTMLSelectElement).value as Settings['accidentals'],
      showNoteNames: (f.namedItem('showNoteNames') as HTMLInputElement).checked,
      showComputerKeys: (f.namedItem('showComputerKeys') as HTMLInputElement).checked,
    };
    const errorEl = $('settings-error');
    if (toMidi(clefPitch(next.rangeLow)) >= toMidi(clefPitch(next.rangeHigh))) {
      errorEl.textContent = 'Die tiefste Note muss unter der höchsten liegen.';
      errorEl.hidden = false;
      return;
    }
    errorEl.hidden = true;
    const exerciseChanged =
      next.rangeLow !== this.settings.rangeLow ||
      next.rangeHigh !== this.settings.rangeHigh ||
      next.accidentals !== this.settings.accidentals;
    this.settings = next;
    saveSettings(this.storage, next);
    this.applySettings();
    if (exerciseChanged) this.trainer.next();
  }

  private applySettings(): void {
    const range = settingsRange(this.settings);
    this.keyboard.setRange(toMidi(range.low), toMidi(range.high));
    this.updateKeyboardLabels();
    this.renderStatsTable();
  }
}

function formatMs(ms: number): string {
  return ms < 10000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}
