'use client';

import React from 'react';
import { useLiveRuntime } from './LiveRuntimeContext';
import { catalogBindsWorkspace } from '../pinnedModes';

/**
 * The one rule for which component a workspace family mounts: inside a live
 * runtime, a RESOLVED eval-mode pin whose every mode the family binds gets the
 * tutor/JEV teaching workspace; everything else keeps the scripted drill. A blend
 * (`a|b`) or `mixed` pin qualifies when all its modes bind (`pinBindsWorkspace`, the
 * same rule the lesson plan uses). The mode comes from the mount, never from a
 * flattened interaction label — without it this falls back to the drill rather than
 * putting a second teaching clock beside the tutor's.
 *
 * `modes` is the family's own workspace-mode list, the same constant its live
 * adapter publishes, so the route and the mount cannot disagree.
 */
export function withTeachingWorkspace<T, P extends T & { runtimeEvalMode?: string }>(primitiveId: string,
  Teaching: React.ComponentType<T>, Scripted: React.ComponentType<P>): React.FC<P> {
  const Switched: React.FC<P> = props => {
    const runtime = useLiveRuntime();
    return runtime && catalogBindsWorkspace(primitiveId, props.runtimeEvalMode) ? <Teaching {...props} /> : <Scripted {...props} />;
  };
  Switched.displayName = `withTeachingWorkspace(${Scripted.displayName || Scripted.name || 'Primitive'})`;
  return Switched;
}

/**
 * The same rule for a primitive that keeps ONE surface and swaps its controller instead of its
 * component: the runner-era families (workspace rollout W1). The surface receives the controller
 * hook as a prop and is keyed by it, so hooks never change owner between renders and the
 * workspace path never mounts the runner.
 */
export function withWorkspaceController<P extends { runtimeEvalMode?: string }, O, R>(primitiveId: string,
  Surface: React.ComponentType<P & { tutorOwned: boolean; useController: (options: O) => R }>,
  useScripted: (options: O) => R, useWorkspace: (options: O) => R): React.FC<P> {
  const Switched: React.FC<P> = props => {
    const runtime = useLiveRuntime();
    // The catalog's `teachingWorkspace` declaration decides, so the route and this switch agree.
    const tutorOwned = !!runtime && catalogBindsWorkspace(primitiveId, props.runtimeEvalMode);
    return <Surface key={tutorOwned ? 'tutor' : 'scripted'} {...props} tutorOwned={tutorOwned}
      useController={tutorOwned ? useWorkspace : useScripted} />;
  };
  Switched.displayName = `withWorkspaceController(${Surface.displayName || Surface.name || 'Primitive'})`;
  return Switched;
}
