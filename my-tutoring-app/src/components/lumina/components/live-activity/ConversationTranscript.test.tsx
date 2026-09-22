// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import ConversationTranscript, { transcriptTurns } from './ConversationTranscript';

afterEach(cleanup);

it('renders the reported streamed question once without changing the judge event feed', () => {
  const messages = Object.freeze([
    Object.freeze({ role: 'assistant' as const, streamId: 1, content: "Let's solve this" }),
    Object.freeze({ role: 'assistant' as const, streamId: 1, content: ' together. What is' }),
    Object.freeze({ role: 'assistant' as const, streamId: 1, content: ' eight minus three?' }),
    Object.freeze({ role: 'user' as const, streamId: 2, content: 'Yeah, is it four?' }),
  ]);
  const { container } = render(<ConversationTranscript messages={messages} />);
  expect(container.querySelectorAll('p')).toHaveLength(2);
  expect(screen.getByText(/Let's solve this together. What is eight minus three/)).toBeTruthy();
  expect(messages).toHaveLength(4);
  expect(messages[0].content).toBe("Let's solve this");
});

it('keeps separate tutor turns and typed messages separate, preserving split words and punctuation', () => {
  const turns = transcriptTurns([
    { role: 'assistant', streamId: 1, content: 'Sub' },
    { role: 'assistant', streamId: 1, content: 'tract three.' },
    { role: 'assistant', streamId: 2, content: 'What remains?' },
    { role: 'user', content: 'Hi.' },
    { role: 'user', content: 'Can you repeat that?' },
  ]);
  expect(turns.map(m => m.content)).toEqual(['Subtract three.', 'What remains?', 'Hi.', 'Can you repeat that?']);
});

it('hides a turn answering a scripted cue, so a dictated letter or word is heard and never read', () => {
  const messages = [
    { role: 'assistant' as const, streamId: 1, content: 'Nice work!' },
    { role: 'assistant' as const, streamId: 2, content: 'Write the uppercase letter S.', cue: true },
    { role: 'assistant' as const, streamId: 2, content: ' Uppercase S.', cue: true },
    { role: 'user' as const, streamId: 3, content: 'Done.' },
  ];
  render(<ConversationTranscript messages={messages} />);
  expect(screen.queryByText(/letter S|Uppercase S/)).toBeNull();
  expect(screen.getByText(/Nice work!/)).toBeTruthy();
  expect(screen.getByText(/Done\./)).toBeTruthy();
  expect(messages).toHaveLength(4);
});
