// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import LetterWorkshop, { type LetterWorkshopData } from '../primitives/visual-primitives/literacy/LetterWorkshop';
import { getLetterTemplate } from '../primitives/visual-primitives/literacy/letterWorkshopGeometry';

const tutor = vi.hoisted(() => ({ isAudioPlaying: false, isConnected: false, activePrimitiveId: 'workshop' as string | null }));
vi.mock('../evaluation', () => ({ usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), elapsedMs: 0 }) }));
vi.mock('../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: vi.fn(), requestHint: vi.fn(), isConnected: tutor.isConnected, isAudioPlaying: tutor.isAudioPlaying,
    sessionMode: 'standalone', activePrimitiveId: tutor.activePrimitiveId }),
}));
vi.mock('../utils/SoundManager', () => ({ SoundManager: { navigate: vi.fn() } }));
vi.mock('../components/PhaseSummaryPanel', () => ({ default: () => <div>Practice complete</div> }));

beforeEach(() => {
  Object.assign(tutor, { isAudioPlaying: false, isConnected: false, activePrimitiveId: 'workshop' });
  class Pointer extends MouseEvent {
    pointerId: number; pointerType: string; isPrimary: boolean;
    constructor(type: string, options: PointerEventInit) {
      super(type, options);
      this.pointerId = options.pointerId ?? 1;
      this.pointerType = options.pointerType ?? 'pen';
      this.isPrimary = options.isPrimary ?? true;
    }
  }
  vi.stubGlobal('PointerEvent', Pointer);
  Object.assign(SVGElement.prototype, {
    getScreenCTM: () => ({ inverse: () => ({}) }),
    createSVGPoint: () => ({ x: 0, y: 0, matrixTransform() { return this; } }),
    setPointerCapture: vi.fn(), hasPointerCapture: () => false, releasePointerCapture: vi.fn(),
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

const data = (type: 'trace' | 'write' = 'trace'): LetterWorkshopData => ({
  title: 'Letters', description: 'Practice.', gradeLevel: 'K', challengeType: type, instanceId: 'workshop',
  challenges: ['l', 'i'].map((letter, index) => ({ id: `letter-${index}`, type, templateId: `lowercase-${letter}` })),
});

function trace(letter: string) {
  const paper = screen.getByTestId('letter-writing-paper');
  for (const path of getLetterTemplate(`lowercase-${letter}`).strokes) {
    fireEvent.pointerDown(paper, { clientX: path[0].x, clientY: path[0].y, button: 0, pointerId: 1, isPrimary: true });
    for (const point of path.slice(1)) fireEvent.pointerMove(paper, { clientX: point.x, clientY: point.y, pointerId: 1 });
    fireEvent.pointerUp(paper, { clientX: path[path.length - 1].x, clientY: path[path.length - 1].y, pointerId: 1 });
  }
}

function mount(value = data()) {
  const store = new PipSurfaceStore();
  const ui = () => <PipSurfaceContext.Provider value={store}><LetterWorkshop data={value} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const refresh = () => act(() => { view.rerender(ui()); });
  return { ...view, store, refresh };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;

describe('Letter Workshop drives Pip from its check state', () => {
  it('points at the paper on speech, never a start dot; watches the ink; celebrates only a passing check', () => {
    const { store, refresh, container } = mount();
    expect(container.querySelector('[data-pip-dock="workshop"]')).not.toBeNull();
    expect(screen.getAllByTestId('letter-start').length).toBeGreaterThan(0);
    expect(store.getActive()?.targets.map((t) => t.id)).toEqual(['paper']);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'none' });
    tutor.isAudioPlaying = true;
    refresh();
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'paper' });
    tutor.isAudioPlaying = false;
    refresh();
    trace('l');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'paper' });
    fireEvent.click(screen.getByRole('button', { name: 'Check my tracing' }));
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    fireEvent.click(screen.getByRole('button', { name: /Next letter/ }));
    expect(store.getActive()?.scopeId).toBe('letter-1');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'none' });
  });

  it('a failed check is not celebrated; speech for another block is ignored', () => {
    const { store, refresh } = mount();
    trace('i');
    fireEvent.click(screen.getByRole('button', { name: 'Check my tracing' }));
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'paper' });
    tutor.activePrimitiveId = 'someone-else';
    tutor.isAudioPlaying = true;
    refresh();
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'paper' });
  });

  it("write: the tutor's letter-name cue points at the paper; unregisters on unmount", () => {
    vi.useFakeTimers();
    tutor.isConnected = true;
    const { store, refresh, unmount } = mount(data('write'));
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'paper' });
    tutor.isAudioPlaying = true;
    refresh();
    tutor.isAudioPlaying = false;
    refresh();
    act(() => { vi.advanceTimersByTime(600); });
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'none' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
