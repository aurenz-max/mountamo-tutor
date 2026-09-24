import type { TeachingState } from './TeachingSession';
import type { TeachingItem } from './useTeachingWorkspace';
import type { ScoredSession } from './itemScoringContract';
import type { LearningResponseEvidence } from '../../../evaluation/learningResponseEvidence';
import type { DiagnosisEvidence } from '../../../evaluation/diagnosis/types';

/** Same evaluation scale and evidence channel as the existing primitives. The flow verdicts moved the
 * lesson; what is recorded is the scored session (`scoreSession`): each spoken attempt's own answer,
 * re-graded, with the flow verdict kept where the scoring pass was unclear. No cue packs or fabricated attempts. */
export function teachingEvaluation(items: readonly TeachingItem[], state: TeachingState, scored: ScoredSession, evalMode: string) {
  const byId = new Map(items.map(item => [item.id, item]));
  const corrections = new Map<string, number>();
  const learningResponses: LearningResponseEvidence[] = scored.attempts.map(attempt => {
    const item = byId.get(attempt.itemId)!;
    const priorCorrections = corrections.get(item.id) ?? 0;
    if (!attempt.correct) corrections.set(item.id, priorCorrections + 1);
    const spoken = attempt.source === 'speech';
    const scoring = attempt.grade === 'activity_check' ? ''
      : ` Scored ${attempt.grade === 'unclear' ? `by the tutor's verdict (re-grade unclear)` : `by re-grading the learner's answer`}; `
        + `tutor verdict ${attempt.flowCorrect ? 'affirmed' : 'corrected'}.`;
    return { itemId: item.id, phase: evalMode, challenge: item.task, expected: item.expectedAnswer ?? 'Activity-checked response',
      // The learner's words alone; the tutor's reply is recorded beside them, never mixed in.
      observed: spoken ? `Heard (speech transcript, may be noisy): "${attempt.response}"` : attempt.response,
      verdict: attempt.correct ? 'affirmed' : 'corrected', source: spoken ? 'voice' : 'gesture',
      priorCorrections, hearTapsSoFar: 0,
      support: `Recorded assistance: ${attempt.assisted}; answer exposure: ${attempt.answerExposure}. Verbal assistance is recorded by explicit tutor actions; absence does not establish independence.`
        + (spoken && attempt.tutorResponse ? ` Tutor replied: "${attempt.tutorResponse.slice(0, 600)}".` : '') + scoring };
  });
  const firstTryCount = scored.summary.outcomes.filter(o => o.solved && o.corrections === 0).length;
  const wrong = learningResponses.filter(r => r.verdict === 'corrected');
  const wrongAttempts = scored.attempts.filter(a => !a.correct);
  const tutorCorrections = wrongAttempts.map(a => a.tutorResponse).filter((t): t is string => !!t);
  const diagnosisEvidence: DiagnosisEvidence = {
    challengeSummary: items.map(i => i.task).join(' ').slice(0, 2000),
    expected: items.map(i => i.expectedAnswer ?? 'Activity-checked response').join('; ').slice(0, 2000),
    observed: wrong.map(r => r.observed).join('; ').slice(0, 2000),
    ...(tutorCorrections.length ? { judgeFeedback: tutorCorrections.join(' | ').slice(0, 2000) } : {}),
    ...(wrongAttempts.length ? { priorAttempts: wrongAttempts.slice(0, 12).map(a => ({
      challenge: byId.get(a.itemId)?.task ?? a.itemId, observed: a.response })) } : {}),
    firstResponseScore: Math.round(firstTryCount / items.length * 100),
    phases: wrong.slice(0, 12).map(({ itemId, phase, challenge, expected, observed, support }) => ({ itemId, phase, challenge, expected, observed, support })),
  };
  const outcomes = scored.summary.outcomes;
  return { outcomes: outcomes.map(o => ({ ...o, seconds: null })), solvedCount: scored.summary.solvedCount,
    firstTryCount, attemptsCount: state.attempts.length,
    accuracy: Math.round(outcomes.reduce((sum, o) => sum + o.score, 0) / outcomes.length),
    passed: scored.summary.solvedCount === items.length, learningResponses, diagnosisEvidence,
    teachingAttempts: scored.attempts, scoringDisagreements: scored.disagreements, assistanceProvenance: 'explicit-actions-only' as const };
}
