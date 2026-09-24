// @vitest-environment jsdom
// Word workout runs only on the teaching workspace, so Pip is exercised there: the runtime owns progression.
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { PipSurfaceStore } from './PipSurfaceStore';
import { installRuntimeTimers, restoreRuntimeTimers } from '../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../components/live-activity/runtime/testing/workspaceHarness';
import type { WordWorkoutData } from '../primitives/visual-primitives/literacy/WordWorkout';
import { itemsFromChallenges, wordWorkoutHarnessAnswers, type WordWorkoutItemKind }
  from '../primitives/visual-primitives/literacy/wordWorkoutScript';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const data: WordWorkoutData = {
  title: 'Workout', mode: 'real-vs-nonsense', masteredVowels: ['a', 'o'], gradeLevel: '1',
  challenges: [
    { id: 'real', mode: 'real-vs-nonsense', realWord: 'cat', nonsenseWord: 'zat' },
    { id: 'pic', mode: 'picture-match', targetWord: 'pig', targetImage: '🐷',
      distractorImages: [{ word: 'pin', image: '📌' }, { word: 'bin', image: '🗑️' }] },
    { id: 'chain', mode: 'word-chains', chain: ['cat', 'hat', 'hot', 'hop'], changedPositions: [0, 1, 2] },
    { id: 'sent', mode: 'sentence-reading', sentence: 'The cat sat on the mat.', cvcWords: ['cat', 'sat', 'mat'],
      sightWords: ['the', 'on'], comprehensionQuestion: 'Where did the cat sit?', comprehensionAnswer: 'mat' },
    { id: 'ctx', mode: 'context-discrimination', contextTrialId: 'cat-cap' },
  ],
};
const items = itemsFromChallenges(data.challenges);
const indexOf = (kind: WordWorkoutItemKind, nth = 0) => items.map((item, i) => [item.kind, i] as const).filter(([k]) => k === kind)[nth][1];

function mount() {
  const store = new PipSurfaceStore();
  store.setActive('workout');
  const h = mountWorkspace({ primitiveId: 'word-workout', evalMode: 'mixed', data: data as unknown as Record<string, unknown>,
    instanceId: 'workout', pipStore: store });
  const container = h.view.container;
  const tap = (id: string) => act(() => { fireEvent.click(container.querySelector(`[data-pip-object="${id}"]`) as HTMLElement); });
  /** Credit every item before `index` (a picture by its right tap, the rest by the right spoken answer). */
  const advanceTo = (index: number) => {
    for (let i = h.state().task ? items.findIndex(x => x.id === h.state().task!.itemId) : 0; i < index; i++) {
      const answers = wordWorkoutHarnessAnswers(items[i]);
      if (answers.tapped) { tap(`picture-${answers.tapped.correct}`); h.dispatch('advance'); }
      else { h.say(answers.correct); h.feedback('correct', 'advance'); }
      h.confirmVisible();
    }
  };
  return { ...h, store, container, tap, advanceTo, unmount: h.view.unmount };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const ids = (store: PipSurfaceStore) => store.getActive()?.targets.map((t) => t.id);

describe('Word Workout drives Pip from the workspace', () => {
  it('real or silly outlines both words as one region; celebrates only the credited answer', () => {
    const { store, speak, say, feedback, container } = mount();
    expect(container.querySelector('[data-pip-dock="workout"]')).not.toBeNull();
    expect(ids(store)).toEqual(['pair']);
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'pair' });
    speak(false);
    say('cat'); feedback('correct');
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('picture match points at the printed word, never a picture; watches the checked picture; Try again frees it', () => {
    const { store, speak, advanceTo, tap, dispatch, confirmVisible } = mount();
    advanceTo(indexOf('picture_tap'));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'word' });
    speak(false);
    // The activity checks the tap at once, so Pip watches the tapped picture while the verdict stands.
    tap('picture-pin');
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'look', targetId: 'picture-pin' });
    dispatch('retry'); confirmVisible();
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'word' });
  });

  it('a chain word points at the row the screen marks; the sentence and its question point at the whole sentence', () => {
    const { store, speak, advanceTo, container } = mount();
    advanceTo(indexOf('chain_word', 1));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'chain-row' });
    expect(container.querySelector('[data-pip-object="chain-row"]')?.textContent).toContain('hat');
    advanceTo(indexOf('read_sentence'));
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'sentence' });
    advanceTo(indexOf('answer_question'));
    expect(ids(store)).toEqual(['sentence']);
  });

  it('near words: the marked card on the read, the sentence (never a word card) on the choice; unregisters on unmount', () => {
    const { store, speak, advanceTo, unmount } = mount();
    advanceTo(indexOf('read_context_word'));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'context-target' });
    advanceTo(indexOf('choose_context_word'));
    expect(ids(store)).toEqual(['sentence']);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'sentence' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
