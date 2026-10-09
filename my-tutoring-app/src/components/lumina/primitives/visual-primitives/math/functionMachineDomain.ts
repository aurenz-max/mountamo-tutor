/**
 * Function machine domain: the rule arithmetic every mode judges with, and the make_rule open build.
 *
 * evaluateRule / normalizeRule / rulesEquivalent moved here unchanged from FunctionMachine.tsx so the generator,
 * the component and the tests share one judge.
 *
 * make_rule (open build): "Make a machine that turns 4 into 12. Now make a different machine that also turns 4
 * into 12." The learner builds a rule from x, number and sign tiles. Many machines pass (3x, x + 8, 2x + 4,
 * x^2 - 4); create_rule fits ONE rule to several pairs, this fits one pair so the learner chooses the rule.
 * Code owns the pair; the second machine must work differently from the first (not the same output on every input).
 */

// ── Rule arithmetic (shared by every mode) ───────────────────────────────────

/** Safely evaluate a rule string at a given x value. */
export const evaluateRule = (rule: string, x: number): number | null => {
  if (!rule || !rule.trim()) return null;
  try {
    const expression = rule.replace(/x/g, `(${x})`);
    if (!/^[\d+\-*/().^\s]+$/.test(expression)) return null;
    const safeExpression = expression.replace(/\^/g, '**');
    const result = new Function('return ' + safeExpression)();
    if (typeof result !== 'number' || !isFinite(result)) return null;
    return Math.round(result * 100) / 100;
  } catch {
    return null;
  }
};

/** Normalize rule strings for textual comparison. */
export const normalizeRule = (r: string): string => {
  if (!r) return '';
  return r.replace(/\s/g, '').toLowerCase().replace(/\*/g, '');
};

/** Functional equivalence: two rules behave the same on multiple test inputs. */
export const rulesEquivalent = (a: string, b: string): boolean => {
  if (normalizeRule(a) === normalizeRule(b)) return true;
  const testInputs = [0, 1, 2, 3, 5, 10, -1];
  return testInputs.every((x) => {
    const va = evaluateRule(a, x);
    const vb = evaluateRule(b, x);
    return va !== null && vb !== null && Math.abs(va - vb) < 0.01;
  });
};

// ── make_rule: the learner's tile row ────────────────────────────────────────

export type RuleComplexity = 'oneStep' | 'twoStep' | 'expression';

/** The keypad for a band. Every number is built from digit tiles, so no tile names an answer. */
export function makeRuleKeys(complexity: RuleComplexity = 'oneStep'): string[] {
  const keys = ['x', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '+', '−', '×', '÷'];
  if (complexity !== 'oneStep') keys.push('(', ')');
  if (complexity === 'expression') keys.push('^');
  return keys;
}

/** The longest machine a learner can build. */
export const MAKE_RULE_MAX_TILES = 12;

const OP_OF: Record<string, string> = { '+': '+', '−': '-', '-': '-', '×': '*', '*': '*', '÷': '/', '/': '/', '^': '^' };
const isDigit = (t: string) => /^\d$/.test(t);
const endsOperand = (t: string) => isDigit(t) || t === 'x' || t === ')';
const startsOperand = (t: string) => t === 'x' || t === '(';

/**
 * The rule string the judge evaluates, from the tiles in order. Digits next to each other make one number (1 then 2
 * is 12); a number or x written against x or a bracket multiplies, as in 3x or 2(x + 1).
 */
export function tilesToRule(tiles: readonly string[]): string {
  let out = '';
  let prev = '';
  for (const t of tiles) {
    const implicit = prev && ((endsOperand(prev) && startsOperand(t)) || ((prev === 'x' || prev === ')') && isDigit(t)));
    if (implicit) out += '*';
    out += OP_OF[t] ?? t;
    prev = t;
  }
  return out;
}

/** The learner's machine as written on screen: "3x + 1", "x ÷ 2". */
export function showRule(tiles: readonly string[]): string {
  return tiles
    .map((t) => (['+', '−', '×', '÷'].includes(t) ? ` ${t} ` : t))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── make_rule: the judge ─────────────────────────────────────────────────────

export type MakeRuleMiss = 'not_a_rule' | 'no_input' | 'wrong_output' | 'same_machine';

const PROBE_INPUTS = [-2, -1, 0, 1, 2, 3, 5, 7, 10];

/** A machine whose output never changes with its input (12, x - x + 12, 0x + 12). */
function ignoresInput(rule: string): boolean {
  if (!/x/.test(rule)) return true;
  const values = PROBE_INPUTS.map((x) => evaluateRule(rule, x)).filter((v): v is number => v !== null);
  return values.length >= 2 && values.every((v) => Math.abs(v - values[0]) < 0.01);
}

/**
 * Two machines are the same machine when they give the same output for every input both can take: the old
 * rulesEquivalent plus a machine that cannot take 0 (48 ÷ x after 96 ÷ 2x). A rule textually the same is the same.
 */
export function sameMachine(a: string, b: string): boolean {
  if (rulesEquivalent(a, b)) return true;
  let shared = 0;
  for (const x of PROBE_INPUTS) {
    const va = evaluateRule(a, x);
    const vb = evaluateRule(b, x);
    if ((va === null) !== (vb === null)) return false;
    if (va === null || vb === null) continue;
    if (Math.abs(va - vb) >= 0.01) return false;
    shared++;
  }
  return shared >= 3;
}

export interface MakeRuleVerdict {
  miss?: MakeRuleMiss;
  /** What the learner's machine gives for the asked input (null when it cannot run). */
  gave: number | null;
  rule: string;
}

/**
 * The builder's check at "I'm done!": the machine must run, use its input, turn `input` into `output`, and work
 * differently from every machine already accepted on this item. No miss = a pass.
 */
export function judgeMakeRule(
  tiles: readonly string[],
  input: number,
  output: number,
  made: readonly string[] = [],
): MakeRuleVerdict {
  const rule = tilesToRule(tiles);
  const gave = evaluateRule(rule, input);
  if (gave === null) return { miss: 'not_a_rule', gave, rule };
  if (ignoresInput(rule)) return { miss: 'no_input', gave, rule };
  if (Math.abs(gave - output) >= 0.01) return { miss: 'wrong_output', gave, rule };
  if (made.some((m) => sameMachine(m, rule))) return { miss: 'same_machine', gave, rule };
  return { gave, rule };
}

/** What a miss shows. It names what the machine did, never a tile or a rule that would work. */
export function makeRuleMissWords(v: MakeRuleVerdict, input: number, output: number): string {
  switch (v.miss) {
    case 'not_a_rule': return 'The machine cannot run that yet. Every sign needs a number or x on both sides.';
    case 'no_input': return 'That machine gives the same number whatever goes in. Use x, so what goes in changes what comes out.';
    case 'wrong_output': return `Your machine turns ${input} into ${v.gave}, not ${output}. Change a tile and try again.`;
    case 'same_machine': return 'That machine works the same as your first one: it gives the same output for every input. Make one that works differently.';
    default: return '';
  }
}

/** The ask, code-written from the pair. The pair is the task, not a leak. */
export const makeRuleAsk = (input: number, output: number, way: number) => way <= 1
  ? `Make a machine that turns ${input} into ${output}.`
  : `Now make a different machine that also turns ${input} into ${output}.`;

/**
 * The pair an item asks for: `makeInput`/`makeOutput` as generated, else (a payload written without them) the
 * first queued input and what the item's rule makes of it. Null when neither gives a pair.
 */
export function makeRuleTarget(c: { rule?: string; inputQueue?: number[]; makeInput?: number; makeOutput?: number }):
  { input: number; output: number } | null {
  const input = c.makeInput ?? c.inputQueue?.[0];
  if (typeof input !== 'number') return null;
  const output = c.makeOutput ?? (c.rule ? evaluateRule(c.rule, input) : null);
  return typeof output === 'number' ? { input, output } : null;
}

/** Machines asked per item. */
export const MAKE_RULE_WAYS = 2;

/** After a pass: the two machines on one more input, so the learner sees they are different machines. */
export function compareInput(input: number): number {
  return input === 5 ? 6 : 5;
}

// ── make_rule: code-owned pairs ──────────────────────────────────────────────

export interface MakeRulePair {
  input: number;
  output: number;
  /** One machine code knows makes the pair (never shown; the oracle re-checks it). */
  witness: string;
}

type Rng = () => number;
const pick = <T,>(xs: readonly T[], rng: Rng): T => xs[Math.floor(rng() * xs.length) % xs.length];

/**
 * Pairs a learner at the band can make at least two different ways with the operations they know.
 * oneStep (grades 3-4): grow pairs (4 → 12: 3x, x + 8) and one shrink pair (12 → 4: x ÷ 3, x − 8).
 * twoStep (grade 5): outputs off the times table (4 → 11: 2x + 3, x + 7, 3x − 1) and one product pair.
 * expression: square-based pairs (3 → 10: x^2 + 1, 3x + 1, x + 7) and one product pair.
 * Inputs, outputs and the stored machine are distinct across the session (no two doubling items).
 */
export function makeRulePairs(complexity: RuleComplexity = 'oneStep', count = 3, rng: Rng = Math.random): MakeRulePair[] {
  const candidates = (slot: number): MakeRulePair[] => {
    const out: MakeRulePair[] = [];
    const last = slot === count - 1;
    if (complexity === 'oneStep') {
      for (let input = 2; input <= 6; input++) {
        for (let k = 2; k <= 5; k++) {
          const big = input * k;
          if (big > 30) continue;
          out.push(last ? { input: big, output: input, witness: `x/${k}` } : { input, output: big, witness: `${k}*x` });
        }
      }
    } else if (complexity === 'twoStep') {
      for (let input = 2; input <= 6; input++) {
        for (let k = 2; k <= 4; k++) {
          if (last) { if (input * k <= 30) out.push({ input, output: input * k, witness: `${k}*x` }); continue; }
          for (let c = 1; c <= 5; c++) {
            const output = input * k + c;
            if (output <= 30 && output % input !== 0) out.push({ input, output, witness: `${k}*x + ${c}` });
          }
        }
      }
    } else {
      for (let input = 2; input <= 6; input++) {
        if (last) { for (let k = 2; k <= 4; k++) out.push({ input, output: input * k, witness: `${k}*x` }); continue; }
        for (const c of [-3, -1, 1, 2, 4]) {
          const output = input * input + c;
          if (output > 0 && output <= 40) out.push({ input, output, witness: c < 0 ? `x^2 - ${-c}` : `x^2 + ${c}` });
        }
      }
    }
    return out;
  };
  const chosen: MakeRulePair[] = [];
  for (let slot = 0; slot < count; slot++) {
    const fresh = candidates(slot).filter((p) => p.output !== p.input
      && !chosen.some((c) => c.input === p.input || c.output === p.output || c.witness === p.witness));
    const pool = fresh.length ? fresh : candidates(slot);
    chosen.push(pick(pool, rng));
  }
  return chosen;
}
