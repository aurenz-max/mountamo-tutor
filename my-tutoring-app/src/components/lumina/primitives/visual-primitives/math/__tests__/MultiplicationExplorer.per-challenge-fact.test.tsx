// @vitest-environment jsdom
/**
 * The split-brain regression — multiplication-explorer, 2026-08-10.
 *
 * Behaviour tsc cannot see: WHICH fact each representation panel draws.
 *
 * A 2026-07-07 fix moved grading and the headline equation onto the per-challenge
 * fact but left every representation panel rendering the shared `data.fact`. With
 * per-challenge facts that meant a student saw one equation, a picture of a
 * DIFFERENT fact, and was graded on the first. It stayed invisible only because
 * the generator forced every challenge onto one fact — which is what made a
 * session "3 × 4 asked five ways".
 *
 * These assert the panels follow the ACTIVE challenge. The session `data.fact` is
 * deliberately set to a fact NO challenge uses, so anything still reading it shows
 * up immediately.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../../components/live-activity/runtime/testing/workspaceHarness';
import type { MultiplicationExplorerData } from '../MultiplicationExplorer';

beforeEach(() => { installRuntimeTimers(); });
const mounted: WorkspaceHarness[] = [];
afterEach(() => { mounted.splice(0).forEach(h => h.close()); cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

/** A fact no challenge uses — a canary for anything still reading data.fact. */
const CANARY = { factor1: 9, factor2: 9, product: 81 };

/** Mounted the way a lesson mounts it: on the teaching workspace. */
const mount = (data: MultiplicationExplorerData) => {
  const h = mountWorkspace({ primitiveId: 'multiplication-explorer', evalMode: 'build', instanceId: 'multiply', data: data as never });
  mounted.push(h);
  return h;
};

const makeData = (
  overrides: Partial<MultiplicationExplorerData> = {},
): MultiplicationExplorerData => ({
  title: 'Sticker Packs',
  description: 'Explore multiplication.',
  fact: CANARY,
  representations: {
    equalGroups: true, array: true, repeatedAddition: true,
    numberLine: false, areaModel: false,
  },
  activeRepresentation: 'array',
  gradeBand: '2-3',
  showOptions: {
    showProduct: false, showFactFamily: false,
    showCommutativeFlip: false, showDistributiveBreakdown: false,
  },
  imagePrompt: null,
  challenges: [
    {
      id: 'c1', type: 'build',
      instruction: 'Build 3 packs with 4 in each. How many in total?',
      targetFact: '3 × 4 = 12', fact: { factor1: 3, factor2: 4 },
      representation: 'array', hiddenValue: 'product', timeLimit: null,
      hint: 'Skip-count by 4.', narration: 'Build it!',
    },
    {
      id: 'c2', type: 'build',
      instruction: 'Build 6 packs with 7 in each. How many in total?',
      targetFact: '6 × 7 = 42', fact: { factor1: 6, factor2: 7 },
      representation: 'groups', hiddenValue: 'product', timeLimit: null,
      hint: 'Skip-count by 7.', narration: 'Next!',
    },
  ],
  ...overrides,
});

describe('representations follow the ACTIVE challenge, not the session fact', () => {
  it('draws the first challenge\'s fact — not data.fact', () => {
    mount(makeData());
    // The array panel labels itself "R rows × C columns".
    expect(screen.getByText(/3 rows/i)).toBeTruthy();
    expect(screen.getByText(/4 columns/i)).toBeTruthy();
    // The canary must appear nowhere.
    expect(screen.queryByText(/9 rows/i)).toBeNull();
  });

  it('renders the headline equation for the active challenge', () => {
    const { container } = mount(makeData()).view;
    expect(container.textContent).toContain('3 × 4');
    expect(container.textContent).not.toContain('9 × 9');
  });

  it('honors the per-challenge modality — an array challenge opens on the array tab', () => {
    mount(makeData());
    // The array panel's own label is present because that tab is selected.
    expect(screen.getByText(/3 rows/i)).toBeTruthy();
  });

  it('falls back to parsing targetFact when the structured fact is absent (pre-redesign data)', () => {
    const data = makeData();
    // Old-shape challenge: targetFact prose only, no structured fact.
    delete (data.challenges[0] as { fact?: unknown }).fact;
    mount(data);
    expect(screen.getByText(/3 rows/i)).toBeTruthy();
    expect(screen.queryByText(/9 rows/i)).toBeNull();
  });

  it('falls back to the session fact only when the challenge carries neither', () => {
    const data = makeData();
    delete (data.challenges[0] as { fact?: unknown }).fact;
    data.challenges[0].targetFact = '';
    mount(data);
    // Now — and only now — the session fact is the honest source.
    expect(screen.getByText(/9 rows/i)).toBeTruthy();
  });
});
