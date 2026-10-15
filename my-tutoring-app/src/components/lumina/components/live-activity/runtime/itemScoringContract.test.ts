import { describe, expect, it } from 'vitest';
import { gradeOf, scoreSession, validItemScoreRequest, type AttemptGrade } from './itemScoringContract';
import { teachingEvaluation } from './teachingEvaluation';
import type { TeachingAttempt, TeachingState } from './TeachingSession';
import type { TeachingItem } from './useTeachingWorkspace';

const attempt = (itemId: string, response: string, correct: boolean, source: TeachingAttempt['source'] = 'speech',
  tutorResponse?: string): TeachingAttempt => ({ itemId, response, correct, source, assisted: false, answerExposure: 'none',
  ...(tutorResponse ? { tutorResponse, judgment: 'tutor' as const } : {}) });
const state = (attempts: TeachingAttempt[]): TeachingState =>
  ({ index: 1, phase: 'completed', assisted: false, answerExposure: 'none', levers: [], practice: null, lastResponse: attempts.at(-1) ?? null, attempts });
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

  it('records each wrong attempt with its own named miss and eval mode, and none on attempts that had none', () => {
    const s = state([{ ...attempt('b', 'blue', false, 'gesture'), miss: 'wrong_color' }, attempt('a', 'mmm', false),
      attempt('a', 'sss', true), attempt('b', 'red', true, 'gesture')]);
    const phases = teachingEvaluation(items, s, scoreSession(['a', 'b'], s, [undefined, 'not_correct', 'correct', undefined]), 'letter_sound')
      .diagnosisEvidence.phases!;
    expect(phases.map(p => [p.itemId, p.phase, p.observed, p.miss])).toEqual([
      ['b', 'letter_sound', 'blue', 'wrong_color'], ['a', 'letter_sound', 'Heard (speech transcript, may be noisy): "mmm"', undefined]]);
    expect(phases[1]).not.toHaveProperty('miss');
  });

  it('refuses a request with no learner words or no expected answer', () => {
    const base = { scope: { sessionEpoch: 'e', instanceId: 'i', itemId: 'a' }, attemptIndex: 0, task: 't', expectedAnswer: '5',
      learner: 'five', tutor: 'Yes' };
    expect(validItemScoreRequest(base)).toBe(true);
    expect(validItemScoreRequest({ ...base, learner: ' ' })).toBe(false);
    expect(validItemScoreRequest({ ...base, expectedAnswer: '' })).toBe(false);
  });
});

describe('a disagreement is uncertain and left out of the score (user ruling 2026-10-14)', () => {
  const lines: TeachingItem[] = ['l1', 'l2', 'l3'].map(id => ({ id, task: 'Read it.', expectedAnswer: 'the line', response: 'speech' as const, checkResponse: () => null }));
  const ids = lines.map(i => i.id);

  it('the "gather" session: the tutor praised a misread the re-grade caught; the item drops out instead of scoring 0', () => {
    // l3: first read missed words (both agree), the retry said "gather" for "together" (tutor praised, re-grade did not).
    const s = state([attempt('l1', 'ok', true), attempt('l2', 'ok', true),
      attempt('l3', 'All the farm animals rest.', false), attempt('l3', 'All the farm animals rest. Gather tonight.', true)]);
    const scored = scoreSession(ids, s, ['correct', 'correct', 'not_correct', 'not_correct']);
    expect(scored.summary.outcomes.map(o => !!o.uncertain)).toEqual([false, false, true]);
    const ev = teachingEvaluation(lines, s, scored, 'literal');
    expect(ev.accuracy).toBe(100);
    expect(ev.passed).toBe(true);
    expect(ev.uncertainItems).toEqual(['l3']);
    expect(ev.outcomes.find(o => o.id === 'l3')).toMatchObject({ solved: false, uncertain: true }); // still in the record
  });

  it('the other direction: a transcript that misheard a right read does not cost the learner either', () => {
    const s = state([attempt('l1', 'ok', true), attempt('l2', 'the dog ran fast', true), attempt('l3', 'ok', false), attempt('l3', 'ok', true)]);
    const ev = teachingEvaluation(lines, s, scoreSession(ids, s, ['correct', 'not_correct', 'not_correct', 'correct']), 'literal');
    expect(ev.uncertainItems).toEqual(['l2']);
    expect(ev.accuracy).toBe(Math.round((100 + 67) / 2));
  });

  it('agreement and unclear grades are not uncertain; all-uncertain falls back to the recorded outcomes', () => {
    const s = state([attempt('l1', 'ok', true), attempt('l2', 'no', false), attempt('l3', 'ok', true)]);
    expect(scoreSession(ids, s, ['correct', 'not_correct', 'unclear']).summary.outcomes.some(o => o.uncertain)).toBe(false);
    const all = scoreSession(ids, s, ['not_correct', 'correct', 'not_correct']);
    expect(all.summary.outcomes.every(o => o.uncertain)).toBe(true);
    expect(teachingEvaluation(lines, s, all, 'literal').accuracy).toBe(Math.round(100 / 3));
  });
});
