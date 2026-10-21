/**
 * Practice problem on the shared tutor/JEV teaching workspace (boss: `practiceProblem.boss.ts`).
 *
 * Pure: the component and any probe read the same task and scene. The lesson is one problem, written by hand on the
 * whiteboard and checked by the primitive's own judge (`compareWork`: the transcribed lines against the canonical
 * solution). The tutor is never handed `canonicalAnswer`, a step's `canonicalBody`, or the judge's summary and notes,
 * which quote the worked solution.
 */
import type { JudgeVerdict } from '../../../service/annotated-example/judge-types';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { PracticeProblemSolution, PracticeSupportFlags } from './practice-problem-types';
import type { PracticeMiss } from './practiceProblem.card';
import type { PracticeProblemData } from './PracticeProblem';

export { PRACTICE_MISSES, type PracticeMiss } from './practiceProblem.card';

/** The one problem a practice-problem lesson asks. */
export const PROBLEM_ID = 'problem';

/** The lesson's one problem as a workspace item. */
export type PracticeChallenge = PracticeProblemData & { id: string };

type Problem = Pick<PracticeProblemSolution, 'problem' | 'steps' | 'solutionStrategy' | 'title'>;

/** The problem as the learner reads it: the given equations, then the statement. */
export function problemText(p: Pick<PracticeProblemSolution, 'problem'>): string {
  const eqs = p.problem.equations?.filter(e => e.trim()) ?? [];
  return [eqs.length ? `Given ${eqs.join(', ')}.` : '', p.problem.statement.trim()].filter(Boolean).join(' ');
}

/** What the learner is asked: the problem, solved on the whiteboard step by step. */
export const workspaceTask = (p: Pick<PracticeProblemSolution, 'problem'>) =>
  `Solve on the whiteboard, showing each step: ${problemText(p)}`;

export interface PracticeView {
  /** The learner's lines as the transcription read them, in order (LaTeX). */
  lines: readonly string[];
  strokes: number;
  /** Which scaffolds are on screen (the support tier's starting position, plus pulled levers). */
  support: PracticeSupportFlags;
  /** Canonical steps the live reviewer has seen the learner reach. */
  stepsReached: number;
  judging: boolean;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** The learner's work in their own terms, never the key. */
export function describePracticeWork(lines: readonly string[], strokes: number): string {
  if (!lines.length) return strokes ? `Wrote ${strokes} strokes on the whiteboard; no line could be read` : 'Nothing written yet';
  return clip(`Wrote ${lines.length} line${lines.length === 1 ? '' : 's'}: ${lines.join(' ; ')}`, 460);
}

/** Compares two answers as written: case, spaces, `$` and `\,` spacing ignored. */
export const sameAnswer = (a: string, b: string) => {
  const norm = (s: string) => s.toLowerCase().replace(/\$|\\[,;!]|\\left|\\right|\s+/g, '');
  return !!norm(a) && norm(a) === norm(b);
};

export function practiceMiss(lines: readonly string[], verdict: JudgeVerdict): PracticeMiss | undefined {
  if (verdict.verdict === 'correct') return undefined;
  if (!lines.length) return 'nothing_read';
  if (!verdict.finalAnswer?.trim()) return 'unfinished';
  if (sameAnswer(verdict.finalAnswer, verdict.canonicalAnswer)) return 'answer_without_work';
  if (verdict.stepAnalysis.some(a => a.status === 'error')) return 'step_error';
  return 'wrong_answer';
}

/** The learner's own lines the checker flagged as errors (their words, never the correction). */
export const flaggedLines = (verdict: JudgeVerdict): string[] =>
  verdict.stepAnalysis.filter(a => a.status === 'error' && a.studentLine.trim()).map(a => a.studentLine);

export function workspaceScene(p: Problem, view: PracticeView): SceneOf {
  const n = p.steps.length;
  const first = p.steps[0];
  return {
    objects: [],
    facts: {
      problem: clip(problemText(p), 480),
      stepSlots: view.support.showStepSkeleton
        ? clip(`${n} step slots, titled: ${p.steps.map((s, i) => `${i + 1}. ${s.title}`).join('; ')}`, 480)
        : `${n} numbered step slots with no titles: do not name a step or a method`,
      ...(view.support.showFirstStepHint && first ? { startHint: clip(`Start here: ${first.title}. ${first.strategy}`, 480) } : {}),
      ...(view.support.showStrategyPreview && p.solutionStrategy ? { strategyShown: clip(p.solutionStrategy, 480) } : {}),
      learnerWork: describePracticeWork(view.lines, view.strokes),
      stepsReached: `${Math.min(view.stepsReached, n)} of ${n}`,
    },
  };
}
