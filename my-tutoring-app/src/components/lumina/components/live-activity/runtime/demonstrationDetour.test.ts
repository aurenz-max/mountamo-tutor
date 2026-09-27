/**
 * LA-15: a demonstration detour opens on any mounted item that can pause, with no
 * per-primitive code, and returns to the same unfinished work.
 */
import { describe, expect, it } from 'vitest';
import { LiveLessonRuntime } from './LiveLessonRuntime';
import { createRuntimeFixture } from './runtimeFixture';
import { RuntimeTransport, type DemonstrationNeed } from './runtimeTransport';
import { buildDemonstration } from '../demo/demoContract';
import { demonstrationEvidence, describeEvidence } from '../demo/demonstrationEvidence';

// The lesson host's policy: prepared supports and composed moves stay off; demonstrations on.
const LESSON = { maxSupportLevel: 3, allowAnswerExposure: true, allowSupportArtifacts: false, allowDemonstrations: true };
const demo = buildDemonstration({ piece: 'number-line', operation: 'subtract', values: [14, 4], focus: 'the first hop', studentValues: [8, 3] });
const need: DemonstrationNeed = { note: 'asked to be shown' };
const diagnosis = 'Counts the starting number as the first hop.';

function setup(policy = LESSON) {
  const runtime = new LiveLessonRuntime('lesson', policy);
  const fixture = createRuntimeFixture();
  const registration = runtime.register(fixture.mount);
  const scope = { instanceId: fixture.mount.instanceId, itemId: runtime.getSnapshot().task!.itemId };
  return { runtime, fixture, registration, scope };
}

describe('demonstration detour', () => {
  it('publishes availability only where the host enables it', () => {
    expect(setup().runtime.getSnapshot().canRequestDemonstration).toBe(true);
    const off = setup({ ...LESSON, allowDemonstrations: false });
    expect('canRequestDemonstration' in off.runtime.getSnapshot()).toBe(false);
    expect(off.runtime.demonstrationRefusal(off.scope)).toBe('Demonstrations are not enabled');
  });

  it('suspends the work, shows the demonstration ungraded, and returns to the same item', () => {
    const { runtime, fixture, scope } = setup();
    expect(runtime.openDemonstration(scope, demo, diagnosis).status).toBe('committed');
    const open = runtime.getSnapshot();
    expect(fixture.suspended).toBe(true);
    expect(open.status).toBe('support');
    expect(open.supportArtifact?.kind).toBe('demonstration');
    expect(open.supportArtifact?.altText).toContain('Step 2: Hop 1 moves one back and lands on 13.');
    expect(open.supportArtifact).toMatchObject({ kind: 'demonstration', diagnosis });
    expect(open.canRequestDemonstration).toBe(false);
    // Recorded as assistance on the item, never as an attempt.
    expect(open.assistance.at(-1)).toMatchObject({ itemId: scope.itemId, level: 6, move: { obstacle: diagnosis, delta: 'model-process', representation: 'number-line' } });
    expect(open.task?.evidence.attemptNumber).toBe(1);
    expect(open.affordances.map(a => a.action.type)).toEqual(['return']);
    const back = runtime.dispatch({ sessionEpoch: 'lesson', commandId: 'return', instanceId: scope.instanceId, itemId: scope.itemId,
      expectedRevision: open.revision, action: { type: 'return' } });
    expect(back.status).toBe('committed');
    expect(fixture.suspended).toBe(false);
    expect(runtime.getSnapshot().status).toBe('active');
    expect(runtime.getSnapshot().task?.itemId).toBe(scope.itemId);
    // One detour per item.
    expect(runtime.demonstrationRefusal(scope)).toBe('This item already had its one detour');
    expect(runtime.getSnapshot().canRequestDemonstration).toBe(false);
  });

  it('refuses a stale item and an activity that cannot pause', () => {
    const { runtime, fixture, scope } = setup();
    expect(runtime.demonstrationRefusal({ ...scope, itemId: 'other' })).toContain('task changed');
    const stuck = setup();
    delete (stuck.fixture.mount.adapter as { suspension?: unknown }).suspension;
    stuck.registration.changed();
    expect(stuck.runtime.demonstrationRefusal(stuck.scope)).toContain('cannot pause');
    expect(fixture.suspended).toBe(false);
  });
});

describe('transport', () => {
  function transport() {
    const s = setup();
    const sent: Record<string, any>[] = [];
    return { ...s, sent, t: new RuntimeTransport(s.runtime, m => sent.push(m)) };
  }

  it('authors, commits and reports visible only after paint', async () => {
    const s = transport();
    const pending = s.t.requestDemonstration('d', s.scope, need, async received => {
      expect(received).toEqual(need);
      return { demonstration: demo, diagnosis };
    });
    await Promise.resolve(); await Promise.resolve();
    expect(s.runtime.getSnapshot().status).toBe('support');
    expect(s.sent.some(m => m.type === 'runtime_result')).toBe(false);
    s.runtime.acknowledgeVisible(s.runtime.getSnapshot().revision);
    await pending;
    expect(s.sent.at(-1)).toMatchObject({ type: 'runtime_result', commandId: 'd', status: 'visible' });
    s.t.close();
  });

  it('turns an author that finds no piece into a refusal the tutor can act on, without suspending', async () => {
    const s = transport();
    await s.t.requestDemonstration('d', s.scope, need, async () => ({ refused: 'No drawn demonstration fits this step.', diagnosis }));
    // The diagnosis still reaches the tutor, so it can teach the step in words.
    expect(s.sent.at(-1)).toMatchObject({ status: 'unsupported', reason: `No drawn demonstration fits this step. What the learner's answers show: ${diagnosis}` });
    expect(s.runtime.trace.getSnapshot().at(-1)).toMatchObject({ stage: 'demonstration', status: 'none', reason: diagnosis });
    expect(s.fixture.suspended).toBe(false);
    s.t.close();
  });

  it('does not open a demonstration for a task that changed while it was being authored', async () => {
    const s = transport();
    await s.t.requestDemonstration('d', s.scope, need, async () => {
      s.fixture.respond('5'); s.registration.changed(); // correct: the item advances under the tutor
      s.runtime.dispatch({ sessionEpoch: 'lesson', commandId: 'adv', instanceId: s.scope.instanceId, itemId: s.scope.itemId,
        expectedRevision: s.runtime.getSnapshot().revision, action: { type: 'advance' } });
      return { demonstration: demo, diagnosis };
    });
    expect(s.sent.at(-1)).toMatchObject({ status: 'blocked', reason: 'The task changed; use the refreshed state' });
    expect(s.fixture.suspended).toBe(false);
    s.t.close();
  });
});

describe('evidence', () => {
  it('reads the task and every response on this item from the snapshot, naming no primitive', () => {
    const { runtime, fixture, registration } = setup();
    fixture.respond('6'); registration.changed();
    const evidence = demonstrationEvidence(runtime.getSnapshot())!;
    expect(evidence).toMatchObject({ primitiveId: 'runtime-reference', evalMode: 'reference-only', task: 'Find 8 minus 3.',
      facts: { operation: 'subtraction', steps: 1 } });
    expect(evidence.attempts.map(a => a.response)).toEqual(['6']);
    expect(describeEvidence(evidence).split(String.fromCharCode(10)).slice(-2))
      .toEqual(["LEARNER'S RESPONSES ON THIS ITEM (oldest first):", '  1. 6 (incorrect)']);
  });

  it('is empty before anything is mounted', () => {
    expect(demonstrationEvidence(new LiveLessonRuntime('none', LESSON).getSnapshot())).toBeNull();
  });
});
