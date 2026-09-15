// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import TimelineBuilder, { type TimelineBuilderData } from '../primitives/visual-primitives/calendar/TimelineBuilder';

const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: 'timeline' as string | null }));
vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null, onAuthStateChanged: () => () => {} }, db: {}, app: {} }));
vi.mock('../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false, isAudioPlaying: tutor.isAudioPlaying, activePrimitiveId: tutor.activePrimitiveId }),
}));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

beforeEach(() => { Object.assign(tutor, { isAudioPlaying: false, activePrimitiveId: 'timeline' }); });
afterEach(cleanup);

const challenge = (id: string) => ({
  id, type: 'daily' as const, title: 'My morning', instruction: 'Put the events in order.', scaleStart: 'Morning', scaleEnd: 'Night',
  hint: 'What happens first?', narration: '',
  events: [{ id: `${id}-a`, label: 'Wake up', correctPosition: 0 }, { id: `${id}-b`, label: 'Eat breakfast', correctPosition: 1 }],
});
const data: TimelineBuilderData = { title: 'Timeline', gradeBand: 'K-1', instanceId: 'timeline', challenges: [challenge('t1'), challenge('t2')] };

function mount() {
  const store = new PipSurfaceStore();
  const ui = () => <PipSurfaceContext.Provider value={store}><TimelineBuilder data={data} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const refresh = () => act(() => { view.rerender(ui()); });
  return { ...view, store, refresh };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const place = (label: string, slot: string) => {
  const event = screen.getByText(label).closest('button') as HTMLElement;
  fireEvent.pointerDown(event);
  fireEvent.click(event);
  const target = screen.getByText(slot).closest('button') as HTMLElement;
  fireEvent.pointerDown(target);
  fireEvent.click(target);
};

describe('Timeline Builder drives Pip from its check state', () => {
  it('outlines the timeline and bank as one workspace, follows touches, and celebrates only a correct order', () => {
    const { store, refresh, container } = mount();
    expect(container.querySelector('[data-pip-dock="timeline"]')).not.toBeNull();
    expect(store.getActive()?.targets.map((t) => t.id)).toEqual(['workspace']);
    tutor.isAudioPlaying = true;
    refresh();
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'workspace' });
    tutor.isAudioPlaying = false;
    refresh();
    place('Wake up', '1');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'touched' });
    place('Eat breakfast', '2');
    fireEvent.click(screen.getByText('Check Order'));
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('ignores another block’s speech and unregisters on unmount', () => {
    const { store, refresh, unmount } = mount();
    tutor.activePrimitiveId = 'someone-else';
    tutor.isAudioPlaying = true;
    refresh();
    expect(pose(store)?.gesture).not.toBe('point');
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
