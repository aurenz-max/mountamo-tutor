/**
 * Generated displays as DeepDive sections. The menu is the display library's templates that match
 * this lesson; the agent reuses one by giving it new params (no code is written at lesson time),
 * and asks for one the library lacks with request_display, which the authoring job builds later.
 * Pre-readers get none: no template is marked as needing no reading.
 */
import { compileDisplay } from '../../gen-display/compile';
import { displayDocument } from '../../gen-display/document';
import { resolveParams, searchTemplates } from '../../gen-display/library';
import type { DisplayTemplate } from '../../gen-display/types';
import type { GenDisplayBlockData } from '../../../primitives/visual-primitives/core/deep-dive/types';

export function displayMenu(topic: string, intent: string | undefined, preReader: boolean): DisplayTemplate[] {
  return preReader ? [] : searchTemplates(`${topic} ${intent ?? ''}`);
}

/** One line per template for the agent: what it shows and the params it takes. */
export const displayMenuLine = (t: DisplayTemplate) =>
  `- ${t.id}: ${t.title}. Shows: ${t.idea} Params: ${Object.entries(t.params).map(([k, p]) => `${k} (${p.type}, ${p.description}; validated with ${JSON.stringify(p.default)})`).join('; ')}`;

const parse = (s: unknown): unknown => { if (typeof s !== 'string') return s; try { return JSON.parse(s); } catch { return s; } };

/** The block for a template with this lesson's params, or what the agent must fix. */
export function buildDisplayBlock(template: DisplayTemplate, given: unknown, base: Omit<GenDisplayBlockData, 'blockType' | 'displayId' | 'html'>): GenDisplayBlockData | { error: string } {
  const entries = Array.isArray(given) ? (given as Array<{ name?: string; valueJson?: string }>) : [];
  const values = Object.fromEntries(entries.filter((e) => e?.name).map((e) => [e.name!, parse(e.valueJson)]));
  const resolved = resolveParams(template.params, values);
  if ('error' in resolved) return resolved;
  const compiled = compileDisplay(template.source);
  if (!compiled.ok) return { error: `template ${template.id} no longer compiles: ${compiled.errors.join('; ')}` };
  return { ...base, blockType: 'display', displayId: template.id, html: displayDocument(compiled.js, resolved.values) };
}
