// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import { useWorkspacePipSurface } from './useWorkspacePipSurface';
import { workspacePipPose } from './workspacePipPose';

afterEach(cleanup);

interface Props { scopeId: string | null; solved?: boolean; speaking?: boolean; checking?: boolean; handover?: boolean }

function Board({ scopeId, solved = false, speaking = false, checking, handover }: Props) {
  const pip = useWorkspacePipSurface({ instanceId: 'board', scopeId, label: 'Board', solved, tutorSpeaking: speaking, checking, handover });
  return (
    <div>
      {pip.store && <div {...pip.dock} />}
      <div {...pip.workspace}>
        <button type="button">A</button>
        <button type="button">B</button>
      </div>
      <button type="button">Outside</button>
    </div>
  );
}

function mount(initial: Props) {
  const store = new PipSurfaceStore();
  const ui = (props: Props) => <PipSurfaceContext.Provider value={store}><Board {...props} /></PipSurfaceContext.Provider>;
  const view = render(ui(initial));
  const update = (props: Props) => act(() => { view.rerender(ui(props)); });
  return { ...view, store, update };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;

describe('useWorkspacePipSurface', () => {
  it('points only at the workspace, follows touches inside it, and celebrates only a confirmed item', () => {
    const { store, update, container } = mount({ scopeId: 'i1' });
    expect(container.querySelector('[data-pip-dock="board"]')).not.toBeNull();
    expect(store.getActive()?.targets.map((t) => t.id)).toEqual(['workspace']);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'none' });
    update({ scopeId: 'i1', speaking: true });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'workspace' });
    update({ scopeId: 'i1' });
    fireEvent.pointerDown(screen.getByText('Outside'));
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'none' });
    fireEvent.pointerDown(screen.getByText('B'));
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'touched' });
    expect(store.getActive()?.targets.find((t) => t.id === 'touched')?.element).toBe(screen.getByText('B'));
    update({ scopeId: 'i1', checking: true, handover: true });
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'receive', targetId: 'touched' });
    update({ scopeId: 'i1', solved: true });
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('a new item drops the old touch and speech that began on the old item; no item publishes nothing', () => {
    const { store, update } = mount({ scopeId: 'i1' });
    fireEvent.pointerDown(screen.getByText('A'));
    update({ scopeId: 'i1', speaking: true }); // praise for i1 starts
    update({ scopeId: 'i2', speaking: true }); // still playing after the item changed
    expect(store.getActive()?.scopeId).toBe('i2');
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    update({ scopeId: 'i2' });
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'none' });
    update({ scopeId: null });
    expect(store.getActive()).toBeNull();
  });

  it('a touch on the bare workspace is watched as the workspace', () => {
    expect(workspacePipPose({
      running: true, preparing: false, currentSolved: false, revealHeld: false, judging: false,
      tutorSpeaking: false, cueMatchesItem: true, visibleIds: ['workspace'], touch: 'workspace',
    })).toEqual({ phase: 'working', gesture: 'look', targetId: 'workspace' });
  });
});
