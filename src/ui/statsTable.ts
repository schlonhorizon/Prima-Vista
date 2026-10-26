import { germanName, type Pitch } from '../core/pitch';
import type { Candidate } from '../exercises/selection';
import type { StatsStore } from '../stats/statsStore';

interface Row {
  candidate: Candidate<Pitch>;
  hits: number;
  misses: number;
  timeSum: number;
  timeCount: number;
}

const CLEF_SHORT: Record<string, string> = { treble: 'Violin', bass: 'Bass' };
const WEAK_RATE = 0.7;
const WEAK_MIN_ATTEMPTS = 3;

/** Per-note statistics, grouped by octave into collapsible sections. */
export class StatsTable {
  private openOctaves = new Set<number>();

  constructor(private container: HTMLElement, private stats: StatsStore) {}

  render(candidates: readonly Candidate<Pitch>[]): void {
    const byOctave = new Map<number, Row[]>();
    for (const c of candidates) {
      const item = this.stats.getItem(c.key);
      const row: Row = {
        candidate: c,
        hits: item?.hits ?? 0,
        misses: item?.misses ?? 0,
        timeSum: item?.hitTimeSum ?? 0,
        timeCount: item?.hitTimeCount ?? 0,
      };
      const octave = c.item.octave;
      if (!byOctave.has(octave)) byOctave.set(octave, []);
      byOctave.get(octave)!.push(row);
    }

    const sections = [...byOctave.entries()]
      .sort(([a], [b]) => b - a) // high to low, like on the staff
      .map(([octave, rows]) => this.section(octave, rows));
    this.container.replaceChildren(...sections);
  }

  private section(octave: number, rows: Row[]): HTMLElement {
    const sum = rows.reduce(
      (acc, r) => ({
        hits: acc.hits + r.hits,
        misses: acc.misses + r.misses,
        timeSum: acc.timeSum + r.timeSum,
        timeCount: acc.timeCount + r.timeCount,
      }),
      { hits: 0, misses: 0, timeSum: 0, timeCount: 0 },
    );
    const details = document.createElement('details');
    details.className = 'octave';
    details.open = this.openOctaves.has(octave);
    details.addEventListener('toggle', () => {
      if (details.open) this.openOctaves.add(octave);
      else this.openOctaves.delete(octave);
    });

    const summary = document.createElement('summary');
    const weakCount = rows.filter(isWeak).length;
    summary.innerHTML = `<span class="octave-name"></span><span class="octave-figures"></span>`;
    summary.querySelector('.octave-name')!.textContent = `Oktave ${octave}`;
    const total = sum.hits + sum.misses;
    summary.querySelector('.octave-figures')!.textContent =
      total === 0
        ? 'noch nicht geübt'
        : `${sum.hits} ✓ · ${sum.misses} ✗ · ${percent(sum.hits / total)} · Ø ${formatAvg(sum.timeSum, sum.timeCount)}` +
          (weakCount > 0 ? ` · ${weakCount} schwach` : '');
    summary.classList.toggle('weak', weakCount > 0);
    details.appendChild(summary);

    const table = document.createElement('table');
    table.className = 'stats-table';
    table.innerHTML =
      '<thead><tr><th>Note</th><th>Schlüssel</th><th>Gewicht</th><th>Richtig</th><th>Falsch</th><th>Quote</th><th>Ø Zeit</th></tr></thead>';
    const body = document.createElement('tbody');
    for (const r of [...rows].reverse()) {
      const attempts = r.hits + r.misses;
      const cells = [
        germanName(r.candidate.item),
        CLEF_SHORT[r.candidate.key.split('|')[1]] ?? '',
        formatWeight(r.candidate.baseWeight),
        String(r.hits),
        String(r.misses),
        attempts > 0 ? percent(r.hits / attempts) : '–',
        formatAvg(r.timeSum, r.timeCount),
      ];
      const tr = document.createElement('tr');
      cells.forEach((text, i) => {
        const td = document.createElement('td');
        td.textContent = text;
        if (i === 5 && isWeak(r)) td.className = 'weak';
        tr.appendChild(td);
      });
      body.appendChild(tr);
    }
    table.appendChild(body);
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    wrap.appendChild(table);
    details.appendChild(wrap);
    return details;
  }
}

function isWeak(r: Row): boolean {
  const attempts = r.hits + r.misses;
  return attempts >= WEAK_MIN_ATTEMPTS && r.hits / attempts < WEAK_RATE;
}

function percent(x: number): string {
  return `${Math.round(x * 100)} %`;
}

function formatAvg(sum: number, count: number): string {
  if (count === 0) return '–';
  const avg = sum / count;
  return avg < 10000 ? `${Math.round(avg)} ms` : `${(avg / 1000).toFixed(1)} s`;
}

function formatWeight(w: number): string {
  return w === 1 ? '1' : w.toLocaleString('de-DE', { maximumFractionDigits: 3 });
}
