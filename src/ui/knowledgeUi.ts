import type { Task } from '../exercises/types';
import { contentFile } from '../knowledge/content';
import { documentTitle, renderMarkdown, withoutTitle } from '../knowledge/markdown';
import { renderNotationExamples } from '../knowledge/notationExamples';
import { KNOWLEDGE, type KnowledgeProvider } from '../knowledge/providers';
import type { Trainer } from '../trainer/trainer';

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

export interface KnowledgeUiHooks {
  trainer: Trainer;
  /** Explanations open automatically after every answer. */
  autoExplain(): boolean;
  /** True while letter keys play the piano (then H and L need Shift). */
  pianoKeysActive(): boolean;
  /** Lesson for the active mode (also when no task is running). */
  currentLesson(): string | null;
}

type CardKind = 'tip' | 'explanation';

/**
 * The knowledge layer in the UI: tip during a task (H), explanation after the
 * answer (I) and the lesson of the mode (L). Everything is hidden until asked for.
 */
export class KnowledgeUi {
  private task: Task | null = null;
  private answered: Task | null = null;
  private open: CardKind | null = null;
  private tipUsed = false;

  private card = $('knowledge-card');
  private dialog = $<HTMLDialogElement>('lesson-dialog');

  constructor(private hooks: KnowledgeUiHooks) {
    $('tip-button').addEventListener('click', () => this.showTip());
    $('explain-button').addEventListener('click', () => this.toggleExplanation());
    $('lesson-button').addEventListener('click', () => this.openLesson());
    $('knowledge-close').addEventListener('click', () => this.close());
    $('continue-button').addEventListener('click', () => this.close());
    $('lesson-close').addEventListener('click', () => this.dialog.close());
    this.dialog.addEventListener('close', () => {
      if (!this.open && this.hooks.trainer.isHeld()) this.hooks.trainer.resume();
    });
    window.addEventListener('keydown', this.onKey);
  }

  /** A new task is on screen. */
  onTask(task: Task): void {
    this.task = task;
    this.tipUsed = false;
    this.hideCard();
    this.updateButtons();
  }

  /** The current task was answered. */
  onResult(task: Task): void {
    this.answered = task;
    if (this.hooks.autoExplain() && this.provider(task)?.explain(task)) this.showExplanation();
    this.updateButtons();
  }

  /** Updates shortcut hints (they depend on the input mode). */
  updateButtons(): void {
    const shift = this.hooks.pianoKeysActive() ? '⇧' : '';
    $('tip-key').textContent = `${shift}H`;
    $('lesson-key').textContent = `${shift}L`;
    const running = this.task !== null && !this.hooks.trainer.isWaiting();
    const tipAvailable = running && !!this.task && !!this.provider(this.task)?.tip(this.task);
    $<HTMLButtonElement>('tip-button').disabled = !tipAvailable;
    $('tip-button').classList.toggle('used', this.tipUsed);
    const explain = $<HTMLButtonElement>('explain-button');
    explain.disabled = !this.answered;
    explain.title = running && this.answered ? 'Erklärung zur vorigen Aufgabe' : 'Erklärung zur Aufgabe';
    $<HTMLButtonElement>('lesson-button').disabled = !this.hooks.currentLesson();
  }

  private provider(task: Task): KnowledgeProvider | undefined {
    return KNOWLEDGE[task.exerciseId];
  }

  private showTip(): void {
    const task = this.task;
    if (!task || this.hooks.trainer.isWaiting()) return;
    const tip = this.provider(task)?.tip(task);
    if (!tip) return;
    this.tipUsed = true;
    this.hooks.trainer.markAssisted();
    this.showCard('tip', 'Tipp', tip, 'Versuche mit Tipp zählen in der Statistik als „mit Hilfe“.');
    this.updateButtons();
  }

  private toggleExplanation(): void {
    if (this.open === 'explanation') this.close();
    else this.showExplanation();
  }

  private showExplanation(): void {
    const task = this.answered;
    if (!task) return;
    const text = this.provider(task)?.explain(task);
    if (!text) return;
    const trainer = this.hooks.trainer;
    // Reading after the answer pauses the practice loop; reading during the next
    // task only makes its reaction time invalid.
    if (trainer.isWaiting()) trainer.hold();
    else trainer.invalidateTiming();
    this.showCard('explanation', `Mehr erfahren: ${task.label}`, text);
  }

  private openLesson(): void {
    const path = this.hooks.currentLesson();
    if (!path) return;
    const md = contentFile(path);
    const trainer = this.hooks.trainer;
    if (trainer.isWaiting()) trainer.hold();
    else trainer.invalidateTiming();
    $('lesson-title').textContent = documentTitle(md);
    const body = $('lesson-body');
    body.innerHTML = renderMarkdown(withoutTitle(md));
    this.dialog.showModal();
    body.scrollTop = 0;
    renderNotationExamples(body);
  }

  private showCard(kind: CardKind, title: string, markdown: string, note = ''): void {
    this.open = kind;
    this.card.hidden = false;
    this.card.dataset.kind = kind;
    $('knowledge-title').textContent = title;
    const body = $('knowledge-body');
    body.innerHTML = renderMarkdown(markdown);
    renderNotationExamples(body);
    $('knowledge-note').textContent = note;
    $('knowledge-continue').hidden = !this.hooks.trainer.isHeld();
  }

  private hideCard(): void {
    this.open = null;
    this.card.hidden = true;
  }

  /** Closes the card; continues the practice loop if it was held for reading. */
  private close(): void {
    this.hideCard();
    if (this.hooks.trainer.isHeld()) this.hooks.trainer.resume();
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey || this.dialog.open) return;
    const target = e.target as HTMLElement | null;
    if (target && (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable)) return;
    const plainLetters = !this.hooks.pianoKeysActive();
    switch (e.code) {
      case 'KeyI':
        e.preventDefault();
        this.toggleExplanation();
        break;
      case 'KeyH':
        if (e.shiftKey || plainLetters) {
          e.preventDefault();
          this.showTip();
        }
        break;
      case 'KeyL':
        if (e.shiftKey || plainLetters) {
          e.preventDefault();
          this.openLesson();
        }
        break;
      case 'Enter':
      case 'NumpadEnter':
        if (this.hooks.trainer.isHeld() && target?.tagName !== 'BUTTON') {
          e.preventDefault();
          this.close();
        }
        break;
      case 'Escape':
        if (this.open) this.close();
        break;
    }
  };
}
