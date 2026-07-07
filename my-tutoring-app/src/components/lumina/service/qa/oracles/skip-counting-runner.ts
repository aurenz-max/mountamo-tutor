import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, parseScopeCeiling } from './helpers';

/**
 * Skip-counting-runner oracle — a CALCULATION oracle over an arithmetic
 * sequence (start, start±skip, start±2·skip, …). Where math-fact-fluency
 * re-derives a single fact, this one re-derives the whole SEQUENCE from the raw
 * skipValue / startFrom / endAt / direction and then checks that each
 * challenge's shipped key (startPosition, hiddenPositions, targetFact) lands on
 * the grid the sequence defines — it never trusts the generator's own
 * startPosition-as-answer or the product it wrote into targetFact.
 *
 * How the component (SkipCountingRunner.tsx) judges each type:
 *  - predict (checkPrediction): correct ⇔ answer === nextExpectedPosition,
 *    where nextExpectedPosition = currentPosition ± skipValue and
 *    currentPosition is seeded from challenge.startPosition. The number input
 *    only renders while nextExpectedPosition !== null, so a startPosition whose
 *    next step overshoots endAt is UNANSWERABLE (a dead challenge).
 *  - fill_missing (checkFillMissing): correct ⇔ hiddenPositions.includes(answer)
 *    && !landingSpots.includes(answer). landingSpots always starts with
 *    [startFrom], so a hidden position equal to startFrom can never be filled —
 *    unsolvable. Every hidden position must be a real sequence multiple.
 *  - find_skip_value (checkFindSkipValue): correct ⇔ answer === skipValue. The
 *    answer IS the skip value that defines the sequence, so there is nothing to
 *    re-derive independently — we validate structure/scope only (see below).
 *  - connect_multiplication (checkMultiplication): correct ⇔ enteredProduct ===
 *    jumpCount·skipValue + startFrom (=== startPosition), where jumpCount =
 *    (startPosition − startFrom)/skipValue. targetFact is display text the
 *    student reads, so its parsed product must equal that graded answer.
 *  - count_along: correct ⇔ the student walks the sequence to the end
 *    (nextExpectedPosition === null); no numeric key, structure/scope only.
 *
 * Checks:
 *  - answer-key-desync : each startPosition is a real multiple on the sequence
 *    grid; predict's next step is reachable (answerable); fill_missing gaps are
 *    valid sequence multiples ≠ startFrom; connect_multiplication targetFact is
 *    arithmetically true (a·b === c), its multiplier === skipValue, its
 *    multiplicand === the true jumpCount, and its product === the graded answer.
 *  - scope             : the number line stays within the objective ceiling
 *    (max reachable value ≤ ceiling, no negative positions); for Grades 1-2 the
 *    skip value stays in {2,5,10} (a code-enforced grade clamp — a regression
 *    guard here).
 *  - clustering        : the varying answers spread (predict next-landings,
 *    connect products, fill gap-sets) and no exact-duplicate card (same type +
 *    startPosition + hidden set + targetFact). find_skip_value and count_along
 *    are deliberately EXCLUDED from BOTH the variety pool and duplicate
 *    detection: one activity has one skip value and one labeled number line, so
 *    every instance is identical BY DESIGN (mastery practice), and keying them
 *    would false-positive on every single-mode session.
 *
 * Deliberately NOT checked: answer-leak. By design the rhythmic narration counts
 * the sequence out loud ("2… 4… 6…"), predict's hiddenPositions array literally
 * holds the next landing (the answer), and hints spell out the step ("The last
 * jump takes us to 20!"). The sequence values are the teaching surface, so a
 * whole-number leak test would fire on nearly every generation and route phantom
 * bugs to /eval-fix — worse than an honest gap. Leak/instruction quality stays
 * with /eval-test.
 */

type Direction = 'forward' | 'backward';

/** Rebuild the sequence grid ourselves from the raw operands — the independence
 *  anchor. Never uses any per-challenge startPosition/targetFact. */
function buildPositions(startFrom: number, endAt: number, skipValue: number, direction: Direction): number[] {
  const positions: number[] = [];
  if (!Number.isFinite(skipValue) || skipValue <= 0) return positions;
  if (direction === 'backward') {
    for (let p = startFrom; p >= endAt; p -= skipValue) positions.push(p);
  } else {
    for (let p = startFrom; p <= endAt; p += skipValue) positions.push(p);
  }
  return positions;
}

/** Parse "a × b = c" (accepts ×, x, or *). Returns null when it is not a clean
 *  single-product equation string. */
function parseTargetFact(tf: string): { a: number; b: number; c: number } | null {
  const m = tf.replace(/\s+/g, '').match(/^(\d+)[x×*](\d+)=(\d+)$/i);
  if (!m) return null;
  return { a: parseInt(m[1], 10), b: parseInt(m[2], 10), c: parseInt(m[3], 10) };
}

const GRADE_1_2_LEGAL_SKIPS = new Set([2, 5, 10]);

export const skipCountingRunnerOracle: ContentOracle = {
  componentId: 'skip-counting-runner',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    const skipValue = data.skipValue;
    const startFrom = Number.isFinite(data.startFrom as number) ? (data.startFrom as number) : 0;
    const endAt = data.endAt;
    const direction: Direction = data.direction === 'backward' ? 'backward' : 'forward';
    const gradeBand = data.gradeBand === '2-3' ? '2-3' : '1-2';

    // ── Activity-level schema/scope of the sequence frame ──
    const skipOk = Number.isInteger(skipValue) && (skipValue as number) > 0;
    if (!skipOk) {
      violations.push({ check: 'schema', where: 'skipValue', detail: `skipValue must be a positive integer, got ${JSON.stringify(skipValue)}` });
    }
    if (!Number.isInteger(endAt)) {
      violations.push({ check: 'schema', where: 'endAt', detail: `endAt must be an integer, got ${JSON.stringify(endAt)}` });
    } else if (direction === 'forward' && (endAt as number) <= startFrom) {
      violations.push({ check: 'schema', where: 'endAt', detail: `forward run unreachable: endAt ${endAt} ≤ startFrom ${startFrom}` });
    } else if (direction === 'backward' && (endAt as number) >= startFrom) {
      violations.push({ check: 'schema', where: 'endAt', detail: `backward run unreachable: endAt ${endAt} ≥ startFrom ${startFrom}` });
    }

    if (challenges.length < 3) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3-6+`,
      });
    }

    // Objective ceiling wins when the topic/harness carries one; else the
    // primitive's intrinsic grade-band ceiling (never a guessed one).
    const intrinsicCeiling = gradeBand === '1-2' ? 50 : 100;
    const ceiling = ctx.scopeMax ?? parseScopeCeiling(ctx.topic) ?? intrinsicCeiling;

    // Grades 1-2 skip value is code-clamped to {2,5,10} — a regression guard.
    if (gradeBand === '1-2' && skipOk && !GRADE_1_2_LEGAL_SKIPS.has(skipValue as number)) {
      violations.push({
        check: 'scope',
        where: 'skipValue',
        detail: `skipValue ${skipValue} is outside the Grades 1-2 set {2,5,10} (topic "${ctx.topic}")`,
      });
    }

    // The whole number line must sit within the objective ceiling.
    if (Number.isInteger(endAt)) {
      const nlMax = Math.max(startFrom, endAt as number);
      const nlMin = Math.min(startFrom, endAt as number);
      if (nlMax > ceiling) {
        violations.push({
          check: 'scope',
          where: 'range',
          detail: `number line reaches ${nlMax}, above the objective ceiling ${ceiling} (topic "${ctx.topic}")`,
        });
      }
      if (nlMin < 0) {
        violations.push({ check: 'scope', where: 'range', detail: `number line goes negative (${nlMin})` });
      }
    }

    const positions = skipOk && Number.isInteger(endAt)
      ? buildPositions(startFrom, endAt as number, skipValue as number, direction)
      : [];
    const positionSet = new Set(positions);

    // Per-challenge answer-key derivation. Independence: the answer is derived
    // from OUR rebuilt sequence grid, never from the shipped startPosition value.
    const varietyAnswers: Array<string | number> = [];
    const taskSeen = new Map<string, number>();
    let checked = 0;

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const type = String(c.type ?? '');
      const id = String(c.id ?? `#${i + 1}`);
      const where = `${id}(${type})`;

      const KNOWN = new Set(['count_along', 'predict', 'fill_missing', 'find_skip_value', 'connect_multiplication']);
      if (!KNOWN.has(type)) {
        uncheckedTypes.add(type);
        continue;
      }
      if (positions.length === 0) {
        // Can't validate positions without a valid grid; the frame-level schema
        // violation above already reported the root cause.
        continue;
      }
      checked++;

      // startPosition mirrors the component's seeding: absent → startFrom.
      const startPosition = Number.isInteger(c.startPosition) ? (c.startPosition as number) : startFrom;
      if (!positionSet.has(startPosition)) {
        violations.push({
          check: 'answer-key-desync',
          where,
          detail: `startPosition ${startPosition} is not on the ${skipValue}-step grid from ${startFrom} to ${endAt} [${positions.slice(0, 6).join(', ')}${positions.length > 6 ? ', …' : ''}]`,
        });
      }

      // Task-identity key for exact-duplicate detection (full identity, not the
      // fact alone: a different startPosition or gap set is legitimate practice).
      // Only the types whose task identity meaningfully varies per instance are
      // keyed. count_along and find_skip_value are INHERENTLY identical within one
      // activity (same labeled number line, startPosition === startFrom, no gap or
      // fact), so repeated instances are mastery practice, not duplicated cards —
      // keying them would false-positive on every single-mode session.
      if (type === 'predict' || type === 'fill_missing' || type === 'connect_multiplication') {
        const hiddenKey = Array.isArray(c.hiddenPositions)
          ? [...(c.hiddenPositions as unknown[])].map((h) => String(h)).sort().join(',')
          : '';
        const taskKey = `${type}|sp=${startPosition}|hp=[${hiddenKey}]|tf=${String(c.targetFact ?? '')}`;
        taskSeen.set(taskKey, (taskSeen.get(taskKey) ?? 0) + 1);
      }

      switch (type) {
        case 'predict': {
          // Answer = next step; the component only lets the student answer while
          // that next step exists on the line.
          const next = direction === 'backward' ? startPosition - (skipValue as number) : startPosition + (skipValue as number);
          const reachable = direction === 'backward' ? next >= (endAt as number) : next <= (endAt as number);
          if (!reachable) {
            violations.push({
              check: 'answer-key-desync',
              where,
              detail: `predict is unanswerable: from ${startPosition} the next landing ${next} overshoots endAt ${endAt} (input never renders)`,
            });
          } else {
            varietyAnswers.push(next);
          }
          break;
        }
        case 'fill_missing': {
          const hidden = Array.isArray(c.hiddenPositions) ? (c.hiddenPositions as unknown[]) : [];
          if (hidden.length === 0) {
            violations.push({ check: 'schema', where, detail: `fill_missing has no hiddenPositions to solve` });
            break;
          }
          const seen = new Set<number>();
          for (const raw of hidden) {
            const p = Number(raw);
            if (!positionSet.has(p)) {
              violations.push({
                check: 'answer-key-desync',
                where,
                detail: `hidden position ${JSON.stringify(raw)} is not a ${skipValue}-step multiple in [${positions.join(', ')}]`,
              });
            } else if (p === startFrom) {
              violations.push({
                check: 'answer-key-desync',
                where,
                detail: `hidden position ${p} equals startFrom — unsolvable (it is always already a landing spot)`,
              });
            }
            if (seen.has(p)) {
              violations.push({ check: 'schema', where, detail: `duplicate hidden position ${p}` });
            }
            seen.add(p);
          }
          varietyAnswers.push(`fm:${Array.from(seen).sort((a, b) => a - b).join('-')}`);
          break;
        }
        case 'connect_multiplication': {
          const dist = Math.abs(startPosition - startFrom);
          const jumpCount = dist / (skipValue as number);
          if (!Number.isInteger(jumpCount) || jumpCount < 1) {
            violations.push({
              check: 'answer-key-desync',
              where,
              detail: `startPosition ${startPosition} yields a non-integer jump count (${jumpCount}) from ${startFrom} by ${skipValue}s`,
            });
            break;
          }
          // Graded answer the student must enter (mirrors expectedProduct).
          const gradedAnswer = jumpCount * (skipValue as number) + startFrom;
          varietyAnswers.push(gradedAnswer);
          const tf = c.targetFact;
          if (typeof tf === 'string' && tf.trim() !== '') {
            const parsed = parseTargetFact(tf);
            if (!parsed) {
              violations.push({ check: 'schema', where, detail: `targetFact "${tf}" is not a clean "a × b = c" string` });
            } else {
              if (parsed.a * parsed.b !== parsed.c) {
                violations.push({ check: 'answer-key-desync', where, detail: `targetFact "${tf}" is arithmetically false: ${parsed.a} × ${parsed.b} = ${parsed.a * parsed.b}, not ${parsed.c}` });
              }
              if (parsed.b !== (skipValue as number)) {
                violations.push({ check: 'answer-key-desync', where, detail: `targetFact multiplier ${parsed.b} ≠ skipValue ${skipValue}` });
              }
              if (parsed.a !== jumpCount) {
                violations.push({ check: 'answer-key-desync', where, detail: `targetFact multiplicand ${parsed.a} ≠ true jump count ${jumpCount} (from ${startFrom} to ${startPosition} by ${skipValue}s)` });
              }
              if (parsed.c !== gradedAnswer) {
                violations.push({ check: 'answer-key-desync', where, detail: `targetFact product ${parsed.c} ≠ graded answer ${gradedAnswer} — the student is told to enter a value the component marks wrong` });
              }
            }
          }
          break;
        }
        case 'find_skip_value':
        case 'count_along':
          // Structure (startPosition) + scope validated above. The graded answer
          // (skip value reached / sequence completion) is tautological with the
          // sequence and has no independent re-derivation — documented in header.
          break;
      }
    }

    // ── clustering: varying answers must spread; no byte-identical card ──
    const variety = checkAnswerVariety(varietyAnswers, 'challenges[].answer');
    if (variety) violations.push(variety);
    taskSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({ check: 'clustering', where: 'challenges[]', detail: `identical challenge "${key}" appears ${count}× — a duplicated card` });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
