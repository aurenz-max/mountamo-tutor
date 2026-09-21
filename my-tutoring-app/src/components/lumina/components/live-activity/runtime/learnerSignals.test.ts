import { expect, it } from 'vitest';
import { LearnerSignalTracker } from './learnerSignals';
import type { RuntimeSnapshot } from './contract';
import type { LearnerObservation } from './learnerIntentContract';

type Attempt = NonNullable<NonNullable<RuntimeSnapshot['task']>['workspace']>['attempts'][number];
function snapshot(itemId = 'one', patch: { ready?: boolean; attempts?: Attempt[]; level?: number; status?: RuntimeSnapshot['status'] } = {}): RuntimeSnapshot {
  const attempts = patch.attempts ?? [];
  return { sessionEpoch: 's', revision: 1, visibleRevision: 1, instanceId: 'board', planItemId: 'p', primitiveId: 'counting-board',
    objectiveId: 'o', evalMode: 'count', owner: 'tutor', status: patch.status ?? 'active', supportArtifact: null, affordances: [],
    blockedReason: null, canStartNext: false, canGenerateSupport: false, moveOptions: null, markedTargetIds: [], assistance: [],
    task: { itemId, phase: 'working', task: 'Count the stars.', completed: false,
      evidence: { attemptNumber: attempts.filter(a => a.itemId === itemId).length, correctness: 'unknown', recentResponses: [] },
      demand: { response: 'speech', presentation: patch.ready === false ? 'not ready' : 'ready' },
      support: { level: patch.level ?? 0, answerExposure: 'none' },
      workspace: { progression: 'observer', objects: [], demonstration: [], lastResponse: null, attempts } } };
}
const wrong = (itemId: string, response: string): Attempt =>
  ({ itemId, response, source: 'speech', correct: false, assisted: false, answerExposure: 'none' });
const observation = (turnId: string): LearnerObservation => ({ kind: 'learner_intent', turnId, itemId: 'one', helpRequested: false,
  stopRequested: false, attemptedAnswer: null, probabilities: { asksForHelp: 0, wantsToStop: 0, attemptsAnswer: 0.5 } });

it('reports elapsed time per item from an injected clock and starts again on a new item', () => {
  let now = 1_000; const t = new LearnerSignalTracker(() => now);
  t.observe(snapshot('one', { ready: false }));
  now += 5_000; expect(t.read(snapshot('one', { ready: false }))).toMatchObject({ secondsOnItem: 5, secondsSinceReady: null,
    secondsSinceTutorSettled: null, secondsSinceLearnerSpoke: null });
  t.observe(snapshot('one')); now += 12_000; t.tutorSettled(); now += 3_000; t.learnerFinished(); now += 2_000;
  expect(t.read(snapshot('one'))).toMatchObject({ secondsOnItem: 22, secondsSinceReady: 17, secondsSinceTutorSettled: 5,
    secondsSinceLearnerSpoke: 2, learnerTurns: 1, tutorTurns: 1 });
  t.observe(snapshot('two'));
  expect(t.read(snapshot('two'))).toMatchObject({ itemId: 'two', secondsOnItem: 0, learnerTurns: 0, tutorTurns: 0, helpRequests: 0 });
});

it('derives attempts, a repeated wrong response and recorded help from the snapshot, for the current item only', () => {
  const t = new LearnerSignalTracker(() => 0);
  const attempts = [wrong('zero', 'four'), wrong('one', 'Four'), wrong('one', ' four ')];
  t.observe(snapshot('one', { attempts, level: 2 }));
  expect(t.read(snapshot('one', { attempts, level: 2 }))).toMatchObject({ attempts: 2, wrongAttempts: 2, repeatedWrongResponse: true, helpRecorded: true });
  const changed = [wrong('one', 'four'), wrong('one', 'six')];
  expect(t.read(snapshot('one', { attempts: changed }))).toMatchObject({ wrongAttempts: 2, repeatedWrongResponse: false, helpRecorded: false });
});

it('counts classified requests, leaves an unclear turn alone, and asks for a packet only on a raised request', () => {
  const t = new LearnerSignalTracker(() => 0); t.observe(snapshot());
  const key = t.scopeKey();
  expect(t.intent(key, observation('1'), { helpRequested: false, stopRequested: false, attemptedAnswer: false })).toBe(false);
  expect(t.intent(key, observation('2'), { helpRequested: false, stopRequested: false, attemptedAnswer: null })).toBe(false);
  expect(t.intent(key, observation('3'), { helpRequested: true, stopRequested: false, attemptedAnswer: false })).toBe(true);
  expect(t.read(snapshot())).toMatchObject({ helpRequests: 1, stopRequests: 0, turnsWithoutAnswer: 2 });
  expect(t.intent(key, observation('4'), { helpRequested: false, stopRequested: true, attemptedAnswer: true })).toBe(true);
  expect(t.read(snapshot())).toMatchObject({ stopRequests: 1, turnsWithoutAnswer: 0 });
  expect(t.intent('s/board/other', observation('5'), { helpRequested: true, stopRequested: false, attemptedAnswer: false })).toBe(false);
  expect(t.read(snapshot())!.helpRequests).toBe(1);
  for (let i = 0; i < 8; i++) t.intent(key, observation('n' + i), { helpRequested: false, stopRequested: false, attemptedAnswer: true });
  expect(t.observations()).toHaveLength(5);
});

it('drops exactly the host-written message once, and nothing a learner could say', () => {
  const t = new LearnerSignalTracker(() => 0);
  t.expectHostText('The learner submitted their selection.');
  expect(t.consumeHostText('the learner submitted their selection.')).toBe(false);
  expect(t.consumeHostText('The learner submitted their selection.')).toBe(true);
  expect(t.consumeHostText('The learner submitted their selection.')).toBe(false);
  // Two pending registrations, delivered out of order: neither overwrites the other.
  t.expectHostText('first'); t.expectHostText('second');
  expect(t.consumeHostText('second')).toBe(true);
  expect(t.consumeHostText('first')).toBe(true);
  expect(t.consumeHostText('first')).toBe(false);
});

it('reports nothing without a task or after the activity stopped', () => {
  const t = new LearnerSignalTracker(() => 0);
  expect(t.read(snapshot())).toBeNull();
  t.observe(snapshot());
  expect(t.read(snapshot('one', { status: 'stopped' }))).toBeNull();
});
