// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import ShapeComposer, { type ShapeComposerChallenge, type ShapeComposerData } from '../primitives/visual-primitives/math/ShapeComposer';

const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: 'composer' }));
vi.mock('../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false, ...tutor }),
}));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

afterEach(cleanup);
beforeEach(() => { tutor.isAudioPlaying = false; tutor.activePrimitiveId = 'composer'; });

const decompose: ShapeComposerChallenge = { id: 'de', type: 'decompose', instruction: 'Which shapes make this house?',
  compositeShapePath: 'M 100 150 L 200 150 L 200 250 L 100 250 Z M 100 150 L 150 80 L 200 150 Z',
  expectedComponents: [{ shape: 'square', count: 1 }, { shape: 'triangle', count: 1 }], showSeams: false };
const composeMatch: ShapeComposerChallenge = { id: 'cm', type: 'compose-match', instruction: 'Fill the square.', targetShape: 'square',
  targetOutlinePath: 'M 100 100 L 200 100 L 200 200 L 100 200 Z', showSeams: false,
  pieces: [{ id: 'p1', shape: 'triangle', color: '#8B5CF6', width: 100, height: 100, targetX: 100, targetY: 100 }] };
const data = (challenges: ShapeComposerChallenge[]): ShapeComposerData => ({ title: 'Shapes', challenges, gradeBand: 'K', instanceId: 'composer' });

function mount(input: ShapeComposerData) {
  const store = new PipSurfaceStore();
  store.setActive('composer');
  const ui = () => <PipSurfaceContext.Provider value={store}><ShapeComposer data={input} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const speak = (on: boolean) => { tutor.isAudioPlaying = on; view.rerender(ui()); };
  return { store, speak, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const before = (a: Element | null, b: Element | null) => !!a && !!b && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('Shape Composer drives Pip from its check state', () => {
  it('decompose: points at the composite canvas, never a shape button; celebrates only the right parts', () => {
    const { store, speak, container } = mount(data([decompose, composeMatch]));
    const dock = container.querySelector('[data-pip-dock="composer"]');
    expect(before(container.querySelector('[data-pip-object="canvas"]'), dock)).toBe(true);
    expect(before(dock, container.querySelector('[data-pip-object="choices"]'))).toBe(true);
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'canvas' });
    speak(false);
    fireEvent.click(screen.getByRole('button', { name: /triangle/ }));
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'choices' });
    fireEvent.click(screen.getByRole('button', { name: /check answer/i }));
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'choices' });
    fireEvent.click(screen.getByRole('button', { name: /square/ }));
    fireEvent.click(screen.getByRole('button', { name: /check answer/i }));
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    fireEvent.click(screen.getByRole('button', { name: /next challenge/i }));
    expect(store.getActive()?.scopeId).toBe('cm');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'none' });
  });

  it('compose: points at the canvas, never a palette piece; watches the piece the child added and moved', () => {
    const { store, speak, container, unmount } = mount(data([composeMatch]));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'canvas' });
    speak(false);
    const palette = container.querySelector('[data-pip-object="palette"]') as HTMLElement;
    fireEvent.click(within(palette).getByRole('button', { name: /triangle/ }));
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'piece-p1' });
    const piece = container.querySelector('[data-pip-object="piece-p1"]')!;
    expect(store.getActive()?.targets.find((t) => t.id === 'piece-p1')?.element).toBe(piece);
    expect(palette.contains(piece)).toBe(false);
    speak(true);
    expect(pose(store)?.targetId).toBe('canvas');
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
