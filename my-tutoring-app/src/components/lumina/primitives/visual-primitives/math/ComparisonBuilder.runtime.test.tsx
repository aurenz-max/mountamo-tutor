// @vitest-environment jsdom
//
// Real ComparisonBuilder, real grading path, real LiveLessonRuntime, real transport
// and rendering shell. Only the AI session, evaluation writes and sound are
// substituted. Every case is an action this adapter ADVERTISES, or one it
// deliberately withholds.
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';

vi.mock('../../../hooks/useLuminaAI', () => ({ useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false, isAudioPlaying: false }) }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0,
  useLuminaAIContext: () => ({ isConnected: false, isListening: false, sessionMode: null, activePrimitiveId: null, sendText: vi.fn() }) }));
vi.mock('../../../evaluation', () => ({ usePrimitiveEvaluation: () => ({ hasSubmitted: false, submittedResult: null, elapsedMs: 0, submitResult: vi.fn() }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));
import ComparisonBuilder, { type ComparisonBuilderChallenge, type ComparisonBuilderData } from './ComparisonBuilder';
import { comparisonContrastFor, ownNumbers } from './comparisonBuilderExample';

type Kind = ComparisonBuilderChallenge['type'];

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 0));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

/** One challenge per mode. Grade 1 throughout, so every mode keeps its Check button. */
function challengeFor(kind: Kind, id = 'c1'): ComparisonBuilderChallenge {
  const base = { id, type: kind, instruction: 'Work out the comparison.' };
  switch (kind) {
    case 'compare-groups': return { ...base, leftGroup: { count: 5, objectType: 'apple' },
      rightGroup: { count: 3, objectType: 'pear' }, correctAnswer: 'more' };
    case 'compare-numbers': return { ...base, leftNumber: 7, rightNumber: 4, correctSymbol: '>' };
    case 'order': return { ...base, numbers: [5, 2, 8, 4], direction: 'ascending' };
    default: return { ...base, targetNumber: 6, askFor: 'both' };
  }
}

const ALL_KINDS: Kind[] = ['compare-groups', 'compare-numbers', 'order', 'one-more-one-less'];

async function mount(challenges: ComparisonBuilderChallenge[]) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: Record<string, any>[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m));
  const data = { title: 'Comparing', gradeBand: '1', instanceId: 'compare',
    showCorrespondenceLines: true, useAlligatorMnemonic: false,
    challenges } as unknown as ComparisonBuilderData;
  const view = render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <ComparisonBuilder data={data} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  await act(async () => {});
  const choose = async (label: string) => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: label })); }); };
  const check = async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Check/ })); }); };
  const command = async (type: string, assertInside?: () => void) => {
    const state = runtime.getSnapshot(), offer = state.affordances.find(a => a.action.type === type)!;
    expect(offer, `missing ${type}`).toBeTruthy();
    let receipt: any;
    await act(async () => {
      receipt = runtime.dispatch({ sessionEpoch: state.sessionEpoch, commandId: crypto.randomUUID(),
        instanceId: state.instanceId!, itemId: state.task!.itemId, expectedRevision: state.revision, action: offer.action });
      // INSIDE dispatch, before `act` exits: a React setter followed by a read of
      // the old closure is not an acknowledgement, so state is asserted here.
      assertInside?.();
    });
    return receipt;
  };
  const dispatch = async (c: Record<string, unknown>) => {
    let receipt: any;
    await act(async () => { receipt = runtime.dispatch(c); });
    return receipt;
  };
  const strategies = () => runtime.getSnapshot().affordances
    .filter(a => a.action.type === 'scaffold' && (a.action as any).direction === 1)
    .map(a => (a.action as any).strategyId as string);
  const strategy = async (strategyId: string, direction: 1 | -1 = 1) => {
    const state = runtime.getSnapshot();
    const offer = state.affordances.find(a => a.action.type === 'scaffold'
      && (a.action as any).strategyId === strategyId && (a.action as any).direction === direction)!;
    expect(offer, `missing scaffold ${strategyId} (${direction})`).toBeTruthy();
    await act(async () => {
      runtime.dispatch({ sessionEpoch: state.sessionEpoch, commandId: crypto.randomUUID(),
        instanceId: state.instanceId!, itemId: state.task!.itemId, expectedRevision: state.revision, action: offer.action });
    });
  };
  const types = () => runtime.getSnapshot().affordances.map(a => a.action.type);
  return { runtime, transport, view, choose, check, command, dispatch, strategies, strategy, types, sent };
}

// ── The advertised capability set ──

/** Two stacked rows can state a comparison of two things, never an ordering of three or more. */
const DETOUR_KINDS: Kind[] = ['compare-groups', 'compare-numbers', 'one-more-one-less'];

it.each(ALL_KINDS)('%s offers replay and its own reminder, never a point, and a contrast only where two rows can draw it', async kind => {
  const h = await mount([challengeFor(kind)]);
  expect(h.types()).toContain('replay');
  expect(h.types()).toContain('scaffold');
  for (const withheld of ['advance', 'retry', 'point']) {
    expect(h.types(), `${kind} offered ${withheld}`).not.toContain(withheld);
  }
  if (DETOUR_KINDS.includes(kind)) expect(h.types(), `${kind} withheld its contrast pair`).toContain('request_support');
  else expect(h.types(), `${kind} offered a detour two rows cannot draw`).not.toContain('request_support');
  // Only the method reminder: the child has not answered yet.
  expect(h.strategies().length).toBe(1);
  const reminder = h.runtime.getSnapshot().affordances.find(a => a.action.type === 'scaffold')!;
  expect(reminder.description).toContain('Nothing is selected, moved or counted for the child');
  expect(reminder.assistance).toEqual({ level: 1, answerExposure: 'none' });
});

it('gives ascending and descending ordering different method reminders', async () => {
  const up = await mount([challengeFor('order')]);
  expect(up.strategies()).toEqual(['start-at-one-end-and-keep-going']);
  const reminder = up.runtime.getSnapshot().affordances.find(a => a.action.type === 'scaffold')!;
  expect(reminder.description).toContain('smallest');
  cleanup();
  const down = await mount([{ ...challengeFor('order'), direction: 'descending' as const }]);
  const other = down.runtime.getSnapshot().affordances.find(a => a.action.type === 'scaffold')!;
  expect(other.description).toContain('biggest');
});

// ── Advance: only after a checked success, and committed inside dispatch ──

it('advances only after a checked success, and the next instruction is in the DOM inside dispatch', async () => {
  const h = await mount([
    { ...challengeFor('compare-groups', 'c1'), instruction: 'Which group has more?' },
    { ...challengeFor('compare-groups', 'c2'), instruction: 'Now try this one.' },
  ]);
  expect(h.types()).not.toContain('advance');
  await h.choose('More');
  await h.check();
  expect(h.runtime.getSnapshot().task?.evidence.correctness).toBe('correct');
  expect(h.types()).toContain('advance');
  expect(h.types()).not.toContain('retry');
  await h.command('advance', () => {
    expect(screen.getByText('Now try this one.')).toBeTruthy();
    expect(h.runtime.getSnapshot().task?.itemId).toBe('c2');
  });
});

it('clears an incorrect response on retry and keeps the attempt history', async () => {
  const h = await mount([challengeFor('compare-groups')]);
  await h.choose('Fewer');
  await h.check();
  expect(h.runtime.getSnapshot().task?.evidence.correctness).toBe('incorrect');
  expect(h.runtime.getSnapshot().task?.demand.selected).toBe('less');
  const attempts = h.runtime.getSnapshot().task!.evidence.attemptNumber;
  expect(h.types()).toContain('retry');
  expect(h.types()).not.toContain('advance');
  await h.command('retry', () => {
    // The selection is gone INSIDE dispatch, and the attempt count survives it.
    expect(h.runtime.getSnapshot().task?.demand.selected).toBe('');
  });
  expect(h.runtime.getSnapshot().task!.evidence.attemptNumber).toBe(attempts);
});

// ── Routing: an aid for a misstep the child has not made is never offered ──

it('routes compare-groups between calling them the same and picking the opposite', async () => {
  const h = await mount([challengeFor('compare-groups')]);   // 5 vs 3, the answer is "more"
  await h.choose('The Same');
  await h.check();
  expect(h.strategies()).toContain('the-rows-do-not-run-out-together');
  expect(h.strategies()).not.toContain('watch-which-row-runs-out-first');
  cleanup();
  const g = await mount([challengeFor('compare-groups')]);
  await g.choose('Fewer');
  await g.check();
  expect(g.strategies()).toContain('watch-which-row-runs-out-first');
  expect(g.strategies()).not.toContain('the-rows-do-not-run-out-together');
});

// ── No aid may state the answer, on any mode ──

it('never says a comparison word, a symbol or a numeral in any aid it can offer', async () => {
  const forbidden = ['more', 'less', 'fewer', 'equal', 'the same', '<', '>', '='];
  for (const kind of ALL_KINDS) {
    const h = await mount([challengeFor(kind)]);
    if (kind === 'compare-groups') { await h.choose('The Same'); await h.check(); }
    for (const offer of h.runtime.getSnapshot().affordances) {
      if (offer.action.type !== 'scaffold') continue;
      const spoken = (offer.description.split('"')[1] ?? '').toLowerCase();
      expect(spoken, `${kind} / ${(offer.action as any).strategyId}`).toBeTruthy();
      for (const word of forbidden) {
        expect(spoken.includes(word), `${kind} / ${(offer.action as any).strategyId} says "${word}"`).toBe(false);
      }
      // No numeral either: on `order` and `one-more-one-less` the answer IS a number.
      expect(/\d/.test(spoken), `${kind} / ${(offer.action as any).strategyId} states a numeral`).toBe(false);
    }
    cleanup();
  }
});

// ── Painting, fading, and the assistance history ──

it('paints the reminder, fades it back, and keeps the assistance history', async () => {
  const h = await mount([challengeFor('compare-groups')]);
  await h.strategy('match-them-up-side-by-side');
  expect(screen.getByText(/match them up/)).toBeTruthy();
  expect(h.runtime.getSnapshot().task?.support.level).toBe(1);
  await h.strategy('match-them-up-side-by-side', -1);
  expect(screen.queryByText(/match them up/)).toBeNull();
  expect(h.runtime.getSnapshot().task?.support.level).toBe(0);
  expect(h.runtime.getSnapshot().assistance.map(a => a.level)).toEqual([1, 0]);
});

// ── Refusals ──

it('refuses a stale item, a stale revision, an unknown strategy and a duplicate command', async () => {
  const h = await mount([challengeFor('compare-groups')]);
  const state = h.runtime.getSnapshot();
  const base = { sessionEpoch: state.sessionEpoch, instanceId: state.instanceId!, expectedRevision: state.revision };
  expect((await h.dispatch({ ...base, commandId: 'a', itemId: 'not-this-item', action: { type: 'replay' } })).status).toBe('stale');
  expect((await h.dispatch({ ...base, commandId: 'b', itemId: state.task!.itemId, expectedRevision: state.revision + 5, action: { type: 'replay' } })).status).toBe('stale');
  expect((await h.dispatch({ ...base, commandId: 'c', itemId: state.task!.itemId,
    action: { type: 'scaffold', strategyId: 'no-such-aid', direction: 1 } })).status).toBe('unsupported');
  // An aid that belongs to another mode is still unsupported here.
  expect((await h.dispatch({ ...base, commandId: 'd', itemId: state.task!.itemId,
    action: { type: 'scaffold', strategyId: 'step-along-the-line', direction: 1 } })).status).toBe('unsupported');
  // `advance` was never advertised before a checked success.
  expect((await h.dispatch({ ...base, commandId: 'e', itemId: state.task!.itemId,
    action: { type: 'advance' } })).status).toBe('unsupported');
  const replay = { ...base, commandId: 'same-id', itemId: state.task!.itemId, action: { type: 'replay' } as const };
  expect((await h.dispatch(replay)).status).toBe('committed');
  expect((await h.dispatch(replay)).status).toBe('duplicate');
});

it('refuses every action after the learner stops', async () => {
  const h = await mount([challengeFor('compare-groups')]);
  await h.choose('Fewer');
  expect(h.runtime.getSnapshot().task?.demand.selected).toBe('less');
  const state = h.runtime.getSnapshot();
  await act(async () => { h.runtime.stop(); });
  expect(h.runtime.getSnapshot().affordances).toEqual([]);
  const receipt = await h.dispatch({ sessionEpoch: state.sessionEpoch, commandId: 'after-stop',
    instanceId: state.instanceId!, itemId: state.task!.itemId, expectedRevision: state.revision, action: { type: 'retry' } });
  expect(receipt.status).not.toBe('committed');
  // The DOM is NOT the check here: `LiveRuntimeSurface` replaces the workspace on
  // stop, so the primitive is unmounted by the time the refusal lands. What the
  // refusal has to prove is that it committed nothing, which the receipt says.
  expect(receipt.state.status).toBe('stopped');
});

it('focuses the instruction on replay without changing the response', async () => {
  const h = await mount([challengeFor('compare-groups')]);
  await h.choose('More');
  await h.command('replay');
  expect(document.activeElement).toBe(screen.getByLabelText('Current instruction'));
  expect(h.runtime.getSnapshot().task?.demand.selected).toBe('more');
});

// ── The contrast detour: a NEARBY pair, a suspended workspace, a trustworthy return ──

it.each(DETOUR_KINDS)('%s prepares a contrast pair that shares no number with the item, rings only the unpartnered tail, and declares partial exposure', async kind => {
  const c = challengeFor(kind);
  const h = await mount([c]);
  const offers = h.runtime.getSnapshot().affordances.filter(a => a.action.type === 'request_support');
  expect(offers.length).toBeGreaterThan(0);
  for (const offer of offers) {
    expect(offer.assistance).toEqual({ level: 6, answerExposure: 'partial' });
    const artifact = comparisonContrastFor(c).find(a => a.id === (offer.action as any).artifactId)!;
    expect(artifact.kind).toBe('contrast-pair');
    expect(offer.description).toBe(artifact.title);
    const [top, bottom] = artifact.panels;
    for (const panel of artifact.panels) {
      expect(ownNumbers(c), `${artifact.id} drew the item's own ${panel.count}`).not.toContain(panel.count);
      expect(panel.count).toBeGreaterThan(0);
    }
    // The ring is exactly the counters with nothing to match in the other row.
    expect(top.highlighted).toBe(Math.max(0, top.count - bottom.count));
    expect(bottom.highlighted).toBe(Math.max(0, bottom.count - top.count));
    // The caption says the two counts it draws, and only those.
    for (const panel of artifact.panels) expect(artifact.caption).toMatch(new RegExp(`(^|[^0-9])${panel.count}([^0-9]|$)`));
    for (const n of ownNumbers(c)) expect(artifact.caption, `${artifact.id} caption names the item's own ${n}`).not.toMatch(new RegExp(`(^|[^0-9])${n}([^0-9]|$)`));
  }
});

it('opens the contrast over a suspended workspace with the wrong answer intact, returns to it, and offers it once per item', async () => {
  const h = await mount([challengeFor('compare-groups')]);   // 5 vs 3: the nearest pair that avoids both is 6 vs 4
  await h.choose('Fewer');
  await h.check();
  const before = h.runtime.getSnapshot().task!;
  expect(before.evidence.correctness).toBe('incorrect');
  // The detour is runtime-owned, so the shell repaints on the store notification
  // rather than inside dispatch; the receipt is what certifies the commit.
  const receipt = await h.command('request_support');
  expect(receipt.status).toBe('committed');
  expect(screen.getByRole('complementary', { name: 'Worked example' })).toBeTruthy();
  const opened = h.runtime.getSnapshot();
  expect(opened.status).toBe('support');
  expect(opened.supportArtifact).toMatchObject({ kind: 'contrast-pair', id: 'contrast-c1-unequal' });
  expect(h.view.container.querySelectorAll('[data-contrast-row]').length).toBe(2);
  expect(h.view.container.querySelectorAll('[data-contrast-highlight]').length).toBe(2);
  expect(screen.getByText('6 is more than 5. Match them up and 2 are left over.'.replace('5', '4'))).toBeTruthy();
  // Same child, still mounted, inert: suspension is an adapter guarantee, not a remount.
  expect(h.view.container.querySelector('fieldset')?.disabled).toBe(true);
  expect(opened.affordances.map(a => a.action.type)).toEqual(['return']);
  await h.command('return');
  const back = h.runtime.getSnapshot();
  expect(back.status).toBe('active');
  expect(back.task?.itemId).toBe(before.itemId);
  expect(back.task?.demand).toEqual(before.demand);
  expect(back.task?.evidence.correctness).toBe('incorrect');
  expect(back.assistance.at(-1)).toMatchObject({ action: { type: 'request_support' }, level: 6, answerExposure: 'partial' });
  expect(h.types(), 'a second detour on the same item').not.toContain('request_support');
  await h.choose('More');
  await h.check();
  expect(h.runtime.getSnapshot().task?.evidence.correctness).toBe('correct');
});

it('prepares a fresh pair for the next item that avoids THAT item\'s numbers', async () => {
  const second = { ...challengeFor('compare-groups', 'c2'), leftGroup: { count: 6, objectType: 'cat' },
    rightGroup: { count: 4, objectType: 'dog' }, correctAnswer: 'more' as const };
  const h = await mount([challengeFor('compare-groups', 'c1'), second]);
  await h.choose('More');
  await h.check();
  await h.command('advance');
  const offer = h.runtime.getSnapshot().affordances.find(a => a.action.type === 'request_support')!;
  expect((offer.action as any).artifactId).toBe('contrast-c2-unequal');
  // 6 vs 4 is this item's own pair, so the example steps past it to 5 vs 3.
  expect(comparisonContrastFor(second)[0].panels.map(p => p.count)).toEqual([5, 3]);
  expect(comparisonContrastFor({ ...second, type: 'order', numbers: [6, 4, 9], direction: 'ascending' })).toEqual([]);
});
