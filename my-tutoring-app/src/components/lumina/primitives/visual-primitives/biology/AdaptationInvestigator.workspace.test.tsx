// @vitest-environment jsdom
/**
 * Adaptation Investigator as an ungraded teaching surface (user ruling 2026-09-24): the real
 * registry component under a real LiveLessonRuntime, transport and rendering shell. What is its
 * own: cards start closed and open on a tap or the tutor's show, the tutor's ring is not learner
 * work, nothing is graded or submitted, and the learner's Done completes it. The generic contract
 * every binding owes runs in `workspaceContract.test.tsx`.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import AdaptationInvestigator, { type AdaptationInvestigatorData } from './AdaptationInvestigator';

const DATA: AdaptationInvestigatorData = {
  organism: 'Pink Flower',
  adaptation: { trait: 'Bright Pink Petals', type: 'structural', description: 'The petals are bright pink.',
    imagePrompt: 'A bright pink flower with a bee landing on it' },
  environment: { habitat: 'Sunny Meadow', description: 'Many plants grow here.', pressures: ['Many flowers compete for bees'] },
  connection: { explanation: 'Bright pink is easy for bees and butterflies to see.', evidencePoints: ['Bees visit bright flowers first'] },
  whatIfScenarios: [{ environmentChange: 'All the bees leave.', question: 'Would pink petals still help?',
    expectedReasoning: 'Less so.', adaptationStillUseful: false }],
  misconception: { commonBelief: 'Flowers are pink to look pretty for people.', correction: 'The color attracts pollinators.' },
  gradeBand: '2-4',
};
const data = DATA as unknown as Record<string, unknown>;

beforeEach(() => {
  installRuntimeTimers();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ imageUrl: 'data:image/png;base64,AA' }) })));
});
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const mount = () => mountWorkspace({ primitiveId: 'adaptation-investigator', evalMode: 'mixed', data });
const flush = () => act(async () => { await Promise.resolve(); });

describe('the teaching surface', () => {
  it('binds unpinned lesson content as mixed, and never a pinned mode', () => {
    expect(workspaceBinding({ instanceId: 'a', primitiveId: 'adaptation-investigator', pin: undefined, objectiveIds: ['o'], data }))
      .toMatchObject({ evalMode: 'mixed' });
    expect(workspaceBinding({ instanceId: 'a', primitiveId: 'adaptation-investigator', pin: 'explore', objectiveIds: ['o'], data })).toBeNull();
    expect(LIVE_ADAPTERS['adaptation-investigator'].guidance).toMatch(/Nothing on this screen is graded/);
    expect(LIVE_ADAPTERS['adaptation-investigator'].guidance).not.toMatch(/credit the learner/);
  });

  it('opens with closed cards, the picture drawing itself, no What If? and one tutor tool', async () => {
    const h = mount();
    await flush();
    expect(h.view.container.querySelectorAll('[aria-label^="Open The"]')).toHaveLength(3);
    expect(screen.queryByText('Bright pink is easy for bees and butterflies to see.')).toBeNull();
    expect(screen.queryByText(/What If/)).toBeNull();
    expect(h.view.container.querySelector('[data-pip-object="picture"] img')).toBeTruthy();
    const task = h.state().task!;
    expect(task.workspace).toMatchObject({ progression: 'learner', attempts: [], lastResponse: null });
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(task.demand).toMatchObject({ cardsOpen: 'none', picture: expect.stringMatching(/^drawn/) });
    // The tutor holds every card's content: it teaches from them before they open.
    expect(String(task.demand.connection)).toMatch(/easy for bees/);
    expect(h.tutorTools()).toEqual(['show']);
    expect(h.packet()?.learner?.signals).toMatchObject({ itemId: task.itemId, attempts: 0 });
    h.close();
  });

  it('opens and rings what the tutor shows, without making it learner work, and refuses an unknown target', async () => {
    const h = mount();
    h.dispatch('show', { targets: ['environment', 'nope'] });
    // Validated before anything changes: the known target did not open either.
    expect(h.state().task!.demand.cardsOpen).toBe('none');
    expect(h.view.container.querySelector('[data-tutor-ring]')).toBeNull();
    h.dispatch('show', { targets: ['environment', 'picture'] });
    expect(screen.getByText('Sunny Meadow')).toBeTruthy();
    expect(seam.send, 'a tutor show is not news to the tutor').not.toHaveBeenCalled();
    expect(h.view.container.querySelectorAll('[data-tutor-ring]')).toHaveLength(2);
    const task = h.state().task!;
    expect(task.workspace!.demonstration).toEqual(['environment', 'picture']);
    expect(task.evidence).toMatchObject({ attemptNumber: 0, correctness: 'unknown' });
    expect(task.demand.cardsOpen).toBe('environment');
    h.dispatch('show', { targets: [] });
    expect(h.view.container.querySelector('[data-tutor-ring]')).toBeNull();
    expect(screen.getByText('Sunny Meadow')).toBeTruthy();
    h.close();
  });

  it('completes on the learner\'s Done once every card is open, and submits nothing', () => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mount();
    h.touch('trait');
    expect(h.state().task!.demand.cardsOpen).toBe('trait');
    // A pre-reader cannot read what opened: the tutor hears it once, as host facts, never as learner words.
    expect(seam.send).toHaveBeenCalledTimes(1);
    expect(seam.send).toHaveBeenCalledWith(expect.stringMatching(/opened The Trait card/), expect.objectContaining({ author: 'host' }));
    h.touch('trait');
    expect(seam.send).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Done')).toBeNull();
    h.dispatch('show', { targets: ['misconception'] });
    expect(screen.getByText(/The color attracts pollinators/)).toBeTruthy();
    h.touch('environment'); h.touch('connection');
    h.press('Done');
    expect(h.state().status).toBe('completed');
    expect(h.state().task!.workspace!.attempts).toEqual([]);
    expect(seam.submit).not.toHaveBeenCalled();
    expect(screen.getByText(/You explored why the Pink Flower/)).toBeTruthy();
    h.close();
  });
});

describe('without the tutor', () => {
  it('keeps the standalone investigation: open panels, phases and no Done', () => {
    render(<AdaptationInvestigator data={DATA} />);
    expect(screen.getByText(/Step 1: Explore/)).toBeTruthy();
    expect(screen.getByText('Bright pink is easy for bees and butterflies to see.')).toBeTruthy();
    expect(screen.queryByText('Done')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
