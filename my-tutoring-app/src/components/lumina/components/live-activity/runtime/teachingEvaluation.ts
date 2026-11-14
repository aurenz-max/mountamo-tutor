import type { TeachingState } from './TeachingSession';
import type { TeachingItem } from './useTeachingWorkspace';
import type { ScoredSession } from './itemScoringContract';
import type { LearningResponseEvidence } from '../../../evaluation/learningResponseEvidence';
import type { DiagnosisEvidence } from '../../../evaluation/diagnosis/types';

/** Same evaluation scale and evidence channel as the existing primitives. What is recorded is what moved the lesson
 * (`scoreSession`): the tutor's verdict on spoken answers, the code check on gestures. No cue packs or fabricated attempts. */
export function teachingEvaluation(items: readonly TeachingItem[], state: TeachingState, scored: ScoredSession, evalMode: string) {
  const byId = new Map(items.map(item => [item.id, item]));
  const corrections = new Map<string, number>();
  const learningResponses: LearningResponseEvidence[] = scored.attempts.map(attempt => {
    const item = byId.get(attempt.itemId)!;
    const priorCorrections = corrections.get(item.id) ?? 0;
    if (!attempt.correct) corrections.set(item.id, priorCorrections + 1);
    const spoken = attempt.source === 'speech';
    return { itemId: item.id, phase: evalMode, challenge: item.task, expected: item.expectedAnswer ?? 'Activity-checked response',
      // The learner's words alone; the tutor's reply is recorded beside them, never mixed in.
      observed: spoken ? `Heard (speech transcript, may be noisy): "${attempt.response}"` : attempt.response,
      verdict: attempt.correct ? 'affirmed' : 'corrected', source: spoken ? 'voice' : 'gesture',
      priorCorrections, hearTapsSoFar: 0,
      support: `Recorded assistance: ${attempt.assisted}; answer exposure: ${attempt.answerExposure}`
        + (attempt.levers?.length ? `; levers pulled: ${attempt.levers.join(', ')}` : '') + `. Verbal assistance is recorded by explicit tutor actions; absence does not establish independence.`
        + (spoken && attempt.tutorResponse ? ` Tutor replied: "${attempt.tutorResponse.slice(0, 600)}".` : '') };
  });
  const outcomes = scored.summary.outcomes;
  // A first try made with a lever pulled is assisted work, never a first-response success.
  const firstTryCount = outcomes.filter(o => o.solved && o.corrections === 0
    && !scored.attempts.find(a => a.itemId === o.id && a.correct)?.levers?.length).length;
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
    firstResponseScore: Math.round(firstTryCount / Math.max(1, outcomes.length) * 100),
    // `learningResponses` is index-aligned with `scored.attempts`, so each wrong phase keeps its own attempt's miss.
    phases: learningResponses.flatMap(({ itemId, phase, challenge, expected, observed, support }, i) => {
      const { correct, miss } = scored.attempts[i];
      return correct ? [] : [{ itemId, phase, challenge, expected, observed, support, ...(miss ? { miss } : {}) }];
    }).slice(0, 12),
  };
  return { outcomes: outcomes.map(o => ({ ...o, seconds: null })), solvedCount: scored.summary.solvedCount,
    firstTryCount, attemptsCount: state.attempts.length,
    accuracy: Math.round(outcomes.reduce((sum, o) => sum + o.score, 0) / outcomes.length),
    passed: outcomes.every(o => o.solved),
    learningResponses, diagnosisEvidence,
    teachingAttempts: scored.attempts, assistanceProvenance: 'explicit-actions-only' as const,
    forItems: (ids: readonly string[]) => scopedEvaluation(items, state, scored, evalMode, ids) };
}

/** The same evaluation over some of the session's items: a primitive that submits once per problem (knowledge-check)
 *  scores each problem on its own items, never on the whole session's mean. */
export function scopedEvaluation(items: readonly TeachingItem[], state: TeachingState, scored: ScoredSession, evalMode: string,
  ids: readonly string[]): ReturnType<typeof teachingEvaluation> {
  const keep = new Set(ids);
  const mine = items.filter(i => keep.has(i.id));
  if (!mine.length) throw new Error(`No session items among ${ids.join(', ')}.`);
  return teachingEvaluation(mine, { ...state, attempts: state.attempts.filter(a => keep.has(a.itemId)) },
    { attempts: scored.attempts.filter(a => keep.has(a.itemId)),
      summary: { ...scored.summary, outcomes: scored.summary.outcomes.filter(o => keep.has(o.id)),
        solvedCount: scored.summary.outcomes.filter(o => keep.has(o.id) && o.solved).length } }, evalMode);
}
