import type { FactFileData } from '../../../primitives/visual-primitives/core/FactFile';
import { factChecks } from '../../../primitives/visual-primitives/core/factFileWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** A question with at least two distinct choices and a key that points at one of them. */
function answerable(c: { question?: unknown; options?: unknown; correctIndex?: unknown }): boolean {
  const options = Array.isArray(c.options) ? c.options.filter(o => typeof o === 'string' && o.trim()) : [];
  return typeof c.question === 'string' && !!c.question.trim() && Array.isArray(c.options) && options.length === c.options.length
    && options.length >= 2 && new Set(options.map(o => o.trim().toLowerCase())).size === options.length
    && Number.isInteger(c.correctIndex) && (c.correctIndex as number) >= 0 && (c.correctIndex as number) < options.length;
}

/** Reject a fact file whose self-checks cannot be attempted: the self-checks are the items. */
export function validateFactFileData(value: unknown): FactFileData {
  const d = value as FactFileData;
  if (!d || typeof d.title !== 'string' || !d.title.trim() || !Array.isArray(d.selfChecks) || !d.selfChecks.length
      || d.selfChecks.length > 8)
    throw new Error('Generated fact file has invalid lesson content.');
  const checks = factChecks(d);
  if (new Set(checks.map(c => c.id)).size !== checks.length) throw new Error('Generated fact file checks repeat an id.');
  for (const c of checks) if (!answerable(c)) throw new Error('A fact-file self-check cannot be answered as generated.');
  return d;
}

/** What the live adapter needs from the fact file; the catalog's `teachingWorkspace` declares the rest. */
export const factFileLiveDomain: WorkspaceDomain<FactFileData> = {
  validate: validateFactFileData,
  initialState: d => workspaceOpening({ title: d.title, task: factChecks(d)[0].question, total: factChecks(d).length }),
};
