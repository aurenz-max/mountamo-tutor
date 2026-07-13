import type { ContentOracle, OracleResult, OracleViolation } from './types';
import {
  asRecordArray,
  checkAnswerVariety,
  checkUniqueOptions,
  parseScopeCeiling,
} from './helpers';

/**
 * Coordinate-graph oracle — verifies the plot/read/slope/intercept challenge
 * set against the component's own judging contract.
 *
 * The component (CoordinateGraph.tsx) judges:
 *  - plot_point     (handleSvgClick, :291-299): the click is snapped to an
 *      INTEGER grid intersection (svgToGraph Math.rounds, :285-286) and
 *      rejected when outside [gridMin, gridMax] (:287); correct =
 *      pt.x === challenge.x1 && pt.y === challenge.y1 (exact).
 *  - read_point / find_slope / find_intercept (handleOptionClick, :306-313):
 *      correct = clickedIndex === challenge.correctOptionIndex. The reveal
 *      path falls back `correctOptionIndex ?? 0` (:312, :632), so a MISSING
 *      index makes every click judged wrong while the reveal shows option0.
 *  - find_intercept rendering (interceptData memo, :197-208): the drawn line
 *      and the "?" crossing marker are derived live from (x1,y1)-(x2,y2);
 *      when x2 === x1 the memo returns null and NO LINE RENDERS AT ALL —
 *      the student faces an empty grid with four options.
 *
 * THE INDEPENDENCE RULE: the shipped key is `correctOptionIndex` (MC modes)
 * or the instruction text (plot_point). The VISUAL TRUTH the student reads is
 * the raw coordinates the SVG draws: the highlighted point (x1, y1), the line
 * through (x1, y1)-(x2, y2). This oracle PARSES the option strings back into
 * numbers (coordinate pairs, rational slopes, integer intercepts) and compares
 * them to values re-derived from the drawn geometry — slope = (y2−y1)/(x2−x1),
 * yIntercept = y1 − slope·x1 — instead of re-running the generator's
 * simplifyFraction/string-equality post-validation. A generator whose fraction
 * simplifier or string matcher drifts can no longer false-pass: the option the
 * key points at must NUMERICALLY name what the canvas shows.
 *
 * Checks:
 *  - answer-key-desync :
 *      (a) plot_point: the instruction must state the judged target as a
 *          "(x, y)" pair (the generator contract, gemini-coordinate-graph.ts
 *          rule 4). No pair, or a pair that differs from (x1, y1), means the
 *          student is told to plot one point and judged against another.
 *      (b) reachability: every judged coordinate must be an INTEGER inside
 *          [gridMin, gridMax] — clicks snap to integer intersections and
 *          out-of-grid clicks return null, and off-lattice/off-canvas points
 *          cannot be read off the integer grid (the clip-path hides them).
 *      (c) read_point: the option at correctOptionIndex must parse to exactly
 *          the drawn point (x1, y1); and NO OTHER option may also parse to it
 *          (two visually-correct options, only one judged — the correct click
 *          marked wrong).
 *      (d) find_slope: x1 ≠ x2 (a vertical line has no slope to pick); the
 *          keyed option must parse (fraction or integer) to (y2−y1)/(x2−x1);
 *          no second option may equal it numerically (e.g. "2/3" and "4/6").
 *      (e) find_intercept: x1 ≠ x2 (the component renders NO line at all);
 *          the crossing y1 − slope·x1 must lie inside [gridMin, gridMax]
 *          (an off-canvas crossing is clipped and unreadable); the keyed
 *          option must parse to that crossing; no duplicate numeric match.
 *      (f) find_intercept: a shipped equationLabel must parse back to the
 *          same slope and intercept the canvas draws — a banner reading
 *          "y = 2x + 5" above a line that crosses at 3 lies to the student.
 *          LLM labels may round slopes to 2 dp, so tolerance 0.011.
 *  - scope             : (1) when ctx.evalMode names one of the four modes,
 *      every challenge's type must match (task identity); (2) coordinate
 *      magnitudes must honor the objective ceiling — ctx.scopeMax ?? topic
 *      ceiling ?? the generator's intrinsic grid bound (±10,
 *      getGridRange never emits wider).
 *  - answer-leak       : value-matched only. read_point: instruction/hint
 *      contains the exact "(x1, y1)" pair. find_slope: text states the slope
 *      value ("slope is 2", "m = -2/3"). find_intercept: text states the
 *      intercept value ("y-intercept is 3", "b = 3", "at (0, 3)"); and a
 *      medium/hard support tier that promises to withhold the equation label
 *      (resolveSupportStructure) but ships showEquationLabel !== false leaves
 *      the literal answer printed on the canvas.
 *  - clustering        : the judged answer (point / slope / intercept) must
 *      spread across the session (checkAnswerVariety), and no byte-identical
 *      card — same (type, x1, y1, x2, y2) twice.
 *  - schema            : ≥3 challenges (mastery-over-demo); finite gridMin <
 *      gridMax; finite coordinates; non-empty instruction/hint; MC modes ship
 *      four non-empty, non-duplicate options and an integer
 *      correctOptionIndex in [0, 3] (a missing index is an UNWINNABLE card —
 *      see the ?? 0 fallback above).
 *
 * Deliberately NOT checked:
 *  - plot_point instruction stating the point is NOT a leak: the task is
 *    plotting a GIVEN point, so the pair is the challenge givens — it is
 *    instead REQUIRED to match the key (desync check (a)).
 *  - find_intercept's default/easy equationLabel (which literally states the
 *    intercept) and the rise/run numeric labels on find_slope: both are the
 *    mode's intended default scaffolding, withdrawn by support tiers.
 *    Flagging them would fire on every legitimate default generation
 *    (area-model precedent). Only the tier-withheld-but-visible equation
 *    label is flagged, because that tier's contract is explicit.
 *  - find_slope rise/run label tier consistency (medium/hard hide them):
 *    rise and run are one division away from the answer, not the answer
 *    value itself — the value-matched-only rule excludes it.
 *  - grade-band → quadrant policy (first-quadrant grids for younger grades):
 *    gradeLevel strings are free-form; getGridRange owns that mapping.
 *  - distractor plausibility (swap/negate quality) — /eval-test territory.
 */

const EPS = 1e-9;
/** LLM-authored equation labels may print slopes rounded to 2 dp. */
const LABEL_EPS = 0.011;
/** Intercepts travel through one float division — allow rounding slack. */
const DERIVED_EPS = 1e-6;

const KNOWN_TYPES = new Set(['plot_point', 'read_point', 'find_slope', 'find_intercept']);
/** The generator's widest grid (getGridRange, gemini-coordinate-graph.ts:242-255). */
const INTRINSIC_COORD_CEILING = 10;

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function near(a: number, b: number, eps = EPS): boolean {
  return Math.abs(a - b) <= eps;
}

/** Parse an MC option as a rational: "2/3", "-1", "0", "0.5". Null when not numeric. */
export function parseNumericOption(s: unknown): number | null {
  if (typeof s !== 'string') return null;
  const m = s.trim().match(/^(-?\d+(?:\.\d+)?)(?:\s*\/\s*(-?\d+(?:\.\d+)?))?$/);
  if (!m) return null;
  const num = parseFloat(m[1]);
  const den = m[2] !== undefined ? parseFloat(m[2]) : 1;
  return den === 0 ? null : num / den;
}

/** Parse an MC option that must be exactly one "(x, y)" pair. */
export function parseCoordOption(s: unknown): { x: number; y: number } | null {
  if (typeof s !== 'string') return null;
  const m = s.trim().match(/^\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)$/);
  return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : null;
}

/** Every "(a, b)" pair appearing anywhere in free text. */
function coordPairsIn(text: string): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  const re = /\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push({ x: parseFloat(m[1]), y: parseFloat(m[2]) });
  return out;
}

/**
 * Parse a "y = mx + b" display label back to {slope, yIntercept}. Handles the
 * generator's emitters and plausible LLM variants: "y = 2x + 3", "y = -x",
 * "y = 1/2x", "y = 2/3x - 1", "y = 2*x + 5", and the fallback's ugly
 * "y = 2x + -3". Returns null when unparseable.
 */
export function parseEquationLabel(s: string): { slope: number; yIntercept: number } | null {
  const m = s
    .trim()
    .match(/^y\s*=\s*(-)?\s*(?:(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?\s*\*?\s*)?x\s*(?:([+-])\s*(-?\d+(?:\.\d+)?))?$/i);
  if (!m) return null;
  const sign = m[1] ? -1 : 1;
  const num = m[2] !== undefined ? parseFloat(m[2]) : 1;
  const den = m[3] !== undefined ? parseFloat(m[3]) : 1;
  if (den === 0) return null;
  let yIntercept = 0;
  if (m[4] !== undefined) {
    const v = parseFloat(m[5]);
    yIntercept = m[4] === '-' ? -v : v;
  }
  return { slope: (sign * num) / den, yIntercept };
}

/** Value-matched text probe: "slope = 2", "slope is -2/3", "m = 1/2". */
function leakedSlope(text: string): number | null {
  const m = text.match(/\b(?:slope|m)\s*(?:=|is)\s*(-?\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?/i);
  if (!m) return null;
  const num = parseFloat(m[1]);
  const den = m[2] !== undefined ? parseFloat(m[2]) : 1;
  return den === 0 ? null : num / den;
}

/** Value-matched text probes: "y-intercept is 3", "b = -2", "at (0, 3)". */
function leakedIntercepts(text: string): number[] {
  const out: number[] = [];
  let m: RegExpExecArray | null;
  const labeled = /\b(?:y\s*-?\s*intercept|intercept|b)\s*(?:=|is)\s*(-?\d+(?:\.\d+)?)/gi;
  while ((m = labeled.exec(text))) out.push(parseFloat(m[1]));
  const asPoint = /\(\s*0\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g;
  while ((m = asPoint.exec(text))) out.push(parseFloat(m[1]));
  return out;
}

export const coordinateGraphOracle: ContentOracle = {
  componentId: 'coordinate-graph',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    // The component builds the grid and every screen position from
    // gridMin/gridMax with no default — malformed ranges are a schema break.
    let gridMin = -10;
    let gridMax = 10;
    if (!isNum(data.gridMin) || !isNum(data.gridMax) || data.gridMin >= data.gridMax) {
      violations.push({
        check: 'schema',
        where: 'gridMin/gridMax',
        detail: `missing or malformed grid range: gridMin=${JSON.stringify(data.gridMin)} gridMax=${JSON.stringify(data.gridMax)}`,
      });
    } else {
      gridMin = data.gridMin;
      gridMax = data.gridMax;
    }

    if (challenges.length < 3) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3-6+`,
      });
    }

    const ceiling = ctx.scopeMax ?? parseScopeCeiling(ctx.topic) ?? INTRINSIC_COORD_CEILING;
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

      // ── scope (1): the session must deliver the requested eval mode ──
      if (requestedMode && type !== requestedMode) {
        violations.push({
          check: 'scope',
          where: id,
          detail: `challenge type "${type}" but the objective asked for eval mode "${requestedMode}" — a different task identity`,
        });
      }

      const twoPoint = type === 'find_slope' || type === 'find_intercept';
      const x1 = c.x1;
      const y1 = c.y1;
      const x2 = c.x2;
      const y2 = c.y2;
      const instruction = typeof c.instruction === 'string' ? c.instruction : '';
      const hint = typeof c.hint === 'string' ? c.hint : '';

      if (
        !isNum(x1) || !isNum(y1) ||
        (twoPoint && (!isNum(x2) || !isNum(y2))) ||
        instruction.trim() === '' || hint.trim() === ''
      ) {
        violations.push({
          check: 'schema',
          where: id,
          detail: `malformed challenge: x1=${String(c.x1)} y1=${String(c.y1)}${twoPoint ? ` x2=${String(c.x2)} y2=${String(c.y2)}` : ''} instruction=${JSON.stringify(c.instruction)} hint=${JSON.stringify(c.hint)}`,
        });
        continue;
      }
      checked++;

      const coords = twoPoint ? [x1, y1, x2 as number, y2 as number] : [x1, y1];

      // ── answer-key-desync (b): reachability on the integer grid ──
      if (coords.some((v) => !Number.isInteger(v))) {
        violations.push({
          check: 'answer-key-desync',
          where: id,
          detail:
            type === 'plot_point'
              ? `target (${x1}, ${y1}) is not an integer point — clicks snap to integer intersections (svgToGraph Math.rounds), so the correct state is unreachable`
              : `off-lattice coordinates [${coords.join(', ')}] — the student cannot read a non-integer point off the integer grid`,
        });
      }
      if (coords.some((v) => v < gridMin || v > gridMax)) {
        violations.push({
          check: 'answer-key-desync',
          where: id,
          detail:
            type === 'plot_point'
              ? `target (${x1}, ${y1}) is outside the plotted grid [${gridMin}, ${gridMax}] — out-of-grid clicks return null, so the target is unclickable`
              : `coordinates [${coords.join(', ')}] exit the plotted grid [${gridMin}, ${gridMax}] — the clip-path hides them from the student`,
        });
      }

      // ── scope (2): coordinate magnitudes honor the objective ceiling ──
      const maxMag = Math.max(...coords.map((v) => Math.abs(v)));
      if (maxMag > ceiling) {
        violations.push({
          check: 'scope',
          where: id,
          detail: `coordinate magnitude ${maxMag} exceeds objective ceiling ${ceiling} (topic "${ctx.topic}")`,
        });
      }

      const text = `${instruction} ${hint}`;

      // ── MC-mode shared shape ──
      let opts: string[] | null = null;
      let cIdx = -1;
      if (type !== 'plot_point') {
        const raw = [c.option0, c.option1, c.option2, c.option3];
        if (raw.some((o) => typeof o !== 'string' || o.trim() === '')) {
          violations.push({
            check: 'schema',
            where: id,
            detail: `missing/empty MC option(s): [${raw.map((o) => JSON.stringify(o)).join(', ')}]`,
          });
          continue;
        }
        opts = raw as string[];
        const dup = checkUniqueOptions(opts, id);
        if (dup) violations.push(dup);
        const idx = c.correctOptionIndex;
        if (!Number.isInteger(idx) || (idx as number) < 0 || (idx as number) > 3) {
          violations.push({
            check: 'schema',
            where: id,
            detail: `correctOptionIndex=${String(idx)} is not an integer in [0, 3] — the component judges idx === correctOptionIndex, so this card is unwinnable (and the reveal falls back to option0)`,
          });
          continue;
        }
        cIdx = idx as number;
      }

      // ── per-mode checks ──
      if (type === 'plot_point') {
        // (a) the instruction must state the judged target.
        const pairs = coordPairsIn(instruction);
        if (pairs.length === 0) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `instruction never states a "(x, y)" target ("${instruction.slice(0, 100)}") — the judged click (${x1}, ${y1}) is unguessable`,
          });
        } else if (!pairs.some((p) => near(p.x, x1) && near(p.y, y1))) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `instruction states (${pairs[0].x}, ${pairs[0].y}) but the key judges (${x1}, ${y1}) — the student plotting the stated point is marked wrong`,
          });
        }
        answerValues.push(`(${x1},${y1})`);
      }

      if (type === 'read_point' && opts) {
        const parsed = opts.map(parseCoordOption);
        const keyPt = parsed[cIdx];
        if (!keyPt || !near(keyPt.x, x1) || !near(keyPt.y, y1)) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `option[${cIdx}]="${opts[cIdx]}" but the drawn point is (${x1}, ${y1}) — the student reading the screen is marked wrong`,
          });
        }
        const matches = parsed.filter((p) => p && near(p.x, x1) && near(p.y, y1)).length;
        if (matches > 1) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `${matches} options parse to the drawn point (${x1}, ${y1}) but only index ${cIdx} is judged correct — a correct click on the twin is marked wrong`,
          });
        }
        // answer-leak: the asked pair stated in the text.
        if (coordPairsIn(text).some((p) => near(p.x, x1) && near(p.y, y1))) {
          violations.push({
            check: 'answer-leak',
            where: id,
            detail: `instruction/hint states the asked point (${x1}, ${y1}): "${text.trim().slice(0, 120)}"`,
          });
        }
        answerValues.push(`(${x1},${y1})`);
      }

      if (type === 'find_slope' && opts) {
        if (x1 === x2) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `x1 === x2 (${x1}) — a vertical line has no slope; no option can be the correct answer`,
          });
          continue;
        }
        const slope = ((y2 as number) - y1) / ((x2 as number) - x1);
        const parsed = opts.map(parseNumericOption);
        const keyVal = parsed[cIdx];
        if (keyVal === null || !near(keyVal, slope)) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `option[${cIdx}]="${opts[cIdx]}" but the drawn line through (${x1}, ${y1}) and (${x2}, ${y2}) has slope ${slope} — the student computing the graph is marked wrong`,
          });
        }
        const matches = parsed.filter((v) => v !== null && near(v, slope)).length;
        if (matches > 1) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `${matches} options equal the true slope ${slope} (e.g. unsimplified twins) but only index ${cIdx} is judged correct`,
          });
        }
        const leak = leakedSlope(text);
        if (leak !== null && near(leak, slope, DERIVED_EPS)) {
          violations.push({
            check: 'answer-leak',
            where: id,
            detail: `instruction/hint states the slope value ${leak}: "${text.trim().slice(0, 120)}"`,
          });
        }
        answerValues.push(slope.toFixed(4));
      }

      if (type === 'find_intercept' && opts) {
        if (x1 === x2) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `x1 === x2 (${x1}) — interceptData is null and the component renders NO line: an empty grid with four options`,
          });
          continue;
        }
        const slope = ((y2 as number) - y1) / ((x2 as number) - x1);
        const yInt = y1 - slope * x1;
        if (yInt < gridMin - DERIVED_EPS || yInt > gridMax + DERIVED_EPS) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `the line crosses the y-axis at ${yInt}, outside the plotted grid [${gridMin}, ${gridMax}] — the crossing is clipped off-canvas and unreadable`,
          });
        }
        const parsed = opts.map(parseNumericOption);
        const keyVal = parsed[cIdx];
        if (keyVal === null || !near(keyVal, yInt, DERIVED_EPS)) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `option[${cIdx}]="${opts[cIdx]}" but the drawn line crosses the y-axis at ${yInt} — the student reading the crossing is marked wrong`,
          });
        }
        const matches = parsed.filter((v) => v !== null && near(v, yInt, DERIVED_EPS)).length;
        if (matches > 1) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `${matches} options equal the true intercept ${yInt} but only index ${cIdx} is judged correct`,
          });
        }
        // (f) the equation banner must describe the drawn line.
        const label = typeof c.equationLabel === 'string' ? c.equationLabel.trim() : '';
        if (label !== '') {
          const eq = parseEquationLabel(label);
          if (!eq) {
            violations.push({
              check: 'schema',
              where: id,
              detail: `equationLabel="${label}" is not a parseable "y = mx + b" form`,
            });
          } else if (!near(eq.slope, slope, LABEL_EPS) || !near(eq.yIntercept, yInt, LABEL_EPS)) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `equationLabel "${label}" parses to slope=${eq.slope}, b=${eq.yIntercept} but the canvas draws slope=${slope}, b=${yInt} — the banner contradicts the graph`,
            });
          }
        }
        // answer-leak: the intercept value stated in the text.
        if (leakedIntercepts(text).some((v) => near(v, yInt, DERIVED_EPS))) {
          violations.push({
            check: 'answer-leak',
            where: id,
            detail: `instruction/hint states the intercept value ${yInt}: "${text.trim().slice(0, 120)}"`,
          });
        }
        // answer-leak: a medium/hard tier promises to withhold the equation
        // label (it states the answer) but the flag leaves it visible.
        const tier = String(c.supportTier ?? '');
        if ((tier === 'medium' || tier === 'hard') && label !== '' && c.showEquationLabel !== false) {
          violations.push({
            check: 'answer-leak',
            where: id,
            detail: `support tier "${tier}" withholds the equation label for find_intercept, but showEquationLabel !== false leaves "${label}" (which states the answer) on the canvas`,
          });
        }
        answerValues.push(String(Math.round(yInt * 1000) / 1000));
      }

      cardSeen.set(
        `${type}|${x1},${y1}|${twoPoint ? `${x2},${y2}` : ''}`,
        (cardSeen.get(`${type}|${x1},${y1}|${twoPoint ? `${x2},${y2}` : ''}`) ?? 0) + 1,
      );
    }

    // ── clustering: answers spread; no byte-identical card ──
    const variety = checkAnswerVariety(answerValues, 'challenges[].answer');
    if (variety) violations.push(variety);
    cardSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({
          check: 'clustering',
          where: 'challenges[]',
          detail: `identical card "${key}" appears ${count}× — a duplicated point/line`,
        });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
