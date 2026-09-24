// @vitest-environment jsdom
// Syllable clapper runs only on the teaching workspace, so Pip is exercised there: the runtime owns progression.
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

const DATA = { title: 'Clap It Out', challenges: [
  { id: 'c1', word: 'butterfly', syllables: ['but', 'ter', 'fly'], syllableCount: 3, imageDescription: '', difficulty: 3, challengeType: 'count_parts' },
  { id: 'c2', word: 'tiger', syllables: ['ti', 'ger'], syllableCount: 2, imageDescription: '', difficulty: 3, challengeType: 'count_parts' },
] };

function mount() {
  const store = new PipSurfaceStore();
  store.setActive('clap');
  const h = mountWorkspace({ primitiveId: 'syllable-clapper', evalMode: 'count_parts', data: DATA, instanceId: 'clap', pipStore: store });
  return { ...h, container: h.view.container, unmount: h.view.unmount, store };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;

describe('Syllable Clapper drives Pip from the workspace', () => {
  it('points at the hear-it-again button while the tutor speaks', () => {
    const { store, speak, container } = mount();
    expect(container.querySelector('[data-pip-dock="clap"]')).not.toBeNull();
    expect(store.getActive()?.targets.map((t) => t.id)).toEqual(['stimulus']);
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'stimulus' });
  });

  it('celebrates the held reveal, takes the next item as its own scope, and unregisters on unmount', () => {
    const { store, say, feedback, dispatch, confirmVisible, unmount } = mount();
    say('three'); feedback('correct');
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    dispatch('advance'); confirmVisible();
    expect(store.getActive()?.scopeId).toContain('c2');
    expect(pose(store)?.phase).not.toBe('celebrating');
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
