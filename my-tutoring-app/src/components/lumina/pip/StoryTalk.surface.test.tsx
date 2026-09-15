// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import StoryTalk, { type StoryTalkData } from '../primitives/visual-primitives/literacy/StoryTalk';

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
      isAwaitingGesture: () => false, submitGestureAttempt: vi.fn(),
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

const data: StoryTalkData = {
  title: 'Stories', description: '', challengeType: 'who_what_where', gradeLevel: 'K', instanceId: 'story',
  challenges: [
    { id: 'st1', type: 'who_what_where', storyTitle: 'The Big Oak', question: 'Who hid the acorn?', answer: 'milo', answerEmoji: '🐿️',
      story: 'Milo found a big acorn by the fence. He dug a hole under the oak tree. He pushed the acorn deep inside. Then he ran off to play.',
      options: [{ word: 'milo', emoji: '🐿️' }, { word: 'rabbit', emoji: '🐇' }, { word: 'badger', emoji: '🦡' }, { word: 'mouse', emoji: '🐭' }] },
    { id: 'st2', type: 'who_what_where', storyTitle: 'Rainy Boots', question: 'What did Nina jump in?', answer: 'puddles', answerEmoji: '💧',
      story: 'Nina pulled on her red boots. The rain had left big puddles by the gate. She jumped in every one of them. Her socks stayed dry the whole time.',
      options: [{ word: 'puddles', emoji: '💧' }, { word: 'leaves', emoji: '🍂' }, { word: 'grass', emoji: '🌿' }, { word: 'sand', emoji: '🏖️' }] },
  ],
};

function mount() {
  const store = new PipSurfaceStore();
  const ui = () => <PipSurfaceContext.Provider value={store}><StoryTalk data={data} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const update = (next: Partial<typeof phase>) => act(() => { Object.assign(phase, next); view.rerender(ui()); });
  return { store, update, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;

describe('Story Talk drives Pip from its judged phases', () => {
  it('points at the listening card while the story is read; idle before start and over the previous praise', () => {
    const { store, update, container } = mount();
    expect(container.querySelector('[data-pip-dock="story"]')).not.toBeNull();
    expect(store.getActive()?.targets.map((t) => t.id)).toEqual(['card']);
    update({ running: false });
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    update({ running: true, tutorSpeaking: true });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'card' });
    update({ index: 1, cued: false });
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    update({ tutorSpeaking: false, cued: true, stage: 'judging' });
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'look', targetId: 'card' });
  });

  it('celebrates only the affirmed answer and unregisters on unmount', () => {
    const { store, update, unmount } = mount();
    update({ currentSolved: true });
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
