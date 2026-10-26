/** Fixed keyboard ranges selectable in the settings. Independent of the connected MIDI device. */
export interface RangePreset {
  readonly id: string;
  readonly label: string;
  readonly low: string;
  readonly high: string;
}

export const RANGE_PRESETS: readonly RangePreset[] = [
  { id: 'nord88', label: 'Nord Stage 4 (88 Tasten, A0–C8)', low: 'A0', high: 'C8' },
];

export function findPreset(id: string): RangePreset | undefined {
  return RANGE_PRESETS.find((p) => p.id === id);
}
