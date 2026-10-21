// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for life-cycle-sequencer — 15B / S13, on its bound workspace (the only path
 * since the boss, 2026-10-20).
 *
 * At K-2 the cards carried the image-GENERATION prompt as visible body text, the header carried a developer band
 * badge, the pool carried a live tally, the slots carried "Drop stage here", and placement was select-then-target —
 * two acts. Behaviors tsc cannot see: one tap places a card at K-2, and the chrome is gone at K-2 but kept at 3-5.
 * The voice beats (ORIENT, STAGE_PLACED, READ_ALOUD) went with the scripted path: the tutor reads the instruction and
 * every card aloud for a learner who cannot read (the shared rotation doctrine).
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../../components/live-activity/runtime/testing/workspaceHarness';
import type { LifeCycleSequencerData } from '../LifeCycleSequencer';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const mount = (data: LifeCycleSequencerData) => mountWorkspace({ primitiveId: 'life-cycle-sequencer', evalMode: 'sequence',
  instanceId: 'cycle', data: data as unknown as Record<string, unknown> });

const IMAGE_PROMPT = 'a female butterfly laying a tiny egg on a milkweed leaf';

const kData = (over: Partial<LifeCycleSequencerData> = {}): LifeCycleSequencerData => ({
  title: 'How a Butterfly Grows',
  instructions: 'Put the pictures in the order they really happen.',
  cycleType: 'linear',
  scaleContext: 'about 4 weeks from egg to butterfly',
  gradeBand: 'K-2',
  misconceptionTrap: {
    commonError: 'Students think the caterpillar sheds its skin to become a butterfly directly',
    correction: 'It forms a chrysalis first',
  },
  stages: [
    {
      id: 'egg', label: 'Egg', imagePrompt: IMAGE_PROMPT,
      description: 'A mama butterfly lays a tiny egg on a leaf.',
      correctPosition: 0, transitionToNext: 'The egg hatches', duration: '5 days',
    },
    {
      id: 'cat', label: 'Caterpillar', imagePrompt: 'a striped caterpillar eating a leaf',
      description: 'The caterpillar eats and eats and grows bigger.',
      correctPosition: 1, transitionToNext: 'It makes a chrysalis', duration: '2 weeks',
    },
    {
      id: 'chry', label: 'Chrysalis', imagePrompt: 'a green chrysalis hanging from a twig',
      description: 'It hangs very still inside a hard shell.',
      correctPosition: 2, transitionToNext: 'A butterfly comes out', duration: '10 days',
    },
  ],
  ...over,
});

const g4Data = () => kData({ gradeBand: '3-5' });

describe('LifeCycleSequencer reader-fit — band contract at PRE (K-2)', () => {
  it('places a card with ONE tap at K-2 — no select-then-target (rule 2)', () => {
    const h = mount(kData());
    // Before: 3 cards in the pool. Tap one; it goes straight into slot 1.
    fireEvent.click(screen.getByText('Chrysalis'));
    expect(String(h.state().task!.demand.learnerWork)).toMatch(/slot 1 "Chrysalis"/);
  });

  it('does NOT auto-place at 3-5 — that band keeps select-then-target', () => {
    const h = mount(g4Data());
    fireEvent.click(screen.getByText('Chrysalis'));
    expect(h.state().task!.demand.learnerWork).toBe('No stage placed yet');
  });

  it('never renders imagePrompt — it is an image-generation instruction', () => {
    const { container } = mount(kData()).view;
    expect(container.textContent).not.toContain(IMAGE_PROMPT);
    expect(container.textContent).not.toContain('a striped caterpillar eating a leaf');
  });

  it('does not render imagePrompt at 3-5 either — it was never student copy', () => {
    const { container } = mount(g4Data()).view;
    expect(container.textContent).not.toContain(IMAGE_PROMPT);
  });

  it('hides the developer band badge and the scale prose at K-2 (rule 7)', () => {
    mount(kData());
    expect(screen.queryByText('K-2')).toBeNull();
    expect(screen.queryByText(/about 4 weeks from egg to butterfly/)).toBeNull();
  });

  it('shows the band badge and scale context at 3-5', () => {
    mount(g4Data());
    expect(screen.getByText('3-5')).toBeTruthy();
    expect(screen.getByText(/about 4 weeks from egg to butterfly/)).toBeTruthy();
  });

  it('hides the "Available Cards (N)" tally at K-2', () => {
    mount(kData());
    expect(screen.queryByText(/Available Cards/i)).toBeNull();
  });

  it('hides the "Drop stage here" protocol text at K-2', () => {
    mount(kData());
    expect(screen.queryByText(/Drop stage here/i)).toBeNull();
    expect(screen.queryByText(/Tap or drop to place/i)).toBeNull();
  });

  it('shows the drop prompts at 3-5', () => {
    mount(g4Data());
    expect(screen.getAllByText(/Drop stage here/i).length).toBeGreaterThan(0);
  });
});
