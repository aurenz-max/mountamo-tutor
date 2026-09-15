// @vitest-environment jsdom
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import { DiSpokenPractice } from '../primitives/visual-primitives/direct-instruction/DiSpokenPractice';
import type { SpokenPracticeItem } from '../primitives/visual-primitives/direct-instruction/diSpokenPracticeScript';

const phase = vi.hoisted(() => ({
  tutorSpeaking: false, stage: 'asking', currentSolved: false, revealHeld: false, running: true, index: 0, staleCue: false,
}));
vi.mock('../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: ({ pack }: { pack: { items: Array<{ id: string }> } }) => {
    const item = pack.items[phase.index] ?? null;
    return {
      currentItem: item, currentIndex: phase.index, ...phase,
      cuedItemId: phase.staleCue ? 'previous-item' : item?.id ?? null,
      canAttempt: phase.stage !== 'judging' && !phase.currentSolved, solvedIds: new Set(),
      preparing: false, summary: null, micState: 'armed', statusLine: '',
      start: vi.fn(), hearStimulus: vi.fn(), stimulusTapped: false, loop: {},
    };
  },
}));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0 }));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));

afterEach(cleanup);
beforeEach(() => {
  Object.assign(phase, { tutorSpeaking: false, stage: 'asking', currentSolved: false, revealHeld: false, running: true, index: 0, staleCue: false });
});

const base: SpokenPracticeItem = {
  id: 'dsp-1', mode: 'say_answer', action: 'say_answer', answerKind: 'voice',
  responseClass: 'short_spoken_word', stimulusKind: 'text', answerSource: 'recall',
  stimulusText: '2 + 1', stimulusEmoji: '', stimulusCount: 0,
  ask: 'What is two plus one?', howToPlay: 'Look, then say the answer.',
  expectedAnswer: 'three', alternates: [], acceptRule: '', signatureError: '', correctionBody: 'Two plus one is three.',
};
const pair: SpokenPracticeItem = {
  ...base, id: 'dsp-2', mode: 'compare_choice', action: 'compare_choice', stimulusKind: 'pair',
  stimulusText: 'elephant', stimulusEmoji: '🐘', stimulusText2: 'mouse', stimulusEmoji2: '🐭',
  choices: ['bigger', 'smaller'], ask: 'Is the elephant bigger or smaller than the mouse?', expectedAnswer: 'bigger',
};
const listen: SpokenPracticeItem = {
  ...base, id: 'dsp-3', stimulusKind: 'none', stimulusText: 'cat without the c', ask: 'Say cat without the c.', expectedAnswer: 'at',
};

function mount(items: SpokenPracticeItem[]) {
  const store = new PipSurfaceStore();
  store.setActive('practice');
  const ui = () => (
    <PipSurfaceContext.Provider value={store}>
      <DiSpokenPractice data={{ title: 'Say it', description: '', challengeType: items[0].mode, items, instanceId: 'practice' }} />
    </PipSurfaceContext.Provider>
  );
  const view = render(ui());
  const update = (next: Partial<typeof phase>) => { Object.assign(phase, next); view.rerender(ui()); };
  return { store, update, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;

describe('DI Spoken Practice drives Pip from its judged phases', () => {
  it('outlines the stimulus on the cue, watches it while judged, celebrates the affirmed item', () => {
    const { store, update, container } = mount([base, pair]);
    expect(container.querySelector('[data-pip-dock="practice"]')).not.toBeNull();
    update({ tutorSpeaking: true });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'stimulus' });
    update({ tutorSpeaking: false, stage: 'judging' });
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'look', targetId: 'stimulus' });
    update({ stage: 'asking', revealHeld: true });
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('compare_choice: the pair panel as a whole, never one picture', () => {
    phase.tutorSpeaking = true;
    const { store } = mount([pair]);
    expect(store.getActive()?.targets.map((t) => t.id)).toEqual(['stimulus']);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'stimulus' });
    expect(store.getActive()?.targets[0].element.querySelectorAll('[role="img"]')).toHaveLength(2);
  });

  it('listen-only: nothing is printed, so Pip does not point', () => {
    const { store, update } = mount([listen]);
    update({ tutorSpeaking: true });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'none' });
    update({ tutorSpeaking: false, stage: 'judging' });
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'none' });
  });

  it('stays neutral before start and over a cue for another item; unregisters on unmount', () => {
    phase.running = false;
    const { store, update, unmount } = mount([base]);
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    update({ running: true, tutorSpeaking: true, staleCue: true });
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
