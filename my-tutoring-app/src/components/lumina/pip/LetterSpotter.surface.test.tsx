// @vitest-environment jsdom
// Letter spotter runs only on the teaching workspace, so Pip is exercised there: the runtime owns progression.
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { PipSurfaceStore } from './PipSurfaceStore';
import { installRuntimeTimers, restoreRuntimeTimers } from '../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../components/live-activity/runtime/testing/workspaceHarness';
import { SPOTTER_EMOJI } from '../primitives/visual-primitives/literacy/letterSpotterScript';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const data = {
  title: 'Letters', letterGroup: 1, cumulativeLetters: ['s', 'a', 't', 'p', 'i', 'n'], newLetters: [], gradeLevel: 'K',
  challenges: [
    { id: 'name', mode: 'name-it', targetLetter: 'a', targetCase: 'lowercase', targetWord: 'ant',
      spokenSentence: 'I see an ant walk away.', sentence: `I see an ${SPOTTER_EMOJI}nt walk away.` },
    { id: 'find', mode: 'find-it', targetLetter: 'p', targetCase: 'uppercase',
      letterGrid: ['S', 'A', 'T', 'I', 'N', 'P', 'S', 'A', 'T', 'I', 'N', 'S', 'A', 'T', 'I', 'N'] },
    { id: 'match', mode: 'match-it', targetLetter: 's', targetCase: 'both', options: ['s', 'a', 'n', 't'] },
  ],
};

function mount() {
  const store = new PipSurfaceStore();
  store.setActive('spotter');
  const h = mountWorkspace({ primitiveId: 'letter-spotter', evalMode: 'mixed', data, instanceId: 'spotter', pipStore: store });
  const container = h.view.container;
  const tap = (id: string) => act(() => { fireEvent.click(container.querySelector(`[data-pip-object="${id}"]`) as HTMLElement); });
  return { ...h, store, container, tap, unmount: h.view.unmount };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;

describe('Letter Spotter drives Pip from the workspace', () => {
  it('name-it points at the star over the hidden letter and celebrates only the credited answer', () => {
    const { store, speak, say, feedback, container } = mount();
    expect(container.querySelector('[data-pip-dock="spotter"]')).not.toBeNull();
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'marker' });
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'marker' });
    speak(false);
    say('A'); feedback('correct');
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('find-it outlines the whole grid, never a cell; watches the checked cell; Try again drops it', () => {
    const { store, speak, say, feedback, confirmVisible, tap, dispatch } = mount();
    say('A'); feedback('correct', 'advance'); confirmVisible();
    speak(true);
    expect(store.getActive()?.targets.map((t) => t.id)).toEqual(expect.arrayContaining(['grid', 'cell-0', 'cell-15']));
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'grid' });
    speak(false);
    tap('cell-3');
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'look', targetId: 'cell-3' });
    dispatch('retry'); confirmVisible();
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'grid' });
  });

  it('match-it points at the big letter, never a little one; watches the checked option; unregisters on unmount', () => {
    const { store, speak, say, feedback, confirmVisible, tap, dispatch, unmount } = mount();
    say('A'); feedback('correct', 'advance'); confirmVisible();
    tap('cell-5'); dispatch('advance'); confirmVisible();
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'letter' });
    speak(false);
    tap('option-n');
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'look', targetId: 'option-n' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
