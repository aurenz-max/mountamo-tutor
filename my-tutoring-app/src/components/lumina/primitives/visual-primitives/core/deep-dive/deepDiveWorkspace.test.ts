import { describe, expect, it } from 'vitest';
import { deepDiveHarnessAnswers, deepDiveItems, deepDiveKey, workspaceScene } from './deepDiveWorkspace';
import { spokenMathDeep } from '../../../../utils/mathText';
import type { MultipleChoiceBlockData } from './types';

const block: MultipleChoiceBlockData = {
  id: 'b1', blockType: 'multiple-choice', label: 'Check', tutoringBrief: '', transitionCue: '',
  question: 'What is $2(-1) - 1(1)$?', options: ['$-3$', '$3$', '$-1$', '$1$'], correctIndex: 0, explanation: '',
};
const [item] = deepDiveItems({ blocks: [block] });

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
