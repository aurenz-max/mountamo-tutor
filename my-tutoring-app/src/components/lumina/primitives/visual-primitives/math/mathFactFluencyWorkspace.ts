/**
 * Math fact fluency on the shared tutor/JEV teaching workspace. The boss (`mathFactFluency.boss.ts`) asks each fact;
 * how the learner answers follows what is drawn:
 *   - `choice`: a row of numbers (visual-fact, equation-solve), tapped;
 *   - `equation`: a match from a picture to one of the printed equations, tapped;
 *   - `picture`: a match from the printed fact to one of the pictures, tapped;
 *   - `stepper`: a number set with − and + and Submit (missing-number, speed-round).
 * A number answer (`choice`, `stepper`) may also be said aloud: the item has a spoken key (`mathFactKey`), judged by
 * JEV from the tutor's feedback, and still takes the tap or Submit, which the activity checks (session 2026-10-13
 * 750ca99a: "18" said to 9 + 9 was praised and never credited). A match answers with a tap only: "that one" names no
 * equation or picture, so it has no key and its answer never reaches the tutor.
 * Response time stays a silent metric: nothing here advances or grades on a clock, and nothing shows a timer.
 *
 * Pure: the component, the boss, the levers and the tests read the same ask, key, checks, misses and scene.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import { numberMisses, offByMisses, type KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { MathFactFluencyChallenge } from './MathFactFluency';
import type { MathFactMiss } from './mathFactFluency.card';
import { spokenIntegerWord } from './spokenNumberWords';

export type { MathFactMiss };

export type MathFactChannel = 'choice' | 'equation' | 'picture' | 'stepper';

/** The learner's answer as the activity received it. */
export type MathFactResponse =
  | { kind: 'number'; value: number }
  | { kind: 'equation'; value: string }
  | { kind: 'picture'; index: number };

/** How this challenge is answered, from what the component renders for it. */
export function mathFactChannel(c: MathFactFluencyChallenge): MathFactChannel {
  if (c.type === 'match') return c.matchDirection === 'equation-to-visual' ? 'picture' : 'equation';
  return c.options?.length ? 'choice' : 'stepper';
}

/** The eval mode a challenge type belongs to (`visual-fact` → `visual_fact`). */
export const mathFactMode = (c: Pick<MathFactFluencyChallenge, 'type'>) => c.type.replace('-', '_');

/** The number after "=" in an equation option. */
export const equationResult = (eq: string) => parseInt(eq.split('=').pop()?.trim() ?? '', 10);

/** The printed problem with its "?", exactly as the component draws it. */
export function formatMathFact(c: MathFactFluencyChallenge): string {
  const op = c.operation === 'addition' ? '+' : '−';
  if (c.unknownPosition === 'operand1') return `? ${op} ${c.operand2} = ${c.result}`;
  if (c.unknownPosition === 'operand2') return `${c.operand1} ${op} ? = ${c.result}`;
  return `${c.operand1} ${op} ${c.operand2} = ?`;
}

/** The numbers printed in the fact, in reading order (not the "?"). */
const printedNumbers = (c: MathFactFluencyChallenge) => (formatMathFact(c).match(/\d+/g) ?? []).map(Number);

/** Whether the answer is a number the learner can say aloud. */
export const mathFactSpoken = (c: MathFactFluencyChallenge) => {
  const channel = mathFactChannel(c);
  return channel === 'choice' || channel === 'stepper';
};

/** The fact with its answer in place: "9 + 9 = 18". */
function solvedFact(c: MathFactFluencyChallenge): string {
  const op = c.operation === 'addition' ? '+' : '−';
  const [a, b, r] = c.unknownPosition === 'operand1' ? [c.correctAnswer, c.operand2, c.result]
    : c.unknownPosition === 'operand2' ? [c.operand1, c.correctAnswer, c.result] : [c.operand1, c.operand2, c.correctAnswer];
  return `${a} ${op} ${b} = ${r}`;
}

/**
 * What the learner is asked: the instruction on screen and, when a fact is printed, that fact with its "?". A
 * picture-to-equation match prints no fact; an equation-to-picture match's fact is in the scene's `problem`.
 */
export function mathFactAsk(c: MathFactFluencyChallenge): string {
  // An instruction that already states the fact ("What is 9 + 9?") is not followed by it again.
  const states = printedNumbers(c).every(n => new RegExp(`\\b${n}\\b`).test(c.instruction));
  return mathFactSpoken(c) && !states ? `${c.instruction} The printed fact: ${formatMathFact(c)}.` : c.instruction;
}

/** What the ask says by design: the printed fact, and its numbers as words (an easy instruction says "start at three"). */
export const mathFactGiven = (c: MathFactFluencyChallenge): string[] =>
  [formatMathFact(c), ...printedNumbers(c).map(spokenIntegerWord)];

/** The key a spoken number is judged against; null on a match, which is tapped only. */
export function mathFactKey(c: MathFactFluencyChallenge): SpokenKey | null {
  if (!mathFactSpoken(c)) return null;
  const n = c.correctAnswer;
  return { answer: spokenIntegerWord(n), alsoAccept: [String(n)],
    acceptRule: `The whole fact said with that number in place (${solvedFact(c)}) is that answer.`,
    signatureError: 'A different number is not the answer, however close it is, and neither is a number already printed in the fact.' };
}

/**
 * A spoken answer's known wrong answers (handoff 20 Part B), most specific first, as `mathFactMiss` names them. One
 * `printed_number` entry names every printed number: a miss id appears once per item (`validSpokenMissRequest`).
 */
export function mathFactSpokenMisses(c: MathFactFluencyChallenge): KnownMiss[] {
  if (!mathFactSpoken(c)) return [];
  const printed = printedNumbers(c);
  const [a, b] = printed;
  const other = printed.length === 2 ? [a + b, Math.abs(a - b)].find(n => n !== c.correctAnswer) : undefined;
  const fact = formatMathFact(c);
  const operation = numberMisses(c.correctAnswer, [{ id: 'other_operation', value: other,
    pattern: n => `The learner's answer is ${n}: the two printed numbers in ${fact} combined the other way.` }]);
  const echoes = numberMisses(c.correctAnswer, printed.filter(p => p !== other)
    .map(value => ({ id: 'printed_number', value, pattern: (n: number) => String(n) })));
  const named = echoes.map(m => m.pattern);
  return [
    ...operation,
    ...(echoes.length ? [{ id: 'printed_number', examples: echoes.flatMap(m => m.examples ?? []),
      pattern: `The learner's answer is ${named.join(' or ')}, a number already printed in ${fact}.` }] : []),
    ...offByMisses(c.correctAnswer, `the number that replaces the "?" in ${fact}`),
  ];
}

/** The activity's own check. */
export function mathFactMatches(c: MathFactFluencyChallenge, r: MathFactResponse): boolean {
  if (r.kind === 'number') return r.value === c.correctAnswer;
  if (r.kind === 'equation') return equationResult(r.value) === c.correctAnswer;
  return c.visualOptions?.[r.index]?.count === c.correctAnswer;
}

/**
 * What a wrong answer shows (`TeachingAttempt.miss`, handoff 20), from the number answered (a number, an
 * equation's total, or a picture's count): `other_operation` (the two printed numbers combined the other
 * way: added where the fact takes away, or the reverse), `printed_number` (a number already in the printed
 * fact), then `one_short` / `one_over` / `short_by_more` / `over_by_more`. A picture-to-equation match prints
 * no fact, so it names only how far off the chosen equation's total is.
 */
export function mathFactMiss(c: MathFactFluencyChallenge | null, r: MathFactResponse): MathFactMiss | undefined {
  if (!c) return undefined;
  const got = r.kind === 'number' ? r.value : r.kind === 'equation' ? equationResult(r.value) : c.visualOptions?.[r.index]?.count;
  const want = c.correctAnswer;
  if (got === undefined || Number.isNaN(got) || got === want) return undefined;
  if (mathFactChannel(c) !== 'equation') {
    const printed = printedNumbers(c);
    const [a, b] = printed;
    if (printed.length === 2 && [a + b, Math.abs(a - b)].includes(got)) return 'other_operation';
    if (printed.includes(got)) return 'printed_number';
  }
  return got === want - 1 ? 'one_short' : got === want + 1 ? 'one_over' : got < want ? 'short_by_more' : 'over_by_more';
}

const visualWord = (type?: string) => type === 'ten-frame' ? 'ten frame' : type === 'fingers' ? 'hand of fingers' : 'dot picture';

/** The learner's checked work in their terms, never the key. */
export function describeMathFactCheck(c: MathFactFluencyChallenge, r: MathFactResponse): string {
  if (r.kind === 'number') return mathFactChannel(c) === 'stepper' ? `Entered ${r.value}` : `Chose ${r.value}`;
  if (r.kind === 'equation') return `Chose the equation ${r.value}`;
  const picked = c.visualOptions?.[r.index];
  return picked ? `Chose the ${visualWord(picked.type)} with ${picked.count}` : 'Chose a picture';
}

/** This item's never-say rules: what on screen would give the answer away. How the learner answers is the card's. */
const CONSTRAINTS: Record<MathFactChannel, string> = {
  choice: 'Before the learner answers, never say the number that answers the fact, and never count the picture aloud to its end.',
  stepper: 'Before the learner answers, never say the number that replaces the "?".',
  equation: 'Which equation matches, and how many the picture shows, are the answer: never say them.',
  picture: 'The answer and which picture shows it are the answer: never say them.',
};

/** How far the tutor may go at this support tier, so it never says what the tier withheld on screen. */
function coaching(tier?: MathFactFluencyChallenge['supportTier']): string | undefined {
  if (!tier) return undefined;
  return tier === 'easy' ? 'You may name a strategy (count the picture, count on, think backwards) and walk the setup.'
    : tier === 'medium' ? 'Nudge the next step only; do not name the whole strategy.'
      : 'Do not name a strategy. Ask what the learner notices and let them reason.';
}

/** What the tutor reads about the fact on screen. The lever set adds what pulled levers drew (`leverScene`). */
export function mathFactScene(c: MathFactFluencyChallenge, view: { maxNumber: number }): SceneOf {
  const channel = mathFactChannel(c);
  const showsPicture = c.type === 'visual-fact' ? !!c.visualType : channel === 'equation';
  const tip = coaching(c.supportTier);
  const choices = channel === 'choice' ? (c.options ?? []).join(' | ')
    : channel === 'equation' ? (c.equationOptions ?? []).join(' | ')
      : channel === 'picture' ? (c.visualOptions ?? []).map(v => `a ${visualWord(v.type)} of ${v.count}`).join(' | ') : '';
  return { objects: [], facts: {
    kind: c.type,
    range: `Facts within ${view.maxNumber}`,
    // A picture-to-equation match prints no problem; the picture is the question.
    ...(channel !== 'equation' ? { problem: formatMathFact(c) } : {}),
    // What is drawn, not how many: the count of the picture is the answer.
    ...(showsPicture ? { picture: `A ${visualWord(c.visualType)}; the learner counts it` } : {}),
    ...(choices ? { choices } : {}),
    timing: 'No timer and no time limit. Never mention speed or hurry the learner.',
    ...(c.supportTier ? { supportTier: c.supportTier } : {}),
    ...(tip ? { coaching: tip } : {}),
    constraints: CONSTRAINTS[channel],
  } };
}

type HarnessInput = { type: 'touch'; target: string } | { type: 'choose'; label: string };

/**
 * The journey's inputs for one challenge, through the real controls: the choice (a number, an
 * equation or a picture), or the stepper pressed up to the number and Submit. `wrong` picks another
 * choice, or sets a number one away from the answer.
 */
export function mathFactHarnessInputs(c: MathFactFluencyChallenge, wrong: boolean, maxNumber: number): HarnessInput[] {
  const channel = mathFactChannel(c);
  const pickIndex = (n: number, right: (i: number) => boolean) => {
    const at = Array.from({ length: n }, (_, i) => i).find(i => right(i) !== wrong);
    if (at === undefined) throw new Error(`math-fact-fluency ${c.type}: no ${wrong ? 'wrong' : 'right'} choice`);
    return at;
  };
  if (channel === 'choice') {
    const opts = c.options ?? [];
    return [{ type: 'touch', target: `option-${opts[pickIndex(opts.length, i => opts[i] === c.correctAnswer)]}` }];
  }
  if (channel === 'equation') {
    const eqs = c.equationOptions ?? [];
    return [{ type: 'touch', target: `equation-${pickIndex(eqs.length, i => equationResult(eqs[i]) === c.correctAnswer)}` }];
  }
  if (channel === 'picture') {
    const pics = c.visualOptions ?? [];
    return [{ type: 'touch', target: `picture-${pickIndex(pics.length, i => pics[i].count === c.correctAnswer)}` }];
  }
  const cap = maxNumber + 5;
  const value = !wrong ? c.correctAnswer : c.correctAnswer + 1 <= cap ? c.correctAnswer + 1 : c.correctAnswer - 1;
  // The stepper starts empty; the first + shows 1. Zero is one + then one −.
  const presses: HarnessInput[] = value === 0 ? [{ type: 'choose', label: 'One more' }, { type: 'choose', label: 'One less' }]
    : Array.from({ length: value }, () => ({ type: 'choose' as const, label: 'One more' }));
  return [...presses, { type: 'choose', label: 'Submit' }];
}

/** The journey's spoken answers: the number's word, or a plainly different number (the off-by-one belongs to the probes). */
export function mathFactHarnessWords(c: MathFactFluencyChallenge): { correct: string; plainWrong: string } {
  const n = c.correctAnswer;
  return { correct: spokenIntegerWord(n), plainWrong: spokenIntegerWord(n >= 4 ? n - 3 : n + 4) };
}
