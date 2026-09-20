import type { TeachingState, TeachingSummary } from './TeachingSession';
import type { TeachingItem } from './useTeachingWorkspace';
import type { LearningResponseEvidence } from '../../../evaluation/learningResponseEvidence';
import type { DiagnosisEvidence } from '../../../evaluation/diagnosis/types';

/** Same evaluation scale and evidence channel as the existing primitives, from actual
 * tutor/gesture outcomes. No cue packs, transcript regrading or fabricated attempts. */
export function teachingEvaluation(items: readonly TeachingItem[], state: TeachingState, summary: TeachingSummary, evalMode: string) {
  const byId = new Map(items.map(item => [item.id, item]));
  const corrections = new Map<string, number>();
  const learningResponses: LearningResponseEvidence[] = state.attempts.map(attempt => {
    const item = byId.get(attempt.itemId)!;
    const priorCorrections = corrections.get(item.id) ?? 0;
    if (!attempt.correct) corrections.set(item.id, priorCorrections + 1);
    return { itemId: item.id, phase: evalMode, challenge: item.task, expected: item.expectedAnswer ?? 'Activity-checked response',
      observed: attempt.source === 'speech' ? `Speech transcript (may be noisy): ${attempt.response}. Tutor feedback: ${attempt.tutorResponse ?? ''}` : attempt.response,
      verdict: attempt.correct ? 'affirmed' : 'corrected', source: attempt.source === 'speech' ? 'voice' : 'gesture',
      priorCorrections, hearTapsSoFar: 0,
      support: `Recorded assistance: ${attempt.assisted}; answer exposure: ${attempt.answerExposure}. Verbal assistance is recorded by explicit tutor actions; absence does not establish independence.` };
  });
  const firstTryCount = items.filter(item => state.attempts.find(a => a.itemId === item.id)?.correct).length;
  const wrong = learningResponses.filter(r => r.verdict === 'corrected');
  const diagnosisEvidence: DiagnosisEvidence = {
    challengeSummary: items.map(i => i.task).join(' ').slice(0, 2000),
    expected: items.map(i => i.expectedAnswer ?? 'Activity-checked response').join('; ').slice(0, 2000),
    observed: wrong.map(r => r.observed).join('; ').slice(0, 2000),
    firstResponseScore: Math.round(firstTryCount / items.length * 100),
    phases: wrong.slice(0, 12).map(({ itemId, phase, challenge, expected, observed, support }) => ({ itemId, phase, challenge, expected, observed, support })),
  };
  return { outcomes: summary.outcomes.map(o => ({ ...o, seconds: null })), solvedCount: summary.solvedCount,
    firstTryCount, attemptsCount: state.attempts.length,
    accuracy: Math.round(summary.outcomes.reduce((sum, o) => sum + o.score, 0) / summary.outcomes.length),
    passed: summary.solvedCount === items.length, learningResponses, diagnosisEvidence,
    teachingAttempts: state.attempts, assistanceProvenance: 'explicit-actions-only' as const };
}
