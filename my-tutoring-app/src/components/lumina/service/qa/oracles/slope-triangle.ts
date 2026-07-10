import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety } from './helpers';

/**
 * Slope-triangle oracle — verifies the pre-built line/triangle challenge set
 * against the component's own judging contract.
 *
 * The component (SlopeTriangle.tsx) judges:
 *  - identify_slope (handleSubmitIdentifySlope, :614-643):
 *      correct = |riseInput − expectedRise| < 0.01 && |runInput − expectedRun| < 0.01
 *  - calculate      (handleSubmitCalculate, :645-683):
 *      correct = |parsedSlope − expectedSlope| < 0.01
 *  - draw_triangle  (handleSubmitDrawTriangle, :685-710):
 *      correct = |trianglePos.size − expectedRun| < 0.01, where the drag handler
 *      clamps size to INTEGERS in [1, 8] (handleMouseMove, :498).
 *
 * THE INDEPENDENCE RULE: the shipped keys are expectedRise/expectedRun/
 * expectedSlope, but the VISUAL TRUTH the student reads is the drawn line
 * (attachedLine.slope, attachedLine.yIntercept) and the drawn triangle
 * (triangle.position.x, triangle.size). The canvas evaluates y = slope·x + b at
 * the triangle's two base x-values, so the rise the student COUNTS is exactly
 * attachedLine.slope × run — never the stored expectedRise. This oracle
 * re-derives every answer from the line + triangle geometry and checks the
 * shipped keys agree; it never trusts expectedRise/expectedSlope themselves
 * (the generator computes those the other way round, rise = slope·run at build
 * time — a desync between the drawn triangle and the stored key is precisely
 * the correct-click-marked-wrong class).
 *
 * Checks:
 *  - answer-key-desync :
 *      (a) expectedSlope must equal the DRAWN line's slope (attachedLine.slope)
 *          — the student computes the line they see.
 *      (b) expectedRise must equal attachedLine.slope × expectedRun — the
 *          geometric rise of a triangle with that run sitting on that line.
 *      (c) non-draw modes: the DRAWN triangle (triangle.size) must match
 *          expectedRun — the student counts the triangle on screen, and a
 *          mismatch marks their correct count wrong.
 *      (d) draw_triangle reachability: expectedRun must be an integer in
 *          [1, 8]; the drag handler can produce nothing else (the "unreachable
 *          correct state" class).
 *      (e) grid readability: expectedRise must land on a half-grid line
 *          (rise×2 integer) — the student counts grid squares.
 *      (f) viewport: the triangle the student must read (or the one they must
 *          build) has to fit inside xRange/yRange; a triangle off-canvas is
 *          uncountable.
 *      (g) the displayed equation banner (attachedLine.label / .equation) must
 *          parse back to the same slope and y-intercept the canvas draws —
 *          a student reading "y = 2x + 1" above a line drawn with slope 3 is
 *          being lied to. Label slopes are rounded to 2 dp (labelEquation,
 *          gemini-slope-triangle.ts:518-530), so tolerance 0.011.
 *  - answer-leak       : for identify_slope the asked answer literally IS the
 *      rise and run, so the numeric leg labels must be OFF (the component
 *      falls back showRiseRunLabels ?? showMeasurements — both leak) and the
 *      instruction/hint must not state the rise/run values. For calculate the
 *      leg labels are legitimate scaffolding (the answer is the ratio), but
 *      the text must not state the slope value itself.
 *  - scope             : the session must deliver the REQUESTED eval mode —
 *      when ctx.evalMode names one of the three modes, every challenge's type
 *      must match (a calculate session full of identify_slope cards teaches a
 *      different skill than the objective asked for).
 *  - clustering        : expectedSlope must spread across the session (no
 *      "every line has slope 2"), and no byte-identical card — same
 *      (slope, yIntercept, position.x, run) twice.
 *  - schema            : ≥3 challenges (mastery-over-demo); each has a finite
 *      attachedLine (slope, yIntercept), a triangle config, finite expected
 *      keys, a non-zero run, and a parseable equation label.
 *
 * Deliberately NOT checked:
 *  - Topic numeric ceilings. Slope objectives ("Finding slope from a graph")
 *    carry no countable ceiling; slope magnitude bands are generator styling,
 *    not the objective contract. Scope here = task-identity (mode) only.
 *  - draw_triangle text "leaks": the target run is GIVEN in the prompt by
 *    design (the task is construction, not deduction), and the hint stating
 *    the resulting rise is intended scaffolding — only the run is judged.
 *  - triangle.showSlope / showAngle: the component never renders either flag,
 *    so they can't leak anything today.
 */

/** Half the component's 0.01 judging tolerance — generator values are exact. */
const EPS = 0.005;
/** Label slopes print via toFixed(2) → rounding error ≤ 0.005, plus float slack. */
const LABEL_EPS = 0.011;

const KNOWN_TYPES = new Set(['identify_slope', 'calculate', 'draw_triangle']);
/** The drag handler's hard clamp for draw_triangle (SlopeTriangle.tsx:498). */
const DRAW_RUN_MIN = 1;
const DRAW_RUN_MAX = 8;

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function near(a: number, b: number, eps = EPS): boolean {
  return Math.abs(a - b) <= eps;
}

/**
 * Parse a "y = mx + b" display string back to {slope, yIntercept}. Handles the
 * generator's two emitters: labelEquation ("y = 2x + 1", "y = -x", "y = 0.67x")
 * and formatEquation ("y = 2*x + 1"). Returns null when unparseable.
 */
export function parseLineEquation(s: string): { slope: number; yIntercept: number } | null {
  const m = s
    .trim()
    .match(/^y\s*=\s*(-)?\s*(?:(\d+(?:\.\d+)?)\s*\*?\s*)?x\s*(?:([+-])\s*(\d+(?:\.\d+)?))?$/i);
  if (!m) return null;
  const sign = m[1] ? -1 : 1;
  const coeff = m[2] !== undefined ? parseFloat(m[2]) : 1;
  const slope = sign * coeff;
  const yIntercept = m[3] !== undefined ? (m[3] === '-' ? -1 : 1) * parseFloat(m[4]) : 0;
  return { slope, yIntercept };
}

/** Value-matched text-leak probes: "rise = 3", "run is 4", "slope = 2/3", "m = 0.5". */
function leakedValue(text: string, kind: 'rise' | 'run' | 'slope'): number | null {
  const label = kind === 'rise' ? '(?:rise|Δy|dy)' : kind === 'run' ? '(?:run|Δx|dx)' : '(?:slope|m)';
  const m = text.match(new RegExp(`\\b${label}\\s*(?:=|is)\\s*(-?\\d+(?:\\.\\d+)?)(?:\\s*\\/\\s*(\\d+(?:\\.\\d+)?))?`, 'i'));
  if (!m) return null;
  const num = parseFloat(m[1]);
  const den = m[2] !== undefined ? parseFloat(m[2]) : 1;
  return den === 0 ? null : num / den;
}

function asRange(v: unknown): [number, number] | null {
  return Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]) && v[0] < v[1]
    ? [v[0], v[1]]
    : null;
}

export const slopeTriangleOracle: ContentOracle = {
  componentId: 'slope-triangle',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    // The component destructures xRange/yRange with no default — missing ranges
    // are a schema break. Fall back to the generator's standard viewport so the
    // remaining checks still run.
    const xRange = asRange(data.xRange);
    const yRange = asRange(data.yRange);
    if (!xRange || !yRange) {
      violations.push({
        check: 'schema',
        where: 'xRange/yRange',
        detail: `missing or malformed axis ranges: xRange=${JSON.stringify(data.xRange)} yRange=${JSON.stringify(data.yRange)}`,
      });
    }
    const [xMin, xMax] = xRange ?? [-10, 10];
    const [yMin, yMax] = yRange ?? [-10, 10];

    if (challenges.length < 3) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3-6+`,
      });
    }

    const requestedMode = KNOWN_TYPES.has(ctx.evalMode) ? ctx.evalMode : null;
    const slopeValues: number[] = [];
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

      const line = (typeof c.attachedLine === 'object' && c.attachedLine !== null
        ? c.attachedLine
        : {}) as Record<string, unknown>;
      const tri = (typeof c.triangle === 'object' && c.triangle !== null
        ? c.triangle
        : {}) as Record<string, unknown>;
      const pos = (typeof tri.position === 'object' && tri.position !== null
        ? tri.position
        : {}) as Record<string, unknown>;

      const slope = line.slope;
      const yIntercept = line.yIntercept;
      const expectedRise = c.expectedRise;
      const expectedRun = c.expectedRun;
      const expectedSlope = c.expectedSlope;

      if (!isNum(slope) || !isNum(yIntercept) || !isNum(expectedRise) || !isNum(expectedRun) || !isNum(expectedSlope)) {
        violations.push({
          check: 'schema',
          where: id,
          detail: `non-finite contract fields: slope=${String(slope)} yIntercept=${String(yIntercept)} expectedRise=${String(expectedRise)} expectedRun=${String(expectedRun)} expectedSlope=${String(expectedSlope)}`,
        });
        continue;
      }
      if (expectedRun === 0) {
        violations.push({
          check: 'answer-key-desync',
          where: id,
          detail: 'expectedRun = 0 — a degenerate triangle with an undefined slope ratio',
        });
        continue;
      }
      checked++;

      const isDraw = type === 'draw_triangle';

      // ── (a) the judged slope must be the DRAWN line's slope ──
      if (!near(expectedSlope, slope)) {
        violations.push({
          check: 'answer-key-desync',
          where: id,
          detail: `expectedSlope=${expectedSlope} but the drawn line has slope ${slope} — the student reading the graph computes ${slope} and is marked wrong`,
        });
      }

      // ── (b) geometric rise: a triangle with run=expectedRun on this line rises slope×run ──
      const geometricRise = slope * expectedRun;
      if (!near(expectedRise, geometricRise)) {
        violations.push({
          check: 'answer-key-desync',
          where: id,
          detail: `expectedRise=${expectedRise} but a run of ${expectedRun} on the slope-${slope} line rises ${geometricRise} — the counted rise disagrees with the key`,
        });
      }

      // ── (c) non-draw: the drawn triangle's run must be the judged run ──
      if (!isDraw && isNum(tri.size) && !near(tri.size, expectedRun)) {
        violations.push({
          check: 'answer-key-desync',
          where: id,
          detail: `drawn triangle has run ${tri.size} but the key judges expectedRun=${expectedRun} — the student counting the screen is marked wrong`,
        });
      }

      // ── (d) draw_triangle reachability: drag clamps to integers in [1, 8] ──
      if (isDraw && (!Number.isInteger(expectedRun) || expectedRun < DRAW_RUN_MIN || expectedRun > DRAW_RUN_MAX)) {
        violations.push({
          check: 'answer-key-desync',
          where: id,
          detail: `expectedRun=${expectedRun} is unreachable — the drag handle only produces integer runs in [${DRAW_RUN_MIN}, ${DRAW_RUN_MAX}]`,
        });
      }

      // ── (e) grid readability: the counted rise must land on a half-grid line ──
      if (Math.abs(expectedRise * 2 - Math.round(expectedRise * 2)) > 0.01) {
        violations.push({
          check: 'answer-key-desync',
          where: id,
          detail: `expectedRise=${expectedRise} is not readable off the grid (not a whole or half grid unit)`,
        });
      }

      // ── (f) viewport: the triangle the student reads/builds must fit on canvas ──
      if (!isDraw && isNum(pos.x) && isNum(tri.size)) {
        const x1 = pos.x;
        const x2 = x1 + (tri.size as number);
        const y1 = slope * x1 + yIntercept;
        const y2 = slope * x2 + yIntercept;
        if (x1 < xMin - EPS || x2 > xMax + EPS || Math.min(y1, y2) < yMin - EPS || Math.max(y1, y2) > yMax + EPS) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `drawn triangle exits the viewport: corners x∈[${x1}, ${x2}], y∈[${Math.min(y1, y2).toFixed(1)}, ${Math.max(y1, y2).toFixed(1)}] vs x∈[${xMin}, ${xMax}] y∈[${yMin}, ${yMax}] — the student cannot count an off-canvas leg`,
          });
        }
      }
      if (isDraw && Number.isInteger(expectedRun) && expectedRun >= DRAW_RUN_MIN) {
        // Some integer base-x must exist where the target triangle fits on canvas.
        let fits = false;
        for (let x1 = Math.ceil(xMin); x1 + expectedRun <= xMax; x1++) {
          const y1 = slope * x1 + yIntercept;
          const y2 = slope * (x1 + expectedRun) + yIntercept;
          if (Math.min(y1, y2) >= yMin - EPS && Math.max(y1, y2) <= yMax + EPS) {
            fits = true;
            break;
          }
        }
        if (!fits) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `no on-canvas position exists for a run-${expectedRun} triangle on y=${slope}x+${yIntercept} within x∈[${xMin}, ${xMax}] y∈[${yMin}, ${yMax}] — the required build is impossible`,
          });
        }
      }

      // ── (g) the equation banner must describe the drawn line ──
      for (const field of ['label', 'equation'] as const) {
        const raw = line[field];
        if (typeof raw !== 'string' || raw.trim() === '') continue;
        const parsed = parseLineEquation(raw);
        if (!parsed) {
          violations.push({
            check: 'schema',
            where: id,
            detail: `attachedLine.${field}="${raw}" is not a parseable "y = mx + b" form`,
          });
        } else if (!near(parsed.slope, slope, LABEL_EPS) || !near(parsed.yIntercept, yIntercept, LABEL_EPS)) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `displayed ${field} "${raw}" parses to slope=${parsed.slope}, b=${parsed.yIntercept} but the canvas draws slope=${slope}, b=${yIntercept} — the banner contradicts the graph`,
          });
        }
      }

      // ── answer-leak ──
      const text = `${String(c.instruction ?? '')} ${String(c.hint ?? '')}`;
      if (type === 'identify_slope') {
        // The asked answer IS the rise & run: numeric leg labels must be off.
        // The component falls back showRiseRunLabels ?? showMeasurements.
        const labelsOn = (tri.showRiseRunLabels as boolean | undefined) ?? (tri.showMeasurements as boolean | undefined);
        if (labelsOn) {
          violations.push({
            check: 'answer-leak',
            where: id,
            detail: `identify_slope with numeric rise/run leg labels on (showRiseRunLabels/showMeasurements) — the canvas prints the asked answer`,
          });
        }
        const riseLeak = leakedValue(text, 'rise');
        const runLeak = leakedValue(text, 'run');
        if ((riseLeak !== null && near(riseLeak, expectedRise)) || (runLeak !== null && near(runLeak, expectedRun))) {
          violations.push({
            check: 'answer-leak',
            where: id,
            detail: `instruction/hint states the asked rise/run value: "${text.trim().slice(0, 120)}"`,
          });
        }
      }
      if (type === 'calculate') {
        const slopeLeak = leakedValue(text, 'slope');
        if (slopeLeak !== null && near(slopeLeak, expectedSlope)) {
          violations.push({
            check: 'answer-leak',
            where: id,
            detail: `instruction/hint states the slope value ${slopeLeak}: "${text.trim().slice(0, 120)}"`,
          });
        }
      }

      slopeValues.push(expectedSlope);
      const posX = isNum(pos.x) ? pos.x : '?';
      cardSeen.set(
        `m=${slope}|b=${yIntercept}|x=${posX}|run=${expectedRun}`,
        (cardSeen.get(`m=${slope}|b=${yIntercept}|x=${posX}|run=${expectedRun}`) ?? 0) + 1,
      );
    }

    // ── clustering: slopes spread; no byte-identical card ──
    const variety = checkAnswerVariety(slopeValues, 'challenges[].expectedSlope');
    if (variety) violations.push(variety);
    cardSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({
          check: 'clustering',
          where: 'challenges[]',
          detail: `identical card "${key}" appears ${count}× — a duplicated line/triangle`,
        });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
