import { describe, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from './LiveLessonRuntime';
import { createRuntimeFixture } from './runtimeFixture';
import { parseTutorCommand, type TutorAction } from './contract';

function setup(options = { maxSupportLevel: 3, allowAnswerExposure: true, allowSupportArtifacts: true }) {
  const runtime = new LiveLessonRuntime('epoch-1', options);
  const fixture = createRuntimeFixture();
  const registration = runtime.register(fixture.mount);
  let seq = 0;
  const command = (action: TutorAction) => ({ sessionEpoch: 'epoch-1', commandId: `command-${++seq}`,
    instanceId: fixture.mount.instanceId, itemId: runtime.getSnapshot().task!.itemId,
    expectedRevision: runtime.getSnapshot().revision, action });
  const act = (action: TutorAction) => runtime.dispatch(command(action));
  const respond = (answer: string) => { fixture.respond(answer); registration.changed(); };
  return { runtime, fixture, registration, command, act, respond };
}

describe('mounted live lesson authority', () => {
  it('counts a new checked response even when the learner does not ask for a retry tool', () => {
    const s = setup(); s.respond('2'); s.respond('5');
    expect(s.runtime.getSnapshot().task?.evidence.attemptNumber).toBe(2);
    expect(s.runtime.getSnapshot().task?.evidence.recentResponses).toHaveLength(2);
  });
  it('rejects untyped actions, missing scope, arbitrary parameters and invalid revisions', () => {
    const s = setup();
    const c = s.command({ type: 'replay' });
    for (const value of [null, {}, { ...c, expectedRevision: -1 }, { ...c, itemId: '' },
      { ...c, action: { type: 'skip', correct: true } }, { ...c, action: { type: 'replay', increment: 4 } },
      { ...c, capabilities: ['advance'] }]) expect(parseTutorCommand(value)).toBeNull();
    expect(s.runtime.dispatch(null).status).toBe('invalid');
  });

  it('executes once, rejects duplicate IDs and rejects ID reuse with changed content', () => {
    const s = setup(); const c = s.command({ type: 'replay' });
    expect(s.runtime.dispatch(c).status).toBe('committed');
    expect(s.runtime.dispatch(c).status).toBe('duplicate');
    expect(s.runtime.dispatch({ ...c, action: { type: 'retry' } }).status).toBe('conflict');
    expect(s.fixture.replays).toBe(1);
  });

  it('rejects stale epoch, instance, item and learner revision with refreshed choices', () => {
    const s = setup();
    for (const patch of [{ sessionEpoch: 'old' }, { instanceId: 'other' }, { itemId: 'other' }, { expectedRevision: 0 }]) {
      expect(s.runtime.dispatch({ ...s.command({ type: 'replay' }), ...patch }).status).toBe('stale');
    }
    const late = s.command({ type: 'replay' }); s.respond('2');
    const result = s.runtime.dispatch(late);
    expect(result.status).toBe('stale');
    expect(result.state.affordances.some(a => a.action.type === 'retry')).toBe(true);
    expect(s.fixture.replays).toBe(0);
  });

  it('uses actual phase-valid handlers, leaves a productive learner alone, and never treats an advance as correctness', () => {
    const s = setup(); const before = s.runtime.getSnapshot();
    expect(s.act({ type: 'advance' }).status).toBe('unsupported');
    expect(s.runtime.getSnapshot()).toBe(before);
    s.respond('2'); expect(s.act({ type: 'retry' }).status).toBe('committed');
    expect(s.runtime.getSnapshot().task?.evidence.attemptNumber).toBe(2);
    s.respond('5'); expect(s.act({ type: 'advance' }).status).toBe('committed');
    expect(s.runtime.getSnapshot().task?.evidence.correctness).toBe('unknown');
    expect(s.runtime.getSnapshot().task?.itemId).toBe('reference-item-2');
  });

  it('records scaffold and fade without erasing assistance, responses or demand', () => {
    const s = setup(); s.respond('2');
    const task = s.runtime.getSnapshot().task!;
    expect(s.act({ type: 'scaffold', strategyId: 'direction', direction: 1 }).status).toBe('committed');
    expect(s.act({ type: 'scaffold', strategyId: 'direction', direction: 1 }).status).toBe('unsupported');
    s.act({ type: 'scaffold', strategyId: 'direction', direction: -1 });
    const after = s.runtime.getSnapshot();
    expect(after.task?.support.level).toBe(0);
    expect(after.assistance.map(a => a.level)).toEqual([3, 0]);
    expect(after.task?.evidence).toEqual(task.evidence);
    expect(after.task?.demand).toEqual(task.demand);
  });

  it('enforces host assistance policy, including answer exposure and unsupported suspension', () => {
    const s = setup({ maxSupportLevel: 2, allowAnswerExposure: false, allowSupportArtifacts: true });
    expect(s.act({ type: 'scaffold', strategyId: 'direction', direction: 1 }).status).toBe('unsupported');
    expect(s.act({ type: 'request_support', artifactId: 'seven-take-two' }).status).toBe('unsupported');
    const t = setup(); delete t.fixture.mount.adapter.suspension;
    t.registration.changed();
    expect(t.act({ type: 'request_support', artifactId: 'seven-take-two' }).status).toBe('unsupported');
  });

  it('preserves the parent, cancels stale work, returns with a new revision and bounds help to one detour per item', () => {
    const s = setup(); s.respond('2');
    const before = s.runtime.getSnapshot();
    const pending = s.fixture.pendingResponse('5');
    const oldCommand = s.command({ type: 'replay' });
    expect(s.act({ type: 'request_support', artifactId: 'seven-take-two' }).status).toBe('committed');
    expect(s.fixture.suspended).toBe(true);
    expect(s.runtime.getSnapshot().affordances.map(a => a.action.type)).toEqual(['return']);
    expect(s.fixture.respond('5')).toBe(false);
    expect(s.act({ type: 'return' }).status).toBe('committed');
    expect(s.fixture.suspended).toBe(false);
    expect(pending()).toBe(false);
    expect(s.runtime.dispatch(oldCommand).status).toBe('stale');
    expect(s.runtime.getSnapshot().task).toEqual(before.task);
    expect(s.runtime.getSnapshot().instanceId).toBe(before.instanceId);
    expect(s.runtime.getSnapshot().assistance[0].answerExposure).toBe('full');
    expect(s.act({ type: 'request_support', artifactId: 'seven-take-two' }).status).toBe('unsupported');
  });

  it('withholds ownership until all teaching turns settle, including the audible tail', () => {
    const s = setup(); const endModelTurn = s.runtime.holdTeachingTurn(); const endAudioTail = s.runtime.holdTeachingTurn();
    expect(s.runtime.grantOwnership('runner')).toBe(false);
    endModelTurn();
    expect(s.runtime.grantOwnership('runner')).toBe(false);
    expect(s.act({ type: 'replay' }).status).toBe('blocked');
    endAudioTail(); expect(s.runtime.grantOwnership('runner')).toBe(true);
    expect(s.runtime.getSnapshot().affordances).toEqual([]);
    expect(s.act({ type: 'replay' }).status).toBe('blocked');
    expect(() => s.runtime.register(createRuntimeFixture('other').mount)).toThrow();
    expect(s.runtime.grantOwnership('tutor')).toBe(true);
  });

  it('reports terminal completion once after closing speech and only then permits the next mount', () => {
    const s = setup(); const onComplete = vi.fn(); s.runtime.onCompletion(onComplete);
    expect(s.runtime.requestCompletion()).toBe(false);
    s.respond('5'); s.act({ type: 'advance' }); s.respond('7');
    const settle = s.runtime.holdTeachingTurn();
    expect(s.runtime.requestCompletion()).toBe(true);
    expect(s.runtime.getSnapshot().status).toBe('closing');
    expect(s.runtime.getSnapshot().canStartNext).toBe(false);
    expect(onComplete).not.toHaveBeenCalled();
    settle(); settle();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(s.runtime.requestCompletion()).toBe(false);
    expect(s.runtime.getSnapshot().canStartNext).toBe(true);
    s.runtime.register(createRuntimeFixture('next').mount);
    s.registration.dispose(); // Late old cleanup must not remove the new registration.
    expect(s.runtime.getSnapshot().instanceId).toBe('next');
  });

  it('separates commit and exact rendered revision acknowledgement', () => {
    const s = setup(); const r = s.act({ type: 'point', targetId: 'start' });
    expect(r.state.visibleRevision).toBeNull();
    expect(s.runtime.acknowledgeVisible(r.state.revision - 1)).toBe(false);
    expect(s.runtime.acknowledgeVisible(r.state.revision)).toBe(true);
    expect(s.runtime.getSnapshot().visibleRevision).toBe(r.state.revision);
    s.respond('2');
    expect(s.runtime.acknowledgeVisible(r.state.revision)).toBe(false);
  });

  it('stops during runner judgment or support without completion or next-item permission', () => {
    for (const support of [true, false]) {
      const s = setup(); const complete = vi.fn(); s.runtime.onCompletion(complete);
      if (support) s.act({ type: 'request_support', artifactId: 'seven-take-two' });
      else s.runtime.grantOwnership('runner');
      s.runtime.stop();
      expect(s.runtime.getSnapshot().status).toBe('stopped');
      expect(s.runtime.getSnapshot().canStartNext).toBe(false);
      expect(s.fixture.respond('5')).toBe(false);
      expect(complete).not.toHaveBeenCalled();
    }
  });

  it('fails closed on handler failure and invalid support content', () => {
    const s = setup();
    s.fixture.mount.adapter.getAffordances = () => [{ action: { type: 'replay' }, description: 'Broken', execute: () => { throw new Error('failure'); } }];
    expect(s.act({ type: 'replay' }).status).toBe('failed');
    expect(s.runtime.getSnapshot().status).toBe('faulted');
    expect(s.runtime.getSnapshot().affordances).toEqual([]);
    const runtime = new LiveLessonRuntime('new'); const fixture = createRuntimeFixture();
    fixture.mount.adapter.supportArtifacts![0].total = 1000;
    expect(() => runtime.register(fixture.mount)).toThrow('Invalid prepared counter example');
    expect(runtime.getSnapshot().status).toBe('empty');
  });

  it('does not report success or assistance when the primitive refuses its own transition', () => {
    const s = setup();
    s.fixture.mount.adapter.getAffordances = () => [{ action: { type: 'replay' }, description: 'Unavailable now',
      assistance: { level: 1, answerExposure: 'none' }, execute: () => false }];
    const receipt = s.act({ type: 'replay' });
    expect(receipt.status).toBe('blocked');
    expect(receipt.state.assistance).toEqual([]);
    expect(s.fixture.replays).toBe(0);
  });

  it('keeps public receipts immutable and omits executable functions from context packets', () => {
    const s = setup();
    expect(() => { s.runtime.getSnapshot().affordances.length = 0; }).toThrow();
    expect(s.runtime.getSnapshot().affordances.every(a => !('execute' in a))).toBe(true);
    expect(() => JSON.stringify(s.runtime.getSnapshot())).not.toThrow();
  });
});
