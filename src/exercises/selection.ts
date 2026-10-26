/** An item the selector may choose, with its static base weight. */
export interface Candidate<T> {
  readonly item: T;
  /** Statistics key of the item. */
  readonly key: string;
  /** Base weight, e.g. from the register weighting. */
  readonly baseWeight: number;
}

/**
 * Multiplies an item's base weight. The adaptive logic will be one of these:
 * a factor computed from the stored statistics (weak/slow/unseen items > 1).
 */
export type WeightModifier = (key: string) => number;

export interface ItemSelector {
  pick<T>(candidates: readonly Candidate<T>[]): T;
}

export interface WeightedSelectorOptions {
  random?: () => number;
  modifiers?: readonly WeightModifier[];
  /** Never pick the same item twice in a row (if there is an alternative). */
  avoidRepeat?: boolean;
}

/** Random choice proportional to baseWeight × all modifier factors. */
export class WeightedSelector implements ItemSelector {
  private lastKey: string | null = null;
  private random: () => number;
  private modifiers: readonly WeightModifier[];
  private avoidRepeat: boolean;

  constructor(options: WeightedSelectorOptions = {}) {
    this.random = options.random ?? Math.random;
    this.modifiers = options.modifiers ?? [];
    this.avoidRepeat = options.avoidRepeat ?? true;
  }

  weightOf(candidate: Candidate<unknown>): number {
    let w = candidate.baseWeight;
    for (const modify of this.modifiers) w *= modify(candidate.key);
    return Number.isFinite(w) && w > 0 ? w : 0;
  }

  pick<T>(candidates: readonly Candidate<T>[]): T {
    if (candidates.length === 0) throw new Error('No candidates to choose from');
    let pool = candidates;
    if (this.avoidRepeat && candidates.length > 1) pool = candidates.filter((c) => c.key !== this.lastKey);
    let weights = pool.map((c) => this.weightOf(c));
    let total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) {
      // Everything weighted 0 – fall back to a uniform choice.
      weights = pool.map(() => 1);
      total = pool.length;
    }
    let r = this.random() * total;
    let index = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r < 0) {
        index = i;
        break;
      }
    }
    this.lastKey = pool[index].key;
    return pool[index].item;
  }
}
