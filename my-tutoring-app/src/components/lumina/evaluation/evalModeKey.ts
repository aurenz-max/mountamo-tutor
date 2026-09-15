/**
 * evalModeKey — the eval mode a submission carries is a CATALOG key.
 *
 * `metrics.evalMode` is a string each of 58+ components writes, and two of
 * them sent a challenge TYPE where the catalog and the backend IRT registry
 * key the MODE (counting-board `count_all` for `count`, CNB-3; ten-frame
 * `add` for `operate`, TF-6). Capture labels the evidence with it and
 * `submission_service.py` routes difficulty by it, so a type name splits a
 * skill's attempts across two keys. Normalising once at the evaluation
 * boundary (`usePrimitiveEvaluation.submitResult`) closes the class.
 *
 * Handoff: qa/HANDOFF-judged-evidence-and-adaptation-wiring-2026-09-14.md, slice 3.
 */

import { getComponentById } from '../service/manifest/catalog';

export type EvalModeRule = 'manifest' | 'catalog' | 'challenge-type' | 'kept' | 'none';

export interface ResolvedEvalMode {
  /** The key to submit, or undefined when nothing was reported and nothing was pinned. */
  evalMode?: string;
  rule: EvalModeRule;
  /** Rule 4 only: the modes a challenge type is listed under, when more than one. */
  ambiguous?: string[];
}

interface CatalogMode { evalMode: string; challengeTypes?: readonly string[] }

function catalogModes(primitiveType: string): CatalogMode[] {
  return (getComponentById(primitiveType)?.evalModes ?? []) as CatalogMode[];
}

/** A manifest pin names one skill only when it is one key: `a|b` blends and `mixed` do not. */
export function singleManifestMode(targetEvalMode: unknown): string | undefined {
  if (typeof targetEvalMode !== 'string') return undefined;
  const key = targetEvalMode.trim();
  return key && key !== 'mixed' && !key.includes('|') ? key : undefined;
}

/**
 * 1. A single-key manifest pin for this instance that is a catalog mode wins.
 * 2. Else a reported value that is a catalog mode is kept.
 * 3. Else a reported value listed as a challenge type under exactly one mode
 *    becomes that mode.
 * 4. Else the reported value is kept as is (ambiguous types are reported).
 */
export function resolveSubmittedEvalMode(
  primitiveType: string,
  reported: string | undefined,
  targetEvalMode?: unknown,
): ResolvedEvalMode {
  const modes = catalogModes(primitiveType);
  const isMode = (key: string) => modes.some((m) => m.evalMode === key);
  const pinned = singleManifestMode(targetEvalMode);
  if (pinned && isMode(pinned)) return { evalMode: pinned, rule: 'manifest' };
  if (!reported) return { evalMode: undefined, rule: 'none' };
  if (isMode(reported)) return { evalMode: reported, rule: 'catalog' };
  const listedUnder = modes.filter((m) => (m.challengeTypes ?? []).includes(reported)).map((m) => m.evalMode);
  if (listedUnder.length === 1) return { evalMode: listedUnder[0], rule: 'challenge-type' };
  return { evalMode: reported, rule: 'kept', ...(listedUnder.length > 1 ? { ambiguous: listedUnder } : {}) };
}

const warned = new Set<string>();

/** Rule 4 in development: say once per (primitive, value) that a submission carries a non-catalog key. */
export function warnUnresolvedEvalMode(primitiveType: string, resolved: ResolvedEvalMode): void {
  if (resolved.rule !== 'kept' || process.env.NODE_ENV === 'production') return;
  const key = `${primitiveType}:${resolved.evalMode}`;
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[evalMode] ${primitiveType} submitted "${resolved.evalMode}", which is not a catalog eval mode`
    + (resolved.ambiguous ? ` and is a challenge type under ${resolved.ambiguous.length} modes (${resolved.ambiguous.join(', ')})` : '')
    + '; IRT and capture will key on it as is.');
}

/** Test seam. */
export function resetEvalModeWarnings(): void { warned.clear(); }
