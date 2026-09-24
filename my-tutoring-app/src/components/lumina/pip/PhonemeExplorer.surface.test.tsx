// @vitest-environment jsdom
// Phoneme explorer runs only on the teaching workspace, so Pip is exercised there: the runtime owns progression.
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

const ISOLATE = {
  id: 'iso', mode: 'isolate', phoneme: 'M', phonemeSound: 'mmm', exampleWord: 'mouse', exampleEmoji: '🐭',
  choices: [
    { word: 'moon', emoji: '🌙', correct: true }, { word: 'dog', emoji: '🐶', correct: false },
    { word: 'fish', emoji: '🐟', correct: false }, { word: 'cake', emoji: '🍰', correct: false },
  ],
};
const BLEND = { id: 'bl', mode: 'blend', phonemeSequence: ['k', 'a', 't'], word: 'cat', emoji: '🐱' };
const SEGMENT = { id: 'seg', mode: 'segment', targetWord: 'sheep', targetEmoji: '🐑', segments: ['sh', 'ee', 'p'] };

function mount(challenges: unknown[] = [ISOLATE, BLEND, SEGMENT]) {
  const store = new PipSurfaceStore();
  store.setActive('phoneme');
  const h = mountWorkspace({ primitiveId: 'phoneme-explorer', evalMode: 'mixed', data: { title: 'Sounds', gradeLevel: 'K', challenges },
    instanceId: 'phoneme', pipStore: store });
  const container = h.view.container;
  const tap = (id: string) => act(() => { fireEvent.click(container.querySelector(`[data-pip-object="${id}"]`) as HTMLElement); });
  const next = (answer: string) => { h.say(answer); h.feedback('correct', 'advance'); h.confirmVisible(); };
  return { ...h, store, container, tap, next, unmount: h.view.unmount };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;

describe('Phoneme Explorer drives Pip from the workspace', () => {
  it('isolate points at the sound tile, never a menu card; watches the card or example the child taps to hear', () => {
    const { store, speak, tap, say, feedback, container } = mount();
    expect(container.querySelector('[data-pip-dock="phoneme"]')).not.toBeNull();
    expect(store.getActive()?.scopeId).toBe('iso');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'stimulus' });
    tap('card-2');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'card-2' });
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'stimulus' });
    speak(false);
    tap('example');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'example' });
    say('moon'); feedback('correct');
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('the hard tier removes the worked example, so it is never published', () => {
    const { store } = mount([{ ...ISOLATE, showExampleWord: false }]);
    expect(store.getActive()?.targets.map((t) => t.id)).not.toContain('example');
  });

  it('blend points at the tile row as a whole, never one tile; a new item drops the old tap; unregisters on unmount', () => {
    const { store, speak, tap, next, unmount } = mount();
    tap('card-1');
    next('moon');
    expect(store.getActive()?.scopeId).toBe('bl');
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'sounds' });
    speak(false);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'sounds' });
    tap('sound-1');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'sound-1' });
    next('cat');
    expect(store.getActive()?.scopeId).toBe('seg');
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
