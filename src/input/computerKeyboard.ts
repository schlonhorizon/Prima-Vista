import type { InputHub } from './inputHub';

/**
 * Computer keyboard as piano, based on physical key positions (event.code),
 * like common DAWs: A S D F G H J K … = white keys, W E T Z U O P = black keys.
 * On a German QWERTZ keyboard the physical "Z" key reports code "KeyY".
 */
const KEY_OFFSETS: Readonly<Record<string, number>> = {
  KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7,
  KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15,
  Semicolon: 16, Quote: 17,
};

export const OCTAVE_DOWN_CODE = 'KeyZ';
export const OCTAVE_UP_CODE = 'KeyX';

/** All key codes the computer keyboard uses for playing (shortcuts must avoid them). */
export const PIANO_CODES: readonly string[] = [...Object.keys(KEY_OFFSETS), OCTAVE_DOWN_CODE, OCTAVE_UP_CODE];

/** Labels for a German QWERTZ layout, used when the browser can't tell us the layout. */
const FALLBACK_LABELS: Readonly<Record<string, string>> = {
  KeyY: 'Z', KeyZ: 'Y', Semicolon: 'Ö', Quote: 'Ä',
};

const MIN_OCTAVE = 1;
const MAX_OCTAVE = 7;

interface KeyboardLayoutMap {
  get(code: string): string | undefined;
}

export class ComputerKeyboardInput {
  private octave: number;
  private pressed = new Map<string, number>(); // code -> midi
  private layout: KeyboardLayoutMap | null = null;
  private listeners = new Set<() => void>();
  private enabled = true;

  constructor(private hub: InputHub, initialOctave = 4) {
    this.octave = initialOctave;
  }

  attach(target: Window = window): void {
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('blur', this.releaseAll);
    const kb = (navigator as Navigator & { keyboard?: { getLayoutMap?: () => Promise<KeyboardLayoutMap> } }).keyboard;
    kb?.getLayoutMap?.()
      .then((map) => {
        this.layout = map;
        this.notify();
      })
      .catch(() => undefined);
  }

  /** Switches the piano mapping on or off (off frees the letter keys for shortcuts). */
  setEnabled(enabled: boolean): void {
    if (!enabled) this.releaseAll();
    this.enabled = enabled;
  }

  getOctave(): number {
    return this.octave;
  }

  setOctave(octave: number): void {
    const next = Math.min(MAX_OCTAVE, Math.max(MIN_OCTAVE, octave));
    if (next === this.octave) return;
    this.releaseAll();
    this.octave = next;
    this.notify();
  }

  /** Called when octave or key labels change. */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  keyLabel(code: string): string {
    const fromLayout = this.layout?.get(code);
    if (fromLayout) return fromLayout.toUpperCase();
    return FALLBACK_LABELS[code] ?? code.replace(/^Key/, '');
  }

  /** Current MIDI note → key label mapping (for labelling the on-screen keyboard). */
  labelsByMidi(): Map<number, string> {
    const map = new Map<number, string>();
    for (const [code, offset] of Object.entries(KEY_OFFSETS)) map.set(this.baseMidi() + offset, this.keyLabel(code));
    return map;
  }

  private baseMidi(): number {
    return (this.octave + 1) * 12;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    // Combinations with Shift never play (e.g. "?" for the shortcut overview).
    if (!this.enabled || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || isEditable(e.target)) return;
    if (e.code === OCTAVE_DOWN_CODE || e.code === OCTAVE_UP_CODE) {
      e.preventDefault();
      if (!e.repeat) this.setOctave(this.octave + (e.code === OCTAVE_UP_CODE ? 1 : -1));
      return;
    }
    const offset = KEY_OFFSETS[e.code];
    if (offset === undefined) return;
    e.preventDefault();
    if (e.repeat || this.pressed.has(e.code)) return;
    const midi = this.baseMidi() + offset;
    this.pressed.set(e.code, midi);
    this.hub.emit({ type: 'on', midi, velocity: 100, time: e.timeStamp || performance.now(), source: 'computer' });
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const midi = this.pressed.get(e.code);
    if (midi === undefined) return;
    this.pressed.delete(e.code);
    this.hub.emit({ type: 'off', midi, velocity: 0, time: e.timeStamp || performance.now(), source: 'computer' });
  };

  private releaseAll = (): void => {
    for (const midi of this.pressed.values()) {
      this.hub.emit({ type: 'off', midi, velocity: 0, time: performance.now(), source: 'computer' });
    }
    this.pressed.clear();
  };

  private notify(): void {
    this.listeners.forEach((l) => l());
  }
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) return !['checkbox', 'radio', 'button', 'range'].includes(target.type);
  return target.isContentEditable || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}
