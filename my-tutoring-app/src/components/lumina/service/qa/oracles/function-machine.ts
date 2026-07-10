import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, parseScopeCeiling } from './helpers';

/**
 * Function-machine oracle — a SOLVABILITY + MODE-IDENTITY oracle for the
 * function-machine family (observe / predict / discover_rule / create_rule).
 *
 * WHAT THE COMPONENT JUDGES (FunctionMachine.tsx):
 *  - It computes each output live from the per-challenge `rule` via evaluateRule
 *    (:99-111): the rule string has `x` substituted, is charset-gated to
 *    the arithmetic charset, `^`→`**`, then `new Function('return '+expr)()`; a
 *    non-number / non-finite result returns null.
 *  - observe/predict feed inputs one at a time; processValue (:397-441) returns
 *    EARLY when evaluateRule is null, so that input is silently NOT consumed —
 *    availableInputs never empties and the challenge can never complete. A null
 *    output is therefore an UNCOMPLETABLE challenge, not a mis-grade.
 *  - predict compares the typed number to the output (:415-420, |Δ|<0.01).
 *  - discover_rule/create_rule judge the typed rule with rulesEquivalent
 *    (:120-128) — functional equivalence over test inputs. The rule is the
 *    ANSWER and is displayed iff `showRule` (:607) — so for these modes
 *    `showRule` MUST be false or the answer sits on screen.
 *
 * Because the rule string IS the stored answer and every pair is computed FROM
 * it at render time, there is no separate numeric key to desync against — the
 * classic vocabulary-explorer desync cannot occur here. The failures that CAN
 * ship instead are: (a) a rule/input pair that evaluates to null → an
 * uncompletable challenge; (b) a `showRule` flag that contradicts the session
 * mode → the hidden answer revealed, or an observe/predict rule with nothing to
 * observe; (c) the hidden rule leaked into the title/description; (d) too few
 * distinct inputs for the hidden rule to be recoverable. Those are this oracle's
 * flagship checks.
 *
 * THE INDEPENDENCE RULE: the oracle re-derives every output with its OWN
 * shunting-yard evaluator (tokenize → RPN → evaluate), NOT the component's
 * `new Function` path and NOT the generator's own `ruleProducesCleanOutputs`
 * pre-filter. A rule the generator's filter wrongly passed (or a hand-authored
 * one) still gets re-checked from scratch.
 *
 * Checks:
 *  - answer-key-desync : every inputQueue value yields a FINITE output under the
 *    rule grammar (null/non-finite → the input silently drops → uncompletable);
 *    and for hidden-rule modes the shown pairs are non-degenerate (not all the
 *    same output → the rule would be ambiguous).
 *  - answer-leak       : discover_rule/create_rule only — the rule expression
 *    must not appear (spacing-insensitive) in the title/description, and
 *    `showRule` must be false (the rule on screen is the answer). observe/predict
 *    SHOW the rule by design, so a leak test there would fire on the intended
 *    stimulus — deliberately not run (mirrors number-sequencer's stance).
 *  - scope             : every input AND output honors the objective ceiling
 *    (ctx.scopeMax ?? topic ceiling ?? the gradeBand intrinsic).
 *  - clustering        : rules spread across challenges (no "every rule is x+1"),
 *    and no exact-duplicate rule (the generator picks DISTINCT rules).
 *  - schema            : ≥3 challenges (mastery-over-demo); each challenge has a
 *    non-empty rule string, a non-empty integer inputQueue, ≥2 DISTINCT inputs
 *    for hidden-rule modes (a 1-input table fits infinitely many rules), and the
 *    `showRule` flag matches the session mode.
 *
 * uncheckedTypes: any session challengeType outside the four known modes — the
 * solvability/scope/clustering checks still run, but the mode-identity and leak
 * checks are skipped and the type is recorded.
 */

const KNOWN_MODES = new Set(['observe', 'predict', 'discover_rule', 'create_rule']);
const HIDDEN_RULE_MODES = new Set(['discover_rule', 'create_rule']);

// Intrinsic output ceiling when neither the harness nor the topic names one — a
// touch above the generator's own |output|≤100 clamp so it only bites on a real
// runaway, widened for the advanced band's quadratics.
const INTRINSIC_BY_BAND: Record<string, number> = { '3-4': 100, '5': 200, advanced: 1000 };
const DEFAULT_INTRINSIC = 200;

// ---------------------------------------------------------------------------
// Independent evaluator — tokenize → shunting-yard RPN → evaluate.
// Deliberately NOT `new Function`: a genuinely different code path so a shared
// eval bug can't false-pass. Mirrors the component's grammar (x, digits,
// + - * / ^, parentheses; `^` is right-associative exponentiation) and its
// 2-decimal rounding, and rejects any character the component's charset gate
// (the same arithmetic charset gate, after x-substitution) would also reject.
// ---------------------------------------------------------------------------

type Tok = { t: 'num'; v: number } | { t: 'op'; v: string } | { t: 'lp' } | { t: 'rp' };

/** Returns null on any malformed / out-of-grammar rule (the component returns null too). */
function evalRuleIndependent(rule: string, x: number): number | null {
  if (!rule || !rule.trim()) return null;
  // Charset gate on the x-substituted expression, exactly as the component does.
  const substituted = rule.replace(/x/gi, `(${x})`);
  if (!/^[\d+\-*/().^\s]+$/.test(substituted)) return null;

  const toks = tokenize(substituted);
  if (!toks) return null;
  const rpn = toRpn(toks);
  if (!rpn) return null;
  const val = evalRpn(rpn);
  if (val === null || typeof val !== 'number' || !isFinite(val)) return null;
  return Math.round(val * 100) / 100;
}

function tokenize(s: string): Tok[] | null {
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    if (c === '(') { toks.push({ t: 'lp' }); i++; continue; }
    if (c === ')') { toks.push({ t: 'rp' }); i++; continue; }
    if (c === '+' || c === '*' || c === '/' || c === '^') { toks.push({ t: 'op', v: c }); i++; continue; }
    if (c === '-') {
      // Unary minus: at start, or after another operator / '('.
      const prev = toks[toks.length - 1];
      const unary = !prev || prev.t === 'op' || prev.t === 'lp';
      toks.push({ t: 'op', v: unary ? 'u-' : '-' });
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const num = Number(s.slice(i, j));
      if (!isFinite(num)) return null;
      toks.push({ t: 'num', v: num });
      i = j;
      continue;
    }
    return null; // out-of-grammar char
  }
  return toks;
}

const PREC: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, 'u-': 3, '^': 4 };
const RIGHT_ASSOC = new Set(['^', 'u-']);

function toRpn(toks: Tok[]): Tok[] | null {
  const out: Tok[] = [];
  const ops: Tok[] = [];
  for (const tok of toks) {
    if (tok.t === 'num') {
      out.push(tok);
    } else if (tok.t === 'op') {
      while (ops.length) {
        const top = ops[ops.length - 1];
        if (top.t !== 'op') break;
        const higher = RIGHT_ASSOC.has(tok.v)
          ? PREC[top.v] > PREC[tok.v]
          : PREC[top.v] >= PREC[tok.v];
        if (!higher) break;
        out.push(ops.pop() as Tok);
      }
      ops.push(tok);
    } else if (tok.t === 'lp') {
      ops.push(tok);
    } else {
      // rp: pop until lp
      let found = false;
      while (ops.length) {
        const top = ops.pop() as Tok;
        if (top.t === 'lp') { found = true; break; }
        out.push(top);
      }
      if (!found) return null; // mismatched parens
    }
  }
  while (ops.length) {
    const top = ops.pop() as Tok;
    if (top.t === 'lp' || top.t === 'rp') return null;
    out.push(top);
  }
  return out;
}

function evalRpn(rpn: Tok[]): number | null {
  const st: number[] = [];
  for (const tok of rpn) {
    if (tok.t === 'num') { st.push(tok.v); continue; }
    if (tok.t !== 'op') return null;
    if (tok.v === 'u-') {
      if (st.length < 1) return null;
      st.push(-(st.pop() as number));
      continue;
    }
    if (st.length < 2) return null;
    const b = st.pop() as number;
    const a = st.pop() as number;
    let r: number;
    switch (tok.v) {
      case '+': r = a + b; break;
      case '-': r = a - b; break;
      case '*': r = a * b; break;
      case '/': r = a / b; break;
      case '^': r = Math.pow(a, b); break;
      default: return null;
    }
    st.push(r);
  }
  return st.length === 1 ? st[0] : null;
}

// ---------------------------------------------------------------------------
// Answer-leak: does the rule expression appear in prose (spacing-insensitive)?
// Builds a regex from the rule that tolerates whitespace and an implicit '*'
// ("2x" matching "2*x"), bounded so "x+1" doesn't fire inside "max+12".
// ---------------------------------------------------------------------------
function ruleLeaksInto(text: string, rule: string): boolean {
  const compact = rule.replace(/\s+/g, '');
  if (compact.length < 3) return false; // too short to be a confident leak
  const body = compact
    .split('')
    .map((ch) => (ch === '*' ? '\\*?' : ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('\\s*');
  const re = new RegExp(`(?<![a-z0-9])${body}(?![0-9])`, 'i');
  return re.test(text);
}

function isInt(v: unknown): v is number {
  return Number.isInteger(v);
}

export const functionMachineOracle: ContentOracle = {
  componentId: 'function-machine',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    const mode = String(data.challengeType ?? '');
    const isKnownMode = KNOWN_MODES.has(mode);
    const isHiddenRule = HIDDEN_RULE_MODES.has(mode);
    if (!isKnownMode) uncheckedTypes.add(mode || '(missing challengeType)');

    const gradeBand = String(data.gradeBand ?? '');
    const intrinsic = INTRINSIC_BY_BAND[gradeBand] ?? DEFAULT_INTRINSIC;
    const ceiling = ctx.scopeMax ?? parseScopeCeiling(ctx.topic) ?? intrinsic;

    const prose = `${String(data.title ?? '')} ${String(data.description ?? '')}`;

    if (challenges.length < 3) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3-6+`,
      });
    }

    const ruleValues: string[] = [];
    let checked = 0;

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const id = String(c.id ?? `#${i + 1}`);
      const rule = typeof c.rule === 'string' ? c.rule.trim() : '';
      const queue = Array.isArray(c.inputQueue) ? (c.inputQueue as unknown[]) : null;

      if (!rule) {
        violations.push({ check: 'schema', where: id, detail: `missing/empty rule string (got ${JSON.stringify(c.rule)})` });
        continue;
      }
      if (!queue || queue.length === 0 || queue.some((v) => !isInt(v))) {
        violations.push({ check: 'schema', where: id, detail: `inputQueue must be a non-empty integer array; got ${JSON.stringify(c.inputQueue)}` });
        continue;
      }
      const inputs = queue as number[];
      checked++;
      ruleValues.push(rule.replace(/\s+/g, ''));

      // ── mode-identity: showRule must match the session mode ──
      if (isKnownMode) {
        const showRule = c.showRule;
        if (isHiddenRule && showRule === true) {
          violations.push({
            check: 'answer-leak',
            where: id,
            detail: `mode "${mode}" hides the rule (it is the answer) but showRule=true — the hidden rule "${rule}" is displayed on screen`,
          });
        }
        if (!isHiddenRule && showRule === false) {
          violations.push({
            check: 'schema',
            where: id,
            detail: `mode "${mode}" must show the rule to be doable, but showRule=false — nothing to observe/apply`,
          });
        }
      }

      // ── answer-leak: hidden rule must not appear in the session prose ──
      if (isHiddenRule && ruleLeaksInto(prose, rule)) {
        violations.push({
          check: 'answer-leak',
          where: id,
          detail: `the hidden rule "${rule}" appears in the title/description — the answer is given away before the student reasons to it`,
        });
      }

      // ── determinability: hidden rule needs ≥2 distinct inputs ──
      const distinct = new Set(inputs);
      if (isHiddenRule && distinct.size < 2) {
        violations.push({
          check: 'schema',
          where: id,
          detail: `hidden-rule mode "${mode}" with only ${distinct.size} distinct input(s) ${JSON.stringify(inputs)} — infinitely many rules fit, the answer is not recoverable`,
        });
      }

      // ── solvability + scope: re-derive every output independently ──
      const outputs: number[] = [];
      for (const x of inputs) {
        const y = evalRuleIndependent(rule, x);
        if (y === null) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `rule "${rule}" yields no finite output for input ${x} — the component silently drops this input, so the challenge can never complete`,
          });
          continue;
        }
        outputs.push(y);
        if (x > ceiling) {
          violations.push({ check: 'scope', where: id, detail: `input ${x} exceeds objective ceiling ${ceiling} (topic "${ctx.topic}")` });
        }
        if (Math.abs(y) > ceiling) {
          violations.push({ check: 'scope', where: id, detail: `rule "${rule}" on input ${x} outputs ${y}, exceeding objective ceiling ${ceiling} (topic "${ctx.topic}")` });
        }
      }

      // ── degenerate pairs: hidden rule ambiguous when every shown output ties ──
      if (isHiddenRule && outputs.length >= 2 && new Set(outputs).size === 1) {
        violations.push({
          check: 'answer-key-desync',
          where: id,
          detail: `rule "${rule}" produces the same output ${outputs[0]} for every input ${JSON.stringify(inputs)} — the pattern is ambiguous and the rule cannot be discovered`,
        });
      }
    }

    // ── clustering: rules spread; no exact-duplicate rule ──
    const variety = checkAnswerVariety(ruleValues, 'challenges[].rule');
    if (variety) violations.push(variety);
    const seen = new Map<string, number>();
    for (const r of ruleValues) seen.set(r, (seen.get(r) ?? 0) + 1);
    seen.forEach((count, r) => {
      if (count > 1) {
        violations.push({ check: 'clustering', where: 'challenges[]', detail: `rule "${r}" appears ${count}× — the generator must pick DISTINCT rules per session` });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
