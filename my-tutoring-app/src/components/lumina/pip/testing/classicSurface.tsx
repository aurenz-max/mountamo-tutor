import React, { type ReactElement } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { expect } from 'vitest';
import { PipSurfaceContext } from '../PipSurfaceContext';
import { PipSurfaceStore } from '../PipSurfaceStore';

/** The hoisted tutor state a classic primitive's `useLuminaAI` mock reads. */
export interface TutorState { isAudioPlaying: boolean; activePrimitiveId: string | null }

export function mountWithStore(ui: () => ReactElement) {
  const store = new PipSurfaceStore();
  const wrap = () => <PipSurfaceContext.Provider value={store}>{ui()}</PipSurfaceContext.Provider>;
  const view = render(wrap());
  const refresh = () => act(() => { view.rerender(wrap()); });
  return { ...view, store, refresh };
}

export const poseOf = (store: PipSurfaceStore) => store.getActive()?.pose;

/** The contract every `useWorkspacePipSurface` integration keeps: a dock for this
 * instance, one `workspace` target, a point at it only on this block's speech,
 * a look at what the child touches inside it, and nothing left after unmount.
 * `silent` primitives have no tutor hook, so speech leaves Pip working.
 * `touch` returns an element inside the workspace to press (default: the first
 * button or input in it, else the workspace itself).
 */
export function expectClassicWorkspace(options: {
  mounted: ReturnType<typeof mountWithStore>;
  tutor: TutorState;
  instanceId: string;
  touch?: (workspace: HTMLElement) => Element | null;
  /** The primitive has no tutor hook, so its own block's speech never points. */
  silent?: boolean;
}) {
  const { mounted, tutor, instanceId } = options;
  const { store, refresh, container, unmount } = mounted;
  expect(container.querySelector(`[data-pip-dock="${instanceId}"]`)).not.toBeNull();
  expect(store.getActive()?.targets.map((t) => t.id)).toEqual(['workspace']);

  tutor.activePrimitiveId = 'someone-else';
  tutor.isAudioPlaying = true;
  refresh();
  expect(poseOf(store)?.gesture).not.toBe('point');
  tutor.isAudioPlaying = false;
  refresh();
  tutor.activePrimitiveId = instanceId;
  tutor.isAudioPlaying = true;
  refresh();
  expect(poseOf(store)).toEqual(options.silent
    ? { phase: 'working', gesture: 'none', targetId: undefined }
    : { phase: 'introducing', gesture: 'point', targetId: 'workspace' });
  tutor.isAudioPlaying = false;
  refresh();

  const workspace = container.querySelector('[data-pip-object="workspace"]') as HTMLElement;
  const target = (options.touch ?? ((w) => w.querySelector('button:not([disabled]), input:not([disabled])') ?? w))(workspace);
  expect(target).not.toBeNull();
  act(() => { fireEvent.pointerDown(target as Element); });
  expect(poseOf(store)).toEqual(target === workspace
    ? { phase: 'working', gesture: 'look', targetId: 'workspace' }
    : { phase: 'working', gesture: 'look', targetId: 'touched' });

  unmount();
  expect(store.getActive()).toBeNull();
}
