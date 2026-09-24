import { describe, expect, it } from 'vitest';
import { gradeOf, scoreSession, validItemScoreRequest, type AttemptGrade } from './itemScoringContract';
import { teachingEvaluation } from './teachingEvaluation';
import type { TeachingAttempt, TeachingState } from './TeachingSession';
import type { TeachingItem } from './useTeachingWorkspace';

const attempt = (itemId: string, response: string, correct: boolean, source: TeachingAttempt['source'] = 'speech',
  tutorResponse?: string): TeachingAttempt => ({ itemId, response, correct, source, assisted: false, answerExposure: 'none',
  ...(tutorResponse ? { tutorResponse, judgment: 'tutor' as const } : {}) });
const state = (attempts: TeachingAttempt[]): TeachingState =>
  ({ index: 1, phase: 'completed', assisted: false, answerExposure: 'none', lastResponse: attempts.at(-1) ?? null, attempts });
const items: TeachingItem[] = [{ id: 'a', task: 'What sound does s make?', expectedAnswer: '/s/', response: 'speech', checkResponse: () => null },
  { id: 'b', task: 'Tap the red card.', response: 'gesture', checkResponse: () => null }];

describe('the scoring pass (user direction 09-24: the tutor judges the flow, JEV re-assesses for the record)', () => {
  it('grades by policy bounds; anything unsure is unclear', () => {
    expect(gradeOf({ learnerCorrect: .84, accepted: true, reason: 'observed', ms: 1 })).toBe('correct');
    expect(gradeOf({ learnerCorrect: .18, accepted: true, reason: 'observed', ms: 1 })).toBe('not_correct');
    expect(gradeOf({ learnerCorrect: .5, accepted: true, reason: 'observed', ms: 1 })).toBe('unclear');
    expect(gradeOf({ learnerCorrect: null, accepted: false, reason: 'timeout', ms: 1 })).toBe('unclear');
    expect(gradeOf(undefined)).toBe('unclear');
  });

  it('records a misheard correct answer as correct on the first try', () => {
    const s = state([attempt('a', 'sss', false, 'speech', 'Almost! Try again.'), attempt('a', 'sss', true, 'speech', 'Yes!'),
      attempt('b', 'red', true, 'gesture')]);
    const scored = scoreSession(['a', 'b'], s, ['correct', 'correct', undefined]);
    expect(scored.summary.outcomes[0]).toMatchObject({ solved: true, corrections: 0, score: 100 });
    expect(scored.disagreements).toBe(1);
    expect(scored.attempts[0]).toMatchObject({ correct: true, flowCorrect: false, grade: 'correct' });
  });

  it('never credits a praised wrong answer, and an unclear grade keeps the flow verdict', () => {
    const s = state([attempt('a', 'em', true, 'speech', 'Correct, the letter s!'), attempt('b', 'red', true, 'gesture')]);
    expect(scoreSession(['a', 'b'], s, ['not_correct', undefined]).summary.outcomes[0]).toMatchObject({ solved: false, score: 0 });
    expect(scoreSession(['a', 'b'], s, ['unclear', undefined]).summary.outcomes[0]).toMatchObject({ solved: true, score: 100 });
  });

  it('never re-grades a gesture: its code check stands', () => {
    const s = state([attempt('a', 'sss', true), attempt('b', 'blue', false, 'gesture'), attempt('b', 'red', true, 'gesture')]);
    const scored = scoreSession(['a', 'b'], s, ['correct', 'correct' as AttemptGrade, 'not_correct' as AttemptGrade]);
    expect(scored.attempts.slice(1).map(a => [a.correct, a.grade])).toEqual([[false, 'activity_check'], [true, 'activity_check']]);
    expect(scored.summary.outcomes[1]).toMatchObject({ solved: true, corrections: 1, score: 67 });
  });

  it('records the learner\'s words apart from the tutor\'s reply, and how each attempt was scored', () => {
    const s = state([attempt('a', 'sss', false, 'speech', 'Almost! Try again.'), attempt('a', 'sss', true, 'speech', 'Yes!'),
      attempt('b', 'red', true, 'gesture')]);
    const result = teachingEvaluation(items, s, scoreSession(['a', 'b'], s, ['unclear', 'correct', undefined]), 'letter_sound');
    const first = result.learningResponses[0];
    expect(first.observed).toBe('Heard (speech transcript, may be noisy): "sss"');
    expect(first.observed).not.toContain('Almost');
    expect(first.support).toContain('Tutor replied: "Almost! Try again."');
    expect(first.support).toContain("Scored by the tutor's verdict (re-grade unclear)");
    expect(result.diagnosisEvidence).toMatchObject({ judgeFeedback: 'Almost! Try again.',
      priorAttempts: [{ challenge: 'What sound does s make?', observed: 'sss' }] });
    expect(result.learningResponses[2].observed).toBe('red');
  });

  it('refuses a request with no learner words or no expected answer', () => {
    const base = { scope: { sessionEpoch: 'e', instanceId: 'i', itemId: 'a' }, attemptIndex: 0, task: 't', expectedAnswer: '5',
      learner: 'five', tutor: 'Yes' };
    expect(validItemScoreRequest(base)).toBe(true);
    expect(validItemScoreRequest({ ...base, learner: ' ' })).toBe(false);
    expect(validItemScoreRequest({ ...base, expectedAnswer: '' })).toBe(false);
  });
});
