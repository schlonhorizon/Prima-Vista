/**
 * Keyboard shortcuts of the app. None of them uses a key of the computer piano
 * (A–Ä, W–P, Y/X): the knowledge keys sit together on the lower right row (B N M),
 * flow keys are arrows/Enter/Esc, and ? opens the overview.
 */
export interface Shortcut {
  /** KeyboardEvent.code, or null if matched by `key`. */
  readonly code: string | null;
  /** KeyboardEvent.key for layout-dependent characters such as "?". */
  readonly key?: string;
  /** Label shown on buttons and in the overview. */
  readonly display: string;
  readonly description: string;
}

export const SHORTCUTS = {
  tip: { code: 'KeyN', display: 'N', description: 'Tipp zur laufenden Aufgabe (zählt als „mit Hilfe“)' },
  explain: { code: 'KeyM', display: 'M', description: 'Mehr erfahren – Erklärung zur letzten Aufgabe' },
  lesson: { code: 'KeyB', display: 'B', description: 'Lektion zum aktuellen Modus' },
  skip: { code: 'ArrowRight', display: '→', description: 'Aufgabe überspringen (Lösung wird gezeigt)' },
  next: { code: 'Enter', display: 'Enter', description: 'Weiter, wenn eine Erklärung offen ist' },
  close: { code: 'Escape', display: 'Esc', description: 'Karte, Lektion oder Übersicht schließen' },
  help: { code: null, key: '?', display: '?', description: 'Diese Übersicht' },
  confirm: { code: 'Space', display: 'Leertaste', description: 'Auswahl auf der Bildschirmtastatur bestätigen' },
} as const satisfies Record<string, Shortcut>;

export type ShortcutId = keyof typeof SHORTCUTS;

export function matches(e: KeyboardEvent, id: ShortcutId): boolean {
  const s: Shortcut = SHORTCUTS[id];
  if (s.code === null) return e.key === s.key;
  if (id === 'next') return e.code === 'Enter' || e.code === 'NumpadEnter';
  return e.code === s.code && !e.shiftKey;
}

/** True if a key event should not trigger shortcuts (typing in a form field, modifier held). */
export function isTypingTarget(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  const t = e.target as HTMLElement | null;
  return !!t && (['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName) || t.isContentEditable);
}

/** Fills every <kbd data-shortcut="id"> with the key label from the registry. */
export function labelShortcutHints(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('kbd[data-shortcut]').forEach((kbd) => {
    const s = SHORTCUTS[kbd.dataset.shortcut as ShortcutId];
    if (s) kbd.textContent = s.display;
  });
}
