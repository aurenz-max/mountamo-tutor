/**
 * The in-item levers on how-it-works (`/add-support-tiers`; report qa/eval-reports/how-it-works-levers-2026-10-16.md).
 * No real-learner evidence: the misses are what `howMiss` observes; the failures behind them are documented (the old
 * catalog's commonStruggles: sequence challenges, predict questions, steps read too fast) or inferred (a neighbouring
 * step confused with the right one, a step that comes later chosen as next, a description not tied to its step). Every
 * lever starts released; `config.difficulty` changes the items, not the levers.
 *
 * - `step_numbers` (help; identify with no step list on screen): each choice shows its step number in the process.
 * - `two_choices` (help; every choice item with three or more choices): crosses out choices until two are left, the
 *   right one and one that is not its neighbour when there is one. Never one choice left.
 * - `last_step` (help; predict, readers): the last shown step's description under the step list, with the next step's
 *   name blanked out of it.
 * - `show_step` (help; explain): the asked step's description under the question.
 * - `show_why` (help; sequence, readers whose steps all have a purpose): under each card, what that step makes possible.
 * - `easier_item` (simplify; choice items): another step's item of the same kind with two choices, ungraded, then the
 *   full item back.
 * - `fewer_cards` (simplify; sequence): the first three cards (two when there are three), by name, ungraded.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import {
  bankFor, blankTitle, CHOICE_MISSES, choiceMiss, choiceText, cardText, firstSentences, keyStep, NEXT_MISSES, ORDER_MISSES, orderMiss, purposeOf,
  seededRng, type ChoiceItem, type HowItem, type HowMiss, type OrderMiss, type ProcessStep,
} from './howItWorksWorkspace';

export const STEP_NUMBERS_LEVER = 'step_numbers';
export const TWO_CHOICES_LEVER = 'two_choices';
export const LAST_STEP_LEVER = 'last_step';
export const SHOW_STEP_LEVER = 'show_step';
export const SHOW_WHY_LEVER = 'show_why';
export const EASIER_ITEM_LEVER = 'easier_item';
export const FEWER_CARDS_LEVER = 'fewer_cards';

const PRACTICE = '~simpler';
export const isPractice = (item: Pick<HowItem, 'id'>) => item.id.endsWith(PRACTICE);
export const practiceParent = (id: string) => (id.endsWith(PRACTICE) ? id.slice(0, -PRACTICE.length) : null);

/** two_choices: the choices crossed out. Kept: the key, and the foil farthest from it. */
export function crossedOut(item: ChoiceItem): number[] {
  const key = keyStep(item);
  const foils = item.options.filter(o => o !== key);
  if (foils.length < 2) return [];
  const keep = [...foils].sort((a, b) => Math.abs(b - key) - Math.abs(a - key))[0];
  return foils.filter(o => o !== keep);
}

/** last_step: the last shown step's description, the next step's name blanked. */
export const lastStepLine = (steps: ProcessStep[], item: Extract<HowItem, { kind: 'predict' }>): string =>
  blankTitle(firstSentences(steps[item.shown - 1].clue, 2, 260), steps[item.shown].title);

/** show_step: the asked step's description. */
export const showStepLine = (steps: ProcessStep[], item: Extract<HowItem, { kind: 'explain' }>): string =>
  firstSentences(steps[item.target].clue, 2, 260);

/** show_why: what each card's step makes possible. */
export const whyLine = (steps: ProcessStep[], i: number): string => purposeOf(steps, i);

const words = (s: string) => new Set((s.toLowerCase().match(/[a-z]{4,}/g) ?? []));
/** Share of the right purpose's words a description repeats: show_step is withheld above one half. */
export function purposeOverlap(desc: string, purpose: string): number {
  const p = words(purpose), d = words(desc);
  return p.size ? Array.from(p).filter(w => d.has(w)).length / p.size : 1;
}

/** The leak rule for every lever line: it never names the item's key. */
export function leverLeaks(steps: ProcessStep[], item: HowItem, line: string): boolean {
  const l = line.toLowerCase();
  if (item.kind === 'sequence') return /\b(first|second|third|last|step \d|\d\))/i.test(line);
  const key = keyStep(item);
  if (item.kind === 'explain') return l.includes(choiceText(steps, item, key).toLowerCase().slice(0, 40));
  return l.includes(steps[key].title.toLowerCase());
}

// ── Simplify: practice items ─────────────────────────────────────────────────────────────

/** The easier item, or null when there is none. Its key always differs from the item's own. */
export function simplerItem(steps: ProcessStep[], item: HowItem, pictures: boolean): HowItem | null {
  if (isPractice(item)) return null;
  const id = `${item.id}${PRACTICE}`;
  const n = steps.length;
  const farFrom = (key: number, exclude: number[]) => Array.from({ length: n }, (_, i) => i).filter(j => j !== key && !exclude.includes(j))
    .sort((a, b) => Math.abs(b - key) - Math.abs(a - key))[0];
  const rng = seededRng(id);
  const two = (key: number, foil: number | undefined) => (foil === undefined ? null : (rng() < 0.5 ? [key, foil] : [foil, key]));
  if (item.kind === 'sequence') {
    const size = item.cards.length > 3 ? 3 : item.cards.length - 1;
    if (size < 2) return null;
    const cards = item.cards.slice(0, size);
    return { ...item, id, cards, bank: bankFor(cards, rng), asClues: false };
  }
  if (item.kind === 'identify') {
    const target = Array.from({ length: n }, (_, i) => i).find(t => t !== item.target && steps[t].clue.length >= (pictures ? 1 : 20));
    if (target === undefined) return null;
    const options = two(target, farFrom(target, [item.target]));
    return options ? { ...item, id, target, options } : null;
  }
  if (item.kind === 'predict') {
    const shown = Array.from({ length: n }, (_, i) => i).find(s => s >= 1 && s !== item.shown);
    if (shown === undefined) return null;
    const options = two(shown, farFrom(shown, [item.shown]));
    return options ? { ...item, id, shown, options } : null;
  }
  const pool = Array.from({ length: n }, (_, i) => i).filter(i => (steps[i].purpose ?? '').length >= 12);
  const target = pool.find(t => t !== item.target);
  if (target === undefined) return null;
  const foil = pool.filter(j => j !== target && j !== item.target).sort((a, b) => Math.abs(b - target) - Math.abs(a - target))[0];
  const options = two(target, foil);
  return options ? { ...item, id, target, options } : null;
}

// ── Levers on the current item ───────────────────────────────────────────────────────────

const lever = (id: string, kind: WorkspaceLever['kind'], pulled: readonly string[], answers: readonly HowMiss[], when: string, does: string): WorkspaceLever =>
  ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });

/** The levers on the current session item. A practice item has none. */
export function howLevers(steps: ProcessStep[], item: HowItem | undefined, pulled: readonly string[], pictures: boolean): WorkspaceLever[] {
  if (!item || isPractice(item)) return [];
  const out: WorkspaceLever[] = [];
  const easier = simplerItem(steps, item, pictures);
  if (item.kind === 'sequence') {
    if (!pictures && item.cards.every(i => (steps[i].purpose ?? '').length >= 12)) {
      out.push(lever(SHOW_WHY_LEVER, 'help', pulled, ORDER_MISSES, 'The learner cannot tell which step leads to which.',
        'Writes under each card what that step makes possible. It writes no position or number.'));
    }
    if (easier) {
      out.push(lever(FEWER_CARDS_LEVER, 'simplify', pulled, ORDER_MISSES, 'The learner cannot hold all the cards at once.',
        `Opens an order of only ${easier.kind === 'sequence' ? easier.cards.length : 2} of the steps, by name. It is not graded; this item comes back after it.`));
    }
    return out;
  }
  const answers = item.kind === 'predict' ? NEXT_MISSES : CHOICE_MISSES;
  if (item.kind === 'identify' && !item.strip) {
    out.push(lever(STEP_NUMBERS_LEVER, 'help', pulled, answers, 'The learner cannot place the description in the process.',
      'Shows each choice\'s step number in the process (step 1 is first). It marks no choice.'));
  }
  if (item.kind === 'predict' && !pictures && steps[item.shown - 1].clue) {
    out.push(lever(LAST_STEP_LEVER, 'help', pulled, answers, 'The learner does not use what the last shown step does.',
      `Shows the description of the last shown step (step ${item.shown}) under the step list, with the next step's name blanked out.`));
  }
  if (item.kind === 'explain' && purposeOverlap(showStepLine(steps, item), purposeOf(steps, item.target)) <= 0.5) {
    out.push(lever(SHOW_STEP_LEVER, 'help', pulled, answers, 'The learner does not recall what the step does.',
      `Shows the description of step ${item.target + 1} under the question.`));
  }
  if (crossedOut(item).length) {
    out.push(lever(TWO_CHOICES_LEVER, 'help', pulled, answers, 'The learner is unsure among many choices.',
      'Crosses out choices until two are left. It marks neither of the two.'));
  }
  if (easier) {
    out.push(lever(EASIER_ITEM_LEVER, 'simplify', pulled, answers, 'The learner cannot do this kind of question yet.',
      'Opens an easier question of the same kind about another step, with two choices. It is not graded; this item comes back after it.'));
  }
  return out;
}

/** What the pulled levers put on screen, as scene facts. Never the key. */
export function leverFacts(steps: ProcessStep[], item: HowItem | undefined, pulled: readonly string[]): Record<string, string> {
  if (!item || isPractice(item)) return {};
  const out: Record<string, string> = {};
  if (item.kind === 'sequence') {
    if (pulled.includes(SHOW_WHY_LEVER)) {
      out.onScreen = 'Under each card, a line says what that step makes possible:';
      item.bank.forEach((s, k) => { out[`why${k + 1}`] = `Under "${cardText(steps, item, s).slice(0, 80)}": ${whyLine(steps, s)}`; });
    }
    return out;
  }
  const parts: string[] = [];
  if (pulled.includes(STEP_NUMBERS_LEVER) && item.kind === 'identify') parts.push('Each choice now shows its step number in the process.');
  if (pulled.includes(LAST_STEP_LEVER) && item.kind === 'predict') parts.push(`Under the step list, step ${item.shown}'s description: "${lastStepLine(steps, item)}"`);
  if (pulled.includes(SHOW_STEP_LEVER) && item.kind === 'explain') parts.push(`Under the question, step ${item.target + 1}'s description: "${showStepLine(steps, item)}"`);
  if (pulled.includes(TWO_CHOICES_LEVER)) parts.push(`${crossedOut(item).length} choice${crossedOut(item).length > 1 ? 's are' : ' is'} crossed out; two are left.`);
  if (parts.length) out.onScreen = parts.join(' ');
  return out;
}

/** For tests: every miss this item's work can show. */
export function possibleMisses(item: HowItem): HowMiss[] {
  if (item.kind === 'sequence') {
    const perms = (xs: number[]): number[][] => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms(xs.filter((_, j) => j !== i)).map(p => [x, ...p])));
    return Array.from(new Set(perms(item.cards).map(p => orderMiss(item, p)).filter((m): m is OrderMiss => !!m)));
  }
  const key = keyStep(item);
  return Array.from(new Set(item.options.filter(o => o !== key).map(o => choiceMiss(item, o))));
}
