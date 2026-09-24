// @vitest-environment jsdom
// Rhyme studio runs only on the teaching workspace, so Pip is exercised there: the runtime owns progression.
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { PipSurfaceStore } from './PipSurfaceStore';
import { installRuntimeTimers, restoreRuntimeTimers } from '../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../components/live-activity/runtime/testing/workspaceHarness';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const DATA = {
  title: 'Rhyme Time', gradeLevel: 'K',
  challenges: [
    { id: 'rec', mode: 'recognition', targetWord: 'cat', targetWordImage: 'a cat', targetWordEmoji: '🐱', rhymeFamily: '-at',
      comparisonWord: 'bat', comparisonWordImage: 'a bat', comparisonWordEmoji: '🦇', doesRhyme: true },
    { id: 'idf', mode: 'identification', targetWord: 'sun', targetWordImage: 'the sun', targetWordEmoji: '☀️', rhymeFamily: '-un',
      options: [{ word: 'bun', image: '🍞', isCorrect: true }, { word: 'dog', image: '🐶', isCorrect: false }] },
    { id: 'col', mode: 'collection', targetWord: 'hat', targetWordImage: 'a hat', rhymeFamily: '-at' },
  ],
};

function mount() {
  const store = new PipSurfaceStore();
  store.setActive('rhyme');
  const h = mountWorkspace({ primitiveId: 'rhyme-studio', evalMode: 'mixed', data: DATA, instanceId: 'rhyme', pipStore: store });
  /** Credit the pending answer and move on to the next item. */
  const next = (answer: string) => { h.say(answer); h.feedback('correct', 'advance'); h.confirmVisible(); };
  return { ...h, store, next, container: h.view.container, unmount: h.view.unmount };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const ids = (store: PipSurfaceStore) => store.getActive()?.targets.map((t) => t.id);

describe('Rhyme Studio drives Pip from the workspace', () => {
  it('recognition outlines the pair as the question; celebrates only the credited answer', () => {
    const { store, speak, say, feedback, container } = mount();
    expect(container.querySelector('[data-pip-dock="rhyme"]')).not.toBeNull();
    expect(ids(store)).toEqual(['pair']);
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'pair' });
    speak(false);
    say('yes'); feedback('correct');
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('identification and collection point at the target card, never a choice card or a rhyme slot', () => {
    const { store, speak, next, container, unmount } = mount();
    next('yes');
    expect(container.querySelectorAll('[data-pip-object]')).toHaveLength(1);
    expect(ids(store)).toEqual(['target']);
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'target' });
    speak(false);
    next('bun');
    expect(store.getActive()?.scopeId).toContain('col');
    expect(ids(store)).toEqual(['target']);
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
