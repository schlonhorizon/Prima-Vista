import { germanName, isBlackKey, midiToPitch } from '../core/pitch';
import type { InputHub } from '../input/inputHub';

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

  /** Shows whole octaves covering [lowMidi, highMidi]. */
  setRange(lowMidi: number, highMidi: number): void {
    const low = lowMidi - (((lowMidi % 12) + 12) % 12);
    const high = highMidi + (11 - (((highMidi % 12) + 12) % 12));
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
    const cls = `flash-${kind}`;
    key.classList.remove(cls);
    void key.offsetWidth; // restart animation
    key.classList.add(cls);
    window.setTimeout(() => key.classList.remove(cls), durationMs);
  }

  private setHeld(midi: number, held: boolean): void {
    this.keys.get(midi)?.classList.toggle('held', held);
  }

  private build(): void {
    this.root.replaceChildren();
    this.keys.clear();
    let whiteCount = 0;
    for (let m = this.low; m <= this.high; m++) if (!isBlackKey(m)) whiteCount++;
    const whiteWidth = 100 / whiteCount;

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
      noteLabel.textContent = this.labels.noteNames && p.alter === 0 ? germanName(p) : '';
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
