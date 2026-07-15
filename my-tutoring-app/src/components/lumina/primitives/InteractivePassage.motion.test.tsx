// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InteractivePassageData } from '../types';

vi.mock('../utils/SoundManager', () => ({
  SoundManager: {
    playCorrect: vi.fn(),
    playIncorrect: vi.fn(),
    pop: vi.fn(),
  },
}));

import InteractivePassage from './InteractivePassage';

afterEach(cleanup);

const data: InteractivePassageData = {
  title: 'A Short Passage',
  sections: [
    {
      id: 'section-1',
      segments: [{ type: 'text', text: 'The moon travels around Earth.' }],
      inlineQuestion: {
        prompt: 'What does the moon travel around?',
        options: ['Mars', 'Earth', 'The Sun'],
        correctIndex: 1,
      },
    },
  ],
};

describe('InteractivePassage motion feedback', () => {
  it('uses the shared shake/pop grammar while keeping another attempt available', () => {
    render(<InteractivePassage data={data} />);

    const wrong = screen.getByRole('button', { name: /mars/i });
    fireEvent.click(wrong);
    expect(wrong.classList.contains('motion-safe:animate-lumina-shake')).toBe(true);

    const correct = screen.getByRole('button', { name: /earth/i });
    expect(correct.classList.contains('motion-safe:animate-lumina-pop')).toBe(true);
    expect(correct).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('button', { name: /the sun/i }));
    expect(screen.getByRole('button', { name: /the sun/i }).classList.contains('motion-safe:animate-lumina-shake')).toBe(true);
  });
});
