import { afterEach, expect, it, vi } from 'vitest';
import { LearnerObserver, type LearnerIntentReport } from './LearnerObserver';
import type { RuntimeSnapshot } from './contract';
import type { LearnerIntentDecision } from './learnerIntentContract';

const help: LearnerIntentDecision = { asksForHelp: .95, wantsToStop: .02, attemptsAnswer: .05, accepted: true, reason: 'observed', ms: 300 };
function setup(optedIn = true) {
  let state = { sessionEpoch: 's', instanceId: 'board', status: 'active', revision: 3,
    task: { itemId: 'one', task: 'Count the stars.', workspace: optedIn ? { progression: 'observer' } : {} } } as unknown as RuntimeSnapshot;
  const classify = vi.fn(async (..._args: unknown[]) => help), reports: LearnerIntentReport[] = [];
  const observer = new LearnerObserver(() => state, classify as never, r => reports.push(r));
  return { observer, classify, reports, replace: (patch: Record<string, unknown>) => { state = { ...state, ...patch } as RuntimeSnapshot; } };
}
const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
afterEach(() => vi.useRealTimers());

it('observes a finished learner turn with the tutor turn it answered, and never the expected answer', async () => {
  const s = setup(); s.observer.output('How many '); s.observer.output('stars?');
  expect(s.observer.learnerText('I do not ', false)).toBe(false);
  expect(s.classify).not.toHaveBeenCalled();
  expect(s.observer.learnerText('know', true)).toBe(true); await settle();
  expect(s.classify).toHaveBeenCalledWith({ scope: { sessionEpoch: 's', instanceId: 'board', itemId: 'one' }, turnId: 'learner-turn-1',
    task: 'Count the stars.', learner: 'I do not know', priorTutor: 'How many stars?' }, expect.any(AbortSignal));
  expect(s.reports.map(r => r.status)).toEqual(['observing', 'observed']);
  expect(s.reports[1]).toMatchObject({ flags: { helpRequested: true, stopRequested: false, attemptedAnswer: false },
    observation: { kind: 'learner_intent', itemId: 'one', turnId: 'learner-turn-1' } });
});

it('counts the turn but makes no model call outside a shared workspace, for an empty turn, or for an inactive activity', () => {
  const off = setup(false); expect(off.observer.learnerText('help', true)).toBe(true); expect(off.classify).not.toHaveBeenCalled();
  const s = setup(); expect(s.observer.learnerText('  ', true)).toBe(false);
  s.replace({ status: 'support' }); expect(s.observer.learnerText('help', true)).toBe(true);
  expect(s.classify).not.toHaveBeenCalled();
});

it('lets new learner words supersede an unfinished observation, while a tutor reply does not', async () => {
  const s = setup(); let resolve!: (d: LearnerIntentDecision) => void;
  s.classify.mockImplementationOnce(() => new Promise<LearnerIntentDecision>(r => { resolve = r; }));
  s.observer.learnerText('um', true); s.observer.output('Take your time.');
  s.observer.learnerText('help me', true); resolve(help); await settle();
  expect(s.reports.filter(r => r.status === 'observed')).toHaveLength(1);
  expect(s.reports.find(r => r.status === 'observed')!.request.learner).toBe('help me');
  expect(s.reports.some(r => r.status === 'cancelled')).toBe(true);
});

it('keeps a result across a revision bump on the same item and drops it when the item changed', async () => {
  const same = setup(); same.observer.learnerText('help', true); same.replace({ revision: 9 }); await settle();
  expect(same.reports.at(-1)!.status).toBe('observed');
  const moved = setup(); let resolve!: (d: LearnerIntentDecision) => void;
  moved.classify.mockImplementationOnce(() => new Promise<LearnerIntentDecision>(r => { resolve = r; }));
  moved.observer.learnerText('help', true);
  moved.replace({ task: { itemId: 'two', task: 'Next.', workspace: { progression: 'observer' } } }); resolve(help); await settle();
  expect(moved.reports.at(-1)!.status).toBe('stale');
});

it('abstains on an unusable decision, an unavailable service and a timeout, and reports nothing after close', async () => {
  const s = setup(); s.classify.mockResolvedValueOnce({ ...help, accepted: false, asksForHelp: null });
  s.observer.learnerText('help', true); await settle(); expect(s.reports.at(-1)!.status).toBe('abstained');
  s.classify.mockRejectedValueOnce(new Error('down')); s.observer.learnerText('help', true); await settle();
  expect(s.reports.at(-1)).toMatchObject({ status: 'abstained', decision: { reason: 'unavailable' } });
  vi.useFakeTimers();
  s.classify.mockImplementationOnce((...args: unknown[]) => new Promise<LearnerIntentDecision>((_, reject) =>
    (args[1] as AbortSignal).addEventListener('abort', () => reject(new Error('aborted')))));
  s.observer.learnerText('help', true); await vi.advanceTimersByTimeAsync(4001);
  expect(s.reports.at(-1)).toMatchObject({ status: 'abstained', decision: { reason: 'timeout' } });
  vi.useRealTimers();
  const closed = setup(); closed.observer.learnerText('help', true); closed.observer.close(); await settle();
  expect(closed.reports.map(r => r.status)).toEqual(['observing']);
});
