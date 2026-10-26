import type { NoteEvent, NoteListener } from './types';

/** Merges all input sources into one note stream and tracks held keys. */
export class InputHub {
  private listeners = new Set<NoteListener>();
  private held = new Map<number, number>(); // midi -> number of sources holding it

  emit(event: NoteEvent): void {
    const count = this.held.get(event.midi) ?? 0;
    if (event.type === 'on') this.held.set(event.midi, count + 1);
    else if (count <= 1) this.held.delete(event.midi);
    else this.held.set(event.midi, count - 1);
    this.listeners.forEach((l) => l(event));
  }

  subscribe(listener: NoteListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  isHeld(midi: number): boolean {
    return this.held.has(midi);
  }

  heldNotes(): number[] {
    return [...this.held.keys()].sort((a, b) => a - b);
  }
}
