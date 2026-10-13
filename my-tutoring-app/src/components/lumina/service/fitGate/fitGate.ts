import 'server-only';

/**
 * Fit gate — every generated activity is checked against the objective it was
 * generated for, at the one place all visual generation passes through
 * (generateComponentContent). New primitives are covered from their first run.
 *
 * Two checks, two owners:
 *   1. Code: the primitive's content oracle (answer key, numeric scope, leaks),
 *      when one exists. Free and exact.
 *   2. Jev: does doing this activity mean doing the objective, are its numbers
 *      inside the range the objective names, can a learner of this grade do it.
 *      The judgment no per-primitive code can make. Input is the compact
 *      learner view (activityView), a few hundred tokens.
 * Code decides: a failing activity is generated once more with the reasons;
 * the better of the two ships, stamped with its verdict so the caller can
 * substitute (Pulse falls back to a problem built from the subskill). Every
 * verdict is appended to the fit ledger, which is where outliers are found.
 *
 * Never blocks: with Jev unconfigured or failing, the oracle verdict stands
 * alone, and the activity ships as generated.
 */

import { systemOne, typesafeConfigured, type Question } from '../manifest/typesafe/typesafeClient';
import { CONTENT_ORACLES } from '../qa/oracles';
import type { OracleViolation } from '../qa/oracles';
import { activityView, type ActivityView } from './activityView';
import { appendFitLedger } from './fitLedger';

export interface FitTarget {
  componentId: string;
  evalMode?: string;
  /** The objective / subskill text the activity must teach. */
  objective: string;
  /** "Kindergarten", "Grade 1", or a band name when no curriculum grade is known. */
  grade: string;
  /** Canonical 'K' | '1'..'12' for the oracle. */
  canonicalGrade?: string;
  gradeLevel: string;
  /** Where the request came from, for the ledger: 'pulse' | 'lesson' | ... */
  source?: string;
  subskillId?: string;
}

export interface FitVerdict {
  pass: boolean;
  /** Plain sentences: why it failed, phrased as what to change. */
  notes: string[];
  teaches: number | null;
  numbers: { choice: string; p: number } | null;
  gradeFit: number | null;
  oracle: { checked: boolean; failing: string[] };
  /** 1 when this is the redrawn attempt. */
  attempt: number;
  ms: number;
}

/** Cut points from 26 hand-labelled 1004 replay items (qa/fit-gate/calibration-2026-10-12.md):
 *  misses scored teaches 0.02-0.15, fits 0.28+. Re-fit from the ledger as labels accumulate. */
export const FIT_THRESHOLDS = {
  teaches: 0.2,
  numbersOutside: 0.6,
  gradeFit: 0.25,
};

/** Oracle checks that mean the child gets wrong content, not only weaker content. */
const BLOCKING_ORACLE_CHECKS = new Set(['answer-key-desync', 'scope', 'answer-leak']);

export function fitQuestions(): Record<string, Question> {
  return {
    teaches: { type: 'noul', instructions:
      'A learner completes every task in `activity`. Have they practised exactly what `lesson.objective` asks for: the '
      + 'same skill, not a neighbouring skill, a prerequisite, or one small part of it? Building or counting a number does '
      + 'not practise adding; counting on does not practise finding a group of ten. Judge the tasks and answers, not the title.',
      criteria: { true: 'Doing the tasks is doing the objective.', false: 'The tasks practise something else.' } },
    numbers: { type: 'choice', instructions:
      'Does `lesson.objective` name or clearly imply a range of numbers or a constraint on them ("11-20", "within 5", '
      + '"two-digit plus one-digit", "without regrouping")? If so, compare every number in the tasks and answers of `activity` with it.',
      criteria: {
        none_named: 'The objective names no number range or numeric constraint, or the activity uses no numbers.',
        all_inside: 'Every number in the tasks and answers fits what the objective names.',
        some_outside: 'Some numbers fall outside the named range or break the named constraint.',
      } },
    grade_fit: { type: 'noul', instructions:
      'Instructions are read aloud to the learner, so ignore reading difficulty. Could a typical `lesson.grade` learner do '
      + 'these tasks with what they are expected to know: no symbols, tools or ideas from a later grade (reading clock times, '
      + 'decimals, place-value names like tenths), and nothing a learner of that grade could not manage?',
      criteria: { true: 'Suitable for the grade.', false: 'Needs knowledge or symbols the grade does not have.' } },
  };
}

export function decideFit(
  answers: Record<string, any> | null,
  oracleFailing: OracleViolation[],
  t = FIT_THRESHOLDS,
): Pick<FitVerdict, 'pass' | 'notes' | 'teaches' | 'numbers' | 'gradeFit'> {
  const notes: string[] = [];
  const teaches = answers?.teaches?.noul ?? null;
  if (teaches !== null && teaches < t.teaches) {
    notes.push('The tasks practise a different skill from the objective. Every task must make the learner do exactly what the objective says.');
  }
  const n = answers?.numbers;
  const numbers = n ? { choice: n.choice as string, p: (n.probabilities?.[n.choice] ?? 0) as number } : null;
  if (numbers?.choice === 'some_outside' && numbers.p >= t.numbersOutside) {
    notes.push('Some numbers are outside the range or constraint the objective names. Use only numbers the objective allows.');
  }
  const gradeFit = answers?.grade_fit?.noul ?? null;
  if (gradeFit !== null && gradeFit < t.gradeFit) {
    notes.push('The tasks need symbols or ideas beyond the learner\'s grade. Present them the way a learner of this grade can work with.');
  }
  for (const v of oracleFailing.slice(0, 3)) notes.push(`Content check "${v.check}" failed at ${v.where}: ${v.detail}`);
  return { pass: notes.length === 0, notes, teaches, numbers, gradeFit };
}

function runOracle(payload: unknown, target: FitTarget): { checked: boolean; failing: OracleViolation[] } {
  const oracle = CONTENT_ORACLES.find((o) => o.componentId === target.componentId);
  const root = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  const data = (root.data && typeof root.data === 'object' ? root.data : root) as Record<string, unknown>;
  const evalMode = target.evalMode ?? (typeof data.evalMode === 'string' ? data.evalMode : '');
  if (!oracle || (oracle.modes && evalMode && !oracle.modes.includes(evalMode))) return { checked: false, failing: [] };
  try {
    const result = oracle.verify(data, {
      componentId: target.componentId, evalMode, topic: target.objective, gradeLevel: target.gradeLevel,
      intent: target.objective, grade: target.canonicalGrade,
    });
    return { checked: true, failing: result.violations.filter((v) => BLOCKING_ORACLE_CHECKS.has(v.check)) };
  } catch (err) {
    console.warn(`[FitGate] oracle ${target.componentId} threw:`, err instanceof Error ? err.message : err);
    return { checked: false, failing: [] };
  }
}

async function askJev(view: ActivityView, target: FitTarget): Promise<Record<string, any> | null> {
  if (!typesafeConfigured()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await systemOne({ lesson: { objective: target.objective, grade: target.grade }, activity: view },
      fitQuestions(), { signal: controller.signal });
    return res.answers as Record<string, any>;
  } catch (err) {
    console.warn('[FitGate] Jev unavailable; oracle verdict only:', err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function judgeFit(payload: unknown, target: FitTarget, attempt = 0): Promise<FitVerdict> {
  const t0 = Date.now();
  const view = activityView(payload);
  const [oracle, answers] = await Promise.all([Promise.resolve(runOracle(payload, target)), askJev(view, target)]);
  const decided = decideFit(answers, oracle.failing);
  const verdict: FitVerdict = { ...decided, oracle: { checked: oracle.checked, failing: oracle.failing.map((v) => v.check) },
    attempt, ms: Date.now() - t0 };
  appendFitLedger({ at: new Date().toISOString(), ...target, verdict, view });
  return verdict;
}

const failures = (v: FitVerdict) => v.notes.length;

/**
 * Generate, judge, and redraw once on failure. `generate(notes)` receives the
 * previous attempt's notes (empty on the first call). Returns the better
 * attempt with its verdict.
 */
export async function generateWithFitGate<T>(
  target: FitTarget,
  generate: (notes: string[]) => Promise<T>,
): Promise<{ result: T; verdict: FitVerdict | null }> {
  const first = await generate([]);
  if (!first) return { result: first, verdict: null };
  const v1 = await judgeFit(first, target, 0);
  const tag = `${target.componentId}${target.evalMode ? `/${target.evalMode}` : ''}`;
  if (v1.pass) {
    console.log(`[FitGate] ${tag} pass (teaches ${v1.teaches?.toFixed(2) ?? '-'}, ${v1.ms}ms)`);
    return { result: first, verdict: v1 };
  }
  console.warn(`[FitGate] ${tag} FAIL for "${target.objective.slice(0, 60)}": ${v1.notes.map((n) => n.split('.')[0]).join('; ')} — redrawing`);
  let second: T | null = null;
  try { second = await generate(v1.notes); } catch (err) {
    console.warn(`[FitGate] ${tag} redraw threw:`, err instanceof Error ? err.message : err);
  }
  if (!second) return { result: first, verdict: v1 };
  const v2 = await judgeFit(second, target, 1);
  const keepSecond = failures(v2) <= failures(v1);
  console.log(`[FitGate] ${tag} redraw ${v2.pass ? 'pass' : 'still failing'}; shipping attempt ${keepSecond ? 2 : 1}`);
  return keepSecond ? { result: second, verdict: v2 } : { result: first, verdict: v1 };
}
