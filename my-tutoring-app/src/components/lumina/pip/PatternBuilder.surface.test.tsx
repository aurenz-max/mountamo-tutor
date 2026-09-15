// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import PatternBuilder, { type PatternBuilderChallenge, type PatternBuilderData } from '../primitives/visual-primitives/math/PatternBuilder';

const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: 'pattern' }));
vi.mock('../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false, ...tutor }),
}));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

afterEach(cleanup);
beforeEach(() => { tutor.isAudioPlaying = false; tutor.activePrimitiveId = 'pattern'; });

const challenge = (id: string, type: PatternBuilderChallenge['type'], extra: Partial<PatternBuilderChallenge> = {}): PatternBuilderChallenge => ({
  id, type, instruction: 'Look at the pattern.', answer: '', hint: '', narration: '', ...extra,
});
const data = (challenges: PatternBuilderChallenge[]): PatternBuilderData => ({
  title: 'Patterns', patternType: 'repeating', gradeBand: 'K-1', instanceId: 'pattern',
  sequence: { given: ['red', 'blue', 'red', 'blue'], hidden: ['red', 'blue'], core: ['red', 'blue'], rule: null },
  tokens: { available: ['red', 'blue', 'green'], type: 'colors' },
  challenges,
});

function mount(input: PatternBuilderData) {
  const store = new PipSurfaceStore();
  store.setActive('pattern');
  const ui = () => <PipSurfaceContext.Provider value={store}><PatternBuilder data={input} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const speak = (on: boolean) => { tutor.isAudioPlaying = on; view.rerender(ui()); };
  const tap = (id: string) => fireEvent.click(view.container.querySelector(`[data-pip-object="${id}"]`)!);
  return { store, speak, tap, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const ids = (store: PipSurfaceStore) => store.getActive()?.targets.map((t) => t.id) ?? [];
const cueOnce = (speak: (on: boolean) => void) => { speak(true); };

describe('Pattern Builder drives Pip from its check state', () => {
  it('extend: points at the next "?" slot, then the row once full; follows palette taps; celebrates only a right extension', () => {
    const { store, speak, tap, container } = mount(data([challenge('e1', 'extend'), challenge('e2', 'extend')]));
    expect(container.querySelector('[data-pip-dock="pattern"]')).not.toBeNull();
    cueOnce(speak);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'slot-0' });
    expect(ids(store)).not.toContain('seq-0'); // the given tokens are not choices here
    speak(false);
    tap('token-0'); // red
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'token-0' });
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'slot-1' });
    speak(false);
    tap('token-2'); // green — wrong
    fireEvent.click(screen.getByRole('button', { name: /check/i }));
    speak(true); // the correction
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'pattern' });
    speak(false);
    tap('slot-1'); // take the last one back
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'slot-1' });
    tap('token-1'); // blue
    fireEvent.click(screen.getByRole('button', { name: /check/i }));
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    fireEvent.click(screen.getByRole('button', { name: /next challenge/i }));
    expect(store.getActive()?.scopeId).toBe('e2');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'none' });
  });

  it('identify the core: outlines the row, never a token; follows the child’s selection', () => {
    const { store, speak, tap } = mount(data([challenge('i1', 'identify_core')]));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'pattern' });
    expect(ids(store)).toEqual(expect.arrayContaining(['pattern', 'seq-0', 'seq-3']));
    speak(false);
    tap('seq-1');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'seq-1' });
  });

  it('create and translate: points at the build zone; removing a built token is watched as the zone', () => {
    const { store, speak, tap, unmount } = mount(data([challenge('c1', 'create')]));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'build' });
    speak(false);
    tap('token-0');
    fireEvent.click(screen.getByText('R', { selector: '[data-pip-object="build"] div' }));
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'build' });
    unmount();
    expect(store.getActive()).toBeNull();

    tutor.isAudioPlaying = true;
    const translate = mount(data([challenge('t1', 'translate', { translationMapping: { red: 'circle', blue: 'square' } })]));
    expect(pose(translate.store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'build' });
  });

  it('ignores speech for another block', () => {
    tutor.activePrimitiveId = 'other-block';
    const { store, speak } = mount(data([challenge('e1', 'extend')]));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'none' });
  });
});
