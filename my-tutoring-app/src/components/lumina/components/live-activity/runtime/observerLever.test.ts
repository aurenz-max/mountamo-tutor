/**
 * The trigger ladder (user rulings 2026-09-27, handoff 21 S2): which lever the observer pulls for each
 * attempt sequence on one item. Pure; the transport and mounted tests prove the pull reaches the screen.
 */
import { describe, expect, it } from 'vitest';
import { leverTrigger, nextLever, type LeverEvent } from './observerLever';
import type { RuntimeSnapshot } from './contract';
import { TeachingSession } from './TeachingSession';
import { scoreSession } from './itemScoringContract';
import { teachingEvaluation } from './teachingEvaluation';

type Step = 'wrong' | 'stuck' | 'pull:hops' | 'pull:simpler';
const HOPS = { id: 'hops', kind: 'help', answers: ['one_short'] };
const SIMPLER = { id: 'simpler', kind: 'simplify', answers: ['lost_track'] };

/** The snapshot after `steps` on item `a`, then the event the last step is. */
function snapshot(steps: Step[], options: { levers?: object[]; miss?: string; practice?: boolean; pullable?: boolean; tierStart?: string[] } = {}) {
  // As TeachingSession records them: each attempt carries the levers pulled before it; a tier's starting help does not.
  const pulled: string[] = [];
  const attempts: object[] = [];
  for (const step of steps) {
    if (step.startsWith('pull:')) pulled.push(step.slice(5));
    else attempts.push({ itemId: 'a', response: 'r', source: 'gesture', correct: false, assisted: pulled.length > 0, answerExposure: 'none',
      ...(pulled.length ? { levers: [...pulled] } : {}), ...(options.miss ? { miss: options.miss } : {}) });
  }
  const shown = [...pulled, ...(options.tierStart ?? [])];
  const levers = (options.levers ?? [SIMPLER, HOPS]).map(l => ({ ...l, pulled: shown.includes((l as { id: string }).id) }));
  return { status: 'active', task: { itemId: 'a', workspace: { levers, attempts, ...(options.practice ? { practice: { returnsTo: 'a' } } : {}) } },
    affordances: options.pullable === false ? [] : [{ action: { type: 'workspace', operation: 'pull_lever' } }] } as unknown as RuntimeSnapshot;
}

describe('the trigger ladder', () => {
  it.each<[string, Step[], LeverEvent, string | null, Parameters<typeof snapshot>[1]?]>([
    ['one wrong answer names the miss and pulls nothing', ['wrong'], 'wrong', null],
    ['the second wrong answer pulls help, though simplify is declared first', ['wrong', 'wrong'], 'wrong', 'hops'],
    ['the second wrong answer pulls help only, even when its miss is one simplify answers', ['wrong', 'wrong'], 'wrong', 'hops', { miss: 'lost_track' }],
    ['the second wrong answer with no help lever pulls nothing', ['wrong', 'wrong'], 'wrong', null, { levers: [SIMPLER] }],
    ['stuck after a wrong answer: the lever that answers the miss', ['wrong'], 'help', 'simpler', { miss: 'lost_track' }],
    ['stuck after a wrong answer, no named miss: help first', ['wrong'], 'help', 'hops'],
    ['stuck after help was pulled: the next lever, simplify', ['wrong', 'pull:hops'], 'help', 'simpler'],
    ['stuck before any attempt: help', [], 'help', 'hops'],
    ['stuck before any attempt, with only a simplify lever: nothing', [], 'help', null, { levers: [SIMPLER] }],
    ['stuck before any attempt never takes simplify, whatever the order', [], 'help', 'hops', { levers: [SIMPLER, HOPS] }],
    ['a wrong answer with help pulled (stuck first): simplify', ['pull:hops', 'wrong'], 'wrong', 'simpler'],
    ['a wrong answer with help pulled after two wrongs: simplify', ['wrong', 'wrong', 'pull:hops', 'wrong'], 'wrong', 'simpler'],
    ['a wrong answer with help pulled and no simplify lever: nothing', ['pull:hops', 'wrong'], 'wrong', null, { levers: [HOPS] }],
    ['an easy tier starts with help on screen: one wrong answer still pulls nothing', ['wrong'], 'wrong', null, { tierStart: ['hops'] }],
    ["an easy tier's starting help: the second wrong answer has no help left to pull", ['wrong', 'wrong'], 'wrong', null, { tierStart: ['hops'] }],
    ['every lever pulled: nothing', ['wrong', 'pull:hops', 'pull:simpler', 'wrong'], 'wrong', null],
    ['on an easier practice item: nothing', ['wrong', 'wrong'], 'wrong', null, { practice: true }],
    ['no pull_lever on offer: nothing', ['wrong', 'wrong'], 'wrong', null, { pullable: false }],
  ])('%s', (_name, steps, event, expected, options) => {
    expect(leverTrigger(snapshot(steps, options), event)).toBe(expected);
  });

  it('nextLever keeps within the allowed kind', () => {
    const levers = [SIMPLER, HOPS];
    expect(nextLever(levers, 'lost_track')).toBe('simpler');
    expect(nextLever(levers, 'lost_track', 'help')).toBe('hops');
    expect(nextLever(levers, 'one_short', 'simplify')).toBe('simpler');
    expect(nextLever([HOPS], undefined, 'simplify')).toBeNull();
  });
});

describe('a pull makes the next try assisted work on the same item (rulings 3 and 4, J11)', () => {
  const items = [{ id: 'a', task: 'Pick the bigger number.', response: 'gesture' as const, checkResponse: () => null }];
  it.each([
    ['a wrong answer, then a pull (one assisted try after the miss)', true],
    ['a pull before any attempt, such as a choice removed', false],
  ])('%s: solved, never first-try, the lever on the attempt', (_name, wrongFirst) => {
    const session = new TeachingSession(['a']);
    if (wrongFirst) { session.submit('r1', '3', 'gesture', false); expect(session.retry()).toBe(true); }
    session.assist('none', 'drop_far_choice');
    expect(session.submit('r2', '9', 'gesture', true)).toBe(true);
    expect(session.advance()).toBe(true);
    const state = session.getSnapshot();
    expect(state.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['drop_far_choice'] });
    const result = teachingEvaluation(items, state, scoreSession(['a'], state, state.attempts.map(() => undefined)), 'compare');
    expect(result.solvedCount).toBe(1);
    expect(result.diagnosisEvidence.firstResponseScore).toBe(0);
  });
});
