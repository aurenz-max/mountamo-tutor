// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import ShapeTracer, { type ShapeTracerChallenge, type ShapeTracerData } from '../primitives/visual-primitives/math/ShapeTracer';

const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: 'tracer' }));
vi.mock('../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false, ...tutor }),
}));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

afterEach(cleanup);
beforeEach(() => { tutor.isAudioPlaying = false; tutor.activePrimitiveId = 'tracer'; });

const triangle = [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 150, y: 200 }];
const trace: ShapeTracerChallenge = { id: 'tr', type: 'trace', instruction: 'Trace the triangle.', targetShape: 'triangle', tracePath: triangle,
  showGuidePath: false, showNextCue: false, showOrderNumbers: false, showDirectionArrows: false };
const draw: ShapeTracerChallenge = { id: 'dr', type: 'draw-from-description', instruction: 'Draw a shape with 3 sides.', targetShape: 'triangle', requiredProperties: { sides: 3 } };
const connect: ShapeTracerChallenge = { id: 'cd', type: 'connect-dots', instruction: 'Connect the dots.', targetShape: 'triangle', dots: triangle, correctOrder: [0, 1, 2] };
const data = (challenges: ShapeTracerChallenge[]): ShapeTracerData => ({ title: 'Shapes', challenges, gridSize: 50, showPropertyReminder: true, gradeBand: 'K', instanceId: 'tracer' });

function mount(input: ShapeTracerData) {
  const store = new PipSurfaceStore();
  store.setActive('tracer');
  const ui = () => <PipSurfaceContext.Provider value={store}><ShapeTracer data={input} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const speak = (on: boolean) => { tutor.isAudioPlaying = on; view.rerender(ui()); };
  const tap = (id: string) => fireEvent.click(view.container.querySelector(`[data-pip-object="${id}"]`)!);
  return { store, speak, tap, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;

describe('Shape Tracer drives Pip from its check state', () => {
  it('trace: points at the canvas, never the next dot; watches the dot tapped; celebrates only the closed shape', () => {
    const { store, speak, tap, container } = mount(data([trace, draw]));
    expect(container.querySelector('[data-pip-dock="tracer"]')).not.toBeNull();
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'canvas' });
    speak(false);
    tap('vertex-1');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'vertex-1' });
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'canvas' });
    speak(false);
    tap('vertex-0'); tap('vertex-1');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'vertex-1' });
    tap('vertex-2');
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    fireEvent.click(screen.getByRole('button', { name: /next challenge/i }));
    expect(store.getActive()?.scopeId).toBe('dr');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'none' });
  });

  it('draw from a description: watches each corner placed; Check Shape goes straight to celebrating (no handover to receive)', () => {
    const { store, speak, tap } = mount(data([draw, connect]));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'canvas' });
    speak(false);
    tap('grid-0'); tap('grid-9'); tap('grid-20');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'grid-20' });
    fireEvent.click(screen.getByRole('button', { name: /check shape/i }));
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('connect the dots: a wrong dot is watched, not celebrated; unmount clears the surface', () => {
    const { store, tap, unmount } = mount(data([connect, draw]));
    tap('dot-2');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'dot-2' });
    tap('dot-0'); tap('dot-1'); tap('dot-2');
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
