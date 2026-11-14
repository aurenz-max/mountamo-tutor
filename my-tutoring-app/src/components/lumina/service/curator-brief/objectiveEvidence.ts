/**
 * Objective evidence from the curator brief, pure.
 *
 * The brief writes one evidence spec per objective (`agent-kit/evidence.ts`). Two lesson shapes reach it:
 *  - a free-form lesson, where the brief also writes the objectives: each written objective keeps its own spec;
 *  - a curriculum-launched lesson, where the objectives are GIVEN (`preBuiltObjectives`) and the brief is told to use
 *    them verbatim and write only the evidence: the given objects win on every identity field (id, text, verb, subskill,
 *    grade) and take the brief's evidence, matched by id first and by position second, since the prompt lists them in
 *    order and the model sometimes renumbers.
 * A spec that does not parse is dropped, never a lesson: a generator with no spec plans one from the objective text.
 */
import { readEvidence, type EvidenceSpec } from '../agent-kit/evidence';

export interface ObjectiveLike { id: string; text: string; verb: string }

const list = (raw: unknown): Array<Record<string, unknown>> =>
  Array.isArray(raw) ? raw.filter((o): o is Record<string, unknown> => !!o && typeof o === 'object') : [];

/** The brief's own objectives, each with its spec parsed (or none). */
export function parseWrittenObjectives<T extends Record<string, unknown>>(written: unknown): T[] {
  return list(written).map(o => {
    const evidence = readEvidence(o.evidence);
    const { evidence: _dropped, ...rest } = o;
    return (evidence ? { ...rest, evidence } : rest) as T;
  });
}

/** The given objectives, each with the brief's evidence for it when the brief wrote one it did not already have. */
export function attachEvidenceToGiven<T extends ObjectiveLike & { evidence?: EvidenceSpec }>(given: readonly T[], written: unknown): T[] {
  const writtenList = list(written);
  return given.map((o, i) => {
    if (o.evidence) return o;
    const match = writtenList.find(w => w.id === o.id) ?? writtenList[i];
    const evidence = match ? readEvidence(match.evidence) : undefined;
    return evidence ? { ...o, evidence } : o;
  });
}
