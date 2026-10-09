/**
 * function-machine's in-item levers (/add-support-tiers; report qa/eval-reports/function-machine-levers-2026-10-09.md).
 * The misses are what `predictMiss`, `guessMiss` and `judgeMakeRule` observe; there is no real-learner evidence.
 *
 * - `model_machine` (help, predict / discover / create): a worked machine outside the item, of the same shape, with its
 *   own rule and numbers. On predict none of its numbers is an output of the item; on discover/create it is never the
 *   item's rule and never contains it.
 * - `step_order` (help, predict, a two-step rule): the rule on the machine is redrawn as its two steps in order
 *   ("first × 2, then + 1"), with exactly the rule's own numbers.
 * - `check_pairs` (help, discover / create): the learner's last checked rule is run on every pair on screen, each
 *   marked fits or does not fit.
 * - `output_steps` (help, discover / create): between pairs whose inputs differ by 1, how much the output changed,
 *   computed from pairs already on screen.
 * - `run_machine` (help, make): the learner's last checked machine worked on the asked input and one more input.
 * - `machine_shapes` (help, make): empty machine shapes (x + ☐, ☐ × x …), no number; every shape uses x.
 * - `simpler_machine` (simplify, predict / discover / create / make): the same mode with a one-step rule and small
 *   numbers (make: a smaller pair), built here; ungraded practice.
 *
 * Observe has no lever: nothing in it can be checked wrong.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { FunctionMachineChallenge, FunctionMachineChallengeType } from './FunctionMachine';
import { evaluateRule, makeRuleTarget, rulesEquivalent, sameMachine, showRule, tilesToRule } from './functionMachineDomain';
import { ruleShape, type FunctionMachineMiss } from './functionMachineWorkspace';

export const MODEL_LEVER = 'model_machine';
export const STEP_ORDER_LEVER = 'step_order';
export const CHECK_PAIRS_LEVER = 'check_pairs';
export const OUTPUT_STEPS_LEVER = 'output_steps';
export const RUN_MACHINE_LEVER = 'run_machine';
export const SHAPES_LEVER = 'machine_shapes';
export const SIMPLER_LEVER = 'simpler_machine';

const SIMPLER = '~simpler';
export const isPracticeMachine = (c: Pick<FunctionMachineChallenge, 'id'>) => c.id.endsWith(SIMPLER);
export const PRACTICE_NOTE = 'An easier practice machine is on screen in place of the item. It is not graded; the full item comes back after it.';

type Pair = { input: number; output: number };
const fmt = (n: number) => String(Math.round(n * 100) / 100);
/** A rule as the screen writes it: × ÷ − for * / -. */
export const ruleDisplay = (rule: string) => rule.replace(/\s+/g, '').replace(/\*/g, ' × ').replace(/\//g, ' ÷ ')
  .replace(/\+/g, ' + ').replace(/-/g, ' − ').replace(/\s+/g, ' ').replace(/(\d) × x/g, '$1x').trim();
/** The rule worked on one input: "3 × 5 + 1". */
export const substituted = (rule: string, x: number) => ruleDisplay(rule.replace(/(\d)\s*\*?\s*x/g, '$1*x'))
  .replace(/(\d)x/g, '$1 × x').replace(/x/g, x < 0 ? `(${x})` : String(x));

/** Whether `phrase` appears in `text` on its own (the sweep's key match). */
export function containsPhrase(text: string, phrase: string): boolean {
  const esc = phrase.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return !!esc && new RegExp(`(?<![a-z0-9])${esc}(?![a-z0-9])`).test(text.toLowerCase());
}

const outputsOf = (c: FunctionMachineChallenge) => c.inputQueue.map(x => evaluateRule(c.rule, x)).filter((v): v is number => v !== null);

// ── model_machine ─────────────────────────────────────────────────────────

export interface MachineModel { rule: string; pairs: Pair[] }

/** Candidate rules of the item's shape, small first. */
function sameShapeRules(rule: string): string[] {
  const s = ruleShape(rule);
  const out: string[] = [];
  if (s.kind === 'times') for (let k = 2; k <= 9; k++) out.push(s.k >= 1 ? `${k}*x` : `x/${k}`);
  else if (s.kind === 'add') for (let c = 1; c <= 9; c++) out.push(s.c > 0 ? `x + ${c}` : `x - ${c}`);
  else if (s.kind === 'two_step') for (let a = 2; a <= 5; a++) for (let b = 1; b <= 5; b++) out.push(s.b > 0 ? `${a}*x + ${b}` : `${a}*x - ${b}`);
  else for (let c = 1; c <= 6; c++) out.push(`x^2 + ${c}`, `x*x + ${c}`);
  return out;
}

/**
 * The worked machine for `c`: same shape, never equivalent to the item's rule. On predict its numbers (constants,
 * inputs, outputs) avoid every output of the item, since those are the answers; on discover/create its written form
 * never contains the item's rule, which is the answer there.
 */
export function machineModel(c: FunctionMachineChallenge, mode: FunctionMachineChallengeType): MachineModel | null {
  const keys = new Set(outputsOf(c).map(fmt));
  for (const rule of sameShapeRules(c.rule)) {
    if (rulesEquivalent(rule, c.rule)) continue;
    const inputs = mode === 'predict' ? [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 16, 18, 20, 21, 24, 25, 27, 28, 30, 35, 40]
      : [0, 1, 2, 3, 4, 6, 8, 9, 12];
    const pairs: Pair[] = [];
    for (const x of inputs) {
      const y = evaluateRule(rule, x);
      if (y === null || !Number.isInteger(y) || y < 0) continue;
      if (mode === 'predict' && [x, y].some(n => keys.has(fmt(n)))) continue;
      pairs.push({ input: x, output: y });
      if (pairs.length === (mode === 'predict' ? 1 : 3)) break;
    }
    if (pairs.length < (mode === 'predict' ? 1 : 3)) continue;
    const model = { rule, pairs };
    if (!modelLeaks(c, mode, model)) return model;
  }
  return null;
}

export function modelText(m: MachineModel): string {
  return `f(x) = ${ruleDisplay(m.rule)}: ` + m.pairs.map(p => `${substituted(m.rule, p.input)} = ${fmt(p.output)}`).join('; ');
}

/** Leak rule for the model: never the item's rule; on predict, no item output among its numbers. */
export function modelLeaks(c: FunctionMachineChallenge, mode: FunctionMachineChallengeType, m: MachineModel): boolean {
  if (rulesEquivalent(m.rule, c.rule)) return true;
  const text = modelText(m);
  if (mode === 'predict') return outputsOf(c).some(o => containsPhrase(text, fmt(o)));
  return containsPhrase(text, c.rule) || containsPhrase(text, ruleDisplay(c.rule));
}

// ── step_order (predict, two-step) ────────────────────────────────────────

/** The two steps of a two-step rule in order, when they use exactly the rule's own numbers; else null. */
export function ruleSteps(rule: string): [string, string] | null {
  const s = ruleShape(rule);
  if (s.kind !== 'two_step' || !Number.isInteger(s.a) || !Number.isInteger(s.b)) return null;
  const steps: [string, string] = [`× ${s.a}`, s.b > 0 ? `+ ${s.b}` : `− ${-s.b}`];
  const digits = (t: string) => (t.match(/\d+/g) ?? []).sort().join(',');
  return digits(rule) === digits(steps.join(' ')) ? steps : null;
}

// ── output_steps / check_pairs (discover, create) ─────────────────────────

/** For each two pairs on screen whose inputs differ by 1, how much the output changed (from pairs already shown). */
export function outputSteps(pairs: readonly Pair[]): Array<{ from: number; to: number; change: string }> {
  const sorted = [...pairs].sort((a, b) => a.input - b.input);
  const out: Array<{ from: number; to: number; change: string }> = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].input - sorted[i - 1].input !== 1) continue;
    const d = sorted[i].output - sorted[i - 1].output;
    out.push({ from: sorted[i - 1].input, to: sorted[i].input, change: d >= 0 ? `+${fmt(d)}` : `−${fmt(-d)}` });
  }
  return out;
}

/** The learner's rule on each pair on screen: fits or not. Null when the rule cannot run. */
export function pairMarks(guess: string, pairs: readonly Pair[]): Array<Pair & { fits: boolean }> | null {
  if (!guess.trim() || [1, 2, 3].every(x => evaluateRule(guess, x) === null)) return null;
  return pairs.map(p => { const v = evaluateRule(guess, p.input); return { ...p, fits: v !== null && Math.abs(v - p.output) < 0.01 }; });
}

// ── run_machine / machine_shapes (make) ───────────────────────────────────

/** The learner's machine worked on the asked input and one more: "4 + 9 = 13". Null when it cannot run. */
export function machineRun(tiles: readonly string[], input: number): string[] | null {
  const rule = tilesToRule(tiles);
  const more = input === 5 ? 6 : 5;
  const lines = [input, more].map(x => { const v = evaluateRule(rule, x); return v === null ? null : `${substituted(rule, x)} = ${fmt(v)}`; });
  return lines.every((l): l is string => l !== null) ? lines as string[] : null;
}

export const machineShapes = (complexity: string = 'oneStep') => complexity === 'oneStep'
  ? ['x + ☐', 'x − ☐', '☐ × x', 'x ÷ ☐'] : ['x + ☐', 'x − ☐', '☐ × x', 'x ÷ ☐', '☐ × x + ☐', '☐ × x − ☐'];

// ── simpler_machine ───────────────────────────────────────────────────────

function alreadySimple(c: FunctionMachineChallenge, mode: FunctionMachineChallengeType): boolean {
  if (mode === 'make_rule') { const t = makeRuleTarget(c); return !t || Math.max(t.input, t.output) <= 9; }
  const s = ruleShape(c.rule);
  const small = (s.kind === 'add' && Math.abs(s.c) <= 3) || (s.kind === 'times' && s.k >= 2 && s.k <= 3);
  return small && (mode !== 'predict' || Math.max(...c.inputQueue) <= 3);
}

/**
 * The easier practice item for `c`: same mode, a one-step rule with a small number (make: a smaller pair), its own
 * id. Its rule is never equivalent to the item's, its outputs are not the item's, and it never names the item's rule.
 * Null when the item is already that simple.
 */
export function simplerMachine(c: FunctionMachineChallenge, mode: FunctionMachineChallengeType): FunctionMachineChallenge | null {
  if (isPracticeMachine(c) || mode === 'observe' || alreadySimple(c, mode)) return null;
  const id = `${c.id}${SIMPLER}`;
  if (mode === 'make_rule') {
    const t = makeRuleTarget(c)!;
    for (const input of [2, 3, 4]) for (const k of [2, 3]) {
      const p: FunctionMachineChallenge = { id, rule: `${k}*x`, inputQueue: [input], showRule: false, makeInput: input, makeOutput: input * k };
      if (!practiceLeaks(c, mode, p) && !(input === t.input && input * k === t.output)) return p;
    }
    return null;
  }
  const s = ruleShape(c.rule);
  const rules = s.kind === 'add' ? ['x + 2', 'x + 1', 'x + 3', '2*x'] : ['2*x', '3*x', 'x + 2', 'x + 1'];
  const inputs = mode === 'predict' ? [1, 2, 3] : [0, 1, 2, 3];
  for (const rule of rules) {
    const p: FunctionMachineChallenge = { ...c, id, rule, inputQueue: inputs, showRule: mode === 'predict',
      prefilledPairCount: undefined, pairsRequiredToComplete: undefined };
    if (!practiceLeaks(c, mode, p)) return p;
  }
  return null;
}

/** Leak rule for a practice item: never the learner's item or its rule, its outputs not the item's, the same mode. */
export function practiceLeaks(parent: FunctionMachineChallenge, mode: FunctionMachineChallengeType, p: FunctionMachineChallenge): boolean {
  if (p.id === parent.id) return true;
  if (mode === 'make_rule') {
    const a = makeRuleTarget(parent), b = makeRuleTarget(p);
    return !a || !b || (a.input === b.input && a.output === b.output);
  }
  if (rulesEquivalent(p.rule, parent.rule) || sameMachine(p.rule, parent.rule)) return true;
  if (containsPhrase(ruleDisplay(p.rule), parent.rule) || containsPhrase(p.rule, parent.rule)) return true;
  const theirs = new Set(outputsOf(parent).map(fmt));
  return mode === 'predict' && outputsOf(p).some(o => theirs.has(fmt(o)));
}

// ── declarations ─────────────────────────────────────────────────────────

export interface MachineLeverContext {
  mode: FunctionMachineChallengeType;
  /** Pairs on screen (fed, pre-revealed, or the table). */
  pairs: readonly Pair[];
  /** discover/create: the last rule the learner checked on this item. */
  lastGuess: string;
  /** make: the last machine the learner checked on this item. */
  lastMachine: readonly string[];
}

const GUESS_MISSES: readonly FunctionMachineMiss[] = ['not_a_rule', 'fits_some_pairs', 'added_not_multiplied', 'multiplied_not_added',
  'one_step_only', 'wrong_order', 'wrong_rule'];
const PREDICT_MISSES: readonly FunctionMachineMiss[] = ['gave_input', 'added_not_multiplied', 'multiplied_not_added', 'one_step_only',
  'wrong_order', 'too_high', 'too_low'];

export function machineLevers(c: FunctionMachineChallenge | null, pulled: readonly string[], ctx: MachineLeverContext): WorkspaceLever[] {
  const { mode } = ctx;
  if (!c || isPracticeMachine(c) || mode === 'observe') return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: readonly FunctionMachineMiss[],
    when: string, does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  const out: WorkspaceLever[] = [];
  if (mode === 'predict') {
    if (machineModel(c, mode)) out.push(lever(MODEL_LEVER, 'help', 'both', PREDICT_MISSES,
      'The learner does not see how a rule turns an input into an output.',
      'Shows a different machine of the same kind beside this one, with one input worked through it to its output. Its '
        + 'numbers are not this item\'s outputs. Read it aloud.'));
    if (ruleSteps(c.rule)) out.push(lever(STEP_ORDER_LEVER, 'help', 'shown', ['one_step_only', 'wrong_order'],
      'The learner does one step of a two-step rule, or the steps in the wrong order.',
      'Redraws the rule on the machine as its two steps in order, first the multiply, then the add or take away.'));
  }
  if (mode === 'discover_rule' || mode === 'create_rule') {
    out.push(lever(CHECK_PAIRS_LEVER, 'help', 'shown',
      ['fits_some_pairs', 'wrong_rule', 'added_not_multiplied', 'multiplied_not_added', 'one_step_only', 'wrong_order'],
      'The learner\'s rule fits one pair but not the others, or they did not test it.',
      'Runs the learner\'s last checked rule on every pair on screen and marks each pair fits or does not fit.'));
    if (outputSteps(ctx.pairs).length) out.push(lever(OUTPUT_STEPS_LEVER, 'help', 'shown',
      ['added_not_multiplied', 'multiplied_not_added', 'one_step_only', 'wrong_rule'],
      'The learner adds where the rule multiplies, or the other way round.',
      'Marks, between pairs whose inputs differ by one, how much the output changed. It writes no rule.'));
    if (machineModel(c, mode)) out.push(lever(MODEL_LEVER, 'help', 'both', GUESS_MISSES,
      'The learner does not know how to get a rule from pairs, or how to write one.',
      'Shows a different machine of the same kind with its rule written and three of its pairs, so the learner sees how '
        + 'a rule and its pairs go together. It is never this item\'s rule. Read it aloud.'));
  }
  if (mode === 'make_rule') {
    out.push(lever(RUN_MACHINE_LEVER, 'help', 'shown', ['wrong_output', 'no_input'],
      'The learner\'s machine gives the wrong output, or the same output for every input.',
      'Works the learner\'s last checked machine through on the asked input and on one more input, each step written, so '
        + 'they see what their own machine does.'));
    out.push(lever(SHAPES_LEVER, 'help', 'shown', ['not_a_rule', 'no_input', 'same_machine'],
      'The machine cannot run, ignores its input, or works like the first one.',
      'Shows empty machine shapes, each using x with a box for a number, so the learner sees how machines are built and '
        + 'that different shapes are different machines. No number is written.'));
  }
  if (simplerMachine(c, mode)) {
    const answers: readonly FunctionMachineMiss[] = mode === 'make_rule' ? ['wrong_output']
      : mode === 'predict' ? PREDICT_MISSES : GUESS_MISSES.filter(m => m !== 'not_a_rule');
    out.push(lever(SIMPLER_LEVER, 'simplify', 'shown', answers,
      'These numbers or this rule are too hard to work with yet.',
      mode === 'make_rule' ? 'Opens an easier machine to make first, with a smaller pair. It is not graded; the full item comes back after it.'
        : 'Opens an easier machine of the same kind first, a one-step rule with small numbers. It is not graded; the full item comes back after it.'));
  }
  return out;
}

/** What the pulled help levers put on screen, for the tutor and JEV. Never the item's answer. */
export function leverFacts(c: FunctionMachineChallenge | null, pulled: readonly string[], ctx: MachineLeverContext): string {
  if (!c || isPracticeMachine(c)) return '';
  const on = (id: string) => pulled.includes(id);
  const model = on(MODEL_LEVER) ? machineModel(c, ctx.mode) : null;
  const steps = on(STEP_ORDER_LEVER) ? ruleSteps(c.rule) : null;
  const marks = on(CHECK_PAIRS_LEVER) ? pairMarks(ctx.lastGuess, ctx.pairs) : null;
  const changes = on(OUTPUT_STEPS_LEVER) ? outputSteps(ctx.pairs) : [];
  const t = makeRuleTarget(c);
  const run = on(RUN_MACHINE_LEVER) && t && ctx.lastMachine.length ? machineRun(ctx.lastMachine, t.input) : null;
  return [
    model && `Beside the machine is a different machine of the same kind: ${modelText(model)}.`,
    steps && `The rule on the machine is drawn as two steps in order: first ${steps[0]}, then ${steps[1]}.`,
    marks && `The learner's last rule f(x) = ${ctx.lastGuess.trim()} is marked on each pair: `
      + marks.map(m => `${m.input} → ${m.output} ${m.fits ? 'fits' : 'does not fit'}`).join(', ') + '.',
    changes.length && `Between pairs, the output change is marked: ${changes.map(s => `${s.from} to ${s.to}: ${s.change}`).join(', ')}.`,
    run && `The learner's machine f(x) = ${showRule(ctx.lastMachine)} is worked through: ${run.join('; ')}.`,
    on(SHAPES_LEVER) && 'Empty machine shapes are shown, each using x with a box for a number.',
  ].filter((s): s is string => !!s).join(' ');
}
