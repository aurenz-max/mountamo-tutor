import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, containsWord, parseScopeCeiling } from './helpers';

/**
 * Circle-explorer oracle — verifies the pre-built circle challenge pool against
 * the component's own judging contract.
 *
 * The component (CircleExplorer.tsx) judges every mode with ONE handler
 * (handleCheck, :705-760):
 *      parsed = parseFloat(input) — or a/b fraction form;
 *      correct = |parsed − expectedAnswer| ≤ tolerance.
 * The π CONVENTION is pinned on screen: the answer panel prints "Use π ≈ 3.14"
 * for every mode except discover_pi (:968-970), and the generator builds every
 * key with PI_APPROX = 3.14 (gemini-circle-explorer.ts:285), with tolerance
 * max(0.5, 2%·|expected|) for lengths/areas, 0.15 for the discover_pi ratio and
 * 0.2 for reverse radii. So the oracle's question is never "is the key equal to
 * the mathematically pure value" — it is "does a student who follows the
 * on-screen 3.14 instruction land INSIDE the component's acceptance window
 * [expectedAnswer − tolerance, expectedAnswer + tolerance]".
 *
 * THE INDEPENDENCE RULE: re-derive the answer from what the student SEES, with
 * π = 3.14, and check the shipped key's window contains it:
 *  - circumference / area / semicircles: the canvas labels r or d directly from
 *    the `radius` field (:451-454, :480, :582), so the displayed given IS
 *    radius/2·radius — derive 2·3.14·r, 3.14·r², ½·3.14·r², 3.14·r + 2r.
 *  - reverse: the student works BACKWARD from the printed givenValue (":C = 44
 *    cm", :531-535), which the generator round1-rounds — so the oracle derives
 *    r = givenValue ÷ (2·3.14) or √(givenValue ÷ 3.14) from givenValue, never
 *    from the stored radius. A givenValue/expectedAnswer desync is exactly the
 *    correct-work-marked-wrong class the stored-radius path would miss.
 *  - circle_in_square: the canvas labels ONLY the square side (:563); derive
 *    s² − 3.14·(s ÷ 2)² from squareSide, and separately require radius = s ÷ 2
 *    (the inscribed circle's radius by construction — the tutor is fed `radius`
 *    and must not contradict the figure).
 *  - discover_pi: the window must contain 3.14 AND the ratio the student can
 *    read off the screen — the canvas prints C with TRUE π, round1(Math.PI·d)
 *    (:394), so round1(π·d) ÷ d must also be accepted.
 * This is a different derivation path from the generator's own recomputeExpected
 * (which recomputes from `radius` for every mode): a drift between the display
 * fields (givenValue, squareSide) and the radius-derived key false-passes there
 * and is caught here.
 *
 * Checks:
 *  - answer-key-desync : the 3.14-derived student answer falls outside the
 *      shipped [expectedAnswer ± tolerance] window; tolerance ≤ 0 (no correct
 *      state is reachable — students round); reverse radius ≠ expectedAnswer
 *      (the tutor is told a different radius than the one being judged);
 *      circle_in_square radius ≠ squareSide ÷ 2 (figure/tutor contradiction).
 *  - scope             : (a) the RADIUS exceeds ctx.scopeMax ?? topic ceiling ??
 *      the mode's intrinsic builder range (the generator's resolveScopeRange
 *      contract scopes "the circle's radius", so the ceiling binds the radius,
 *      not the derived C/A magnitude); (b) when ctx.evalMode names a known mode,
 *      every challenge's type must match it (task-identity fidelity).
 *  - answer-leak       : value-matched only. The narration/instruction/hint must
 *      not state the ASKED value — the computed C/A/perimeter (decimal or ≥ 20,
 *      so formula constants like "2" and "π ≈ 3.14" can't false-match), or for
 *      reverse a labeled "radius is 7"/"r = 7" naming the answer. Showing the
 *      radius when asking for the area/circumference is the TASK (intended
 *      scaffolding), never flagged; the printed givenValue/squareSide are the
 *      given by design.
 *  - clustering        : answers spread across the session (expectedAnswer for
 *      computing modes; the RADIUS for discover_pi, whose answer is the constant
 *      3.14 by design — the variety that matters there is distinct circles); no
 *      byte-identical card (same type/variant/radius/side/given value twice).
 *  - schema            : ≥3 challenges (mastery-over-demo); finite positive
 *      radius; finite expectedAnswer/tolerance; non-empty unitLabel; valid
 *      given/answerKind/reverseGiven/compositeShape enums; answerKind matches
 *      the task (a wrong kind mislabels the on-screen unit suffix, :699-703);
 *      reverse ships a positive givenValue; circle_in_square ships a positive
 *      squareSide; degenerate tolerance (≥ |expectedAnswer|, so 0 is accepted).
 *
 * Deliberately NOT checked:
 *  - discover_pi "3.14 leak": the manipulative deliberately reveals ≈ 3.14
 *    after the unroll (":≈ 3.14 d", :445, and the post-unroll feedback :294),
 *    and answering is GATED on unrolling (needsUnrollFirst, :236) — the reveal
 *    IS the discovery design, so text stating 3.14 is not a leak there.
 *  - title/description leaks: the wrapper schema instructs number-free text
 *    (gemini-circle-explorer.ts:832) and a π discussion in a description would
 *    false-fire; per-challenge text is the surface that matters.
 *  - true-π grading beyond discover_pi: the answer panel pins "Use π ≈ 3.14";
 *    whether the tolerance also admits a true-π computation is generator
 *    courtesy (the 2% band happens to cover it), not the judged contract.
 *  - usePiApprox: informational — the component never reads it.
 *  - support-tier text coherence (conceptual hint at hard, showFormulaReveal
 *    matching the tier): scaffolding QUALITY, /eval-test territory, and absent
 *    flags legitimately default to "show".
 *  - top-level challengeType vs challenge types: on the Auto/mixed path it is
 *    representative metadata only (the component renders per-challenge); the
 *    eval-mode identity check above covers the pinned-mode contract.
 */

/** The component's judging convention: students are told "Use π ≈ 3.14". */
const PI_APPROX = 3.14;
/** Float slack on top of the shipped tolerance window — generator values are exact. */
const FLOAT_EPS = 1e-9;

const KNOWN_TYPES = new Set(['discover_pi', 'circumference', 'area', 'reverse', 'composite']);
const COMPOSITE_SHAPES = new Set(['semicircle_area', 'semicircle_perimeter', 'circle_in_square']);
const GIVEN_KINDS = new Set(['radius', 'diameter']);
const REVERSE_GIVENS = new Set(['circumference', 'area']);

/** What the unit suffix must label per task (unitSuffix, CircleExplorer.tsx:699-703). */
const ANSWER_KIND_BY_TYPE: Record<string, string> = {
  discover_pi: 'ratio',
  circumference: 'length',
  area: 'area',
  reverse: 'length',
};
const ANSWER_KIND_BY_SHAPE: Record<string, string> = {
  semicircle_area: 'area',
  semicircle_perimeter: 'length',
  circle_in_square: 'area',
};

/**
 * Intrinsic RADIUS ceilings from the generator's builder ranges
 * (gemini-circle-explorer.ts): discover_pi randInt(3,10); circumference radius
 * variant randInt(2,15) (diameter variant ≤ 12); area randInt(2,12); reverse
 * randInt(3,15); composite semicircles randInt(2,12), circle_in_square
 * randInt(2,8). Used only when no explicit/topic ceiling exists.
 */
function intrinsicRadiusCeiling(type: string, shape?: string): number {
  switch (type) {
    case 'discover_pi': return 10;
    case 'circumference': return 15;
    case 'area': return 12;
    case 'reverse': return 15;
    case 'composite': return shape === 'circle_in_square' ? 8 : 12;
    default: return 15;
  }
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Mirror of the component's display rounding for the discover_pi C label (:394). */
const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Labeled radius-leak probe: "radius is 7", "r = 7" (reverse's asked value). */
function leakedRadius(text: string): number | null {
  const m = text.match(/\b(?:radius|r)\s*(?:=|is)\s*(-?\d+(?:\.\d+)?)/i);
  return m ? parseFloat(m[1]) : null;
}

export const circleExplorerOracle: ContentOracle = {
  componentId: 'circle-explorer',
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
    const explicitCeiling = ctx.scopeMax ?? parseScopeCeiling(ctx.topic);

    // Variety pools: computing modes spread by their ANSWER; discover_pi's answer
    // is the constant 3.14 by design, so its variety lives in the RADIUS.
    const answerValues: number[] = [];
    const discoverRadii: number[] = [];
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

      // ── scope (b): the session must deliver the requested eval mode ──
      if (requestedMode && type !== requestedMode) {
        violations.push({
          check: 'scope',
          where: id,
          detail: `challenge type "${type}" but the objective asked for eval mode "${requestedMode}" — a different task identity`,
        });
      }

      const radius = c.radius;
      const expected = c.expectedAnswer;
      const tolerance = c.tolerance;

      // ── schema: core numeric contract ──
      if (!isNum(radius) || radius <= 0 || !isNum(expected) || !isNum(tolerance)) {
        violations.push({
          check: 'schema',
          where: id,
          detail: `malformed contract fields: radius=${String(radius)} (must be a positive number) expectedAnswer=${String(expected)} tolerance=${String(tolerance)}`,
        });
        continue;
      }
      if (typeof c.unitLabel !== 'string' || c.unitLabel.trim() === '') {
        violations.push({
          check: 'schema',
          where: id,
          detail: `missing/empty unitLabel — the figure and answer suffix would print "undefined"`,
        });
      }
      if (!GIVEN_KINDS.has(String(c.given))) {
        violations.push({
          check: 'schema',
          where: id,
          detail: `given="${String(c.given)}" is not 'radius' | 'diameter'`,
        });
      }

      // ── mode-specific field gates ──
      const reverseGiven = typeof c.reverseGiven === 'string' ? c.reverseGiven : undefined;
      const givenValue = c.givenValue;
      const shape = typeof c.compositeShape === 'string' ? c.compositeShape : undefined;
      const squareSide = c.squareSide;

      if (type === 'reverse') {
        if (!reverseGiven || !REVERSE_GIVENS.has(reverseGiven) || !isNum(givenValue) || givenValue <= 0) {
          violations.push({
            check: 'schema',
            where: id,
            detail: `reverse challenge missing its given: reverseGiven=${String(reverseGiven)} givenValue=${String(givenValue)} — the student has nothing to work back from`,
          });
          continue;
        }
      }
      if (type === 'composite') {
        if (!shape || !COMPOSITE_SHAPES.has(shape)) {
          violations.push({
            check: 'schema',
            where: id,
            detail: `composite challenge with unknown compositeShape="${String(shape)}"`,
          });
          continue;
        }
        if (shape === 'circle_in_square' && (!isNum(squareSide) || squareSide <= 0)) {
          violations.push({
            check: 'schema',
            where: id,
            detail: `circle_in_square without a positive squareSide (got ${String(squareSide)}) — the figure labels "side = undefined"`,
          });
          continue;
        }
      }

      // ── schema: answerKind must label the task's unit suffix correctly ──
      const wantKind = type === 'composite' ? ANSWER_KIND_BY_SHAPE[shape!] : ANSWER_KIND_BY_TYPE[type];
      if (wantKind && String(c.answerKind) !== wantKind) {
        violations.push({
          check: 'schema',
          where: id,
          detail: `answerKind="${String(c.answerKind)}" but a ${type}${shape ? `/${shape}` : ''} answer is a ${wantKind} — the on-screen unit suffix would mislabel the answer`,
        });
      }

      // ── answer-key-desync: a non-positive tolerance makes correctness unreachable ──
      if (tolerance <= 0) {
        violations.push({
          check: 'answer-key-desync',
          where: id,
          detail: `tolerance=${tolerance} — no correct state is reachable (students compute with rounded π ≈ 3.14; the window must be positive)`,
        });
        continue;
      }
      // ── schema: a tolerance wider than the answer itself accepts 0 ──
      if (tolerance >= Math.abs(expected) && expected !== 0) {
        violations.push({
          check: 'schema',
          where: id,
          detail: `degenerate tolerance ${tolerance} ≥ |expectedAnswer| ${Math.abs(expected)} — entering 0 would be marked correct`,
        });
      }
      checked++;

      // ── THE INDEPENDENCE RULE: derive the student's 3.14-based answer from the
      //    DISPLAYED given and require the shipped window to contain it. ──
      let derived: number | null = null;
      let displayed = '';
      if (type === 'discover_pi') {
        // Two things the student can produce: the taught constant 3.14, and the
        // ratio read off the canvas — C is printed with TRUE π, round1'd (:394).
        const d = 2 * radius;
        const labelRatio = round1(Math.PI * d) / d;
        if (Math.abs(PI_APPROX - expected) > tolerance + FLOAT_EPS) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `expectedAnswer=${expected} (±${tolerance}) does not accept the taught ratio π ≈ 3.14 — the discovery answer is marked wrong`,
          });
        } else if (Math.abs(labelRatio - expected) > tolerance + FLOAT_EPS) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `the on-screen ratio C ÷ d = ${round1(Math.PI * d)} ÷ ${d} = ${labelRatio.toFixed(4)} falls outside expectedAnswer=${expected} (±${tolerance}) — the student dividing the printed labels is marked wrong`,
          });
        }
      } else if (type === 'circumference') {
        derived = 2 * PI_APPROX * radius;
        displayed = c.given === 'diameter' ? `diameter ${2 * radius}` : `radius ${radius}`;
      } else if (type === 'area') {
        derived = PI_APPROX * radius * radius;
        displayed = c.given === 'diameter' ? `diameter ${2 * radius}` : `radius ${radius}`;
      } else if (type === 'reverse') {
        // Derive from the PRINTED givenValue — the value the student works back from.
        const gv = givenValue as number;
        derived = reverseGiven === 'area' ? Math.sqrt(gv / PI_APPROX) : gv / (2 * PI_APPROX);
        displayed = `${reverseGiven} ${gv}`;
        // The tutor is fed `radius` and told "Expected {expectedAnswer}" — they must agree.
        if (Math.abs(radius - expected) > tolerance + FLOAT_EPS) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `reverse challenge stores radius=${radius} but judges expectedAnswer=${expected} — the tutor coaches toward a different radius than the key accepts`,
          });
        }
      } else if (type === 'composite') {
        if (shape === 'circle_in_square') {
          const s = squareSide as number;
          derived = s * s - PI_APPROX * (s / 2) * (s / 2);
          displayed = `side ${s}`;
          // The inscribed circle's radius IS side/2 — the tutor's radius must match the figure.
          if (Math.abs(radius - s / 2) > 0.01) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `circle_in_square with squareSide=${s} (inscribed radius ${s / 2}) but radius=${radius} — the tutor and the drawn figure disagree`,
            });
          }
        } else if (shape === 'semicircle_perimeter') {
          derived = PI_APPROX * radius + 2 * radius;
          displayed = `radius ${radius}`;
        } else {
          derived = 0.5 * PI_APPROX * radius * radius;
          displayed = `radius ${radius}`;
        }
      }
      if (derived !== null && Math.abs(derived - expected) > tolerance + FLOAT_EPS) {
        violations.push({
          check: 'answer-key-desync',
          where: id,
          detail: `a student following "use π ≈ 3.14" computes ${derived.toFixed(4)} from the displayed ${displayed}, outside the accepted window ${expected} ±${tolerance} — correct work marked wrong`,
        });
      }

      // ── scope (a): the radius honors the objective ceiling ──
      const ceiling = explicitCeiling ?? intrinsicRadiusCeiling(type, shape);
      if (radius > ceiling + FLOAT_EPS) {
        violations.push({
          check: 'scope',
          where: id,
          detail: `radius ${radius} exceeds the objective ceiling ${ceiling} (topic "${ctx.topic}")`,
        });
      }

      // ── answer-leak (value-matched; discover_pi exempt — see header) ──
      const text = `${String(c.narration ?? '')} ${String(c.instruction ?? '')} ${String(c.hint ?? '')}`;
      if (type !== 'discover_pi') {
        // Computed answers are decimals or ≥ 20 — formula constants ("2", "3.14",
        // "½") and small given radii can't false-match under this gate.
        const asked = String(expected);
        if ((asked.includes('.') || expected >= 20) && containsWord(text, asked)) {
          violations.push({
            check: 'answer-leak',
            where: id,
            detail: `text states the asked value ${asked}: "${text.trim().slice(0, 120)}"`,
          });
        }
        if (type === 'reverse') {
          const leak = leakedRadius(text);
          if (leak !== null && Math.abs(leak - expected) <= Math.max(tolerance, 0.01)) {
            violations.push({
              check: 'answer-leak',
              where: id,
              detail: `text names the asked radius ${leak}: "${text.trim().slice(0, 120)}"`,
            });
          }
        }
      }

      // ── clustering pools + byte-identical card key (mirrors the visual identity:
      //    type / variant / radius / side / printed given) ──
      if (type === 'discover_pi') discoverRadii.push(radius);
      else answerValues.push(expected);
      const key = `${type}|${String(c.given)}|${reverseGiven ?? ''}|${shape ?? ''}|r=${radius}|s=${isNum(squareSide) ? squareSide : ''}|g=${isNum(givenValue) ? givenValue : ''}`;
      cardSeen.set(key, (cardSeen.get(key) ?? 0) + 1);
    }

    // ── clustering: answers spread; discover circles vary; no duplicated card ──
    const variety = checkAnswerVariety(answerValues, 'challenges[].expectedAnswer');
    if (variety) violations.push(variety);
    const discoverVariety = checkAnswerVariety(discoverRadii, 'discover_pi[].radius');
    if (discoverVariety) violations.push(discoverVariety);
    cardSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({
          check: 'clustering',
          where: 'challenges[]',
          detail: `identical card "${key}" appears ${count}× — a duplicated circle`,
        });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
