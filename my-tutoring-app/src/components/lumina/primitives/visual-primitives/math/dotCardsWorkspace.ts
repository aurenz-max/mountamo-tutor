/**
 * Dot cards on the shared tutor/JEV teaching workspace. A card starts face down; the learner flips it for one quick
 * look, it turns back over, and the learner says the total (the tutor judges it against `dotCardsKey`) or taps it on the
 * 1-10 pad (the activity's own check). The look is short so the learner sees the two groups instead of counting one by
 * one; nothing on screen shows a clock.
 *
 * Pure: the component, the boss and the tests read the same ask, key, checks, misses and scene.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import { numberMisses, offByMisses, type KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { DotArrangement, DotCardsChallenge } from './DotCards';
import { DOT_CARDS_MISSES, type DotCardsMiss } from './dotCards.card';
import { spokenIntegerWord } from './spokenNumberWords';

export { DOT_CARDS_MISSES, type DotCardsMiss };

/** The 1-10 pad: every total a card can have, so the pad never narrows to the answer. */
export const DOT_PAD = Array.from({ length: 10 }, (_, i) => i + 1);

export const ARRANGEMENT_WORDS: Record<DotArrangement, string> = {
  dice: 'two dice patterns side by side, one blue and one orange',
  rows: 'two rows of dots, a blue row above an orange row',
  frame: 'a ten-frame, filled from the top left: blue dots first, then orange dots',
  scatter: 'blue and orange dots scattered over the card',
};

/** What the learner is asked. No number in it. */
export const dotCardsAsk = (_c: DotCardsChallenge) => 'How many dots are on the card altogether?';

export function dotCardsKey(c: DotCardsChallenge): SpokenKey {
  const [a, b] = c.parts;
  const groups = a !== c.total && b !== c.total ? ` Saying ${a === b ? a : `${a} or ${b}`} alone, one colored group, is wrong.` : '';
  return {
    answer: spokenIntegerWord(c.total), alsoAccept: [String(c.total)],
    acceptRule: `Naming the two groups and then the total ("${a} and ${b} make ${c.total}") is that answer. `
      + 'Counting out loud and ending on the total is that answer too.',
    signatureError: `A different number is not the answer, however close it is.${groups}`,
  };
}

/** A spoken total's known wrong answers, with the tap's ids (`dotCardsMiss`), most specific first. */
export function dotCardsSpokenMisses(c: DotCardsChallenge): KnownMiss[] {
  const groups = numberMisses(c.total, c.parts.map(value => ({ id: 'one_group', value, pattern: (n: number) => String(n) })));
  const named = groups.map(m => m.pattern);
  return [
    ...(groups.length ? [{ id: 'one_group', examples: groups.flatMap(m => m.examples ?? []),
      pattern: `The learner's answer is ${named.join(' or ')}, the dots of one colored group only, as if the other `
        + 'group was not on the card.' }] : []),
    ...offByMisses(c.total, 'the dots on the card'),
  ];
}

export const dotCardsMatches = (c: DotCardsChallenge, value: number) => value === c.total;

export function dotCardsMiss(c: DotCardsChallenge | null, value: number): DotCardsMiss | undefined {
  if (!c || value === c.total) return undefined;
  if (c.parts.includes(value)) return 'one_group';
  return value === c.total - 1 ? 'one_short' : value === c.total + 1 ? 'one_over'
    : value < c.total ? 'short_by_more' : 'over_by_more';
}

/** The learner's checked work in their terms, never the key. */
export const describeDotCardsCheck = (value: number) => `Tapped ${value}`;

export type CardFace = 'down' | 'showing' | 'looked';

const FACE_WORDS: Record<CardFace, string> = {
  down: 'Face down. The learner has not looked yet; they flip it with the "Flip the card" button.',
  showing: 'Face up for the quick look.',
  looked: 'Face down again after the learner\'s quick look. Try again gives one new look.',
};

/** What the tutor reads about the card on screen: how it is drawn and whether it has been looked at, never a count. */
export function dotCardsScene(c: DotCardsChallenge, view: { face: CardFace }): SceneOf {
  return { objects: [], facts: {
    card: `A dot card: ${ARRANGEMENT_WORDS[c.arrangement]}.`,
    face: FACE_WORDS[view.face],
    looked: view.face === 'down' ? 'no' : 'yes',
    timing: 'The look is short on purpose, so the learner sees the two groups instead of counting one by one. '
      + 'No timer is shown. Never mention speed or hurry the learner.',
    constraints: 'Before the learner answers, never say how many dots either group has, never count the dots aloud, '
      + 'and never say a number that narrows the total. Ask what they saw in each color instead.',
  } };
}

/** The journey's tap for one card, through the real pad. `wrong` taps one more than the total (one less at 10). */
export function dotCardsHarnessInputs(c: DotCardsChallenge, wrong: boolean): Array<{ type: 'choose'; label: string }> {
  const value = !wrong ? c.total : c.total < 10 ? c.total + 1 : c.total - 1;
  return [{ type: 'choose', label: `Answer ${value}` }];
}

/** The journey's spoken answers: the total's word, or a plainly different number. */
export function dotCardsHarnessWords(c: DotCardsChallenge): { correct: string; plainWrong: string } {
  return { correct: spokenIntegerWord(c.total), plainWrong: spokenIntegerWord(c.total >= 5 ? c.total - 3 : c.total + 4) };
}
