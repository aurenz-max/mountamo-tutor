import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, parseScopeCeiling } from './helpers';

/**
 * Double-number-line oracle — a CALCULATION oracle for the proportional-reasoning
 * family (equivalent_ratios, find_missing, unit_rate). A whole session shares ONE
 * ratio relationship (topLabel : bottomLabel, captured by `unitRate` and the
 * givenPoints), and each challenge asks the student to place the BOTTOM value for
 * one or more given top values. Its flagship guarantee is answer-key-desync: the
 * bottom value the student is graded against must actually equal topValue × the
 * ratio the given points establish — a stored answer that breaks the proportion is
 * a correct placement marked wrong (the vocabulary-explorer class), and one that
 * lands off the rendered bottom scale is an unreachable correct state (the
 * array-grid class).
 *
 * The component (DoubleNumberLine.tsx) judges correctness in handleCheckAnswers
 * (:434-453): for each targetPoint i, the student's entered bottom value must be
 * within TOLERANCE (0.1 absolute, isWithinTolerance :431) of
 * `targetPoints[i].bottomValue`. So the stored `bottomValue` of each target IS the
 * answer key — nothing else is graded — and the top value is the given stimulus.
 *
 * THE INDEPENDENCE RULE: the oracle never trusts a target's stored bottomValue as
 * its own proof. It re-derives the session ratio r = bottomValue / topValue from a
 * non-origin GIVEN point (the anchor the student reads off the line), cross-checks
 * that every given point and the declared `unitRate` agree with r, then requires
 * every target's bottomValue to equal topValue × r within the component's tolerance.
 * A generator that stored a target off the proportion, or a unitRate inconsistent
 * with its own given anchor, can no longer false-pass. (r is derived from the
 * givens, never from the targets it is used to check.)
 *
 * Checks:
 *  - answer-key-desync : (a) the given points are internally proportional (all
 *    non-origin givens share one ratio r) and unitRate === r; (b) every target's
 *    bottomValue === topValue × r within tolerance; (c) every target's bottomValue
 *    sits on the rendered bottomScale [min,max] and its topValue on topScale
 *    [min,max] — a value off its scale can never be read or placed.
 *  - scope             : the largest quantity a student reads OR produces (top &
 *    bottom of givens and targets) honors an EXPLICIT objective ceiling
 *    (ctx.scopeMax ?? a "to N" topic). Ratios carry no intrinsic magnitude ceiling,
 *    so absent an explicit one the scale's own bounds are the natural ceiling and
 *    only reachability bites (documented, not a silent skip).
 *  - clustering        : the produced bottom answers spread across the session (no
 *    "every answer is 8"), and no exact-duplicate card (same givens + same targets).
 *  - schema            : ≥3 challenges (mastery-over-demo); each challenge has a
 *    known type, ≥1 given point and ≥1 target point with numeric top/bottom values,
 *    and well-formed top/bottom scales (max > min).
 *
 * Deliberately NOT checked: answer-leak. Every prompt states the stimulus by
 * design — "Given 2 Bicycles = 4 Wheels, find Wheels when Bicycles = 3" NECESSARILY
 * names the anchor ratio and the top value, and the hint spells out the unit-rate
 * strategy at the easy/medium tiers on purpose. A leak test would fire on the
 * intended task, worse than an honest gap. Leak/pedagogy stays with /eval-test.
 */

const KNOWN_TYPES = new Set(['equivalent_ratios', 'find_missing', 'unit_rate']);
const TOLERANCE = 0.1; // component isWithinTolerance default (DoubleNumberLine.tsx:431)
const RATIO_EPS = 1e-6;

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

interface Point {
  topValue: number;
  bottomValue: number;
}

/** Read the {topValue, bottomValue} points, or null if malformed / empty. */
function readPoints(v: unknown): Point[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const pts: Point[] = [];
  for (const raw of v) {
    if (typeof raw !== 'object' || raw === null) return null;
    const r = raw as Record<string, unknown>;
    if (!isNum(r.topValue) || !isNum(r.bottomValue)) return null;
    pts.push({ topValue: r.topValue as number, bottomValue: r.bottomValue as number });
  }
  return pts;
}

function readScale(v: unknown): { min: number; max: number } | null {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as Record<string, unknown>;
  if (!isNum(r.min) || !isNum(r.max)) return null;
  return { min: r.min as number, max: r.max as number };
}

export const doubleNumberLineOracle: ContentOracle = {
  componentId: 'double-number-line',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    const declaredUnitRate = isNum(data.unitRate) ? (data.unitRate as number) : null;
    // Ratios carry no intrinsic ceiling — only an explicit harness/topic one bites.
    const ceiling = ctx.scopeMax ?? parseScopeCeiling(ctx.topic);

    if (challenges.length < 3) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3-6+`,
      });
    }

    const answers: number[] = [];
    const cardSeen = new Map<string, number>();
    let checked = 0;

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const id = String(c.id ?? `#${i + 1}`);
      const type = String(c.challengeType ?? '');
      if (!KNOWN_TYPES.has(type)) {
        uncheckedTypes.add(type || '(missing challengeType)');
        continue;
      }

      const given = readPoints(c.givenPoints);
      const targets = readPoints(c.targetPoints);
      if (!given) {
        violations.push({ check: 'schema', where: id, detail: `givenPoints must be a non-empty array of {topValue, bottomValue}; got ${JSON.stringify(c.givenPoints)}` });
        continue;
      }
      if (!targets) {
        violations.push({ check: 'schema', where: id, detail: `targetPoints must be a non-empty array of {topValue, bottomValue}; got ${JSON.stringify(c.targetPoints)}` });
        continue;
      }
      const topScale = readScale(c.topScale);
      const bottomScale = readScale(c.bottomScale);
      if (!topScale || topScale.max <= topScale.min || !bottomScale || bottomScale.max <= bottomScale.min) {
        violations.push({ check: 'schema', where: id, detail: `top/bottom scales must be well-formed {min<max}; got top ${JSON.stringify(c.topScale)} bottom ${JSON.stringify(c.bottomScale)}` });
        continue;
      }

      // ── Independence: derive the session ratio r from a non-origin given anchor. ──
      const anchor = given.find((p) => Math.abs(p.topValue) > RATIO_EPS);
      if (!anchor) {
        violations.push({ check: 'answer-key-desync', where: id, detail: `no non-origin given point — the ratio cannot be read off the line (all givens have topValue 0)` });
        continue;
      }
      const r = anchor.bottomValue / anchor.topValue;

      // (a) every given point agrees with r, and unitRate === r.
      for (const g of given) {
        const expectedBottom = g.topValue * r;
        if (Math.abs(g.bottomValue - expectedBottom) > TOLERANCE) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `given point (${g.topValue}, ${g.bottomValue}) breaks the session ratio ${r} (expected bottom ${expectedBottom}) — the anchor points disagree with each other`,
          });
        }
      }
      if (declaredUnitRate !== null && Math.abs(declaredUnitRate - r) > TOLERANCE) {
        violations.push({
          check: 'answer-key-desync',
          where: id,
          detail: `declared unitRate ${declaredUnitRate} disagrees with the given anchor ratio ${r} (${anchor.topValue}→${anchor.bottomValue})`,
        });
      }

      checked++;
      // (b) + (c): every target follows the ratio AND lands on both rendered scales.
      for (const t of targets) {
        const expectedBottom = t.topValue * r;
        if (Math.abs(t.bottomValue - expectedBottom) > TOLERANCE) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `target (top ${t.topValue}) has stored bottomValue ${t.bottomValue}, but the session ratio ${r} gives ${expectedBottom} — a correct placement would be marked wrong`,
          });
        }
        if (t.topValue < topScale.min - RATIO_EPS || t.topValue > topScale.max + RATIO_EPS) {
          violations.push({ check: 'answer-key-desync', where: id, detail: `target topValue ${t.topValue} is off the top scale [${topScale.min},${topScale.max}] — the stimulus is not on the rendered line` });
        }
        if (t.bottomValue < bottomScale.min - RATIO_EPS || t.bottomValue > bottomScale.max + RATIO_EPS) {
          violations.push({ check: 'answer-key-desync', where: id, detail: `target bottomValue ${t.bottomValue} is off the bottom scale [${bottomScale.min},${bottomScale.max}] — the correct answer can never be placed` });
        }
        answers.push(t.bottomValue);
      }

      // ── scope: only bites with an explicit ceiling on any read/produced quantity. ──
      if (ceiling !== undefined) {
        const quantities = [...given, ...targets].flatMap((p) => [p.topValue, p.bottomValue]);
        const over = quantities.find((q) => q > ceiling);
        if (over !== undefined) {
          violations.push({ check: 'scope', where: id, detail: `quantity ${over} exceeds objective ceiling ${ceiling} (topic "${ctx.topic}")` });
        }
      }

      const sig = `${given.map((p) => `${p.topValue}:${p.bottomValue}`).join(',')}|${targets.map((p) => `${p.topValue}:${p.bottomValue}`).join(',')}`;
      bump(cardSeen, sig);
    }

    // ── clustering: bottom answers spread ──
    const variety = checkAnswerVariety(answers, 'targetPoints[].bottomValue');
    if (variety) violations.push(variety);
    // ── clustering: no exact-duplicate card ──
    cardSeen.forEach((count, sig) => {
      if (count > 1) {
        violations.push({ check: 'clustering', where: 'challenges[]', detail: `identical card "${sig}" appears ${count}× — a duplicated challenge` });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}
