/**
 * diMathFactsDomain — what the math-facts pack TEACHES, with no teaching engine
 * attached: the item shape, the validity gates, what the child is asked, and
 * what counts as having answered the printed fact.
 *
 * Sunset slice for DI pack #3 (di-math-facts, born 2026-07-24), following
 * `countingBoardDomain`, `shapeSorterDomain`, `numberSequencerDomain`,
 * `diLetterSoundsDomain` and `diWordReadingDomain`
 * (qa/live-runtime-handoffs/07-sunset-scripted-tutoring.md). The split is by
 * ownership:
 *
 *   - HERE: the assignment. Which items can be asked at all, the question the
 *     child hears, what counts as the answer, and the success condition stated
 *     plainly enough for a tutor to judge against.
 *   - `diMathFactsScript`: the retiring control protocol — the model/guide/test
 *     lead-in, the sentinel-opened affirm and correction lines, the in-band
 *     judging contract and the bracketed cues. It re-exports this module, so the
 *     generator, the tester, the Pip pose and the lesson-bench extractor keep one
 *     address.
 *
 * Four pieces of DISTAR content survive the sunset, because each is task
 * structure rather than control protocol:
 *
 *   1. THE ANSWER IS NEVER ON SCREEN. The printed problem is the stimulus and
 *      the spoken number word is the answer, so `display` carries no equals sign
 *      and no answer word, and `solvedDisplay` is a POST-commit reward.
 *      `name_numeral` is the one mode where the stimulus IS the answer — the
 *      child reads a printed numeral — and its gate is inverted accordingly.
 *   2. COUNTING TO THE ANSWER IS A ROUTE, NOT A MISS. It is the spoken analog of
 *      sounding out a word. The DIRECTION differs by skill: addition and the
 *      counting step count up, take-away counts back, and naming a numeral has
 *      no counting route at all — reciting the sequence to reach it is a
 *      different act from reading the numeral in front of you.
 *   3. A TEEN IS NOT ITS DECADE, AND A COMPOUND NUMERAL ARRIVES WHOLE. Above
 *      twelve these are the two discriminations the 1-120 counting extension
 *      lives or dies on, and they are properties of the answer rather than of
 *      any wording.
 *   4. STRICT ON A DIFFERENT QUANTITY. A near number is a wrong answer.
 *      `asrAliases` stays a reporting cross-check and is never a judge.
 *
 * What does not survive is the wording that decided progression: the sentinel
 * openers, the two-branch law, the correction cap and the exact-line contract.
 */
import type { TeachingItem } from '../../../hooks/teachingItemContract';
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { spokenIntegerWord } from '../math/spokenNumberWords';
import { diMathFactsModePlan, DI_MATH_FACTS_MODES, type DiMathFactsChallengeType }
  from './diMathFactsModes';

export type { DiMathFactsChallengeType } from './diMathFactsModes';

/**
 * The within-mode SUPPORT tier (L3). `challengeType` = WHICH fact skill,
 * `supportTier` = HOW MUCH of the DISTAR sequence precedes the child's answer.
 * The tier composed the legacy lead-in; on the teaching workspace the tutor
 * decides how much to model, and the tier survives as the item fact it reads —
 * `hard` is the item that must be answered cold, which is what makes the silent
 * response time a retrieval signal rather than partly an echo delay.
 */
export type DiMathFactsSupportTier = 'easy' | 'medium' | 'hard';

/** One printed problem the tutor drills. Mirrors the generator output shape. */
export interface DiMathFactsChallenge {
  id: string;
  /** Which eval-mode SKILL this item drills. */
  challengeType: DiMathFactsChallengeType;
  /** How much of the DISTAR sequence precedes the child's answer. Absent =
   *  easy (the L0 shape), so a session generated before L3 behaves as it did. */
  supportTier?: DiMathFactsSupportTier;
  /** The two numbers in the printed problem. Their RELATIONSHIP depends on the
   *  challengeType (a + b / a − b / the number after a, where b is 1), so
   *  `answerNumeral` is authoritative — never recompute it from a and b. */
  a: number;
  b: number;
  /** Printed stimulus shown on the stage, e.g. "2 + 1", "3 - 1", "5 →".
   *  Never contains the answer. */
  display: string;
  /** Spoken form of the printed problem, e.g. "two plus one", "the number
   *  after five", "this number". Reads correctly inside the ask. */
  problem: string;
  /** The spoken target: the answer as a number word, e.g. "three". */
  answerWord: string;
  /** The numeric answer — derived in code, never by the LLM. */
  answerNumeral: number;
  /** The COMPLETED form, e.g. "2 + 1 = 3". Revealed only after a committed
   *  correct answer; the stage shows `display` until then. */
  solvedDisplay: string;
  /** Whole-token ASR aliases — passive cross-check only, never the judge.
   *  Digit lexicalizations ("3") and homophones (won/to/for/ate) live here. */
  asrAliases?: string[];
}

/** The eval modes this primitive binds to the shared teaching workspace. All
 *  five, because every one is the same act: see the printed problem, speak the
 *  number word. What differs is which fact skill is drilled. */
export const DI_MATH_FACTS_WORKSPACE_MODES =
  DI_MATH_FACTS_MODES.map(definition => definition.evalMode);

/**
 * Is "counting to the answer" a legitimate route for THIS item, and which way?
 * Addition and the counting step count UP; take-away counts BACK. Naming a
 * printed numeral has no route: you do not count your way to a number's NAME,
 * and telling the tutor to accept one would license affirming a child who
 * recited a sequence instead of reading the numeral in front of them.
 */
export const countingRouteFor = (
  item: Pick<DiMathFactsChallenge, 'challengeType'>,
): 'up' | 'back' | null =>
  item.challengeType === 'name_numeral' ? null
    : item.challengeType === 'subtraction_fact' ? 'back' : 'up';

/** The stimulus IS the answer only when the task is to read a printed numeral.
 *  Every other mode hides the answer, which is what the leak gate below checks. */
export const stimulusIsAnswer = (item: Pick<DiMathFactsChallenge, 'challengeType'>) =>
  item.challengeType === 'name_numeral';

/** One workspace assignment. Extends the DOMAIN item base (what the answer is
 *  made of); the runtime's own `TeachingItem` (task/expectedAnswer/checker) is a
 *  different layer, and `DiMathFactsTeaching` maps onto it explicitly. */
export interface MathFactItem extends TeachingItem {
  challengeType: DiMathFactsChallengeType;
  supportTier: DiMathFactsSupportTier;
  /** The printed stimulus, exactly as drawn. */
  display: string;
  /** The printed stimulus split into its drawn tokens, e.g. ["2","+","1"].
   *  A single-token stimulus (a bare numeral) yields an empty list, so nothing
   *  inside it is a separate demonstration target. */
  terms: string[];
  problem: string;
  answerWord: string;
  answerNumeral: number;
  /** The completed fact, revealed only after a committed correct answer. */
  solvedDisplay: string;
  /** Which way a child may legitimately count to reach this answer, if at all. */
  countingRoute: 'up' | 'back' | null;
  /** The question the child hears. It never contains the answer. */
  ask: string;
  /** The accepted answer, short enough to compare a tutor's affirmation against. */
  accepted: string;
  /** The success condition in full, for the tutor's scene facts. */
  assignment: string;
}

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && !!value.trim();

/** The drawn tokens of a printed stimulus. One token means the stimulus is a
 *  single object and has no parts to point at separately. */
export const termsOf = (display: string): string[] => {
  const tokens = display.trim().split(/\s+/).filter(Boolean);
  return tokens.length > 1 ? tokens : [];
};

/**
 * Independent key check, run on both sides of the wire. An item is DROPPED
 * rather than repaired: a repaired math-fact item would drill a fact nobody
 * chose, and a repaired answer word would have the tutor affirm a number the
 * evaluation never recorded.
 */
export function mathFactChallengeValid(c: DiMathFactsChallenge): boolean {
  if (!c || !nonEmpty(c.id) || !nonEmpty(c.display) || !nonEmpty(c.problem)) return false;
  if (!nonEmpty(c.answerWord) || !nonEmpty(c.solvedDisplay)) return false;
  if (!DI_MATH_FACTS_WORKSPACE_MODES.includes(c.challengeType)) return false;
  if (c.supportTier && !['easy', 'medium', 'hard'].includes(c.supportTier)) return false;
  // The pack's ceiling. An answer outside it has no reliable spoken form here,
  // and the tutor would be judging against a word the child cannot be taught.
  if (!Number.isInteger(c.answerNumeral) || c.answerNumeral < 0 || c.answerNumeral > 120) return false;
  // ANSWER-KEY DESYNC. The number word and the numeral are produced by two
  // different code paths, and the tutor judges against the WORD while the
  // evaluation records the NUMERAL. A mismatch would affirm one and score the
  // other, which no amount of good teaching can recover.
  if (c.answerWord.trim().toLowerCase() !== spokenIntegerWord(c.answerNumeral)) return false;
  // THE ANSWER-LEAK RULE, as a gate rather than a convention. A stimulus that
  // arrived carrying its own solution is not a harder item, it is a different
  // and unteachable one.
  const display = c.display.trim();
  if (stimulusIsAnswer(c)) {
    // Inverted: here the printed numeral IS what the child must name, so it must
    // be exactly that numeral and nothing else — no operator to compute with.
    if (display !== String(c.answerNumeral)) return false;
  } else {
    if (display.includes('=')) return false;
    if (new RegExp(String.raw`\b` + c.answerWord.trim() + String.raw`\b`, 'i').test(display)) return false;
    // A computed mode needs something to compute FROM: an operator and a second
    // term. A bare numeral here would be `name_numeral` wearing another label.
    if (!termsOf(display).length) return false;
  }
  // The reward must actually complete the fact, or the receipt shows nothing.
  if (!c.solvedDisplay.includes(String(c.answerNumeral))
    && !c.solvedDisplay.toLowerCase().includes(c.answerWord.trim().toLowerCase())) return false;
  return true;
}

/**
 * The ask, in the child's own terms — and deliberately WITHOUT the answer. Every
 * mode is the same act, so every item asks the same question shape; `problem`
 * carries the mode difference ("two plus one", "the number after five", "this
 * number") and never the answer.
 */
export function askFor(item: Pick<DiMathFactsChallenge, 'problem'>): string {
  return `What is ${item.problem}?`;
}

/**
 * The success condition, and what is NOT it — short, because this sentence is
 * what a tutor's feedback gets judged against. Three sentences for a computed
 * fact (target, strictness, accepted route) and two for naming a numeral, which
 * has no route. The word-reading finding holds: a condition that states the same
 * thing twice reads as two conditions, so each discrimination appears once.
 *
 * The teen/decade and whole-compound clauses are added only above twelve, where
 * they are the two discriminations the 1-120 counting extension depends on.
 * Below that they would be inert text on every item in the pack.
 */
function assignmentFor(c: DiMathFactsChallenge): string {
  if (stimulusIsAnswer(c)) {
    return `The learner must say the name of the printed numeral ${c.display.trim()} out loud: `
      + `${c.answerWord}. Reciting the counting sequence up to it, or saying a different number, `
      + 'is not naming this numeral.';
  }
  const route = countingRouteFor(c);
  const compound = c.answerNumeral >= 13
    ? ' A teen and its decade are different numbers, never near misses: thirteen is not thirty. '
      + 'A number said as several words is one answer and must arrive whole.'
    : '';
  return `The learner must say the answer to "${c.problem}" out loud: ${c.answerWord}. `
    + `A different number is not the answer, however close it is.${compound} `
    + `Counting ${route} to it out loud and then saying it is a correct answer.`;
}

/** Expand a generated pool into the assignments the workspace actually asks.
 *  Unaskable items are DROPPED, never repaired. */
export function buildMathFactItems(challenges: DiMathFactsChallenge[] = []): MathFactItem[] {
  const seen = new Set<string>();
  return challenges.filter(c => {
    if (!mathFactChallengeValid(c) || seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  }).map(c => ({
    id: c.id,
    challengeType: c.challengeType,
    supportTier: c.supportTier ?? 'easy',
    display: c.display.trim(),
    terms: termsOf(c.display),
    problem: c.problem,
    answerWord: c.answerWord.trim().toLowerCase(),
    answerNumeral: c.answerNumeral,
    solvedDisplay: c.solvedDisplay,
    countingRoute: countingRouteFor(c),
    ask: askFor(c),
    accepted: c.answerWord.trim().toLowerCase(),
    assignment: assignmentFor(c),
    answerKind: diMathFactsModePlan(c).answerStep.actionContract.answerKind === 'voice' ? 'voice' : 'gesture',
    responseClass: c.answerNumeral <= 20 ? 'number_word_to_20' : 'number_word_to_120',
  }));
}

/** The item as the tutor and the outcome observer are told it. Every mode is spoken: the
 *  child says a number word, the tutor hears the audio and JEV reads its completed feedback. */
export const workspaceAssignment = (item: MathFactItem): TeachingAssignment =>
  ({ id: item.id, task: item.ask, expectedAnswer: item.answerWord, response: 'speech' });

/** Is this printed token a number the tutor can point at, or the operator
 *  between them? Both are markable; only the label differs. */
const isNumeral = (term: string) => /^[0-9]+$/.test(term);

/** The drawn stage. Term objects exist only where the stimulus really has parts: a bare
 *  numeral is one object, so there is no term inside it to point at separately. */
export const workspaceScene = (item: MathFactItem): WorkspaceScene => ({
  objects: [
    { id: 'problem', selected: false, group: 'assignment target (the printed problem)',
      label: `the printed problem "${item.display}", which the learner must answer out loud` },
    ...item.terms.map((term, position) => ({ id: `term-${position}`, selected: false,
      group: 'part of the printed problem',
      label: isNumeral(term)
        ? `the printed number "${term}", part ${position + 1} of the problem`
        : `the "${term}" sign in the problem` })),
  ],
  facts: { kind: item.challengeType, assignment: item.assignment, printedProblem: item.display,
    spokenProblem: item.problem,
    // The tier the child is meant to meet this fact at. It is a fact rather
    // than a composed lead-in: the tutor decides how much to model, and at
    // `hard` the point of the item is that nothing models it first.
    support: item.supportTier === 'hard'
      ? 'answer it cold — do not say this fact or its answer before the learner answers'
      : item.supportTier === 'medium' ? 'the fact may be modelled once before the learner answers'
        : 'the fact may be modelled and said together before the learner answers',
    countingRoute: item.countingRoute === null
      ? 'none — counting the sequence is not a route to this answer'
      : `counting ${item.countingRoute} to the answer is a legitimate route`,
    markMeaning: 'Purple dashed marks are yours. They point at the whole problem or at one of its '
      + 'printed parts while you teach; they are not the learner answering, and they never write an '
      + 'answer on the stage.' },
});

/**
 * What the mounted journey driver SAYS for this item. The wrong answer is a
 * plainly different quantity rather than an off-by-one: a near miss is this
 * pack's real misconception and the one the strict contract exists for, but a
 * transport harness must not score the tutor's handling of it as a transport
 * failure. The near miss belongs in the JEV probe, where the tutor's reply is
 * fixed and only the observer is under test.
 */
export function mathFactsHarnessAnswers(item: MathFactItem): { correct: string; plainWrong: string } {
  const wrong = item.answerNumeral >= 4 ? item.answerNumeral - 3 : item.answerNumeral + 4;
  return { correct: item.answerWord, plainWrong: spokenIntegerWord(wrong) };
}
