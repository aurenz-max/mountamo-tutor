import { expect, it } from 'vitest';
import { LiveLessonRuntime } from './LiveLessonRuntime';
import { createRuntimeFixture } from './runtimeFixture';
import { RuntimeTransport, runtimePacket } from './runtimeTransport';

function setup() {
  const runtime = new LiveLessonRuntime('test', { maxSupportLevel: 3, allowAnswerExposure: true, allowSupportArtifacts: true });
  const fixture = createRuntimeFixture();
  const registration = runtime.register(fixture.mount);
  const sent: Record<string, any>[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m));
  const command = () => ({ sessionEpoch: 'test', commandId: 'c', instanceId: fixture.mount.instanceId,
    itemId: runtime.getSnapshot().task!.itemId, expectedRevision: runtime.getSnapshot().revision,
    action: { type: 'point', targetId: 'start' } });
  return { runtime, fixture, registration, sent, transport, command };
}

it('allows the tutor tool within its own speech turn without changing command scope, while holding handoff', async () => {
  const s = setup(); const c = s.command();
  s.transport.beginTurn();
  expect(s.runtime.getSnapshot().revision).toBe(c.expectedRevision);
  expect(s.runtime.grantOwnership('runner')).toBe(false);
  const pending = s.transport.command(c);
  expect(s.fixture.pointed).toBe(true);
  expect(s.sent.some(m => m.type === 'runtime_result')).toBe(false);
  s.runtime.acknowledgeVisible(s.runtime.getSnapshot().revision);
  await pending;
  expect(s.sent.at(-1)?.status).toBe('visible');
  s.transport.endTurn(true);
  expect(s.runtime.grantOwnership('runner')).toBe(false);
  s.transport.audioChanged(false);
  expect(s.runtime.grantOwnership('runner')).toBe(true);
  s.transport.close();
});

it('cancels pending visibility without claiming rollback and never sends a late success', async () => {
  const s = setup(); const pending = s.transport.command(s.command());
  s.transport.cancel('c'); await pending;
  expect(s.fixture.pointed).toBe(true);
  expect(s.sent.some(m => m.type === 'runtime_result')).toBe(false);
  s.transport.close();
});

it('does not turn an old epoch command into a current command and publishes semantic choices', async () => {
  const s = setup();
  await s.transport.command({ ...s.command(), sessionEpoch: 'old' });
  expect(s.sent.at(-1)?.status).toBe('stale');
  expect(s.fixture.pointed).toBe(false);
  const packet = runtimePacket(s.runtime.getSnapshot());
  expect(packet.choices[0].actionId).toBe(`test/${packet.revision}/0`);
  s.fixture.respond('2'); s.registration.changed();
  expect(runtimePacket(s.runtime.getSnapshot()).choices[0].actionId).not.toBe(packet.choices[0].actionId);
  expect(packet.choices.every(c => !('execute' in c))).toBe(true);
  s.transport.close();
});

it('versions a learner transition even when an audio event publishes before the React commit effect', () => {
  const s = setup(), prior = s.runtime.getSnapshot().revision;
  s.fixture.respond('2');
  s.transport.beginTurn();
  expect(s.runtime.getSnapshot().revision).toBeGreaterThan(prior);
  const published = s.runtime.getSnapshot().revision;
  s.registration.changed({ ifDifferent: true });
  expect(s.runtime.getSnapshot().revision).toBe(published);
  s.transport.close();
});
