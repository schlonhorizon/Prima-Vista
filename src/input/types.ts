export type InputSourceKind = 'midi' | 'screen' | 'computer';

export interface NoteEvent {
  readonly type: 'on' | 'off';
  readonly midi: number;
  readonly velocity: number;
  /** Event time in the performance.now() time base. */
  readonly time: number;
  readonly source: InputSourceKind;
}

export type NoteListener = (event: NoteEvent) => void;
