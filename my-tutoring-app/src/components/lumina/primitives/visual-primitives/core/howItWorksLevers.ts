/**
 * The in-item levers on how-it-works, as one lever set (`HOW_LEVERS`, `bossLevers.ts`; `/add-support-tiers`, report
 * qa/eval-reports/how-it-works-levers-2026-10-16.md). No real-learner evidence: the misses are what `howMiss` observes;
 * the failures behind them are documented (the old catalog's commonStruggles: sequence challenges, predict questions,
 * steps read too fast) or inferred (a neighbouring step confused with the right one, a step that comes later chosen as
 * next, a description not tied to its step). Every lever starts released; `config.difficulty` changes the items, not
 * the levers.
 *
 * Help (the screen does more; the item is unchanged). Types: step_numbers `legend`, last_step and show_step `clue`,
 * show_why `meaning`, two_choices `custom`; the simplify levers `easier`.
 * - `step_numbers` (identify with no step list on screen): each choice shows its step number in the process.
 * - `two_choices` (every choice item with three or more choices): crosses out choices until two are left, the right
 *   one and one that is not its neighbour when there is one. Never one choice left.
 * - `last_step` (predict, readers): the last shown step's description under the step list, with the next step's name
 *   blanked out of it.
 * - `show_step` (explain): the asked step's description under the question.
 * - `show_why` (sequence, readers whose steps all have a purpose): under each card, what that step makes possible.
 * Simplify (an ungraded practice item of the same kind, then the full item back; never the learner's own key):
 * - `easier_item` (choice items): another step's item of the same kind with two choices.
 * - `fewer_cards` (sequence): the first three cards (two when there are three), by name.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { CHOICE_MISSES, NEXT_MISSES, ORDER_MISSES } from './howItWorks.card';
import {
  asCheck, bankFor, blankTitle, choiceMiss, choiceText, firstSentences, isChoice, keyStep, missesOf, orderMiss, purposeOf,
  seededRng, type ChoiceItem, type HowCheck, type HowItem, type HowMiss, type OrderMiss, type ProcessStep,
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

// ── The lever set ────────────────────────────────────────────────────────────────────────

const PRACTICE_NOTE = 'It is not graded; this item comes back after it.';
const full = (c: HowCheck) => !isPractice(c);
/** The practice item of this check, as a check of the same lesson, or null. */
const practiceOf = (c: HowCheck): HowCheck | null => {
  const s = simplerItem(c.steps, c, c.pictures);
  return s ? asCheck(s, c.steps, c.pictures, c.question) : null;
};
const MODE_MISSES: Record<string, readonly HowMiss[]> = {
  guided: CHOICE_MISSES, sequence: [...ORDER_MISSES, ...CHOICE_MISSES], predict: [...NEXT_MISSES, ...CHOICE_MISSES],
};
const shownOf = (c: HowCheck) => (c.kind === 'predict' ? c.shown : 0);
const targetOf = (c: HowCheck) => (c.kind === 'explain' || c.kind === 'identify' ? c.target : 0);

/**
 * Every lever of every kind of item, as one set. Each spec names the modes whose items it can help and offers itself
 * only on its own kind of item (`content` null otherwise). A practice item has no levers.
 */
export const HOW_LEVERS = leverSet<HowCheck, null>({
  modeOf: c => c.mode,
  missesOf: mode => MODE_MISSES[mode] ?? [],
  // A clue may never name the item's key: the step's name, or on explain the purpose it makes possible.
  answersOf: c => (c.kind === 'sequence' ? [] : c.kind === 'explain' ? [choiceText(c.steps, c, c.target)] : [c.steps[keyStep(c)].title]),
  specs: [
    { id: STEP_NUMBERS_LEVER, type: 'legend', modes: ['sequence'], answers: CHOICE_MISSES,
      when: 'The learner cannot place the description in the process.',
      does: "Shows each choice's step number in the process (step 1 is first). It marks no choice.",
      content: c => (c.kind === 'identify' && !c.strip && full(c) ? c.options : null),
      fact: 'Each choice now shows its step number in the process.' },
    { id: LAST_STEP_LEVER, type: 'clue', modes: ['predict'], answers: NEXT_MISSES,
      when: 'The learner does not use what the last shown step does.',
      does: c => `Shows the description of the last shown step (step ${shownOf(c)}) under the step list, with the next step's name blanked out.`,
      content: c => (c.kind === 'predict' && !c.pictures && full(c) && c.steps[c.shown - 1].clue ? lastStepLine(c.steps, c) : null),
      fact: (line: string, c) => `Under the step list, step ${shownOf(c)}'s description: "${line}"` },
    { id: SHOW_STEP_LEVER, type: 'clue', modes: ['predict'], answers: CHOICE_MISSES,
      when: 'The learner does not recall what the step does.',
      does: c => `Shows the description of step ${targetOf(c) + 1} under the question.`,
      content: c => (c.kind === 'explain' && full(c) && purposeOverlap(showStepLine(c.steps, c), purposeOf(c.steps, c.target)) <= 0.5
        ? showStepLine(c.steps, c) : null),
      fact: (line: string, c) => `Under the question, step ${targetOf(c) + 1}'s description: "${line}"` },
    { id: SHOW_WHY_LEVER, type: 'meaning', modes: ['sequence'], answers: ORDER_MISSES,
      when: 'The learner cannot tell which step leads to which.',
      does: 'Writes under each card what that step makes possible. It writes no position or number.',
      content: c => (c.kind === 'sequence' && !c.pictures && full(c) && c.cards.every(i => (c.steps[i].purpose ?? '').length >= 12) ? c.cards : null),
      fact: 'Under each card, a line says what that step makes possible (the why facts).' },
    { id: TWO_CHOICES_LEVER, type: 'custom', carrier: 'shown', answers: [...CHOICE_MISSES, ...NEXT_MISSES], answersOn: c => missesOf(c),
      why: 'It narrows this item in place (choices crossed out until two are left) rather than opening a practice item.',
      when: 'The learner is unsure among many choices.',
      does: 'Crosses out choices until two are left. It marks neither of the two.',
      content: c => (isChoice(c) && full(c) && crossedOut(c).length ? crossedOut(c) : null),
      fact: (out: number[]) => `${out.length} choice${out.length > 1 ? 's are' : ' is'} crossed out; two are left.` },
    { id: EASIER_ITEM_LEVER, type: 'easier', answers: [...CHOICE_MISSES, ...NEXT_MISSES], answersOn: c => missesOf(c),
      when: 'The learner cannot do this kind of question yet.',
      does: `Opens an easier question of the same kind about another step, with two choices. ${PRACTICE_NOTE}`,
      content: c => (isChoice(c) ? practiceOf(c) : null) },
    { id: FEWER_CARDS_LEVER, type: 'easier', modes: ['sequence'], answers: ORDER_MISSES,
      when: 'The learner cannot hold all the cards at once.',
      does: c => `Opens an order of only ${c.kind === 'sequence' ? Math.min(3, c.cards.length > 3 ? 3 : c.cards.length - 1) : 2} of the steps, by name. ${PRACTICE_NOTE}`,
      content: c => (c.kind === 'sequence' ? practiceOf(c) : null) },
  ],
});

/** For tests: every miss this item's work can show. */
export function possibleMisses(item: HowItem): HowMiss[] {
  if (item.kind === 'sequence') {
    const perms = (xs: number[]): number[][] => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms(xs.filter((_, j) => j !== i)).map(p => [x, ...p])));
    return Array.from(new Set(perms(item.cards).map(p => orderMiss(item, p)).filter((m): m is OrderMiss => !!m)));
  }
  const key = keyStep(item);
  return Array.from(new Set(item.options.filter(o => o !== key).map(o => choiceMiss(item, o))));
}
