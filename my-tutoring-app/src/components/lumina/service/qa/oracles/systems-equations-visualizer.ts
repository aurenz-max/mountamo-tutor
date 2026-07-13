import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, parseScopeCeiling } from './helpers';

/**
 * Systems-equations-visualizer oracle — verifies the pre-built system pool
 * against the component's own judging contract.
 *
 * The component (SystemsEquationsVisualizer.tsx) judges EVERY mode with ONE
 * handler (handleCheck, :485-505): the student types x and y, and
 *   correct = |xVal − expectedX| < 0.01 && |yVal − expectedY| < 0.01.
 * The shipped key is the scalar pair (expectedX, expectedY). The three modes
 * differ only in WHICH surface the student reads to produce that pair:
 *  - graph        : both lines are drawn (from equation.slope / .yIntercept);
 *      the student reads the crossing point off the grid.
 *  - substitution : the two slope-intercept equations are shown as `display`
 *      strings; the GRAPH IS HIDDEN until correct — the display text is the
 *      ONLY truth the student solves against.
 *  - elimination  : two standard-form equations (a·x + b·y = c) shown as
 *      `display` strings; again the graph hides until correct.
 *
 * THE INDEPENDENCE RULE: the key is (expectedX, expectedY), pre-computed by the
 * generator's constructive builders. This oracle re-derives the solution TWO
 * different ways from what the student SEES, and never re-runs those builders:
 *  (1) GRAPH truth — intersect the two DRAWN lines: from slopeA/bA and
 *      slopeB/bB solve x* = (bB − bA)/(slopeA − slopeB), y* = slopeA·x* + bA.
 *      This is exactly what a graph-mode student reads off the grid.
 *  (2) ALGEBRA truth — PARSE each `display` string back to an equation and
 *      require the key to SATISFY it: slope-intercept ⇒ expectedY = m·expectedX
 *      + b; standard ⇒ a·expectedX + b·expectedY = c. This is the surface the
 *      substitution/elimination student actually solves (the graph is hidden),
 *      derived from the printed text, not from the slope/yIntercept the canvas
 *      draws. A generator whose display string and drawn line drift apart
 *      (e.g. "y = 2x + 3" printed over a line the key built from b = 5) is the
 *      correct-work-marked-wrong class this oracle exists to catch — one
 *      surface can pass while the other fails.
 * A shared internal check (standard form: slope = −a/b, yIntercept = c/b) ties
 * the two surfaces together so a drawn line that contradicts its own standard
 * equation is caught even when both individually "solve".
 *
 * Checks:
 *  - answer-key-desync :
 *      (a) parallel lines (slopeA === slopeB) — no unique crossing, the answer
 *          is unreachable on the graph.
 *      (b) the DRAWN lines cross at (x*, y*) ≠ (expectedX, expectedY).
 *      (c) standard form: (expectedX, expectedY) does not satisfy a·x + b·y = c
 *          for an equation — the elimination student solving the printed system
 *          lands off the key.
 *      (d) the PARSED `display` equation is not satisfied by the key — the
 *          substitution/elimination student reading the banner is marked wrong.
 *      (e) standard form: slope ≠ −a/b or yIntercept ≠ c/b — the drawn line and
 *          its own standard equation disagree (the graph reveal contradicts the
 *          equation the student solved).
 *      (f) graph mode: the intersection lies outside [xRange]×[yRange] — the
 *          crossing is off the plotted grid and cannot be read.
 *  - scope             : (1) when ctx.evalMode names one of the three methods,
 *      every challenge's type must match it (task identity — an elimination
 *      session full of graph reads teaches a different objective); (2) the
 *      solution magnitude |expectedX|/|expectedY| honors an explicit objective
 *      ceiling (ctx.scopeMax ?? topic "to N"). No intrinsic magnitude ceiling —
 *      systems topics rarely carry one, and the builders already clamp to ±4.
 *  - answer-leak       : the title / description / instruction must not print
 *      the solution as an "(x, y)" pair. Value-matched on the PAIR (both coords
 *      together) so a bare small integer can't false-match.
 *  - clustering        : the solution (x, y) must spread across the session
 *      (checkAnswerVariety); no byte-identical system card (same
 *      slopeA/bA/slopeB/bB/solution twice).
 *  - schema            : ≥3 challenges (mastery-over-demo); finite xRange/yRange
 *      with min < max; known type + systemForm; finite slope/yIntercept/
 *      expectedX/expectedY; non-empty display/instruction/hint; standard form
 *      ships finite a/b/c with b ≠ 0 (the line is drawn from slope = −a/b).
 *
 * Deliberately NOT checked:
 *  - The on-demand `hint` stating the answer. hintFor() literally prints the
 *    solution ("the answer is (2, 1)"); it is the mode's intended lowest-
 *    scaffold help, gated behind "Show hint" (the component labels it "carries
 *    the numbers", :785). Flagging it would fire on every legitimate
 *    generation (coordinate-graph equation-label precedent).
 *  - support-tier scaffold flags (showIntersectionRegion / showAxisLabels /
 *    showStepHint / stepHint): display-only, the checker never reads them, and
 *    the exact intersection point is withheld at every tier by design.
 *  - crossing-angle / fraction-depth / scale-count structural difficulty: the
 *    problem-SHAPE lever is /eval-test's call; the answer contract is identical
 *    across tiers.
 *  - integer-solution / lattice quality: the input accepts any real to 0.01, so
 *    a non-integer solution is still answerable — not an unreachable state.
 *  - title/description prose beyond the pair-leak (schema-constrained, the LLM
 *    only writes the wrapper) — /eval-test territory.
 */

/** The component's judging tolerance (handleCheck :504-505). */
const JUDGE_EPS = 0.01;
/** Float slack for exact-integer re-derivations. */
const FLOAT_EPS = 1e-6;

const KNOWN_TYPES = new Set(['graph', 'substitution', 'elimination']);
const SYSTEM_FORMS = new Set(['slope-intercept', 'standard']);

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Parse a slope-intercept `display` back to {slope, yIntercept}. Mirrors
 * formatSlopeIntercept: "y = x", "y = -x", "y = 2x", "y = 0.5x - 4",
 * "y = -1.5x + 3". Returns null when unparseable (skip, don't false-flag).
 */
export function parseSlopeInterceptDisplay(s: string): { slope: number; yIntercept: number } | null {
  const m = s.trim().match(/^y\s*=\s*(-?\d*\.?\d*)x(?:\s*([+-])\s*(\d+(?:\.\d+)?))?$/i);
  if (!m) return null;
  const rawSlope = m[1];
  const slope = rawSlope === '' || rawSlope === '+' ? 1 : rawSlope === '-' ? -1 : parseFloat(rawSlope);
  if (!Number.isFinite(slope)) return null;
  let yIntercept = 0;
  if (m[2] !== undefined) yIntercept = (m[2] === '-' ? -1 : 1) * parseFloat(m[3]);
  return { slope, yIntercept };
}

/**
 * Parse a standard-form `display` back to {a, b, c}. Mirrors formatStandard:
 * "2x + 3y = 6", "-x - 2y = 4", "x + y = 5". Returns null when unparseable.
 */
export function parseStandardDisplay(s: string): { a: number; b: number; c: number } | null {
  const m = s.trim().match(/^(-?\d*)x\s*([+-])\s*(\d*)y\s*=\s*(-?\d+(?:\.\d+)?)$/i);
  if (!m) return null;
  const a = m[1] === '' || m[1] === '+' ? 1 : m[1] === '-' ? -1 : parseInt(m[1], 10);
  const bAbs = m[3] === '' ? 1 : parseFloat(m[3]);
  const b = (m[2] === '-' ? -1 : 1) * bAbs;
  const c = parseFloat(m[4]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) return null;
  return { a, b, c };
}

/** Every "(a, b)" pair appearing in free text — the pair-form leak probe. */
function coordPairsIn(text: string): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  const re = /\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push({ x: parseFloat(m[1]), y: parseFloat(m[2]) });
  return out;
}

interface Eqn {
  slope: number;
  yIntercept: number;
  display: string;
  a?: number;
  b?: number;
  c?: number;
}

/** Narrow a raw equation record to the numeric fields the oracle re-derives from. */
function asEqn(v: unknown): Eqn | null {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as Record<string, unknown>;
  if (!isNum(r.slope) || !isNum(r.yIntercept)) return null;
  if (typeof r.display !== 'string' || r.display.trim() === '') return null;
  return {
    slope: r.slope,
    yIntercept: r.yIntercept,
    display: r.display,
    a: isNum(r.a) ? r.a : undefined,
    b: isNum(r.b) ? r.b : undefined,
    c: isNum(r.c) ? r.c : undefined,
  };
}

export const systemsEquationsVisualizerOracle: ContentOracle = {
  componentId: 'systems-equations-visualizer',
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

    // The canvas maps every screen position through xRange/yRange with no default.
    const xr = data.xRange;
    const yr = data.yRange;
    const validRange = (v: unknown): v is [number, number] =>
      Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]) && v[0] < v[1];
    let xRange: [number, number] = [-10, 10];
    let yRange: [number, number] = [-10, 10];
    if (!validRange(xr) || !validRange(yr)) {
      violations.push({
        check: 'schema',
        where: 'xRange/yRange',
        detail: `missing or malformed axis range: xRange=${JSON.stringify(xr)} yRange=${JSON.stringify(yr)}`,
      });
    } else {
      xRange = xr;
      yRange = yr;
    }

    const requestedMode = KNOWN_TYPES.has(ctx.evalMode) ? ctx.evalMode : null;
    const ceiling = ctx.scopeMax ?? parseScopeCeiling(ctx.topic);
    const leakText = `${String(data.title ?? '')} ${String(data.description ?? '')}`;

    const solutions: string[] = [];
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

      // ── scope (1): the session must deliver the requested eval mode ──
      if (requestedMode && type !== requestedMode) {
        violations.push({
          check: 'scope',
          where: id,
          detail: `challenge type "${type}" but the objective asked for eval mode "${requestedMode}" — a different task identity`,
        });
      }

      const systemForm = String(c.systemForm ?? '');
      const eqA = asEqn(c.equationA);
      const eqB = asEqn(c.equationB);
      const expectedX = c.expectedX;
      const expectedY = c.expectedY;
      const instruction = typeof c.instruction === 'string' ? c.instruction : '';
      const hint = typeof c.hint === 'string' ? c.hint : '';

      if (
        !SYSTEM_FORMS.has(systemForm) || !eqA || !eqB ||
        !isNum(expectedX) || !isNum(expectedY) ||
        instruction.trim() === '' || hint.trim() === ''
      ) {
        violations.push({
          check: 'schema',
          where: id,
          detail: `malformed challenge: systemForm=${JSON.stringify(c.systemForm)} equationA=${eqA ? 'ok' : 'bad'} equationB=${eqB ? 'ok' : 'bad'} expectedX=${String(c.expectedX)} expectedY=${String(c.expectedY)} instruction=${JSON.stringify(c.instruction)} hint=${JSON.stringify(c.hint)}`,
        });
        continue;
      }
      checked++;

      // ── answer-key-desync (a): parallel lines have no unique crossing ──
      if (Math.abs(eqA.slope - eqB.slope) < FLOAT_EPS) {
        violations.push({
          check: 'answer-key-desync',
          where: id,
          detail: `equationA and equationB share slope ${eqA.slope} — parallel lines have no single crossing, so no (x, y) answer exists`,
        });
      } else {
        // ── (b) GRAPH truth: intersect the two DRAWN lines ──
        const xStar = (eqB.yIntercept - eqA.yIntercept) / (eqA.slope - eqB.slope);
        const yStar = eqA.slope * xStar + eqA.yIntercept;
        if (Math.abs(xStar - expectedX) >= JUDGE_EPS || Math.abs(yStar - expectedY) >= JUDGE_EPS) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `the drawn lines "${eqA.display}" and "${eqB.display}" cross at (${xStar.toFixed(3)}, ${yStar.toFixed(3)}) but the key judges (${expectedX}, ${expectedY}) — a graph-mode student reading the crossing is marked wrong`,
          });
        }
        // ── (f) graph mode: the crossing must be on the plotted grid ──
        if (type === 'graph' && (xStar < xRange[0] || xStar > xRange[1] || yStar < yRange[0] || yStar > yRange[1])) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `the crossing (${xStar.toFixed(2)}, ${yStar.toFixed(2)}) is outside the plotted grid [${xRange.join(',')}]×[${yRange.join(',')}] — the intersection is off-canvas and cannot be read`,
          });
        }
      }

      // ── (d) ALGEBRA truth: the key must satisfy the PARSED display equation ──
      if (systemForm === 'standard') {
        for (const [tag, eq] of [['A', eqA], ['B', eqB]] as const) {
          const parsed = parseStandardDisplay(eq.display);
          if (parsed && Math.abs(parsed.a * expectedX + parsed.b * expectedY - parsed.c) > FLOAT_EPS) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `equation ${tag} "${eq.display}" is not satisfied by the key (${expectedX}, ${expectedY}): ${parsed.a}·${expectedX} + ${parsed.b}·${expectedY} = ${parsed.a * expectedX + parsed.b * expectedY} ≠ ${parsed.c} — the student solving the printed system is marked wrong`,
            });
          }
          // ── (c)/(e): the standard coefficients must match the drawn line ──
          if (isNum(eq.a) && isNum(eq.b) && isNum(eq.c)) {
            if (Math.abs(eq.b) < FLOAT_EPS) {
              violations.push({
                check: 'schema',
                where: id,
                detail: `equation ${tag} has b=0 — slope = −a/b is undefined and no line can be drawn`,
              });
            } else {
              if (Math.abs(eq.a * expectedX + eq.b * expectedY - eq.c) > FLOAT_EPS) {
                violations.push({
                  check: 'answer-key-desync',
                  where: id,
                  detail: `equation ${tag} (a=${eq.a}, b=${eq.b}, c=${eq.c}) is not satisfied by the key (${expectedX}, ${expectedY}) — the elimination student lands off the key`,
                });
              }
              if (Math.abs(eq.slope - (-eq.a / eq.b)) > FLOAT_EPS || Math.abs(eq.yIntercept - eq.c / eq.b) > FLOAT_EPS) {
                violations.push({
                  check: 'answer-key-desync',
                  where: id,
                  detail: `equation ${tag}: the drawn line (slope=${eq.slope}, yIntercept=${eq.yIntercept}) contradicts its own standard form ${eq.a}x + ${eq.b}y = ${eq.c} (⇒ slope ${-eq.a / eq.b}, yIntercept ${eq.c / eq.b}) — the graph reveal disagrees with the equation solved`,
                });
              }
            }
          }
        }
      } else {
        // slope-intercept: the parsed display line must pass through the key.
        for (const [tag, eq] of [['A', eqA], ['B', eqB]] as const) {
          const parsed = parseSlopeInterceptDisplay(eq.display);
          if (parsed && Math.abs(parsed.slope * expectedX + parsed.yIntercept - expectedY) > JUDGE_EPS) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `equation ${tag} "${eq.display}" does not pass through the key (${expectedX}, ${expectedY}): ${parsed.slope}·${expectedX} + ${parsed.yIntercept} = ${parsed.slope * expectedX + parsed.yIntercept} ≠ ${expectedY} — the substitution student solving the printed equations is marked wrong`,
            });
          }
        }
      }

      // ── scope (2): the solution magnitude honors an explicit objective ceiling ──
      if (ceiling !== undefined && (Math.abs(expectedX) > ceiling || Math.abs(expectedY) > ceiling)) {
        violations.push({
          check: 'scope',
          where: id,
          detail: `solution (${expectedX}, ${expectedY}) exceeds objective ceiling ${ceiling} (topic "${ctx.topic}")`,
        });
      }

      // ── answer-leak: the wrapper/instruction must not print the solution pair ──
      if (coordPairsIn(`${leakText} ${instruction}`).some((p) => p.x === expectedX && p.y === expectedY)) {
        violations.push({
          check: 'answer-leak',
          where: id,
          detail: `the title/description/instruction prints the solution (${expectedX}, ${expectedY})`,
        });
      }

      solutions.push(`${expectedX},${expectedY}`);
      const key = `mA=${eqA.slope}|bA=${eqA.yIntercept}|mB=${eqB.slope}|bB=${eqB.yIntercept}|sol=${expectedX},${expectedY}`;
      cardSeen.set(key, (cardSeen.get(key) ?? 0) + 1);
    }

    // ── clustering: solutions spread; no byte-identical system ──
    const variety = checkAnswerVariety(solutions, 'challenges[].solution');
    if (variety) violations.push(variety);
    cardSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({
          check: 'clustering',
          where: 'challenges[]',
          detail: `identical system "${key}" appears ${count}× — a duplicated card`,
        });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
