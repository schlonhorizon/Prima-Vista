import type { Step } from '../core/pitch';
import { ALL_KEYS, fifthsOf, germanKeyName, keyId, type Key, type KeyMode } from '../theory/key';
import { CircleOfFifths } from './circleOfFifths';

const LETTER_ORDER: readonly Step[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/** Keys sorted by letter (C, Cis, Ces, D, Des …) so the answer is not just a count along the circle. */
function keysByLetter(mode: KeyMode): Key[] {
  return ALL_KEYS.filter((k) => k.mode === mode).sort(
    (a, b) =>
      LETTER_ORDER.indexOf(a.tonic.step) - LETTER_ORDER.indexOf(b.tonic.step) ||
      Math.abs(a.tonic.alter) - Math.abs(b.tonic.alter) ||
      b.tonic.alter - a.tonic.alter,
  );
}

export interface KeyQuizAnswer {
  major: Key;
  minor: Key;
}

/**
 * Answer panel for "Tonart erkennen": one button row for the major key and one
 * for the relative minor. The answer is submitted once both are chosen.
 */
export class KeyQuizPanel {
  private chosen: { major: Key | null; minor: Key | null } = { major: null, minor: null };
  private locked = false;
  private circle: CircleOfFifths;

  constructor(
    private root: HTMLElement,
    private onAnswer: (answer: KeyQuizAnswer) => void,
    onToggleCircle: () => void,
  ) {
    for (const mode of ['major', 'minor'] as const) {
      const row = root.querySelector<HTMLElement>(`[data-key-row="${mode}"]`)!;
      row.replaceChildren(
        ...keysByLetter(mode).map((key) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'key-choice';
          button.dataset.key = keyId(key);
          button.textContent = germanKeyName(key).replace(/-(Dur|Moll)$/, '');
          button.setAttribute('aria-label', germanKeyName(key));
          button.setAttribute('aria-pressed', 'false');
          button.addEventListener('click', () => this.choose(key));
          return button;
        }),
      );
    }
    this.circle = new CircleOfFifths(root.querySelector<HTMLElement>('#circle')!);
    root.querySelector('#circle-toggle')!.addEventListener('click', onToggleCircle);
  }

  setCircleVisible(visible: boolean): void {
    this.root.querySelector<HTMLElement>('#circle')!.hidden = !visible;
    this.root.querySelector('#circle-toggle')!.textContent = visible ? 'Quintenzirkel ausblenden' : 'Quintenzirkel einblenden';
  }

  /** Resets the panel for a new task. */
  reset(): void {
    this.chosen = { major: null, minor: null };
    this.locked = false;
    this.root.querySelectorAll<HTMLButtonElement>('.key-choice').forEach((b) => {
      b.classList.remove('chosen', 'right', 'wrong');
      b.setAttribute('aria-pressed', 'false');
      b.disabled = false;
    });
    this.circle.highlight(null);
  }

  /** Shows the solution: correct keys in emerald, wrong choices in bordeaux. */
  showSolution(fifths: number): void {
    this.locked = true;
    this.root.querySelectorAll<HTMLButtonElement>('.key-choice').forEach((b) => {
      const key = ALL_KEYS.find((k) => keyId(k) === b.dataset.key)!;
      const right = fifthsOf(key) === fifths;
      b.classList.toggle('right', right);
      b.classList.toggle('wrong', b.classList.contains('chosen') && !right);
      b.disabled = true;
    });
    this.circle.highlight(fifths);
  }

  private choose(key: Key): void {
    if (this.locked) return;
    this.chosen[key.mode] = key;
    this.root.querySelectorAll<HTMLButtonElement>(`[data-key-row="${key.mode}"] .key-choice`).forEach((b) => {
      const on = b.dataset.key === keyId(key);
      b.classList.toggle('chosen', on);
      b.setAttribute('aria-pressed', String(on));
    });
    const { major, minor } = this.chosen;
    if (major && minor) this.onAnswer({ major, minor });
  }
}
