import { expect, it } from 'vitest';
import { decideSpokenMiss, spokenMissKind, spokenMissQuestions } from './observeSpokenMiss';
import { MISS_GATE, validSpokenMissRequest, type SpokenMissRequest } from './spokenMissContract';

const input: SpokenMissRequest = { scope: { sessionEpoch: 's', instanceId: 'board', itemId: 'c1' },
  task: 'How many butterflies?', expectedAnswer: '4', learner: '1 2 4 5',
  misses: [{ id: 'skipped_a_number', pattern: 'Leaves a number out of the counting sequence.' },
    { id: 'one_over', pattern: "The learner's answer is 5.", examples: ['five'] }] };
const choice = (probabilities: Record<string, number>) => ({ type: 'choice', confidence: .5, probabilities,
  choice: Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0][0] });
const noul = (p: number) => ({ type: 'noul', noul: p });
const which = (p: Partial<Record<string, number>>) => choice({ skipped_a_number: 0, one_over: 0, correct: 0, other_wrong: 0, no_answer: 0, ...p } as Record<string, number>);

it('asks one Choice over the item\'s own misses and one Noul per miss', () => {
  const q = spokenMissQuestions(input) as any;
  expect(Object.keys(q)).toEqual(['which', 'fits_skipped_a_number', 'fits_one_over']);
  expect(Object.keys(q.which.criteria)).toEqual(['skipped_a_number', 'one_over', 'correct', 'other_wrong', 'no_answer']);
  expect(q.which.criteria.one_over).toContain('"five"');
  expect(Object.keys(spokenMissKind.state(input) as object).sort()).toEqual(['expectedAnswer', 'learner', 'task']);
});

it.each([
  // [case, which, fits skipped, fits one_over, miss, reason]
  ['list order breaks an overlap the Choice split', { one_over: .68, skipped_a_number: .31 }, .9, .9, 'skipped_a_number', 'named'],
  ['a later miss when the earlier does not fit', { one_over: .95 }, .05, .94, 'one_over', 'named'],
  ['a correct answer names nothing', { correct: .99 }, .02, .03, null, 'correct'],
  ['no answer names nothing', { no_answer: .9 }, .02, .02, null, 'no_answer'],
  ['the Choice alone is not enough (bare "s" read as the letter name)', { skipped_a_number: .73, correct: .17 }, .51, .1, null, 'below_gate'],
  ['a Noul alone is not enough', { correct: .8, one_over: .2 }, .1, .9, null, 'correct'],
  ['a weak earlier fit does not override the Choice\'s pick ("net" and the name `en`)', { one_over: .95 }, .59, .93, 'one_over', 'named'],
  ['a known miss that no Noul confirms stays unnamed', { one_over: .9 }, .2, .4, null, 'below_gate'],
])('%s', (_, w, skipped, over, miss, reason) => {
  const d = decideSpokenMiss(input, { which: which(w), fits_skipped_a_number: noul(skipped as number), fits_one_over: noul(over as number) }, 10, 'jev');
  expect(d).toMatchObject({ accepted: true, miss, reason });
  if (miss) expect(d.p).toBeGreaterThanOrEqual(MISS_GATE);
});

it.each([null, {}, { which: which({ correct: 1 }) }, { which: { ...which({ correct: 1 }), choice: 'gave_all' }, fits_skipped_a_number: noul(0), fits_one_over: noul(0) },
  { which: which({ correct: 1 }), fits_skipped_a_number: noul(1.2), fits_one_over: noul(0) }])('abstains on a malformed answer set %#', a => {
  expect(decideSpokenMiss(input, a, 1)).toMatchObject({ accepted: false, miss: null, reason: 'invalid' });
});

it('validates the wire request', () => {
  expect(validSpokenMissRequest(input)).toBe(true);
  expect(validSpokenMissRequest({ ...input, learner: ' ' })).toBe(false);
  expect(validSpokenMissRequest({ ...input, misses: [] })).toBe(false);
  expect(validSpokenMissRequest({ ...input, misses: [...input.misses, input.misses[0]] })).toBe(false);
  expect(validSpokenMissRequest({ ...input, misses: [{ id: 'correct', pattern: 'x' }] })).toBe(false);
  expect(validSpokenMissRequest({ ...input, misses: [{ id: 'One Over', pattern: 'x' }] })).toBe(false);
});
