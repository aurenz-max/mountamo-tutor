// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RichAnnotatedExampleData } from './annotated-example/types';

vi.mock('./annotated-example/StepContentRenderer', () => ({
  KaTeX: ({ latex }: { latex: string }) => <span>{latex}</span>,
  MixedContent: ({ text }: { text: string }) => <span>{text}</span>,
  StepTypeIcon: () => null,
  StepContentRenderer: ({ challenge, onCompletionChange }: { challenge?: unknown; onCompletionChange?: (v: boolean) => void }) => {
    const [answered, setAnswered] = React.useState(false);
    return <button onClick={() => { setAnswered(true); onCompletionChange?.(true); }}>{answered ? 'Answer saved' : challenge ? 'Answer question' : 'Read step'}</button>;
  },
}));
vi.mock('./problem-primitives/insets/InsetRenderer', () => ({
  isGateableInset: (inset: unknown) => Boolean(inset),
  InsetRenderer: ({ onCompletionChange }: { onCompletionChange?: (v: boolean) => void }) => <button onClick={() => onCompletionChange?.(true)}>Answer inset</button>,
}));
import { AnnotatedExample } from './AnnotatedExample';
afterEach(cleanup);
const example = (): RichAnnotatedExampleData => ({
  title: 'Three bags of apples', subject: 'Math', solutionStrategy: '', problem: { statement: 'How many apples?' },
  steps: [1, 2].map((id) => ({ id, title: `Apple step ${id}`, content: { type: 'table', caption: 'Apples', headers: ['Bag'], rows: [['4']] },
    annotations: { steps: 'Extra explanation', strategy: '', misconceptions: '', connections: '' },
    ...(id === 1 ? { challenge: { prompt: 'How many?', acceptableAnswers: ['12'], distractors: [], rationale: 'Three fours.' } } : {}),
  })),
});
describe('focused annotated example', () => {
  it('gates the next step and explanations, and preserves answers when going back', () => {
    render(<AnnotatedExample data={example()} />);
    expect(screen.queryByRole('heading', { name: 'Apple step 2' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Next step' }).hasAttribute('disabled')).toBe(true);
    expect(screen.queryByText('Help me understand')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Answer question' }));
    expect(screen.getByText('Help me understand')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    expect(screen.queryByRole('heading', { name: 'Apple step 1' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Apple step 2' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: 'Answer saved' })).toBeTruthy();
  });
  it('resets the walkthrough for a replacement example', () => {
    const { rerender } = render(<AnnotatedExample data={example()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Answer question' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    rerender(<AnnotatedExample data={{ ...example(), title: 'New problem' }} />);
    expect(screen.getByRole('heading', { name: 'Your turn' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next step' }).hasAttribute('disabled')).toBe(true);
  });
  it('keeps all work hidden until a gated inset is answered', () => {
    const data = example();
    data.problem.inset = { insetType: 'equation-setup' } as NonNullable<typeof data.problem.inset>;
    render(<AnnotatedExample data={data} />);
    expect(screen.queryByRole('heading', { name: 'Apple step 1' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Answer inset' }));
    expect(screen.getByRole('heading', { name: 'Your turn' })).toBeTruthy();
  });
});
