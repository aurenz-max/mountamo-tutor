import type { LiveLessonRuntime } from './LiveLessonRuntime';
import type { RuntimeSnapshot } from './contract';

export interface VisibilityReceipt {
  status: 'visible' | 'superseded' | 'timeout' | 'cancelled';
  state: RuntimeSnapshot;
  elapsedMs: number;
}

/** Transport must await this before claiming a committed command is on screen. Never applies a mutation. */
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
    const inspect = () => {
      const state = runtime.getSnapshot();
      if (state.revision !== revision) finish('superseded');
      else if (state.visibleRevision === revision) finish('visible');
    };
    unsubscribe = runtime.subscribe(inspect);
    timer = setTimeout(() => finish('timeout'), timeoutMs);
    options.signal?.addEventListener('abort', cancelled, { once: true });
    if (options.signal?.aborted) cancelled();
    else inspect();
  });
}
