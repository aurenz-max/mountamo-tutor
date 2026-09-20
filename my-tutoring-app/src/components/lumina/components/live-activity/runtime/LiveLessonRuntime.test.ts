import { describe, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from './LiveLessonRuntime';
import { createRuntimeFixture } from './runtimeFixture';
import { parseTutorCommand, type ContrastPairSupport, type CounterSupport, type StepSequenceSupport, type TutorAction } from './contract';
import type { ComposedMove } from './moveContract';

const OPEN_LANE = { maxSupportLevel: 3, allowAnswerExposure: true, allowSupportArtifacts: true, allowGeneratedSupport: true };

/**
 * A mount in the open lane: it publishes what it draws, the models a support may use
 * instead, and its own answer sweep. That is the whole per-primitive cost of composed moves.
 */
function openLane(representations: { representation: string; alternateRepresentations: string[] }
    = { representation: 'reference-model', alternateRepresentations: ['counters', 'story-objects'] }) {
  const runtime = new LiveLessonRuntime('epoch-1', OPEN_LANE);
  const fixture = createRuntimeFixture();
  Object.assign(fixture.mount.adapter, representations,
    { drawsTask: (counts: readonly number[]) => [8, 3, 5].some(n => counts.includes(n)) }); // the reference item is 8 − 3
  const registration = runtime.register(fixture.mount);
  return { runtime, fixture, registration,
    scope: { instanceId: fixture.mount.instanceId, itemId: runtime.getSnapshot().task!.itemId } };
}

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

  it('mounts into an empty workspace while the tutor turn that requested it is still open', () => {
    const runtime = new LiveLessonRuntime('epoch-1');
    const release = runtime.holdTeachingTurn({ allowTutorActions: true });
    expect(() => runtime.register(createRuntimeFixture().mount)).not.toThrow();
    expect(runtime.getSnapshot().status).toBe('active');
    release();
  });

  it('advertises each prepared shape with what it is for', () => {
    const purposes = setup().runtime.getSnapshot().affordances.filter(a => a.action.type === 'request_support').map(a => a.purpose);
    expect(purposes).toEqual(['Worked example', 'Contrast', 'Step-by-step explanation']);
  });

  it('opens a drawn picture only for an adapter that can refuse its own answer, once, and returns intact', () => {
    const move: ComposedMove = { obstacle: 'does not connect taking away to anything real', delta: 'illustrate',
      representation: 'story-objects', nextAction: 'tell me how many apples are left',
      values: [9, 4], description: 'Nine apples in two rows with the last four crossed out.' };
    const png = 'data:image/png;base64,AAAA';
    // Off by policy, and off for an adapter that has not declared what it draws.
    const plain = setup(); const scopeOf = (s: ReturnType<typeof setup>) => ({ instanceId: s.fixture.mount.instanceId, itemId: s.runtime.getSnapshot().task!.itemId });
    expect(plain.runtime.composeMoveRefusal(scopeOf(plain), move)).toBe('Generated pictures are not enabled');
    const undeclared = setup(OPEN_LANE);
    expect(undeclared.runtime.getSnapshot().moveOptions).toBeNull();
    expect(undeclared.runtime.composeMoveRefusal(scopeOf(undeclared), move)).toContain('does not accept composed moves');

    const { runtime, fixture, registration, scope } = openLane();
    expect(runtime.getSnapshot().moveOptions).toEqual({
      // `attend` leads: it is the cheapest move and the only one that draws nothing.
      deltas: ['attend', 're-represent', 'contrast', 'model-process', 'illustrate'],
      representation: 'reference-model', alternateRepresentations: ['counters', 'story-objects'],
      attentionTargets: [
        { id: 'start', label: 'the number you started from', semanticRole: 'number-position', represents: 'start' },
        { id: 'jump', label: 'the jump you drew', semanticRole: 'jump', represents: 'minus-three' }] });
    expect(runtime.composeMoveRefusal(scope, { ...move, values: [8, 3] })).toContain('this task or its answer');
    expect(runtime.composeMoveRefusal(scope, move)).toBeNull(); // "two rows" in the prose is not a count
    expect(runtime.openComposedMove(scope, move, 'https://example.com/a.png').status).toBe('invalid');
    expect(runtime.openComposedMove(scope, move).status).toBe('invalid'); // illustrate without its picture
    fixture.respond('2'); registration.changed();
    const before = runtime.getSnapshot().task;
    expect(runtime.openComposedMove(scope, move, png).status).toBe('committed');
    const shown = runtime.getSnapshot();
    expect(shown.status).toBe('support');
    expect(shown.supportArtifact).toMatchObject({ kind: 'generated-image', altText: move.description, provenance: 'generated' });
    expect(JSON.stringify(shown)).not.toContain('base64'); // the wire packet is bounded; bytes stay in the runtime
    expect(runtime.getSupportImage(shown.supportArtifact!.id)).toBe(png);
    expect(fixture.suspended).toBe(true);
    // The tutor's own diagnosis is logged, which is how a recurring obstacle earns a prepared aid.
    expect(shown.assistance.at(-1)!.move).toEqual({ obstacle: move.obstacle, delta: 'illustrate',
      representation: 'story-objects', nextAction: move.nextAction });
    expect(runtime.dispatch({ sessionEpoch: 'epoch-1', commandId: 'back', ...scope, expectedRevision: shown.revision, action: { type: 'return' } }).status).toBe('committed');
    expect(runtime.getSnapshot().task).toEqual(before);
    expect(runtime.getSupportImage(shown.supportArtifact!.id)).toBeNull();
    expect(runtime.getSnapshot().moveOptions).toBeNull();
    expect(runtime.composeMoveRefusal(scope, move)).toBe('This item already had its one detour');
  });

  /**
   * The 2026-09-18 failure, as a unit test: a ten frame showing 4 drawn beside a child stuck
   * on a ten frame showing 3. Accurate, no answer leak, and it taught nothing. Only the
   * non-redundancy rule catches it, so it is the rule this runtime must never lose.
   */
  it('refuses a support that redraws the model already on screen, and accepts the same obstacle re-represented', () => {
    const { runtime, scope } = openLane({ representation: 'ten-frame', alternateRepresentations: ['counters', 'fingers'] });
    const stuck = { obstacle: 'cannot see how many more are needed', nextAction: 'count the empty spaces out loud', values: [4, 6] };
    const redraw: ComposedMove = { ...stuck, delta: 'illustrate', representation: 'ten-frame',
      description: 'A ten frame with four counters and six empty squares.' };
    expect(runtime.composeMoveRefusal(scope, redraw)).toContain('may not redraw the ten-frame already on screen');
    // Same obstacle, same numbers, a second model: allowed, and it commits at once.
    const second: ComposedMove = { ...stuck, delta: 're-represent', representation: 'counters', operation: 'make-ten' };
    expect(runtime.composeMoveRefusal(scope, second)).toBeNull();
    expect(runtime.openComposedMove(scope, second).status).toBe('committed');
    expect(runtime.getSnapshot().supportArtifact).toMatchObject({ kind: 'counter-example', operation: 'make-ten', total: 10, removed: 6 });
  });

  it('builds each composed carrier from the tutor numbers and refuses a payload the delta cannot draw', () => {
    const { runtime, scope } = openLane();
    const base = { obstacle: 'cannot tell which row has more', nextAction: 'point to the row with more', representation: 'counters' };
    expect(runtime.composeMoveRefusal(scope, { ...base, delta: 'contrast', values: [6, 6] })).toContain('two DIFFERENT counts');
    expect(runtime.composeMoveRefusal(scope, { ...base, delta: 'model-process', values: [6, 2] })).toContain('needs `operation`');
    expect(runtime.composeMoveRefusal(scope, { ...base, delta: 'model-process', values: [6, 2], operation: 'subtract',
      description: 'a picture' })).toContain('leave `description` out');
    expect(runtime.composeMoveRefusal(scope, { ...base, delta: 'illustrate', representation: 'counters', values: [6, 2],
      description: 'Six counters.' })).toContain('draws counters exactly and at once');

    expect(runtime.openComposedMove(scope, { ...base, delta: 'contrast', values: [6, 4] }).status).toBe('committed');
    const contrast = runtime.getSnapshot().supportArtifact as ContrastPairSupport;
    expect(contrast.panels).toEqual([{ kind: 'counters', label: '6', count: 6, highlighted: 2 },
      { kind: 'counters', label: '4', count: 4, highlighted: 0 }]);
    // Code writes the sentence from the numbers, so the tutor cannot narrate a relationship
    // the drawing does not hold.
    expect(contrast.caption).toBe('6 has 2 more than 4. The last 2 have no partner.');

    const process = openLane();
    expect(process.runtime.openComposedMove(process.scope, { ...base, delta: 'model-process', values: [6, 2], operation: 'subtract' }).status).toBe('committed');
    const steps = process.runtime.getSnapshot().supportArtifact as StepSequenceSupport;
    expect(steps.frames.map(f => f.caption)).toEqual(['Start with 6 counters.', 'Take away 2.', '4 counters are left.']);
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
    (fixture.mount.adapter.supportArtifacts![0] as CounterSupport).total = 1000;
    expect(() => runtime.register(fixture.mount)).toThrow('Invalid prepared counter example');
    expect(runtime.getSnapshot().status).toBe('empty');
    // The third shape too: a single frame is a picture, not a process.
    const stepped = new LiveLessonRuntime('newest'); const steps = createRuntimeFixture();
    (steps.mount.adapter.supportArtifacts![2] as StepSequenceSupport).frames.length = 1;
    expect(() => stepped.register(steps.mount)).toThrow('Invalid prepared step sequence');
    // The second shape is validated by its own rules: a ring wider than its row is structurally impossible.
    const other = new LiveLessonRuntime('newer'); const pair = createRuntimeFixture();
    (pair.mount.adapter.supportArtifacts![1] as ContrastPairSupport).panels[1].highlighted = 9;
    expect(() => other.register(pair.mount)).toThrow('Invalid prepared contrast pair');
    expect(other.getSnapshot().status).toBe('empty');
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

describe('attention — adapters describe, policy grants, the tutor requests', () => {
  const attend = (...targets: string[]): ComposedMove => ({
    obstacle: 'The child cannot tell where to resume',
    delta: 'attend', representation: 'reference-model',
    nextAction: 'Start counting again from what is ringed', values: [], targets,
  });

  it('advertises only the targets this item may use, not everything the adapter has', () => {
    const { runtime, fixture, registration } = openLane();
    // The adapter publishes three; the item assesses `count`, so the count target is withheld
    // BY POLICY, not by the adapter choosing to hide it.
    expect(fixture.mount.adapter.attentionTargets!().map(t => t.id)).toEqual(['start', 'jump', 'total']);
    expect(runtime.getSnapshot().moveOptions!.attentionTargets.map(t => t.id)).toEqual(['start', 'jump']);

    // Same adapter, same targets, different assessed dimension — the granted set moves with it.
    fixture.assess('jump');
    registration.changed();
    expect(runtime.getSnapshot().moveOptions!.attentionTargets.map(t => t.id)).toEqual(['start', 'total']);
  });

  it('refuses the SAME target on one assessment and permits it on another', () => {
    const { runtime, fixture, registration, scope } = openLane();
    expect(runtime.composeMoveRefusal(scope, attend('jump'))).toBeNull();

    fixture.assess('jump');
    registration.changed();
    const refusal = runtime.composeMoveRefusal(scope, attend('jump'));
    expect(refusal).toContain('ANSWER_REVEAL');
    expect(refusal).toContain('is a jump, which is exactly what this item asks the child to supply');

    // Nothing about the primitive changed. Only what is being assessed did.
    expect(runtime.composeMoveRefusal(scope, attend('total'))).toBeNull();
  });

  it('withdraws the whole assessed dimension, not merely the correct member of it', () => {
    const { runtime, fixture, registration, scope } = openLane();
    fixture.assess('number-position');
    registration.changed();
    // `start` is a number-position and is NOT the answer; ringing it is still refused, because
    // ringing a wrong member of the assessed dimension is misdirection rather than teaching.
    expect(runtime.composeMoveRefusal(scope, attend('start'))).toContain('ANSWER_REVEAL');
  });

  it('names an unknown target separately, and lists what is available', () => {
    const { runtime, scope } = openLane();
    const refusal = runtime.composeMoveRefusal(scope, attend('the-whole-screen'));
    expect(refusal).toContain('UNKNOWN_TARGET');
    expect(refusal).toContain('start (the number you started from)');
  });

  it('refuses one bad target in a set, rather than ringing the rest', () => {
    const { runtime, fixture, registration, scope } = openLane();
    expect(runtime.composeMoveRefusal(scope, attend('start', 'jump'))).toBeNull();
    fixture.assess('jump');
    registration.changed();
    expect(runtime.composeMoveRefusal(scope, attend('start', 'jump'))).toContain('ANSWER_REVEAL');
  });

  it('refuses an attend that tries to draw numbers, a process, or nothing at all', () => {
    const { runtime, scope } = openLane();
    expect(runtime.composeMoveRefusal(scope, { ...attend('start'), values: [4] })).toContain('leave `values` empty');
    expect(runtime.composeMoveRefusal(scope, { ...attend('start'), operation: 'count' })).toContain('leave `operation` out');
    expect(runtime.composeMoveRefusal(scope, { ...attend('start'), targets: [] })).toContain('needs `targets`');
  });

  it('rings a SET in place: same screen, nothing drawn, and no detour spent', () => {
    const { runtime, fixture, scope } = openLane();
    expect(runtime.openComposedMove(scope, attend('start', 'jump')).status).toBe('committed');
    const after = runtime.getSnapshot();
    expect(after.markedTargetIds).toEqual(['start', 'jump']);
    expect(after.supportArtifact).toBeNull();   // nothing new was drawn
    expect(after.status).toBe('active');         // the workspace never left
    expect(fixture.suspended).toBe(false);       // and was never suspended
    // The detour is still available: ringing is not rationed like a worked example.
    expect(runtime.composeMoveRefusal(scope, {
      obstacle: 'Still stuck', delta: 'contrast', representation: 'counters',
      nextAction: 'Say which row has more', values: [6, 4],
    })).toBeNull();
  });

  it('announces itself as a Highlight', () => {
    const { runtime, scope } = openLane();
    runtime.openComposedMove(scope, attend('start'));
    expect(runtime.getSnapshot().assistance.at(-1)!.announce)
      .toEqual({ label: 'Highlight', instruction: 'Start counting again from what is ringed' });
  });

  it('is unadvertised when the adapter addresses nothing', () => {
    const bare = openLane();
    delete bare.fixture.mount.adapter.attentionTargets;
    bare.registration.changed();
    expect(bare.runtime.getSnapshot().moveOptions!.deltas).not.toContain('attend');
  });
});
