/**
 * fast-fact's domain on the shared tutor/JEV teaching workspace: the check, the ask, the spoken key, the misses and
 * the scene. The boss (`fastFact.boss.ts`) builds the assignment from these; the card is `fastFact.card.ts`.
 *
 * Pure: the component, the boss and any probe read the same values. A tap on a choice is checked by the activity's own
 * `isAnswerCorrect`. When every choice can be said, the item also takes its answer spoken (J14) and the tutor judges it
 * against `factKey`. The scene never states `explanation` or a counting picture's count. The drill is untimed (user
 * ruling: no timer on fact fluency): response time is never measured or published, and nothing advances or grades on
 * a clock.
 */
import { spokenNumber, type KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { askLeaks, containsPhrase, type SpokenKey } from '../../../components/live-activity/spokenKey';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { FastFactChallenge } from './FastFact';
import type { FastFactMiss } from './fastFact.card';

export type { FastFactMiss };

const norm = (s: string) => s.trim().toLowerCase();

/** The component's grading predicate: the key or any accepted alternative, case-insensitive. */
export function isAnswerCorrect(answer: string, challenge: FastFactChallenge): boolean {
  const n = norm(answer);
  if (!n) return false;
  if (n === norm(challenge.correctAnswer)) return true;
  return challenge.acceptableAnswers?.some(a => norm(a) === n) ?? false;
}

/** The question as the learner meets it: the instruction line, then the question. The boss's ask. */
export function factQuestion(challenge: FastFactChallenge): string {
  const sub = challenge.prompt.subtext?.trim();
  return sub ? `${sub} ${challenge.prompt.text}` : challenge.prompt.text;
}

/** A choice a learner can say: a number, a word or a short phrase (no emoji, symbols or pictures). */
const SAYABLE = /^[A-Za-z0-9À-ÿ][A-Za-z0-9À-ÿ '.,:/-]*$/;
const sayable = (option: string) => SAYABLE.test(option.trim()) && option.trim().length <= 30 && option.trim().split(/\s+/).length <= 4;

/** Every choice can be said and names itself, so saying one is as deliberate as tapping it. */
export const factSayable = (challenge: FastFactChallenge) => challenge.options.length > 0 && challenge.options.every(sayable);

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

const stemExpression = (c: FastFactChallenge) => parseExpression(`${c.prompt.text} ${c.prompt.visual?.largeText ?? ''}`);

/** What the ask says by design: a fact's two operands ("3 × 1" asks for 3). */
export function factGiven(challenge: FastFactChallenge): string[] {
  const e = stemExpression(challenge);
  return e ? [String(e.a), String(e.b)] : [];
}

/**
 * The spoken key, or null when the item is only tapped: a choice that cannot be said (a picture, a symbol), or a
 * question that names its own answer beyond its operands ("Tap the 7"), where saying it back proves nothing and the
 * tap is the evidence. A question that says every choice ("Is 7 odd or even?") gets a menu key.
 */
export function factKey(challenge: FastFactChallenge): SpokenKey | null {
  if (!factSayable(challenge)) return null;
  const answer = challenge.correctAnswer.trim();
  const alsoAccept = (challenge.acceptableAnswers ?? []).map(a => a.trim()).filter(a => a && norm(a) !== norm(answer));
  const ask = factQuestion(challenge);
  const options = challenge.options.map(o => o.trim());
  if (options.every(o => containsPhrase(ask, o))) return { answer, alsoAccept, menu: options };
  const key: SpokenKey = { answer, alsoAccept, signatureError: 'Naming two choices, or hedging between them, is not an answer.' };
  return askLeaks(ask, key, factGiven(challenge)).length ? null : key;
}

/**
 * A spoken answer's known wrong answers (handoff 20 Part B), named with the tap's ids (`fastFactMiss`), concrete for this
 * challenge and most specific first. None on an item with no key.
 */
export function fastFactSpokenMisses(challenge: FastFactChallenge): KnownMiss[] {
  if (!factKey(challenge)) return [];
  const key = challenge.correctAnswer.trim();
  const others = challenge.options.map(o => o.trim()).filter(o => !isAnswerCorrect(o, challenge));
  if (!NUM.test(key)) {
    return others.length ? [{ id: 'other_choice', pattern: `The learner's answer is another of the choices: ${others.join(', ')}.`,
      examples: others.slice(0, 3) }] : [];
  }
  const want = Number(key);
  const expr = stemExpression(challenge);
  const operations = expr ? otherOperationResults(expr).filter(n => Number.isInteger(n) && n !== want && n >= 0) : [];
  return [
    ...(operations.length ? [{ id: 'wrong_operation', pattern: `The learner's answer is ${operations.join(' or ')}: the two numbers in the question combined by another operation.`,
      examples: operations.map(String) }] : []),
    ...(want - 1 >= 0 && !operations.includes(want - 1) ? [{ id: 'one_less', pattern: `The learner's answer is ${want - 1}, one less than the answer.`, examples: [spokenNumber(want - 1)] }] : []),
    ...(!operations.includes(want + 1) ? [{ id: 'one_more', pattern: `The learner's answer is ${want + 1}, one more than the answer.`, examples: [spokenNumber(want + 1)] }] : []),
    { id: 'other_number', pattern: 'The learner\'s answer is some other number.' },
  ];
}

/** The order a wrong choice is most telling in, by the miss it shows (the harness's wrong answer). */
const MISS_RANK: FastFactMiss[] = ['wrong_operation', 'one_less', 'one_more', 'other_number', 'other_choice'];

/** The harness's choices: the credited one, and the most telling wrong one by `fastFactMiss`. */
export function factHarnessChoices(challenge: FastFactChallenge): { correct: string; wrong: string } {
  const right = challenge.options.find(o => isAnswerCorrect(o, challenge));
  if (!right) throw new Error(`fast-fact ${challenge.id}: no choice is credited`);
  const rank = (o: string) => MISS_RANK.indexOf(fastFactMiss(challenge, { picked: o }) ?? 'other_choice');
  const wrong = [...challenge.options.filter(o => !isAnswerCorrect(o, challenge))].sort((a, b) => rank(a) - rank(b))[0];
  if (!wrong) throw new Error(`fast-fact ${challenge.id}: no wrong choice`);
  return { correct: right, wrong };
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

function otherOperationResults(e: { a: number; b: number; op: string }): number[] {
  const all: Record<string, number> = { '+': e.a + e.b, '-': e.a - e.b, '×': e.a * e.b };
  if (e.b !== 0) all['÷'] = e.a / e.b;
  return Object.entries(all).filter(([op]) => op !== e.op).map(([, v]) => v);
}

/** What a wrong choice shows (the card's `FAST_FACT_MISSES`): another operation's result, a number one off, else another choice. */
export function fastFactMiss(challenge: FastFactChallenge | null, view: FastFactView): FastFactMiss | undefined {
  if (!challenge || !view.picked || isAnswerCorrect(view.picked, challenge)) return undefined;
  const picked = view.picked.trim(), key = challenge.correctAnswer.trim();
  if (NUM.test(picked)) {
    const expr = stemExpression(challenge);
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

/**
 * What is drawn and asked. The choices are listed as on screen; no key, accepted answer, explanation or count. The
 * constraints are this drill's own facts: no timer, a tap-only item's key is not given, the choices are read in one
 * voice, and the tutor never works the fact out.
 */
export function workspaceScene(challenge: FastFactChallenge, view: FastFactView): SceneOf {
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
      constraints: 'There is no timer: never mention speed, a clock or answering quickly. '
        + (factKey(challenge) ? '' : 'This item is answered only by a tap, and you are not told its answer. ')
        + 'Read the choices aloud in the order shown, in the same voice for each. '
        + 'Teach a way to the fact (what the question asks, a related fact they know, a way to work it out) that the '
        + 'learner carries out; never count or work it through yourself, not even to one step short of the end.',
    },
  };
}
