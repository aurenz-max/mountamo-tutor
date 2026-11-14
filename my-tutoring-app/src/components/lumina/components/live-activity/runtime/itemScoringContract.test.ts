import { describe, expect, it } from 'vitest';
import { scoreSession } from './itemScoringContract';
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

describe('the record is the verdicts that moved the lesson (USER RULING 2026-11-13)', () => {
  it('scores what the tutor said, whatever the transcript reads: "¿Qué?" she praised is a first-try success', () => {
    const s = state([attempt('a', '¿Qué?', true, 'speech', "That's right!"), attempt('b', 'blue', false, 'gesture'),
      attempt('b', 'red', true, 'gesture')]);
    const scored = scoreSession(['a', 'b'], s);
    expect(scored.summary.outcomes.map(o => [o.id, o.solved, o.corrections, o.score])).toEqual([['a', true, 0, 100], ['b', true, 1, 67]]);
  });

  it('leaves practice on a simpler item out of the record', () => {
    const s = state([attempt('a', 'mmm', false), { ...attempt('a~simpler', 'sss', true), practice: true }, attempt('a', 'sss', true)]);
    const scored = scoreSession(['a'], s);
    expect(scored.attempts.map(a => a.itemId)).toEqual(['a', 'a']);
    expect(scored.summary.outcomes[0]).toMatchObject({ solved: true, corrections: 1, score: 67 });
  });

  it('scores a slice of the session on its own items (KC-6: one submission per problem)', () => {
    const s = state([attempt('a', 'sss', true), attempt('b', 'blue', false, 'gesture'), attempt('b', 'red', true, 'gesture')]);
    const whole = teachingEvaluation(items, s, scoreSession(['a', 'b'], s), 'mixed');
    expect(whole.accuracy).toBe(84);
    const a = whole.forItems(['a']), b = whole.forItems(['b']);
    expect([a.accuracy, a.firstTryCount, a.diagnosisEvidence.firstResponseScore, a.diagnosisEvidence.phases]).toEqual([100, 1, 100, []]);
    expect([b.accuracy, b.firstTryCount, b.diagnosisEvidence.firstResponseScore]).toEqual([67, 0, 0]);
    expect(b.diagnosisEvidence.phases?.map(p => p.itemId)).toEqual(['b']);
    expect(b.learningResponses.map(r => r.itemId)).toEqual(['b', 'b']);
  });

  it('records the learner\'s words apart from the tutor\'s reply', () => {
    const s = state([attempt('a', 'sss', false, 'speech', 'Almost! Try again.'), attempt('a', 'sss', true, 'speech', 'Yes!'),
      attempt('b', 'red', true, 'gesture')]);
    const result = teachingEvaluation(items, s, scoreSession(['a', 'b'], s), 'letter_sound');
    const first = result.learningResponses[0];
    expect(first.observed).toBe('Heard (speech transcript, may be noisy): "sss"');
    expect(first.observed).not.toContain('Almost');
    expect(first.support).toContain('Tutor replied: "Almost! Try again."');
    expect(result.diagnosisEvidence).toMatchObject({ judgeFeedback: 'Almost! Try again.',
      priorAttempts: [{ challenge: 'What sound does s make?', observed: 'sss' }] });
    expect(result.learningResponses[2].observed).toBe('red');
  });

  it('records each wrong attempt with its own named miss and eval mode, and none on attempts that had none', () => {
    const s = state([{ ...attempt('b', 'blue', false, 'gesture'), miss: 'wrong_color' }, attempt('a', 'mmm', false),
      attempt('a', 'sss', true), attempt('b', 'red', true, 'gesture')]);
    const phases = teachingEvaluation(items, s, scoreSession(['a', 'b'], s), 'letter_sound').diagnosisEvidence.phases!;
    expect(phases.map(p => [p.itemId, p.phase, p.observed, p.miss])).toEqual([
      ['b', 'letter_sound', 'blue', 'wrong_color'], ['a', 'letter_sound', 'Heard (speech transcript, may be noisy): "mmm"', undefined]]);
    expect(phases[1]).not.toHaveProperty('miss');
  });
});
