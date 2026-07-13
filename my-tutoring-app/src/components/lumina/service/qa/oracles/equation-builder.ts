import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, checkUniqueOptions, parseScopeCeiling } from './helpers';

/**
 * Equation-builder oracle — verifies the pre-built K-2 equation pool against the
 * component's own judging contract, across all five challenge types.
 *
 * The component (EquationBuilder.tsx) judges each type with its own handler:
 *  - build         (handleCheckBuild)       : equationsMatch(slots, targetEquation)
 *      — the built tiles must exactly (whitespace-normalized) equal targetEquation.
 *  - missing-value (handleCheckMissingValue): selectedOption === correctValue.
 *  - true-false    (handleCheckTrueFalse)   : selectedTruthValue === isTrue.
 *  - balance       (handleCheckBalance)     : parseInt(input) === correctAnswer.
 *  - rewrite       (handleCheckRewrite)     : matchesAcceptedForm(slots, acceptedForms).
 *
 * THE INDEPENDENCE RULE: the shipped keys are targetEquation / correctValue /
 * isTrue / correctAnswer / acceptedForms. The generator re-derives most of them
 * itself (validate*), so this oracle must NOT re-run that derivation — it checks
 * the CONTRACT a different way, from the DISPLAYED strings and tiles:
 *  - it evaluates every equation with its OWN arithmetic evaluator (the same
 *    "a op b" grammar the component grades true-false by), and
 *  - it SUBSTITUTES the shipped key back into the printed equation and requires
 *    the result to be TRUE — a value-in, verdict-out check that never trusts the
 *    generator's solver: missing-value ⇒ equation with ? ← correctValue is true;
 *    balance ⇒ evalSide(left) === evalSide(right with ? ← correctAnswer);
 *    true-false ⇒ evaluate(displayEquation) === isTrue; and
 *  - it checks REACHABILITY on the tile palette: every token of targetEquation
 *    (build) or of at least one acceptedForm (rewrite) must be present in
 *    availableTiles with enough multiplicity, else the correct state can never
 *    be built. A generator whose printed equation and shipped key drift (a
 *    "false" key on a true equation, a correctValue that doesn't satisfy the
 *    equation, a target missing a tile) is the correct-answer-marked-wrong /
 *    unreachable-state class this oracle exists to catch.
 *
 * Checks:
 *  - answer-key-desync :
 *      build     — targetEquation is not a true equation; a target token is
 *                  missing from availableTiles (unbuildable → unreachable).
 *      missing-value — correctValue substituted into the equation is not true;
 *                  correctValue absent from options (unselectable); a SECOND
 *                  option also satisfies the equation (ambiguous key).
 *      true-false — isTrue ≠ the actual truth of displayEquation (a correct
 *                  evaluator is marked wrong).
 *      balance   — evalSide(left) ≠ evalSide(right with ? ← correctAnswer).
 *      rewrite   — originalEquation is not true; an acceptedForm is false or
 *                  equals the original (not a rewrite); NO acceptedForm is
 *                  buildable from availableTiles (unreachable).
 *  - scope             : (1) when ctx.evalMode names a known eval mode, every
 *      challenge's type must match it (task identity — build-simple ≠ balance);
 *      (2) every number shown (operands, results, options, the answer) is ≤ the
 *      objective ceiling (ctx.scopeMax ?? topic "to N" ?? data.maxNumber — the
 *      generator's own grade cap, a real intrinsic ceiling here).
 *  - answer-leak       : build/rewrite — the instruction must not spell out the
 *      targetEquation / an acceptedForm (the generator strips this; the oracle
 *      is the regression guard). Value-matched on the whole equation string.
 *  - clustering        : the per-type answer (target / value / truth / answer /
 *      original) must spread (checkAnswerVariety — catches "all true" too); no
 *      byte-identical card.
 *  - schema            : ≥3 challenges (mastery-over-demo); known type; non-empty
 *      instruction; per-type required fields present and well-typed (unique
 *      options; isTrue boolean; exactly one ? and one = for missing-value;
 *      non-empty acceptedForms; positive maxNumber).
 *
 * Deliberately NOT checked:
 *  - instruction/hint TONE and the support-tier distractor count / option spread:
 *    display-only scaffolding levers (the checker never reads them) — /eval-test.
 *  - build's exact-token-match leniency: the component grades a byte match, so a
 *    mathematically-equivalent-but-different build is intentionally "wrong" — the
 *    oracle only requires the target itself to be true and buildable.
 *  - distractor plausibility (near vs far MC spread) — /eval-test territory.
 */

const KNOWN_TYPES = new Set(['build', 'missing-value', 'true-false', 'balance', 'rewrite']);

/** Eval-mode IDs → challenge type (one type backs two missing-value modes). */
const EVAL_MODE_TO_TYPE: Record<string, string> = {
  'build-simple': 'build',
  'missing-result': 'missing-value',
  'missing-operand': 'missing-value',
  'true-false': 'true-false',
  'balance-both-sides': 'balance',
  rewrite: 'rewrite',
};

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Tokenize an equation/expression string into numbers, operators, =, and ?. */
function tokensOf(s: string): string[] {
  return s.match(/\d+|[+\-=?]/g) ?? [];
}

/** Evaluate one side ("7", "3 + 4", "5 - 2") to a number, or null. Mirrors the
 *  component's evalSide grammar (non-negative integer operands, single op). */
function evalSide(side: string): number | null {
  const s = side.replace(/\s+/g, '');
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const add = s.match(/^(\d+)\+(\d+)$/);
  if (add) return parseInt(add[1], 10) + parseInt(add[2], 10);
  const sub = s.match(/^(\d+)-(\d+)$/);
  if (sub) return parseInt(sub[1], 10) - parseInt(sub[2], 10);
  return null;
}

/** True when a full "L = R" equation is mathematically true (the component's contract). */
function equationTrue(eq: string): boolean {
  const parts = eq.replace(/\s+/g, '').split('=');
  if (parts.length !== 2) return false;
  const l = evalSide(parts[0]);
  const r = evalSide(parts[1]);
  return l !== null && r !== null && l === r;
}

/** Every number appearing in a string. */
function numbersOf(s: string): number[] {
  return (s.match(/\d+/g) ?? []).map((n) => parseInt(n, 10));
}

/** Multiset count of tokens. */
function counts(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

/** True when `need` is a multiset-subset of `have` (every token present ≥ its need count). */
function isSubMultiset(need: string[], have: string[]): boolean {
  const h = counts(have);
  const n = counts(need);
  return Array.from(n.entries()).every(([tok, c]) => (h.get(tok) ?? 0) >= c);
}

const norm = (s: string): string => s.replace(/\s+/g, '');

export const equationBuilderOracle: ContentOracle = {
  componentId: 'equation-builder',
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

    const requestedType = KNOWN_TYPES.has(ctx.evalMode)
      ? ctx.evalMode
      : EVAL_MODE_TO_TYPE[ctx.evalMode] ?? null;
    const maxNumber = isNum(data.maxNumber) ? data.maxNumber : undefined;
    const ceiling = ctx.scopeMax ?? parseScopeCeiling(ctx.topic) ?? maxNumber;

    const answerValues: string[] = [];
    const cardSeen = new Map<string, number>();
    let checked = 0;

    const bumpCard = (key: string) => cardSeen.set(key, (cardSeen.get(key) ?? 0) + 1);

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const id = String(c.id ?? `#${i + 1}`);
      const type = String(c.type ?? '');
      if (!KNOWN_TYPES.has(type)) {
        uncheckedTypes.add(type || '(missing type)');
        continue;
      }

      const instruction = typeof c.instruction === 'string' ? c.instruction : '';
      if (instruction.trim() === '') {
        violations.push({ check: 'schema', where: id, detail: 'missing/empty instruction' });
        continue;
      }

      // ── scope (1): the session must deliver the requested eval mode ──
      if (requestedType && type !== requestedType) {
        violations.push({
          check: 'scope',
          where: id,
          detail: `challenge type "${type}" but the objective asked for eval mode "${ctx.evalMode}" (type "${requestedType}") — a different task identity`,
        });
      }

      const scopeNumbers: number[] = [];
      let ok = true; // schema-gate for this challenge

      if (type === 'build') {
        const target = typeof c.targetEquation === 'string' ? c.targetEquation : '';
        const tiles = Array.isArray(c.availableTiles) ? c.availableTiles.map(String) : null;
        if (target.trim() === '' || !tiles) {
          violations.push({ check: 'schema', where: id, detail: `build missing targetEquation/availableTiles: target=${JSON.stringify(c.targetEquation)} tiles=${JSON.stringify(c.availableTiles)}` });
          continue;
        }
        if (!equationTrue(target)) {
          violations.push({ check: 'answer-key-desync', where: id, detail: `targetEquation "${target}" is not a true equation — the built answer teaches a false equation` });
          ok = false;
        }
        if (!isSubMultiset(tokensOf(target), tiles.flatMap(tokensOf))) {
          violations.push({ check: 'answer-key-desync', where: id, detail: `availableTiles [${tiles.join(', ')}] cannot build targetEquation "${target}" — a needed tile is missing (unreachable correct state)` });
          ok = false;
        }
        if (norm(instruction).includes(norm(target))) {
          violations.push({ check: 'answer-leak', where: id, detail: `instruction states the target equation "${target}"` });
        }
        scopeNumbers.push(...numbersOf(target));
        answerValues.push(`build:${norm(target)}`);
        bumpCard(`build#${norm(target)}`);
      } else if (type === 'missing-value') {
        const equation = typeof c.equation === 'string' ? c.equation : '';
        const correctValue = c.correctValue;
        const options = Array.isArray(c.options) ? c.options.filter(isNum) : null;
        const eqTokens = tokensOf(equation);
        const qCount = eqTokens.filter((t) => t === '?').length;
        const eqCount = eqTokens.filter((t) => t === '=').length;
        if (equation.trim() === '' || !isNum(correctValue) || !options || options.length < 2 || qCount !== 1 || eqCount !== 1) {
          violations.push({ check: 'schema', where: id, detail: `missing-value malformed: equation=${JSON.stringify(c.equation)} correctValue=${String(c.correctValue)} options=${JSON.stringify(c.options)} (need one '?' and one '=')` });
          continue;
        }
        const dup = checkUniqueOptions(options, id);
        if (dup) violations.push(dup);
        // ── substitute the key back in — it must make the equation true ──
        if (!equationTrue(equation.replace('?', String(correctValue)))) {
          violations.push({ check: 'answer-key-desync', where: id, detail: `correctValue=${correctValue} does not satisfy "${equation}" — the student solving the equation is marked wrong` });
          ok = false;
        }
        if (!options.includes(correctValue)) {
          violations.push({ check: 'answer-key-desync', where: id, detail: `correctValue=${correctValue} is not among options [${options.join(', ')}] — the correct answer is unselectable` });
          ok = false;
        }
        // ── no distractor may also satisfy the equation (ambiguous key) ──
        const trueOptions = options.filter((o) => equationTrue(equation.replace('?', String(o))));
        if (trueOptions.length > 1) {
          violations.push({ check: 'answer-key-desync', where: id, detail: `${trueOptions.length} options [${trueOptions.join(', ')}] satisfy "${equation}" but only ${correctValue} is judged correct — an ambiguous key` });
        }
        scopeNumbers.push(...numbersOf(equation), ...options, correctValue);
        answerValues.push(`mv:${correctValue}`);
        bumpCard(`mv#${norm(equation)}#${correctValue}`);
      } else if (type === 'true-false') {
        const display = typeof c.displayEquation === 'string' ? c.displayEquation : '';
        const isTrue = c.isTrue;
        if (display.trim() === '' || typeof isTrue !== 'boolean') {
          violations.push({ check: 'schema', where: id, detail: `true-false malformed: displayEquation=${JSON.stringify(c.displayEquation)} isTrue=${String(c.isTrue)} (must be boolean)` });
          continue;
        }
        // ── evaluate the equation ourselves; the shipped truth must match ──
        const actual = equationTrue(display);
        if (actual !== isTrue) {
          violations.push({ check: 'answer-key-desync', where: id, detail: `isTrue=${isTrue} but "${display}" is actually ${actual} — the student evaluating correctly is marked wrong` });
          ok = false;
        }
        scopeNumbers.push(...numbersOf(display));
        answerValues.push(`tf:${isTrue}`);
        bumpCard(`tf#${norm(display)}`);
      } else if (type === 'balance') {
        const left = typeof c.leftSide === 'string' ? c.leftSide : '';
        const right = typeof c.rightSide === 'string' ? c.rightSide : '';
        const correctAnswer = c.correctAnswer;
        if (left.trim() === '' || right.trim() === '' || !isNum(correctAnswer) || !right.includes('?')) {
          violations.push({ check: 'schema', where: id, detail: `balance malformed: leftSide=${JSON.stringify(c.leftSide)} rightSide=${JSON.stringify(c.rightSide)} correctAnswer=${String(c.correctAnswer)}` });
          continue;
        }
        const leftVal = evalSide(left);
        const rightVal = evalSide(right.replace('?', String(correctAnswer)));
        if (leftVal === null || rightVal === null) {
          violations.push({ check: 'schema', where: id, detail: `balance sides not evaluable: left="${left}" right(?=${correctAnswer})="${right.replace('?', String(correctAnswer))}"` });
          continue;
        }
        // ── the answer must make both sides equal ──
        if (leftVal !== rightVal) {
          violations.push({ check: 'answer-key-desync', where: id, detail: `with ? = ${correctAnswer}, left "${left}"=${leftVal} but right "${right}"=${rightVal} — the sides do not balance, so the key is wrong` });
          ok = false;
        }
        scopeNumbers.push(...numbersOf(left), ...numbersOf(right), correctAnswer);
        answerValues.push(`bal:${correctAnswer}`);
        bumpCard(`bal#${norm(left)}#${norm(right)}#${correctAnswer}`);
      } else {
        // rewrite
        const original = typeof c.originalEquation === 'string' ? c.originalEquation : '';
        const acceptedForms = Array.isArray(c.acceptedForms) ? c.acceptedForms.filter((f): f is string => typeof f === 'string') : null;
        const tiles = Array.isArray(c.availableTiles) ? c.availableTiles.map(String) : null;
        if (original.trim() === '' || !acceptedForms || acceptedForms.length === 0 || !tiles) {
          violations.push({ check: 'schema', where: id, detail: `rewrite malformed: originalEquation=${JSON.stringify(c.originalEquation)} acceptedForms=${JSON.stringify(c.acceptedForms)} tiles=${JSON.stringify(c.availableTiles)}` });
          continue;
        }
        if (!equationTrue(original)) {
          violations.push({ check: 'answer-key-desync', where: id, detail: `originalEquation "${original}" is not a true equation` });
          ok = false;
        }
        for (const form of acceptedForms) {
          if (!equationTrue(form)) {
            violations.push({ check: 'answer-key-desync', where: id, detail: `acceptedForm "${form}" is not a true equation — accepting it marks a false rewrite correct` });
            ok = false;
          } else if (norm(form) === norm(original)) {
            violations.push({ check: 'answer-key-desync', where: id, detail: `acceptedForm "${form}" is identical to the original — that is not a rewrite` });
          }
        }
        const tileTokens = tiles.flatMap(tokensOf);
        if (!acceptedForms.some((f) => isSubMultiset(tokensOf(f), tileTokens))) {
          violations.push({ check: 'answer-key-desync', where: id, detail: `no acceptedForm is buildable from availableTiles [${tiles.join(', ')}] — the student can never complete a valid rewrite (unreachable)` });
          ok = false;
        }
        for (const form of acceptedForms) {
          if (norm(instruction).includes(norm(form))) {
            violations.push({ check: 'answer-leak', where: id, detail: `instruction states an accepted form "${form}"` });
            break;
          }
        }
        scopeNumbers.push(...numbersOf(original), ...acceptedForms.flatMap(numbersOf));
        answerValues.push(`rw:${norm(original)}`);
        bumpCard(`rw#${norm(original)}`);
      }

      if (ok) checked++;

      // ── scope (2): every shown number honors the objective ceiling ──
      if (ceiling !== undefined && scopeNumbers.length > 0) {
        const maxN = Math.max(...scopeNumbers);
        if (maxN > ceiling) {
          violations.push({
            check: 'scope',
            where: id,
            detail: `number ${maxN} exceeds objective ceiling ${ceiling} (topic "${ctx.topic}"${maxNumber !== undefined ? `, maxNumber ${maxNumber}` : ''})`,
          });
        }
      }
    }

    // ── clustering: answers spread; no byte-identical card ──
    const variety = checkAnswerVariety(answerValues, 'challenges[].answer');
    if (variety) violations.push(variety);
    cardSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({
          check: 'clustering',
          where: 'challenges[]',
          detail: `identical challenge "${key}" appears ${count}× — a duplicated card`,
        });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
