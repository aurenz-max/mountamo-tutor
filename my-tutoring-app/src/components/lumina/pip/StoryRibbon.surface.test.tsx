// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import StoryRibbon, { type StoryRibbonData } from '../primitives/visual-primitives/literacy/StoryRibbon';
import { STORY_RIBBON_FALLBACKS } from '../service/literacy/gemini-story-ribbon';

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
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

beforeEach(() => {
  Object.assign(phase, { tutorSpeaking: false, stage: 'asking', currentSolved: false, revealHeld: false, index: 0, cued: true, running: true });
});
afterEach(cleanup);

const data: StoryRibbonData = {
  title: 'Ribbons', description: '', gradeLevel: 'K', challengeType: 'tell_connected_account', instanceId: 'ribbon',
  challenges: STORY_RIBBON_FALLBACKS.slice(0, 3),
};

function mount() {
  const store = new PipSurfaceStore();
  const ui = () => <PipSurfaceContext.Provider value={store}><StoryRibbon data={data} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const update = (next: Partial<typeof phase>) => act(() => { Object.assign(phase, next); view.rerender(ui()); });
  return { ...view, store, update };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const cards = (container: HTMLElement) => Array.from(container.querySelectorAll('[data-pip-object^="card-"]')) as HTMLElement[];

describe('Story Ribbon drives Pip from its judged phases', () => {
  it('outlines the ribbon as a whole on the ask, never one card; watches the card the child moves', () => {
    const { store, update, container } = mount();
    expect(container.querySelector('[data-pip-dock="ribbon"]')).not.toBeNull();
    expect(cards(container)).toHaveLength(3);
    update({ tutorSpeaking: true });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'ribbon' });
    update({ tutorSpeaking: false });
    const [first, , third] = cards(container);
    const thirdId = third.getAttribute('data-pip-object');
    act(() => { fireEvent.click(first); });
    act(() => { fireEvent.click(third); });
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: thirdId });
    update({ stage: 'judging' });
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'look', targetId: thirdId });
  });

  it('never receives the spoken story; celebrates the held reveal; a new item drops the old touch; unregisters on unmount', () => {
    const { store, update, container, unmount } = mount();
    act(() => { fireEvent.click(cards(container)[1]); });
    update({ revealHeld: true });
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    update({ revealHeld: false, index: 1 });
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'ribbon' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
