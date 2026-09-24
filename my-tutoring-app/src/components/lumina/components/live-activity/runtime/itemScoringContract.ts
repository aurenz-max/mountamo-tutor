/**
 * The scoring pass (user direction 2026-09-24: "the tutor judges, then JEV re-assesses, not to impact the
 * flow of the primitive but for scoring"). The dialogue observer decides what happens NEXT from the tutor's
 * reply; this pass decides what is RECORDED. After a session completes, each spoken attempt is re-graded
 * against the expected answer from what the learner said and what the tutor (who heard the audio) replied.
 * It never moves the lesson. Gesture attempts keep their code check and are not re-graded.
 */
import { boundedText as text, probability, validItemScope, type ItemScope, type ObservationAssessment } from './observationContract';
import type { TeachingAttempt, TeachingState, TeachingSummary } from './TeachingSession';

export interface ItemScoreRequest {
  scope: ItemScope;
  attemptIndex: number;
  task: string;
  expectedAnswer: string;
  /** What the learner said, as transcribed (may be noisy). */
  learner: string;
  /** The tutor's reply to that answer. The tutor heard the audio. */
  tutor: string;
  /** What the tutor said just before the learner answered, when known. */
  priorTutor?: string;
}
export interface ItemScoreDecision {
  /** P(the learner's own answer in this turn is a correct answer to the task); null when abstained. */
  learnerCorrect: number | null;
  accepted: boolean;
  reason: string;
  ms: number;
  model?: string;
  assessment?: ObservationAssessment;
}
/** Code holds the policy: between the two bounds the grade is unclear and the flow verdict stands. */
export const SCORE_CORRECT = 0.8;
export const SCORE_NOT_CORRECT = 0.2;
export type AttemptGrade = 'correct' | 'not_correct' | 'unclear';

export const gradeOf = (d: ItemScoreDecision | undefined): AttemptGrade =>
  !d || d.accepted !== true || !probability(d.learnerCorrect) ? 'unclear'
    : d.learnerCorrect >= SCORE_CORRECT ? 'correct' : d.learnerCorrect <= SCORE_NOT_CORRECT ? 'not_correct' : 'unclear';

export function validItemScoreRequest(v: any): v is ItemScoreRequest {
  return !!v && validItemScope(v.scope) && Number.isInteger(v.attemptIndex) && v.attemptIndex >= 0
    && text(v.task, 1500) && text(v.expectedAnswer, 2000) && !!v.expectedAnswer.trim()
    && text(v.learner, 2000) && !!v.learner.trim() && text(v.tutor, 4000)
    && (v.priorTutor === undefined || text(v.priorTutor, 4000));
}
export const abstainItemScore = (reason: string, ms = 0): ItemScoreDecision => ({ learnerCorrect: null, accepted: false, reason, ms });

/** The attempt as recorded: the flow's verdict, unless the scoring pass is confident otherwise. */
export interface ScoredAttempt extends TeachingAttempt {
  /** The dialogue observer's verdict, which moved the lesson. */
  flowCorrect: boolean;
  grade: AttemptGrade | 'activity_check';
}
export interface ScoredSession { attempts: ScoredAttempt[]; summary: TeachingSummary; disagreements: number }

/**
 * Pure: re-score a completed session from per-attempt grades (indexed like `state.attempts`). An item's score
 * keeps the practice scale (100 / 67 / 33 / 0) over the RECORDED correctness: first correct attempt on the
 * first try = 100, after one miss = 67, later = 33, never = 0.
 */
export function scoreSession(itemIds: readonly string[], state: TeachingState, grades: readonly (AttemptGrade | undefined)[]): ScoredSession {
  const attempts: ScoredAttempt[] = state.attempts.map((a, i) => {
    const grade = a.source === 'speech' ? grades[i] ?? 'unclear' : 'activity_check';
    const correct = grade === 'correct' ? true : grade === 'not_correct' ? false : a.correct;
    return { ...a, correct, flowCorrect: a.correct, grade };
  });
  const outcomes = itemIds.map(id => {
    const mine = attempts.filter(a => a.itemId === id);
    const first = mine.findIndex(a => a.correct);
    const solved = first >= 0;
    return { id, solved, corrections: solved ? first : mine.length, attempts: mine.length, assisted: mine.some(a => a.assisted),
      score: !solved ? 0 : first === 0 ? 100 : first === 1 ? 67 : 33 };
  });
  return { attempts, summary: { solvedCount: outcomes.filter(o => o.solved).length, outcomes },
    disagreements: attempts.filter(a => a.correct !== a.flowCorrect).length };
}
