// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StepContentRenderer } from './StepContentRenderer';
import { RichStepCard } from './RichStepCard';
import { StructuredDiagram } from './StructuredDiagram';
import type { AlgebraStepContent } from './types';
vi.mock('../../utils/SoundManager', () => ({ SoundManager: { playCorrect: vi.fn(), playIncorrect: vi.fn(), playClick: vi.fn() } }));
afterEach(cleanup);
const content: AlgebraStepContent = {
  type: 'algebra', result: '37', transitions: [
    { from: { latex: '24+10' }, to: { latex: '34' }, operation: 'Add ten', challenge: { hide: 'to', prompt: 'Where do you land?', acceptableAnswers: ['34'], rationale: 'Ten more.' } },
    { from: { latex: '34+3' }, to: { latex: '37' }, operation: 'Add three' },
  ],
};
describe('real worked-example renderer', () => {
  it('does not show the final result or future from/to expressions before a prediction', () => {
    const complete = vi.fn();
    const { container } = render(<StepContentRenderer content={content} onCompletionChange={complete} />);
    expect(container.textContent).not.toContain('34');
    expect(container.textContent).not.toContain('37');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '34' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(container.textContent).toContain('34');
    expect(container.textContent).not.toContain('37');
    expect(complete).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getByRole('button', { name: /Next transformation/ }));
    expect(container.textContent).toContain('37');
    expect(complete).toHaveBeenLastCalledWith(true);
  });
  it('hides an operation-revealing title and annotations until the real question is committed', () => {
    render(<RichStepCard index={0} activeLayers={['steps']} step={{ id: 1, title: 'Add ten', content, annotations: { steps: 'The answer is 34.', strategy: '', misconceptions: '', connections: '' } }} />);
    expect(screen.getByRole('heading', { name: 'Your turn' })).toBeTruthy();
    expect(screen.queryByText('The answer is 34.')).toBeNull();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '33' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: /Next transformation/ }));
    expect(screen.getByRole('heading', { name: 'Add ten' })).toBeTruthy();
  });
  it('renders every counted object, including the previously omitted third bag', () => {
    render(<StructuredDiagram visual={{ kind: 'groups', counts: [4, 4, 4], itemLabel: 'apple' }} altText="Three groups of four apples" />);
    expect(screen.getByRole('img', { name: 'Three groups of four apples' })).toBeTruthy();
    const groups = screen.getAllByTestId('counted-group');
    expect(groups).toHaveLength(3);
    groups.forEach(group => expect(within(group).getAllByTestId('group-counter')).toHaveLength(4));
  });
  it('keeps the entire structured visual hidden until a step prediction is committed', () => {
    render(<StepContentRenderer content={{ type: 'diagram', visual: { kind: 'groups', counts: [3, 3], itemLabel: 'button' }, altText: 'Six buttons in two groups', imagePrompt: '', labels: [] }}
      challenge={{ prompt: 'How many buttons are in two groups of three?', acceptableAnswers: ['6'], rationale: 'Three plus three is six.' }} />);
    expect(screen.queryByRole('img')).toBeNull();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByRole('img', { name: 'Six buttons in two groups' })).toBeTruthy();
  });
  it('draws real number-line jumps and fraction partitions', () => {
    const { rerender } = render(<StructuredDiagram visual={{ kind: 'number-line', min: 0, max: 1, divisions: 10, start: 0, jumps: [0.4, 0.3] }} altText="Two jumps" />);
    expect(screen.getAllByTestId('number-line-jump')).toHaveLength(2);
    expect(screen.getAllByText('0.7').length).toBeGreaterThan(0);
    rerender(<StructuredDiagram visual={{ kind: 'fraction-bar', numerator: 4, denominator: 8 }} altText="Four eighths" />);
    expect(screen.getAllByTestId('filled-fraction-part')).toHaveLength(4);
    expect(screen.getAllByTestId('fraction-part')).toHaveLength(4);
    rerender(<StructuredDiagram visual={{ kind: 'number-line', min: 0, max: 1, divisions: 9, start: 0, jumps: [2 / 3] }} altText="Six ninths" />);
    expect(screen.getAllByText('6/9').length).toBeGreaterThan(0);
    expect(screen.queryByText('0.66666667')).toBeNull();
  });
});
