import { describe, expect, it, vi } from 'vitest';

vi.mock('../../geminiClient', () => ({ ai: {} }));

import { readVerdicts, studentView, verdictIssues } from './review';
import type { DeepDiveBlock } from '../../../primitives/visual-primitives/core/deep-dive/types';

const base = { id: 'b', label: 'Check', section: 0, ideas: ['1.1'] };
const mc: DeepDiveBlock = { ...base, blockType: 'multiple-choice', question: 'What makes food?', options: ['roots', 'leaves', 'stems', 'petals'], correctIndex: 1, explanation: 'Leaves hold the secret.' };
const fib: DeepDiveBlock = { ...base, blockType: 'fill-in-blank', sentence: 'Plants need ______ to grow.', blankIndex: 2, correctAnswer: 'sunshine', wordBank: ['sand', 'sunshine', 'salt', 'stones'] };
const worked: DeepDiveBlock = {
  ...base, blockType: 'worked-example', problem: 'Solve $2x + 3 = 11$', answer: 'x equals four',
  steps: [{ work: 'first line', reason: 'start' }, { work: 'hidden line', reason: 'the step asked' }, { work: 'later line', reason: 'after it' }],
  tryStep: { index: 1, options: ['hidden line', 'wrong a', 'wrong b', 'wrong c'], correctIndex: 0, explanation: 'Because of subtraction.' },
};
const sim: DeepDiveBlock = {
  ...base, blockType: 'mini-sim', scenario: 'Shade a plant.', controlType: 'toggle', controlLabel: 'Shade', states: [{ condition: 'on', title: 'It wilts', description: 'Dim.', keyObservation: 'Light feeds it.' }],
  prediction: { question: 'What happens?', options: ['grows', 'wilts', 'floats', 'sings'], correctIndex: 1, explanation: 'No light.' },
};
const verdict = (blockIndex: number, answer: string, extra = {}) => ({ blockIndex, answer, answerable: true, givenAway: false, weakDistractors: [], note: '', ...extra });

describe('the blind reader', () => {
  it('never sees a key: not the blanked word marked, not a hidden worked step, not an explanation', () => {
    const view = studentView([mc, fib, worked, sim]);
    expect(view).not.toMatch(/KEY|Leaves hold the secret|later line|x equals four|Because of subtraction|It wilts|No light/);
    expect(view).toContain('first line');
    expect(view.match(/sunshine/g)).toHaveLength(1); // once, in the word bank
    expect(view.match(/hidden line/g)).toHaveLength(1); // once, among the options
  });

  it('marks a misconception as wrong, so the reader does not take it for the lesson\'s claim', () => {
    const wrong: DeepDiveBlock = { ...base, blockType: 'misconception', belief: 'Summer is when Earth is closer', actually: 'Tilt causes seasons', why: 'Hemispheres differ' };
    expect(studentView([wrong])).toMatch(/shown as wrong: "Summer is when Earth is closer"/);
  });

  it('sends back a check the reader answered differently', () => {
    const [v] = readVerdicts([verdict(0, 'roots')], [mc]);
    expect(v.disagreed).toBe('roots');
    expect(verdictIssues({ checks: [v], missingIdeas: [] }).join()).toMatch(/picked "roots"/);
  });

  it('passes a check the reader got right', () => {
    const [v] = readVerdicts([verdict(0, 'Leaves.')], [mc]);
    expect(v.disagreed).toBeUndefined();
    expect(verdictIssues({ checks: [v], missingIdeas: [] })).toEqual([]);
  });

  it('tells apart options that differ only in a sign', () => {
    const math: DeepDiveBlock = { ...base, blockType: 'multiple-choice', question: 'Value?', options: ['$-3$', '$3$', '$0$', '$1$'], correctIndex: 1, explanation: '' };
    expect(readVerdicts([verdict(0, '$-3$')], [math])[0].disagreed).toBe('$-3$');
    expect(readVerdicts([verdict(0, '$3$')], [math])[0].disagreed).toBeUndefined();
  });

  it('does not count a wrong guess on a prediction', () => {
    expect(readVerdicts([verdict(0, 'grows')], [sim])[0].disagreed).toBeUndefined();
  });

  it('ignores a reader calling the right option weak, and an answer it cannot place', () => {
    const [v] = readVerdicts([verdict(0, 'photosynthesis', { weakDistractors: ['leaves', 'petals'] })], [mc]);
    expect(v.weakDistractors).toEqual(['petals']);
    expect(v.disagreed).toBeUndefined();
  });
});
