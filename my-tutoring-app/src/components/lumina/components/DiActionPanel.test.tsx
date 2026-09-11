// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { DiActionContract } from '../hooks/judgedScriptContract';
import type { JudgedRunSurface } from './JudgedMicPanel';

vi.mock('./JudgedMicPanel', () => ({
  default: () => <div data-testid="mic-panel" />,
}));

import DiActionPanel, { type DiActionItem } from './DiActionPanel';

const action = (
  id: string,
  answerKind: DiActionContract['answerKind'],
  label: string,
): DiActionItem => ({
  id,
  answerKind,
  actionContract: {
    id,
    label,
    icon: id,
    answerKind,
    instruction: answerKind === 'gesture' ? 'Drag every card into place.' : 'Say the answer aloud.',
    checkingInstruction: answerKind === 'gesture' ? 'Checking the cards.' : 'Listening for the answer.',
  },
});

const hands = action('build', 'gesture', 'Build it');
const voice = action('say', 'voice', 'Say it');
const run = {
  micState: 'armed',
  statusLine: 'Your turn.',
  start: vi.fn(),
  cancelListening: undefined,
  currentItem: hands,
} as unknown as JudgedRunSurface;

afterEach(cleanup);

describe('DiActionPanel', () => {
  it('shows one start control before a hands-first run', () => {
    render(
      <DiActionPanel
        run={run}
        running={false}
        stage="idle"
        currentItem={hands}
        steps={[hands, voice]}
      />,
    );
    expect(screen.getByText('Tap start, then listen for the first step.')).toBeTruthy();
    expect(screen.getByTestId('mic-panel')).toBeTruthy();
  });

  it('shows the exact action instruction and hides the mic during hands work', () => {
    render(
      <DiActionPanel
        run={run}
        running
        stage="asking"
        currentItem={hands}
        steps={[hands, voice]}
      />,
    );
    expect(screen.getByText(hands.actionContract.instruction)).toBeTruthy();
    expect(screen.queryByTestId('mic-panel')).toBeNull();
    expect(screen.getByText('Build it').closest('li')?.getAttribute('aria-current')).toBe('step');
    expect(screen.getByText('Build it').closest('li')?.getAttribute('data-state')).toBe('current');
  });

  it('shows the mic during voice work and marks the completed step', () => {
    render(
      <DiActionPanel
        run={{ ...run, currentItem: voice } as unknown as JudgedRunSurface}
        running
        stage="asking"
        currentItem={voice}
        steps={[hands, voice]}
        completedIds={new Set([hands.id])}
      />,
    );
    expect(screen.getByTestId('mic-panel')).toBeTruthy();
    expect(screen.getByText(voice.actionContract.instruction)).toBeTruthy();
    expect(screen.getByText('Build it').closest('li')?.getAttribute('data-state')).toBe('complete');
    expect(screen.getByText('Say it').closest('li')?.getAttribute('aria-current')).toBe('step');
  });

  it('uses action-owned judging copy instead of claiming every step is listening', () => {
    render(
      <DiActionPanel
        run={run}
        running
        stage="judging"
        currentItem={hands}
        steps={[hands, voice]}
      />,
    );
    expect(screen.getByText('Checking the cards.')).toBeTruthy();
    expect(screen.queryByTestId('mic-panel')).toBeNull();
  });

  it('supports legacy manual-loop primitives through the same action surface', () => {
    render(
      <DiActionPanel
        running
        stage="asking"
        currentItem={voice}
        steps={[voice]}
        micState="armed"
        statusLine="Your turn."
        onStart={vi.fn()}
      />,
    );
    expect(screen.getByText(voice.actionContract.instruction)).toBeTruthy();
    expect(screen.getByTestId('mic-panel')).toBeTruthy();
  });
});
