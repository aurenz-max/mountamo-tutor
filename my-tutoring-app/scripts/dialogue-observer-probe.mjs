// Real JEV replay: no generated verdicts or mutations injected into the runtime.
import { writeFileSync } from 'node:fs';
const base = { scope: { sessionEpoch: 'probe', instanceId: 'board', itemId: 'c1', revision: 1 },
  task: 'Count the blocks.', phase: 'checked', learner: 'one two three four five',
  lastResponse: { response: 'one two three four five', correct: true, assisted: false } };
const cases = [
  ['reported_feedback_stall', 'Fantastic job counting each block!', true, 'advance'],
  ['success', 'Excellent counting! You found all five blocks.', true, 'advance'],
  ['next', 'Yes, five! Let us try the next one.', true, 'advance'],
  ['readiness', 'We counted five blocks together. Are you ready for the next challenge?', true, 'none'],
  ['continue', 'Let us see what our next counting challenge will be!', true, 'advance'],
  ['retry', 'Nice try! Let us count the blocks one more time, very carefully.', false, 'retry'],
  ['false_praise', 'Excellent counting! You found all five blocks.', false, 'none'],
  ['silence', '<no speech>{pause}', true, 'none'],
  ['help', 'I can help. Touch each block as we count together.', false, 'none'],
  ['explain', 'Five is right. How did you keep track of the blocks?', true, 'none'],
  ['finish', 'You counted them all correctly. We are finished for today!', true, 'advance'],
  ['no_answer', 'Excellent counting! You found all five blocks.', null, 'none'],
  ['false_correction', 'That is not right. Try counting again.', true, 'none'],
  ['natural_retry', "That was some great counting, but let's count the blocks together to make sure we get them all.", false, 'retry'],
  ['encouraging_retry', "I know you can do it, so let's try counting slowly one by one.", false, 'retry'],
  ['closing_praise', 'You did an amazing job with all your counting today!', true, 'advance'],
];
const results = [];
for (const [name, tutor, correct, expected] of cases) {
  const request = { ...base, tutor, learner: name === 'continue' ? 'Yeah, please. Let us continue.'
    : name === 'closing_praise' ? 'I am ready to finish.' : base.learner,
    lastResponse: correct === null ? null : { ...base.lastResponse, correct } };
  const response = await fetch('http://localhost:3000/api/lumina/live-activity/observe-dialogue', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
  if (!response.ok) throw new Error(`Observer HTTP ${response.status}`);
  const result = await response.json();
  const actual = result.accepted ? result.transition : 'none';
  results.push({ name, request, expected, result, passed: actual === expected });
  console.log(name, JSON.stringify(result), actual === expected ? 'PASS' : 'FAIL');
}
writeFileSync(process.argv[2] || 'qa/tutor-reports/counting-board-dialogue-probe-2026-09-19.json', JSON.stringify(results, null, 2));
process.exitCode = results.every(r => r.passed) ? 0 : 1;
