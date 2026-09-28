import type { LiveLessonRuntime } from './LiveLessonRuntime';
import type { RuntimeSnapshot } from './contract';

export interface VisibilityReceipt {
  status: 'visible' | 'superseded' | 'timeout' | 'cancelled';
  state: RuntimeSnapshot;
  elapsedMs: number;
}

/** What a render wait is about: the mounted activity, its status, and the item and phase on screen. */
const scopeOf = (s: RuntimeSnapshot) => s.instanceId === null ? null
  : JSON.stringify([s.instanceId, s.status, s.task?.itemId ?? null, s.task?.phase ?? null]);

/**
 * Transport must await this before claiming a committed command is on screen. Never applies a mutation.
 *
 * A later revision on the same activity, status, item and phase (a scene fact or lever republished after
 * the commit) does not supersede the wait: the command's result is still what is on screen, so the wait
 * moves to that revision and resolves when the host renders it. Anything else, a new item, a checked
 * answer, completion or an unmount, supersedes it (handoff 19, slice 2).
 */
export function waitForVisible(runtime: LiveLessonRuntime, revision: number,
  options: { timeoutMs?: number; signal?: AbortSignal } = {}): Promise<VisibilityReceipt> {
  const started = performance.now();
  const requestedTimeout = options.timeoutMs ?? 1000;
  const timeoutMs = Number.isFinite(requestedTimeout) ? Math.max(1, Math.min(5000, requestedTimeout)) : 1000;
  return new Promise(resolve => {
    let done = false;
    let unsubscribe = () => {};
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (status: VisibilityReceipt['status']) => {
      if (done) return;
      done = true;
      unsubscribe();
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', cancelled);
      resolve({ status, state: runtime.getSnapshot(), elapsedMs: performance.now() - started });
    };
    const cancelled = () => finish('cancelled');
    const initial = runtime.getSnapshot();
    const scope = initial.revision === revision ? scopeOf(initial) : null;
    let awaited = revision;
    const inspect = () => {
      const state = runtime.getSnapshot();
      if (state.revision !== awaited) {
        if (state.revision < awaited || scope === null || scopeOf(state) !== scope) return finish('superseded');
        awaited = state.revision;
      }
      if (state.visibleRevision === awaited) finish('visible');
    };
    unsubscribe = runtime.subscribe(inspect);
    timer = setTimeout(() => finish('timeout'), timeoutMs);
    options.signal?.addEventListener('abort', cancelled, { once: true });
    if (options.signal?.aborted) cancelled();
    else inspect();
  });
}
