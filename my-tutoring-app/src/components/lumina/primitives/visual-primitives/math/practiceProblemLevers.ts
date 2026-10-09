/**
 * The in-item levers on a practice problem (`/add-support-tiers`, report
 * qa/eval-reports/practice-problem-levers-2026-10-09.md). No real-learner or harness evidence: the misses are what
 * `practiceMiss` reads off the judge's verdict, and the failures are the catalog's commonStruggles. Pure: the component
 * draws from these, the workspace publishes them, the tests hold each leak rule.
 *
 * Every mode is the same task (a handwritten derivation; the modes differ by step count), so every mode has the same
 * levers. Three are the support tier's own scaffolds, which the tier starts on or off and the tutor can pull on:
 * `step_titles` (the step slots get their titles: the method's shape), `start_here` (the first step's title and why),
 * `strategy` (the one-line approach). The fourth, `mark_lines`, exists only after a check flagged a line: it marks
 * the learner's own flagged lines on the work rail, never the correction.
 *
 * No simplify lever: a simpler derivation cannot be built by code (the problem is generated prose with a generated
 * worked solution), and the first step alone is the learner's own item cut below the mode's step band.
 * `nothing_read` has no lever: the checker could not read the writing, which no scaffold changes.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { PracticeProblemSolution, PracticeSupportFlags } from './practice-problem-types';
import type { PracticeMiss } from './practiceProblemWorkspace';

export const MARK_LINES_LEVER = 'mark_lines';
export const STEP_TITLES_LEVER = 'step_titles';
export const START_HERE_LEVER = 'start_here';
export const STRATEGY_LEVER = 'strategy';

/** Misses no lever answers, on every mode. */
export const PRACTICE_UNANSWERED: readonly PracticeMiss[] = ['nothing_read'];

type Problem = Pick<PracticeProblemSolution, 'problem' | 'steps' | 'solutionStrategy' | 'canonicalAnswer'>;
type Decl = Omit<WorkspaceLever, 'pulled'> & { answers: readonly PracticeMiss[] };

const DECL: Record<string, Decl> = {
  [MARK_LINES_LEVER]: { id: MARK_LINES_LEVER, kind: 'help', carrier: 'shown',
    when: 'the last check flagged a line of the learner\'s work as an error',
    does: 'Marks the learner\'s own flagged lines on the work rail with "check this line". It does not say what is wrong '
      + 'or what the line should be; ask the learner to redo that move.',
    answers: ['step_error'] },
  [STEP_TITLES_LEVER]: { id: STEP_TITLES_LEVER, kind: 'help', carrier: 'shown',
    when: 'the learner does not know what steps the solution takes, stops partway, or skips the steps',
    does: 'Gives each step slot above the whiteboard its title, the method\'s shape (no step\'s result). Ask which step '
      + 'the learner is on; do not do the step.',
    answers: ['unfinished', 'answer_without_work', 'wrong_answer', 'step_error'] },
  [START_HERE_LEVER]: { id: START_HERE_LEVER, kind: 'help', carrier: 'shown',
    when: 'the learner cannot start, or the first move went wrong',
    does: 'Shows a "Start here" box with the first step\'s title and why it is done, never its result.',
    answers: ['unfinished', 'wrong_answer'] },
  [STRATEGY_LEVER]: { id: STRATEGY_LEVER, kind: 'help', carrier: 'shown',
    when: 'the learner has no plan for the problem, or the work heads somewhere else',
    does: 'Shows the one-line approach under the problem. It names the method, not a number of the answer.',
    answers: ['wrong_answer', 'unfinished', 'step_error'] },
};

// ── leak rules ──────────────────────────────────────────────────────────

/** Lower case, TeX spacing and `$` dropped, no spaces around symbols; words keep one space between them. */
const norm = (s: string) => s.toLowerCase()
  .replace(/\$|\\[,;!]|\\left|\\right/g, '').replace(/\\text\{([^}]*)\}/g, '$1')
  .replace(/\s*([=+\-*/^(){}\\,<>])\s*/g, '$1').replace(/\s+/g, ' ').trim();

/**
 * What a scaffold must never show: each step's result (what follows its last `->`), the final answer, and the
 * right-hand side of either when it is not already printed in the problem.
 */
export function answerPhrases(p: Problem): string[] {
  const given = norm([p.problem.statement, ...(p.problem.equations ?? [])].join(' '));
  const results = [...p.steps.map(s => s.canonicalBody.split('->').at(-1) ?? ''), p.canonicalAnswer]
    .map(r => r.trim()).filter(Boolean);
  const out = new Set<string>();
  for (const r of results) {
    const whole = norm(r);
    if (whole && !given.includes(whole)) out.add(whole);
    const rhs = norm(r.split('=').at(-1) ?? '');
    if (rhs && rhs !== whole && !new RegExp(`(?<![0-9a-z.])${escape(rhs)}(?![0-9a-z.])`).test(given)) out.add(rhs);
  }
  return Array.from(out);
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** True when `text` shows any answer phrase (a number only as a whole number, not inside another). */
export function scaffoldLeaks(text: string, p: Problem): boolean {
  const t = norm(text);
  return answerPhrases(p).some(phrase => new RegExp(`(?<![0-9a-z.])${escape(phrase)}(?![0-9a-z.])`).test(t));
}

/** The text each scaffold lever puts on screen. */
export function scaffoldText(p: Problem, id: string): string {
  if (id === STEP_TITLES_LEVER) return p.steps.map(s => s.title).join(' | ');
  if (id === START_HERE_LEVER) return p.steps[0] ? `${p.steps[0].title}. ${p.steps[0].strategy}` : '';
  if (id === STRATEGY_LEVER) return p.solutionStrategy ?? '';
  return '';
}

/** A scaffold lever this problem can offer: it has text, and the text shows no step result or the answer. */
const offerable = (p: Problem, id: string) => !!scaffoldText(p, id).trim() && !scaffoldLeaks(scaffoldText(p, id), p);

// ── declarations ────────────────────────────────────────────────────────

/** Where the scaffolds start (the support tier's flags), as lever ids. Not a pull: never recorded. */
export function startingLevers(support: PracticeSupportFlags): string[] {
  return [
    ...(support.showStepSkeleton ? [STEP_TITLES_LEVER] : []),
    ...(support.showFirstStepHint ? [START_HERE_LEVER] : []),
    ...(support.showStrategyPreview ? [STRATEGY_LEVER] : []),
  ];
}

/** The scaffolds on screen: where the tier started them, plus the tutor's pulls. */
export function supportWith(support: PracticeSupportFlags, on: readonly string[]): PracticeSupportFlags {
  return {
    showStepSkeleton: support.showStepSkeleton || on.includes(STEP_TITLES_LEVER),
    showFirstStepHint: support.showFirstStepHint || on.includes(START_HERE_LEVER),
    showStrategyPreview: support.showStrategyPreview || on.includes(STRATEGY_LEVER),
  };
}

/**
 * The levers on the problem, in the order `nextLever` reads them. `flagged`: the learner's lines the last check
 * flagged; `mark_lines` exists only while there are some. A scaffold that would show a result is not offered.
 */
export function practiceProblemLevers(p: Problem, on: readonly string[], flagged: readonly string[]): WorkspaceLever[] {
  const ids = [
    ...(flagged.length ? [MARK_LINES_LEVER] : []),
    ...[STEP_TITLES_LEVER, START_HERE_LEVER, STRATEGY_LEVER].filter(id => offerable(p, id)),
  ];
  return ids.map(id => ({ ...DECL[id], pulled: on.includes(id) }));
}

/** What a pulled `mark_lines` has put on screen, in words the tutor and JEV read: the learner's own lines. */
export function markedFact(flagged: readonly string[]): string {
  const lines = flagged.map(l => `"${l}"`).join(', ');
  const text = `The rail marks the learner's own line${flagged.length === 1 ? '' : 's'} ${lines} with "check this line". `
    + 'What is wrong in it is not shown.';
  return text.length > 480 ? `${text.slice(0, 479)}…` : text;
}
