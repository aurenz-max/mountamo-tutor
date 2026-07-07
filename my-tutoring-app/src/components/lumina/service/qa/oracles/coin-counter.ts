import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, parseScopeCeiling } from './helpers';

/**
 * Coin-counter oracle — a CALCULATION oracle over U.S. coin arithmetic. Where
 * math-fact-fluency re-derives op1(+|-)op2, this one re-derives the CENTS: the
 * expected answer is the SUM of coin denomination values, computed
 * INDEPENDENTLY from the raw {type,count} coin defs, never by trusting the
 * shipped `correctTotal` / `correctChange` / `correctGroup` the generator wrote.
 *
 * The component (CoinCounter.tsx) judges correctness per challenge type:
 *  - count       (L383): `answer === correctTotal`      — correctTotal is the ¢ key.
 *  - compare     (L436): `selectedGroup === correctGroup`— A|B|equal by group totals.
 *  - make-change (L466): `answer === correctChange`      — paidAmount − itemCost.
 *  - make-amount (L411): `placedSum === targetAmount`    — target IS the key; the
 *    student must build it exactly, so the target must be REACHABLE from the
 *    availableCoins denominations (unlimited supply) or it is unsatisfiable.
 *  - identify    (L354): `selectedCoin === targetCoin`   — targetCoin is arbitrary
 *    (which coin to name), so there is nothing to re-derive; the contract is
 *    OPTION INTEGRITY — the selectable `options` must contain targetCoin exactly
 *    once, else the student literally cannot pick the right answer.
 *
 * The coin denomination table (penny=1 … dollar=100) is a domain FACT, not the
 * generator's answer computation — restating it here does not break independence;
 * the re-derivation (summing the defs ourselves, running the group comparison,
 * subtracting for change, DP-reachability for make-amount) is what the generator
 * is checked against.
 *
 * Checks:
 *  - answer-key-desync : correctTotal must equal Σ displayedCoins; correctGroup
 *    must equal the sign of (ΣgroupA − ΣgroupB); correctChange must equal
 *    paid − cost; make-amount target must be reachable from availableCoins;
 *    identify options must hold targetCoin exactly once and be unique valid coins.
 *  - scope             : every amount (total / target / paid / cost / change) and
 *    every coin denomination in play within [0, ceiling]; change strictly > 0.
 *  - clustering        : answers must spread PER TYPE (no "every count is 25¢",
 *    no "always Group A"), and no exact-duplicate challenge (same type + same
 *    full task identity — the student would see a byte-identical card twice).
 *
 * Deliberately NOT checked: answer-leak. In this primitive the answer legitimately
 * lives in the prompt BY DESIGN — identify says "Which coin is the nickel?",
 * make-change states both amounts that determine the difference, count/make-amount
 * often narrate the coins in the instruction. A whole-number/word leak test would
 * false-positive on nearly every challenge and route phantom bugs to /eval-fix —
 * worse than an honest gap. Instruction quality stays with /eval-test.
 */

const COIN_VALUES: Record<string, number> = {
  penny: 1,
  nickel: 5,
  dime: 10,
  quarter: 25,
  'half-dollar': 50,
  dollar: 100,
};

const KNOWN_TYPES = new Set(['identify', 'count', 'make-amount', 'compare', 'make-change']);

/** Parse an untrusted {type,count}[] into denominations, or report why it can't. */
function readCoinDefs(v: unknown): { defs: Array<{ type: string; count: number }>; error?: string } {
  if (!Array.isArray(v)) return { defs: [], error: 'not an array' };
  const defs: Array<{ type: string; count: number }> = [];
  for (const item of v) {
    if (typeof item !== 'object' || item === null) return { defs: [], error: `non-object def ${JSON.stringify(item)}` };
    const rec = item as Record<string, unknown>;
    const type = String(rec.type ?? '');
    const count = rec.count;
    if (!(type in COIN_VALUES)) return { defs: [], error: `unknown coin type "${type}"` };
    if (!Number.isInteger(count) || (count as number) <= 0) return { defs: [], error: `bad count ${JSON.stringify(count)} for ${type}` };
    defs.push({ type, count: count as number });
  }
  return { defs };
}

/** Independent sum: Σ value(type) × count. */
function sumCoinDefs(defs: Array<{ type: string; count: number }>): number {
  return defs.reduce((s, d) => s + COIN_VALUES[d.type] * d.count, 0);
}

/** Canonical, order-insensitive signature of a coin set (for dup detection). */
function coinSig(defs: Array<{ type: string; count: number }>): string {
  return defs.map((d) => `${d.type}:${d.count}`).sort().join('+');
}

/** DP reachability: can `target` cents be formed from unlimited `denoms`? */
function isReachable(target: number, denoms: number[]): boolean {
  if (target === 0) return true;
  if (target < 0 || denoms.length === 0) return false;
  const reach = new Array<boolean>(target + 1).fill(false);
  reach[0] = true;
  for (const d of denoms) {
    if (d <= 0) continue;
    for (let a = d; a <= target; a++) {
      if (reach[a - d]) reach[a] = true;
    }
  }
  return reach[target];
}

export const coinCounterOracle: ContentOracle = {
  componentId: 'coin-counter',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    // Objective ceiling wins when the topic/harness carries one; else fall back
    // to the primitive's intrinsic ceiling (a dollar = 100¢, the largest coin).
    const ceiling = ctx.scopeMax ?? parseScopeCeiling(ctx.topic) ?? 100;

    if (challenges.length < 3) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3-6+`,
      });
    }

    // Per-type answer pools for clustering, keyed by type so a "always Group A"
    // in compare isn't masked by variety across count totals.
    const answersByType = new Map<string, string[]>();
    const pushAnswer = (type: string, val: string | number) => {
      const arr = answersByType.get(type) ?? [];
      arr.push(String(val));
      answersByType.set(type, arr);
    };
    // Exact-duplicate detection keyed on FULL task identity (not answer alone).
    const taskSeen = new Map<string, number>();
    let checked = 0;

    // Scope helper — flag an amount outside [0, ceiling].
    const checkAmount = (label: string, val: number, where: string) => {
      if (val > ceiling || val < 0) {
        violations.push({
          check: 'scope',
          where,
          detail: `${label} ${val}¢ outside [0, ${ceiling}] (topic "${ctx.topic}")`,
        });
      }
    };
    // Scope helper — flag any coin denomination above the ceiling.
    const checkDenoms = (defs: Array<{ type: string; count: number }>, where: string) => {
      for (const d of defs) {
        if (COIN_VALUES[d.type] > ceiling) {
          violations.push({
            check: 'scope',
            where,
            detail: `coin "${d.type}" (${COIN_VALUES[d.type]}¢) exceeds objective ceiling ${ceiling} (topic "${ctx.topic}")`,
          });
        }
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

      switch (type) {
        case 'count': {
          const { defs, error } = readCoinDefs(c.displayedCoins);
          if (error || defs.length === 0) {
            violations.push({ check: 'schema', where, detail: `displayedCoins invalid: ${error ?? 'empty'}` });
            break;
          }
          checked++;
          const expected = sumCoinDefs(defs);
          if (c.correctTotal !== expected) {
            violations.push({
              check: 'answer-key-desync',
              where,
              detail: `shipped correctTotal ${JSON.stringify(c.correctTotal)} but Σ(${coinSig(defs)}) = ${expected}¢`,
            });
          }
          checkAmount('correctTotal', expected, where);
          checkDenoms(defs, where);
          pushAnswer('count', expected);
          taskSeen.set(`count|${coinSig(defs)}`, (taskSeen.get(`count|${coinSig(defs)}`) ?? 0) + 1);
          break;
        }

        case 'compare': {
          const a = readCoinDefs(c.groupA);
          const b = readCoinDefs(c.groupB);
          if (a.error || b.error || a.defs.length === 0 || b.defs.length === 0) {
            violations.push({ check: 'schema', where, detail: `group defs invalid: A=${a.error ?? 'ok'} B=${b.error ?? 'ok'}` });
            break;
          }
          checked++;
          const totalA = sumCoinDefs(a.defs);
          const totalB = sumCoinDefs(b.defs);
          const expectedGroup = totalA > totalB ? 'A' : totalB > totalA ? 'B' : 'equal';
          if (c.correctGroup !== expectedGroup) {
            violations.push({
              check: 'answer-key-desync',
              where,
              detail: `shipped correctGroup ${JSON.stringify(c.correctGroup)} but A=${totalA}¢ vs B=${totalB}¢ → "${expectedGroup}"`,
            });
          }
          checkAmount('groupA total', totalA, where);
          checkAmount('groupB total', totalB, where);
          checkDenoms(a.defs, where);
          checkDenoms(b.defs, where);
          pushAnswer('compare', expectedGroup);
          const cmpKey = `compare|A=${coinSig(a.defs)}|B=${coinSig(b.defs)}`;
          taskSeen.set(cmpKey, (taskSeen.get(cmpKey) ?? 0) + 1);
          break;
        }

        case 'make-change': {
          const paid = c.paidAmount;
          const cost = c.itemCost;
          if (!Number.isInteger(paid) || !Number.isInteger(cost)) {
            violations.push({ check: 'schema', where, detail: `paidAmount/itemCost not integers: paid=${JSON.stringify(paid)} cost=${JSON.stringify(cost)}` });
            break;
          }
          checked++;
          const p = paid as number;
          const k = cost as number;
          const expectedChange = p - k;
          if (c.correctChange !== expectedChange) {
            violations.push({
              check: 'answer-key-desync',
              where,
              detail: `shipped correctChange ${JSON.stringify(c.correctChange)} but ${p} − ${k} = ${expectedChange}`,
            });
          }
          if (expectedChange <= 0) {
            violations.push({
              check: 'scope',
              where,
              detail: `paid ${p}¢ ≤ cost ${k}¢ — change ${expectedChange}¢ is not positive (unsolvable purchase)`,
            });
          }
          checkAmount('paidAmount', p, where);
          checkAmount('itemCost', k, where);
          checkAmount('correctChange', expectedChange, where);
          pushAnswer('make-change', expectedChange);
          taskSeen.set(`make-change|${p}-${k}`, (taskSeen.get(`make-change|${p}-${k}`) ?? 0) + 1);
          break;
        }

        case 'make-amount': {
          const target = c.targetAmount;
          if (!Number.isInteger(target) || (target as number) <= 0) {
            violations.push({ check: 'schema', where, detail: `targetAmount invalid: ${JSON.stringify(target)}` });
            break;
          }
          const avail = Array.isArray(c.availableCoins) ? (c.availableCoins as unknown[]).map(String) : [];
          const badCoin = avail.find((t) => !(t in COIN_VALUES));
          if (avail.length === 0 || badCoin) {
            violations.push({ check: 'schema', where, detail: `availableCoins invalid: [${avail.join(', ')}]${badCoin ? ` (unknown "${badCoin}")` : ''}` });
            break;
          }
          checked++;
          const t = target as number;
          const denoms = avail.map((x) => COIN_VALUES[x]);
          // The target IS the answer key; if it can't be built from the offered
          // coins the student can never satisfy placedSum === target.
          if (!isReachable(t, denoms)) {
            violations.push({
              check: 'answer-key-desync',
              where,
              detail: `targetAmount ${t}¢ is NOT reachable from availableCoins [${avail.join(', ')}] (denoms ${denoms.join(',')}¢) — unsatisfiable`,
            });
          }
          checkAmount('targetAmount', t, where);
          const availDenomDefs = avail.map((type) => ({ type, count: 1 }));
          checkDenoms(availDenomDefs, where);
          pushAnswer('make-amount', t);
          const maKey = `make-amount|${t}|${[...avail].sort().join('+')}`;
          taskSeen.set(maKey, (taskSeen.get(maKey) ?? 0) + 1);
          break;
        }

        case 'identify': {
          const targetCoin = String(c.targetCoin ?? '');
          const options = Array.isArray(c.options) ? (c.options as unknown[]).map(String) : [];
          if (!(targetCoin in COIN_VALUES)) {
            violations.push({ check: 'schema', where, detail: `targetCoin "${targetCoin}" is not a valid coin` });
            break;
          }
          if (options.length === 0) {
            violations.push({ check: 'schema', where, detail: 'no options — student has nothing to select' });
            break;
          }
          checked++;
          const badOpt = options.find((o) => !(o in COIN_VALUES));
          if (badOpt) {
            violations.push({ check: 'schema', where, detail: `option "${badOpt}" is not a valid coin: [${options.join(', ')}]` });
          }
          // Option integrity IS the identify answer key (component grades
          // selectedCoin === targetCoin, and only options are selectable).
          const hits = options.filter((o) => o === targetCoin).length;
          if (hits === 0) {
            violations.push({
              check: 'answer-key-desync',
              where,
              detail: `targetCoin "${targetCoin}" is not among selectable options [${options.join(', ')}] — the correct answer cannot be picked`,
            });
          } else if (hits > 1) {
            violations.push({
              check: 'answer-key-desync',
              where,
              detail: `targetCoin "${targetCoin}" appears ${hits}× in options [${options.join(', ')}]`,
            });
          }
          if (new Set(options).size !== options.length) {
            violations.push({ check: 'schema', where, detail: `duplicate options: [${options.join(', ')}]` });
          }
          checkDenoms([{ type: targetCoin, count: 1 }], where);
          pushAnswer('identify', targetCoin);
          const idKey = `identify|target=${targetCoin}|opts=${[...options].sort().join('+')}`;
          taskSeen.set(idKey, (taskSeen.get(idKey) ?? 0) + 1);
          break;
        }
      }
    }

    // ── clustering: answers spread within each type ──
    answersByType.forEach((vals, type) => {
      const variety = checkAnswerVariety(vals, `challenges[type=${type}].answer`);
      if (variety) violations.push(variety);
    });
    // ── clustering: no byte-identical challenge card ──
    taskSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({ check: 'clustering', where: 'challenges[]', detail: `identical challenge "${key}" appears ${count}× — a duplicated card` });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
