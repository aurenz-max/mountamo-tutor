import { describe, expect, it } from 'vitest';
import { deepDiveHarnessAnswers, deepDiveItems, deepDiveKey, sectionScene, sectionsBefore, sectionsLeft, workspaceScene } from './deepDiveWorkspace';
import { spokenMathDeep } from '../../../../utils/mathText';
import type { DeepDiveBlock, KeyFactsBlockData, MultipleChoiceBlockData } from './types';

const block: MultipleChoiceBlockData = {
  id: 'b1', blockType: 'multiple-choice', label: 'Check', tutoringBrief: '', transitionCue: '',
  question: 'What is $2(-1) - 1(1)$?', options: ['$-3$', '$3$', '$-1$', '$1$'], correctIndex: 0, explanation: '',
};
const [item] = deepDiveItems({ blocks: [block] });

describe('the sections before each check', () => {
  const facts = (id: string): KeyFactsBlockData => ({ id, blockType: 'key-facts', label: `Facts ${id}`, tutoringBrief: 'Have them tap a card.',
    transitionCue: '', facts: [{ icon: 'x', text: `The secret of ${id}.`, headline: 'Tap me' }] });
  const check = (id: string): MultipleChoiceBlockData => ({ ...block, id });
  const blocks: DeepDiveBlock[] = [facts('a'), facts('b'), check('c1'), facts('d'), check('c2'), check('c3')];

  it('takes every block after the previous check', () => {
    expect(sectionsBefore(blocks, 'c1').map(b => b.id)).toEqual(['a', 'b']);
    expect(sectionsBefore(blocks, 'c2').map(b => b.id)).toEqual(['d']);
    expect(sectionsBefore(blocks, 'c3')).toEqual([]);
  });

  it('opens the check once its sections are passed', () => {
    expect(sectionsLeft(blocks, 'c1', new Set(['a'])).map(b => b.id)).toEqual(['b']);
    expect(sectionsLeft(blocks, 'c1', new Set(['a', 'b']))).toEqual([]);
  });

  it('gives the tutor the section to teach, its brief and how many remain', () => {
    const { facts: f } = sectionScene({ title: 'Shapes' }, facts('a'), 2);
    expect(f.sectionContent1).toContain('The secret of a.');
    expect(f.sectionBrief).toBe('Have them tap a card.');
    expect(f.sectionsLeftBeforeCheck).toBe(2);
  });

  it('keeps a long section inside the 500-character fact limit, in order', () => {
    const long: KeyFactsBlockData = { ...facts('a'), facts: [{ icon: 'x', text: `${'word '.repeat(300)}end` }] };
    const { facts: f } = sectionScene({ title: 'Shapes' }, long, 1);
    const parts = Object.entries(f).filter(([k]) => k.startsWith('sectionContent')).map(([, v]) => String(v));
    expect(parts.length).toBeGreaterThan(1);
    expect(Object.values(f).filter(v => typeof v === 'string' && v.length > 500)).toEqual([]);
  });
});

describe('deep-dive math reaches the tutor as words', () => {
  it('keys a LaTeX choice by how it is said', () => {
    expect(deepDiveKey(item)).toMatchObject({ answer: 'negative 3' });
    expect(deepDiveHarnessAnswers(item)).toEqual({ correct: 'negative 3', wrong: '3' });
  });

  it('shows the tutor the question and choices without LaTeX', () => {
    const scene = spokenMathDeep(workspaceScene({ title: 'Matrices' }, item, { work: '', sections: [], asked: [] }));
    expect(scene.facts.question).toBe('What is 2 times negative 1 minus 1 times 1?');
    expect(scene.facts.choices).toBe('negative 3 | 3 | negative 1 | 1');
  });
});
