/**
 * The in-item levers on di-worked-procedure (`/add-support-tiers`, DI family 7; table
 * qa/support-levers/di-worked-procedure-lever-table-2026-10-03.md). No real-learner evidence: the misses are what
 * `workedProcedureSpokenMisses` names and the catalog's `commonStruggles`.
 *
 * A session item is one STEP of a problem (decide per column; after a regroup, subtract). Lever state is per step.
 *
 * Help:
 * - `model_problem` (every step): a small card with a DIFFERENT subtraction of the same width, fully worked. Its
 *   regroup pattern is fixed per width and mode (2 digits: ones regroup; 3 digits: ones regroup, tens and hundreds
 *   clean; no-regroup mode: all clean), so it says nothing about which of the item's columns regroup. No model column
 *   has an item column's pair or its flip; no number the model says is a step answer of the item's problem; per
 *   column, its difference is not within one of the item's. Computed per PROBLEM, so it does not change between steps.
 * - `top_blocks` (decide steps; R9 allows it on a regroup decision): under each column, its top number as it reads now
 *   as place pieces. Never the bottom number, never a strike or a trade, never a count.
 * - `take_away_cubes` (subtract steps, and every no-regroup step): the column's top as cubes, the last `bottom` of them
 *   crossed out. Never a count of what is left. Refused on a regroup decide step: crossing out shows whether there are
 *   enough, which is the decision.
 * Simplify:
 * - `fewer_columns` (subtract_regroup): only on a tens-column regroup decide step of a 3-digit problem, and only after
 *   a `no_decrement` miss on it. An ungraded ones-column regroup decide step of a 2-digit problem (it keeps the regroup,
 *   the mode floor); then the full step.
 * No simplify after `upside_down_column` or `said_no_regroup`: the practice regroups, which hands over "regroup".
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { numberWord, planSubtraction, type SubtractionPlan } from './diWorkedProcedurePlan';
import { itemsFromProblems, type WorkedProcedureItem } from './diWorkedProcedureScript';

export const MODEL_PROBLEM = 'model_problem';
export const TOP_BLOCKS = 'top_blocks';
export const TAKE_AWAY_CUBES = 'take_away_cubes';
export const FEWER_COLUMNS = 'fewer_columns';

const OFF_BY = ['one_short', 'one_over', 'short_by_more', 'over_by_more'];
const w = numberWord;

/** The step answers of a problem: each difference, and on a regroup the new numbers above and in the column. */
function stepAnswers(plan: SubtractionPlan): Set<number> {
  const out = new Set<number>();
  plan.columns.forEach((c, i) => {
    out.add(c.difference);
    if (c.regroup) { out.add(c.effectiveTop); out.add(plan.columns[i + 1].top - 1); }
  });
  return out;
}

/** The model's leak rule against the child's problem. */
export function modelLeaks(model: SubtractionPlan, item: SubtractionPlan): boolean {
  if (model.digits !== item.digits) return true;
  // The card says its whole answer: never the child's.
  if (model.difference === item.difference || model.minuend === item.minuend || model.subtrahend === item.subtrahend) return true;
  const pairs = new Set(item.columns.flatMap(c => [`${c.top}/${c.bottom}`, `${c.bottom}/${c.top}`]));
  if (model.columns.some(c => pairs.has(`${c.top}/${c.bottom}`))) return true;
  // The model's own step answers (its regrouped numbers and differences) are never a step answer of the child's
  // problem. Digits it reads off its page are not checked: with them the rule left 60 − 22 with no model at all.
  const answers = stepAnswers(item);
  if (Array.from(stepAnswers(model)).some(n => answers.has(n))) return true;
  return model.columns.some((c, i) => Math.abs(c.difference - item.columns[i].difference) <= 1);
}

/** The fixed regroup pattern of a model, per width and mode. */
const patternOk = (plan: SubtractionPlan, regroupMode: boolean) => regroupMode
  ? plan.columns.every((c, i) => c.regroup === (i === 0))
  : plan.columns.every(c => !c.regroup);

const MODEL_CACHE = new Map<string, SubtractionPlan | null>();

/** The model problem for an item's PROBLEM, or null. Deterministic; the search starts at a point derived from the item. */
export function modelFor(item: Pick<WorkedProcedureItem, 'minuend' | 'subtrahend' | 'challengeType'>): SubtractionPlan | null {
  const key = `${item.minuend}-${item.subtrahend}-${item.challengeType}`;
  if (MODEL_CACHE.has(key)) return MODEL_CACHE.get(key)!;
  const own = planSubtraction(item.minuend, item.subtrahend);
  let found: SubtractionPlan | null = null;
  if (own) {
    const lo = own.digits === 2 ? 10 : 100, hi = own.digits === 2 ? 99 : 999, span = hi - lo + 1;
    const regroupMode = item.challengeType === 'subtract_regroup';
    const start = (item.minuend * 7 + item.subtrahend * 13) % span;
    outer: for (let k = 0; k < span; k++) {
      const m = lo + ((start + k) % span);
      for (let s = lo; s < m; s++) {
        const plan = planSubtraction(m, s);
        if (plan && patternOk(plan, regroupMode) && !modelLeaks(plan, own)) { found = plan; break outer; }
      }
    }
  }
  MODEL_CACHE.set(key, found);
  return found;
}

/** The model as it is said, column by column, ones first. */
export function modelWalk(plan: SubtractionPlan): string {
  const steps = plan.columns.map((c, i) => c.regroup
    ? `${c.place}: I can't take ${w(c.bottom)} from ${w(c.topAfterLend)}, so I regroup: ${w(plan.columns[i + 1].top - 1)} ${plan.columns[i + 1].place}, ${w(c.effectiveTop)} ${c.place}; ${w(c.effectiveTop)} minus ${w(c.bottom)} is ${w(c.difference)}`
    : `${c.place}: ${w(c.topAfterLend)} minus ${w(c.bottom)} is ${w(c.difference)}`);
  return `${plan.minuend} − ${plan.subtrahend}. ${steps.join('. ')}. The answer is ${plan.difference}.`;
}

/** `fewer_columns`: a 2-digit one-regroup problem's first (ones) decide step, or null. */
export function fewerColumnsFor(item: WorkedProcedureItem, lastMiss?: string): WorkedProcedureItem | null {
  if (item.challengeType !== 'subtract_regroup' || item.kind !== 'decide' || !item.regroup || item.columnIndex !== 1
    || String(item.minuend).length !== 3 || lastMiss !== 'no_decrement') return null;
  const c = item.column, pair = (t: number, b: number) => (t === c.top && b === c.bottom) || (t === c.bottom && b === c.top);
  for (let m = 21; m <= 99; m++) for (let s = 10; s < m; s++) {
    const plan = planSubtraction(m, s);
    if (!plan || plan.regroupCount !== 1 || !plan.columns[0].regroup) continue;
    const ones = plan.columns[0], newAbove = plan.columns[1].top - 1;
    if (pair(ones.top, ones.bottom) || newAbove === item.newAbove || ones.effectiveTop === c.effectiveTop) continue;
    const [step] = itemsFromProblems([{ id: `${item.id}~simpler`, minuend: m, subtrahend: s, challengeType: 'subtract_regroup',
      supportTier: item.supportTier }]).items;
    if (step) return step;
  }
  return null;
}

/** Levers an item's tier starts with on screen: only easy (no tier is medium in this pack). Not a pull. */
export const startingLevers = (item: WorkedProcedureItem): string[] =>
  item.supportTier === 'easy' && modelFor(item) ? [MODEL_PROBLEM] : [];

const regroupDecide = (item: WorkedProcedureItem) => item.challengeType === 'subtract_regroup' && item.kind === 'decide';

export function procedureLevers(item: WorkedProcedureItem | null, pulled: readonly string[], lastMiss?: string): WorkspaceLever[] {
  if (!item) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: string[], when: string,
    does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  const out: WorkspaceLever[] = [];
  const decideMisses = ['upside_down_column', 'no_decrement', 'said_no_regroup', 'regrouped_needlessly', 'read_crossed_out', ...OFF_BY];
  if (modelFor(item)) out.push(lever(MODEL_PROBLEM, 'help', 'both', decideMisses,
    'The learner makes a wrong move or gets a wrong number, or does not know how to start.',
    'Shows a small card with a DIFFERENT subtraction, fully worked (onScreen gives its walk). Say every column of it in '
      + 'order as your turn, never only the one like the learner\'s step, then ask the ringed column again. Never apply it '
      + 'to their problem.'));
  if (item.kind === 'decide') out.push(lever(TOP_BLOCKS, 'help', 'shown',
    ['upside_down_column', 'no_decrement', 'said_no_regroup', 'regrouped_needlessly', 'read_crossed_out', ...OFF_BY],
    'The learner reads the column the wrong way up, or misjudges whether the top number is enough.',
    'Draws each column\'s top number, as it reads now, as place-value pieces under the problem. No count, no bottom number. '
      + 'Point at the pieces and ask what they do in the column; never ask whether the top is enough or name the column\'s digits.'));
  if (!regroupDecide(item)) out.push(lever(TAKE_AWAY_CUBES, 'help', 'shown', ['upside_down_column', ...OFF_BY],
    'The learner gets the column\'s difference wrong.',
    'Draws the ringed column\'s top number as cubes with the bottom number of them crossed out. Never say how many are left.'));
  if (fewerColumnsFor(item, lastMiss)) out.push(lever(FEWER_COLUMNS, 'simplify', 'both', ['no_decrement'],
    'The learner regroups but leaves the place above unchanged.',
    'Opens a smaller problem\'s regroup step first (two digits). It is not graded; the full step comes back after it.'));
  return out;
}

/** What the pulled levers put on screen, as a scene fact. Gives the model's walk; never a step answer of this problem. */
export function procedureLeverFacts(item: WorkedProcedureItem | null, pulled: readonly string[]): string {
  if (!item) return '';
  const model = pulled.includes(MODEL_PROBLEM) ? modelFor(item) : null;
  return [
    model && `Beside the problem, a model card shows a different subtraction, fully worked: ${modelWalk(model)} It is not this problem.`,
    pulled.includes(TOP_BLOCKS) && item.kind === 'decide' && 'Place-value pieces under each column show its top number as it reads now.',
    pulled.includes(TAKE_AWAY_CUBES) && 'Cubes under the ringed column show its top number with the bottom number of them crossed out.',
  ].filter((s): s is string => !!s).join(' ');
}
