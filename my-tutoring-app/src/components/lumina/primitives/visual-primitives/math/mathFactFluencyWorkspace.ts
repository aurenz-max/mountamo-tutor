/**
 * Math fact fluency on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C9), plain shape: `useWorkspaceProgress` in place of
 * `useChallengeProgress`. Every challenge is one checked gesture; the activity's own check is the
 * judge and no key reaches the tutor. How the learner answers follows what is drawn:
 *   - `choice`: a row of numbers (visual-fact, equation-solve), tapped;
 *   - `equation`: a match from a picture to one of the printed equations, tapped;
 *   - `picture`: a match from the printed fact to one of the pictures, tapped;
 *   - `stepper`: a number set with − and + and Submit (missing-number, speed-round).
 * Response time stays a silent metric: nothing here advances or grades on a clock.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { MathFactFluencyChallenge } from './MathFactFluency';

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

/** The number after "=" in an equation option. */
export const equationResult = (eq: string) => parseInt(eq.split('=').pop()?.trim() ?? '', 10);

/** The printed problem with its "?", exactly as the component draws it. */
export function formatMathFact(c: MathFactFluencyChallenge): string {
  const op = c.operation === 'addition' ? '+' : '−';
  if (c.unknownPosition === 'operand1') return `? ${op} ${c.operand2} = ${c.result}`;
  if (c.unknownPosition === 'operand2') return `${c.operand1} ${op} ? = ${c.result}`;
  return `${c.operand1} ${op} ${c.operand2} = ?`;
}

export function mathFactAssignment(c: MathFactFluencyChallenge): TeachingAssignment {
  return { id: c.id, task: c.instruction, response: 'gesture' };
}

/** The activity's own check. */
export function mathFactMatches(c: MathFactFluencyChallenge, r: MathFactResponse): boolean {
  if (r.kind === 'number') return r.value === c.correctAnswer;
  if (r.kind === 'equation') return equationResult(r.value) === c.correctAnswer;
  return c.visualOptions?.[r.index]?.count === c.correctAnswer;
}

const visualWord = (type?: string) => type === 'ten-frame' ? 'ten frame' : type === 'fingers' ? 'hand of fingers' : 'dot picture';

/** The learner's checked work in their terms, never the key. */
export function describeMathFactCheck(c: MathFactFluencyChallenge, r: MathFactResponse): string {
  if (r.kind === 'number') return mathFactChannel(c) === 'stepper' ? `Entered ${r.value}` : `Chose ${r.value}`;
  if (r.kind === 'equation') return `Chose the equation ${r.value}`;
  const picked = c.visualOptions?.[r.index];
  return picked ? `Chose the ${visualWord(picked.type)} with ${picked.count}` : 'Chose a picture';
}

const CONSTRAINTS: Record<MathFactChannel, string> = {
  choice: 'The learner taps the number that answers the fact; the activity checks the tap. That number is the answer: '
    + 'never say it, and never count the picture aloud to its end.',
  stepper: 'The learner sets a number with the − and + buttons and presses Submit; the activity checks it. The number '
    + 'that replaces the "?" is the answer: never say it.',
  equation: 'The learner taps the equation that matches the picture; the activity checks the tap. Which equation '
    + 'matches, and how many the picture shows, are the answer: never say them.',
  picture: 'The learner taps the picture that shows the answer to the printed fact; the activity checks the tap. The '
    + 'answer and which picture shows it are the answer: never say them.',
};

/** How far the tutor may go at this support tier, so it never says what the tier withheld on screen. */
function coaching(tier?: MathFactFluencyChallenge['supportTier']): string | undefined {
  if (!tier) return undefined;
  return tier === 'easy' ? 'You may name a strategy (count the picture, count on, think backwards) and walk the setup.'
    : tier === 'medium' ? 'Nudge the next step only; do not name the whole strategy.'
      : 'Do not name a strategy. Ask what the learner notices and let them reason.';
}

export function mathFactScene(c: MathFactFluencyChallenge, view: { maxNumber: number }): WorkspaceScene {
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
