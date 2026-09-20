import { expect, it } from 'vitest';
import { decideDialogue } from './observeDialogue';
import { validDialogueRequest, type DialogueRequest } from '../../components/live-activity/runtime/dialogueContract';
const input: DialogueRequest = { scope: { sessionEpoch: 's', instanceId: 'b', itemId: '1', revision: 2 },
  task: 'Count blocks', phase: 'checked', learner: 'three', tutor: 'Yes, three!', lastResponse: { response: '3', correct: true, assisted: false } };
const choice = (selected: string, options: string[], p = .98) => ({ type: 'choice', choice: selected, confidence: p,
  probabilities: Object.fromEntries(options.map(o => [o, o === selected ? p : (1-p)/(options.length-1)])) });
const answers = (verdict = 'correct', transition = 'advance', p = .98) => ({
  verdict: choice(verdict, ['correct', 'incorrect', 'none'], p), transition: choice(transition, ['advance', 'retry', 'none'], p) });
it('uses tutor verdicts for pending speech even without a parsed or matching learner answer', () => {
  const spoken = { ...input, phase: 'working', lastResponse: null, learner: 'ocho', pendingResponse: { id: 'turn-1', text: 'ocho' },
    activity: { responseSource: null, attemptNumber: 0, objects: [], demonstration: [], facts: { response: 'speech' }, assistance: { level: 0, answerExposure: 'none' as const } } };
  expect(decideDialogue(spoken, answers(), 200)).toMatchObject({ verdict: 'correct', transition: 'advance', accepted: true });
  expect(decideDialogue({ ...spoken, learner: 'unreadable' }, answers('incorrect', 'retry'), 200))
    .toMatchObject({ verdict: 'incorrect', transition: 'retry', accepted: true });
  expect(decideDialogue(spoken, answers('none', 'advance'), 200).accepted).toBe(false);
  expect(decideDialogue(spoken, answers('correct', 'advance', .7), 200).accepted).toBe(false);
  expect(decideDialogue(spoken, answers('correct', 'none'), 200)).toMatchObject({ verdict: 'correct', transition: 'none', accepted: true });
});
it('advances a checked success with finished affirmation without needing the tutor to announce advancement', () => {
  const a = { ...answers(), transition: choice('advance', ['advance', 'retry', 'none'], .87),
    feedback: choice('finished', ['finished', 'open'], .96) };
  expect(decideDialogue(input, a, 200)).toMatchObject({ accepted: true, transition: 'advance', confidence: .96,
    reason: 'checked_success_feedback_finished' });
  expect(decideDialogue(input, { ...a, feedback: choice('open', ['finished', 'open']) }, 200).transition).toBe('none');
  expect(decideDialogue(input, { ...a, feedback: choice('finished', ['finished', 'open'], .7) }, 200).transition).toBe('none');
  expect(decideDialogue({ ...input, lastResponse: { ...input.lastResponse!, correct: false } }, a, 200).accepted).toBe(false);
});
it('uses the selected probability without a second confidence veto for real tutor affirmations', () => {
  const spoken = { ...input, phase: 'working', lastResponse: null,
    pendingResponse: { id: 'turn-1', text: 'Could it be five?' },
    activity: { responseSource: null, attemptNumber: 0, objects: [], demonstration: [], facts: { response: 'speech' },
      assistance: { level: 0, answerExposure: 'none' as const } } };
  // Captured live reply: "That's it, there are five blocks in total!"
  const a = { verdict: { type: 'choice', choice: 'correct', confidence: .87,
    probabilities: { correct: .91, none: .06, incorrect: .03 } },
    feedback: choice('finished', ['finished', 'open'], .99),
    transition: choice('advance', ['advance', 'retry', 'none'], .84) };
  expect(decideDialogue(spoken, a, 200)).toMatchObject({ accepted: true, verdict: 'correct',
    transition: 'advance', verdictConfidence: .91, confidence: .91 });
  expect(decideDialogue(spoken, { ...a, verdict: { ...a.verdict, confidence: 1,
    probabilities: { correct: .7, none: .3, incorrect: 0 } } }, 200).accepted).toBe(false);
});
it('accepts clear supported success and retry, without changing the underlying checked response', () => {
  expect(decideDialogue(input, answers(), 200)).toMatchObject({ accepted: true, transition: 'advance' });
  expect(decideDialogue({ ...input, lastResponse: { ...input.lastResponse!, correct: false } }, answers('incorrect', 'retry'), 200))
    .toMatchObject({ accepted: true, transition: 'retry' });
});
it.each([null, {}, answers('correct', 'advance', .8), { ...answers(), verdict: { type: 'choice', choice: 'correct', confidence: 1 } }])('abstains on uncertain or malformed outputs %#', a => {
  expect(decideDialogue(input, a, 200).accepted).toBe(false);
});
it('rejects false praise, false correction, and missing evidence', () => {
  expect(decideDialogue({ ...input, lastResponse: { ...input.lastResponse!, correct: false } }, answers(), 200).accepted).toBe(false);
  expect(decideDialogue(input, answers('incorrect', 'retry'), 200).accepted).toBe(false);
  expect(decideDialogue({ ...input, lastResponse: null }, answers(), 200).accepted).toBe(false);
  expect(decideDialogue({ ...input, phase: 'working' }, answers(), 200).accepted).toBe(false);
});
it('validates the HTTP boundary', () => {
  expect(validDialogueRequest(input)).toBe(true);
  expect(validDialogueRequest({ ...input, scope: {} })).toBe(false);
  expect(validDialogueRequest({ ...input, tutor: ' ' })).toBe(false);
  expect(validDialogueRequest({ ...input, activity: { objects: [null] } })).toBe(false);
});
it('does not require a confident spoken verdict to recognize a confident invitation to retry', () => {
  const a = { ...answers('none', 'retry'), verdict: choice('none', ['correct', 'incorrect', 'none'], .6) };
  expect(decideDialogue({ ...input, lastResponse: { ...input.lastResponse!, correct: false } }, a, 200))
    .toMatchObject({ verdict: 'none', transition: 'retry', confidence: .98, accepted: true });
});

it('reports no score for a refused observation and exposes feedback completion on its own', () => {
  // Reproduced from the failed lesson-protocol audio run (counting board, run 3):
  // the tutor finished its praise and the transition read 0.95, but the verdict
  // never cleared its threshold. Reporting that 0.95 made a refusal look like a
  // recognized answer, which is the opposite of what happened.
  const spoken = { ...input, phase: 'working', lastResponse: null, learner: '1 2 3 4 5',
    pendingResponse: { id: 'speech:32', text: '1 2 3 4 5' },
    activity: { responseSource: null, attemptNumber: 1, objects: [], demonstration: [], facts: { response: 'speech' },
      assistance: { level: 2, answerExposure: 'full' as const } } };
  const uncertain = { verdict: { type: 'choice', choice: 'correct', confidence: .66, probabilities: { correct: .77, none: .14, incorrect: .09 } },
    feedback: choice('finished', ['finished', 'open'], 1),
    transition: { type: 'choice', choice: 'advance', confidence: .94, probabilities: { advance: .95, none: .04, retry: .01 } } };
  expect(decideDialogue(spoken, uncertain, 412)).toMatchObject({ accepted: false, reason: 'unsupported',
    verdict: 'none', transition: 'none', confidence: 0, verdictConfidence: 0, feedbackComplete: true });
  // A contradicted observation reports no score either.
  expect(decideDialogue({ ...input, lastResponse: { ...input.lastResponse!, correct: false } },
    { ...answers(), feedback: choice('finished', ['finished', 'open']) }, 200))
    .toMatchObject({ accepted: false, reason: 'contradiction', confidence: 0 });
  // An unfinished reply is a different disposition from a refused verdict.
  expect(decideDialogue(spoken, { ...uncertain, feedback: choice('open', ['finished', 'open']) }, 200).feedbackComplete).toBe(false);
});
