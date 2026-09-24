// @vitest-environment jsdom
// Word sorter runs only on the teaching workspace, so Pip is exercised there: the runtime owns progression.
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

const data = {
  title: 'Sorting', gradeLevel: 'K', sortingTopic: 'Animals and food',
  challenges: [
    { id: 'ch1', type: 'binary_sort', instruction: '', bucketLabels: ['Animals', 'Food'], bucketEmojis: ['🐾', '🍎'],
      words: [
        { id: 'w0', word: 'dog', emoji: '🐕', correctBucket: 'Animals' },
        { id: 'w1', word: 'bread', emoji: '🍞', correctBucket: 'Food' },
      ] },
    { id: 'ch2', type: 'match_pairs', instruction: '', relationLabel: 'opposite',
      pairs: [{ id: 'p0', term: 'big', match: 'small' }, { id: 'p1', term: 'hot', match: 'cold' }] },
  ],
};

function mount() {
  const store = new PipSurfaceStore();
  store.setActive('sorter');
  const h = mountWorkspace({ primitiveId: 'word-sorter', evalMode: 'mixed', data, instanceId: 'sorter', pipStore: store });
  const next = (answer: string) => { h.say(answer); h.feedback('correct', 'advance'); h.confirmVisible(); };
  return { ...h, store, next, container: h.view.container, unmount: h.view.unmount };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;

describe('Word Sorter drives Pip from the workspace', () => {
  it('points at the word card on the ask, never a mat; celebrates only the credited answer', () => {
    const { store, speak, say, feedback, container } = mount();
    expect(container.querySelector('[data-pip-dock="sorter"]')).not.toBeNull();
    expect(store.getActive()?.targets.map((t) => t.id)).toEqual(['word']);
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'word' });
    speak(false);
    say('Animals'); feedback('correct');
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('match_pairs also points only at the word card, never at a bank word; unregisters on unmount', () => {
    const { store, speak, next, unmount } = mount();
    next('Animals'); next('Food');
    expect(store.getActive()?.scopeId).toContain('ch2');
    expect(store.getActive()?.targets.map((t) => t.id)).toEqual(['word']);
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'word' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
