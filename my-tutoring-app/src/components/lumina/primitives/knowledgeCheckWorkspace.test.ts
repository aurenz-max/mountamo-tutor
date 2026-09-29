import { expect, it } from 'vitest';
import { knowledgeCheckMiss, knowledgeCheckSpokenMisses } from './knowledgeCheckWorkspace';
import type { KnowledgeCheckItem } from './knowledgeCheckScript';

const tap = (texts: string[], correct: number) => ({ id: 'p0-mc', kind: 'choice_tap', problemIndex: 0, prompt: '',
  options: texts.map((text, i) => ({ id: String.fromCharCode(65 + i), text })), correctOptionId: String.fromCharCode(65 + correct) }) as KnowledgeCheckItem;
const stars = tap(['4', '5', '6', '9'], 1), words = tap(['a park', 'a lake', 'a school'], 0);
const point = { id: 'p1-pt', kind: 'point_to', problemIndex: 1, prompt: '', targetTokenId: 't4', stimulus: { insetType: 'number-sentence',
  tokens: [{ id: 't0', text: '3', kind: 'number' }, { id: 't1', text: '−', kind: 'operator' }, { id: 't2', text: '1', kind: 'number' },
    { id: 't3', text: '=', kind: 'operator' }, { id: 't4', text: '2', kind: 'number' }] } } as KnowledgeCheckItem;

it.each([
  [stars, 'B', undefined], [stars, 'A', 'one_less'], [stars, 'C', 'one_more'], [stars, 'D', 'other_number'],
  [words, 'A', undefined], [words, 'B', 'other_choice'],
  [point, 't4', undefined], [point, 't1', 'sign_token'], [point, 't3', 'sign_token'], [point, 't0', 'other_number_token'],
  [{ ...stars, kind: 'choice' } as KnowledgeCheckItem, 'A', undefined],
] as const)('%#', (item, tapped, miss) => {
  expect(knowledgeCheckMiss(item, tapped)).toBe(miss);
});

// A spoken item's known wrong answers (handoff 20 Part B): ids in precedence order, and no example is accepted.
const spoken = (extra: Partial<KnowledgeCheckItem>) => ({ id: 'p', problemIndex: 0, prompt: '', ...extra }) as KnowledgeCheckItem;
it.each([
  ['true_false', spoken({ kind: 'true_false', correctBool: true }), ['opposite_verdict'], ['true', 'yes']],
  ['word choice', spoken({ ...words, kind: 'choice' }), ['other_choice', 'two_choices'], ['a park']],
  ['number choice', spoken({ ...stars, kind: 'choice' }), ['one_less', 'one_more', 'other_number', 'two_choices'], ['5']],
  ['sort', spoken({ ...words, kind: 'sort', focusText: 'a swing' }), ['other_choice', 'two_choices', 'said_card_back'], ['a park']],
  ['blank', spoken({ kind: 'blank', answerWord: 'sun', wordBank: ['sun', 'rock'] }), ['other_bank_word'], ['sun']],
  ['how_many', spoken({ kind: 'how_many', expectedAnswer: 'four', alternates: ['4'], stimulus: { insetType: 'arrangement', count: 6, removed: 2 } as never }),
    ['said_start', 'one_short', 'one_over', 'short_by_more', 'over_by_more'], ['four', '4']],
  ['tap', stars, [], []],
] as const)('%s: spoken misses', (_name, item, ids, accepted) => {
  const misses = knowledgeCheckSpokenMisses(item);
  expect(misses.map(m => m.id)).toEqual(ids);
  const ok = accepted.map(a => a.toLowerCase());
  for (const m of misses) for (const e of m.examples ?? []) expect(ok).not.toContain(e.toLowerCase());
});
