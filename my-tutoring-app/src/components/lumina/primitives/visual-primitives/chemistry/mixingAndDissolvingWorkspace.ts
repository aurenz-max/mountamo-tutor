/**
 * Mixing and dissolving's items, keys, misses and scene: the pure half of its boss (`mixingAndDissolving.boss.ts`).
 *
 * Every item is one challenge with a key held by code (`correctOptionIndex`). The learner can test substances in the
 * beaker first, then says the answer (the tutor judges it against `dissolvingKey`) or taps one choice and presses
 * Submit Answer (the activity checks the tap): a SAY_OR_SHOW card (`mixingAndDissolving.card.ts`).
 *
 * Mode items: `dissolve` sorts (built here from each substance's own `type`, the same field the beaker draws from)
 * plus the generator's particle question; `classify` is built here from `type` (solution, suspension, two layers);
 * `separate` is the generator's method question. Pure: the generator, component, boss, journey and tests read it.
 */
import type { WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { DissolvingChallenge, MixingAndDissolvingData, SubstanceEntry } from './MixingAndDissolving';

// ── Code-built items (the generator calls these under a pinned mode) ─────────

const seedOf = (s: string) => Array.from(s).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
/** A fixed order from a seed, so the same lesson shows the same order on every render and both paths. */
export const stableOrder = <T,>(list: readonly T[], key: (t: T) => string) =>
  [...list].sort((a, b) => seedOf(key(a)) - seedOf(key(b)));

export const SORT_OPTIONS = ['Dissolves', "Doesn't dissolve"] as const;
export const CLASS_OPTIONS = ['A solution', 'A suspension', 'Two layers'] as const;

const sortKey = (type: SubstanceEntry['type']) => (type === 'soluble' ? 0 : type === 'insoluble' || type === 'immiscible_liquid' ? 1 : null);
const classKey = (type: SubstanceEntry['type']) => (type === 'soluble' ? 0 : type === 'insoluble' ? 1 : type === 'immiscible_liquid' ? 2 : null);
const lower = (name: string) => name.trim().toLowerCase();

/** One "does it dissolve?" item per substance whose answer the beaker draws (partly soluble ones are left out). */
export function buildSortItems(substances: readonly SubstanceEntry[], solventName: string, max = 3): DissolvingChallenge[] {
  return stableOrder(substances.filter(s => sortKey(s.type) !== null), s => `sort-${s.id}`).slice(0, max).map(s => ({
    id: `sort-${s.id}`, type: 'dissolve_sort', answerType: 'true_false',
    instruction: `Add the ${lower(s.name)} to the ${lower(solventName)} and stir. Does it dissolve?`,
    options: [...SORT_OPTIONS], correctOptionIndex: sortKey(s.type)!,
    hint: 'Look at the beaker after you stir: is the substance still there to see, or has it spread through the liquid?',
    narration: '',
  }));
}

/** One "what do you get?" item per substance that makes a solution, a suspension or two layers. */
export function buildClassifyItems(substances: readonly SubstanceEntry[], solventName: string, max = 4): DissolvingChallenge[] {
  return stableOrder(substances.filter(s => classKey(s.type) !== null), s => `classify-${s.id}`).slice(0, max).map(s => ({
    id: `classify-${s.id}`, type: 'classify', answerType: 'multiple_choice',
    instruction: `Add the ${lower(s.name)} to the ${lower(solventName)} and stir. What do you get?`,
    options: [...CLASS_OPTIONS], correctOptionIndex: classKey(s.type)!,
    hint: 'Look at the beaker after you stir: can you still see the substance, and where is it?',
    narration: '',
  }));
}

/**
 * A multiple-choice item's options in a fixed order, the key placed by code: the generator puts the right one in the
 * same slot item after item (3 of 3 separation questions at choice 2 in one lab). The wrong ones keep a fixed shuffle
 * and the key goes to a slot from the item's id and wording. True-false and code-built items keep their order.
 */
export function shuffledChallenge(ch: DissolvingChallenge): DissolvingChallenge {
  if (ch.answerType !== 'multiple_choice' || ch.type === 'classify') return ch;
  const key = ch.options[ch.correctOptionIndex];
  if (key === undefined) return ch;
  const foils = stableOrder(ch.options.filter((_, i) => i !== ch.correctOptionIndex), o => `${ch.id}:${o}`);
  const at = seedOf(`${ch.instruction}|${ch.id}`) % ch.options.length;
  const options = [...foils.slice(0, at), key, ...foils.slice(at)];
  return { ...ch, options, correctOptionIndex: at };
}

/**
 * The lab's description states a result a challenge asks about ("watch their tiny particles spread out"): it is not
 * shown while a challenge is open.
 */
export const descriptionLeaks = (text: string | undefined) =>
  !!text && /spread|evenly|disappear|vanish|solution|suspension|layer|filter|evapor|distil|decant|magnet|sink|sank|settle|float/i.test(text);

// ── Misses ───────────────────────────────────────────────────────────────────

/**
 * What a wrong choice shows (`TeachingAttempt.miss`), named from the choice's text:
 * - sort: `chose_dissolves` (said it dissolves; the beaker draws it undissolved) or `chose_does_not_dissolve`;
 * - particle question: `chose_disappeared` (the particles are gone), `chose_sank` (they sank to the bottom);
 * - classify: `called_solution`, `called_suspension`, `called_layers` (the wrong kind chosen);
 * - separate: `filter_for_dissolved` (filtering where the key boils or evaporates the liquid away),
 *   `evaporate_for_undissolved` (evaporating where the key filters or pours off), `other_method`;
 * - `other_choice`: any other choice.
 */
export type DissolvingMiss = 'chose_dissolves' | 'chose_does_not_dissolve' | 'chose_disappeared' | 'chose_sank'
  | 'called_solution' | 'called_suspension' | 'called_layers'
  | 'filter_for_dissolved' | 'evaporate_for_undissolved' | 'other_method' | 'other_choice';

const NO_RE = /\b(doesn.?t|does not|won.?t|will not|not|no|stays|insoluble)\b/i;
/** Which side of "does it dissolve?" a choice is on. */
export const sortSide = (text: string): 'yes' | 'no' | null =>
  NO_RE.test(text) ? 'no' : /\b(dissolves?|yes|soluble)\b/i.test(text) ? 'yes' : null;
export const classOfText = (text: string): 'solution' | 'suspension' | 'layers' | null =>
  /solution/i.test(text) ? 'solution' : /suspension/i.test(text) ? 'suspension' : /layer|immiscible|do(es)? not mix/i.test(text) ? 'layers' : null;

export type Method = 'filtration' | 'evaporation' | 'distillation' | 'chromatography' | 'magnet' | 'decanting';
const METHOD_RE: Record<Method, RegExp> = {
  filtration: /filt/i, evaporation: /evapor/i, distillation: /distil/i, chromatography: /chromatog/i, magnet: /magnet/i, decanting: /decant|pour (it )?off/i,
};
export const methodsIn = (text: string): Method[] => (Object.keys(METHOD_RE) as Method[]).filter(m => METHOD_RE[m].test(text));

const keyText = (ch: DissolvingChallenge) => ch.options[ch.correctOptionIndex] ?? '';

function choiceMiss(ch: DissolvingChallenge, choice: string): DissolvingMiss {
  if (ch.type === 'dissolve_sort') {
    const side = sortSide(choice);
    if (side === 'yes') return 'chose_dissolves';
    if (side === 'no') return 'chose_does_not_dissolve';
  }
  if (ch.type === 'classify') {
    const c = classOfText(choice);
    if (c) return `called_${c}` as DissolvingMiss;
  }
  if (ch.type === 'particle_explain') {
    if (/disappear|vanish|gone|destroy/i.test(choice)) return 'chose_disappeared';
    if (/sank|sink|bottom|settle/i.test(choice)) return 'chose_sank';
  }
  if (ch.type === 'separate') {
    const got = methodsIn(choice), want = methodsIn(keyText(ch));
    const removesLiquid = (ms: Method[]) => ms.some(m => m === 'evaporation' || m === 'distillation');
    if (got.includes('filtration') && !removesLiquid(got) && removesLiquid(want)) return 'filter_for_dissolved';
    if (removesLiquid(got) && !got.includes('filtration') && want.some(m => m === 'filtration' || m === 'decanting' || m === 'magnet')) return 'evaporate_for_undissolved';
    if (got.length) return 'other_method';
  }
  return 'other_choice';
}

export function dissolvingMiss(ch: DissolvingChallenge | null | undefined, choiceIndex: number | null): DissolvingMiss | undefined {
  if (!ch || choiceIndex === null || choiceIndex === ch.correctOptionIndex) return undefined;
  const choice = ch.options[choiceIndex];
  return choice === undefined ? undefined : choiceMiss(ch, choice);
}

export const dissolvingCorrect = (ch: DissolvingChallenge | null | undefined, choiceIndex: number | null) =>
  !!ch && choiceIndex !== null && choiceIndex === ch.correctOptionIndex;

/** The learner's work in their own terms, never the key. */
export const describeDissolvingWork = (ch: DissolvingChallenge | null | undefined, choiceIndex: number | null) =>
  ch && choiceIndex !== null && ch.options[choiceIndex] !== undefined ? `Chose "${ch.options[choiceIndex]}"` : 'Nothing chosen yet';

// ── The spoken key ───────────────────────────────────────────────────────────

/** The catalog's eval modes. A challenge type no mode pins (the 6-7 factor, saturation and concentration questions)
 *  counts as dissolve, the mode of the open lab. */
export type DissolvingMode = 'dissolve' | 'classify' | 'separate';
export const dissolvingMode = (ch: Pick<DissolvingChallenge, 'type'>): DissolvingMode =>
  (ch.type === 'classify' ? 'classify' : ch.type === 'separate' ? 'separate' : 'dissolve');

const stripEnd = (t: string) => t.trim().replace(/[.!?]+$/, '');
const quoted = (xs: readonly string[]) => xs.map(x => `"${stripEnd(x)}"`).join(', ');
const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

/** The key a spoken reply is judged against: the right choice, the ways a learner says it, and the others as wrong. */
export function dissolvingKey(ch: DissolvingChallenge): SpokenKey {
  const key = keyText(ch), others = ch.options.filter((_, i) => i !== ch.correctOptionIndex);
  const side = ch.type === 'dissolve_sort' ? sortSide(key) : null;
  const sayings = side === 'yes' ? ['yes', 'it dissolves', 'it disappears into the water']
    : side === 'no' ? ['no', 'it does not dissolve', 'it stays there'] : [];
  return {
    answer: stripEnd(key),
    alsoAccept: [`the ${ORDINAL[ch.correctOptionIndex] ?? 'last'} one`, ...sayings],
    ...(key.trim().split(/\s+/).length > 1 ? { acceptRule: 'The part of the choice that tells it apart from the others counts too.' } : {}),
    signatureError: `${quoted(others)} ${others.length > 1 ? 'are' : 'is'} wrong, and so is naming two choices or hedging between them.`,
  };
}

/** A spoken item's known wrong answers, most specific first, with the tap's ids: each wrong choice under its miss. */
export function dissolvingSpokenMisses(ch: DissolvingChallenge): KnownMiss[] {
  const groups = new Map<DissolvingMiss, string[]>();
  ch.options.forEach((o, i) => {
    if (i === ch.correctOptionIndex) return;
    const m = choiceMiss(ch, o);
    groups.set(m, [...(groups.get(m) ?? []), stripEnd(o)]);
  });
  const fact = `The right choice is "${stripEnd(keyText(ch))}".`;
  const sorted = Array.from(groups.entries()).sort(([a], [b]) => (a === 'other_choice' ? 1 : 0) - (b === 'other_choice' ? 1 : 0));
  return sorted.map(([id, xs]) => ({
    id, pattern: `${fact} The learner's answer is ${quoted(xs)}.`,
    examples: [...xs, ...(id === 'chose_dissolves' ? ['yes'] : id === 'chose_does_not_dissolve' ? ['no'] : [])].slice(0, 6),
  }));
}

// ── Scene ────────────────────────────────────────────────────────────────────

export interface DissolvingView {
  /** What the learner has put in the beaker, in grams. */
  added: readonly { name: string; amountG: number }[];
  temperature: number;
  particleViewOn: boolean;
  choice: number | null;
}

type Lab = Pick<MixingAndDissolvingData, 'solvent' | 'substances'>;

/**
 * What is drawn and asked. The beaker's contents are named by amount only: whether a substance dissolved is what the
 * learner looks for, so no fact says it. The choices are named, never which is right.
 */
export function workspaceScene(ch: DissolvingChallenge, view: DissolvingView, lab: Lab): WorkspaceScene {
  const { solvent } = lab;
  const facts: Record<string, string> = {
    shown: `A beaker of ${solvent.volume} mL of ${lower(solvent.name)} at ${view.temperature}°C, a Stir button, and a shelf of `
      + `substances the learner can add, 5 g a tap: ${lab.substances.map(s => s.name).join(', ')}.`
      + (view.particleViewOn ? ' The particle view of the beaker is open.' : ''),
    beaker: view.added.length ? `In the beaker so far: ${view.added.map(a => `${a.name} ${a.amountG} g`).join(', ')}.` : 'Nothing has been added to the beaker yet.',
    question: ch.instruction.trim(),
    choices: ch.options.map((o, i) => `${i + 1}) ${o}`).join('  '),
    learnerWork: describeDissolvingWork(ch, view.choice),
    // How the learner answers is the card's `moves`; what the beaker shows is the learner's to read.
    constraints: 'What the beaker shows after a substance goes in is the learner\'s to see: never say whether it '
      + 'dissolved, sank or floats.',
  };
  return { objects: [], facts };
}

/** The journey's answers: the key, and the wrong choice that shows the most telling miss. */
export function dissolvingHarnessAnswers(ch: DissolvingChallenge): { correct: string; plainWrong: string } {
  const wrong = ch.options.map((o, i) => ({ o, i })).filter(x => x.i !== ch.correctOptionIndex)
    .sort((a, b) => (choiceMiss(ch, a.o) === 'other_choice' ? 1 : 0) - (choiceMiss(ch, b.o) === 'other_choice' ? 1 : 0));
  return { correct: keyText(ch), plainWrong: wrong[0]?.o ?? '' };
}
