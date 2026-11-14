/**
 * The recorded session: the verdicts that moved the lesson, as they stood (USER RULING 2026-11-13: if the tutor says
 * right, it is right; wrong, it is wrong). The tutor heard the audio and the child heard her verdict, so nothing
 * re-grades a spoken answer afterwards: a record that later called "That's right!" wrong would score a miss the
 * child was never told to fix. Gesture attempts keep their code check.
 */
import type { TeachingAttempt, TeachingState, TeachingSummary } from './TeachingSession';

export interface ScoredSession { attempts: TeachingAttempt[]; summary: TeachingSummary }

/**
 * Pure. An item's score keeps the practice scale (100 / 67 / 33 / 0): first correct attempt on the first try = 100,
 * after one miss = 67, later = 33, never = 0.
 */
export function scoreSession(itemIds: readonly string[], state: TeachingState): ScoredSession {
  // Work on a simpler item a simplify lever opened is ungraded: it is never part of the record.
  const attempts = state.attempts.filter(a => !a.practice);
  const outcomes = itemIds.map(id => {
    const mine = attempts.filter(a => a.itemId === id);
    const first = mine.findIndex(a => a.correct);
    const solved = first >= 0;
    return { id, solved, corrections: solved ? first : mine.length, attempts: mine.length, assisted: mine.some(a => a.assisted),
      score: !solved ? 0 : first === 0 ? 100 : first === 1 ? 67 : 33 };
  });
  return { attempts, summary: { solvedCount: outcomes.filter(o => o.solved).length, outcomes } };
}
