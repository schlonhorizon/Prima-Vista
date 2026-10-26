import { germanName, isBlackKey, midiToPitch } from '../core/pitch';
import type { InputHub } from '../input/inputHub';

/** Above this many white keys the keyboard shows the exact range instead of whole octaves. */
const MAX_WHITE_KEYS_ROUNDED = 36;
const MIN_WHITE_KEY_PX = 18;

export type KeyFlash = 'correct' | 'wrong' | 'hint';

export interface KeyboardLabels {
  noteNames: boolean;
  /** Computer-key labels by MIDI note, or null to hide them. */
  computerKeys: Map<number, string> | null;
}

/** Clickable piano keyboard. Shows held keys from every input source. */
export class OnScreenKeyboard {
  private root: HTMLElement;
  private keys = new Map<number, HTMLElement>();
  private pointerNotes = new Map<number, number>(); // pointerId -> midi
  private low = 60;
  private high = 83;
  private labels: KeyboardLabels = { noteNames: false, computerKeys: null };

  constructor(container: HTMLElement, private hub: InputHub) {
    this.root = document.createElement('div');
    this.root.className = 'piano';
    this.root.setAttribute('role', 'group');
    this.root.setAttribute('aria-label', 'Bildschirmtastatur');
    container.replaceChildren(this.root);

    this.root.addEventListener('pointerdown', this.onPointerDown);
    this.root.addEventListener('pointerover', this.onPointerOver);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());

    hub.subscribe((e) => this.setHeld(e.midi, hub.isHeld(e.midi)));
    this.build();
  }

  /**
   * Shows the keys covering [lowMidi, highMidi]: whole octaves for small ranges,
   * otherwise exactly the range (starting and ending on white keys).
   */
  setRange(lowMidi: number, highMidi: number): void {
    let low = lowMidi - (((lowMidi % 12) + 12) % 12);
    let high = highMidi + (11 - (((highMidi % 12) + 12) % 12));
    if (countWhite(low, high) > MAX_WHITE_KEYS_ROUNDED) {
      low = isBlackKey(lowMidi) ? lowMidi - 1 : lowMidi;
      high = isBlackKey(highMidi) ? highMidi + 1 : highMidi;
    }
    if (low === this.low && high === this.high) return;
    this.low = low;
    this.high = high;
    this.build();
  }

  setLabels(labels: KeyboardLabels): void {
    this.labels = labels;
    this.updateLabels();
  }

  flash(midi: number, kind: KeyFlash, durationMs = 900): void {
    const key = this.keys.get(midi);
    if (!key) return;
    if (kind === 'hint') this.revealKey(key);
    const cls = `flash-${kind}`;
    key.classList.remove(cls);
    void key.offsetWidth; // restart animation
    key.classList.add(cls);
    window.setTimeout(() => key.classList.remove(cls), durationMs);
  }

  /** On narrow screens the keyboard scrolls horizontally; bring the key into view without moving the page. */
  private revealKey(key: HTMLElement): void {
    const scroller = this.root.parentElement;
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return;
    const k = key.getBoundingClientRect();
    const view = scroller.getBoundingClientRect();
    if (k.left >= view.left && k.right <= view.right) return;
    const centerOffset = k.left - view.left - (view.width - k.width) / 2;
    scroller.scrollBy({ left: centerOffset, behavior: 'smooth' });
  }

  private setHeld(midi: number, held: boolean): void {
    this.keys.get(midi)?.classList.toggle('held', held);
  }

  private build(): void {
    this.root.replaceChildren();
    this.keys.clear();
    const whiteCount = countWhite(this.low, this.high);
    const whiteWidth = 100 / whiteCount;
    this.root.style.minWidth = `${whiteCount * MIN_WHITE_KEY_PX}px`;
    this.root.classList.toggle('compact', whiteCount > MAX_WHITE_KEYS_ROUNDED);

    let whiteIndex = 0;
    for (let midi = this.low; midi <= this.high; midi++) {
      const black = isBlackKey(midi);
      const key = document.createElement('div');
      key.className = `key ${black ? 'black' : 'white'}`;
      key.dataset.midi = String(midi);
      key.setAttribute('aria-label', germanName(midiToPitch(midi)));
      if (black) {
        const w = whiteWidth * 0.62;
        key.style.left = `${whiteIndex * whiteWidth - w / 2}%`;
        key.style.width = `${w}%`;
      } else {
        key.style.left = `${whiteIndex * whiteWidth}%`;
        key.style.width = `${whiteWidth}%`;
        whiteIndex++;
      }
      key.innerHTML = '<span class="note-label"></span><span class="pc-label"></span>';
      key.classList.toggle('held', this.hub.isHeld(midi));
      this.keys.set(midi, key);
      this.root.appendChild(key);
    }
    this.updateLabels();
  }

  private updateLabels(): void {
    for (const [midi, key] of this.keys) {
      const noteLabel = key.querySelector<HTMLElement>('.note-label')!;
      const pcLabel = key.querySelector<HTMLElement>('.pc-label')!;
      const p = midiToPitch(midi);
      // With many keys only the Cs are labelled, otherwise the labels don't fit.
      const compact = this.root.classList.contains('compact');
      const show = this.labels.noteNames && p.alter === 0 && (!compact || p.step === 'C');
      noteLabel.textContent = show ? germanName(p) : '';
      pcLabel.textContent = this.labels.computerKeys?.get(midi) ?? '';
    }
  }

  private keyFromEvent(e: PointerEvent): number | null {
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('.key');
    return el?.dataset.midi ? Number(el.dataset.midi) : null;
  }

  private press(pointerId: number, midi: number, time: number): void {
    this.pointerNotes.set(pointerId, midi);
    this.hub.emit({ type: 'on', midi, velocity: 100, time, source: 'screen' });
  }

  private release(pointerId: number, time: number): void {
    const midi = this.pointerNotes.get(pointerId);
    if (midi === undefined) return;
    this.pointerNotes.delete(pointerId);
    this.hub.emit({ type: 'off', midi, velocity: 0, time, source: 'screen' });
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    const midi = this.keyFromEvent(e);
    if (midi === null) return;
    e.preventDefault();
    // Allow sliding across keys on touch screens.
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    this.press(e.pointerId, midi, e.timeStamp || performance.now());
  };

  /** Glissando: moving a pressed pointer onto another key plays that key. */
  private onPointerOver = (e: PointerEvent): void => {
    const current = this.pointerNotes.get(e.pointerId);
    if (current === undefined) return;
    const midi = this.keyFromEvent(e);
    if (midi === null || midi === current) return;
    const time = e.timeStamp || performance.now();
    this.release(e.pointerId, time);
    this.press(e.pointerId, midi, time);
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.release(e.pointerId, e.timeStamp || performance.now());
  };
}

function countWhite(low: number, high: number): number {
  let count = 0;
  for (let m = low; m <= high; m++) if (!isBlackKey(m)) count++;
  return count;
}
