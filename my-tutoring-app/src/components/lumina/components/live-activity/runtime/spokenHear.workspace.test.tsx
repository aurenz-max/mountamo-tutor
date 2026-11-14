// @vitest-environment jsdom
/**
 * `spoken_hear` wiring: on an item the spoken preset gives `hear` (from its key and misses), the learner's clip heard blind is the primary miss reading,
 * the transcript reading (`spoken_miss`) the fallback, and credit stays with the tutor. Both readings are stubs here;
 * what the model hears is measured on the Voice Studio bench (Hear the word).
 */
import React, { useLayoutEffect, useRef } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTeachingWorkspace, type TeachingItem, type TeachingWorkspace } from './useTeachingWorkspace';
import { LiveRuntimeContext } from './LiveRuntimeContext';
import { LiveLessonRuntime } from './LiveLessonRuntime';
import { WorkspacePin } from './workspacePin';
import type { KnownMiss } from './spokenMissContract';
import { missOfHearing, validSpokenHearRequest } from './spokenHearContract';
import { hearKeyOf } from '../boss';
import { hearCandidates } from '../../../service/typesafe/blindWordCandidates';
import { letterSoundLinkBoss } from '../../../primitives/visual-primitives/literacy/letterSoundLink.boss';
import { phonicsBlenderBoss } from '../../../primitives/visual-primitives/literacy/phonicsBlender.boss';

const seam = vi.hoisted(() => ({ conversation: [] as any[], sendText: vi.fn(), clip: null as null | { base64: string; ms: number } }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useLuminaAIContext: () => ({ ...seam, isAudioPlaying: false }) }));
vi.mock('../../../utils/learnerClip', () => ({ latestLearnerClip: () => seam.clip }));

const MISSES: KnownMiss[] = [
  { id: 'first_sound_changed', pattern: 'A different word with the first sound changed, like "hat".', examples: ['hat'] },
  { id: 'letter_name', pattern: 'Letter names, "em ay tee".', examples: ['M, A, T', 'em ay tee'] },
];
const item = (hear = true): TeachingItem => ({ id: 'mat', task: 'Read this word: m a t', expectedAnswer: '"mat".', response: 'speech',
  checkResponse: () => null, misses: MISSES, ...(hear ? { hear: { answers: ['mat'] } } : {}) });

function Spoken({ items }: { items: TeachingItem[] }) {
  const workspace = useRef<TeachingWorkspace | null>(null);
  useTeachingWorkspace({ instanceId: 'mat', primitiveId: 'phonics-blender', items, workspace });
  useLayoutEffect(() => { workspace.current = { objects: [], facts: { letters: 'm a t' } }; });
  return null;
}

type Reading = { miss: string | null; reading: string | null; p: number | null; accepted: boolean };
let transcript: () => Promise<Reading>, audio: () => Promise<Reading & { heard: string | null }>;
const posted: Record<string, any[]> = {};
const ok = (r: Reading) => ({ ...r, reason: 'stub', ms: 1 });
beforeEach(() => {
  seam.conversation = []; seam.clip = { base64: 'A'.repeat(100), ms: 900 };
  for (const k of Object.keys(posted)) delete posted[k];
  transcript = async () => ok({ miss: null, reading: 'other_wrong', p: .8, accepted: true });
  audio = async () => ({ ...ok({ miss: 'first_sound_changed', reading: 'first_sound_changed', p: .95, accepted: true }), heard: 'hat' });
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const path = String(url).replace(/^.*\/api\/lumina\//, '');
    (posted[path] ??= []).push(JSON.parse(String(init!.body)));
    if (path === 'observe-spoken-miss') return { ok: true, json: () => transcript() };
    if (path === 'observe-spoken-hear') return { ok: true, json: () => audio() };
    return { ok: false, json: async () => ({}) };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function mount(items: TeachingItem[]) {
  const runtime = new LiveLessonRuntime('spoken', { allowAnswerExposure: true, maxSupportLevel: 3, allowSupportArtifacts: false });
  const tree = () => <LiveRuntimeContext.Provider value={runtime}><WorkspacePin pin="cvc"><Spoken items={items} /></WorkspacePin></LiveRuntimeContext.Provider>;
  const view = render(tree());
  const settle = async () => { await act(async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); }); };
  const say = async (text: string) => {
    seam.conversation = [...seam.conversation, { role: 'user', content: text, timestamp: seam.conversation.length + 1 }];
    await act(async () => { view.rerender(tree()); });
    await settle();
  };
  const verdict = (v: 'correct' | 'incorrect') => {
    const s = runtime.getSnapshot();
    const a = s.affordances.find(x => x.action.type === 'workspace' && (x.action as any).operation === 'apply_tutor_verdict')!;
    act(() => { runtime.dispatch({ sessionEpoch: s.sessionEpoch, commandId: crypto.randomUUID(), instanceId: 'mat', itemId: 'mat',
      expectedRevision: s.revision, action: { ...a.action, input: { dialogue: { responseId: s.task!.workspace!.pendingResponse!.id, verdict: v,
        transition: v === 'correct' ? 'advance' : 'retry', tutor: v === 'correct' ? 'Yes!' : 'Let us look again.' } } } }); });
  };
  const trace = (stage: string) => runtime.trace.getSnapshot().filter(e => e.stage === stage);
  return { runtime, say, settle, verdict, trace, attempts: () => runtime.getSnapshot().task!.workspace!.attempts };
}

it('names the miss from the clip over the transcript reading, and sends the model no answer', async () => {
  const h = mount([item()]);
  await h.say('mat');
  expect(posted['observe-spoken-hear']).toHaveLength(1);
  expect(posted['observe-spoken-hear'][0]).toMatchObject({ hear: { answers: ['mat'] }, misses: MISSES, scope: { itemId: 'mat' } });
  expect(posted['observe-spoken-hear'][0]).not.toHaveProperty('expectedAnswer');
  expect(posted['observe-spoken-hear'][0]).not.toHaveProperty('task');
  h.verdict('incorrect');
  expect(h.attempts().at(-1)).toMatchObject({ correct: false, miss: 'first_sound_changed' });
});

it('keeps the clip\'s reading when the transcript lands after it', async () => {
  let land!: (r: Reading) => void;
  transcript = () => new Promise(r => { land = r; });
  audio = async () => ({ ...ok({ miss: null, reading: 'correct', p: .9, accepted: true }), heard: 'mat' });
  const h = mount([item()]);
  await h.say('hat');
  await act(async () => { land(ok({ miss: 'first_sound_changed', reading: 'first_sound_changed', p: .9, accepted: true })); });
  await h.settle();
  h.verdict('incorrect');
  expect(h.attempts().at(-1)?.miss).toBeUndefined();
  expect(h.trace('spoken_miss').at(-1)?.reason).toMatch(/audio reading already settled/);
});

it('lets the transcript reading stand when the clip pick is below the gate', async () => {
  transcript = async () => ok({ miss: 'letter_name', reading: 'letter_name', p: .9, accepted: true });
  audio = async () => ({ ...ok({ miss: null, reading: 'first_sound_changed', p: .4, accepted: false }), heard: 'hat' });
  const h = mount([item()]);
  await h.say('em ay tee');
  h.verdict('incorrect');
  expect(h.attempts().at(-1)?.miss).toBe('letter_name');
});

it('falls back to the transcript when no clip was captured', async () => {
  seam.clip = null;
  transcript = async () => ok({ miss: 'letter_name', reading: 'letter_name', p: .9, accepted: true });
  const h = mount([item()]);
  await h.say('em ay tee');
  expect(posted['observe-spoken-hear']).toBeUndefined();
  expect(h.trace('spoken_audio').at(-1)?.status).toBe('skipped');
  h.verdict('incorrect');
  expect(h.attempts().at(-1)?.miss).toBe('letter_name');
});

it('leaves a credit to the tutor and records the clip\'s disagreement for review', async () => {
  const h = mount([item()]);
  await h.say('mat');
  h.verdict('correct');
  expect(h.attempts().at(-1)).toMatchObject({ correct: true });
  expect(h.attempts().at(-1)?.miss).toBeUndefined();
  expect(h.trace('spoken_audio').some(e => e.status === 'disagrees')).toBe(true);
});

it('hears nothing on an item without hear', async () => {
  const h = mount([item(false)]);
  await h.say('hat');
  expect(posted['observe-spoken-hear']).toBeUndefined();
  expect(posted['observe-spoken-miss']).toHaveLength(1);
});

describe('spoken_hear contract', () => {
  it('reads a pick onto the item\'s own miss ids, or a listed example word', () => {
    expect(missOfHearing('first_sound_changed', 'hat', MISSES)).toBe('first_sound_changed');
    expect(missOfHearing('middle_sound_changed', 'hat', MISSES)).toBe('first_sound_changed');
    expect(missOfHearing('last_sound_changed', 'map', MISSES)).toBeNull();
    expect(missOfHearing('correct', 'mat', MISSES)).toBeNull();
  });
  it('accepts a closed key, and refuses an empty or oversized one', () => {
    const base = { scope: { sessionEpoch: 'e', instanceId: 'i', itemId: 'x' }, misses: MISSES, audioBase64: 'A'.repeat(100) };
    expect(validSpokenHearRequest({ ...base, hear: { answers: ['mat'] } })).toBe(true);
    expect(validSpokenHearRequest({ ...base, hear: { answers: ['sss'], menu: ['a', 'b'] } })).toBe(true);
    expect(validSpokenHearRequest({ ...base, hear: { answers: [] } })).toBe(false);
    expect(validSpokenHearRequest({ ...base, hear: { kind: 'word', word: 'mat' } })).toBe(false);
  });
});

describe('the spoken preset derives hear from the key and misses', () => {
  const key = (answer: string, more: object = {}) => ({ answer, alsoAccept: [] as string[], ...more });
  it('hears a letter sound among every letter, a word among its neighbours', () => {
    const sss = hearCandidates({ answers: ['sss'] }, [])!;
    expect(sss.candidates.find(c => c.reading === 'correct')?.key).toBe('sound_s');
    expect(sss.candidates.some(c => c.key === 'name_s' && c.reading === 'letter_name')).toBe(true);
    expect(hearCandidates({ answers: ['/t/'] }, [])!.candidates.find(c => c.reading === 'correct')?.key).toBe('sound_t');
    const mat = hearCandidates({ answers: ['mat'] }, MISSES)!;
    expect(mat.candidates.filter(c => c.reading === 'correct').map(c => c.key)).toEqual(['mat']);
    expect(mat.candidates.some(c => c.key === 'hat' && c.reading === 'first_sound_changed')).toBe(true);
    // Every word option is worded alike, so the target's wording is no tell.
    expect(new Set(mat.candidates.filter(c => /^[a-z]+$/.test(c.key) && !c.key.startsWith('said')).map(c => c.says.replace(/"[a-z]+"/, '"_"'))).size).toBe(1);
  });
  it('hears any other closed answer among its misses and menu, and skips one with too few options', () => {
    const misses: KnownMiss[] = [{ id: 'counted_on_wrong', pattern: 'p', examples: ['six', 'eight'] },
      { id: 'added_instead', pattern: 'p', examples: ['twelve'] }];
    expect(hearKeyOf(key('7', { alsoAccept: ['seven'] }), misses)).toEqual({ answers: ['7', 'seven'] });
    expect(hearCandidates({ answers: ['7', 'seven'] }, misses)!.candidates.map(c => `${c.key}:${c.reading}`))
      .toEqual(['7:correct', 'eight:counted_on_wrong', 'said_something_else:other', 'seven:correct', 'six:counted_on_wrong', 'twelve:added_instead']);
    expect(hearKeyOf(key('7'), misses.slice(1))).toBeUndefined();
    expect(hearKeyOf(key('bigger', { menu: ['bigger', 'smaller', 'same', 'equal'] }), [])).toEqual({ answers: ['bigger'], menu: ['bigger', 'smaller', 'same', 'equal'] });
    expect(hearKeyOf(key('it grows', { meaning: { idea: 'plants grow', notIt: 'x' } }), misses)).toBeUndefined();
  });
  it('reaches the pilots with no hear of their own', () => {
    const assign = letterSoundLinkBoss.assignment;
    const base = { id: 'a', letter: 's', sound: '/s/', spoken: 'sss', keyword: 'sun', keywordEmoji: '', tier: 'medium', options: [], answer: 's',
      answerKind: 'speech', task: '', response: 'speech', checkResponse: () => null } as any;
    expect(assign({ ...base, mode: 'see-hear' }).hear).toEqual({ answers: ['sss'] });
    const word = { id: 'w', targetWord: 'mat', mode: 'cvc', supportTier: 'medium',
      phonemes: [{ id: '1', sound: '/m/', letters: 'm' }, { id: '2', sound: '/a/', letters: 'a' }, { id: '3', sound: '/t/', letters: 't' }] } as any;
    expect(phonicsBlenderBoss.assignment(word).hear).toEqual({ answers: ['mat'] });
  });
});
