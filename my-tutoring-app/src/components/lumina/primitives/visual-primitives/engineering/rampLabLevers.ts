/**
 * The in-item levers on ramp-lab, every mode (`/add-support-tiers`, class sweep 2026-10-08; table and evidence in
 * qa/eval-reports/ramp-lab-levers-2026-10-08.md). No real-learner evidence: the misses are what `rampMiss` and
 * `rampSpokenMisses` name, the contract's refusal list (reversed comparison, one observation) and the catalog struggles.
 *
 * compare_conditions — which setup needs less push IS the answer, so help draws the setups as given or models a pair
 * on a condition the item does not change.
 * - `both_ramps` (help): both setups drawn side by side at one scale, each with its slope, surface texture and load.
 *   No force, no arrow, no mark on either.
 * - `model_pair` (help): two measured ramps that differ in another condition, and what that change did to the push.
 * find_threshold / design_with_budget
 * - `test_log` (help): every value the learner checked on this item, smallest first, with what the lab showed for it
 *   (moved / stayed still; climbs / too steep). Only values the learner tested; refused before the first check.
 * - `lighter_load` (simplify, find_threshold): an ungraded search for a small wheel on a gentle ramp in whole newtons.
 * - `fewer_angles` (simplify, design_with_budget): an ungraded design for another load with six angles to choose from.
 * plan_fair_test
 * - `same_or_changed` (help): beside each setting of setup B, a tag saying whether it matches setup A. All settings are
 *   tagged alike; none is named as the one to change.
 * - `model_plan` (help): a fair plan for another condition, worked.
 * - `two_settings` (simplify): an ungraded plan for another condition where only two settings can be changed; a fair
 *   plan commits it. Then the full item.
 * explain_from_trials (spoken)
 * - `push_bars` (help): beside the notebook, one bar per recorded trial, its length the first moving push, labelled with
 *   that setup's value of the changed condition. No ranking words. Refused before both trials are recorded.
 * - `model_explain` (help): a worked explanation of two trials on another condition.
 * - no simplify: an explanation one step simpler (say only which setup needed less push) drops the link to the changed
 *   condition, which is the mode.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import {
  changedRampVariables, maxWorkableAngle, minimumPushSetting, requiredPushForce,
  type CompareConditionsChallenge, type DesignWithBudgetChallenge, type FindThresholdChallenge, type InvestigationVariable,
  type RampChallenge, type RampInvestigationChallenge, type RampScenario, type RampTrial,
} from './rampChallenges';

export const BOTH_RAMPS_LEVER = 'both_ramps';
export const MODEL_PAIR_LEVER = 'model_pair';
export const TEST_LOG_LEVER = 'test_log';
export const LIGHTER_LOAD_LEVER = 'lighter_load';
export const FEWER_ANGLES_LEVER = 'fewer_angles';
export const SAME_OR_CHANGED_LEVER = 'same_or_changed';
export const MODEL_PLAN_LEVER = 'model_plan';
export const TWO_SETTINGS_LEVER = 'two_settings';
export const PUSH_BARS_LEVER = 'push_bars';
export const MODEL_EXPLAIN_LEVER = 'model_explain';
const SIMPLIFY = new Set([LIGHTER_LOAD_LEVER, FEWER_ANGLES_LEVER, TWO_SETTINGS_LEVER]);

export const SIMPLER_SUFFIX = '~simpler';
export const isPracticeRamp = (c: Pick<RampChallenge, 'id'>) => c.id.endsWith(SIMPLER_SUFFIX);

export const VARIABLE_NAME: Record<InvestigationVariable, string> = { angle: 'ramp angle', surface: 'surface', mass: 'box mass' };
const SURFACE: Record<RampScenario['frictionLevel'], string> = { none: 'frictionless', low: 'smooth', medium: 'grippy', high: 'rough' };
const KEY_VARIABLE: Record<string, InvestigationVariable> = { angle: 'angle', loadWeight: 'mass', frictionLevel: 'surface' };

/** One setting of a setup, in words: "15 degrees", "rough", "6 kg". */
export const settingOf = (s: RampScenario, v: InvestigationVariable) =>
  v === 'angle' ? `${s.angle} degrees` : v === 'surface' ? SURFACE[s.frictionLevel] : `${s.loadWeight} kg`;
export const describeSetup = (s: RampScenario) =>
  `a ${s.loadWeight} kg ${s.loadType === 'custom' ? 'load' : s.loadType} on a ${SURFACE[s.frictionLevel]} ${s.angle} degree ramp`;

// ── Models on another condition (model_pair, model_plan, model_explain) ─────────

/** The conditions an item touches: what its two setups differ in, plus an investigation's requested condition. */
function conditionsOf(c: RampChallenge): Set<InvestigationVariable> {
  const out = new Set<InvestigationVariable>();
  if ('scenarios' in c) for (const k of changedRampVariables(c.scenarios.a, c.scenarios.b)) if (KEY_VARIABLE[k]) out.add(KEY_VARIABLE[k]);
  if ('variable' in c) out.add(c.variable);
  // A load swap (wheel or box) is about rolling against sliding: a surface model would answer it.
  if (c.mode === 'compare_conditions' && c.changedVariable === 'load') out.add('surface');
  if (c.mode === 'compare_conditions' && c.changedVariable !== 'load') out.add(c.changedVariable);
  return out;
}

const MODEL_BASE: RampScenario = { label: 'Model', angle: 25, loadWeight: 4, loadType: 'box', frictionLevel: 'medium' };
const MODEL_CHANGE: Record<InvestigationVariable, [Partial<RampScenario>, Partial<RampScenario>]> = {
  mass: [{ loadWeight: 2 }, { loadWeight: 6 }],
  surface: [{ frictionLevel: 'low' }, { frictionLevel: 'high' }],
  angle: [{ angle: 15 }, { angle: 35 }],
};

export interface RampModel { variable: InvestigationVariable; one: RampScenario; two: RampScenario; pushOne: number; pushTwo: number }

/** A measured pair on a condition the item never touches; null when it touches all three. */
export function modelFor(c: RampChallenge): RampModel | null {
  const touched = conditionsOf(c);
  const variable = (['mass', 'surface', 'angle'] as const).find(v => !touched.has(v));
  if (!variable) return null;
  const [x, y] = MODEL_CHANGE[variable];
  const one = { ...MODEL_BASE, ...x, label: 'Model ramp 1' }, two = { ...MODEL_BASE, ...y, label: 'Model ramp 2' };
  return { variable, one, two, pushOne: minimumPushSetting(one), pushTwo: minimumPushSetting(two) };
}

const MORE: Record<InvestigationVariable, string> = { mass: 'heavier box', surface: 'rough surface', angle: 'steeper ramp' };
/** The model's own conclusion, about the model's ramps only. */
export const modelConclusion = (m: RampModel) =>
  `Only the ${VARIABLE_NAME[m.variable]} changed, and the ${MORE[m.variable]} needed more push.`;

// ── test_log ────────────────────────────────────────────────────────────────

export interface LoggedTest { value: number; result: 'moved' | 'stayed still' | 'climbs' | 'too steep' }

/** The learner's checked values on this item, smallest first, each with what the lab showed for it. Only theirs. */
export function testLog(c: RampChallenge, tested: readonly number[]): LoggedTest[] {
  const values = Array.from(new Set(tested)).sort((x, y) => x - y);
  if (c.mode === 'find_threshold') {
    const threshold = requiredPushForce(c.scenario);
    return values.map(value => ({ value, result: value > threshold ? 'moved' : 'stayed still' }));
  }
  if (c.mode === 'design_with_budget') {
    return values.map(value => ({ value, result: c.forceBudget > requiredPushForce({ ...c.scenario, angle: value }) ? 'climbs' : 'too steep' }));
  }
  return [];
}

/** `test_log` leak rule: the log shows nothing the learner did not test. */
export const testLogLeaks = (log: readonly LoggedTest[], tested: readonly number[]) => log.some(e => !tested.includes(e.value));

const unit = (c: RampChallenge, v: number) => c.mode === 'find_threshold' ? `${v.toFixed(1)} N` : `${v} degrees`;

// ── both_ramps ──────────────────────────────────────────────────────────────

/** What a side-by-side sketch draws for one setup: its slope, its surface, its load. Nothing measured. */
export interface RampSketch { side: 'a' | 'b'; angle: number; surface: string; load: string; mass: number }
export const rampSketches = (c: CompareConditionsChallenge): RampSketch[] => (['a', 'b'] as const).map(side => {
  const s = c.scenarios[side];
  return { side, angle: s.angle, surface: SURFACE[s.frictionLevel], load: s.loadType === 'custom' ? 'load' : s.loadType, mass: s.loadWeight };
});

// ── same_or_changed ─────────────────────────────────────────────────────────

/** Each editable setting of setup B against setup A. Every setting gets a tag; none is singled out. */
export function settingMarks(a: RampScenario, b: RampScenario): Record<InvestigationVariable, 'same as A' | 'changed'> {
  const mark = (x: unknown, y: unknown) => (x === y ? 'same as A' : 'changed');
  return { angle: mark(a.angle, b.angle), mass: mark(a.loadWeight, b.loadWeight), surface: mark(a.frictionLevel, b.frictionLevel) };
}

// ── push_bars ───────────────────────────────────────────────────────────────

export interface PushBar { side: 'a' | 'b'; push: number; label: string; widthPercent: number }
/** One bar per recorded trial, in A-then-B order; empty until both trials are recorded. */
export function pushBars(c: RampInvestigationChallenge, trials: readonly RampTrial[]): PushBar[] {
  const a = trials.find(t => t.side === 'a'), b = trials.find(t => t.side === 'b');
  if (!a || !b) return [];
  const top = Math.max(a.firstMovingForce, b.firstMovingForce, 0.5);
  return [a, b].map(t => ({ side: t.side, push: t.firstMovingForce, label: settingOf(t.scenario, c.variable),
    widthPercent: Math.round(100 * t.firstMovingForce / top) }));
}

// ── Simpler items (simplify levers) ─────────────────────────────────────────

const PRACTICE_PUSH: readonly RampScenario[] = [
  { label: 'Small wheel', angle: 10, loadWeight: 2, loadType: 'wheel', frictionLevel: 'low' },
  { label: 'Small box', angle: 15, loadWeight: 2, loadType: 'box', frictionLevel: 'low' },
];

/** find_threshold: a small wheel on a gentle smooth ramp, whole-newton steps. Null when the item is already that small. */
export function lighterLoad(c: RampChallenge): FindThresholdChallenge | null {
  if (c.mode !== 'find_threshold' || isPracticeRamp(c)) return null;
  const own = minimumPushSetting(c.scenario, c.forceStep);
  if (c.forceStep >= 1 && own <= 8) return null;
  const scenario = PRACTICE_PUSH.find(s => changedRampVariables(s, c.scenario).length > 0 && minimumPushSetting(s, 1) !== own)!;
  return { ...c, id: c.id + SIMPLER_SUFFIX, title: 'Practice: a lighter load', scenario: { ...scenario }, forceStep: 1,
    brief: 'Practice first: find the smallest push that makes this small wheel or box climb. The push changes in whole newtons.',
    hint: 'Raise the push one step at a time and test each one.', explainOnSolve: 'You found the first push that moves it.' };
}

const PRACTICE_LOADS: readonly RampScenario[] = [
  { label: 'Light cart', angle: 0, loadWeight: 3, loadType: 'wheel', frictionLevel: 'low' },
  { label: 'Small crate', angle: 0, loadWeight: 4, loadType: 'box', frictionLevel: 'medium' },
];

/** design_with_budget: another load, six whole-degree angles to choose from. Null when the item already offers that few. */
export function fewerAngles(c: RampChallenge): DesignWithBudgetChallenge | null {
  if (c.mode !== 'design_with_budget' || isPracticeRamp(c)) return null;
  if (c.angleRange.max - c.angleRange.min <= 5) return null;
  const own = maxWorkableAngle(c.scenario, c.forceBudget, c.angleRange);
  const load = PRACTICE_LOADS.find(s => s.loadType !== c.scenario.loadType || s.frictionLevel !== c.scenario.frictionLevel
    || s.loadWeight !== c.scenario.loadWeight)!;
  const answer = own === 20 ? 26 : 20;
  const angleRange = { min: answer - 3, max: answer + 2 };
  const atAnswer = requiredPushForce({ ...load, angle: answer }), atNext = requiredPushForce({ ...load, angle: answer + 1 });
  return { ...c, id: c.id + SIMPLER_SUFFIX, title: 'Practice: fewer angles', scenario: { ...load, angle: angleRange.max },
    forceBudget: Number(((atAnswer + atNext) / 2).toFixed(2)), angleRange,
    brief: 'Practice first: find the steepest ramp this push budget can handle. Only six angles to try.',
    hint: 'Check an angle, then try the next one.', explainOnSolve: 'You found the steepest angle that still works.' };
}

const NEXT_VARIABLE: Record<InvestigationVariable, InvestigationVariable> = { angle: 'surface', surface: 'mass', mass: 'angle' };
const PRACTICE_A: readonly RampScenario[] = [
  { label: 'Setup A', angle: 25, loadWeight: 4, loadType: 'box', frictionLevel: 'medium' },
  { label: 'Setup A', angle: 15, loadWeight: 2, loadType: 'box', frictionLevel: 'low' },
];

/** plan_fair_test: a plan for another condition with only two settings to change; a fair plan commits it. */
export function twoSettings(c: RampChallenge): RampInvestigationChallenge | null {
  if (c.mode !== 'plan_fair_test' || isPracticeRamp(c) || (c.editable && c.editable.length <= 2)) return null;
  const variable = NEXT_VARIABLE[c.variable];
  const other = NEXT_VARIABLE[variable];
  const a = PRACTICE_A.find(s => changedRampVariables(s, c.scenarios.a).length > 0)!;
  return { ...c, id: c.id + SIMPLER_SUFFIX, variable, editable: [variable, other], title: 'Practice: plan with two settings',
    scenarios: { a: { ...a }, b: { ...a, label: 'Setup B' } },
    brief: `Practice first: plan a fair test of how the ${VARIABLE_NAME[variable]} affects the push. Only two settings can change here.`,
    hint: 'A fair test changes one thing.' };
}

/** The simpler item a simplify lever opens on this item, if there is one. */
export function simplerRamp(c: RampChallenge): RampChallenge | null {
  return lighterLoad(c) ?? fewerAngles(c) ?? twoSettings(c);
}

/** Rebuild a practice item from its id and the session's items (the journey and the component use the same builders). */
export function practiceFromId(items: readonly RampChallenge[], id: string): RampChallenge | null {
  if (!id.endsWith(SIMPLER_SUFFIX)) return null;
  const parent = items.find(c => c.id + SIMPLER_SUFFIX === id);
  return parent ? simplerRamp(parent) : null;
}

// ── Declarations ────────────────────────────────────────────────────────────

/** Levers the tier starts pulled (`supportTier` easy): a starting position, never a recorded pull. */
export function startLevers(c: RampChallenge | null | undefined, tier?: string): string[] {
  if (!c || tier !== 'easy') return [];
  switch (c.mode) {
    case 'compare_conditions': return [BOTH_RAMPS_LEVER];
    case 'find_threshold': case 'design_with_budget': return [TEST_LOG_LEVER];
    case 'plan_fair_test': return [SAME_OR_CHANGED_LEVER];
    default: return [PUSH_BARS_LEVER];
  }
}

const FENCE = 'It is a different pair of ramps; never say which of the learner\'s setups needs less push or what the '
  + 'learner\'s condition does to the push.';

export function rampLevers(c: RampChallenge | null | undefined, pulled: readonly string[]): WorkspaceLever[] {
  if (!c) return [];
  const lever = (id: string, carrier: WorkspaceLever['carrier'], answers: readonly string[], when: string, does: string): WorkspaceLever =>
    ({ id, kind: SIMPLIFY.has(id) ? 'simplify' : 'help', carrier, pulled: pulled.includes(id), answers, when, does });
  const model = modelFor(c);
  const simpler = simplerRamp(c);
  const ungraded = ' It is not graded; the full item comes back after it.';
  switch (c.mode) {
    case 'compare_conditions': return [
      lever(BOTH_RAMPS_LEVER, 'shown', ['harder_setup', 'same_for_different', 'one_for_same'],
        'The learner sees only one setup at a time and does not compare the two ramps.',
        'Draws both setups side by side at the same scale, each with its slope, surface texture and load. It draws no force, '
          + 'no arrow and no mark on either setup.'),
      ...(model ? [lever(MODEL_PAIR_LEVER, 'both', ['harder_setup', 'same_for_different'],
        'The learner does not connect a change in a ramp to the push it needs.',
        `Shows two measured model ramps beside the lab that differ only in ${VARIABLE_NAME[model.variable]}, and the push each `
          + `needed. ${FENCE}`)] : []),
    ];
    case 'find_threshold': return [
      lever(TEST_LOG_LEVER, 'shown', ['load_did_not_move', 'more_than_minimum'],
        'The learner loses track of which pushes moved the load and which did not, so cannot narrow the search.',
        'Under the slider, lists every push the learner tested on this item, smallest first, each marked moved or stayed still. '
          + 'Never a push they have not tested.'),
      ...(simpler ? [lever(LIGHTER_LOAD_LEVER, 'shown', ['load_did_not_move', 'more_than_minimum'],
        'The search has too many steps for the learner yet.',
        `Opens an easier search first: a small wheel or box on a gentle smooth ramp, the push in whole newtons.${ungraded}`)] : []),
    ];
    case 'design_with_budget': return [
      lever(TEST_LOG_LEVER, 'shown', ['over_budget', 'not_steepest'],
        'The learner loses track of which angles worked and which were too steep, so cannot find the boundary.',
        'Under the angle slider, lists every angle the learner checked on this item, smallest first, each marked climbs or too '
          + 'steep. Never an angle they have not checked.'),
      ...(simpler ? [lever(FEWER_ANGLES_LEVER, 'shown', ['over_budget', 'not_steepest'],
        'There are too many angles to search for the learner yet.',
        `Opens an easier design first: another load with only six angles to choose from.${ungraded}`)] : []),
    ];
    case 'plan_fair_test': return [
      lever(SAME_OR_CHANGED_LEVER, 'shown', ['nothing_changed', 'extra_condition', 'other_condition'],
        'The learner does not compare every setting of setup B with setup A before committing.',
        'Beside each setting of setup B, a tag says whether it is the same as setup A or changed, and updates as the learner '
          + 'edits. Every setting is tagged the same way; it never says which setting to change.'),
      ...(model ? [lever(MODEL_PLAN_LEVER, 'both', ['other_condition', 'extra_condition'],
        'The learner does not know what a fair plan looks like.',
        `Shows a worked fair plan for a different question, how the ${VARIABLE_NAME[model.variable]} affects the push: only `
          + 'that setting differs between its two setups. Never say which setting the learner should change.')] : []),
      ...(simpler ? [lever(TWO_SETTINGS_LEVER, 'shown', ['nothing_changed', 'extra_condition', 'other_condition'],
        'Three settings are too many to keep track of yet.',
        `Opens an easier plan first: a different condition to test, with only two settings that can change.${ungraded}`)] : []),
    ];
    default: return [
      lever(PUSH_BARS_LEVER, 'shown', ['reversed_comparison', 'said_same', 'one_setup'],
        'The learner does not link the two trial results to the changed condition.',
        `Beside the trial notebook, draws one bar per trial, as long as its first moving push, labelled with that setup's `
          + `${VARIABLE_NAME[c.variable]}. No words compare them. Only after both trials are recorded.`),
      ...(model ? [lever(MODEL_EXPLAIN_LEVER, 'both', ['reversed_comparison', 'said_same', 'one_setup'],
        'The learner does not know how to explain a result from two trials.',
        `Shows a worked explanation of two model trials that differ only in ${VARIABLE_NAME[model.variable]}: both results and `
          + `what the change did. ${FENCE}`)] : []),
    ];
  }
}

/** What the pulled levers put on screen, for the tutor and JEV. Describes what is drawn, never the key. */
export function leverFacts(c: RampChallenge | null | undefined, pulled: readonly string[],
  view: { tested?: readonly number[]; trials?: readonly RampTrial[] }): string {
  if (!c) return '';
  const on = (id: string) => pulled.includes(id);
  const model = modelFor(c);
  const modelText = model ? `${describeSetup(model.one)} first moved at ${model.pushOne.toFixed(1)} N; ${describeSetup(model.two)} `
    + `first moved at ${model.pushTwo.toFixed(1)} N.` : '';
  const out: Array<string | false> = [];
  if (c.mode === 'compare_conditions') {
    out.push(on(BOTH_RAMPS_LEVER) && `Both setups are drawn side by side at the same scale: ${rampSketches(c)
      .map(s => `${s.side.toUpperCase()}, a ${s.angle} degree ${s.surface} ramp with a ${s.mass} kg ${s.load}`).join('; ')}.`);
    out.push(on(MODEL_PAIR_LEVER) && !!model && `Two model ramps are shown beside the lab: ${modelText} ${modelConclusion(model!)}`);
  }
  if (c.mode === 'find_threshold' || c.mode === 'design_with_budget') {
    const log = testLog(c, view.tested ?? []);
    out.push(on(TEST_LOG_LEVER) && (log.length
      ? `A log lists what the learner tested, smallest first: ${log.map(e => `${unit(c, e.value)} ${e.result}`).join('; ')}.`
      : 'A log will list each value the learner tests; nothing is tested yet.'));
  }
  if (c.mode === 'plan_fair_test') {
    out.push(on(SAME_OR_CHANGED_LEVER) && 'Beside each setting of setup B, a tag says whether it is the same as setup A or changed.');
    out.push(on(MODEL_PLAN_LEVER) && !!model && `A worked fair plan for how the ${VARIABLE_NAME[model.variable]} affects the push `
      + `is shown: model setup 1 is ${describeSetup(model.one)}, model setup 2 is ${describeSetup(model.two)}.`);
  }
  if (c.mode === 'explain_from_trials') {
    const bars = pushBars(c, view.trials ?? []);
    out.push(on(PUSH_BARS_LEVER) && (bars.length
      ? `Beside the notebook, a bar for each trial is as long as its first moving push: ${bars
        .map(b => `${b.side.toUpperCase()} (${VARIABLE_NAME[c.variable]} ${b.label}) ${b.push.toFixed(1)} N`).join(', ')}.`
      : 'Bars for the two trials will show beside the notebook once both trials are recorded.'));
    out.push(on(MODEL_EXPLAIN_LEVER) && !!model && `A worked explanation of two model trials is shown: ${modelText} `
      + modelConclusion(model!));
  }
  return out.filter((s): s is string => !!s).join(' ');
}
