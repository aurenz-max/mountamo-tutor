'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import type { LiveLessonRuntime } from './LiveLessonRuntime';
import type { RuntimeMount } from './contract';

/** Optional facade: existing primitives acquire no new capabilities by being mounted. */
export const LiveRuntimeContext = createContext<LiveLessonRuntime | null>(null);
export const useLiveRuntime = () => useContext(LiveRuntimeContext);
/** Lesson hosts keep visited work mounted, but only the focused surface registers. */
export const LiveRuntimeActiveContext = createContext(true);
export const LiveRuntimeConnectionContext = createContext(0);
export const useLiveRuntimeActive = () => useContext(LiveRuntimeActiveContext);

export function useRuntimeSnapshot(runtime: LiveLessonRuntime) {
  return useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getSnapshot);
}

/** Pass a stable mount/adapter. The returned runtime routes commands, never primitive-specific mutations. */
export function usePrimitiveRuntime(mount: RuntimeMount) {
  const runtime = useLiveRuntime();
  const active = useLiveRuntimeActive();
  const connection = useContext(LiveRuntimeConnectionContext);
  const current = useRef<ReturnType<LiveLessonRuntime['register']> | null>(null);
  useEffect(() => {
    if (!runtime || !active) return;
    const registration = runtime.register(mount);
    current.current = registration;
    return () => { current.current = null; registration.dispose(); };
  }, [runtime, mount, active, connection]);
  const changed = useCallback(() => current.current?.changed({ ifDifferent: true }) ?? false, []);
  return { runtime, changed };
}
