/**
 * Fast fact on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md).
 *
 * Pure: the component and any probe read the same assignment and scene. A tap on a choice is checked by the
 * activity's own `isAnswerCorrect`. When every choice can be said (`factSpoken`), the challenge also takes its answer
 * spoken (ROLLOUT VB): the key reaches the observer as `expectedAnswer` and JEV judges the tutor's feedback against it.
 * The scene never states `explanation` or a counting picture's count. The drill is untimed (user ruling: no timer on
 * fact fluency): response time is never published and nothing advances or grades on a clock.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { spokenNumber, type KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { FastFactChallenge } from './FastFact';

const norm = (s: string) => s.trim().toLowerCase();

/** The component's grading predicate: the key or any accepted alternative, case-insensitive. */
export function isAnswerCorrect(answer: string, challenge: FastFactChallenge): boolean {
  const n = norm(answer);
  if (!n) return false;
  if (n === norm(challenge.correctAnswer)) return true;
  return challenge.acceptableAnswers?.some(a => norm(a) === n) ?? false;
}

/** The question as the learner meets it: the instruction line, then the question. */
export function factQuestion(challenge: FastFactChallenge): string {
  const sub = challenge.prompt.subtext?.trim();
  return sub ? `${sub} ${challenge.prompt.text}` : challenge.prompt.text;
}

/** A choice a learner can say: a number, a word or a short phrase (no emoji, symbols or pictures). */
const SAYABLE = /^[A-Za-z0-9À-ÿ][A-Za-z0-9À-ÿ '.,:/-]*$/;
const sayable = (option: string) => SAYABLE.test(option.trim()) && option.trim().length <= 30 && option.trim().split(/\s+/).length <= 4;

/**
 * Whether the challenge also takes its answer spoken (ROLLOUT VB): every choice can be said and names itself, so saying
 * one is as deliberate as tapping it. A choice row of pictures or symbols stays a tap.
 */
export const factSpoken = (challenge: FastFactChallenge) => challenge.options.length > 0 && challenge.options.every(sayable);

/**
 * A spoken answer's known wrong answers (handoff 20 Part B), named with the tap's ids (`fastFactMiss`), concrete for this
 * challenge and most specific first.
 */
export function fastFactSpokenMisses(challenge: FastFactChallenge): KnownMiss[] {
  if (!factSpoken(challenge)) return [];
  const key = challenge.correctAnswer.trim();
  const others = challenge.options.map(o => o.trim()).filter(o => !isAnswerCorrect(o, challenge));
  if (!NUM.test(key)) {
    return others.length ? [{ id: 'other_choice', pattern: `The learner's answer is another of the choices: ${others.join(', ')}.`,
      examples: others.slice(0, 3) }] : [];
  }
  const want = Number(key);
  const expr = parseExpression(`${challenge.prompt.text} ${challenge.prompt.visual?.largeText ?? ''}`);
  const operations = expr ? otherOperationResults(expr).filter(n => Number.isInteger(n) && n !== want && n >= 0) : [];
  return [
    ...(operations.length ? [{ id: 'wrong_operation', pattern: `The learner's answer is ${operations.join(' or ')}: the two numbers in the question combined by another operation.`,
      examples: operations.map(String) }] : []),
    ...(want - 1 >= 0 && !operations.includes(want - 1) ? [{ id: 'one_less', pattern: `The learner's answer is ${want - 1}, one less than the answer.`, examples: [spokenNumber(want - 1)] }] : []),
    ...(!operations.includes(want + 1) ? [{ id: 'one_more', pattern: `The learner's answer is ${want + 1}, one more than the answer.`, examples: [spokenNumber(want + 1)] }] : []),
    { id: 'other_number', pattern: 'The learner\'s answer is some other number.' },
  ];
}

export function workspaceAssignment(challenge: FastFactChallenge): TeachingAssignment {
  if (!factSpoken(challenge)) return { id: challenge.id, task: factQuestion(challenge), response: 'gesture' };
  const also = (challenge.acceptableAnswers ?? []).filter(a => norm(a) !== norm(challenge.correctAnswer));
  return { id: challenge.id, task: `${factQuestion(challenge)} The learner answers by saying a choice or tapping it.`,
    response: 'speech', acceptsGesture: true,
    expectedAnswer: `${challenge.correctAnswer}${also.length ? ` (also accepted: ${also.join(', ')})` : ''}`,
    misses: fastFactSpokenMisses(challenge) };
}

export interface FastFactView {
  /** The choice tapped on this try, or null. */
  picked: string | null;
}

export const EMPTY_FACT_VIEW: FastFactView = { picked: null };

/** The learner's work in their own terms, never the key. */
export function describeFactWork(_challenge: FastFactChallenge, view: FastFactView): string {
  return view.picked ? `Tapped "${view.picked}"` : 'No choice tapped yet';
}

/**
 * What a wrong answer shows (`TeachingAttempt.miss`, handoff 20), from the tapped choice alone. The drill is
 * subject-agnostic, so only patterns that read the same in any subject are named (the numeric ids are
 * knowledge-check's, the other closed-set choice drill):
 * - `wrong_operation`: the stem is a two-number expression and the tap is another operation's result
 *   (7 + 3 answered 4 or 21);
 * - `one_less` / `one_more` / `other_number`: a number against a numeric key (a counting or fact slip);
 * - `other_choice`: any other wrong choice.
 */
export type FastFactMiss = 'wrong_operation' | 'one_less' | 'one_more' | 'other_number' | 'other_choice';

const NUM = /^-?\d+(\.\d+)?$/;
const EXPRESSION = /(-?\d+(?:\.\d+)?)\s*([+\-−×x*÷/])\s*(-?\d+(?:\.\d+)?)/i;

/** The two operands and operator of a stem such as "7 + 3 = ?" or "What is 6 × 4?", if it has one. */
export function parseExpression(text: string): { a: number; b: number; op: '+' | '-' | '×' | '÷' } | null {
  const m = EXPRESSION.exec(text);
  if (!m) return null;
  const sym = m[2].toLowerCase();
  const op = sym === '+' ? '+' : sym === '-' || sym === '−' ? '-' : sym === '÷' || sym === '/' ? '÷' : '×';
  return { a: Number(m[1]), b: Number(m[3]), op };
}

function otherOperationResults(e: { a: number; b: number; op: string }): number[] {
  const all: Record<string, number> = { '+': e.a + e.b, '-': e.a - e.b, '×': e.a * e.b };
  if (e.b !== 0) all['÷'] = e.a / e.b;
  return Object.entries(all).filter(([op]) => op !== e.op).map(([, v]) => v);
}

export function fastFactMiss(challenge: FastFactChallenge | null, view: FastFactView): FastFactMiss | undefined {
  if (!challenge || !view.picked || isAnswerCorrect(view.picked, challenge)) return undefined;
  const picked = view.picked.trim(), key = challenge.correctAnswer.trim();
  if (NUM.test(picked)) {
    const expr = parseExpression(`${challenge.prompt.text} ${challenge.prompt.visual?.largeText ?? ''}`);
    if (expr && otherOperationResults(expr).includes(Number(picked))) return 'wrong_operation';
    if (NUM.test(key)) {
      const got = Number(picked), want = Number(key);
      return got === want - 1 ? 'one_less' : got === want + 1 ? 'one_more' : 'other_number';
    }
  }
  return 'other_choice';
}

/** A picture drawn as one glyph repeated (a counting picture): its count is the answer, so it is never stated. */
export function isCountingPicture(challenge: FastFactChallenge): boolean {
  const emoji = challenge.prompt.visual?.type === 'emoji' ? challenge.prompt.visual.emoji ?? '' : '';
  const glyphs = Array.from(emoji.trim());
  return glyphs.length > 2 && new Set(glyphs.filter(g => g.trim() && g !== '️')).size <= 2;
}

/** What is drawn and asked. The choices are listed as on screen; no key, accepted answer, explanation or count. */
export function workspaceScene(challenge: FastFactChallenge, view: FastFactView): WorkspaceScene {
  const drawn: Record<string, string | number> = {};
  const v = challenge.prompt.visual;
  if (v?.type === 'text-large' && v.largeText) drawn.shownLarge = v.largeText;
  if (v?.type === 'emoji' && v.emoji) {
    drawn.picture = isCountingPicture(challenge)
      ? `a row of ${Array.from(v.emoji.trim())[0]} pictures; how many is not given here: ask the learner to count them`
      : v.emoji;
  }
  if (v?.type === 'image') drawn.picture = 'an image (not described here)';
  return {
    objects: [],
    facts: {
      kind: challenge.challengeType,
      question: challenge.prompt.text,
      ...(challenge.prompt.subtext ? { instruction: challenge.prompt.subtext } : {}),
      ...drawn,
      choices: challenge.options.join(' | '),
      learnerWork: describeFactWork(challenge, view),
      constraints: (factSpoken(challenge) ? 'The learner answers by saying one choice or tapping it; a tap is checked at once by the activity. '
        : 'The learner answers by tapping one choice; the tap is checked at once by the activity. ')
        + 'There is no timer. You cannot tap for the learner.',
    },
  };
}
