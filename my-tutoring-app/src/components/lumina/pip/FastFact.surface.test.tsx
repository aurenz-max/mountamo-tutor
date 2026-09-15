// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import FastFact, { type FastFactData } from '../primitives/visual-primitives/core/FastFact';

const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: 'facts' as string | null }));
vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null, onAuthStateChanged: () => () => {} }, db: {}, app: {} }));
vi.mock('../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false, isAudioPlaying: tutor.isAudioPlaying, activePrimitiveId: tutor.activePrimitiveId }),
}));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

beforeEach(() => { Object.assign(tutor, { isAudioPlaying: false, activePrimitiveId: 'facts' }); });
afterEach(cleanup);

const fact = (id: string, text: string, correct: string, options: string[]) => ({
  id, type: 'recall', challengeType: 'recall' as const, prompt: { text }, correctAnswer: correct, responseMode: 'choice' as const, options,
});
const data: FastFactData = {
  title: 'Facts', subject: 'Math', targetResponseTime: 5, showStreakCounter: false, showAccuracy: false, maxAttemptsPerChallenge: 2,
  phaseConfig: { recall: { label: 'Recall', icon: '⚡', accentColor: 'amber' } }, instanceId: 'facts',
  challenges: [fact('f1', '2 + 2', '4', ['3', '4', '5']), fact('f2', '3 + 3', '6', ['6', '7', '8'])],
};

function mount() {
  const store = new PipSurfaceStore();
  const ui = () => <PipSurfaceContext.Provider value={store}><FastFact data={data} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const refresh = () => act(() => { view.rerender(ui()); });
  return { ...view, store, refresh };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;

describe('Fast Fact drives Pip from its check state', () => {
  it('waits in the dock before Start; then outlines the fact and choices, follows a tap, and celebrates only a correct answer', () => {
    const { store, refresh, container } = mount();
    expect(container.querySelector('[data-pip-dock="facts"]')).not.toBeNull();
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    fireEvent.click(screen.getByText('Start'));
    expect(store.getActive()?.targets.map((t) => t.id)).toEqual(['workspace']);
    tutor.isAudioPlaying = true;
    refresh();
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'workspace' });
    tutor.isAudioPlaying = false;
    refresh();
    const wrong = screen.getByText('3').closest('button') as HTMLElement;
    fireEvent.pointerDown(wrong);
    fireEvent.click(wrong);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'touched' });
    const right = screen.getByText('4').closest('button') as HTMLElement;
    fireEvent.pointerDown(right);
    fireEvent.click(right);
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('ignores another block’s speech and unregisters on unmount', () => {
    const { store, refresh, unmount } = mount();
    fireEvent.click(screen.getByText('Start'));
    tutor.activePrimitiveId = 'someone-else';
    tutor.isAudioPlaying = true;
    refresh();
    expect(pose(store)?.gesture).not.toBe('point');
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
