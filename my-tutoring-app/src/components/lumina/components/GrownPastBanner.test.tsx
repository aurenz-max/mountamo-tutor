// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import GrownPastBanner from './GrownPastBanner';

describe('GrownPastBanner', () => {
  it('tells the child which grades they grew past and what they learn now', () => {
    render(<GrownPastBanner audience="child" items={[
      { subject: 'Math', grade: 'Kindergarten', nowLearning: '2' },
      { subject: 'Math', grade: '1', nowLearning: '2' },
    ]} />);
    expect(screen.getByText('You grew past Kindergarten and Grade 1 math! Now you are learning Grade 2 math.')).toBeTruthy();
  });

  it('tells the parent in plain words', () => {
    render(<GrownPastBanner audience="parent" name="Ada" items={[{ subject: 'Math', grade: 'K', nowLearning: '1' }]} />);
    expect(screen.getByText('Ada has shown most of Kindergarten math and is now learning Grade 1 math.')).toBeTruthy();
  });

  it('renders nothing without a milestone', () => {
    const { container } = render(<GrownPastBanner audience="child" items={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
