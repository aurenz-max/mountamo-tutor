/**
 * construction-sequence-planner's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `constructionSequencePlanner.boss.ts`.
 * sequence, dependency_chain and parallel are plans the learner builds from the job cards and checks as a whole: the
 * activity checks the plan (a board). critical_path asks for one total: the learner says it (the tutor judges the
 * words against the key) or taps it and presses Check Answer (the activity checks it), so it is SAY_OR_SHOW.
 */
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/**
 * What a wrong answer shows (`TeachingAttempt.miss`), from the work the check reads. Only the observable pattern:
 * - an order: `reversed`, `swapped_neighbors`, `wrong_first` (the plan starts on a job that needs another),
 *   `missed_second_need` (a job that needs two placed after only one of them), `job_before_need`;
 * - a week plan: `need_same_week`, `need_later`, `crew_over` (more jobs in a week than crews), `too_many_weeks`;
 * - a total: `added_all` (every job's weeks), `shorter_chain`, `most_jobs_chain`, `counted_jobs`, `off_by_one`.
 */
export type OrderMiss = 'reversed' | 'swapped_neighbors' | 'wrong_first' | 'missed_second_need' | 'job_before_need';
export type ParallelMiss = 'need_same_week' | 'need_later' | 'crew_over' | 'too_many_weeks';
export type CriticalMiss = 'added_all' | 'shorter_chain' | 'most_jobs_chain' | 'counted_jobs' | 'off_by_one';
export type CspMiss = OrderMiss | ParallelMiss | CriticalMiss;

/** The activity's check (`cspMiss`) and critical_path's known spoken misses (`cspSpokenMisses`), by mode, same ids. */
export const CSP_MISSES = {
  sequence: ['reversed', 'swapped_neighbors', 'wrong_first', 'job_before_need'],
  dependency_chain: ['wrong_first', 'missed_second_need', 'job_before_need'],
  parallel: ['need_same_week', 'need_later', 'crew_over', 'too_many_weeks'],
  critical_path: ['added_all', 'shorter_chain', 'most_jobs_chain', 'counted_jobs', 'off_by_one'],
} as const satisfies Record<string, readonly CspMiss[]>;

const ORDER = { answer: 'build', judge: 'activity', flow: 'board',
  moves: 'taps the job cards into the plan in order (tapping a placed card takes it back out), then presses Check and build' } as const;

export const constructionSequencePlannerCard = defineCard<CspMiss>({
  id: 'construction-sequence-planner',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  modes: {
    sequence: { ...ORDER, misses: CSP_MISSES.sequence },
    dependency_chain: { ...ORDER, misses: CSP_MISSES.dependency_chain },
    parallel: { answer: 'build', judge: 'activity', flow: 'board',
      moves: 'taps a job card, then a week, for every job (tapping a placed job takes it back out), then presses Check and build',
      misses: CSP_MISSES.parallel },
    critical_path: { ...SAY_OR_SHOW, moves: 'may instead tap a total, then press Check Answer', misses: CSP_MISSES.critical_path },
  },
  words: {
    job: 'plan a build: order its jobs so none comes before a job it needs, fit jobs into weeks, and find the fewest weeks a build can take',
    answer: 'their answer',
    question: 'the ask and the job cards',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
