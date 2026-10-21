/**
 * What the tutor and the observer read on a number-bond step: the step's name, the ask, a spoken step's key and known
 * misses, and the scene. Pure and React-free: the boss, the component and the probes read it.
 *
 * A say step asks about the bond on the board. A related-fact say step's board is fixed by its move (the move step
 * before it is checked, and the component puts the named move on the board before the ask), so its question comes
 * from the item. A decompose say step asks about the learner's own split, which the component stamps on the item as
 * `askedSplit` when the step opens.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import { numberMisses, offByMisses, type KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { numberWordFor } from './countingBoardDomain';
import { askFor, type NumberBondItem } from './numberBondDomain';
import { prepareSplit, splitCounts, splitQuestion, wholeCounters, type BondCounters } from './numberBondSplit';
import { countersForAction, relatedQuestion } from './numberBondModes';

export { NUMBER_BOND_MISSES, type BondMiss, type NumberBondMiss, type SpokenBondMiss } from './numberBond.card';

/** The catalog mode a challenge type is tracked under. */
export const evalModeForKind = (kind: NumberBondItem['kind']) => kind.replace(/-/g, '_');

export type BondStep = 'split' | 'say' | 'move' | 'equation';

/** The step an item is, as the card names it and the scene publishes it (`kind`). */
export function stepOf(item: NumberBondItem): BondStep {
  if (item.splitPhase) return item.splitPhase === 'build' ? 'split' : 'say';
  switch (item.interactionPhase) {
    case 'equation-build': case 'family-build': return 'equation';
    case 'related-join': case 'related-separate': case 'equation-model': case 'family-model': return 'move';
    default: return 'say';
  }
}

export const isRelatedSay = (item: NumberBondItem | null | undefined) =>
  item?.interactionPhase === 'related-say-addend' || item?.interactionPhase === 'related-say-remainder';

/** The counters a decompose or ten-and-ones say step asks about: the stamped split, else the first unmade pair. */
export function askedCounters(item: NumberBondItem): BondCounters {
  if (!item.askedSplit) return prepareSplit(item, wholeCounters(item.whole), []).counters;
  const { left, right } = item.askedSplit;
  return [...Array<'left'>(left).fill('left'), ...Array<'right'>(right).fill('right')];
}

/**
 * A say step's question: the ask, the number it wants, and the numbers the ask says or the board shows: `given`, the
 * part the ask names; `taken`, the part a take-away removes. Null on a step answered on the board.
 */
export function spokenQuestion(item: NumberBondItem): { ask: string; answer: number; given?: number; taken?: number } | null {
  if (item.answerKind === 'gesture') return null;
  if (item.splitPhase === 'say') {
    const q = splitQuestion(item, askedCounters(item));
    return { ask: q.ask, answer: q.answer, given: q.known };
  }
  if (isRelatedSay(item) && item.bondAction) {
    const q = relatedQuestion(item, countersForAction(item, item.bondAction));
    return item.interactionPhase === 'related-say-addend' ? { ask: q.ask, answer: q.answer, given: item.whole - q.answer }
      : { ask: q.ask, answer: q.answer, taken: item.whole - q.answer };
  }
  return { ask: askFor(item), answer: item.answer, given: item.knownPart };
}

const FAMILY_LINE: Record<string, string> = {
  join: 'Join the first group, then the second group.',
  swap: 'Swap the two groups so the other part comes first.',
  'separate-left': 'Start with the whole, then move the first group away.',
  'separate-right': 'Start with the whole, then move the other group away.',
};

/** What the learner is asked on one step. Never the answer. */
export function numberBondAsk(item: NumberBondItem): string {
  const spoken = spokenQuestion(item);
  if (spoken) return spoken.ask;
  const w = numberWordFor(item.whole);
  if (item.splitPhase === 'build') {
    return item.kind === 'ten-and-ones' ? `Split ${w} into a ten and some ones.`
      : item.pairIndex === 0 ? `Split ${w} into two parts.` : `Move the counters to make a different way to split ${w}.`;
  }
  switch (item.interactionPhase) {
    case 'related-join': return 'Slide the two groups together.';
    case 'related-separate': return 'Now move the group you just found out of the whole.';
    case 'equation-model': return 'Choose an action. Join the groups, or take one group away.';
    case 'equation-build': return 'Build an equation that shows what you did.';
    case 'family-model': return FAMILY_LINE[item.bondAction ?? 'join'];
    case 'family-build': return 'Build the equation that shows this move.';
    default: return askFor(item);
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const NOT_IT = 'A different number is not the answer, however close it is.';

/** The key a say step is judged against (`spokenKeyText` writes it); null on a step the board checks. */
export function numberBondKey(item: NumberBondItem): SpokenKey | null {
  const q = spokenQuestion(item);
  if (!q) return null;
  const word = numberWordFor(q.answer);
  const counted = `Counting aloud and ending on ${word} is that answer: the last number said tells how many.`;
  const echoes = (values: Array<[number | undefined, string]>) => values
    .filter(([v]) => v !== undefined && v > 0 && v !== q.answer).map(([v, what]) => `${numberWordFor(v!)}, ${what}`);
  const said = (list: string[], not: string) => (list.length ? `${cap(list.join(', or '))}, said back, is not ${not}. ` : '');
  if (item.kind === 'ten-and-ones') {
    return { answer: word, alsoAccept: [], acceptRule: `"${word} ones" or "one ten and ${word}" is ${word}.`,
      signatureError: `${said(echoes([[10, 'the ten'], [item.whole, 'the whole number']]), 'how many ones')}${NOT_IT}` };
  }
  if (item.splitPhase === 'say') {
    return { answer: word, alsoAccept: [], acceptRule: `"${word} in that part" is ${word}. ${counted}`,
      signatureError: `${said(echoes([[q.given, 'the other part'], [item.whole, 'the whole']]),
        'how many are in the highlighted part')}${NOT_IT}` };
  }
  if (q.taken !== undefined) {
    return { answer: word, alsoAccept: [], acceptRule: `"${word} left" is ${word}. ${counted}`,
      signatureError: `${said(echoes([[item.whole, 'the number before any were taken away'], [q.taken, 'the number taken away']]),
        'how many are left')}${NOT_IT}` };
  }
  return { answer: word, alsoAccept: [], acceptRule: `"${word} more" is ${word}. ${counted}`,
    signatureError: `${said(echoes([[q.given, 'the part the question names'], [item.whole, 'the whole']]),
      'the other part')}${NOT_IT}` };
}

/**
 * What the ask says by design, which may be the answer too: "one ten" on a teen; the other part's count on a split
 * (a split of three and three asks "This part has three"); the part named and the whole on the covered part and the
 * related facts ("One part is …" says "one").
 */
export function numberBondGiven(item: NumberBondItem): string[] {
  const q = spokenQuestion(item);
  if (!q) return [];
  if (item.kind === 'ten-and-ones') return ['one ten'];
  const words = (...values: Array<number | undefined>) => values.filter((v): v is number => !!v).map(numberWordFor);
  if (item.splitPhase === 'say') return words(q.given);
  return [...words(q.given ?? q.taken, item.whole), ...(item.interactionPhase === 'missing-infer' ? ['one part'] : [])];
}

/**
 * A say step's known wrong answers, in precedence order, for the `spoken_miss` observer: the numbers this bond says or
 * shows (the ten, the part the ask names, the part taken away, the whole), then the off-by misses.
 */
export function numberBondSpokenMisses(item: NumberBondItem): KnownMiss[] {
  const q = spokenQuestion(item);
  if (!q) return [];
  const { answer, given, taken } = q, w = item.whole;
  if (item.kind === 'ten-and-ones') return [...numberMisses(answer, [
    { id: 'said_ten', value: 10, pattern: n => `The whole is ${w}, made of a ten and some ones. The learner's answer is only ${n}, the ten, with no number of ones.` },
    { id: 'said_whole', value: w, pattern: n => `The whole is ${n}. The learner's answer is ${n}, the whole number, not the ones in it.` }]),
    ...offByMisses(answer, `the ${answer} ones`)];
  const other = given ?? taken;
  const own = numberMisses(answer, [
    { id: 'said_given_part', value: given, pattern: n => `The question already names a part of ${n}. The learner's answer is ${n}, that part again, not the other part.` },
    { id: 'said_change', value: taken, pattern: n => `${n} are taken away from the whole. The learner's answer is ${n}, the number taken away, not how many are left.` },
    { id: 'said_whole', value: w, pattern: n => `The whole is ${n}. The learner's answer is ${n}, the whole, not ${taken !== undefined ? 'how many are left' : 'the other part'}.` },
    { id: 'added_both', value: item.splitPhase || other === undefined ? undefined : w + other,
      pattern: n => `The two numbers in the question are ${w} and ${other}. The learner's answer is ${n}, those two numbers added together.` },
  ]);
  const of = taken !== undefined ? `the ${answer} left` : item.splitPhase ? `the ${answer} in the highlighted part` : `the ${answer} in the other part`;
  return [...own, ...offByMisses(answer, of)];
}

export interface NumberBondView {
  counters: BondCounters;
  found: ReadonlyArray<readonly [number, number]>;
  tiles: readonly string[];
}

/** The bond as the tutor reads it. Only this primitive's own facts: how to answer is the card's `moves`. */
export function workspaceScene(item: NumberBondItem, view: NumberBondView): SceneOf {
  const { whole, left, right } = splitCounts(view.counters);
  // Counter counts only where the board is what the step is about. On a missing-part step the counters are optional
  // support, and "0 in each part" beside a credited "three" reads as a contradiction to the observer (the LA-13
  // `counted: 0` finding).
  const boardAsked = item.answerKind === 'gesture' || item.splitPhase === 'say' || isRelatedSay(item);
  return {
    objects: [],
    facts: {
      kind: stepOf(item), bondWhole: item.whole,
      ...(boardAsked ? { countersInWhole: whole, countersInLeftPart: left, countersInRightPart: right } : {}),
      ...(view.found.length ? { pairsAlreadyMade: view.found.map(([a, b]) => `${a} and ${b}`).join('; ') } : {}),
      ...(view.tiles.length ? { equationBuilt: view.tiles.join(' ') } : {}),
    },
  };
}
