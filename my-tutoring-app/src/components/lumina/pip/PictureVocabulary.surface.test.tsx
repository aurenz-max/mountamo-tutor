// @vitest-environment jsdom
// Picture vocabulary runs only on the teaching workspace, so Pip is exercised there: the runtime owns progression.
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { PipSurfaceStore } from './PipSurfaceStore';
import { installRuntimeTimers, restoreRuntimeTimers } from '../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../components/live-activity/runtime/testing/workspaceHarness';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const data = {
  title: 'Words', description: '', challengeType: 'receptive_match', gradeLevel: 'K',
  challenges: [
    { id: 'pv-1', type: 'receptive_match', word: 'dog', emoji: '🐶',
      options: [{ word: 'dog', emoji: '🐶' }, { word: 'sun', emoji: '☀️' }, { word: 'cup', emoji: '☕' }, { word: 'bus', emoji: '🚌' }] },
    { id: 'pv-3', type: 'opposite', word: 'small', emoji: '🐭', baseWord: 'big', baseEmoji: '🐘' },
    { id: 'pv-5', type: 'gradable_scale', word: 'cool', emoji: '🌡️', scaleWords: ['freezing', 'cold', 'cool', 'warm', 'hot'], scaleTargetIndex: 2 },
    { id: 'pv-6', type: 'sentence_frame', word: 'bed', emoji: '🛏️', frameDisplay: 'We sleep in a ____ at night.' },
  ],
};

function mount() {
  const store = new PipSurfaceStore();
  store.setActive('vocab');
  const h = mountWorkspace({ primitiveId: 'picture-vocabulary', evalMode: 'mixed', data, instanceId: 'vocab', pipStore: store });
  const container = h.view.container;
  const tap = (id: string) => act(() => { fireEvent.click(container.querySelector(`[data-pip-object="${id}"]`) as HTMLElement); });
  return { ...h, store, container, tap, unmount: h.view.unmount };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const ids = (store: PipSurfaceStore) => store.getActive()?.targets.map((t) => t.id);

describe('Picture Vocabulary drives Pip from the workspace', () => {
  it('receptive match outlines the cards as a group, watches the checked card, and Try again frees it', () => {
    const { store, speak, tap, dispatch, confirmVisible, container } = mount();
    expect(container.querySelector('[data-pip-dock="vocab"]')).not.toBeNull();
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'cards' });
    speak(false);
    tap('card-sun');
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'look', targetId: 'card-sun' });
    dispatch('retry'); confirmVisible();
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'cards' });
  });

  it('spoken modes point at the stimulus card and publish no answer surface; unregisters on unmount', () => {
    const { store, speak, tap, dispatch, confirmVisible, say, feedback, unmount } = mount();
    tap('card-dog'); dispatch('advance'); confirmVisible();
    for (const answer of ['small', 'cool']) {
      speak(true);
      expect(ids(store)).toEqual(['stimulus']);
      expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'stimulus' });
      speak(false);
      say(answer); feedback('correct', 'advance'); confirmVisible();
    }
    expect(ids(store)).toEqual(['stimulus']);
    say('bed'); feedback('correct');
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
