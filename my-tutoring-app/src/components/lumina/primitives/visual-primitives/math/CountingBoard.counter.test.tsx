// @vitest-environment jsdom
/**
 * Repro probe: does the per-object count badge land in the DOM after tapping,
 * given showLastNumber:true and a count_all board? Temporary diagnostic.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

// Neutralize side-effecting hooks/utilities that need a browser runtime.
vi.mock('../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false }),
}));
vi.mock('../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => () => {} }),
}));
vi.mock('../../../evaluation', async (orig) => {
  const actual = await orig() as Record<string, unknown>;
  return {
    ...actual,
    usePrimitiveEvaluation: () => ({
      submitResult: vi.fn(),
      hasSubmitted: false,
      submittedResult: null,
      elapsedMs: 0,
    }),
  };
});

import CountingBoard from './CountingBoard';

const board = {
  title: 'Test Bears',
  objects: { type: 'bears' as const },
  gradeBand: 'K' as const,
  showOptions: {
    showRunningCount: true,
    showGroupCircles: false,
    highlightOnTap: true,
    showLastNumber: true,
  },
  challenges: [
    {
      id: 'c1',
      type: 'count_all' as const,
      instruction: 'Count all the bears!',
      targetAnswer: 3,
      count: 3,
      arrangement: 'scattered' as const,
      hint: 'Touch each one.',
      narration: 'Count with me.',
    },
  ],
};

describe('CountingBoard per-object counter', () => {
  it('renders a numbered badge on each tapped object', () => {
    const { container } = render(<CountingBoard data={board} />);
    const objectGroups = Array.from(
      container.querySelectorAll('g.cursor-pointer')
    );
    console.log('[probe] object <g> count:', objectGroups.length);

    // Tap every object.
    objectGroups.forEach((g) => fireEvent.click(g));

    // Highlight rings (counted state) — gold stroke.
    const rings = container.querySelectorAll('circle[stroke="rgba(234,179,8,0.5)"]');
    console.log('[probe] gold highlight rings after tap:', rings.length);

    // Badge circles (gold fill).
    const badges = container.querySelectorAll('circle[fill="#eab308"]');
    console.log('[probe] gold badge circles after tap:', badges.length);

    // Collect all <text> contents.
    const texts = Array.from(container.querySelectorAll('text')).map((t) => t.textContent);
    console.log('[probe] all <text> contents:', JSON.stringify(texts));

    const numberBadges = texts.filter((t) => t && /^[0-9]+$/.test(t));
    console.log('[probe] numeric badge texts:', JSON.stringify(numberBadges));

    expect(numberBadges.length).toBeGreaterThan(0);
  });
});
