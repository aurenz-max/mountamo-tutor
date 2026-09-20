import { writeFileSync } from 'node:fs';
const shapePilot = process.argv.includes('--shapes');
const cases = shapePilot ? [
  ['name', 'triangle', 'Correct, it is a triangle.', 'correct', 'advance'],
  ['multilingual', 'triángulo', 'Yes, it is a triangle!', 'correct', 'advance'],
  ['noisy', 'try angle', 'Exactly, triangle is right.', 'correct', 'advance'],
  ['side_substep', 'three', 'Yes, it has three sides. What is its name?', 'none', 'none', 'triangle', 'How many sides does it have?'],
  ...(process.argv.includes('--final-after-substep') ? [
    ['final_after_substep', 'triangle', 'Fantastic job, that red shape is indeed a triangle!', 'correct', 'advance', 'triangle', 'How many corners does the red shape have?'],
    // Exact exchange from the failed lesson-protocol audio run 2 (2026-09-19).
    ['final_after_substep_live', 'triangle', 'Fantastic job, that red shape is indeed a triangle!', 'correct', 'advance', 'triangle',
      "Let's count the pointy corners together; how many do you see on the red shape?"],
  ] : []),
  ['bare_substep', 'three', 'Exactly right!', 'none', 'none', 'triangle', 'How many sides does it have?'],
  ['color_substep', 'red', 'Correct, it is red. Now tell me the shape name.', 'none', 'none', 'triangle', 'What color is it?'],
  ['wrong_name_praise', 'circle', 'Correct, the shape inside the gold ring is a circle!', 'none', 'none'],
  ['comparison_praise', 'square', 'Yes, that other shape is a square. Now name the gold-ringed shape.', 'none', 'none', 'triangle', 'What is the other shape called?'],
  ['open_question', 'triangle', 'Triangle is right. How did you recognize it?', 'correct', 'none'],
  ['retry', 'circle', 'Not a circle. Try naming this shape again.', 'incorrect', 'retry'],
  ['help', 'help', 'Look at the sides and corners. What do you notice?', 'none', 'none'],
  ['example', 'show me', 'This example is a triangle. Now you try naming the gold-ringed shape.', 'none', 'none'],
  ['no_learner', '', 'It is a triangle.', 'none', 'none'],
  ['alternate', 'diamond', 'Correct, diamond is another name for this rhombus.', 'correct', 'advance', 'rhombus or diamond'],
] : [
  ['german', 'f\u00fcnf', "That's right, there are five fish on the board.", 'correct', 'advance'],
  ['spanish', 'ocho', 'Spot on! There are eight fish here.', 'correct', 'advance'],
  ['noisy_transcript', "It's 5:00.", 'Perfect, you counted all five fish correctly!', 'correct', 'advance'],
  ['contradictory_transcript', 'six', 'That is correct, there are five fish.', 'correct', 'advance'],
  ['retry', 'unrecognized speech', 'Not quite. Try counting them again.', 'incorrect', 'retry'],
  ['indirect_retry', 'unrecognized speech', "Let's count them together one more time.", 'incorrect', 'retry'],
  ['help', 'Can you help me?', 'Let us touch each fish together and count them.', 'none', 'none'],
  ['example', 'Can you show me?', 'For example, here are five fish. Now you try.', 'none', 'none'],
  ['encouragement', 'I am stuck', 'You are doing great. Keep trying!', 'none', 'none'],
  ['open_question', 'f\u00fcnf', 'Five is correct. How did you count them?', 'correct', 'none'],
  ['no_learner', '', 'There are five fish here.', 'none', 'none'],
  ['first_row', 'ocho', "That's correct, there are eight fish in the first row! Now, how many are in the second row?", 'none', 'none', 18, 'How many fish are in the first row?'],
  ['second_row', 'Another eight?', "That's right, there are eight fish in the second row too. Now let's count the last two fish to finish!", 'none', 'none', 18, 'How many are in the second row?'],
  ['bare_substep_praise', 'ocho', 'Exactly right!', 'none', 'none', 18, 'How many fish are in the first row?'],
  ['wrong_total_praise', 'ocho', 'Correct, there are eight fish in total!', 'none', 'none', 18],
  ['whole_total', '8 + 8 = 16 + 2 = 18', 'That is correct! There are eighteen fish in total. Great job counting them all up!', 'correct', 'advance', 18, 'How many are in the second row?'],
  ['whole_total_question', 'eighteen', 'Eighteen in total is correct. How did you work it out?', 'correct', 'none', 18],
  // Exact exchange from the failed lesson-protocol audio run 3 (2026-09-19): a
  // recount invitation, then a corrected count, then praise that never restates
  // the total. The tutor affirms the whole assignment without reciting "five".
  ['wrong_then_corrected_board', '1 2 3 4 5', 'Fantastic job counting all the blocks correctly!', 'correct', 'advance', 5,
    "Let's count them again slowly. Try again from the start and touch each block as you count.", {
      task: 'Count the blocks. Your turn. How many blocks?',
      lastResponse: { response: '1 2 3 4 5 6', correct: false, assisted: true },
      activity: { responseSource: 'speech', attemptNumber: 1,
        objects: Array.from({ length: 5 }, (_, i) => ({ id: `object-${i}`, label: `block ${i + 1}`, selected: false })),
        facts: { kind: 'count_all', objects: 'blocks', counted: 0, takenOff: 0, putOn: 0, moved: 'no',
          startFrom: '', changeBy: '', constraints: '', response: 'speech', presentation: 'ready' },
        assistance: { level: 2, answerExposure: 'full' } },
    }],
];
const results = [];
for (let repetition = 1; repetition <= 3; repetition++) for (const [name, learner, tutor, verdict, transition, target, priorTutor, overrides] of cases) {
  const expectedAnswer = String(target ?? (shapePilot ? 'triangle' : name === 'spanish' ? 8 : 5));
  const input = { scope: { sessionEpoch: 'probe', instanceId: 'fish', itemId: 'c1', revision: 1 },
    task: shapePilot ? 'Name the shape inside the gold ring. What shape is it?' : 'Count all the fish. How many fish in total?', expectedAnswer, priorTutor, phase: 'working', learner, tutor, lastResponse: null,
    ...(learner ? { pendingResponse: { id: 'turn-1', text: learner } } : {}),
    activity: { responseSource: null, attemptNumber: 0, objects: shapePilot ? [
      { id: 'shape-0', label: `red ${expectedAnswer}`, selected: false, group: 'assignment target (gold ring)' },
      { id: 'shape-1', label: 'blue square', selected: false, group: 'comparison shape' },
    ] : Array.from({ length: Number(expectedAnswer) }, (_, i) => ({
      id: `object-${i}`, label: `fish ${i + 1}`, selected: false })), demonstration: [], facts: { response: 'speech' },
      assistance: { level: 0, answerExposure: 'none' } } };
  if (overrides) Object.assign(input, overrides, { activity: { ...input.activity, ...overrides.activity } });
  const response = await fetch('http://localhost:3000/api/lumina/live-activity/observe-dialogue', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const result = await response.json();
  const actualVerdict = result.accepted ? result.verdict : 'none', actualTransition = result.accepted ? result.transition : 'none';
  // A recount invitation can be guidance without a verdict; both dispositions
  // leave the assignment open without awarding success credit.
  const expected = name === 'indirect_retry'
    ? [{ verdict: 'incorrect', transition: 'retry' }, { verdict: 'none', transition: 'none' }]
    : [{ verdict, transition }];
  const passed = expected.some(e => actualVerdict === e.verdict && actualTransition === e.transition);
  results.push({ repetition, name, input, expected, result, passed });
  console.log(repetition, name, actualVerdict, actualTransition, result.verdictConfidence, passed ? 'PASS' : 'FAIL');
}
writeFileSync(process.argv.slice(2).find(arg => !arg.startsWith('--')) || `qa/tutor-reports/${shapePilot ? 'shape-sorter' : 'counting-board'}-tutor-verdict-2026-09-19.json`, JSON.stringify(results, null, 2));
process.exitCode = results.every(r => r.passed) ? 0 : 1;
