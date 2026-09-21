'use client';

import React from 'react';
import { useLiveRuntime } from './LiveRuntimeContext';

/**
 * The one rule for which component a workspace family mounts: inside a live
 * runtime, a RESOLVED eval mode the family binds gets the tutor/JEV teaching
 * workspace; everything else keeps the scripted drill. The mode comes from the
 * mount, never from a flattened interaction label — without it this falls back
 * to the drill rather than putting a second teaching clock beside the tutor's.
 *
 * `modes` is the family's own workspace-mode list, the same constant its live
 * adapter publishes, so the route and the mount cannot disagree.
 */
export function withTeachingWorkspace<T, P extends T & { runtimeEvalMode?: string }>(
  modes: readonly string[], Teaching: React.ComponentType<T>, Scripted: React.ComponentType<P>): React.FC<P> {
  const Switched: React.FC<P> = props => {
    const runtime = useLiveRuntime();
    return runtime && modes.includes(props.runtimeEvalMode ?? '') ? <Teaching {...props} /> : <Scripted {...props} />;
  };
  Switched.displayName = `withTeachingWorkspace(${Scripted.displayName || Scripted.name || 'Primitive'})`;
  return Switched;
}
