// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import YouAndMe, { type YouAndMeData } from '../primitives/visual-primitives/literacy/YouAndMe';

const phase = vi.hoisted(() => ({
  tutorSpeaking: false, stage: 'asking', currentSolved: false, revealHeld: false, index: 0, cued: true, running: true,
}));
vi.mock('../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: ({ pack }: { pack: { items: Array<{ id: string }> } }) => {
    const item = pack.items[phase.index] ?? null;
    return {
      currentItem: item, currentIndex: phase.index, stage: phase.stage, tutorSpeaking: phase.tutorSpeaking,
      currentSolved: phase.currentSolved, revealHeld: phase.revealHeld, cuedItemId: phase.cued ? item?.id ?? null : 'elsewhere',
      canAttempt: phase.stage !== 'judging' && !phase.currentSolved, solvedIds: new Set(),
      running: phase.running, preparing: false, summary: null, stimulusTapped: false, hearStimulus: vi.fn(),
    };
  },
}));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../components/JudgedMicPanel', () => ({ default: () => null }));

beforeEach(() => {
  Object.assign(phase, { tutorSpeaking: false, stage: 'asking', currentSolved: false, revealHeld: false, index: 0, cued: true, running: true });
});
afterEach(cleanup);

const scene = {
  sceneId: 'bag', type: 'describe_action' as const,
  participants: [{ name: 'Maya', emoji: '👧' }, { name: 'Leo', emoji: '👦' }] as YouAndMeData['challenges'][number]['participants'],
  actor: 0 as const, object: 'bag', objectEmoji: '🎒', action: 'packed the bag',
};
const data: YouAndMeData = {
  title: 'You & Me', description: 'Trade roles', gradeLevel: 'K', challengeType: 'describe_action', instanceId: 'pair',
  challenges: [{ ...scene, id: 'bag-a', speaker: 0 }, { ...scene, id: 'bag-b', speaker: 1 }],
};

function mount() {
  const store = new PipSurfaceStore();
  const ui = () => <PipSurfaceContext.Provider value={store}><YouAndMe data={data} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const update = (next: Partial<typeof phase>) => act(() => { Object.assign(phase, next); view.rerender(ui()); });
  return { ...view, store, update };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;

describe('You & Me drives Pip from its judged phases', () => {
  it('outlines the whole scene, never one partner; idle before start and over the previous praise', () => {
    const { store, update, container } = mount();
    expect(container.querySelector('[data-pip-dock="pair"]')).not.toBeNull();
    expect(store.getActive()?.targets.map((t) => t.id)).toEqual(['scene']);
    update({ running: false });
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    update({ running: true, tutorSpeaking: true });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'scene' });
    update({ index: 1, cued: false });
    expect(store.getActive()?.scopeId).toContain('bag-b');
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    update({ tutorSpeaking: false, cued: true, stage: 'judging' });
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'look', targetId: 'scene' });
  });

  it('celebrates only the affirmed sentence and unregisters on unmount', () => {
    const { store, update, unmount } = mount();
    update({ revealHeld: true });
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
