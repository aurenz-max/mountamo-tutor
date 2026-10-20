/**
 * Comparison builder on the shared tutor/JEV teaching workspace: the items, the ask, the spoken key, the activity's
 * check and the scene, which the boss (`comparisonBuilder.boss.ts`), the component, the levers and the tests read.
 *
 * A challenge whose answer is one sayable thing (which group has more, how two numbers compare, the one number one
 * more or one less) is a spoken item that also takes the tap: the boss hands the tutor its key (`comparisonKey`) and
 * the activity checks a tap. Order and a one-more-and-one-less pair are several answers at once: they have no key,
 * are only tapped, and the tutor is never handed the sorted order or target +/- 1.
 *
 * Pure: no React.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import { offByMisses, spokenNumber, type KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { ComparisonBuilderChallenge, ComparisonBuilderData } from './ComparisonBuilder';
import { COMPARISON_MISSES, type ComparisonMiss } from './comparisonBuilder.card';

export { COMPARISON_MISSES, type ComparisonMiss };

/**
 * One challenge as the lesson runs it: the lesson's grade band and support tier stamped on, because the ask, the key
 * and the model lever's timing differ by them. Never generated.
 */
export type ComparisonItem = ComparisonBuilderChallenge & { band?: 'K' | '1'; tier?: 'easy' | 'medium' | 'hard' };

/** The challenge types by eval mode. */
export const COMPARISON_MODE: Record<ComparisonBuilderChallenge['type'], string> = {
  'compare-groups': 'compare_groups', 'compare-numbers': 'compare_numbers', order: 'order', 'one-more-one-less': 'one_more_less',
};

/** The lesson's items, in order. */
export const comparisonItems = (d: Pick<ComparisonBuilderData, 'challenges' | 'gradeBand' | 'supportTier'>): ComparisonItem[] =>
  (d.challenges ?? []).map(c => ({ ...c, band: d.gradeBand ?? 'K', ...(d.supportTier ? { tier: d.supportTier } : {}) }));

const bandOf = (c: ComparisonItem) => c.band ?? 'K';
const askOf = (c: ComparisonBuilderChallenge) => c.askFor ?? 'both';
const word = (n: number | undefined) => spokenNumber(n ?? 0);

/** Every number the challenge is about, so a model or an easier item can avoid them all. */
export function ownNumbers(c: ComparisonBuilderChallenge): number[] {
  const isNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
  switch (c.type) {
    case 'compare-groups': return [c.leftGroup?.count, c.rightGroup?.count].filter(isNumber);
    case 'compare-numbers': return [c.leftNumber, c.rightNumber].filter(isNumber);
    case 'one-more-one-less':
      return isNumber(c.targetNumber) ? [c.targetNumber - 1, c.targetNumber, c.targetNumber + 1] : [];
    default: return (c.numbers ?? []).filter(isNumber);
  }
}

// ── The ask and the key ──────────────────────────────────────────────────────

const GROUP_MENU_K = ['the left group', 'the right group', 'the same'];
const GROUP_MENU_1 = ['more', 'fewer', 'the same'];
const SIGN_MENU = ['greater than', 'less than', 'equal to'];
const RELATION: Record<string, string> = { '>': 'greater than', '<': 'less than', '=': 'equal to' };

/**
 * What the learner is asked. Kindergarten taps the group or the number that is bigger, so it is asked which one;
 * Grade 1 answers about the left group (the buttons read "The left group has… More, Fewer, The Same") and picks the
 * sign between two numbers. Every choice of a closed question is said in the ask.
 */
export function comparisonAsk(c: ComparisonItem): string {
  const k = bandOf(c) === 'K';
  switch (c.type) {
    case 'compare-groups': return k
      ? 'Which group has more, the left group or the right group? Or do they have the same?'
      : 'Does the left group have more, fewer, or the same as the right group?';
    case 'compare-numbers': return k
      ? `Which number is bigger, ${c.leftNumber} or ${c.rightNumber}? Or are they the same?`
      : `Which sign goes between ${c.leftNumber} and ${c.rightNumber}: greater than, less than, or equal to?`;
    case 'order':
      return `Put the number cards in order, from the ${c.direction === 'descending' ? 'biggest to the smallest' : 'smallest to the biggest'}.`;
    default: {
      const t = c.targetNumber;
      if (askOf(c) === 'both') return `Find the number one more than ${t} and the number one less than ${t}, and tap each one.`;
      return `What number is one ${askOf(c) === 'one-more' ? 'more' : 'less'} than ${t}?`;
    }
  }
}

/** What the ask says by design that may hold the answer: "one less than 2" says "one", the answer. */
export const comparisonGiven = (c: ComparisonItem): string[] =>
  (c.type === 'one-more-one-less' && askOf(c) !== 'both'
    ? [`one ${askOf(c) === 'one-more' ? 'more' : 'less'} than ${c.targetNumber}`] : []);

/** The groups' object names, when the two sides show different objects (a way to name a side). */
const groupName = (c: ComparisonBuilderChallenge, side: 'left' | 'right') => {
  const g = side === 'left' ? c.leftGroup : c.rightGroup, other = side === 'left' ? c.rightGroup : c.leftGroup;
  return g?.objectType && g.objectType !== other?.objectType ? [`the ${g.objectType}`] : [];
};

/** The key a spoken answer is judged against; null on an order or a one-more-and-one-less pair (tapped only). */
export function comparisonKey(c: ComparisonItem): SpokenKey | null {
  if (c.type === 'compare-groups') {
    const equal = c.correctAnswer === 'equal';
    const [more, fewer] = c.correctAnswer === 'more' ? ['left', 'right'] as const : ['right', 'left'] as const;
    if (bandOf(c) === 'K') {
      if (equal) return { answer: 'the same', alsoAccept: ['same', 'equal', 'they are the same', 'neither has more'],
        menu: GROUP_MENU_K, signatureError: 'Naming either group as the one with more is wrong: they have the same number.' };
      return { answer: `the ${more} group`,
        alsoAccept: [more, `the ${more} one`, `the ${more} side`, ...groupName(c, more), `the ${fewer} group has fewer`],
        menu: GROUP_MENU_K, signatureError: `"The ${fewer} group" is wrong, and so is "the same".` };
    }
    if (equal) return { answer: 'the same', alsoAccept: ['same', 'equal', 'they are the same'], menu: GROUP_MENU_1,
      signatureError: '"More" and "fewer" are wrong: the groups have the same number.' };
    return c.correctAnswer === 'more'
      ? { answer: 'more', alsoAccept: ['the left group has more', 'the right group has fewer'], menu: GROUP_MENU_1,
        acceptRule: 'Naming the left group as the one with more counts.', signatureError: '"Fewer" and "the same" are wrong.' }
      : { answer: 'fewer', alsoAccept: ['less', 'the left group has fewer', 'the right group has more'], menu: GROUP_MENU_1,
        acceptRule: 'Naming the right group as the one with more counts.', signatureError: '"More" and "the same" are wrong.' };
  }
  if (c.type === 'compare-numbers') {
    const a = c.leftNumber ?? 0, b = c.rightNumber ?? 0, s = c.correctSymbol ?? '=';
    const [big, small] = a >= b ? [a, b] : [b, a];
    if (bandOf(c) === 'K') {
      const menu = Array.from(new Set([String(a), String(b), 'the same']));
      if (s === '=') return { answer: 'the same', alsoAccept: ['same', 'equal', `they are both ${word(a)}`], menu,
        signatureError: `Naming ${a} as the bigger number is wrong: they are the same number.` };
      return { answer: word(big), alsoAccept: [String(big), `${word(big)} is bigger`, `${word(big)} is more than ${word(small)}`,
        `${word(small)} is less than ${word(big)}`], menu,
        signatureError: `${small} is wrong, and so is "the same".` };
    }
    if (s === '=') return { answer: 'equal to', alsoAccept: ['equal', 'equals', 'the same', `${word(a)} equals ${word(b)}`],
      menu: SIGN_MENU, signatureError: '"Greater than" and "less than" are wrong: the numbers are the same.' };
    const other = s === '>' ? '<' : '>';
    return { answer: RELATION[s],
      alsoAccept: [`${word(a)} is ${RELATION[s]} ${word(b)}`, `${word(b)} is ${RELATION[other]} ${word(a)}`,
        s === '>' ? 'greater' : 'less', `the ${RELATION[s]} sign`],
      menu: SIGN_MENU, acceptRule: `Naming ${big} as the bigger number counts: the sign is read with ${a} first, as printed.`,
      signatureError: `"${RELATION[other]}" read with ${a} first is wrong, and so is "equal to".` };
  }
  if (c.type !== 'one-more-one-less' || askOf(c) === 'both') return null;
  const t = c.targetNumber ?? 0, more = askOf(c) === 'one-more', n = more ? t + 1 : t - 1;
  return { answer: word(n), alsoAccept: [String(n)],
    acceptRule: `Counting ${more ? 'on' : 'back'} out loud from ${t} and ending on that number is that answer.`,
    signatureError: `${t}, the number itself, is wrong, and so is ${more ? t - 1 : t + 1}, a step the other way.` };
}

/**
 * A spoken answer's known wrong answers, with the tap's ids (`comparisonMiss`, the card's lists), most specific
 * first. Each pattern names the wrong answer the learner gives.
 */
export function comparisonSpokenMisses(c: ComparisonItem): KnownMiss[] {
  const k = bandOf(c) === 'K';
  if (c.type === 'compare-groups') {
    if (c.correctAnswer === 'equal') return [{ id: 'missed_equal', pattern: 'The groups have the same number, but the '
      + 'learner names one group as having more (or says the left group has more or fewer).',
    examples: k ? ['the left group', 'the right group'] : ['more', 'fewer'] }];
    const fewer = c.correctAnswer === 'more' ? 'right' : 'left';
    return [
      { id: 'said_equal', pattern: 'The learner says the two groups have the same number, though they do not.', examples: ['the same', 'equal'] },
      k ? { id: 'reversed', pattern: `The learner names the ${fewer} group as the one with more: the opposite relation.`,
        examples: [`the ${fewer} group`, fewer] }
        : { id: 'reversed', pattern: `The learner says the left group has ${c.correctAnswer === 'more' ? 'fewer' : 'more'}: the opposite relation.`,
          examples: [c.correctAnswer === 'more' ? 'fewer' : 'more'] },
    ];
  }
  if (c.type === 'compare-numbers') {
    const a = c.leftNumber ?? 0, b = c.rightNumber ?? 0;
    if (c.correctSymbol === '=') return [{ id: 'missed_equal', pattern: `${a} and ${b} are the same number, but the learner `
      + 'names one as bigger or picks greater than or less than.', examples: k ? [`${word(a)} is bigger`] : ['greater than', 'less than'] }];
    const [big, small] = a > b ? [a, b] : [b, a];
    return [
      { id: 'said_equal', pattern: `The learner says ${a} and ${b} are the same or equal.`, examples: ['the same', 'equal'] },
      { id: 'reversed', pattern: `The learner names ${small} as the bigger number (or picks the sign that says so): the opposite relation.`,
        examples: k ? [word(small), `${word(small)} is bigger`] : [c.correctSymbol === '>' ? 'less than' : 'greater than'] },
    ];
  }
  if (!comparisonKey(c)) return [];
  const t = c.targetNumber ?? 0, more = askOf(c) === 'one-more', back = more ? t - 1 : t + 1;
  const own: KnownMiss[] = [{ id: 'no_step', pattern: `The learner's answer is ${t}, the number itself, with no step.`, examples: [word(t)] },
    ...(back >= 1 ? [{ id: 'wrong_way', pattern: `The learner's answer is ${back}, one ${more ? 'less' : 'more'} than ${t}: a step the other way.`,
      examples: [word(back)] }] : [])];
  // The off-by entry that lands on the number itself is the no-step miss above.
  return [...own, ...offByMisses(more ? t + 1 : t - 1, `the number one ${more ? 'more' : 'less'} than ${t}`)
    .filter(m => m.id !== (more ? 'one_short' : 'one_over'))];
}

/** The journey's spoken answers: the key's own words, or a plainly different choice of the same kind. */
export function comparisonHarnessWords(c: ComparisonItem): { correct: string; plainWrong: string } {
  const key = comparisonKey(c)!, k = bandOf(c) === 'K';
  if (c.type === 'compare-groups') {
    const plainWrong = c.correctAnswer === 'equal' ? (k ? 'the left group' : 'more')
      : k ? `the ${c.correctAnswer === 'more' ? 'right' : 'left'} group` : c.correctAnswer === 'more' ? 'fewer' : 'more';
    return { correct: key.answer, plainWrong };
  }
  if (c.type === 'compare-numbers') {
    const a = c.leftNumber ?? 0, b = c.rightNumber ?? 0;
    const plainWrong = c.correctSymbol === '=' ? (k ? `${word(a)} is bigger` : 'greater than')
      : k ? word(Math.min(a, b)) : c.correctSymbol === '>' ? 'less than' : 'greater than';
    return { correct: key.answer, plainWrong };
  }
  return { correct: key.answer, plainWrong: word(c.targetNumber) };
}

// ── The activity's check ─────────────────────────────────────────────────────

export interface ComparisonView {
  /** The comparison word ('more' | 'less' | 'equal') or symbol ('<' | '>' | '=') chosen. */
  selected: string | null;
  ordered: readonly number[];
  oneMore: number | null;
  oneLess: number | null;
  /** The numbers in the order the cards are drawn (order challenges). */
  shuffled: readonly number[];
  /** Whether the "Left: N / Right: N" count badges are on screen. */
  countsShown: boolean;
  /** Whether the signs are drawn as alligator mouths with their caption (Grade 1 compare-numbers). */
  alligator?: boolean;
}

const GROUP_WORDS: Record<string, string> = {
  more: 'the left group has more', less: 'the left group has fewer', equal: 'the two groups are the same' };

/** The learner's work in their own terms, never the key. */
export function describeComparison(challenge: ComparisonBuilderChallenge, view: Pick<ComparisonView,
  'selected' | 'ordered' | 'oneMore' | 'oneLess'>): string {
  switch (challenge.type) {
    case 'compare-groups':
      return view.selected ? `Chose: ${GROUP_WORDS[view.selected] ?? view.selected}` : 'Nothing chosen yet';
    case 'compare-numbers':
      return view.selected
        ? `Chose: ${challenge.leftNumber} ${view.selected} ${challenge.rightNumber}` : 'No symbol chosen yet';
    case 'order':
      return view.ordered.length ? `Placed in order: ${view.ordered.join(', ')}` : 'Nothing placed yet';
    default: {
      const parts: string[] = [];
      if (askOf(challenge) !== 'one-less') parts.push(`one more: ${view.oneMore ?? 'not chosen yet'}`);
      if (askOf(challenge) !== 'one-more') parts.push(`one less: ${view.oneLess ?? 'not chosen yet'}`);
      return `Chose ${parts.join('; ')}`;
    }
  }
}

const relationMiss = (chosen: string | null, key: string | undefined, equal: string): ComparisonMiss | undefined =>
  !chosen || chosen === key ? undefined : chosen === equal ? 'said_equal' : key === equal ? 'missed_equal' : 'reversed';

const stepMiss = (got: number | null, target: number, step: 1 | -1): ComparisonMiss | undefined => {
  if (got === null || got === target + step) return undefined;
  if (got === target) return 'no_step';
  if (got === target - step) return 'wrong_way';
  const off = got - (target + step);
  return off === -1 ? 'one_short' : off === 1 ? 'one_over' : off < 0 ? 'short_by_more' : 'over_by_more';
};

/** What a wrong answer shows (`TeachingAttempt.miss`): the card's ids. */
export function comparisonMiss(challenge: ComparisonBuilderChallenge | null, view: Pick<ComparisonView,
  'selected' | 'ordered' | 'oneMore' | 'oneLess'>): ComparisonMiss | undefined {
  if (!challenge) return undefined;
  switch (challenge.type) {
    case 'compare-groups': return relationMiss(view.selected, challenge.correctAnswer, 'equal');
    case 'compare-numbers': return relationMiss(view.selected, challenge.correctSymbol, '=');
    case 'order': {
      const want = [...(challenge.numbers ?? [])].sort((a, b) => challenge.direction === 'descending' ? b - a : a - b);
      if (want.every((n, i) => view.ordered[i] === n)) return undefined;
      if (want.every((n, i) => view.ordered[i] === want[want.length - 1 - i])) return 'reversed';
      return want.filter((n, i) => view.ordered[i] !== n).length === 2 ? 'two_swapped' : 'other_order';
    }
    default: {
      const t = challenge.targetNumber ?? 0, ask = askOf(challenge);
      if (ask === 'both' && view.oneMore === t - 1 && view.oneLess === t + 1) return 'wrong_way';
      return (ask !== 'one-less' ? stepMiss(view.oneMore, t, 1) : undefined)
        ?? (ask !== 'one-more' ? stepMiss(view.oneLess, t, -1) : undefined);
    }
  }
}

// ── The scene ────────────────────────────────────────────────────────────────

/** What this item's answer is, which the scene withholds until the learner answers (the family's never-say rules). */
function constraintsOf(c: ComparisonItem): string {
  switch (c.type) {
    case 'compare-groups':
      return 'Before the learner answers, never say which group has more or fewer, whether they have the same, or how '
        + 'many are in a group; counting a group with the learner, one object at a time, is teaching; naming the winner is not.';
    case 'compare-numbers':
      return 'Before the learner answers, never say which number is bigger, the relation or the sign.';
    case 'order':
      return 'Before the learner checks, never say which number goes first or which comes next.';
    default:
      return askOf(c) === 'both'
        ? 'Before the learner answers, never say either number; give the one less ask the same attention as the one more ask.'
        : 'Before the learner answers, never say the number one more or one less.';
  }
}

/** What a Kindergarten screen shows in place of words. */
function wordlessOf(c: ComparisonItem): string | undefined {
  if (bandOf(c) !== 'K') return undefined;
  if (c.type === 'order') return `No words on screen: three bars growing from ${c.direction === 'descending' ? 'tall to short' : 'short to tall'} show the direction.`;
  if (c.type === 'one-more-one-less') {
    const ask = askOf(c);
    return ask === 'both' ? 'No words on screen: an up arrow marks the one more row and a down arrow the one less row.'
      : `No words on screen: ${ask === 'one-more' ? 'an up arrow' : 'a down arrow'} marks the row.`;
  }
  return undefined;
}

/** What is drawn and asked, for the tutor. Counts only where the screen shows them. The lever set adds its facts. */
export function comparisonScene(challenge: ComparisonItem, view: ComparisonView): SceneOf {
  const drawn: Record<string, string | number> = {};
  if (challenge.type === 'compare-groups') {
    drawn.groups = `left: ${challenge.leftGroup?.objectType ?? 'objects'}, right: ${challenge.rightGroup?.objectType ?? 'objects'}`;
    if (view.countsShown) drawn.countsOnScreen = `left ${challenge.leftGroup?.count}, right ${challenge.rightGroup?.count}`;
  } else if (challenge.type === 'compare-numbers') {
    drawn.numbers = `${challenge.leftNumber} on the left, ${challenge.rightNumber} on the right`;
    if (view.alligator) drawn.mnemonic = 'The signs are drawn as alligator mouths, captioned "The alligator always eats the bigger number!"';
  } else if (challenge.type === 'order') {
    drawn.cards = view.shuffled.join(', ');
    drawn.direction = challenge.direction === 'descending' ? 'greatest to least' : 'least to greatest';
  } else {
    drawn.target = challenge.targetNumber ?? '';
    drawn.asks = askOf(challenge) === 'both' ? 'one more and one less' : askOf(challenge) === 'one-more' ? 'one more' : 'one less';
  }
  const wordless = wordlessOf(challenge);
  return {
    objects: [],
    facts: {
      kind: challenge.type, ...drawn,
      ...(wordless ? { labels: wordless } : {}),
      learnerWork: describeComparison(challenge, view),
      constraints: constraintsOf(challenge),
    },
  };
}
