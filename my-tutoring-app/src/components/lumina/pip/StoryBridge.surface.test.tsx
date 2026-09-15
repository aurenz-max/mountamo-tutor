// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import StoryBridge, { type StoryBridgeData } from '../primitives/visual-primitives/literacy/StoryBridge';
import { itemsFromChallenges } from '../primitives/visual-primitives/literacy/storyBridgeScript';
import { FALLBACK_PAIR, challengesFromPair } from '../service/literacy/gemini-story-bridge';

const phase = vi.hoisted(() => ({
  tutorSpeaking: false, stage: 'asking', currentSolved: false, revealHeld: false, index: 0, cued: true,
  retry: () => {}, submit: vi.fn(),
}));
vi.mock('../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: ({ pack, onCorrectionRetry }: { pack: { items: Array<{ id: string }> }; onCorrectionRetry?: (item: unknown) => void }) => {
    const item = pack.items[phase.index] ?? null;
    phase.retry = () => onCorrectionRetry?.(item);
    return {
      currentItem: item, currentIndex: phase.index, stage: phase.stage, tutorSpeaking: phase.tutorSpeaking,
      currentSolved: phase.currentSolved, revealHeld: phase.revealHeld, cuedItemId: phase.cued ? item?.id ?? null : 'elsewhere',
      canAttempt: phase.stage !== 'judging' && !phase.currentSolved, solvedIds: new Set(),
      running: true, preparing: false, summary: null, stimulusTapped: false, hearStimulus: vi.fn(),
      isAwaitingGesture: () => false, submitGestureAttempt: phase.submit,
    };
  },
}));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../components/JudgedMicPanel', () => ({ default: () => null }));

beforeEach(() => {
  Object.assign(phase, { tutorSpeaking: false, stage: 'asking', currentSolved: false, revealHeld: false, index: 0, cued: true });
  phase.submit.mockClear();
});
afterEach(cleanup);

const stories = [FALLBACK_PAIR.a, FALLBACK_PAIR.b];
const challenges = challengesFromPair(FALLBACK_PAIR, 0, 0, ['match_character', 'match_setting', 'venn_place', 'sequence_two', 'say_alike']);
const data: StoryBridgeData = { title: 'Two stories', description: '', gradeLevel: 'K', challengeType: 'mixed', stories, challenges, instanceId: 'bridge' };
const items = itemsFromChallenges(challenges, stories);
const indexOf = (mode: string) => {
  const index = items.findIndex((item) => item.mode === mode);
  if (index < 0) throw new Error(`fixture has no ${mode} item`);
  return index;
};

function mount() {
  const store = new PipSurfaceStore();
  const ui = () => <PipSurfaceContext.Provider value={store}><StoryBridge data={data} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const update = (next: Partial<typeof phase>) => act(() => { Object.assign(phase, next); view.rerender(ui()); });
  return { ...view, store, update };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;

describe('Story Bridge drives Pip from its judged phases', () => {
  it('a character match points at the ringed friend, never a choice; watches the tapped choice while judged', () => {
    const { store, update, container } = mount();
    update({ index: indexOf('match_character'), tutorSpeaking: true });
    expect(container.querySelector('[data-pip-dock="bridge"]')).not.toBeNull();
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'anchor' });
    update({ tutorSpeaking: false });
    const choice = container.querySelector('[data-pip-object^="choice-"]') as HTMLElement;
    act(() => { fireEvent.click(choice); });
    expect(phase.submit).toHaveBeenCalledTimes(1);
    update({ stage: 'judging' });
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'look', targetId: choice.getAttribute('data-pip-object') });
    update({ stage: 'asking' });
    act(() => { phase.retry(); });
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'anchor' });
  });

  it('points at the marked question side — the Venn detail, story one’s event — and both stories otherwise', () => {
    const { store, update } = mount();
    update({ index: indexOf('venn_place'), tutorSpeaking: true });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'detail' });
    update({ index: indexOf('sequence_two') });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'event' });
    update({ index: indexOf('match_setting') });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'stories' });
    update({ index: indexOf('say_alike') });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'stories' });
    update({ tutorSpeaking: false, revealHeld: true });
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('with the ringed friend in the second story, outlines both stories so no connector runs past the choices', () => {
    const flipped = challengesFromPair(FALLBACK_PAIR, 0, 1, ['match_character']);
    const flippedItems = itemsFromChallenges(flipped, stories);
    expect(flippedItems[0].anchorStory.id).not.toBe(flippedItems[0].storyA.id);
    const store = new PipSurfaceStore();
    const flippedData = { ...data, challenges: flipped };
    const ui = () => <PipSurfaceContext.Provider value={store}><StoryBridge data={flippedData} /></PipSurfaceContext.Provider>;
    const view = render(ui());
    act(() => { Object.assign(phase, { index: 0, tutorSpeaking: true }); view.rerender(ui()); });
    expect(store.getActive()?.targets.map((t) => t.id)).toContain('anchor');
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'stories' });
  });

  it('unregisters on unmount', () => {
    const { store, unmount } = mount();
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
