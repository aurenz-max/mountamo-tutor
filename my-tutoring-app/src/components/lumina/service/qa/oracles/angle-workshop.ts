import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety } from './helpers';

/**
 * Angle-workshop oracle — verifies the pre-built angle challenge pool against
 * the component's own judging contract, across all five challenge types.
 *
 * The component (AngleWorkshop.tsx, handleCheck :835-916) picks its grading path
 * from answerKind:
 *   answerKind === 'relationship' → correct = selectedRelationship === expectedRelationship
 *   else (degrees / x_value)      → correct = |parseFloat(input) − expectedAnswer| ≤ tolerance
 * The figure the student reads is DRAWN from the geometry givens (angleMeasure,
 * knownAngle(s), a1/b1/a2/b2, givenAngle(s), the relationship/solveConfig/
 * transRelation/transversalShape), and the answer is what those givens imply.
 *
 * THE INDEPENDENCE RULE: the shipped keys are expectedAnswer / expectedRelationship,
 * pre-computed by the generator's own build functions. This oracle RE-DERIVES the
 * answer from the drawn givens using first-principles angle geometry — NOT the
 * generator's stored result:
 *   measure          → the answer IS the drawn angleMeasure (read off the protractor).
 *   classify_pairs   → the drawn `relationship` and the judged `expectedRelationship`
 *                      must be the SAME relationship (the figure is stroked from
 *                      `relationship`, but the click is graded against
 *                      `expectedRelationship`).
 *   solve_unknown    → complementary 90−k · supplementary 180−k · vertical k ·
 *                      around_point 360−k1−k2.
 *   solve_algebraic  → solve the equality for x: complementary (a1+a2)x = 90−b1−b2,
 *                      supplementary … = 180−…, vertical a1x+b1 = a2x+b2.
 *   transversal      → corresponding/alternate = given · co-interior 180−given ·
 *                      triangle_sum 180−g1−g2 · exterior_angle g1+g2.
 * A generator whose stored expectedAnswer and drawn givens drift (a supplementary
 * figure keyed 90−k, a triangle keyed to the wrong sum, an algebraic x off by a
 * sign, a figure that depicts `vertical` but is judged `adjacent`) is the
 * correct-work-marked-wrong class this oracle exists to catch.
 *
 * A second desync the oracle checks is the GRADING PATH: the component branches
 * on answerKind, so a numeric challenge mis-tagged 'relationship' is graded
 * against a (usually absent) expectedRelationship and can never be right, and a
 * classify challenge mis-tagged numeric grades against expectedAnswer=0.
 *
 * Checks:
 *  - answer-key-desync :
 *      (a) answerKind ≠ the type's grading path (measure/solve_unknown/transversal
 *          = 'degrees', solve_algebraic = 'x_value', classify_pairs = 'relationship').
 *      (b) measure: expectedAnswer ≠ the drawn angleMeasure.
 *      (c) classify: the drawn `relationship` ≠ the judged `expectedRelationship`.
 *      (d) solve_unknown / solve_algebraic / transversal: expectedAnswer ≠ the
 *          geometry re-derived from the givens (division-by-zero algebraic config
 *          — a1+a2 = 0 or a1 = a2 — has no unique x and is flagged).
 *      (e) tolerance ≤ 0 on a numeric mode — no answer is acceptable (students
 *          round a protractor read; the window must be positive).
 *  - scope             : when ctx.evalMode names one of the five types, every
 *      challenge's type must match it (task identity). No numeric magnitude
 *      ceiling — angles are bounded by geometry (0–360), not a topic scope.
 *  - answer-leak       : numeric modes — narration/instruction/hint must not
 *      state the answer VALUE (standalone number match). The formula/method text
 *      ("x = 180 − the two known angles") names the METHOD, never the value, by
 *      design, and the given angles are the task's givens. classify's relationship
 *      words are NOT value-matched (they legitimately appear in the option prompt).
 *  - clustering        : the answer (degrees / x / relationship) must spread
 *      (checkAnswerVariety); no byte-identical card (mirrors the generator's
 *      canonicalKey per type).
 *  - schema            : ≥3 challenges (mastery-over-demo); known type; non-empty
 *      narration/instruction; finite expectedAnswer + tolerance; per-type givens
 *      present (angleMeasure / relationship / knownAngle(s) / a1,b1,a2,b2 /
 *      givenAngle(s) with the right config enum).
 *
 * Deliberately NOT checked:
 *  - whether the CANVAS pixels depict exactly the stored angle (a rendering
 *    concern) — the oracle checks the numeric contract behind the drawing.
 *  - support-tier scaffold flags (showReadingCue / showPerceptionMarks):
 *    display-only; the checker never reads them.
 *  - classify relationship-word leak: relationship names appear in the option
 *    labels/prompt by design (naming the relationship IS the task) — /eval-test.
 */

const EPS = 0.01;

const KNOWN_TYPES = new Set(['measure', 'classify_pairs', 'solve_unknown', 'solve_algebraic', 'transversal']);
const RELATIONSHIPS = new Set(['complementary', 'supplementary', 'vertical', 'adjacent']);

/** answerKind the component's grading path requires per type. */
const ANSWER_KIND_BY_TYPE: Record<string, string> = {
  measure: 'degrees',
  classify_pairs: 'relationship',
  solve_unknown: 'degrees',
  solve_algebraic: 'x_value',
  transversal: 'degrees',
};

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
const near = (a: number, b: number): boolean => Math.abs(a - b) <= EPS;

/** Every standalone number appearing in free text. */
function numbersIn(text: string): number[] {
  return text
    .split(/[^0-9.]+/)
    .map((t) => parseFloat(t))
    .filter((n) => Number.isFinite(n));
}

export const angleWorkshopOracle: ContentOracle = {
  componentId: 'angle-workshop',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    if (challenges.length < 3) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3-6+`,
      });
    }

    const requestedMode = KNOWN_TYPES.has(ctx.evalMode) ? ctx.evalMode : null;
    const answerValues: string[] = [];
    const cardSeen = new Map<string, number>();
    let checked = 0;

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const id = String(c.id ?? `#${i + 1}`);
      const type = String(c.type ?? '');
      if (!KNOWN_TYPES.has(type)) {
        uncheckedTypes.add(type || '(missing type)');
        continue;
      }

      // ── scope: the session must deliver the requested eval mode ──
      if (requestedMode && type !== requestedMode) {
        violations.push({
          check: 'scope',
          where: id,
          detail: `challenge type "${type}" but the objective asked for eval mode "${requestedMode}" — a different task identity`,
        });
      }

      const narration = typeof c.narration === 'string' ? c.narration : '';
      const instruction = typeof c.instruction === 'string' ? c.instruction : '';
      const hint = typeof c.hint === 'string' ? c.hint : '';
      const answerKind = String(c.answerKind ?? '');
      const expectedAnswer = c.expectedAnswer;
      const tolerance = c.tolerance;

      if (narration.trim() === '' || instruction.trim() === '' || !isNum(expectedAnswer) || !isNum(tolerance)) {
        violations.push({
          check: 'schema',
          where: id,
          detail: `malformed challenge: narration=${JSON.stringify(c.narration)} instruction=${JSON.stringify(c.instruction)} expectedAnswer=${String(c.expectedAnswer)} tolerance=${String(c.tolerance)}`,
        });
        continue;
      }

      // ── (a) the answerKind must select the correct grading path ──
      const wantKind = ANSWER_KIND_BY_TYPE[type];
      if (answerKind !== wantKind) {
        violations.push({
          check: 'answer-key-desync',
          where: id,
          detail: `answerKind="${answerKind}" but a ${type} answer is graded as "${wantKind}" — the component grades the wrong path (the answer can never be marked correct)`,
        });
      }

      let derived: number | null = null;
      let cardKey = '';
      let leakCheck = false;
      // Labeled givens shown on the figure — when the answer coincides with a
      // given (vertical, corresponding), stating it is showing the given, not a leak.
      const givens: number[] = [];

      if (type === 'measure') {
        const angle = c.angleMeasure;
        if (!isNum(angle)) {
          violations.push({ check: 'schema', where: id, detail: `measure missing angleMeasure (got ${String(c.angleMeasure)})` });
          continue;
        }
        derived = angle;
        cardKey = `m|${angle}`;
        leakCheck = true;
        answerValues.push(`deg:${expectedAnswer}`);
      } else if (type === 'classify_pairs') {
        const relationship = String(c.relationship ?? '');
        const expectedRel = String(c.expectedRelationship ?? '');
        if (!RELATIONSHIPS.has(relationship) || !RELATIONSHIPS.has(expectedRel)) {
          violations.push({ check: 'schema', where: id, detail: `classify_pairs bad relationship enums: relationship="${relationship}" expectedRelationship="${expectedRel}"` });
          continue;
        }
        // ── (c) the drawn relationship must be the judged one ──
        if (relationship !== expectedRel) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `the figure is drawn as "${relationship}" but the key judges "${expectedRel}" — the student naming what they see is marked wrong`,
          });
        }
        cardKey = `c|${relationship}|${isNum(c.splitAngle) ? c.splitAngle : ''}|${isNum(c.crossAngle) ? c.crossAngle : ''}`;
        answerValues.push(`rel:${expectedRel}`);
        checked++;
      } else if (type === 'solve_unknown') {
        const cfg = String(c.solveConfig ?? '');
        const k = c.knownAngle;
        if (!isNum(k)) {
          violations.push({ check: 'schema', where: id, detail: `solve_unknown missing knownAngle (got ${String(c.knownAngle)})` });
          continue;
        }
        givens.push(k);
        if (cfg === 'complementary') derived = 90 - k;
        else if (cfg === 'supplementary') derived = 180 - k;
        else if (cfg === 'vertical') derived = k;
        else if (cfg === 'around_point') {
          const k2 = c.knownAngle2;
          if (!isNum(k2)) { violations.push({ check: 'schema', where: id, detail: `around_point missing knownAngle2` }); continue; }
          givens.push(k2);
          derived = 360 - k - k2;
          cardKey = `s|around_point|${k}|${k2}`;
        } else {
          violations.push({ check: 'schema', where: id, detail: `solve_unknown unknown solveConfig "${cfg}"` });
          continue;
        }
        if (!cardKey) cardKey = `s|${cfg}|${k}`;
        leakCheck = true;
        answerValues.push(`deg:${expectedAnswer}`);
      } else if (type === 'solve_algebraic') {
        const cfg = String(c.algConfig ?? '');
        const a1 = c.a1, b1 = c.b1, a2 = c.a2, b2 = c.b2;
        if (![a1, b1, a2, b2].every(isNum)) {
          violations.push({ check: 'schema', where: id, detail: `solve_algebraic missing coefficients: a1=${String(a1)} b1=${String(b1)} a2=${String(a2)} b2=${String(b2)}` });
          continue;
        }
        const A1 = a1 as number, B1 = b1 as number, A2 = a2 as number, B2 = b2 as number;
        if (cfg === 'complementary' || cfg === 'supplementary') {
          const total = cfg === 'complementary' ? 90 : 180;
          if (near(A1 + A2, 0)) {
            violations.push({ check: 'answer-key-desync', where: id, detail: `a1 + a2 = 0 — the ${cfg} equation has no unique x (unsolvable)` });
          } else derived = (total - B1 - B2) / (A1 + A2);
        } else if (cfg === 'vertical') {
          if (near(A1, A2)) {
            violations.push({ check: 'answer-key-desync', where: id, detail: `a1 = a2 = ${A1} — the vertical equality has no unique x (unsolvable)` });
          } else derived = (B2 - B1) / (A1 - A2);
        } else {
          violations.push({ check: 'schema', where: id, detail: `solve_algebraic unknown algConfig "${cfg}"` });
          continue;
        }
        cardKey = `a|${cfg}|${A1},${B1},${A2},${B2}`;
        // x_value: don't value-leak (x is small and collides with coefficients).
        answerValues.push(`x:${expectedAnswer}`);
      } else {
        // transversal
        const shape = String(c.transversalShape ?? '');
        const g1 = c.givenAngle;
        if (shape === 'parallel_transversal') {
          const rel = String(c.transRelation ?? '');
          if (!isNum(g1)) { violations.push({ check: 'schema', where: id, detail: `parallel_transversal missing givenAngle` }); continue; }
          givens.push(g1);
          if (rel === 'corresponding' || rel === 'alternate_interior' || rel === 'alternate_exterior') derived = g1;
          else if (rel === 'co_interior') derived = 180 - g1;
          else { violations.push({ check: 'schema', where: id, detail: `parallel_transversal unknown transRelation "${rel}"` }); continue; }
          cardKey = `t|par|${rel}|${g1}`;
        } else if (shape === 'triangle_sum' || shape === 'exterior_angle') {
          const g2 = c.givenAngle2;
          if (!isNum(g1) || !isNum(g2)) { violations.push({ check: 'schema', where: id, detail: `${shape} missing givenAngle/givenAngle2` }); continue; }
          givens.push(g1, g2);
          derived = shape === 'triangle_sum' ? 180 - g1 - g2 : g1 + g2;
          cardKey = `t|${shape}|${g1}|${g2}`;
        } else {
          violations.push({ check: 'schema', where: id, detail: `transversal unknown transversalShape "${shape}"` });
          continue;
        }
        leakCheck = true;
        answerValues.push(`deg:${expectedAnswer}`);
      }

      // ── (b)/(d) the key must equal the geometry re-derived from the givens ──
      if (derived !== null) {
        if (!near(derived, expectedAnswer)) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `expectedAnswer=${expectedAnswer} but the geometry gives ${derived} — the student computing from the figure is marked wrong`,
          });
        }
        checked++;
        // ── (e) a numeric window must be reachable ──
        if (tolerance <= 0) {
          violations.push({ check: 'answer-key-desync', where: id, detail: `tolerance=${tolerance} — no answer is acceptable (students round a read; the window must be positive)` });
        }
        // ── answer-leak: the numeric answer must not appear in the text, UNLESS
        //    it coincides with a labeled given (vertical/corresponding: the given IS the answer) ──
        if (leakCheck && !givens.some((g) => near(g, expectedAnswer))
            && numbersIn(`${narration} ${instruction} ${hint}`).some((n) => near(n, expectedAnswer))) {
          violations.push({ check: 'answer-leak', where: id, detail: `narration/instruction/hint states the answer value ${expectedAnswer}` });
        }
      }

      if (cardKey) cardSeen.set(cardKey, (cardSeen.get(cardKey) ?? 0) + 1);
    }

    // ── clustering: answers spread; no byte-identical card ──
    const variety = checkAnswerVariety(answerValues, 'challenges[].answer');
    if (variety) violations.push(variety);
    cardSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({
          check: 'clustering',
          where: 'challenges[]',
          detail: `identical figure "${key}" appears ${count}× — a duplicated card`,
        });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
