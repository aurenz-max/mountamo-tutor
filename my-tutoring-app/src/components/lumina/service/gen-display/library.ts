/**
 * The display library (pilot store: JSON files under my-tutoring-app/data/gen-display). Validated
 * templates are saved here by the authoring loop and found by lessons through search; requests
 * for a display no template covers are appended to requests.jsonl, which the authoring job works
 * through. A template reused often is a candidate for a catalog primitive.
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DisplayParam, DisplayTemplate } from './types';

const DIR = () => process.env.LUMINA_GEN_DISPLAY_DIR ?? join(process.cwd(), 'data', 'gen-display');

export function listTemplates(): DisplayTemplate[] {
  const dir = DIR();
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as DisplayTemplate);
}

export function getTemplate(id: string): DisplayTemplate | undefined {
  const file = join(DIR(), `${id}.json`);
  return /^[a-z0-9-]+$/.test(id) && existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as DisplayTemplate) : undefined;
}

export function saveTemplate(t: DisplayTemplate) {
  mkdirSync(DIR(), { recursive: true });
  writeFileSync(join(DIR(), `${t.id}.json`), JSON.stringify(t, null, 2));
}

export function recordUse(id: string) {
  const t = getTemplate(id);
  if (t) saveTemplate({ ...t, uses: t.uses + 1 });
}

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'is', 'are', 'how', 'why', 'what', 'with', 'by', 'it', 'its', 'as', 'at', 'from', 'that', 'this', 'be', 'when', 'do', 'does']);
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.replace(/s$/, ''));

/** Templates whose idea, title or tags share words with the query, best first. */
export function searchTemplates(query: string, limit = 6): DisplayTemplate[] {
  const q = new Set(words(query));
  return listTemplates()
    .map((t) => ({ t, score: words(`${t.title} ${t.idea} ${t.tags.join(' ')}`).filter((w) => q.has(w)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.t.uses - a.t.uses)
    .slice(0, limit)
    .map((x) => x.t);
}

export interface DisplayRequest {
  at: string;
  topic: string;
  gradeLevel: string;
  idea: string;
  interaction: string;
  why: string;
}

export function requestDisplay(r: Omit<DisplayRequest, 'at'>) {
  mkdirSync(DIR(), { recursive: true });
  appendFileSync(join(DIR(), 'requests.jsonl'), `${JSON.stringify({ at: new Date().toISOString(), ...r })}\n`);
}

/**
 * Check lesson-supplied params against the template's declared inputs. Missing ones take the
 * validated default; a wrong type is an error the lesson agent must fix.
 */
export function resolveParams(params: Record<string, DisplayParam>, given: Record<string, unknown>): { values: Record<string, unknown> } | { error: string } {
  const values: Record<string, unknown> = {};
  for (const [name, p] of Object.entries(params)) {
    const v = name in given ? given[name] : p.default;
    const ok = p.type === 'number' ? typeof v === 'number' && Number.isFinite(v)
      : p.type === 'string' ? typeof v === 'string'
        : p.type === 'boolean' ? typeof v === 'boolean'
          : p.type === 'number[]' ? Array.isArray(v) && v.every((x) => typeof x === 'number' && Number.isFinite(x))
            : Array.isArray(v) && v.every((x) => typeof x === 'string');
    if (!ok) return { error: `param "${name}" must be ${p.type}` };
    values[name] = v;
  }
  const unknown = Object.keys(given).filter((k) => !(k in params));
  if (unknown.length) return { error: `unknown params: ${unknown.join(', ')}` };
  return { values };
}
