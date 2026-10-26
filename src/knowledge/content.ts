import { parseSections } from './markdown';

/**
 * All content files under src/content, bundled as text. Lessons live in
 * content/lessons/<mode>.md, task-related text blocks in content/knowledge/<mode>.md.
 */
const FILES = import.meta.glob('../content/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

const sectionCache = new Map<string, Map<string, string>>();

/** Raw content file, e.g. contentFile('lessons/keys'). */
export function contentFile(path: string): string {
  const text = FILES[`../content/${path}.md`];
  if (text === undefined) throw new Error(`Missing content file: ${path}.md`);
  return text;
}

export function contentPaths(): string[] {
  return Object.keys(FILES).map((k) => k.replace(/^\.\.\/content\//, '').replace(/\.md$/, ''));
}

/** Sections of a text-block file, e.g. sections('knowledge/intervals'). */
export function sections(path: string): Map<string, string> {
  let map = sectionCache.get(path);
  if (!map) {
    map = parseSections(contentFile(path));
    sectionCache.set(path, map);
  }
  return map;
}

/** One section; throws if it is missing so content errors show up in tests. */
export function section(path: string, id: string): string {
  const text = sections(path).get(id);
  if (text === undefined) throw new Error(`Missing section "## ${id}" in content/${path}.md`);
  return text;
}
