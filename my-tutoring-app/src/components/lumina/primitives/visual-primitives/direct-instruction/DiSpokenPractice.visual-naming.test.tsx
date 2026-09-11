// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SpokenPracticeItem } from './diSpokenPracticeScript';

const { hearStimulus } = vi.hoisted(() => ({ hearStimulus: vi.fn() }));
vi.mock('../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, elapsedMs: 0 }),
}));
vi.mock('../../../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: ({ pack }: { pack: { items: SpokenPracticeItem[] } }) => ({
    currentItem: pack.items[0], currentIndex: 0, stage: 'asking', running: true, hearStimulus,
  }),
}));
vi.mock('../../../components/JudgedMicPanel', () => ({ default: () => null }));

import { DiSpokenPractice } from './DiSpokenPractice';

const naming: SpokenPracticeItem = {
  id: 'dsp-equal', mode: 'say_answer', action: 'say_answer', answerKind: 'voice',
  responseClass: 'short_spoken_word', stimulusRole: 'visual_target', stimulusKind: 'text',
  answerSource: 'recall', stimulusText: '=', stimulusEmoji: '', stimulusCount: 0,
  ask: 'What is this called?', howToPlay: 'Look, then say its name.',
  expectedAnswer: 'equal sign', alternates: ['equals'], acceptRule: '', signatureError: '',
  correctionBody: 'This is called equal sign.',
};
const mount = (item: SpokenPracticeItem) => render(<DiSpokenPractice data={{
  title: 'Say It Out Loud', description: 'Look, then answer out loud!',
  challengeType: item.mode, items: [item], instanceId: 'visual-naming-test',
}} />);
afterEach(() => { cleanup(); hearStimulus.mockClear(); });

describe('visual naming reaches the displayed stimulus and affordances', () => {
  it('prints the exact symbol, hides its answer, and offers no pronunciation shortcut', () => {
    mount(naming);
    expect(screen.getByText('=')).toBeTruthy();
    expect(screen.getByText('What is this called?')).toBeTruthy();
    expect(screen.queryByText('equal sign')).toBeNull();
    expect(screen.queryByRole('button', { name: /Hear it/ })).toBeNull();
  });

  it('renders a picture instead of printing its identifying label', () => {
    mount({ ...naming, stimulusKind: 'emoji', stimulusText: 'cat', stimulusEmoji: '🐈', expectedAnswer: 'cat' });
    expect(screen.getByRole('img', { name: 'picture clue' }).textContent).toBe('🐈');
    expect(screen.queryByText('cat')).toBeNull();
    expect(screen.queryByRole('button', { name: /Hear it/ })).toBeNull();
  });

  it('shows only the listening surface after an answer-depicting riddle picture is removed', () => {
    mount({
      ...naming,
      stimulusRole: undefined,
      stimulusKind: 'none',
      stimulusText: 'I have four legs and bark. What animal am I?',
      stimulusEmoji: '',
      expectedAnswer: 'dog',
    });
    expect(screen.getByText('listen')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByText('dog')).toBeNull();
  });

  it('preserves tap-to-hear for an ordinary spoken arithmetic problem', () => {
    mount({ ...naming, stimulusRole: undefined, stimulusText: '2 + 1', expectedAnswer: 'three' });
    fireEvent.click(screen.getByRole('button', { name: /Hear it/ }));
    expect(hearStimulus).toHaveBeenCalledTimes(1);
  });
});
