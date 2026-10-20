// @vitest-environment jsdom
/**
 * sound-wave-explorer on its boss (a SAY_OR_SHOW card on the spoken preset) and its lever set: what is its own. The
 * generic W1 contract (runtime/workspaceContract.test.tsx) and boss.test.ts cover ownership, the packet and the wiring.
 * Every item is a code-keyed closed choice, tapped and checked or said aloud: the key is published only as the spoken
 * key (`soundKey`), nothing on screen answers it before credit (the After wave is "?", classify sounds do not play, the
 * observe picture shows the moment before the change), a wrong tap names its miss, and every miss has a help lever first.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { SoundWaveExplorerData } from './SoundWaveExplorer';
import {
  afterWave, askOf, buildSoundItems, choicesOf, keyChoice, SAME_WAVES, seededRng, SOUND_MISSES, soundHarnessAnswers,
  soundItems, soundMiss, validSoundItem, workspaceScene,
  type ApplyItem, type ClassifyItem, type ObserveItem, type PredictItem, type SoundFocus, type SoundItem, type SoundMode, type SoundTier,
} from './soundWaveWorkspace';
import {
  changeLines, CHANGE_LEVER, CREST_LEVER, FEATURE_LEVER, FEATURE_LINES, EASIER_CHANGE_LEVER, ONE_CHANGE_LEVER,
  ONE_DIFFERENCE_LEVER, PLAIN_LINK_LEVER, possibleMisses, shakeLines, SHAKE_LEVER, simplerItem, SOUND_LEVERS, soundWordLeak,
} from './soundWaveLevers';
import { soundWaveExplorerBoss } from './soundWaveExplorer.boss';

/** The levers an item declares with these already pulled. */
const declared = (i: SoundItem, pulled: string[] = []) => SOUND_LEVERS.declare(i, { pulled }, pulled);

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const MODES: SoundMode[] = ['observe', 'predict', 'classify', 'apply'];
const TIERS: SoundTier[] = ['easy', 'medium', 'hard'];
const FOCI: SoundFocus[] = ['vibration', 'loudness', 'pitch', 'both'];

// Hand-built items, one ordinary and one harder shape per mode.
const STRUCK: ObserveItem = { id: 'observe-1', mode: 'observe', maker: 'guitar_string', event: 'struck' };
const HEARD: ObserveItem = { id: 'observe-2', mode: 'observe', maker: 'bell', event: 'heard_start' };
const TIGHTEN: PredictItem = { id: 'predict-1', mode: 'predict', maker: 'guitar_string', before: { amp: 3, crests: 2 }, change: 'speed_up', asked: 'pitch', wording: 'physical' };
const HARDER_PITCH: PredictItem = { id: 'predict-2', mode: 'predict', maker: 'drum', before: { amp: 2, crests: 3 }, change: 'force_up', asked: 'pitch', wording: 'physical' };
const CROSSED: ClassifyItem = { id: 'classify-1', mode: 'classify', maker: 'drum', asked: 'pitch', ask: 'most', waves: [{ amp: 4, crests: 2 }, { amp: 2, crests: 4 }] };
const SAME: ClassifyItem = { id: 'classify-2', mode: 'classify', maker: 'drum', asked: 'loudness', ask: 'most', waves: [{ amp: 3, crests: 2 }, { amp: 3, crests: 5 }] };
const LOOSEN: ApplyItem = { id: 'apply-1', mode: 'apply', maker: 'guitar_string', before: { amp: 3, crests: 4 }, changes: ['speed_down'], wording: 'physical' };
const BOTH: ApplyItem = { id: 'apply-2', mode: 'apply', maker: 'drum', before: { amp: 2, crests: 4 }, changes: ['force_up', 'speed_down'], wording: 'physical' };
const BY_MODE: Record<SoundMode, SoundItem[]> = { observe: [STRUCK, HEARD], predict: [TIGHTEN, HARDER_PITCH], classify: [CROSSED, SAME], apply: [LOOSEN, BOTH] };

const data = (mode: SoundMode, items = BY_MODE[mode]): SoundWaveExplorerData =>
  ({ title: 'Shake and Hum', description: 'The tighter string is higher!', challengeTypes: [mode], items, gradeLevel: '2' });
const mount = (mode: SoundMode, items = BY_MODE[mode]) => {
  const h = mountWorkspace({ primitiveId: 'sound-wave-explorer', evalMode: mode, instanceId: 'sound-wave-explorer', data: data(mode, items) as never });
  h.settle(1000);
  return h;
};
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.kind, l.pulled]);
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';
const buttons = (h: WorkspaceHarness) => Array.from(h.view.container.querySelectorAll('button')).map(b => b.getAttribute('aria-label') ?? b.textContent ?? '');
const answer = (h: WorkspaceHarness, label: string) => { h.press(label); h.press(/Check Answer/); h.settle(); };
const current = (h: WorkspaceHarness, mode: SoundMode, items = BY_MODE[mode]) => soundItems(data(mode, items)).find(i => i.id === h.state().task!.itemId)!;
const flush = () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });

it.each(MODES)('%s binds as a spoken-or-tapped choice whose key stays out of the scene and nothing answers it on screen', mode => {
  const h = mount(mode);
  const item = current(h, mode);
  expect(getComponentById('sound-wave-explorer')!.evalModes!.map(m => m.evalMode)).toEqual(MODES);
  expect(h.state().owner).toBe('tutor');
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(h.state().task!.task).toBe(soundWaveExplorerBoss.assignment(item).task);
  expect(soundWaveExplorerBoss.assignment(item)).toMatchObject({ response: 'speech', acceptsGesture: true });
  expect(demand(h).response).toBe('speech');
  expect(h.state().task!.workspace!.expectedAnswer).toContain(keyChoice(item));
  const facts = JSON.stringify({ ...demand(h), choices: '' });
  expect(facts).not.toMatch(/\bnow\b|has run|\bcorrect\b/i);
  if (mode !== 'classify') expect(facts).not.toContain(`"${keyChoice(item)}"`);
  // No description, no Next, no lever card, no After sound or classify sound before credit.
  expect(text(h)).not.toMatch(/tighter string is higher|Next →|Finish/);
  expect(h.view.container.querySelector('[data-lever]')).toBeNull();
  expect(buttons(h).filter(b => /^Hear (after|Sound)/.test(b))).toEqual([]);
  if (mode === 'predict') expect(h.view.container.querySelector('[data-wave="After"]')!.textContent).toContain('?');
  h.close();
});

it('classify: a wrong tap names its miss and closes the choices; Try again reopens; right, then spoken "same", submits once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('classify');
  expect(h.state().task!.itemId).toBe('classify-1');
  expect(keyChoice(CROSSED)).toBe('Sound B');
  answer(h, 'Sound A');
  expect(last(h)).toMatchObject({ correct: false, miss: 'read_other_feature' });
  expect(demand(h).learnerWork).toBe('Chose "Sound A"');
  expect(h.view.container.querySelector('button[aria-label="Sound B"]')!.hasAttribute('disabled')).toBe(true);
  h.dispatch('retry'); h.confirmVisible();
  expect(demand(h)).toMatchObject({ learnerWork: 'Nothing chosen yet' });
  answer(h, 'Sound B');
  expect(last(h)).toMatchObject({ correct: true });
  // Credited: each wave can now be heard.
  expect(buttons(h)).toEqual(expect.arrayContaining(['Hear Sound A', 'Hear Sound B']));
  expect(String(demand(h).run)).toMatch(/Hear button/);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('classify-2');
  expect(keyChoice(SAME)).toBe(SAME_WAVES);
  h.say('they are the same'); await flush(); h.feedback('correct', 'advance'); h.confirmVisible(); h.settle(); await flush(); h.settle();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [, , metrics, work] = seam.submit.mock.calls[0];
  expect(metrics).toMatchObject({ type: 'sound-wave-explorer', challengesCorrect: 2 });
  expect(work.teachingAttempts.map((a: { correct: boolean; miss?: string }) => [a.correct, a.miss ?? null]))
    .toEqual([[false, 'read_other_feature'], [true, null], [true, null]]);
  h.close();
});

it('predict: the After wave is "?" until credit; change_card and feature_card change the screen; easier_change opens the shaking-words item, then the full item', () => {
  const h = mount('predict');
  // Shaking first, then sound: the feature card is offered once the change card is up.
  expect(levers(h).map(([id]) => id)).toEqual([CHANGE_LEVER, EASIER_CHANGE_LEVER]);
  answer(h, soundHarnessAnswers(TIGHTEN).plainWrong);
  expect(last(h)!.miss).toBe('opposite_direction');
  expect(nextLever(h.state().task!.workspace!.levers!, 'opposite_direction')).toBe(CHANGE_LEVER);
  const receipt = h.dispatch('pull_lever', { lever: CHANGE_LEVER });
  expect(receipt.status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="change-card"]')!.textContent).toBe('Made tighter: the guitar string shakes back and forth faster.');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/shakes back and forth faster/);
  expect(levers(h).map(([id]) => id)).toEqual([CHANGE_LEVER, FEATURE_LEVER, EASIER_CHANGE_LEVER]);
  expect(h.dispatch('pull_lever', { lever: FEATURE_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="feature-card"]')!.textContent).toContain(FEATURE_LINES[1]);
  const practice = h.dispatch('pull_lever', { lever: EASIER_CHANGE_LEVER });
  expect(practice.status).toBe('committed');
  expect(practice.state.task).toMatchObject({ itemId: 'predict-1~simpler' });
  const simpler = simplerItem(TIGHTEN) as PredictItem;
  expect(simpler).toMatchObject({ change: 'speed_down', wording: 'shaking', asked: 'pitch' });
  expect(keyChoice(simpler)).toBe('Lower');
  expect(h.view.container.querySelector('[data-practice="simpler"]')).not.toBeNull();
  answer(h, 'Lower');
  expect(last(h)).toMatchObject({ itemId: 'predict-1~simpler', correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'predict-1' });
  expect(h.view.container.querySelector('[data-wave="After"]')!.textContent).toContain('?');
  answer(h, 'Higher');
  expect(last(h)).toMatchObject({ itemId: 'predict-1', correct: true, levers: [CHANGE_LEVER, FEATURE_LEVER, EASIER_CHANGE_LEVER] });
  expect(h.view.container.querySelector('[data-wave="After"]')!.textContent).not.toContain('?');
  expect(buttons(h)).toContain('Hear after');
  h.close();
});

it('predict (hard): a change to the other feature keys "Stays the same"; saying it changes is mixed_up_features', () => {
  expect(keyChoice(HARDER_PITCH)).toBe('Stays the same');
  expect(['Higher', 'Lower'].map(c => soundMiss(HARDER_PITCH, c))).toEqual(['mixed_up_features', 'mixed_up_features']);
  const simpler = simplerItem(HARDER_PITCH) as PredictItem;
  expect(simpler).toMatchObject({ asked: 'pitch', wording: 'shaking', change: 'speed_up' });
  expect(keyChoice(simpler)).toBe('Higher');
});

it('observe: the picture shows the moment before; shake_card commits; plain_link only off the easy shape', () => {
  const h = mount('observe');
  expect(h.view.container.querySelector('[data-sound-mark="on"]')).toBeNull();
  expect(levers(h)).toEqual([[SHAKE_LEVER, 'help', false]]);
  answer(h, 'Nothing changes');
  expect(last(h)!.miss).toBe('said_no_change');
  const receipt = h.dispatch('pull_lever', { lever: SHAKE_LEVER });
  expect(receipt.status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="shake-card"]')!.textContent).toMatch(/hand on your throat/);
  h.dispatch('retry'); h.confirmVisible();
  answer(h, 'A sound starts');
  expect(last(h)).toMatchObject({ correct: true, assisted: true, levers: [SHAKE_LEVER] });
  expect(h.view.container.querySelector('[data-sound-mark="on"]')).not.toBeNull();
  expect(declared(HEARD).map(l => l.id)).toEqual([SHAKE_LEVER, PLAIN_LINK_LEVER]);
  expect(simplerItem(HEARD)).toMatchObject({ mode: 'observe', event: 'held', maker: 'bell' });
  h.close();
});

it('apply: crest_marks numbers every wave; one_change opens the drum with one change; each two-part answer names which part is wrong', () => {
  expect(choicesOf(BOTH)).toEqual(['Hit harder and tightened the drum skin', 'Hit harder and loosened the drum skin',
    'Hit more gently and tightened the drum skin', 'Hit more gently and loosened the drum skin']);
  expect(keyChoice(BOTH)).toBe('Hit harder and loosened the drum skin');
  expect(choicesOf(BOTH).map(c => soundMiss(BOTH, c))).toEqual(['pitch_misread', undefined, 'both_misread', 'loudness_misread']);
  const h = mount('apply', [BOTH]);
  expect(levers(h).map(([id]) => id)).toEqual([CHANGE_LEVER, FEATURE_LEVER, CREST_LEVER, ONE_CHANGE_LEVER]);
  expect(h.dispatch('pull_lever', { lever: CREST_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelectorAll('[data-lever="crest-marks"]')).toHaveLength(2);
  answer(h, 'Hit harder and tightened the drum skin');
  expect(last(h)!.miss).toBe('pitch_misread');
  const receipt = h.dispatch('pull_lever', { lever: ONE_CHANGE_LEVER });
  expect(receipt.status).toBe('committed');
  const one = simplerItem(BOTH) as ApplyItem;
  expect(one.changes).toEqual(['force_up']);
  answer(h, keyChoice(one));
  expect(last(h)).toMatchObject({ itemId: 'apply-2~simpler', correct: true });
  h.close();
});

describe('the pure rules', () => {
  const all = (mode: SoundMode) => TIERS.flatMap(tier => FOCI.flatMap(focus =>
    buildSoundItems({ modes: [mode], tier, focus, rng: seededRng(`${mode}${tier}${focus}`) }).map(i => ({ i, tier, focus }))));

  it.each(MODES)('%s builds items at every tier and focus, each valid, with distinct choices holding the key', mode => {
    for (const tier of TIERS) for (const focus of FOCI) {
      const items = buildSoundItems({ modes: [mode], tier, focus, rng: seededRng(`${mode}${tier}${focus}`) });
      expect(items.length, `${mode} ${tier} ${focus}`).toBeGreaterThanOrEqual(3);
      for (const i of items) {
        expect(validSoundItem(i), JSON.stringify(i)).toBe(true);
        expect(new Set(choicesOf(i)).size).toBe(choicesOf(i).length);
        expect(choicesOf(i)).toContain(keyChoice(i));
      }
    }
  });

  it('the tiers are structural', () => {
    for (const { i, tier } of all('observe')) {
      const ev = (i as ObserveItem).event;
      expect(tier === 'easy' ? ['struck', 'held'] : tier === 'medium' ? ['heard_start', 'heard_stop'] : ['speaker_on', 'speaker_off', 'fork_water']).toContain(ev);
    }
    for (const { i, tier } of all('predict')) {
      const p = i as PredictItem;
      expect(p.wording).toBe(tier === 'easy' ? 'shaking' : 'physical');
      if (tier !== 'hard') expect(keyChoice(p)).not.toBe('Stays the same');
    }
    for (const focus of FOCI) {
      const items = buildSoundItems({ modes: ['predict'], tier: 'hard', focus, rng: seededRng(focus) });
      const same = items.filter(i => keyChoice(i) === 'Stays the same').length;
      expect(same, focus).toBeGreaterThanOrEqual(1);
      expect(same, focus).toBeLessThanOrEqual(items.length / 2);
    }
    for (const { i, tier } of all('classify')) {
      const c = i as ClassifyItem;
      const other = c.asked === 'loudness' ? 'crests' : 'amp';
      if (tier === 'easy') expect(c.waves[0][other]).toBe(c.waves[1][other]);
      if (tier === 'medium') expect(soundMiss(c, choicesOf(c).find(x => x !== keyChoice(c) && x !== SAME_WAVES)!)).toBe('read_other_feature');
      if (tier === 'hard') expect(c.waves.length === 3 || keyChoice(c) === SAME_WAVES).toBe(true);
    }
    for (const { i, tier } of all('apply')) expect((i as ApplyItem).changes.length).toBe(tier === 'hard' ? 2 : 1);
    // A focused lesson asks its feature.
    for (const { i, focus } of [...all('predict'), ...all('classify')]) {
      if (focus === 'loudness' || focus === 'pitch') expect((i as PredictItem | ClassifyItem).asked).toBe(focus);
    }
  });

  it('every wrong choice names a catalog miss, and every miss an item can show is answered by a help lever first', () => {
    const entry = getComponentById('sound-wave-explorer')!;
    for (const mode of MODES) {
      expect([...entry.teachingWorkspace!.misses![mode]].sort()).toEqual([...SOUND_MISSES[mode]].sort());
      for (const { i } of all(mode)) {
        for (const c of choicesOf(i)) expect(!!soundMiss(i, c), `${i.id} ${c}`).toBe(c !== keyChoice(i));
        const ls = declared(i);
        for (const miss of possibleMisses(i)) expect(ls.find(l => l.id === nextLever(ls, miss))!.kind, `${i.id} ${miss}`).toBe('help');
        for (const l of ls) expect(`${l.when} ${l.does}`).not.toContain(keyChoice(i));
      }
    }
    expect(entry.teachingWorkspace!.levers).toBe(true);
  });

  it('no shake card or change card states a sound word or a choice; the scene before credit never describes a wave', () => {
    for (const mode of MODES) for (const { i } of all(mode)) {
      const lines = i.mode === 'observe' ? shakeLines(i) : i.mode === 'predict' || i.mode === 'apply' ? changeLines(i) : [];
      for (const line of lines) expect(soundWordLeak(line, i), `${i.id}: ${line}`).toBe(false);
      const facts = workspaceScene(i, { choice: null, solved: false }).facts as Record<string, string>;
      expect(facts.shown).not.toMatch(/\b(taller|shorter|closer|farther apart|louder|quieter|higher|lower)\b/i);
    }
    expect(askOf(TIGHTEN)).not.toMatch(/higher|faster/i);
  });

  it('the simpler item is the same mode, never the learner\'s own key, has no levers, and never shrinks twice', () => {
    for (const mode of MODES) for (const { i } of all(mode)) {
      const s = simplerItem(i);
      if (!s) continue;
      expect(s.mode).toBe(mode);
      expect(validSoundItem(s), JSON.stringify(s)).toBe(true);
      expect(keyChoice(s)).not.toBe(keyChoice(i));
      expect(simplerItem(s)).toBeNull();
      expect(declared(s).filter(l => l.kind === 'simplify')).toEqual([]);
    }
    expect(simplerItem(STRUCK)).toBeNull();
    // one_difference: two waves differing only in pitch, the key moved off the full item's label.
    expect(declared(CROSSED).map(l => l.id)).toContain(ONE_DIFFERENCE_LEVER);
    expect(simplerItem(CROSSED)).toMatchObject({ waves: [{ amp: 3, crests: 4 }, { amp: 3, crests: 2 }] });
    expect(keyChoice(simplerItem(CROSSED)!)).toBe('Sound A');
  });

  it('the after wave follows the change: harder is taller, tighter packs the crests, the air pumped out is flat', () => {
    expect(afterWave(TIGHTEN)).toEqual({ amp: 3, crests: 4 });
    expect(afterWave({ ...HARDER_PITCH })).toEqual({ amp: 4, crests: 3 });
    expect(afterWave({ id: 'x', mode: 'predict', maker: 'bell', before: { amp: 3, crests: 3 }, change: 'air_out', asked: 'loudness', wording: 'physical' })).toEqual({ amp: 0, crests: 3 });
  });

  it('a legacy lesson (challenges with types) still builds code items in its modes', () => {
    const legacy = { title: 'Fun with Sounds', challenges: [{ type: 'observe' }, { type: 'predict' }], gradeLevel: '1' };
    const items = soundItems(legacy);
    expect(new Set(items.map(i => i.mode))).toEqual(new Set(['observe', 'predict']));
    expect(soundItems(legacy)).toEqual(items);
  });
});
