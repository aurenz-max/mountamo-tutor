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

it('follows a later render of the same item and phase, and is superseded by a new phase or an unmount', async () => {
  const fixture = createRuntimeFixture();
  let phase = 'answer';
  const runtime = new LiveLessonRuntime('test');
  const registration = runtime.register({ ...fixture.mount, adapter: { ...fixture.mount.adapter,
    getTutorState: () => ({ ...fixture.mount.adapter.getTutorState(), phase }) } });
  // A scene republished after the commit (handoff 19, slice 2): the command's result is still on screen.
  const republished = waitForVisible(runtime, runtime.getSnapshot().revision);
  registration.changed();
  runtime.acknowledgeVisible(runtime.getSnapshot().revision);
  expect((await republished).status).toBe('visible');
  registration.changed();
  const checked = waitForVisible(runtime, runtime.getSnapshot().revision);
  phase = 'checked';
  registration.changed();
  expect((await checked).status).toBe('superseded');
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
