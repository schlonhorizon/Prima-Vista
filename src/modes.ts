/** All practice modes of the app, in navigation order. See ROADMAP.md. */
export type PracticeModeId =
  | 'notes' | 'intervals' | 'chords' | 'keys'
  | 'rhythm' | 'progressions' | 'reading' | 'leadsheets' | 'scales' | 'ear' | 'mixed' | 'primavista';

export interface ModeInfo {
  readonly id: PracticeModeId;
  readonly label: string;
  /** Planned modes are shown greyed out in the navigation. */
  readonly ready: boolean;
}

export const MODES: readonly ModeInfo[] = [
  { id: 'notes', label: 'Einzelnoten', ready: true },
  { id: 'intervals', label: 'Intervalle', ready: true },
  { id: 'chords', label: 'Akkorde', ready: false },
  { id: 'keys', label: 'Tonarten', ready: false },
  { id: 'rhythm', label: 'Rhythmus', ready: false },
  { id: 'progressions', label: 'Abfolgen', ready: false },
  { id: 'reading', label: 'Vorauslesen', ready: false },
  { id: 'leadsheets', label: 'Leadsheets', ready: false },
  { id: 'scales', label: 'Tonleitern', ready: false },
  { id: 'ear', label: 'Gehör', ready: false },
  { id: 'mixed', label: 'Gemischt', ready: false },
  { id: 'primavista', label: 'Prima Vista', ready: false },
];

export function isReadyMode(id: unknown): id is PracticeModeId {
  return MODES.some((m) => m.id === id && m.ready);
}
