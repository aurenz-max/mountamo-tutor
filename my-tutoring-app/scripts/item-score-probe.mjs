#!/usr/bin/env node
/**
 * Real-model case set for the scoring pass (`/api/lumina/observe-item-score`): does it grade the LEARNER's
 * answer, including the cases where the tutor's feedback was wrong? Label true = the learner's own answer is
 * correct, false = not, null = honestly ambiguous (reported, never scored). False credit (a false-labelled case
 * graded correct) must be 0. Run from my-tutoring-app with the dev server on :3000.
 *
 *   node scripts/item-score-probe.mjs [--runs N] [out.json]
 */
import { writeFileSync } from 'node:fs';

const count = { task: 'How many fish are on the board?', expectedAnswer: '5' };
const letterM = { task: 'What sound does the letter m make?', expectedAnswer: 'the sound /m/ (mmm), not the letter name' };
const letterS = { task: 'What sound does the letter s make?', expectedAnswer: 'the sound /s/ (sss), not the letter name' };
const graph = { task: 'The rows show Apples, Crackers, Bananas. Tell me one thing this graph shows: compare two groups, in your own words.',
  expectedAnswer: 'One true comparison is the whole answer. Any one of these, in the learner\'s own words: Crackers have more than Apples. '
    + 'Bananas have more than Apples. Crackers have more than Bananas. Crackers have the most. Apples have the fewest. Judge only the '
    + 'comparison: a count the learner says on the way, right or wrong, does not change whether the comparison is true.' };
const worth = { task: 'What are those ten-sticks worth altogether?', expectedAnswer: '40' };
const sentence = { task: 'Read the sentence: The cat sat on the mat.', expectedAnswer: 'The cat sat on the mat.' };
const fact = { task: 'What is two plus three?', expectedAnswer: '5' };
const shape = { task: 'What is the name of the shape inside the gold ring?', expectedAnswer: 'triangle' };

const CASES = [
  // [name, item, learner, tutor, label, priorTutor?]
  ['count_correct', count, 'five', 'Yes, five fish!', true],
  ['count_digits_noise', count, "It's 5:00.", 'Perfect, you counted all five!', true],
  ['count_spanish', count, 'cinco', 'Great, cinco means five!', true],
  ['count_wrong', count, 'six', 'Let us count again together.', false],
  ['count_wrong_praised', count, 'six', 'Great job counting!', false],
  ['count_repeat_model', count, 'five', 'Yes, five!', false, 'There are five fish. Now you say it: five.'],
  ['count_help', count, "I don't know", 'Let us touch each fish and count.', false],
  ['count_misheard', count, 'five', 'Hmm, not quite. Count again.', true],
  ['letter_m_correct', letterM, 'mmm', 'Yes, mmm!', true],
  ['letter_m_name', letterM, 'em', 'Correct, the letter m says em!', false],
  ['letter_s_misheard', letterS, 'sss', 'Almost! The letter s makes a hissing sound. Try again.', true],
  ['letter_s_clipped', letterS, 's', 'Yes, sss like a snake!', true],
  ['graph_true', graph, 'There are more crackers than apples.', 'That is right!', true],
  ['graph_miscount_true', graph, 'There are two apples and three bananas, so there are fewer apples than bananas.',
    'You got it, there are definitely fewer apples than bananas!', true],
  ['graph_false_praised', graph, 'There are more apples than crackers.', 'Yes, more apples than crackers!', false],
  ['graph_count_only', graph, 'There are two apples.', 'Good counting! Now compare two groups.', false],
  ['worth_correct', worth, 'forty', 'Yes, forty!', true],
  ['worth_count_not_value', worth, 'four', 'Four ten-sticks, yes. And what are they worth?', false],
  ['sentence_correct', sentence, 'the cat sat on the mat', 'You read every word!', true],
  ['sentence_skipped_praised', sentence, 'the cat sat on mat', 'Great reading!', false],
  ['fact_correct', fact, '5', 'Five, yes!', true],
  ['fact_wrong', fact, 'six', 'Try again: two plus three.', false],
  ['shape_correct', shape, 'triangle', 'Yes, a triangle!', true],
  ['shape_substep', shape, 'three', 'Exactly right!', false, 'How many sides does it have?'],
];

const runs = Number(process.argv.includes('--runs') ? process.argv[process.argv.indexOf('--runs') + 1] : 3);
const out = process.argv.slice(2).find(a => a.endsWith('.json'));
const results = [];
for (let rep = 1; rep <= runs; rep++) for (const [name, item, learner, tutor, label, priorTutor] of CASES) {
  const body = { scope: { sessionEpoch: 'probe', instanceId: 'probe', itemId: name }, attemptIndex: 0, ...item, learner, tutor,
    ...(priorTutor ? { priorTutor } : {}) };
  const r = await fetch('http://localhost:3000/api/lumina/observe-item-score', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = r.ok ? await r.json() : { accepted: false, reason: `HTTP ${r.status}` };
  const p = d.learnerCorrect;
  const grade = !d.accepted || typeof p !== 'number' ? 'unclear' : p >= 0.8 ? 'correct' : p <= 0.2 ? 'not_correct' : 'unclear';
  const want = label === true ? 'correct' : label === false ? 'not_correct' : 'unclear';
  results.push({ rep, name, label, p, grade, pass: grade === want, falseCredit: label === false && grade === 'correct' });
  console.log(rep, name.padEnd(26), String(p).slice(0, 5).padEnd(6), grade.padEnd(12), grade === want ? 'PASS' : 'MISS');
}
const fc = results.filter(r => r.falseCredit).length, missed = results.filter(r => !r.pass && !r.falseCredit);
console.log(`\n${results.filter(r => r.pass).length}/${results.length} pass, false credit ${fc}, `
  + `unclear ${results.filter(r => r.grade === 'unclear').length}, wrong-way ${missed.filter(r => r.grade !== 'unclear').length}`);
if (out) writeFileSync(out, JSON.stringify(results, null, 2));
