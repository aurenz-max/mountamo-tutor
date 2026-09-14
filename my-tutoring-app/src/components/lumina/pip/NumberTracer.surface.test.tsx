// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import NumberTracer, { type NumberTracerData } from '../primitives/visual-primitives/math/NumberTracer';

const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: 'tracer' as string | null }));
vi.mock('../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false, isAudioPlaying: tutor.isAudioPlaying, activePrimitiveId: tutor.activePrimitiveId }),
}));
vi.mock('../evaluation', () => ({ useEvaluationContext: () => null, usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: vi.fn() }) }));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
beforeEach(() => {
  tutor.isAudioPlaying = false;
  tutor.activePrimitiveId = 'tracer';
  // A no-op 2D context: the check renders the judged ink image on its own canvas.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(new Proxy({}, { get: () => () => undefined, set: () => true }) as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA');
});

const challenge = { id: 't1', type: 'trace' as const, digit: 2, instruction: 'Trace the number', strokePaths: [], showModel: true, showArrows: true };
const data = (challenges: NumberTracerData['challenges']): NumberTracerData => ({ title: 'Write', gradeBand: 'K', instanceId: 'tracer', challenges });

function mount(input: NumberTracerData) {
  const store = new PipSurfaceStore();
  store.setActive('tracer');
  const ui = (next: NumberTracerData) => <PipSurfaceContext.Provider value={store}><NumberTracer data={next} /></PipSurfaceContext.Provider>;
  return { store, ui, ...render(ui(input)) };
}

function stroke(canvas: Element) {
  fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
  fireEvent.mouseMove(canvas, { clientX: 20, clientY: 20 });
  fireEvent.mouseMove(canvas, { clientX: 30, clientY: 60 });
  fireEvent.mouseMove(canvas, { clientX: 40, clientY: 90 });
  fireEvent.mouseUp(canvas);
}

describe('Number Tracer drives Pip from its check state', () => {
  it('points at the canvas on this item’s speech, watches ink, and receives the drawing', async () => {
    let finishCheck: (value: unknown) => void = () => {};
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { finishCheck = resolve; })));
    const input = data([challenge, { ...challenge, id: 't2' }]);
    const { store, container, rerender, ui } = mount(input);
    expect(store.getActive()?.pose).toEqual({ phase: 'working', gesture: 'none' });
    tutor.isAudioPlaying = true;
    rerender(ui(input));
    expect(store.getActive()?.pose).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'canvas' });
    tutor.isAudioPlaying = false;
    rerender(ui(input));
    const canvas = container.querySelector('[data-pip-object="canvas"]')!;
    stroke(canvas);
    stroke(canvas);
    expect(store.getActive()?.pose).toEqual({ phase: 'working', gesture: 'look', targetId: 'canvas' });
    fireEvent.click(screen.getByRole('button', { name: /Check/ }));
    expect(store.getActive()?.pose).toMatchObject({ phase: 'checking', gesture: 'receive' });
    await act(async () => { finishCheck({ ok: true, json: async () => ({ score: 90, confidence: 90, feedback: 'Nice' }) }); });
    expect(store.getActive()?.pose).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('points at the copy model or the sequence gap, never at a label carrying the answer', () => {
    tutor.isAudioPlaying = true;
    const copy = data([{ ...challenge, id: 'c1', type: 'copy' }]);
    const { store, rerender, ui } = mount(copy);
    expect(store.getActive()?.pose).toMatchObject({ gesture: 'point', targetId: 'model' });
    tutor.isAudioPlaying = false;
    rerender(ui(copy));
    const sequence = data([{ ...challenge, id: 's1', type: 'sequence', digit: 5, sequenceNumbers: [4, 5, 6], missingIndex: 1 }]);
    rerender(ui(sequence));
    tutor.isAudioPlaying = true;
    rerender(ui(sequence));
    expect(store.getActive()?.pose).toMatchObject({ gesture: 'point', targetId: 'gap' });
    expect(store.getActive()?.targets.map((t) => t.label).join(' ')).not.toMatch(/\d/);
  });

  it('ignores tutor speech that belongs to another block', () => {
    tutor.isAudioPlaying = true;
    tutor.activePrimitiveId = 'another-block';
    const { store } = mount(data([challenge]));
    expect(store.getActive()?.pose).toEqual({ phase: 'working', gesture: 'none' });
  });

  it('does not point into a new item over speech that began on the previous one', () => {
    tutor.isAudioPlaying = true;
    const first = data([challenge]);
    const { store, rerender, ui, unmount } = mount(first);
    expect(store.getActive()?.pose.gesture).toBe('point');
    rerender(ui(data([{ ...challenge, id: 't2' }])));
    expect(store.getActive()?.scopeId).toBe('t2');
    expect(store.getActive()?.pose).toEqual({ phase: 'idle', gesture: 'none' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
