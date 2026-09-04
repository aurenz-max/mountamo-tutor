// @vitest-environment jsdom

import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/SoundManager', () => ({
  SoundManager: {
    tap: vi.fn(),
    tick: vi.fn(),
    snap: vi.fn(),
  },
}));

vi.mock('../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: vi.fn(),
    hasSubmitted: false,
    submittedResult: null,
    elapsedMs: 0,
  }),
}));

const runner = {
  currentItem: {
    id: 'roll-1',
    challengeType: 'count_pips' as const,
    action: 'count_pips' as const,
    answerKind: 'voice' as const,
    responseClass: 'number_word_to_20' as const,
    sides: 6 as const,
    value: 4 as const,
    spokenAnswer: 'four',
    asrAliases: ['4'],
    supportTier: 'medium' as const,
  },
  currentIndex: 0,
  canAttempt: true,
  running: true,
  stage: 'asking' as const,
  revealHeld: false,
  summary: null,
};

vi.mock('../../../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: () => runner,
}));

vi.mock('../../../components/JudgedMicPanel', () => ({
  default: () => null,
}));

import { SoundManager } from '../../../utils/SoundManager';
import { DiDiceRoll, type DiDiceRollData } from './DiDiceRoll';

const data: DiDiceRollData = {
  title: 'Dice Time',
  description: 'Roll and say the number.',
  challenges: [runner.currentItem],
  challengeType: 'count_pips',
  instanceId: 'dice-sound-test',
};

const setReducedMotion = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches }),
  });
};

describe('DiDiceRoll sound choreography', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setReducedMotion(false);
    vi.mocked(SoundManager.tap).mockClear();
    vi.mocked(SoundManager.tick).mockClear();
    vi.mocked(SoundManager.snap).mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('plays one press, a four-beat rattle, and one settle for an animated roll', () => {
    render(<DiDiceRoll data={data} />);

    fireEvent.click(screen.getByRole('button', { name: 'Roll the die' }));
    expect(SoundManager.tap).toHaveBeenCalledTimes(1);
    expect(SoundManager.tick).not.toHaveBeenCalled();
    expect(SoundManager.snap).not.toHaveBeenCalled();

    act(() => { vi.runAllTimers(); });

    expect(SoundManager.tick).toHaveBeenCalledTimes(4);
    expect(SoundManager.snap).toHaveBeenCalledTimes(1);
  });

  it('lands immediately with press and settle feedback for reduced motion', () => {
    setReducedMotion(true);
    render(<DiDiceRoll data={data} />);

    fireEvent.click(screen.getByRole('button', { name: 'Roll the die' }));

    expect(SoundManager.tap).toHaveBeenCalledTimes(1);
    expect(SoundManager.tick).not.toHaveBeenCalled();
    expect(SoundManager.snap).toHaveBeenCalledTimes(1);
  });

  it('does not replay sounds when the settled die is pressed again', () => {
    setReducedMotion(true);
    render(<DiDiceRoll data={data} />);
    const die = screen.getByRole('button', { name: 'Roll the die' });

    fireEvent.click(die);
    fireEvent.click(die);

    expect(SoundManager.tap).toHaveBeenCalledTimes(1);
    expect(SoundManager.snap).toHaveBeenCalledTimes(1);
  });
});
