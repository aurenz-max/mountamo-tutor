// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LuminaAnswerChoice,
  LuminaButton,
  LuminaChip,
  LuminaFillBlankSlot,
  LuminaModeTabs,
  LuminaProgress,
  LuminaScoreRing,
} from './index';

afterEach(cleanup);

describe('Lumina motion contract', () => {
  it('gives shared tappable controls the press interaction', () => {
    render(
      <>
        <LuminaButton>Continue</LuminaButton>
        <LuminaAnswerChoice state="idle">Option A</LuminaAnswerChoice>
        <LuminaChip>Word</LuminaChip>
        <LuminaModeTabs
          active="one"
          tabs={[{ value: 'one', label: 'One' }]}
          onSelect={vi.fn()}
        />
      </>
    );

    for (const control of screen.getAllByRole('button')) {
      expect(control.classList.contains('active:scale-95')).toBe(true);
    }
  });

  it('maps grading states to the shared pop and shake animations', () => {
    const { rerender } = render(
      <>
        <LuminaAnswerChoice state="correct">Correct choice</LuminaAnswerChoice>
        <LuminaChip state="incorrect">Wrong chip</LuminaChip>
        <LuminaFillBlankSlot data-testid="slot" state="correct" value="orbit" />
      </>
    );

    expect(screen.getByRole('button', { name: /correct choice/i }).classList.contains('motion-safe:animate-lumina-pop')).toBe(true);
    expect(screen.getByRole('button', { name: /wrong chip/i }).classList.contains('motion-safe:animate-lumina-shake')).toBe(true);
    expect(screen.getByTestId('slot').classList.contains('motion-safe:animate-lumina-pop')).toBe(true);

    rerender(<LuminaFillBlankSlot data-testid="slot" state="incorrect" value="orbit" />);
    expect(screen.getByTestId('slot').classList.contains('motion-safe:animate-lumina-shake')).toBe(true);
  });

  it('keeps progress motion behind prefers-reduced-motion guards', () => {
    render(
      <>
        <LuminaProgress data-testid="progress" value={60} />
        <LuminaScoreRing data-testid="score" score={80} />
      </>
    );

    const indicator = screen.getByTestId('progress').firstElementChild as HTMLElement;
    const scoreArc = screen.getByTestId('score').querySelectorAll('circle')[1];

    expect(indicator.classList.contains('motion-safe:transition-transform')).toBe(true);
    expect(scoreArc.classList.contains('motion-safe:transition-[stroke-dashoffset]')).toBe(true);
    expect(scoreArc.getAttribute('style')).toBeNull();
  });
});
