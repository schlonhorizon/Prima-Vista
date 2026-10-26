/**
 * Chooses the next item from a list of candidates. The trainer only knows this
 * interface, so a stats-based adaptive selector (weighting weak, slow or long
 * unseen items) can replace the uniform one without touching exercises.
 */
export interface ItemSelector {
  pick<T>(candidates: readonly T[], keyOf: (item: T) => string): T;
}

/** Uniform random choice that avoids repeating the previous item. */
export class UniformSelector implements ItemSelector {
  private lastKey: string | null = null;

  constructor(private random: () => number = Math.random) {}

  pick<T>(candidates: readonly T[], keyOf: (item: T) => string): T {
    if (candidates.length === 0) throw new Error('No candidates to choose from');
    const pool = candidates.length > 1 ? candidates.filter((c) => keyOf(c) !== this.lastKey) : candidates;
    const choice = pool[Math.floor(this.random() * pool.length)] ?? pool[0];
    this.lastKey = keyOf(choice);
    return choice;
  }
}
