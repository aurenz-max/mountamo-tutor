'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { PipSurfaceStore, type PipSurface, type PipTarget } from './PipSurfaceStore';

export const PipSurfaceContext = createContext<PipSurfaceStore | null>(null);
const noopSubscribe = () => () => {};
const zero = () => 0;

export function usePipSurfaceStore() { return useContext(PipSurfaceContext); }

export function usePipScene() {
  const store = usePipSurfaceStore();
  useSyncExternalStore(store?.subscribe ?? noopSubscribe, store?.getSnapshot ?? zero, zero);
  return { store, surface: store?.getActive() ?? null };
}

/** Publish after every commit, when DOM/SVG refs point at the rendered objects.
 * The builder is re-run each commit and the store ignores an unchanged surface,
 * so there is no dependency list to keep in sync with the pose inputs.
 */
export function usePipSurface(build: () => PipSurface | null) {
  const store = usePipSurfaceStore();
  const registered = useRef<PipSurface | null>(null);
  useEffect(() => {
    const surface = build();
    if (!store) return;
    const old = registered.current;
    if (old && (!surface || old.instanceId !== surface.instanceId || old.dock !== surface.dock)) {
      store.remove(old.instanceId, old.dock);
    }
    registered.current = surface;
    if (surface) store.publish(surface);
  });
  useEffect(() => () => {
    const old = registered.current;
    if (old) store?.remove(old.instanceId, old.dock);
  }, [store]);
  return store;
}

/** The element registry and the child's last touch, scoped to one item.
 * `ref(id)` is stable per id; `look(id)` records a touch only while `canTouch`
 * (pass the primitive's existing attempt gate); `targets(ids?)` returns what is
 * mounted right now, optionally restricted to the ids the primitive says are visible.
 */
export function usePipTargets(scopeId: string | null, canTouch: boolean) {
  const dock = useRef<HTMLDivElement>(null);
  const elements = useRef(new Map<string, Element>());
  const refs = useRef(new Map<string, (element: Element | null) => void>());
  const [touched, setTouched] = useState<{ scopeId: string; id: string } | null>(null);

  const ref = useCallback((id: string) => {
    let callback = refs.current.get(id);
    if (!callback) {
      callback = (element) => {
        if (element) elements.current.set(id, element);
        else elements.current.delete(id);
      };
      refs.current.set(id, callback);
    }
    return callback;
  }, []);

  const look = (id: string) => {
    if (scopeId && canTouch) setTouched({ scopeId, id });
  };

  const targets = (ids?: string[], label: (id: string) => string = (id) => id): PipTarget[] =>
    (ids ?? Array.from(elements.current.keys())).flatMap((id) => {
      const element = elements.current.get(id);
      return element?.isConnected ? [{ id, label: label(id), element }] : [];
    });

  const clear = useCallback(() => setTouched(null), []);

  return {
    dock, ref, look, targets, clear,
    lastTouchedId: touched && touched.scopeId === scopeId ? touched.id : undefined,
  };
}
