import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, parseScopeCeiling } from './helpers';

/**
 * Number-bond oracle — a pure-CALCULATION oracle for part-part-whole content.
 * Where math-fact-fluency re-derives `op1 (+|-) op2`, this one re-derives the
 * part-whole invariant `part1 + part2 = whole` and the per-type answer key the
 * COMPONENT computes from {whole, part1, part2} — never by trusting the shipped
 * `allPairs` / `factFamily` / `targetEquation` strings the generator wrote.
 *
 * How NumberBond.tsx judges each type (the contract this oracle mirrors):
 *  - decompose (handleSubmitPair, ~L636 + completion `newPairs.length >=
 *    allPairs.length`): the answer key is `allPairs` — the set of ALL unique
 *    pairs [a,b] with a+b=whole and a<=b. Parts stay null (student discovers).
 *  - missing-part (handleCheckMissingPart, ~L696): `expected = part1 == null
 *    ? whole - part2 : whole - part1`. Exactly ONE part is the shown/known part;
 *    the other MUST be null or the diagram (showLeft/showRight) renders the
 *    answer on screen.
 *  - fact-family (handleCheckFactFamily, ~L737): correctness is computed from
 *    `factFamilyCanonicalKeys(whole, part1, part2)` — the component does NOT read
 *    the shipped `factFamily` strings to grade. So the load-bearing key is simply
 *    `part1 + part2 === whole`; the shipped `factFamily` array is a display
 *    artifact that must still reconstruct to that same 3-key set.
 *  - build-equation (handleCheckEquation, ~L830): correct = the built equation is
 *    valid AND uses exactly {whole, part1, part2} (ANY valid form accepted). The
 *    shipped `targetEquation` is the easy-tier model answer and must itself be a
 *    valid form over those three numbers.
 *
 * Independence: this oracle recomputes the expected pair set and the arithmetic
 * of every equation string with its OWN parser (`parseEq` below), from the raw
 * operands — it never trusts a shipped result. A shared wrong assumption would
 * false-pass, which is worse than no oracle.
 *
 * Checks:
 *  - answer-key-desync : decompose `allPairs` must equal the independently
 *    recomputed complete pair set; missing-part must expose exactly one known
 *    part in [0, whole] (both-set reveals the answer, both-null breaks the key);
 *    fact-family/build-equation must satisfy part1+part2=whole with parts in
 *    range, and the shipped factFamily/targetEquation strings must reconstruct
 *    to valid facts over exactly {whole,part1,part2}.
 *  - scope             : every whole, part, pair value, and the missing value
 *    within [0, ceiling]; maxNumber must not exceed the objective ceiling.
 *  - clustering        : answers spread (checkAnswerVariety over the per-challenge
 *    salient value — the missing part for missing-part, else the whole), and no
 *    exact-duplicate challenge keyed on FULL task identity (type + bond + the
 *    field that distinguishes the card), never the whole alone.
 *
 * Deliberately NOT checked: answer-leak. By design the instruction MUST name the
 * `whole` (generator requirement #11), missing-part names the known part, and
 * fact-family/build-equation name both parts ("write all 4 equations for parts 2
 * and 4"). A whole-number leak test would fire on that intentional structure and
 * route phantom bugs to /eval-fix — worse than an honest gap. Instruction quality
 * stays with /eval-test.
 */

const KNOWN_TYPES = new Set(['decompose', 'missing-part', 'fact-family', 'build-equation']);

interface ParsedEq {
  left: number;
  op: '+' | '-';
  right: number;
  result: number;
}

/**
 * Independent equation parser — accepts "a op b = c" and "c = a op b" (both `=`
 * directions), whitespace-insensitive. Deliberately re-implemented here rather
 * than imported from the component so the oracle and the shipped judge cannot
 * share a parsing bug.
 */
function parseEq(input: string): ParsedEq | null {
  const s = String(input).replace(/\s+/g, '');
  if (!s) return null;
  let m = s.match(/^(\d+)([+\-])(\d+)=(\d+)$/);
  if (m) {
    return { left: +m[1], op: m[2] as '+' | '-', right: +m[3], result: +m[4] };
  }
  m = s.match(/^(\d+)=(\d+)([+\-])(\d+)$/);
  if (m) {
    return { result: +m[1], left: +m[2], op: m[3] as '+' | '-', right: +m[4] };
  }
  return null;
}

/** True when the equation's arithmetic checks out, recomputed from the operands. */
function eqMathValid(p: ParsedEq): boolean {
  return p.op === '+' ? p.left + p.right === p.result : p.left - p.right === p.result;
}

/** The equation uses exactly the multiset {a, b, c} — order/operator agnostic. */
function eqUsesNumbers(p: ParsedEq, a: number, b: number, c: number): boolean {
  const got = [p.left, p.right, p.result].sort((x, y) => x - y);
  const want = [a, b, c].sort((x, y) => x - y);
  return got[0] === want[0] && got[1] === want[1] && got[2] === want[2];
}

/** Canonical dedup key for a valid equation, mirroring the component's form. */
function canonicalKey(p: ParsedEq): string {
  return p.op === '+'
    ? `${Math.min(p.left, p.right)}+${Math.max(p.left, p.right)}=${p.result}`
    : `${p.left}-${p.right}=${p.result}`;
}

/** Independently recompute the expected fact-family canonical key set. */
function expectedFamilyKeys(whole: number, p1: number, p2: number): Set<string> {
  const min = Math.min(p1, p2);
  const max = Math.max(p1, p2);
  return new Set([
    `${min}+${max}=${whole}`,
    `${whole}-${min}=${max}`,
    `${whole}-${max}=${min}`,
  ]);
}

/** Independently recompute the complete decompose pair set [a, whole-a], a<=b. */
function expectedPairs(whole: number): string[] {
  const out: string[] = [];
  for (let a = 0; a <= Math.floor(whole / 2); a++) out.push(`${a},${whole - a}`);
  return out;
}

function isInt(v: unknown): v is number {
  return Number.isInteger(v);
}

export const numberBondOracle: ContentOracle = {
  componentId: 'number-bond',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    const maxNumber = isInt(data.maxNumber) ? (data.maxNumber as number) : undefined;
    // Objective ceiling wins when the topic/harness carries one; else fall back to
    // the generator's declared frame (maxNumber), else the primitive's intrinsic
    // Grade-1 max (10).
    const ceiling = ctx.scopeMax ?? parseScopeCeiling(ctx.topic) ?? maxNumber ?? 10;

    // A frame WIDER than the objective is itself a scope miss ("bonds to 5" →
    // maxNumber 10).
    if (maxNumber !== undefined && maxNumber > ceiling) {
      violations.push({
        check: 'scope',
        where: 'maxNumber',
        detail: `maxNumber ${maxNumber} exceeds objective ceiling ${ceiling} (topic "${ctx.topic}")`,
      });
    }

    if (challenges.length < 3) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3-6+`,
      });
    }

    // Per-challenge salient answer value for the clustering spread.
    const varietyValues: number[] = [];
    // Exact-duplicate keyed on FULL task identity, never the whole alone: the same
    // whole shown as a different type or with a different known part / target is
    // legitimate practice, not a repeated card.
    const taskSeen = new Map<string, number>();
    let checked = 0;

    const flagScope = (where: string, label: string, val: number) => {
      if (val > ceiling || val < 0) {
        violations.push({
          check: 'scope',
          where,
          detail: `${label} ${val} outside [0, ${ceiling}] (topic "${ctx.topic}", maxNumber ${maxNumber ?? 'n/a'})`,
        });
      }
    };

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const type = String(c.type ?? '');
      const id = String(c.id ?? `#${i + 1}`);
      const where = `${id}(${type})`;

      if (!KNOWN_TYPES.has(type)) {
        uncheckedTypes.add(type);
        continue;
      }

      const whole = c.whole;
      if (!isInt(whole)) {
        violations.push({ check: 'schema', where, detail: `whole is not an integer: ${JSON.stringify(whole)}` });
        continue;
      }
      const w = whole as number;
      checked++;
      flagScope(where, 'whole', w);

      const part1 = c.part1;
      const part2 = c.part2;

      if (type === 'decompose') {
        // ── Independence: recompute the full pair set, never trust c.allPairs ──
        const want = expectedPairs(w);
        const rawPairs = Array.isArray(c.allPairs) ? (c.allPairs as unknown[]) : null;
        if (!rawPairs) {
          violations.push({ check: 'answer-key-desync', where, detail: `decompose has no allPairs array` });
        } else {
          const got: string[] = [];
          let malformed = false;
          for (const p of rawPairs) {
            if (!Array.isArray(p) || p.length !== 2 || !isInt(p[0]) || !isInt(p[1])) { malformed = true; continue; }
            const a = p[0] as number;
            const b = p[1] as number;
            got.push(`${a},${b}`);
            flagScope(where, 'pair value', a);
            flagScope(where, 'pair value', b);
            if (a + b !== w) {
              violations.push({ check: 'answer-key-desync', where, detail: `pair [${a}, ${b}] does not sum to whole ${w}` });
            }
            if (a > b) {
              violations.push({ check: 'answer-key-desync', where, detail: `pair [${a}, ${b}] not in canonical a<=b order` });
            }
          }
          if (malformed) {
            violations.push({ check: 'schema', where, detail: `allPairs contains a malformed entry: ${JSON.stringify(rawPairs)}` });
          }
          const gotSet = new Set(got);
          if (gotSet.size !== got.length) {
            violations.push({ check: 'answer-key-desync', where, detail: `allPairs contains duplicate pairs: [${got.join(' | ')}]` });
          }
          const wantSet = new Set(want);
          const missing = want.filter((p) => !gotSet.has(p));
          const extra = got.filter((p) => !wantSet.has(p));
          if (missing.length > 0 || extra.length > 0) {
            violations.push({
              check: 'answer-key-desync',
              where,
              detail: `allPairs incomplete/incorrect for whole ${w}: expected [${want.join(' | ')}], `
                + `missing [${missing.join(' | ')}], extra [${extra.join(' | ')}]`,
            });
          }
        }
        varietyValues.push(w);
        taskSeen.set(`decompose|${w}`, (taskSeen.get(`decompose|${w}`) ?? 0) + 1);
        continue;
      }

      if (type === 'missing-part') {
        // ── Exactly one known part; the other MUST be null or the answer renders ──
        const p1Known = part1 != null;
        const p2Known = part2 != null;
        if (p1Known && p2Known) {
          violations.push({
            check: 'answer-key-desync',
            where,
            detail: `both parts are given (${part1}, ${part2}) — the missing-part answer is rendered on screen`,
          });
        } else if (!p1Known && !p2Known) {
          violations.push({ check: 'schema', where, detail: `missing-part has no known part (both null)` });
        }
        // The component computes: expected = part1==null ? whole-part2 : whole-part1.
        const known = p1Known ? part1 : part2;
        if (known != null && !isInt(known)) {
          violations.push({ check: 'schema', where, detail: `known part is not an integer: ${JSON.stringify(known)}` });
        } else if (isInt(known)) {
          const k = known as number;
          flagScope(where, 'known part', k);
          const missingVal = w - k;
          if (k < 0 || k > w) {
            violations.push({
              check: 'answer-key-desync',
              where,
              detail: `known part ${k} outside [0, ${w}] — missing part ${missingVal} is not a valid part of ${w}`,
            });
          }
          flagScope(where, 'missing part', missingVal);
          varietyValues.push(missingVal);
          taskSeen.set(`missing-part|${w}|${k}`, (taskSeen.get(`missing-part|${w}|${k}`) ?? 0) + 1);
        }
        continue;
      }

      // fact-family and build-equation both carry two known parts whose sum is the
      // load-bearing key the component recomputes.
      if (type === 'fact-family' || type === 'build-equation') {
        if (!isInt(part1) || !isInt(part2)) {
          violations.push({ check: 'schema', where, detail: `${type} needs integer part1/part2, got ${JSON.stringify(part1)} / ${JSON.stringify(part2)}` });
          continue;
        }
        const p1 = part1 as number;
        const p2 = part2 as number;
        flagScope(where, 'part1', p1);
        flagScope(where, 'part2', p2);
        // ── Independence: the invariant the component judges against ──
        if (p1 + p2 !== w) {
          violations.push({
            check: 'answer-key-desync',
            where,
            detail: `part1 + part2 ≠ whole: ${p1} + ${p2} = ${p1 + p2}, but whole is ${w}`,
          });
        }

        if (type === 'fact-family') {
          const shipped = Array.isArray(c.factFamily) ? (c.factFamily as unknown[]).map(String) : null;
          if (!shipped || shipped.length === 0) {
            violations.push({ check: 'answer-key-desync', where, detail: `fact-family has no factFamily array` });
          } else if (p1 + p2 === w) {
            // Only meaningful once the bond is self-consistent.
            const want = expectedFamilyKeys(w, p1, p2);
            const gotKeys = new Set<string>();
            for (const eqStr of shipped) {
              const p = parseEq(eqStr);
              if (!p) {
                violations.push({ check: 'answer-key-desync', where, detail: `factFamily entry "${eqStr}" is not a parseable equation` });
                continue;
              }
              if (!eqMathValid(p)) {
                violations.push({ check: 'answer-key-desync', where, detail: `factFamily entry "${eqStr}" is arithmetically wrong` });
                continue;
              }
              if (!eqUsesNumbers(p, w, p1, p2)) {
                violations.push({ check: 'answer-key-desync', where, detail: `factFamily entry "${eqStr}" does not use exactly {${w}, ${p1}, ${p2}}` });
                continue;
              }
              gotKeys.add(canonicalKey(p));
            }
            const missing = Array.from(want).filter((k) => !gotKeys.has(k));
            if (missing.length > 0) {
              violations.push({
                check: 'answer-key-desync',
                where,
                detail: `factFamily is missing the fact(s) [${missing.join(' | ')}] for bond ${w}=${p1}+${p2}`,
              });
            }
          }
          varietyValues.push(w);
          taskSeen.set(`fact-family|${w}|${Math.min(p1, p2)}`, (taskSeen.get(`fact-family|${w}|${Math.min(p1, p2)}`) ?? 0) + 1);
        } else {
          // build-equation: the shipped targetEquation must be a valid form.
          const target = c.targetEquation;
          if (typeof target !== 'string' || !target.trim()) {
            violations.push({ check: 'answer-key-desync', where, detail: `build-equation has no targetEquation string` });
          } else {
            const p = parseEq(target);
            if (!p) {
              violations.push({ check: 'answer-key-desync', where, detail: `targetEquation "${target}" is not a parseable equation` });
            } else if (!eqMathValid(p)) {
              violations.push({ check: 'answer-key-desync', where, detail: `targetEquation "${target}" is arithmetically wrong` });
            } else if (!eqUsesNumbers(p, w, p1, p2)) {
              violations.push({ check: 'answer-key-desync', where, detail: `targetEquation "${target}" does not use exactly {${w}, ${p1}, ${p2}}` });
            }
          }
          varietyValues.push(w);
          const tKey = String(c.targetEquation ?? '').replace(/\s+/g, '');
          taskSeen.set(`build-equation|${w}|${Math.min(p1, p2)}|${tKey}`, (taskSeen.get(`build-equation|${w}|${Math.min(p1, p2)}|${tKey}`) ?? 0) + 1);
        }
        continue;
      }
    }

    // ── clustering: answers spread, no byte-identical card ──
    const variety = checkAnswerVariety(varietyValues, 'challenges[] (missing part / whole)');
    if (variety) violations.push(variety);
    taskSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({ check: 'clustering', where: 'challenges[]', detail: `identical challenge "${key}" appears ${count}× — a duplicated card` });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
