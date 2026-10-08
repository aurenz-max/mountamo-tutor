// @vitest-environment jsdom
/**
 * The shared letter build (cvc-speller `make_word`, sound-swap `swap_build`) on the real teaching workspace, with a
 * real generation as the payload. The Live context, evaluation writes, sound and the judge's HTTP call are
 * substituted; every rule the ask states is checked by the real code.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';

const seam = vi.hoisted(() => ({ send: vi.fn(), submit: vi.fn(), evaluationContext: null as unknown }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'lb',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
import CvcSpeller, { type CvcSpellerData } from './CvcSpeller';
import SoundSwap, { type SoundSwapData } from './SoundSwap';
import PhonicsBlender, { type PhonicsBlenderData } from './PhonicsBlender';
import blendPayload from '../../../components/live-activity/runtime/testing/w1-payloads/phonics-blender.build_blend.json';
import { validatePhonicsBlenderData } from '../../../components/live-activity/adapters/phonicsBlenderLive';
import swapPayload from '../../../components/live-activity/runtime/testing/w1-payloads/sound-swap.swap_build.json';
import { validateSoundSwapData } from '../../../components/live-activity/adapters/soundSwapLive';
import payload from '../../../components/live-activity/runtime/testing/w1-payloads/cvc-speller.make_word.json';
import { getComponentById } from '../../../service/manifest/catalog';
import { validateCvcSpellerData } from '../../../components/live-activity/adapters/cvcSpellerLive';
import {
  askableLetterItem, letterBuildLevers, letterItemsFrom, letterShapeMiss, makeLetterItems, smallBankFor, startRow,
  type LetterBuildItem,
} from './letterBuild';
import { GIVEN_WORDS } from './letterBuildWords';

const data = (payload as unknown as { data: CvcSpellerData }).data;
const vowelItem: LetterBuildItem = { id: 'v', kind: 'vowel', vowel: 'a', ask: 'Make a real word with the short a sound in the middle.', bank: 'abcghmnpst'.split(''), examples: ['cat', 'map', 'bag'], ways: 1 };
const rhymeItem: LetterBuildItem = { id: 'r', kind: 'rhyme', word: 'cat', ask: 'Make a real word that rhymes with cat.', bank: 'abhmprst'.split(''), examples: ['hat', 'mat', 'rat'], ways: 1 };
const swapItem: LetterBuildItem = { id: 's', kind: 'swap', word: 'cat', ask: 'Change one letter in cat to make a new real word.', bank: 'abcdhopt'.split(''), examples: ['bat', 'cot', 'cap'], ways: 1 };
const row = (w: string) => w.split('');

type Verdict = { met: boolean; miss?: string; realWord: number; fits: number; judge: string };
let verdicts: Verdict[] = [];
const judged: { action: string; params: Record<string, unknown> }[] = [];
const real = (): Verdict => ({ met: true, realWord: 0.97, fits: 1, judge: 'jev' });
beforeEach(() => {
  vi.clearAllMocks(); seam.evaluationContext = null; verdicts = []; judged.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
    judged.push(JSON.parse(init.body));
    return { ok: true, json: async () => verdicts.shift() };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function mount(d: CvcSpellerData) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  new RuntimeTransport(runtime, () => {});
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <CvcSpeller data={{ ...d, instanceId: 'lb' }} runtimePlanItemId="plan-lb" runtimeEvalMode="make_word" />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const dispatch = (name: string, input?: Record<string, unknown>) => {
    const s = state();
    const a = s.affordances.find(x => x.action.type === name || x.action.type === 'workspace' && (x.action as { operation?: string }).operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'lb', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } as never }); });
  };
  const spell = (w: string) => { for (const l of w) act(() => { fireEvent.click(screen.getByRole('button', { name: `letter ${l}` })); }); };
  const emptyBox = (n: number) => act(() => { fireEvent.click(screen.getByRole('button', { name: new RegExp(`^box ${n},`) })); });
  const done = async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: "I'm done!" })); }); };
  const next = () => { dispatch('advance'); act(() => { runtime.confirmVisibleResponse(lastCommand); }); };
  const demand = () => state().task!.demand as Record<string, unknown>;
  return { state, dispatch, spell, emptyBox, done, next, demand };
}

describe('letter build rules (pure)', () => {
  it('checks what each ask states in code: shape, vowel, family, the given word, one letter changed, a repeat', () => {
    expect(letterShapeMiss(vowelItem, row('cat'))).toBeUndefined();
    expect(letterShapeMiss(vowelItem, row('cot'))).toBe('wrong_vowel');
    expect(letterShapeMiss(vowelItem, row('cta'))).toBe('not_cvc');
    expect(letterShapeMiss(rhymeItem, row('cat'))).toBe('same_as_given');
    expect(letterShapeMiss(rhymeItem, row('cap'))).toBe('wrong_family');
    expect(letterShapeMiss(rhymeItem, row('hat'))).toBeUndefined();
    expect(letterShapeMiss(swapItem, row('cot'))).toBeUndefined();
    expect(letterShapeMiss(swapItem, row('hop'))).toBe('changed_more');
    expect(letterShapeMiss(vowelItem, row('cat'), ['cat'])).toBe('same_word');
    expect(letterShapeMiss(vowelItem, row('sex'))).toBe('wrong_vowel');
    expect(letterShapeMiss({ ...vowelItem, vowel: 'e' }, row('sex'))).toBe('pick_another');
  });

  it('drops an ask that names a passing word or that fewer than two bank words answer', () => {
    expect(askableLetterItem({ ...rhymeItem, ask: 'Make a word like hat that rhymes with cat.' })).toBeNull();
    expect(askableLetterItem({ ...rhymeItem, examples: ['hat', 'map'] })).toBeNull();
    expect(askableLetterItem(rhymeItem)!.examples).toEqual(['hat', 'mat', 'rat']);
  });

  it('code-owned asks stay inside the letter group, give only familiar words, and always have 3+ answers', () => {
    const letters = 'satipncker'.split('');
    for (let n = 0; n < 20; n++) {
      for (const item of makeLetterItems(['vowel', 'rhyme', 'swap'], letters, [], 4)) {
        expect(item.bank.every(l => letters.includes(l)), item.ask).toBe(true);
        expect(item.examples.length).toBeGreaterThanOrEqual(3);
        if (item.word) expect(GIVEN_WORDS.has(item.word), item.word).toBe(true);
        expect(askableLetterItem(item), item.ask).not.toBeNull();
      }
    }
  });

  it('a swap starts with the given word in the boxes; the small bank is smaller and keeps an example', () => {
    expect(startRow(swapItem)).toEqual(['c', 'a', 't']);
    expect(startRow(vowelItem)).toEqual(['', '', '']);
    const small = smallBankFor(vowelItem)!;
    expect(small.bank.length).toBeLessThan(vowelItem.bank.length);
    expect(small.examples[0].split('').every(l => small.bank.includes(l))).toBe(true);
  });

  it('the live adapter accepts the generation; the catalog names every miss and a lever answers each named one', () => {
    expect(() => validateCvcSpellerData(data)).not.toThrow();
    const tw = getComponentById('cvc-speller')!.teachingWorkspace!;
    const items = letterItemsFrom(data.buildItems!);
    const answered = new Set(items.flatMap(i => letterBuildLevers(i, []).flatMap(l => l.answers ?? [])));
    for (const m of tw.misses!.make_word) if (!tw.unanswered!.make_word.includes(m)) expect(answered.has(m), m).toBe(true);
  });
});

describe('make_word on the workspace', () => {
  it('binds the ask as a gesture with no key; done waits for three letters', () => {
    const h = mount(data);
    expect(h.state().task!.task).toMatch(/short a sound/);
    expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
    expect((screen.getByRole('button', { name: "I'm done!" }) as HTMLButtonElement).disabled).toBe(true);
    h.spell('ca');
    expect(h.demand()).toMatchObject({ boxes: 'c a _', lettersPlaced: 2 });
    expect((screen.getByRole('button', { name: "I'm done!" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('a wrong vowel misses in code with no judge call; Try again keeps the boxes; a real word passes', async () => {
    const h = mount(data);
    h.spell('cet');
    await h.done();
    expect(judged).toHaveLength(0);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    h.dispatch('retry');
    expect(h.demand()).toMatchObject({ boxes: 'c e t' });
    h.emptyBox(2); h.spell('a');
    verdicts.push(real());
    await h.done();
    expect(judged[0]).toMatchObject({ action: 'judgeWordBuild', params: { made: 'cat', only: 'real_word' } });
    expect(h.state().task!.evidence.correctness).toBe('correct');
  });

  it('a rhyme item asking for two words keeps the first, refuses the given word, and commits the second', async () => {
    const h = mount(data);
    h.spell('cat'); verdicts.push(real()); await h.done();
    h.next();
    expect(h.state().task!.task).toMatch(/rhymes with dad\. Then make a different one/);
    h.spell('sad'); verdicts.push(real()); await h.done();
    expect(h.state().task!.evidence.correctness).not.toBe('correct');
    expect(screen.getByTestId('lb-made').textContent).toContain('sad');
    h.spell('dad'); await h.done();
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(screen.getByText(/That is dad itself/)).toBeTruthy();
    h.dispatch('retry');
    h.emptyBox(1); h.spell('m'); verdicts.push(real()); await h.done();
    expect(judged.at(-1)!.params.made).toBe('mad');
    expect(h.state().task!.evidence.correctness).toBe('correct');
  });

  it('a made-up word is not_a_word; the pattern lever shows the fixed part and no letter to choose', async () => {
    const h = mount(data);
    h.spell('lam');
    verdicts.push({ met: false, miss: 'not_a_word', realWord: 0.2, fits: 1, judge: 'jev+flash' });
    await h.done();
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(screen.getByText(/not a word we use/)).toBeTruthy();
    h.dispatch('pull_lever', { lever: 'pattern_card' });
    expect(document.querySelector('[data-lever="pattern-card"]')!.textContent).toMatch(/^_ a _/);
  });
});

describe('swap_build on the workspace (sound-swap host)', () => {
  const swap = (swapPayload as unknown as { data: SoundSwapData }).data;
  function mountSwap() {
    const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
    new RuntimeTransport(runtime, () => {});
    render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
      <SoundSwap data={{ ...swap, instanceId: 'lb' }} runtimePlanItemId="plan-lb" runtimeEvalMode="swap_build" />
    </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
    const retry = () => {
      const s = runtime.getSnapshot();
      const a = s.affordances.find(x => x.action.type === 'retry')!;
      act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: crypto.randomUUID(), instanceId: 'lb', itemId: s.task!.itemId,
        expectedRevision: s.revision, action: a.action }); });
    };
    return Object.assign(() => runtime.getSnapshot(), { retry });
  }

  it('opens with the given word in the boxes; two letters changed misses in code; one letter changed is judged and passes', async () => {
    const state = mountSwap();
    const given = swap.buildItems![0].word!;
    expect(state().task!.task).toContain(`Change one letter in ${given}`);
    expect((state().task!.demand as Record<string, unknown>).boxes).toBe(given.split('').join(' '));
    expect(() => validateSoundSwapData(swap)).not.toThrow();
    const target = swap.buildItems![0].examples.find(w => w[0] !== given[0] && w.slice(1) === given.slice(1))
      ?? swap.buildItems![0].examples[0];
    const at = target.split('').findIndex((l, i) => l !== given[i]);
    // Change two letters first: box 1 and box 3.
    const bank = swap.buildItems![0].bank;
    const other = (i: number) => bank.find(l => l !== given[i] && !'aeiou'.includes(l))!;
    for (const i of [0, 2]) {
      act(() => { fireEvent.click(screen.getByRole('button', { name: new RegExp(`^box ${i + 1},`) })); });
      act(() => { fireEvent.click(screen.getByRole('button', { name: `letter ${other(i)}` })); });
    }
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: "I'm done!" })); });
    expect(judged).toHaveLength(0);
    expect(state().task!.evidence.correctness).toBe('incorrect');
    expect(screen.getByText(/More than one letter changed/)).toBeTruthy();
    state.retry();
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Start over' })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: new RegExp(`^box ${at + 1},`) })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: `letter ${target[at]}` })); });
    verdicts.push(real());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: "I'm done!" })); });
    expect(judged[0].params).toMatchObject({ made: target, only: 'real_word' });
  });
});

describe('build_blend (phonics-blender host): two tiles, a blend at the start or the end', () => {
  const blend = (blendPayload as unknown as { data: PhonicsBlenderData }).data;
  const start: LetterBuildItem = { id: 'b', kind: 'blend_start', ask: 'Make a real word that starts with two consonant sounds blended together.',
    bank: ['st', 'sp', 'm', 'op', 'in', 'ug'], examples: ['stop', 'spin'], ways: 1 };
  const end: LetterBuildItem = { id: 'e', kind: 'blend_end', ask: 'Make a real word that ends with two consonant sounds blended together.',
    bank: ['l', 'c', 'bl', 'amp', 'and', 'at'], examples: ['lamp', 'camp'], ways: 1 };

  it('checks the tile order and the blend in code', () => {
    expect(startRow(start)).toEqual(['', '']);
    expect(letterShapeMiss(start, ['st', 'op'])).toBeUndefined();
    expect(letterShapeMiss(start, ['m', 'ug'])).toBe('no_blend');
    expect(letterShapeMiss(start, ['op', 'st'])).toBe('wrong_order');
    expect(letterShapeMiss(end, ['l', 'amp'])).toBeUndefined();
    expect(letterShapeMiss(end, ['bl', 'at'])).toBe('no_blend');
    expect(letterShapeMiss(end, ['bl', 'and'])).toBeUndefined();
    expect(askableLetterItem(start)!.examples).toEqual(['stop', 'spin']);
  });

  it('code-owned blend asks always have 3+ buildable answers; the adapter accepts the generation', () => {
    for (let n = 0; n < 20; n++) for (const item of makeLetterItems(['blend_start', 'blend_end'], [], [], 4)) {
      expect(askableLetterItem(item)!.examples.length).toBeGreaterThanOrEqual(3);
    }
    expect(() => validatePhonicsBlenderData(blend)).not.toThrow();
    const tw = getComponentById('phonics-blender')!.teachingWorkspace!;
    const answered = new Set(letterItemsFrom(blend.buildItems!).flatMap(i => letterBuildLevers(i, []).flatMap(l => l.answers ?? [])));
    for (const m of tw.misses!.build_blend) if (!tw.unanswered!.build_blend.includes(m)) expect(answered.has(m), m).toBe(true);
  });

  it('on the workspace: two tiles fill the two slots; a no-blend word misses in code; a blend word goes to the judge', async () => {
    const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
    new RuntimeTransport(runtime, () => {});
    render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
      <PhonicsBlender data={{ ...blend, instanceId: 'lb' }} runtimePlanItemId="plan-lb" runtimeEvalMode="build_blend" />
    </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
    const item = letterItemsFrom(blend.buildItems!)[0];
    const single = item.bank.find(t => t.length === 1 && !'aeiou'.includes(t))!;
    const vowelEnd = item.bank.find(t => 'aeiou'.includes(t[0]))!;
    for (const t of [single, vowelEnd]) act(() => { fireEvent.click(screen.getByRole('button', { name: new RegExp(`^letter ${t}$`) })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: "I'm done!" })); });
    expect(judged).toHaveLength(0);
    expect(runtime.getSnapshot().task!.evidence.correctness).toBe('incorrect');
    const s = runtime.getSnapshot();
    const retry = s.affordances.find(x => x.action.type === 'retry')!;
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: crypto.randomUUID(), instanceId: 'lb', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: retry.action }); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Start over' })); });
    const ex = item.examples[0];
    const cut = [1, 2, 3].find(i => item.bank.includes(ex.slice(0, i)) && item.bank.includes(ex.slice(i)))!;
    for (const t of [ex.slice(0, cut), ex.slice(cut)]) act(() => { fireEvent.click(screen.getByRole('button', { name: new RegExp(`^letter ${t}$`) })); });
    verdicts.push(real());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: "I'm done!" })); });
    expect(judged[0].params).toMatchObject({ made: ex, only: 'real_word' });
    expect(runtime.getSnapshot().task!.evidence.correctness).toBe('correct');
  });
});
