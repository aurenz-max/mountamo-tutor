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

it('counts one settled tutor turn per held turn, however many output chunks and audio-idle events arrive', () => {
  const s = setup();
  s.transport.beginTurn('Count '); s.transport.beginTurn('the blocks.');
  s.transport.endTurn(true); s.transport.audioChanged(false); s.transport.audioChanged(false); s.transport.audioChanged(false);
  expect(s.runtime.learner.read(s.runtime.getSnapshot())!.tutorTurns).toBe(1);
  s.transport.beginTurn('Try again.'); s.transport.endTurn(false); s.transport.audioChanged(false);
  expect(s.runtime.learner.read(s.runtime.getSnapshot())!.tutorTurns).toBe(2);
  // The fixture is a legacy adapter, not a shared workspace, so its packet is unchanged.
  expect('learner' in (s.sent.filter(m => m.type === 'runtime_state').at(-1)!.state as object)).toBe(false);
  s.transport.close();
});

/**
 * di-word-reading 2026-11-13: four "what?" turns on one unread word pulled four levers (fox card, blend slide, sound
 * dots, arrow), and a held "point to the card" message went out over the learner's right answer.
 */
function leverSetup(classifyLearner: any = () => new Promise<never>(() => {})) {
  const levers = [
    { id: 'model_word', kind: 'help', pulled: false, answers: [], when: '', does: 'A card.' },
    { id: 'blend_slide', kind: 'help', pulled: false, answers: [], when: '', does: 'Slides.' },
    { id: 'sound_dots', kind: 'help', pulled: false, answers: [], when: '', does: 'Dots.' },
  ];
  const attempts: { itemId: string; correct: boolean }[] = [];
  let revision = 1;
  const trace: { stage: string; status: string }[] = [];
  const snapshot = () => ({ sessionEpoch: 'e', instanceId: 'i', status: 'active', revision, visibleRevision: revision,
    task: { itemId: 'cat', phase: 'working', evidence: { attemptNumber: attempts.length },
      workspace: { progression: 'observer', levers: levers.map(l => ({ ...l })), attempts } },
    affordances: [{ action: { type: 'workspace', operation: 'pull_lever' } }] }) as any;
  const runtime = {
    getSnapshot: snapshot, subscribe: () => () => {}, acceptsMissFromWords: () => false,
    trace: { record: (r: any) => trace.push(r) },
    dispatch: (input: any) => {
      levers.find(l => l.id === input.action.input.lever)!.pulled = true; revision++;
      return { status: 'committed', commandId: input.commandId, state: snapshot() };
    },
    confirmVisibleResponse: () => {},
    learner: { intent: () => false, learnerFinished: () => {}, read: () => null, observations: () => [], tutorSettled: () => {} },
    speech: { output: () => {}, end: () => {}, audio: () => {} },
    holdTeachingTurn: () => () => {},
  } as any;
  const sent: Record<string, any>[] = [];
  const never = () => new Promise<never>(() => {});
  const transport = new RuntimeTransport(runtime, m => sent.push(m), never as any, classifyLearner);
  return { transport, levers, attempts, trace, sent };
}

it('pulls no lever from a learner turn read as a help request: help comes from wrong answers (USER 2026-11-13)', async () => {
  const s = leverSetup(async () => ({ asksForHelp: .95, wantsToStop: .02, attemptsAnswer: .05, accepted: true, reason: 'observed', ms: 1 }));
  s.transport.learnerText('¿Qué?', true);
  await new Promise(r => setTimeout(r, 0));
  expect(s.trace.some(t => t.stage === 'learner_intent' && t.status === 'observed')).toBe(true);
  expect(s.levers.some(l => l.pulled)).toBe(false);
  s.transport.close();
});

it('drops the held lever announcement when the learner speaks before it goes out', async () => {
  const s = leverSetup();
  s.transport.beginTurn('Let us look.');
  await s.transport.pullLever('help');
  s.transport.learnerText('cat', false);
  s.transport.endTurn(false); s.transport.audioChanged(false);
  expect(s.sent.filter(m => m.type === 'text')).toHaveLength(0);
  expect(s.trace.some(t => t.status === 'superseded')).toBe(true);
  s.transport.close();
});

it('still sends the announcement when the learner stays quiet', async () => {
  const s = leverSetup();
  s.transport.beginTurn('Let us look.');
  await s.transport.pullLever('help');
  s.transport.endTurn(false); s.transport.audioChanged(false);
  expect(s.sent.filter(m => m.type === 'text')).toHaveLength(1);
  s.transport.close();
});
