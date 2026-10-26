/**
 * Minimal Markdown for the knowledge content: headings, paragraphs, lists,
 * quotes (used for mnemonics), **bold**, *italic* and notation examples:
 *
 *   ```noten
 *   system: treble            (treble | bass | grand)
 *   tonart: A-major           (optional key id)
 *   noten: C4 E4+G4 A4        (steps separated by spaces, chord tones joined by +)
 *   text: Beschriftung        (optional caption)
 *   ```
 *
 * Content files may contain HTML comments for editors; they are removed.
 * All text is escaped – content files cannot inject HTML.
 */

export interface NotationSpec {
  system: 'treble' | 'bass' | 'grand';
  key: string | null;
  /** Steps of pitch ids, e.g. [["C4"], ["E4", "G4"]] */
  steps: string[][];
  caption: string;
}

export function stripComments(md: string): string {
  return md.replace(/<!--[\s\S]*?-->/g, '');
}

/** Splits a file into sections by "## id" headings. Text before the first section is ignored. */
export function parseSections(md: string): Map<string, string> {
  const sections = new Map<string, string>();
  let current: string | null = null;
  let lines: string[] = [];
  const flush = () => {
    if (current !== null) sections.set(current, lines.join('\n').trim());
  };
  for (const line of stripComments(md).split('\n')) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) {
      flush();
      current = m[1];
      lines = [];
    } else {
      lines.push(line);
    }
  }
  flush();
  return sections;
}

/** Placeholders like {name} in a template. */
export function placeholders(template: string): string[] {
  return [...new Set([...template.matchAll(/\{([a-zA-Z][\w-]*)\}/g)].map((m) => m[1]))];
}

/** Replaces {name} placeholders; missing values become an empty string. */
export function fill(template: string, vars: Readonly<Record<string, string>>): string {
  return template.replace(/\{([a-zA-Z][\w-]*)\}/g, (_, name: string) => vars[name] ?? '');
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>');
}

export function parseNotation(body: string): NotationSpec {
  const spec: NotationSpec = { system: 'treble', key: null, steps: [], caption: '' };
  for (const line of body.split('\n')) {
    const m = /^\s*(\w+)\s*:\s*(.*?)\s*$/.exec(line);
    if (!m) continue;
    const [, field, value] = m;
    if (field === 'system' && (value === 'treble' || value === 'bass' || value === 'grand')) spec.system = value;
    else if (field === 'tonart') spec.key = value || null;
    else if (field === 'noten') spec.steps = value.split(/\s+/).filter(Boolean).map((step) => step.split('+'));
    else if (field === 'text') spec.caption = value;
  }
  return spec;
}

/** Renders Markdown to HTML. Notation blocks become placeholders with a data-notation attribute. */
export function renderMarkdown(md: string): string {
  const out: string[] = [];
  const lines = stripComments(md).split('\n');
  let paragraph: string[] = [];
  let list: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let quote: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) out.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.type}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.type}>`);
    list = null;
  };
  const flushQuote = () => {
    if (quote.length) out.push(`<blockquote>${quote.map((q) => `<p>${inline(q)}</p>`).join('')}</blockquote>`);
    quote = [];
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      flushAll();
      const kind = trimmed.slice(3).trim();
      const body: string[] = [];
      while (++i < lines.length && !lines[i].trim().startsWith('```')) body.push(lines[i]);
      if (kind === 'noten') {
        const spec = parseNotation(body.join('\n'));
        out.push(`<figure class="notation-example" data-notation="${escapeHtml(JSON.stringify(spec))}"></figure>`);
      } else {
        out.push(`<pre>${escapeHtml(body.join('\n'))}</pre>`);
      }
      continue;
    }
    if (trimmed === '') {
      flushAll();
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushAll();
      const level = Math.min(heading[1].length + 1, 5); // "#" → h2 inside a card
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(trimmed);
    const numbered = /^\d+\.\s+(.*)$/.exec(trimmed);
    if (bullet || numbered) {
      flushParagraph();
      flushQuote();
      const type = bullet ? 'ul' : 'ol';
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }
    if (trimmed.startsWith('>')) {
      flushParagraph();
      flushList();
      quote.push(trimmed.replace(/^>\s?/, ''));
      continue;
    }
    if (list && /^\s{2,}/.test(line)) {
      // continuation of a list item
      list.items[list.items.length - 1] += ` ${trimmed}`;
      continue;
    }
    flushList();
    flushQuote();
    paragraph.push(trimmed);
  }
  flushAll();
  return out.join('\n');
}

/** First "# " heading of a document (used as lesson title). */
export function documentTitle(md: string): string {
  const m = /^#\s+(.+)$/m.exec(stripComments(md));
  return m ? m[1].trim() : '';
}

/** Document without its first "# " heading. */
export function withoutTitle(md: string): string {
  return stripComments(md).replace(/^#\s+.+$/m, '');
}
