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
  // Since 09-24 (no dead end after an answer) a likely credit below the gate asks the tutor to confirm
  // instead of refusing in silence; it still grants nothing and reports no score.
  expect(decideDialogue(spoken, uncertain, 412)).toMatchObject({ accepted: false, reason: 'confirm_credit',
    verdict: 'none', transition: 'none', confidence: 0, verdictConfidence: 0, feedbackComplete: true, replyFinished: true });
  // A contradicted observation reports no score either.
  expect(decideDialogue({ ...input, lastResponse: { ...input.lastResponse!, correct: false } },
    { ...answers(), feedback: choice('finished', ['finished', 'open']) }, 200))
    .toMatchObject({ accepted: false, reason: 'contradiction', confidence: 0 });
  // An unfinished reply is a different disposition from a refused verdict.
  expect(decideDialogue(spoken, { ...uncertain, feedback: choice('open', ['finished', 'open']) }, 200).feedbackComplete).toBe(false);
});

it('never leaves a finished reply to a spoken answer in a dead end (user ruling 09-24)', () => {
  const spoken = { ...input, phase: 'working', lastResponse: null, learner: 'fewer apples than bananas',
    pendingResponse: { id: 'speech:7', text: 'fewer apples than bananas' },
    activity: { responseSource: null, attemptNumber: 0, objects: [], demonstration: [], facts: { response: 'speech' },
      assistance: { level: 0, answerExposure: 'none' as const } } };
  const reply = (p: Record<string, number>, finished = .83) => ({
    verdict: { type: 'choice', choice: Object.entries(p).sort((a, b) => b[1] - a[1])[0][0], confidence: .5, probabilities: p },
    feedback: { type: 'choice', choice: finished > .5 ? 'finished' : 'open', confidence: .8, probabilities: { finished, open: 1 - finished } },
    transition: { type: 'choice', choice: 'none', confidence: .5, probabilities: { advance: .4, none: .5, retry: .1 } } });
  // Likeliest "not credited" below the gate reopens the item for a retry; it can never credit.
  expect(decideDialogue(spoken, reply({ incorrect: .63, none: .35, correct: .02 }), 1)).toMatchObject({
    accepted: true, verdict: 'incorrect', transition: 'retry', resolution: 'not_credited', reason: 'not_credited_below_gate' });
  // Likeliest "credited" below the gate grants nothing and asks the tutor to say plainly (the 09-24 sitting: .89).
  expect(decideDialogue(spoken, reply({ correct: .89, none: .08, incorrect: .03 }), 1)).toMatchObject({
    accepted: false, reason: 'confirm_credit', verdict: 'none', transition: 'none', replyFinished: true });
  // An open reply (a question, the next step) is dialogue, not a verdict: nothing resolves and nothing is asked.
  expect(decideDialogue(spoken, reply({ correct: .56, none: .4, incorrect: .04 }, .2), 1)).toMatchObject({
    accepted: false, replyFinished: false });
});

it("follows the tutor's plain confirmation below the gate: the flow is the tutor's, the record is re-graded (09-24)", () => {
  const spoken = { ...input, phase: 'working', lastResponse: null, learner: 'more dolls than cars',
    pendingResponse: { id: 'speech:9', text: 'more dolls than cars' },
    activity: { responseSource: null, attemptNumber: 0, objects: [], demonstration: [], facts: { response: 'speech' },
      assistance: { level: 0, answerExposure: 'none' as const } } };
  const reply = (p: Record<string, number>) => ({
    verdict: { type: 'choice', choice: Object.entries(p).sort((a, b) => b[1] - a[1])[0][0], confidence: .5, probabilities: p },
    feedback: { type: 'choice', choice: 'finished', confidence: .8, probabilities: { finished: .86, open: .14 } },
    transition: { type: 'choice', choice: 'advance', confidence: .6, probabilities: { advance: .6, none: .35, retry: .05 } } });
  const likelyCredit = reply({ correct: .62, none: .36, incorrect: .02 });
  expect(decideDialogue(spoken, likelyCredit, 1)).toMatchObject({ accepted: false, reason: 'confirm_credit' });
  expect(decideDialogue({ ...spoken, confirming: true }, likelyCredit, 1)).toMatchObject({
    accepted: true, verdict: 'correct', transition: 'advance', resolution: 'confirmed_by_tutor', reason: 'confirmed_by_tutor' });
  expect(decideDialogue({ ...spoken, confirming: true }, reply({ incorrect: .6, none: .3, correct: .1 }), 1)).toMatchObject({
    accepted: true, verdict: 'incorrect', transition: 'retry', resolution: 'not_credited' });
});

it('settles a checked-correct response on finished feedback without a certain verdict (LA-13 part 2)', () => {
  // Captured probe answers for "Great job placing the starting number of shells in the big spot!" after a
  // checked-correct build: verdict none .83, advance .89, feedback finished 1.
  const stepPraise = { verdict: { type: 'choice', choice: 'none', confidence: .83, probabilities: { correct: .16, incorrect: .01, none: .83 } },
    feedback: choice('finished', ['finished', 'open'], 1),
    transition: { type: 'choice', choice: 'advance', confidence: .89, probabilities: { advance: .89, none: .11, retry: 0 } } };
  expect(decideDialogue(input, stepPraise, 1)).toMatchObject({ accepted: true, verdict: 'none', transition: 'advance', confidence: 1,
    reason: 'checked_success_feedback_finished' });
  // Still refused: a checked-wrong response, an open reply, and a tutor who most likely disagrees with the check.
  expect(decideDialogue({ ...input, lastResponse: { ...input.lastResponse!, correct: false } }, stepPraise, 1).transition).not.toBe('advance');
  expect(decideDialogue(input, { ...stepPraise, feedback: choice('open', ['finished', 'open']) }, 1).accepted).toBe(false);
  expect(decideDialogue(input, { ...stepPraise, verdict: { ...stepPraise.verdict, choice: 'incorrect',
    probabilities: { correct: .1, incorrect: .6, none: .3 } } }, 1).accepted).toBe(false);
});

it('credits a confirming reply that clears the gate, not only one below it (LA-13 part 2)', () => {
  const spoken = { ...input, phase: 'working', lastResponse: null, learner: '5 + box = 7', confirming: true,
    pendingResponse: { id: 'speech:19', text: '5 + box = 7' },
    activity: { responseSource: null, attemptNumber: 0, objects: [], demonstration: [], facts: { response: 'speech' },
      assistance: { level: 0, answerExposure: 'none' as const } } };
  // Captured: "You got it right by saying five plus box equals seven!" — correct .94, feedback finished .56.
  const a = { verdict: { type: 'choice', choice: 'correct', confidence: .94, probabilities: { correct: .94, incorrect: .01, none: .05 } },
    feedback: { type: 'choice', choice: 'finished', confidence: .56, probabilities: { finished: .56, open: .44 } },
    transition: { type: 'choice', choice: 'advance', confidence: .59, probabilities: { advance: .59, none: .4, retry: .01 } } };
  expect(decideDialogue(spoken, a, 1)).toMatchObject({ accepted: true, verdict: 'correct', transition: 'advance', resolution: 'confirmed_by_tutor' });
  // Without the host's confirm request the same reply is a held credit, as before.
  expect(decideDialogue({ ...spoken, confirming: undefined }, a, 1)).toMatchObject({ accepted: true, verdict: 'correct', transition: 'none' });
});

it('never leaves a finished confirming reply unresolved: one that does not credit reopens the item (09-26)', () => {
  const spoken = { ...input, phase: 'working', lastResponse: null, learner: 'subtract', confirming: true,
    pendingResponse: { id: 'speech:40', text: 'subtract' },
    activity: { responseSource: null, attemptNumber: 0, objects: [], demonstration: [], facts: { response: 'speech' },
      assistance: { level: 0, answerExposure: 'none' as const } } };
  const reply = (p: Record<string, number>, finished = .9) => ({
    verdict: { type: 'choice', choice: Object.entries(p).sort((x, y) => y[1] - x[1])[0][0], confidence: .5, probabilities: p },
    feedback: { type: 'choice', choice: finished > .5 ? 'finished' : 'open', confidence: .8, probabilities: { finished, open: 1 - finished } },
    transition: { type: 'choice', choice: 'none', confidence: .5, probabilities: { advance: .4, none: .5, retry: .1 } } });
  // Captured shape: "You did it, you've solved this step!" read as `none`, below and at the gate.
  for (const p of [{ none: .6, correct: .35, incorrect: .05 }, { none: .95, correct: .03, incorrect: .02 }])
    expect(decideDialogue(spoken, reply(p), 1)).toMatchObject({ accepted: true, verdict: 'incorrect', transition: 'retry', resolution: 'not_credited' });
  // An open confirming reply (a question) is still dialogue, and the first reply still asks for confirmation.
  expect(decideDialogue(spoken, reply({ none: .6, correct: .35, incorrect: .05 }, .2), 1).accepted).toBe(false);
  expect(decideDialogue({ ...spoken, confirming: undefined }, reply({ none: .6, correct: .35, incorrect: .05 }), 1).transition).not.toBe('retry');
});
