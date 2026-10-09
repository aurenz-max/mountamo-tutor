/**
 * Function machine on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md).
 *
 * Pure: the component and any probe read the same assignment and scene. Every item is answered on the screen (fed
 * inputs, a typed prediction, a typed rule, or a machine built from tiles) and checked by the activity's own code,
 * so the tutor is never handed a hidden rule, an output not yet fed, or a machine that would make the pair.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { FunctionMachineChallenge, FunctionMachineChallengeType } from './FunctionMachine';
import {
  evaluateRule, rulesEquivalent, makeRuleAsk, makeRuleTarget, showRule, MAKE_RULE_WAYS, type MakeRuleMiss,
} from './functionMachineDomain';

export type FunctionMachineMode = FunctionMachineChallengeType;

/** Pairs fed before observe's Continue appears (the tier may require the whole queue). */
export const observePairsNeeded = (c: FunctionMachineChallenge) => c.pairsRequiredToComplete ?? 3;

/** The ask for one item. Observe and predict state the rule because it is on the machine; no other mode does. */
export function functionMachineTask(c: FunctionMachineChallenge, mode: FunctionMachineMode): string {
  switch (mode) {
    case 'observe':
      return `Feed at least ${observePairsNeeded(c)} numbers into the machine and watch what f(x) = ${c.rule} does to each one, then press Continue.`;
    case 'predict':
      return `The machine's rule is f(x) = ${c.rule}. Before you feed each input, type what will come out, then feed it.`;
    case 'discover_rule':
      return 'The rule is hidden. Feed numbers into the machine, look at what comes out, then type the rule and press Check.';
    case 'create_rule':
      return 'Write the rule that turns every input in the table into its output, then press Check.';
    case 'make_rule': {
      const t = makeRuleTarget(c);
      return t ? `${makeRuleAsk(t.input, t.output, 1)} Then make a different machine that also turns ${t.input} into ${t.output}.`
        : 'Make a machine.';
    }
  }
}

export function workspaceAssignment(c: FunctionMachineChallenge, mode: FunctionMachineMode): TeachingAssignment {
  return { id: c.id, task: functionMachineTask(c, mode), response: 'gesture' };
}

export interface FunctionMachineView {
  /** Input -> output pairs on screen (fed, pre-revealed, or the create_rule table). */
  pairs: ReadonlyArray<{ input: number; output: number }>;
  /** Inputs still waiting to be fed. */
  inputsLeft: readonly number[];
  prediction: string;
  guess: string;
  /** discover_rule: the rule box opens after two pairs. */
  guessOpen: boolean;
  makeRow: readonly string[];
  /** Machines already accepted on this item, as written on screen. */
  made: readonly string[];
  /** The last check's words on screen (make_rule), if any. */
  lastCheck: string;
}

const pairText = (pairs: FunctionMachineView['pairs']) => pairs.map(p => `${p.input} → ${p.output}`).join(', ');

/** The learner's work so far in their own terms, never the key. */
export function describeFunctionWork(mode: FunctionMachineMode, view: FunctionMachineView): string {
  switch (mode) {
    case 'observe': return view.pairs.length ? `Fed ${view.pairs.length} number${view.pairs.length === 1 ? '' : 's'} so far` : 'Nothing fed yet';
    case 'predict': return view.prediction.trim() ? `Typed ${view.prediction.trim()} as the prediction` : 'No prediction typed yet';
    case 'discover_rule':
    case 'create_rule': return view.guess.trim() ? `Typed f(x) = ${view.guess.trim()}` : 'No rule typed yet';
    case 'make_rule': return view.makeRow.length ? `Building f(x) = ${showRule(view.makeRow)}` : 'The machine row is empty';
  }
}

export const describeObserve = (fed: number) => `Fed ${fed} numbers and pressed Continue`;
export const describePrediction = (input: number, predicted: string) => `Predicted ${predicted.trim()} for input ${input}`;
export const describeGuess = (guess: string) => `Wrote f(x) = ${guess.trim()}`;
export const describeMachine = (row: readonly string[], input: number, gave: number | null) =>
  `Built f(x) = ${showRule(row)}; ${gave === null ? 'the machine could not run it' : `fed ${input}, it gave ${gave}`}`;

/**
 * What a wrong check shows (`TeachingAttempt.miss`, handoff 20), from the catalog's commonStruggles (adding for a
 * multiplicative rule, looking at one pair, two-step rules) and the open build's own judge:
 * - predict: `gave_input` (the input back), `added_not_multiplied` (added or subtracted the rule's number where the
 *   rule multiplies or divides), `multiplied_not_added`, `one_step_only` (one step of a two-step rule),
 *   `wrong_order` (the two steps the other way round), `too_high` / `too_low`;
 * - discover_rule, create_rule: `not_a_rule` (cannot run), `fits_some_pairs` (right for some pairs, not all),
 *   `added_not_multiplied`, `multiplied_not_added`, `one_step_only`, `wrong_order`, `wrong_rule`;
 * - make_rule: the open build's `not_a_rule`, `no_input`, `wrong_output`, `same_machine` (`judgeMakeRule`).
 * Observe has no check that can fail: Continue is the item's end.
 */
export type FunctionMachineMiss = 'gave_input' | 'added_not_multiplied' | 'multiplied_not_added' | 'one_step_only'
  | 'wrong_order' | 'too_high' | 'too_low' | 'fits_some_pairs' | 'wrong_rule' | MakeRuleMiss;

const near = (a: number | null, b: number) => a !== null && Math.abs(a - b) < 0.01;

export type RuleShape =
  | { kind: 'add'; c: number }
  | { kind: 'times'; k: number }
  | { kind: 'two_step'; a: number; b: number }
  | { kind: 'other' };

/** What a rule does, read from its outputs: add a number, multiply by one, multiply then add, or something else. */
export function ruleShape(rule: string): RuleShape {
  const v = [0, 1, 2, 3, 4].map(x => evaluateRule(rule, x));
  if (v.some(n => n === null)) return { kind: 'other' };
  const ys = v as number[], b = ys[0], a = ys[1] - ys[0];
  if (!ys.every((y, x) => Math.abs(y - (b + a * x)) < 0.01)) return { kind: 'other' };
  if (Math.abs(a - 1) < 0.01) return Math.abs(b) < 0.01 ? { kind: 'other' } : { kind: 'add', c: b };
  if (Math.abs(b) < 0.01) return Math.abs(a) < 0.01 ? { kind: 'other' } : { kind: 'times', k: a };
  return { kind: 'two_step', a, b };
}

/** predict: the miss a typed prediction shows for one input; undefined when it is right or not a number. */
export function predictMiss(rule: string, input: number, predicted: string): FunctionMachineMiss | undefined {
  const p = parseFloat(predicted), out = evaluateRule(rule, input);
  if (Number.isNaN(p) || out === null || near(p, out)) return undefined;
  if (near(p, input)) return 'gave_input';
  const s = ruleShape(rule);
  if (s.kind === 'times') {
    const n = s.k >= 1 ? s.k : 1 / s.k;
    if (near(p, s.k >= 1 ? input + n : input - n)) return 'added_not_multiplied';
  }
  if (s.kind === 'add' && near(p, s.c > 0 ? input * s.c : input / -s.c)) return 'multiplied_not_added';
  if (s.kind === 'two_step') {
    if (near(p, s.a * input) || near(p, input + s.b)) return 'one_step_only';
    if (near(p, s.a * (input + s.b)) || near(p, s.a * input + s.b / s.a)) return 'wrong_order';
  }
  return p > out ? 'too_high' : 'too_low';
}

/** discover_rule / create_rule: the miss a typed rule shows against the pairs on screen; undefined when right. */
export function guessMiss(guess: string, rule: string, pairs: FunctionMachineView['pairs']): FunctionMachineMiss | undefined {
  if (rulesEquivalent(guess, rule)) return undefined;
  if ([1, 2, 3].every(x => evaluateRule(guess, x) === null)) return 'not_a_rule';
  const fits = pairs.filter(p => near(evaluateRule(guess, p.input), p.output)).length;
  if (fits > 0 && fits < pairs.length) return 'fits_some_pairs';
  const truth = ruleShape(rule), g = ruleShape(guess);
  if (truth.kind === 'times' && g.kind === 'add') return 'added_not_multiplied';
  if (truth.kind === 'add' && g.kind === 'times') return 'multiplied_not_added';
  if (truth.kind === 'two_step' && (g.kind === 'add' || g.kind === 'times')) return 'one_step_only';
  if (truth.kind === 'two_step' && g.kind === 'two_step' && near(g.a, truth.a)
    && (near(g.b, truth.a * truth.b) || near(g.b, truth.b / truth.a))) return 'wrong_order';
  return 'wrong_rule';
}

/** What is drawn and asked. A hidden rule, an output not yet fed and a machine that would work are never listed. */
export function workspaceScene(c: FunctionMachineChallenge, mode: FunctionMachineMode, view: FunctionMachineView): WorkspaceScene {
  const facts: Record<string, string | number> = { kind: mode };
  facts.rule = mode === 'observe' || mode === 'predict' ? `f(x) = ${c.rule}, shown on the machine`
    : mode === 'make_rule' ? 'none: the learner builds the machine' : 'hidden: finding it is the task';
  if (mode === 'create_rule') facts.table = pairText(view.pairs);
  else if (mode !== 'make_rule') {
    facts.pairsOnScreen = pairText(view.pairs) || 'none yet';
    facts.inputsToFeed = view.inputsLeft.join(', ') || 'none left';
  }
  if (mode === 'observe') facts.continueAfter = `${observePairsNeeded(c)} pairs fed`;
  if (mode === 'predict') facts.outputs = 'each output shows only after a right prediction for that input';
  if (mode === 'discover_rule') facts.ruleBox = view.guessOpen ? 'open' : 'opens after 2 pairs';
  if (mode === 'make_rule') {
    const t = makeRuleTarget(c);
    if (t) facts.pair = `${t.input} into ${t.output}`;
    facts.machinesAccepted = view.made.length ? view.made.map(m => `f(x) = ${m}`).join('; ') : 'none yet';
    facts.machinesNeeded = MAKE_RULE_WAYS;
    if (view.lastCheck) facts.lastCheck = view.lastCheck;
  }
  facts.learnerWork = describeFunctionWork(mode, view);
  facts.constraints = 'The learner answers on the screen: feeds inputs, types a prediction or a rule and presses Check, '
    + 'or taps tiles to build a machine and presses I\'m done; the activity checks the work itself. You cannot feed, type '
    + 'or tap for the learner.';
  return { objects: [], facts };
}

/** A plausible wrong rule for the journey and tests: the signature error for the rule's shape, never equivalent to it. */
export function harnessWrongRule(rule: string): string {
  const s = ruleShape(rule);
  if (s.kind === 'times') return s.k >= 1 ? `x+${s.k}` : `x-${Math.round(1 / s.k)}`;
  if (s.kind === 'add') return `${Math.abs(s.c) + 1}*x`;
  if (s.kind === 'two_step') return `${s.a}*x`;
  return rulesEquivalent('x+1', rule) ? 'x+2' : 'x+1';
}

/** make_rule for the journey: the stored machine and a second, different one (x plus or minus the gap), and a wrong one. */
export function harnessMachines(c: FunctionMachineChallenge): { right: [string, string]; wrong: string } | null {
  const t = makeRuleTarget(c);
  if (!t) return null;
  const shift = (to: number) => to === t.input ? 'x' : to > t.input ? `x+${to - t.input}` : `x-${t.input - to}`;
  return { right: [c.rule, shift(t.output)], wrong: shift(t.output + 1) };
}

/** A rule as the tiles that build it ("2*x + 3" -> 2, x, +, 3), for the journey and tests. */
export function ruleTiles(rule: string): string[] {
  const out: string[] = [];
  const ops: Record<string, string> = { '+': '+', '-': '−', '*': '×', '/': '÷', '^': '^', '(': '(', ')': ')' };
  const s = rule.replace(/\s+/g, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    // A number written against x multiplies by position ("2x"), so the × between them is dropped.
    if (ch === '*' && /\d/.test(s[i - 1] ?? '') && s[i + 1] === 'x') continue;
    out.push(ops[ch] ?? ch);
  }
  return out;
}
