import { clefPitch } from '../core/clef';
import { displayableRange, PIANO_HIGH, PIANO_LOW, type StaffMode } from '../core/notation';
import { germanName, pitchId, toMidi } from '../core/pitch';
import { RANGE_PRESETS } from '../core/presets';
import { naturalsBetween } from '../core/range';
import { STANDARD_INTERVAL_NAMES } from '../exercises/intervals';
import type { PracticeModeId } from '../modes';
import {
  MANUAL_RANGE,
  RANDOM_KEY,
  STANDARD_INTERVALS,
  type ChordSettings,
  type IntervalSettings,
  type Settings,
  type StandardInterval,
} from '../settings';
import { inversionName } from '../theory/chords';
import { ALL_KEYS, germanKeyName, keyId } from '../theory/key';

const DEGREE_NAMES = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export interface SettingsFormHooks {
  get(): Settings;
  /** Called with validated new settings. */
  change(next: Settings): void;
  /** Number of candidate notes, for the range info line. */
  rangeInfo(): string;
}

/** Binds the settings form to the Settings object; shows only fields relevant for the active mode. */
export class SettingsForm {
  private errorEl: HTMLElement;

  constructor(private form: HTMLFormElement, private hooks: SettingsFormHooks) {
    this.errorEl = form.querySelector('#settings-error')!;
    this.fillStaticOptions();
    this.write();
    form.addEventListener('change', (e) => {
      // Give the keys back to the piano: a focused select would react to letter keys.
      if (e.target instanceof HTMLSelectElement) e.target.blur();
      this.read();
    });
    form.addEventListener('submit', (e) => e.preventDefault());
  }

  /** Shows the fieldsets and fields of the active practice mode. */
  showFor(mode: PracticeModeId): void {
    this.form.querySelectorAll<HTMLElement>('[data-modes]').forEach((el) => {
      el.hidden = !el.dataset.modes!.split(' ').includes(mode);
    });
    this.updateRangeVisibility();
  }

  write(): void {
    const s = this.hooks.get();
    const range = s.ranges[s.staff];
    this.select('staff').value = s.staff;
    this.fillRangeOptions(s.staff);
    this.select('rangePreset').value = range.preset;
    this.select('rangeLow').value = range.low;
    this.select('rangeHigh').value = range.high;
    this.select('accidentals').value = s.accidentals;
    this.select('keyChoice').value = s.key.choice;
    this.select('maxAccidentals').value = String(s.key.maxAccidentals);
    this.input('changeEvery').value = String(s.key.changeEvery);
    this.input('includeMinor').checked = s.key.includeMinor;
    this.select('intervalScope').value = s.intervals.scope;
    this.select('intervalPresentation').value = s.intervals.presentation;
    this.select('intervalDirection').value = s.intervals.direction;
    this.setChecked('intervalAllowed', s.intervals.allowed);
    this.select('quizMaxAccidentals').value = String(s.keyQuiz.maxAccidentals);
    this.input('showCircle').checked = s.keyQuiz.showCircle;
    this.select('chordKinds').value = s.chords.kinds;
    this.setChecked('chordInversion', s.chords.inversions.map(String));
    this.setChecked('chordDegree', s.chords.degrees.map(String));
    this.select('coreLow').value = s.weighting.coreLow;
    this.select('coreHigh').value = s.weighting.coreHigh;
    this.input('decayPerOctave').value = String(s.weighting.decayPerOctave);
    this.input('autoExplain').checked = s.autoExplain;
    this.input('computerPiano').checked = s.computerPiano;
    this.input('showNoteNames').checked = s.showNoteNames;
    this.input('showComputerKeys').checked = s.showComputerKeys;
    this.input('selectionMode').checked = s.selectionMode;
    this.input('chordWindowMs').value = String(s.chordWindowMs);
    this.updateRangeInfo();
    this.updateRangeVisibility();
  }

  updateRangeInfo(): void {
    this.form.querySelector('#range-info')!.textContent = this.hooks.rangeInfo();
  }

  private read(): void {
    const s = this.hooks.get();
    const staff = this.select('staff').value as StaffMode;
    if (staff !== s.staff) {
      // Each staff system keeps its own range; load it into the form.
      this.hideError();
      this.hooks.change({ ...s, staff });
      this.write();
      return;
    }

    const rangeLow = this.select('rangeLow').value;
    const rangeHigh = this.select('rangeHigh').value;
    if (toMidi(clefPitch(rangeLow)) >= toMidi(clefPitch(rangeHigh))) {
      return this.showError('Die tiefste Note muss unter der höchsten liegen.');
    }
    const coreLow = this.select('coreLow').value;
    const coreHigh = this.select('coreHigh').value;
    if (toMidi(clefPitch(coreLow)) > toMidi(clefPitch(coreHigh))) {
      return this.showError('Der Anfang der Kernzone muss unter ihrem Ende liegen.');
    }
    const decay = Number(this.input('decayPerOctave').value.replace(',', '.'));
    if (!Number.isFinite(decay) || decay < 0 || decay > 1) {
      return this.showError('Der Faktor pro Oktave muss zwischen 0 und 1 liegen.');
    }
    const changeEvery = Number(this.input('changeEvery').value);
    if (!Number.isInteger(changeEvery) || changeEvery < 1 || changeEvery > 1000) {
      return this.showError('„Neue Zufallstonart alle“ braucht eine ganze Zahl zwischen 1 und 1000.');
    }
    const windowMs = Number(this.input('chordWindowMs').value);
    if (!Number.isInteger(windowMs) || windowMs < 0 || windowMs > 5000) {
      return this.showError('Das Zeitfenster muss zwischen 0 und 5000 ms liegen.');
    }
    const allowed = this.checked('intervalAllowed') as StandardInterval[];
    if (allowed.length === 0) return this.showError('Bitte mindestens ein Intervall auswählen.');
    const inversions = this.checked('chordInversion').map(Number);
    if (inversions.length === 0) return this.showError('Bitte mindestens eine Lage (Grundstellung/Umkehrung) auswählen.');
    const degrees = this.checked('chordDegree').map(Number);
    if (degrees.length === 0) return this.showError('Bitte mindestens eine Stufe auswählen.');
    this.hideError();

    this.hooks.change({
      ...s,
      ranges: { ...s.ranges, [staff]: { preset: this.select('rangePreset').value, low: rangeLow, high: rangeHigh } },
      accidentals: this.select('accidentals').value as Settings['accidentals'],
      key: {
        choice: this.select('keyChoice').value,
        maxAccidentals: Number(this.select('maxAccidentals').value),
        includeMinor: this.input('includeMinor').checked,
        changeEvery,
      },
      intervals: {
        scope: this.select('intervalScope').value as IntervalSettings['scope'],
        presentation: this.select('intervalPresentation').value as IntervalSettings['presentation'],
        direction: this.select('intervalDirection').value as IntervalSettings['direction'],
        allowed,
      },
      chords: { kinds: this.select('chordKinds').value as ChordSettings['kinds'], inversions, degrees },
      keyQuiz: {
        maxAccidentals: Number(this.select('quizMaxAccidentals').value),
        showCircle: this.input('showCircle').checked,
      },
      weighting: { coreLow, coreHigh, decayPerOctave: decay },
      autoExplain: this.input('autoExplain').checked,
      computerPiano: this.input('computerPiano').checked,
      showNoteNames: this.input('showNoteNames').checked,
      showComputerKeys: this.input('showComputerKeys').checked,
      selectionMode: this.input('selectionMode').checked,
      chordWindowMs: windowMs,
    });
    this.updateRangeInfo();
    this.updateRangeVisibility();
  }

  private fillStaticOptions(): void {
    this.select('rangePreset').replaceChildren(
      ...RANGE_PRESETS.map((p) => new Option(p.label, p.id)),
      new Option('Manuell', MANUAL_RANGE),
    );
    const piano = naturalsBetween(PIANO_LOW, PIANO_HIGH);
    for (const name of ['coreLow', 'coreHigh']) {
      this.select(name).replaceChildren(...piano.map((p) => new Option(germanName(p), pitchId(p))));
    }
    const keyOptions = (mode: 'major' | 'minor') =>
      ALL_KEYS.filter((k) => k.mode === mode).map((k) => new Option(germanKeyName(k), keyId(k)));
    const major = document.createElement('optgroup');
    major.label = 'Dur';
    major.append(...keyOptions('major'));
    const minor = document.createElement('optgroup');
    minor.label = 'Moll';
    minor.append(...keyOptions('minor'));
    this.select('keyChoice').replaceChildren(new Option('Zufällig', RANDOM_KEY), major, minor);
    for (const name of ['maxAccidentals', 'quizMaxAccidentals']) {
      this.select(name).replaceChildren(
        ...Array.from({ length: 8 }, (_, n) => new Option(n === 0 ? 'ohne Vorzeichen' : `${n} Vorzeichen`, String(n))),
      );
    }
    this.fillChecks('#interval-checks', 'intervalAllowed', STANDARD_INTERVALS.map((id) => [id, STANDARD_INTERVAL_NAMES[id]]));
    this.fillChecks('#inversion-checks', 'chordInversion', [0, 1, 2, 3].map((i) => [String(i), inversionName(i)]));
    this.fillChecks('#degree-checks', 'chordDegree', DEGREE_NAMES.map((name, i) => [String(i + 1), `${name}. Stufe`]));
  }

  private fillChecks(selector: string, name: string, options: [value: string, label: string][]): void {
    this.form.querySelector(selector)!.replaceChildren(
      ...options.map(([value, text]) => {
        const label = document.createElement('label');
        label.className = 'check';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.name = name;
        box.value = value;
        label.append(box, ` ${text}`);
        return label;
      }),
    );
  }

  private checked(name: string): string[] {
    return [...this.form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`)].map((el) => el.value);
  }

  private setChecked(name: string, values: string[]): void {
    this.form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`).forEach((el) => {
      el.checked = values.includes(el.value);
    });
  }

  /** Fills the manual range selects with what the current staff system can display. */
  private fillRangeOptions(staff: StaffMode): void {
    const limits = displayableRange(staff);
    const options = naturalsBetween(limits.low, limits.high);
    for (const name of ['rangeLow', 'rangeHigh']) {
      this.select(name).replaceChildren(...options.map((p) => new Option(germanName(p), pitchId(p))));
    }
  }

  private updateRangeVisibility(): void {
    const s = this.hooks.get();
    const manual = s.ranges[s.staff].preset === MANUAL_RANGE;
    const modeHidden = this.select('rangePreset').closest('label')!.hidden;
    this.form.querySelectorAll<HTMLElement>('.manual-only').forEach((el) => (el.hidden = !manual || modeHidden));
  }

  private select(name: string): HTMLSelectElement {
    return this.form.elements.namedItem(name) as HTMLSelectElement;
  }

  private input(name: string): HTMLInputElement {
    return this.form.elements.namedItem(name) as HTMLInputElement;
  }

  private showError(message: string): void {
    this.errorEl.textContent = message;
    this.errorEl.hidden = false;
  }

  private hideError(): void {
    this.errorEl.hidden = true;
  }
}
