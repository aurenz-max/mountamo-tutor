import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, parseScopeCeiling } from './helpers';

/**
 * Number-line oracle — a CALCULATION oracle for the four number-line challenge
 * types (plot_point, show_jump, order_values, find_between). Its flagship
 * guarantee is answer-key-desync on show_jump: the operation the student "walks"
 * on the line must actually land where the stored answer says, ON the rendered
 * line — the vocabulary-explorer class (a correct walk marked wrong) fused with
 * the array-grid class (the correct landing sits off the visible line, so the
 * correct state is unreachable).
 *
 * The component (NumberLine.tsx) judges correctness in checkAnswer (:561) per type:
 *  - plot_point (:570-587): tolerance = getSnapPrecision(numberType) (:571,
 *    integer→1, decimal→0.01, fraction/mixed→1/8); correct iff every target has a
 *    placed point within `Math.abs(p - target) <= tolerance` (:572-574). The pad
 *    snaps + CLAMPS placements into [min,max] (snapToValue, :171-175), so a target
 *    OUTSIDE [range.min,range.max] can never be matched — an unreachable answer.
 *    A target inside the range is always reachable (the nearest snap point is
 *    ≤ precision/2 ≤ tolerance away), so reachability = "target within [min,max]".
 *  - show_jump (:588-607): the answer key is the OPERATIONS array, not
 *    targetValues. For each op, expected = op.startValue ± op.changeValue
 *    (add|subtract, :595-597); correct iff every jumpEndPoints[i] is within
 *    tolerance of that expected landing (:598-599). targetValues is display/tutor
 *    redundancy — so the real desync is (a) a stored targetValues that disagrees
 *    with the op-derived landings, (b) a chained op whose startValue ≠ the previous
 *    op's landing (the intermediate is mis-anchored), or (c) a landing that falls
 *    off [min,max] (the correct endpoint is never on the rendered line).
 *  - order_values (:608-617): the component SORTS `targets` ascending itself
 *    (:613) and compares to the placed order — it ships NO answer key, so nothing
 *    can desync. The oracle guards the STIMULUS instead: ≥2 distinct integer
 *    targets in [min,max] (a duplicate value makes the ordered target non-unique —
 *    a degenerate task, the comparison-builder 'order' class).
 *  - find_between (:619-627): correct iff the placed point is STRICTLY between
 *    min(targets) and max(targets) (:621-624). So the two bounds must be
 *    well-formed (lo < hi), both inside [min,max] (else a bound is off the line),
 *    and far enough apart that a snap-representable value lies strictly between
 *    them (else no placement can ever satisfy lo < p < hi — an unreachable range).
 *
 * THE INDEPENDENCE RULE: the oracle never reads targetValues as truth for the
 * jump-bearing mode. It recomputes each op's landing from op.startValue ±
 * op.changeValue (the same arithmetic the component's expected uses), walks the
 * chain, and checks (i) the walk stays on [min,max], (ii) each chained op is
 * anchored on the previous landing, and (iii) the stored targetValues equals the
 * sequence of recomputed landings. For find_between it re-derives lo/hi from the
 * two bounds and re-derives the snap precision from numberType (mirroring
 * getSnapPrecision) to prove a strictly-between value exists — it never trusts the
 * pair as its own proof. A generator that stored a landing that doesn't equal
 * start±change, a chained op off its anchor, or a collapsed bound pair can no
 * longer false-pass.
 *
 * Checks:
 *  - answer-key-desync : show_jump — every op landing == start±change AND lies in
 *    [min,max]; chained op anchored on the previous landing; targetValues equals
 *    the recomputed landings; operations non-empty (else ungradable). plot_point /
 *    order_values — every target inside [min,max] (a target off the line is
 *    unreachable). find_between — lo < hi, both in [min,max], and a
 *    snap-representable value lies strictly between (else no placement satisfies
 *    lo < p < hi).
 *  - scope             : every value the student reads OR produces (jump starts +
 *    landings, plot/order/between targets) honors the objective ceiling, and the
 *    rendered line itself does not extend past an EXPLICIT ceiling ("Counting to
 *    10" must not render a 0–20 line). Ceiling = ctx.scopeMax ?? topic ceiling ??
 *    the line's own range.max (a natural ceiling — the generator sized the line to
 *    the scope, so only an explicit topic/harness ceiling can bite).
 *  - clustering        : within a mode the produced answers spread (no "every
 *    jump lands on 9", "every plot is 12"), and no exact-duplicate card (same
 *    start|op|change, same target, same ordered set, or same bound pair twice).
 *  - schema            : per-type required fields present + numeric; integer
 *    targets when numberType is integer; ≥3 challenges (mastery-over-demo).
 *
 * Deliberately NOT checked: answer-leak. The manipulative IS the stimulus made
 * visible — plot states the target the student must find (by design, the task),
 * show_jump states the start + operation, order lists the values to arrange, and
 * find_between names the two bounds. Every "answer" surface is the intended
 * stimulus, so a leak test would fire on the task itself, worse than an honest
 * gap. Leak/pedagogy stays with /eval-test.
 */

const KNOWN_TYPES = new Set(['plot_point', 'show_jump', 'order_values', 'find_between']);
const OP_TYPES = new Set(['add', 'subtract']);
const EPS = 1e-9;

/** Mirrors the component's getSnapPrecision (NumberLine.tsx:165-169). */
function snapPrecisionFor(numberType: string): number {
  if (numberType === 'integer') return 1;
  if (numberType === 'decimal') return 0.01;
  return 1 / 8; // fraction, mixed
}

function isInt(v: unknown): v is number {
  return Number.isInteger(v);
}
function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export const numberLineOracle: ContentOracle = {
  componentId: 'number-line',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    // Line geometry — the rendered bounds are what every reachability check reads.
    const range = (data.range as Record<string, unknown> | undefined) ?? {};
    const rangeMin = isNum(range.min) ? (range.min as number) : 0;
    const rangeMax = isNum(range.max) ? (range.max as number) : 0;
    const numberType = String(data.numberType ?? 'integer');
    const precision = snapPrecisionFor(numberType);
    const inRange = (v: number) => v >= rangeMin - EPS && v <= rangeMax + EPS;

    if (rangeMax <= rangeMin) {
      violations.push({
        check: 'schema',
        where: 'range',
        detail: `degenerate line range {min:${rangeMin}, max:${rangeMax}} — no positions to place`,
      });
    }

    // Objective ceiling on MAGNITUDE. An explicit harness/topic ceiling can bite;
    // otherwise the line's own max is the natural ceiling (targets past it are
    // caught by reachability, not scope).
    const explicitCeiling = ctx.scopeMax ?? parseScopeCeiling(ctx.topic);
    const ceiling = explicitCeiling ?? rangeMax;
    // The rendered line must not extend past an explicit objective ceiling.
    if (explicitCeiling !== undefined && rangeMax > explicitCeiling) {
      violations.push({
        check: 'scope',
        where: 'range',
        detail: `line renders to ${rangeMax} but the objective ceiling is ${explicitCeiling} (topic "${ctx.topic}") — the line extends past scope`,
      });
    }

    if (challenges.length < 3) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3-6+`,
      });
    }

    // Per-type answer buckets for variety, and a global duplicate-card map.
    const derivedByType: Record<string, Array<string | number>> = {
      plot_point: [],
      show_jump: [],
      order_values: [],
      find_between: [],
    };
    const cardSeen = new Map<string, number>();
    let checked = 0;

    const scopeCheck = (vals: number[], where: string, noun: string) => {
      const over = vals.find((v) => Math.abs(v) > ceiling + EPS);
      if (over !== undefined) {
        violations.push({
          check: 'scope',
          where,
          detail: `${noun} ${over} exceeds objective ceiling ${ceiling} (topic "${ctx.topic}")`,
        });
      }
    };

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const id = String(c.id ?? `#${i + 1}`);
      const type = String(c.type ?? '');
      if (!KNOWN_TYPES.has(type)) {
        uncheckedTypes.add(type || '(missing type)');
        continue;
      }

      const targets = Array.isArray(c.targetValues) ? (c.targetValues as unknown[]) : null;

      // ── show_jump: the operations array IS the answer key ──
      if (type === 'show_jump') {
        const ops = Array.isArray(c.operations) ? (c.operations as Array<Record<string, unknown>>) : null;
        if (!ops || ops.length === 0) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `show_jump has no operations — the component grades against operations (NumberLine.tsx:588-599), so the challenge is ungradable`,
          });
          continue;
        }
        // Every op must carry numeric start + change and a valid op type.
        const badOp = ops.find((o) => !isNum(o.startValue) || !isNum(o.changeValue) || !OP_TYPES.has(String(o.type)));
        if (badOp) {
          violations.push({
            check: 'schema',
            where: id,
            detail: `an operation is malformed (need type∈{add,subtract} + numeric startValue/changeValue): ${JSON.stringify(badOp)}`,
          });
          continue;
        }
        checked++;

        // ── Independence: recompute each landing from start ± change; walk the chain. ──
        const landings: number[] = [];
        const scopeVals: number[] = [];
        for (let k = 0; k < ops.length; k++) {
          const o = ops[k];
          const start = o.startValue as number;
          const change = o.changeValue as number;
          const landing = String(o.type) === 'add' ? start + change : start - change;
          landings.push(landing);
          scopeVals.push(start, landing);

          // Reachability: the landing must be on the rendered line.
          if (!inRange(landing)) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `op ${k} (${o.type} ${change} from ${start}) lands on ${landing}, outside the line [${rangeMin},${rangeMax}] — the correct endpoint is never on screen`,
            });
          }
          // Chain continuity: a chained op must begin where the previous op landed.
          if (k > 0 && Math.abs(start - landings[k - 1]) > EPS) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `chained op ${k} starts at ${start}, but the previous op landed on ${landings[k - 1]} — the intermediate step is mis-anchored`,
            });
          }
        }

        // Desync: the stored targetValues must equal the recomputed landings.
        if (!targets || targets.length !== landings.length || !targets.every((t, k) => isNum(t) && Math.abs((t as number) - landings[k]) <= EPS)) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `targetValues ${JSON.stringify(c.targetValues)} disagrees with the op-derived landings ${JSON.stringify(landings)} — the stored answer contradicts start±change`,
          });
        }

        scopeCheck(scopeVals, id, 'jump value');

        const finalLanding = landings[landings.length - 1];
        derivedByType.show_jump.push(finalLanding);
        bump(cardSeen, `jump|${ops.map((o) => `${o.startValue}${String(o.type) === 'add' ? '+' : '-'}${o.changeValue}`).join('>')}`);
        continue;
      }

      // The remaining three types are targetValues-driven.
      if (!targets || targets.length === 0 || !targets.every(isNum)) {
        violations.push({
          check: 'schema',
          where: id,
          detail: `${type} needs a non-empty numeric targetValues; got ${JSON.stringify(c.targetValues)}`,
        });
        continue;
      }
      const tv = targets as number[];
      if (numberType === 'integer' && !tv.every(isInt)) {
        violations.push({
          check: 'schema',
          where: id,
          detail: `numberType is integer but targetValues ${JSON.stringify(tv)} has a non-integer`,
        });
      }

      if (type === 'plot_point') {
        checked++;
        // Reachability: the target must sit on the rendered line.
        for (const t of tv) {
          if (!inRange(t)) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `plot target ${t} is outside the line [${rangeMin},${rangeMax}] — the pad clamps placements into range, so a correct plot is impossible`,
            });
          }
        }
        scopeCheck(tv, id, 'plot target');
        derivedByType.plot_point.push(tv[0]);
        bump(cardSeen, `plot|${tv.join(',')}`);
        continue;
      }

      if (type === 'order_values') {
        if (tv.length < 2) {
          violations.push({ check: 'schema', where: id, detail: `order_values needs ≥2 values; got ${JSON.stringify(tv)}` });
          continue;
        }
        checked++;
        // A repeated value makes the ordered target non-unique — degenerate task.
        if (new Set(tv).size !== tv.length) {
          violations.push({ check: 'schema', where: id, detail: `duplicate values in ${JSON.stringify(tv)} — the ordered answer is not unique` });
        }
        // Reachability: every value must sit on the rendered line.
        for (const t of tv) {
          if (!inRange(t)) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `order value ${t} is outside the line [${rangeMin},${rangeMax}] — it can never be placed`,
            });
          }
        }
        scopeCheck(tv, id, 'order value');
        derivedByType.order_values.push([...tv].sort((a, b) => a - b).join(','));
        bump(cardSeen, `order|${[...tv].sort((a, b) => a - b).join(',')}`);
        continue;
      }

      // find_between
      {
        if (tv.length < 2) {
          violations.push({ check: 'schema', where: id, detail: `find_between needs 2 bounds; got ${JSON.stringify(tv)}` });
          continue;
        }
        checked++;
        const lo = Math.min(...tv);
        const hi = Math.max(...tv);
        // Well-formed: distinct bounds.
        if (hi - lo <= EPS) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `find_between bounds ${JSON.stringify(tv)} collapse (lo=hi=${lo}) — no value lies strictly between`,
          });
        } else {
          // Both bounds must be on the rendered line.
          if (!inRange(lo) || !inRange(hi)) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `find_between bounds [${lo},${hi}] fall outside the line [${rangeMin},${rangeMax}] — a bound is off screen and the range is unreachable`,
            });
          }
          // A snap-representable value must lie STRICTLY between the bounds, else no
          // placement can ever satisfy lo < p < hi (mirrors getSnapPrecision).
          if (hi - lo <= precision + EPS) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `find_between bounds [${lo},${hi}] are within one snap step (${precision}) for numberType ${numberType} — no placeable value lies strictly between them`,
            });
          }
        }
        scopeCheck(tv, id, 'find_between bound');
        derivedByType.find_between.push(`${lo}-${hi}`);
        bump(cardSeen, `between|${lo}-${hi}`);
      }
    }

    // ── clustering: within each mode the produced answers must spread ──
    for (const [t, values] of Object.entries(derivedByType)) {
      const variety = checkAnswerVariety(values, `${t}[].answer`);
      if (variety) violations.push(variety);
    }
    // ── clustering: no exact-duplicate card ──
    cardSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({ check: 'clustering', where: 'challenges[]', detail: `identical card "${key}" appears ${count}× — a duplicated challenge` });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}
