import { expect, it } from 'vitest';
import { knowledgeCheckMiss } from './knowledgeCheckWorkspace';
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
