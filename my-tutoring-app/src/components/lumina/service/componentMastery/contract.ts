/**
 * Component mastery: a per-child tally over the small parts a subskill is made of (a letter-sound pair, later a
 * single math fact), one level below the subskill. Client-safe wire types; the kinds are in `registry.ts`.
 *
 * WHAT IT IS NOT. It is not curriculum (nothing here is authored or published), it has no prerequisites or
 * children, and it never selects a lesson, sets a gate or feeds IRT: the learner model stays the one selector.
 * It is shown to the family and may bias which items a lesson already selected draws.
 *
 * FLOW. A primitive puts `componentTallies` on its metrics, in the unit its kind is observed in (for
 * `letter_sound`, a printed word read aloud). The submit path posts them to `/api/lumina/component-evidence`,
 * where the kind expands its units into component ids from its own library, and sends the result to the backend
 * as `primitive_response.component_evidence`. The backend stores it on the attempt and increments
 * `students/{id}/component_mastery/{kind}`; it knows no kind and no primitive.
 */

/** What a primitive observed, in the kind's own unit. */
export interface ComponentTally {
  kind: string;
  units: Array<{ unit: string; attempts: number; correct: number }>;
}

/** What the backend stores: one row per component id. */
export interface ComponentEvidence {
  kind: string;
  id: string;
  attempts: number;
  correct: number;
}

/** One component of a kind, in the order the grid shows it. */
export interface ComponentInfo {
  id: string;
  /** What the cell shows, e.g. "sh". */
  label: string;
  /** A second line: a word the component is read in ("rain" for ai). */
  detail?: string;
  /** Other ids shown in this cell and counted with it (the two short o pairs). */
  also?: string[];
  /** The row the cell sits in, e.g. "Letter group 1". */
  group: string;
}

export const KIND_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
export const MAX_COMPONENT_ID = 40;
export const MAX_UNITS = 400;
export const MAX_EVIDENCE = 200;

const count = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 1000;

export function validTallies(v: unknown): v is ComponentTally[] {
  return Array.isArray(v) && v.length <= 8 && v.every(t => !!t && typeof t.kind === 'string' && KIND_PATTERN.test(t.kind)
    && Array.isArray(t.units) && t.units.length <= MAX_UNITS
    && t.units.every((u: any) => !!u && typeof u.unit === 'string' && u.unit.length > 0 && u.unit.length <= 60
      && count(u.attempts) && u.attempts >= 1 && count(u.correct) && u.correct <= u.attempts));
}

/** Rows for the same component added together, largest first, capped at what the backend accepts. */
export function mergeEvidence(rows: readonly ComponentEvidence[]): ComponentEvidence[] {
  const by = new Map<string, ComponentEvidence>();
  for (const r of rows) {
    const key = `${r.kind}\n${r.id}`, at = by.get(key);
    if (at) { at.attempts += r.attempts; at.correct += r.correct; } else by.set(key, { ...r });
  }
  return Array.from(by.values()).sort((a, b) => b.attempts - a.attempts).slice(0, MAX_EVIDENCE);
}
