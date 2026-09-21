import { expect, it } from 'vitest';
import { decideLearnerIntent, learnerIntentKind, LEARNER_INTENT_QUESTIONS } from './observeLearnerIntent';
import { assignmentOutcomeKind, DIALOGUE_QUESTIONS, decideDialogue } from './observeDialogue';
import { learnerIntentFlags, validLearnerIntentRequest, type LearnerIntentRequest }
  from '../../components/live-activity/runtime/learnerIntentContract';

const input: LearnerIntentRequest = { scope: { sessionEpoch: 's', instanceId: 'b', itemId: '1' }, turnId: 't1',
  task: 'Count all the fish.', learner: 'I do not know', priorTutor: 'How many fish?' };
const noul = (p: number) => ({ type: 'noul', noul: p });
const answers = (help: number, stop: number, attempt: number) => ({ asksForHelp: noul(help), wantsToStop: noul(stop), attemptsAnswer: noul(attempt) });

it('reports probabilities and leaves the policy to code', () => {
  const d = decideLearnerIntent(input, answers(.93, .04, .1), 250, 'jev');
  expect(d).toMatchObject({ accepted: true, asksForHelp: .93, wantsToStop: .04, attemptsAnswer: .1, reason: 'observed', ms: 250 });
  expect(learnerIntentFlags(d)).toEqual({ helpRequested: true, stopRequested: false, attemptedAnswer: false });
  expect(learnerIntentFlags(decideLearnerIntent(input, answers(.79, .8, .5), 1))).toEqual({ helpRequested: false, stopRequested: true, attemptedAnswer: null });
});
it.each([null, {}, { ...answers(.9, .1, .1), wantsToStop: noul(1.2) }, { ...answers(.9, .1, .1), attemptsAnswer: { type: 'choice' } }])(
  'abstains on a malformed answer set %#', a => {
    const d = decideLearnerIntent(input, a, 1);
    expect(d.accepted).toBe(false); expect(learnerIntentFlags(d)).toBeNull();
  });
it('keeps the expected answer out of the model input, so it cannot grade', () => {
  const state = learnerIntentKind.state({ ...input, expectedAnswer: '5' } as LearnerIntentRequest) as Record<string, unknown>;
  expect(Object.keys(state).sort()).toEqual(['learner', 'priorTutor', 'task']);
  expect(JSON.stringify(LEARNER_INTENT_QUESTIONS)).not.toMatch(/expected/i);
});
it('validates the wire request', () => {
  expect(validLearnerIntentRequest(input)).toBe(true);
  expect(validLearnerIntentRequest({ ...input, learner: '  ' })).toBe(false);
  expect(validLearnerIntentRequest({ ...input, scope: { ...input.scope, itemId: '' } })).toBe(false);
  expect(validLearnerIntentRequest({ ...input, learner: 'x'.repeat(2001) })).toBe(false);
});
it('registers the existing outcome observation unchanged: same questions, same decision, same model input', () => {
  expect(assignmentOutcomeKind.questions).toBe(DIALOGUE_QUESTIONS);
  expect(assignmentOutcomeKind.decide).toBe(decideDialogue);
  expect(assignmentOutcomeKind.timeoutMs).toBe(3000);
  const spoken = { scope: { sessionEpoch: 's', instanceId: 'b', itemId: '1', revision: 2 }, task: 'Count', phase: 'working', learner: 'ocho',
    tutor: 'Yes, eight!', expectedAnswer: '8', priorTutor: 'How many?', lastResponse: null, pendingResponse: { id: 't', text: 'ocho' },
    activity: { responseSource: null, attemptNumber: 0, objects: [], demonstration: [], facts: { response: 'speech' },
      assistance: { level: 0, answerExposure: 'none' as const } } };
  expect(assignmentOutcomeKind.state(spoken)).toEqual({ assignment: 'Count', expectedAnswer: '8', priorTutor: 'How many?', tutor: 'Yes, eight!',
    activity: spoken.activity, responseAuthority: 'tutor_feedback', learnerTurnPresent: true });
  const gesture = { ...spoken, pendingResponse: undefined, phase: 'checked', lastResponse: { response: '8', correct: true, assisted: false } };
  expect(assignmentOutcomeKind.state(gesture)).toEqual({ assignment: 'Count', expectedAnswer: '8', priorTutor: 'How many?', tutor: 'Yes, eight!',
    activity: spoken.activity, responseAuthority: 'activity_check', learner: 'ocho', checkedResponse: gesture.lastResponse });
});
