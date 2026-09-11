/**
 * Hand-authored judged script for calendar-explorer's spoken sequences.
 * Code owns the successor truth and every tutor line, so the spoken answer key
 * cannot drift for either the weekday or month cycle.
 */

import type {
  JudgedCueOptions,
  JudgedCueSurface,
  JudgedScriptItem,
} from '../../../hooks/judgedScriptContract';

export interface CalendarDaySequenceItem extends JudgedScriptItem {
  type: 'day_sequence';
  currentDay: string;
  expectedDay: string;
  chainPosition: number;
}

export interface CalendarMonthSequenceItem extends JudgedScriptItem {
  type: 'month_sequence';
  currentMonth: string;
  expectedMonth: string;
  chainPosition: number;
}

export type CalendarSequenceItem = CalendarDaySequenceItem | CalendarMonthSequenceItem;

export interface CalendarSequenceContext {
  title: string;
  gradeBand: string;
  supportTier?: string;
}

const WEEK_FROM_SUNDAY =
  'Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday';

const YEAR_FROM_JANUARY =
  'January, February, March, April, May, June, July, August, September, October, November, December';

const TWO_BRANCH_LAW =
  `Your whole reply to their attempt is ONE of the quoted lines below and nothing else: `
  + `no extra praise, hint, or question. A different reply gives the activity no verdict and the child waits. `;

const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, `
  + `never announce that you are waiting or listening, and simply stop speaking after the quoted line.`;

const sequenceWords = (item: CalendarSequenceItem) => item.type === 'day_sequence'
  ? {
      unit: 'day',
      current: item.currentDay,
      expected: item.expectedDay,
      fullSequence: WEEK_FROM_SUNDAY,
      anchor: 'Sunday',
      activity: 'days',
    }
  : {
      unit: 'month',
      current: item.currentMonth,
      expected: item.expectedMonth,
      fullSequence: YEAR_FROM_JANUARY,
      anchor: 'January',
      activity: 'months',
    };

const askFor = (item: CalendarSequenceItem): string => {
  const words = sequenceWords(item);
  return `Listen: ${words.current}. Your turn. What ${words.unit} comes next?`;
};

const affirmationFor = (item: CalendarSequenceItem): string => {
  const words = sequenceWords(item);
  return `Yes, ${words.expected} comes after ${words.current}.`;
};

/** Required remediation: rebuild the whole stable sequence from its anchor, then retry. */
const correctionFor = (item: CalendarSequenceItem): string => {
  const words = sequenceWords(item);
  return `My turn: let's say the ${words.activity} together from ${words.anchor}: ${words.fullSequence}. `
    + `${words.current} comes before ${words.expected}. `
    + `Your turn. What ${words.unit} comes after ${words.current}?`;
};

const judgingContract = (item: CalendarSequenceItem): string => {
  const words = sequenceWords(item);
  return `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner answers. `
    + `The correct answer is "${words.expected}". Accept that ${words.unit} name despite a small child pronunciation difference. `
    + `Saying "${words.current}" back, naming a different ${words.unit}, giving several names without landing on "${words.expected}", `
    + `or saying nothing is wrong. ${TWO_BRANCH_LAW}`
    + `If the answer is right, say exactly: "${affirmationFor(item)}" `
    + `If it is wrong, say exactly: "${correctionFor(item)}"`;
};

export const calendarSequenceItemCue = (
  item: CalendarSequenceItem,
  opts: Partial<JudgedCueOptions> = {},
): string => {
  const words = sequenceWords(item);
  const opening = opts.opening
    ? `Hi! We are going to make a chain of ${words.activity}. I will say a ${words.unit}, and you say the ${words.unit} that comes next. `
    : '';
  return `[CE_SEQUENCE_ITEM] Say exactly: "${opening}${askFor(item)}" ${judgingContract(item)} ${NEVER_PERFORM}`;
};

export const calendarSequenceMoveOnCue = (
  item: CalendarSequenceItem,
  next: CalendarSequenceItem | null,
): string => {
  const words = sequenceWords(item);
  const close =
    `Good try! Let's say the ${words.activity} from ${words.anchor}: ${words.fullSequence}. `
    + `${words.expected} comes after ${words.current}.`;
  if (!next) {
    return `[CE_SEQUENCE_MOVE] Say exactly: "${close} We will practice that chain again another time." Then stop.`;
  }
  return (
    `[CE_SEQUENCE_MOVE] Say exactly: "${close} Here comes the next one. ${askFor(next)}" `
    + `${judgingContract(next)} ${NEVER_PERFORM}`
  );
};

export const calendarSequenceCompleteCue = (): string =>
  `[CE_SEQUENCE_COMPLETE] Say exactly: "Great calendar sequence work! You kept the chain going. See you next time!" Then stop — the activity is over.`;

export const calendarSequencePronounceCue = (item: CalendarSequenceItem): string =>
  `[CE_SEQUENCE_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: "${askFor(item)}" `
  + `Do not treat anything you just heard as an answer, add nothing, and never say the answer. ${NEVER_PERFORM}`;

/** One cue surface is shared by the component and its contract tests. */
export const calendarExplorerSequencePackBase = <T extends CalendarSequenceItem>(
  items: T[],
  context: CalendarSequenceContext,
): JudgedCueSurface<T> => ({
  primitiveType: 'calendar-explorer',
  activityLine: 'live-judged calendar successor chain',
  items,
  itemCue: calendarSequenceItemCue,
  moveOnCue: calendarSequenceMoveOnCue,
  completeCue: calendarSequenceCompleteCue,
  pronounceCue: calendarSequencePronounceCue,
  contextFor: (item) => ({
    title: context.title,
    gradeBand: context.gradeBand,
    currentChallenge: `spoken ${item.type} turn ${item.chainPosition}`,
    challengeNumber: String(item.chainPosition),
    totalChallenges: String(items.length),
    challengeType: item.type,
    month: 'not used in this spoken mode',
    year: 'not used in this spoken mode',
    supportTier: context.supportTier ?? 'not set',
  }),
});

export const calendarSequenceHarnessAnswers = (item: CalendarSequenceItem) => {
  const words = sequenceWords(item);
  return {
    correct: words.expected,
    plainWrong: words.current,
    signatureWrong: {
      text: words.current,
      why: `the stimulus ${words.unit} repeated back instead of its successor`,
    },
    leakTokens: [words.expected],
  };
};
