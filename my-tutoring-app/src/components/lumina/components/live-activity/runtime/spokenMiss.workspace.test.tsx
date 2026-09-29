// @vitest-environment jsdom
/**
 * The `spoken_miss` wiring (handoff 20 Part B): a spoken item's known misses go to the observer with the pending
 * answer, and a not-credited verdict records the named one on the attempt, as a gesture check does. The model's
 * reading is a stub here; which miss a transcript shows is measured by `scripts/spoken-miss-probe.mjs`.
 */
import React, { useLayoutEffect, useRef } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useTeachingWorkspace, type TeachingItem, type TeachingWorkspace } from './useTeachingWorkspace';
import { LiveRuntimeContext } from './LiveRuntimeContext';
import { LiveLessonRuntime } from './LiveLessonRuntime';
import { WorkspacePin } from './workspacePin';
import type { KnownMiss } from './spokenMissContract';

const seam = vi.hoisted(() => ({ conversation: [] as any[], sendText: vi.fn() }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useLuminaAIContext: () => ({ ...seam, isAudioPlaying: false }) }));

const MISSES: KnownMiss[] = [
  { id: 'one_short', pattern: "The learner's answer is 3, one fewer than the 4 bees." },
  { id: 'one_over', pattern: "The learner's answer is 5, one more than the 4 bees." },
];
const item = (misses?: KnownMiss[]): TeachingItem =>
  ({ id: 'bees', task: 'How many bees?', expectedAnswer: '4', response: 'speech', checkResponse: () => null, ...(misses ? { misses } : {}) });

function Spoken({ items, primitiveId }: { items: TeachingItem[]; primitiveId: string }) {
  const workspace = useRef<TeachingWorkspace | null>(null);
  useTeachingWorkspace({ instanceId: 'bees', primitiveId, items, workspace });
  useLayoutEffect(() => { workspace.current = { objects: [], facts: { shown: 'bees on a flower' } }; });
  return null;
}

let decide: (body: any) => Promise<any>;
const requests: any[] = [];
beforeEach(() => {
  seam.conversation = []; requests.length = 0;
  decide = async body => ({ miss: body.misses[0].id, reading: body.misses[0].id, p: .9, accepted: true, reason: 'named', ms: 1 });
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (!String(url).endsWith('/api/lumina/observe-spoken-miss')) return { ok: false, json: async () => ({}) };
    const body = JSON.parse(String(init!.body));
    requests.push(body);
    return { ok: true, json: () => decide(body) };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function mount(items: TeachingItem[], { primitiveId = 'bee-test', pin = 'count' } = {}) {
  const runtime = new LiveLessonRuntime('spoken', { allowAnswerExposure: true, maxSupportLevel: 3, allowSupportArtifacts: false });
  const tree = () => <LiveRuntimeContext.Provider value={runtime}><WorkspacePin pin={pin}><Spoken items={items} primitiveId={primitiveId} /></WorkspacePin></LiveRuntimeContext.Provider>;
  const view = render(tree());
  const say = async (text: string) => {
    seam.conversation = [...seam.conversation, { role: 'user', content: text, timestamp: seam.conversation.length + 1 }];
    await act(async () => { view.rerender(tree()); for (let i = 0; i < 12; i++) await Promise.resolve(); });
  };
  const verdict = (v: 'correct' | 'incorrect', fromWords = false) => {
    const s = runtime.getSnapshot();
    const a = s.affordances.find(x => x.action.type === 'workspace' && (x.action as any).operation === 'apply_tutor_verdict')!;
    let status = '';
    act(() => { status = runtime.dispatch({ sessionEpoch: s.sessionEpoch, commandId: crypto.randomUUID(), instanceId: 'bees', itemId: 'bees',
      expectedRevision: s.revision, action: { ...a.action, input: { dialogue: { responseId: s.task!.workspace!.pendingResponse!.id, verdict: v,
        transition: v === 'correct' ? 'advance' : 'retry', tutor: v === 'correct' ? 'Yes.' : "Let's count them together slowly!",
        ...(fromWords ? { fromWords: true } : {}) } } } }).status; });
    return status;
  };
  const accepts = () => runtime.acceptsMissFromWords(runtime.getSnapshot().task!.workspace!.pendingResponse!.id);
  return { runtime, say, verdict, accepts, attempts: () => runtime.getSnapshot().task!.workspace!.attempts };
}

it('names the miss on a not-credited spoken answer from the item\'s own list, and keeps the list out of the tutor packet', async () => {
  const h = mount([item(MISSES)]);
  await h.say('three');
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ task: 'How many bees?', expectedAnswer: '4', learner: 'three', misses: MISSES,
    scope: { instanceId: 'bees', itemId: 'bees' } });
  expect(JSON.stringify(h.runtime.getSnapshot().task)).not.toMatch(/one fewer than/);
  expect(h.verdict('incorrect')).toBe('committed');
  expect(h.attempts().at(-1)).toMatchObject({ source: 'speech', correct: false, miss: 'one_short' });
  expect(h.runtime.trace.getSnapshot().some(e => e.stage === 'spoken_miss' && e.status === 'named')).toBe(true);
});

it('records no miss on a credited answer, whatever the observer read', async () => {
  const h = mount([item(MISSES)]);
  await h.say('four');
  expect(h.verdict('correct')).toBe('committed');
  expect(h.runtime.getSnapshot().task!.workspace!.attempts.at(-1)?.miss).toBeUndefined();
});

it('records no miss when the observer named none (below the gate or another wrong answer)', async () => {
  decide = async () => ({ miss: null, reading: 'other_wrong', p: .8, accepted: true, reason: 'other_wrong', ms: 1 });
  const h = mount([item(MISSES)]);
  await h.say('ten');
  h.verdict('incorrect');
  expect(h.attempts().at(-1)).toMatchObject({ correct: false });
  expect(h.attempts().at(-1)?.miss).toBeUndefined();
});

it('drops a reading that has not landed by the verdict: it is never attached afterwards', async () => {
  let land!: (d: any) => void;
  decide = () => new Promise(resolve => { land = resolve; });
  const h = mount([item(MISSES)]);
  await h.say('three');
  h.verdict('incorrect');
  await act(async () => { land({ miss: 'one_short', reading: 'one_short', p: .9, accepted: true, reason: 'named', ms: 1 }); for (let i = 0; i < 6; i++) await Promise.resolve(); });
  expect(h.attempts().at(-1)?.miss).toBeUndefined();
});

it('reads a second answer on its own after a retry', async () => {
  decide = async body => { const id = body.learner === 'five' ? 'one_over' : 'one_short';
    return { miss: id, reading: id, p: .9, accepted: true, reason: 'named', ms: 1 }; };
  const h = mount([item(MISSES)]);
  await h.say('three'); h.verdict('incorrect');
  await h.say('five'); h.verdict('incorrect');
  expect(h.attempts().map(a => a.miss)).toEqual(['one_short', 'one_over']);
  expect(requests.map(r => r.learner)).toEqual(['three', 'five']);
});

it('asks nothing for an item with no known misses', async () => {
  const h = mount([item()]);
  await h.say('three');
  h.verdict('incorrect');
  expect(requests).toHaveLength(0);
  expect(h.attempts().at(-1)?.miss).toBeUndefined();
});

// RP-2 (user ruling 09-28): a reply that credits nothing is decided from the learner's words, per mode (catalog
// `teachingWorkspace.missFromWords`). The observer offers the verdict; the workspace commits it only on a named miss.
it('records a not-credited answer from the words in an allowed mode, and reopens the item', async () => {
  const h = mount([item(MISSES)], { primitiveId: 'counting-board', pin: 'count' });
  await h.say('three');
  expect(h.accepts()).toBe(true);
  expect(h.verdict('incorrect', true)).toBe('committed');
  expect(h.attempts().at(-1)).toMatchObject({ source: 'speech', correct: false, miss: 'one_short' });
  expect(h.runtime.getSnapshot().task!.phase).toBe('working');
});

it('offers and commits no verdict from the words when nothing was named', async () => {
  decide = async () => ({ miss: null, reading: 'correct', p: .9, accepted: true, reason: 'correct', ms: 1 });
  const h = mount([item(MISSES)], { primitiveId: 'counting-board', pin: 'count' });
  await h.say('sechs');
  expect(h.accepts()).toBe(false);
  expect(h.verdict('incorrect', true)).not.toBe('committed');
  expect(h.attempts()).toHaveLength(0);
});

it('refuses a verdict from the words in a mode the pilot did not allow, or in a blend that includes one', async () => {
  for (const pin of ['take_away', 'count|take_away']) {
    const h = mount([item(MISSES)], { primitiveId: 'counting-board', pin });
    await h.say('three');
    expect(h.accepts()).toBe(false);
    expect(h.verdict('incorrect', true)).not.toBe('committed');
    expect(h.attempts()).toHaveLength(0);
    cleanup();
  }
});

it('sends the tutor line the learner answered, so a sub-question answer is read as no answer to the task', async () => {
  const h = mount([item(MISSES)]);
  seam.conversation = [{ role: 'assistant', content: 'How many bees on the top ', timestamp: 1 }, { role: 'assistant', content: 'petal?', timestamp: 2 }];
  await h.say('two');
  expect(requests[0]).toMatchObject({ learner: 'two', priorTutor: 'How many bees on the top petal?' });
});
