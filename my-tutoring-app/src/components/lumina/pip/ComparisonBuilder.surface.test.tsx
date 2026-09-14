// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import ComparisonBuilder, { type ComparisonBuilderChallenge } from '../primitives/visual-primitives/math/ComparisonBuilder';

const tutor = vi.hoisted(() => ({ isAudioPlaying: false }));
vi.mock('../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false, isAudioPlaying: tutor.isAudioPlaying, activePrimitiveId: 'comparison' }),
}));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

afterEach(cleanup);
beforeEach(() => { tutor.isAudioPlaying = false; });

const groups = (id: string, left: number, right: number, correctAnswer: 'more' | 'less' | 'equal'): ComparisonBuilderChallenge => ({
  id, type: 'compare-groups', instruction: 'Which side has more?',
  leftGroup: { count: left, objectType: 'bears' }, rightGroup: { count: right, objectType: 'bears' }, correctAnswer,
});
const data = { title: 'Compare', gradeBand: 'K' as const, instanceId: 'comparison', showCorrespondenceLines: true, useAlligatorMnemonic: true,
  challenges: [groups('c1', 3, 1, 'more'), groups('c2', 2, 2, 'equal')] };

describe('Comparison Builder drives Pip from its check state', () => {
  it('points at the whole workspace on speech, follows the child’s tap, and celebrates only a correct answer', async () => {
    const store = new PipSurfaceStore();
    store.setActive('comparison');
    const ui = () => <PipSurfaceContext.Provider value={store}><ComparisonBuilder data={data} /></PipSurfaceContext.Provider>;
    const { rerender, unmount } = render(ui());
    expect(store.getActive()?.pose).toEqual({ phase: 'working', gesture: 'none' });
    tutor.isAudioPlaying = true;
    rerender(ui());
    expect(store.getActive()?.pose).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'workspace' });
    expect(store.getActive()?.targets.map((t) => t.id)).toEqual(['workspace']);
    tutor.isAudioPlaying = false;
    rerender(ui());
    const [left, right] = Array.from(document.querySelectorAll('svg rect'));
    fireEvent.pointerDown(right);
    fireEvent.click(right);
    expect(screen.queryByText(/next challenge/i)).toBeNull();
    expect(store.getActive()?.pose).toEqual({ phase: 'working', gesture: 'look', targetId: 'touched' });
    expect(store.getActive()?.targets.find((t) => t.id === 'touched')?.element).toBe(right);
    fireEvent.pointerDown(left);
    fireEvent.click(left);
    expect(await screen.findByText(/next challenge/i)).toBeTruthy();
    expect(store.getActive()?.pose).toEqual({ phase: 'celebrating', gesture: 'none' });
    fireEvent.click(screen.getByText(/next challenge/i));
    expect(store.getActive()?.scopeId).toBe('c2');
    expect(store.getActive()?.pose).toEqual({ phase: 'working', gesture: 'none' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
