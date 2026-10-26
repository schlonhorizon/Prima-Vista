import type { InputHub } from './inputHub';

export type MidiStatus =
  | { state: 'pending' }
  | { state: 'unsupported'; insecure: boolean }
  | { state: 'denied'; message: string }
  | { state: 'no-devices' }
  | { state: 'connected'; devices: string[] };

/** Web MIDI input: listens to note on/off on all connected inputs and channels. */
export class MidiInput {
  private access: MIDIAccess | null = null;
  private status: MidiStatus = { state: 'pending' };
  private listeners = new Set<(status: MidiStatus) => void>();

  constructor(private hub: InputHub) {}

  async start(): Promise<void> {
    if (typeof navigator.requestMIDIAccess !== 'function') {
      this.setStatus({ state: 'unsupported', insecure: !window.isSecureContext });
      return;
    }
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
    } catch (err) {
      this.setStatus({ state: 'denied', message: err instanceof Error ? err.message : String(err) });
      return;
    }
    this.access.onstatechange = () => this.refresh();
    this.refresh();
  }

  getStatus(): MidiStatus {
    return this.status;
  }

  onStatusChange(listener: (status: MidiStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  private refresh(): void {
    if (!this.access) return;
    const devices: string[] = [];
    this.access.inputs.forEach((input) => {
      // Assigning a handler implicitly opens the port.
      input.onmidimessage = this.handleMessage;
      if (input.state === 'connected') devices.push(input.name || 'MIDI-Gerät');
    });
    this.setStatus(devices.length > 0 ? { state: 'connected', devices } : { state: 'no-devices' });
  }

  private handleMessage = (event: MIDIMessageEvent): void => {
    const data = event.data;
    if (!data || data.length < 3) return;
    const command = data[0] & 0xf0;
    const midi = data[1];
    const velocity = data[2];
    const time = event.timeStamp || performance.now();
    if (command === 0x90 && velocity > 0) {
      this.hub.emit({ type: 'on', midi, velocity, time, source: 'midi' });
    } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
      this.hub.emit({ type: 'off', midi, velocity: 0, time, source: 'midi' });
    }
  };

  private setStatus(status: MidiStatus): void {
    this.status = status;
    this.listeners.forEach((l) => l(status));
  }
}
