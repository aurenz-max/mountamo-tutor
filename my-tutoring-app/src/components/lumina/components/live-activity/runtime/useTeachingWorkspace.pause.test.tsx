// @vitest-environment jsdom
import React, { useLayoutEffect, useRef, useState } from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { turnTo, useTeachingWorkspace, WORK_PAUSE_MS, type TeachingWorkspace } from './useTeachingWorkspace';
import { LiveRuntimeContext } from './LiveRuntimeContext';
import { LiveLessonRuntime } from './LiveLessonRuntime';
import { WorkspacePin } from './workspacePin';

const seam = vi.hoisted(() => ({ conversation: [] as any[], sendText: vi.fn() }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useLuminaAIContext: () => ({ ...seam, isAudioPlaying: false }) }));
beforeEach(() => { vi.useFakeTimers(); seam.sendText.mockClear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

/** Tiles the learner turns on and off, then checks: work that is built up before it is submitted. */
function TileWorkspace() {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const [on, setOn] = useState<string[]>([]);
  const lesson = useTeachingWorkspace({ instanceId: 'tiles', primitiveId: 'tile-test',
    items: [{ id: 'three', task: 'Turn on three tiles.', response: 'gesture', checkResponse: text => text === '3' }], workspace });
  useLayoutEffect(() => {
    workspace.current = { objects: ['a', 'b', 'c', 'd'].map(id => ({ id, label: `tile ${id}`, selected: on.includes(id) })),
      facts: { tiles: 4, tilesOn: on.length }, readyForResponse: true };
    lesson.publishWorkspace();
  });
  return <>{['a', 'b', 'c', 'd'].map(id => <button key={id} onClick={() => setOn(o => o.includes(id) ? o.filter(x => x !== id) : [...o, id])}>{id}</button>)}
    <button onClick={() => lesson.submitGestureResponse(String(on.length))}>check</button></>;
}

const paused = () => seam.sendText.mock.calls.filter(([text]) => /stopped/.test(text));
const mount = () => render(<LiveRuntimeContext.Provider value={new LiveLessonRuntime('tiles')}>
  <WorkspacePin pin="build"><TileWorkspace /></WorkspacePin></LiveRuntimeContext.Provider>);

it('says nothing while the learner has not touched the work', () => {
  mount();
  act(() => { vi.advanceTimersByTime(WORK_PAUSE_MS * 3); });
  expect(paused()).toHaveLength(0);
});

it('tells the tutor once when changed work stops, as a host fact, and again only after the next change', () => {
  const view = mount();
  fireEvent.click(view.getByText('a'));
  act(() => { vi.advanceTimersByTime(WORK_PAUSE_MS - 100); });
  expect(paused()).toHaveLength(0);
  act(() => { vi.advanceTimersByTime(100); });
  expect(paused()).toHaveLength(1);
  expect(paused()[0][1]).toMatchObject({ scripted: false, author: 'host' });
  expect(paused()[0][0]).not.toMatch(/\b(say|ask|invite|respond)\b/i);
  act(() => { vi.advanceTimersByTime(WORK_PAUSE_MS * 3); });
  expect(paused()).toHaveLength(1);
  fireEvent.click(view.getByText('b'));
  act(() => { vi.advanceTimersByTime(WORK_PAUSE_MS); });
  expect(paused()).toHaveLength(2);
});

it('restarts the wait on every change, and says nothing once the work is submitted', () => {
  const view = mount();
  fireEvent.click(view.getByText('a'));
  act(() => { vi.advanceTimersByTime(WORK_PAUSE_MS - 1000); });
  fireEvent.click(view.getByText('b'));
  act(() => { vi.advanceTimersByTime(WORK_PAUSE_MS - 1000); });
  expect(paused()).toHaveLength(0);
  fireEvent.click(view.getByText('check'));
  act(() => { vi.advanceTimersByTime(WORK_PAUSE_MS * 3); });
  expect(paused()).toHaveLength(0);
});

/** Work carried in facts only, as Ten Frame, Number Bond and Place Value publish it. */
function FactsWorkspace() {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const [placed, setPlaced] = useState(0);
  const lesson = useTeachingWorkspace({ instanceId: 'facts', primitiveId: 'facts-test',
    items: [{ id: 'five', task: 'Put five counters on the frame.', response: 'gesture', checkResponse: text => text === '5' }], workspace });
  useLayoutEffect(() => {
    workspace.current = { objects: [], facts: { countersOnFrame: placed }, readyForResponse: true };
    lesson.publishWorkspace();
  });
  return <button onClick={() => setPlaced(n => n + 1)}>place</button>;
}

it('sees work a family carries in facts with no objects', () => {
  const view = render(<LiveRuntimeContext.Provider value={new LiveLessonRuntime('facts')}>
    <WorkspacePin pin="build"><FactsWorkspace /></WorkspacePin></LiveRuntimeContext.Provider>);
  fireEvent.click(view.getByText('place'));
  act(() => { vi.advanceTimersByTime(WORK_PAUSE_MS); });
  expect(paused()).toHaveLength(1);
});

it('keeps a number\'s path through its turns: a self-correction shows, a host change makes no turn', () => {
  let path: number[] = [];
  for (const v of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 9]) path = turnTo(path, v);
  expect(path).toEqual([0, 10, 9]);
  expect(turnTo([0, 4], 6, true)).toEqual([0, 6]);
  expect(turnTo([0, 4], 4)).toEqual([0, 4]);
});

it('carries the path in the packet once the learner turns back', () => {
  const runtime = new LiveLessonRuntime('path');
  const view = render(<LiveRuntimeContext.Provider value={runtime}>
    <WorkspacePin pin="build"><TileWorkspace /></WorkspacePin></LiveRuntimeContext.Provider>);
  for (const id of ['a', 'b', 'c', 'd']) fireEvent.click(view.getByText(id));
  expect(runtime.getSnapshot().task!.demand.workHistory).toBeUndefined();
  fireEvent.click(view.getByText('d'));
  expect(runtime.getSnapshot().task!.demand.workHistory).toBe('tilesOn 0 → 4 → 3');
});
