import type { StatsStore } from '../stats/statsStore';
import type { StatsGroup, StatsRow } from '../stats/statsView';

interface Totals {
  hits: number;
  misses: number;
  timeSum: number;
  timeCount: number;
}

const WEAK_RATE = 0.7;
const WEAK_MIN_ATTEMPTS = 3;

/** Statistics as collapsible groups; the groups come from the active exercise. */
export class StatsTable {
  private openGroups = new Set<string>();

  constructor(private container: HTMLElement, private stats: StatsStore) {}

  render(groups: readonly StatsGroup[]): void {
    this.container.replaceChildren(...groups.map((g) => this.section(g)));
  }

  private totals(keys: readonly string[]): Totals {
    const t: Totals = { hits: 0, misses: 0, timeSum: 0, timeCount: 0 };
    for (const key of keys) {
      const item = this.stats.getItem(key);
      if (!item) continue;
      t.hits += item.hits;
      t.misses += item.misses;
      t.timeSum += item.hitTimeSum;
      t.timeCount += item.hitTimeCount;
    }
    return t;
  }

  private section(group: StatsGroup): HTMLElement {
    const rows = group.rows.map((row) => ({ row, totals: this.totals(row.keys) }));
    const sum = this.totals(group.rows.flatMap((r) => r.keys));

    const details = document.createElement('details');
    details.className = 'octave';
    details.open = this.openGroups.has(group.title);
    details.addEventListener('toggle', () => {
      if (details.open) this.openGroups.add(group.title);
      else this.openGroups.delete(group.title);
    });

    const summary = document.createElement('summary');
    summary.innerHTML = '<span class="octave-name"></span><span class="octave-figures"></span>';
    summary.querySelector('.octave-name')!.textContent = group.title;
    const weakCount = rows.filter((r) => isWeak(r.totals)).length;
    const total = sum.hits + sum.misses;
    summary.querySelector('.octave-figures')!.textContent =
      total === 0
        ? 'noch nicht geübt'
        : `${sum.hits} ✓ · ${sum.misses} ✗ · ${percent(sum.hits / total)} · Ø ${formatAvg(sum)}` +
          (weakCount > 0 ? ` · ${weakCount} schwach` : '');
    summary.classList.toggle('weak', weakCount > 0);
    details.appendChild(summary);

    const table = document.createElement('table');
    table.className = 'stats-table';
    const head = document.createElement('tr');
    for (const [i, title] of [...group.columns, 'Richtig', 'Falsch', 'Quote', 'Ø Zeit'].entries()) {
      const th = document.createElement('th');
      th.textContent = title;
      if (i < group.columns.length) th.className = 'text';
      head.appendChild(th);
    }
    const thead = document.createElement('thead');
    thead.appendChild(head);
    table.appendChild(thead);

    const body = document.createElement('tbody');
    for (const { row, totals } of rows) body.appendChild(this.row(row, totals, group.columns.length));
    table.appendChild(body);

    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    wrap.appendChild(table);
    details.appendChild(wrap);
    return details;
  }

  private row(row: StatsRow, t: Totals, textColumns: number): HTMLElement {
    const attempts = t.hits + t.misses;
    const cells = [
      ...row.cells,
      String(t.hits),
      String(t.misses),
      attempts > 0 ? percent(t.hits / attempts) : '–',
      formatAvg(t),
    ];
    const tr = document.createElement('tr');
    cells.forEach((text, i) => {
      const td = document.createElement('td');
      td.textContent = text;
      if (i < textColumns) td.className = 'text';
      if (i === textColumns + 2 && isWeak(t)) td.classList.add('weak');
      tr.appendChild(td);
    });
    return tr;
  }
}

function isWeak(t: Totals): boolean {
  const attempts = t.hits + t.misses;
  return attempts >= WEAK_MIN_ATTEMPTS && t.hits / attempts < WEAK_RATE;
}

function percent(x: number): string {
  return `${Math.round(x * 100)} %`;
}

function formatAvg(t: Totals): string {
  if (t.timeCount === 0) return '–';
  const avg = t.timeSum / t.timeCount;
  return avg < 10000 ? `${Math.round(avg)} ms` : `${(avg / 1000).toFixed(1)} s`;
}
