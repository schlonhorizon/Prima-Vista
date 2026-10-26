import { germanKeyName, keyFromFifths } from '../theory/key';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SIZE = 320;
const C = SIZE / 2;
const R_OUTER = 150;
const R_MIDDLE = 100;
const R_INNER = 44;

/** Position on the circle (0 = top, clockwise) for a number of fifths; enharmonic keys share one. */
function position(fifths: number): number {
  return ((fifths % 12) + 12) % 12;
}

function polar(radius: number, angleDeg: number): [number, number] {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [C + radius * Math.cos(a), C + radius * Math.sin(a)];
}

function wedge(r1: number, r2: number, from: number, to: number): string {
  const [x1, y1] = polar(r2, from);
  const [x2, y2] = polar(r2, to);
  const [x3, y3] = polar(r1, to);
  const [x4, y4] = polar(r1, from);
  return `M${x1} ${y1}A${r2} ${r2} 0 0 1 ${x2} ${y2}L${x3} ${y3}A${r1} ${r1} 0 0 0 ${x4} ${y4}Z`;
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** Circle of fifths: majors outside, minors inside; enharmonic pairs share a segment. */
export class CircleOfFifths {
  private svg: SVGSVGElement;

  constructor(container: HTMLElement) {
    this.svg = el('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, class: 'circle-svg', role: 'img', 'aria-label': 'Quintenzirkel' });
    for (let pos = 0; pos < 12; pos++) {
      const from = pos * 30 - 15;
      const to = pos * 30 + 15;
      this.svg.append(
        el('path', { d: wedge(R_MIDDLE, R_OUTER, from, to), class: 'segment major', 'data-pos': pos }),
        el('path', { d: wedge(R_INNER, R_MIDDLE, from, to), class: 'segment minor', 'data-pos': pos }),
      );
    }
    // Labels: every signature from −7 to 7; positions 5–7 hold two keys each.
    for (let f = -7; f <= 7; f++) {
      const pos = position(f);
      const shared = pos >= 5 && pos <= 7;
      // Sharp key above, flat key below in the shared segments.
      const offset = shared ? (f > 0 ? -1 : 1) : 0;
      this.label(f, pos, 'major', (R_MIDDLE + R_OUTER) / 2, offset);
      this.label(f, pos, 'minor', (R_INNER + R_MIDDLE) / 2, offset);
    }
    this.svg.append(el('circle', { cx: C, cy: C, r: R_INNER - 6, class: 'hub' }));
    container.replaceChildren(this.svg);
  }

  /** Highlights the given signature (null clears). */
  highlight(fifths: number | null): void {
    this.svg.querySelectorAll('.highlight').forEach((n) => n.classList.remove('highlight'));
    if (fifths === null) return;
    this.svg.querySelectorAll(`[data-pos="${position(fifths)}"].segment`).forEach((n) => n.classList.add('highlight'));
    this.svg.querySelectorAll(`[data-fifths="${fifths}"]`).forEach((n) => n.classList.add('highlight'));
  }

  private label(fifths: number, pos: number, mode: 'major' | 'minor', radius: number, offset: number): void {
    const [x, y] = polar(radius, pos * 30);
    const name = germanKeyName(keyFromFifths(fifths, mode)).replace(/-(Dur|Moll)$/, '');
    const fontSize = mode === 'major' ? 15 : 13;
    const text = el('text', {
      x,
      y: y + offset * (fontSize * 0.62) + fontSize * 0.35,
      class: `label ${mode}`,
      'data-fifths': fifths,
      'font-size': offset !== 0 ? fontSize - 2 : fontSize,
      'text-anchor': 'middle',
    });
    text.textContent = name;
    this.svg.append(text);
  }
}
