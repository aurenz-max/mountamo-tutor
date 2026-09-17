import { afterEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from './LiveLessonRuntime';
import { createRuntimeFixture } from './runtimeFixture';
import { waitForVisible } from './waitForVisible';

afterEach(() => vi.useRealTimers());

it('requires the exact host acknowledgement, including when already rendered', async () => {
  const runtime = new LiveLessonRuntime('test'); runtime.register(createRuntimeFixture().mount);
  const revision = runtime.getSnapshot().revision;
  const waiting = waitForVisible(runtime, revision);
  runtime.acknowledgeVisible(revision);
  expect((await waiting).status).toBe('visible');
  expect((await waitForVisible(runtime, revision)).status).toBe('visible');
});

it('discards a render wait after a learner transition or unmount', async () => {
  const runtime = new LiveLessonRuntime('test'); const registration = runtime.register(createRuntimeFixture().mount);
  const waiting = waitForVisible(runtime, runtime.getSnapshot().revision);
  registration.changed();
  expect((await waiting).status).toBe('superseded');
  const unmount = waitForVisible(runtime, runtime.getSnapshot().revision);
  registration.dispose();
  expect((await unmount).status).toBe('superseded');
});

it('bounds waits and cleans up cancelled waits, including pre-aborted requests', async () => {
  vi.useFakeTimers();
  const runtime = new LiveLessonRuntime('test'); runtime.register(createRuntimeFixture().mount);
  const revision = runtime.getSnapshot().revision;
  const waiting = waitForVisible(runtime, revision, { timeoutMs: 20 });
  await vi.advanceTimersByTimeAsync(20);
  expect((await waiting).status).toBe('timeout');
  const abort = new AbortController();
  const cancelled = waitForVisible(runtime, revision, { signal: abort.signal });
  abort.abort();
  expect((await cancelled).status).toBe('cancelled');
  expect((await waitForVisible(runtime, revision, { signal: abort.signal })).status).toBe('cancelled');
  expect(vi.getTimerCount()).toBe(0);
});
