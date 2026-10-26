import { parsePitchId, type Pitch } from '../core/pitch';
import { StaffRenderer } from '../render/staffRenderer';
import { parseKeyId } from '../theory/key';
import type { NotationSpec } from './markdown';

/** Renders all notation examples (figure[data-notation]) inside `root` with VexFlow. */
export function renderNotationExamples(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('figure[data-notation]').forEach((figure) => {
    let spec: NotationSpec;
    try {
      spec = JSON.parse(figure.dataset.notation!) as NotationSpec;
    } catch {
      return;
    }
    const steps = spec.steps.map((ids) => ({
      pitches: ids.map((id) => parsePitchId(id)).filter((p): p is Pitch => p !== null),
    }));
    const staff = document.createElement('div');
    staff.className = 'notation-staff';
    figure.replaceChildren(staff);
    if (spec.caption) {
      const caption = document.createElement('figcaption');
      caption.textContent = spec.caption;
      figure.appendChild(caption);
    }
    const key = spec.key ? parseKeyId(spec.key) : null;
    const baseWidth = 200 + Math.max(1, steps.length) * 42;
    new StaffRenderer(staff, { baseWidth, maxScale: 1.3, fitHeight: true }).render(spec.system, steps, 'none', key);
  });
}

