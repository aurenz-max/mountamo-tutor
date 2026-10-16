// @vitest-environment jsdom
/**
 * telescope-simulator on the shared teaching workspace (W1, plain shape) and its levers: what is its own. The generic
 * W1 contract (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 * find_by_look and brightest are taps on unnamed objects, checked by code; object_type and pick_instrument are
 * code-keyed closed choices, tapped and checked or said aloud: the key is published only as the spoken expectedAnswer.
 * No object is named on screen before credit. A wrong answer names its miss, and every miss has a help lever first.
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
import type { TelescopeSimulatorData } from './TelescopeSimulator';
import {
  askOf, brightFootprint, brightness, BRIGHT_GAP, buildTelescopeItems, choiceKey, DETAILS, findMatches, isTapItem, KINDS,
  lookOf, objectDef, SCOPES, scopeRank, seededRng, skyTarget, tapKey, telescopeCorrect, telescopeHarnessAnswers,
  telescopeItems, telescopeMiss, TELESCOPE_MISSES, validTelescopeItem, workspaceAssignment, workspaceScene,
  type BrightItem, type FindItem, type InstrumentItem, type TelescopeItem, type TelescopeMode, type TelescopeTier, type TypeItem,
} from './telescopeWorkspace';
import {
  CLOSER_LEVER, CLUE_PICTURES_LEVER, clueLines, DROP_LEVER, LADDER_LEVER, leverFacts, MY_PICK_LEVER, NO_LEVERS,
  possibleMisses, SAME_SIZE_LEVER, SIDE_BY_SIDE_LEVER, telescopeLevers, TYPE_PICTURES_LEVER,
} from './telescopeLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const MODES: TelescopeMode[] = ['find_by_look', 'brightest', 'object_type', 'pick_instrument'];
const TIERS: TelescopeTier[] = ['easy', 'medium', 'hard'];

// Hand-built items: Saturn among Mars, Sirius and the Orion Nebula ("a ball with a ring around it"); Sirius beside
// the big faint Andromeda Galaxy and Polaris; the Orion Nebula to name; Saturn's rings and three instruments.
const FIND: FindItem = { id: 'find_by_look-1', mode: 'find_by_look', scope: 'small', clues: ['noun:ball', 'with:ring'], objects: [
  { object: 'mars', x: 125, y: 130 }, { object: 'saturn', x: 275, y: 128 }, { object: 'sirius', x: 128, y: 272 }, { object: 'orion-nebula', x: 276, y: 270 }] };
const BRIGHT: BrightItem = { id: 'brightest-1', mode: 'brightest', scope: 'binoculars', objects: [
  { object: 'andromeda', x: 125, y: 130 }, { object: 'sirius', x: 275, y: 128 }, { object: 'polaris', x: 128, y: 272 }] };
const TYPE: TypeItem = { id: 'object_type-1', mode: 'object_type', scope: 'small', object: 'orion-nebula', choices: ['star', 'nebula', 'galaxy'] };
const PICK: InstrumentItem = { id: 'pick_instrument-1', mode: 'pick_instrument', detail: 'saturn-ring', choices: ['binoculars', 'small', 'large'] };
const BY_MODE: Record<TelescopeMode, TelescopeItem[]> = { find_by_look: [FIND], brightest: [BRIGHT], object_type: [TYPE], pick_instrument: [PICK] };

const data = (mode: TelescopeMode): TelescopeSimulatorData =>
  ({ title: 'Night Sky Detective', overview: 'Look closely.', challengeTypes: [mode], items: BY_MODE[mode], gradeLevel: '4' });
const mount = (mode: TelescopeMode) => {
  const h = mountWorkspace({ primitiveId: 'telescope-simulator', evalMode: mode, instanceId: 'telescope-simulator', data: data(mode) as never });
  h.settle(1000);
  return h;
};
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => l.id);
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';
const tapSky = (h: WorkspaceHarness, i: number) => { h.touch(skyTarget(i)); h.press(/Check Answer/); h.settle(); };
const tap = (h: WorkspaceHarness, label: string) => { h.press(label); h.press(/Check Answer/); h.settle(); };
const flush = () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });
const NAMES = /Saturn|Mars|Sirius|Polaris|Andromeda|Orion|Pleiades|Venus|Jupiter|the Moon\b/;
const KIND_WORDS = /\b(moon|planet|star|stars|cluster|nebula|galaxy)\b/i;

it.each(MODES)('%s binds with its key out of the scene and no name on screen', mode => {
  const h = mount(mode);
  const item = BY_MODE[mode][0];
  expect(getComponentById('telescope-simulator')!.evalModes!.map(m => m.evalMode)).toEqual(MODES);
  expect(h.state().owner).toBe('tutor');
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(h.state().task!.task).toBe(workspaceAssignment(item).task);
  expect(h.view.container.querySelector('[data-lever]')).toBeNull();
  expect(text(h)).not.toMatch(/Next →|Finish|Targets|Journal|Show hints|AZ \d/);
  expect(demand(h).credited).toBeUndefined();
  if (isTapItem(item)) {
    expect(demand(h).response).toBe('gesture');
    expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
    expect(text(h)).not.toMatch(NAMES);
    expect(JSON.stringify(demand(h))).not.toMatch(NAMES);
  } else {
    expect(demand(h).response).toBe('speech');
    const key = choiceKey(item);
    expect(h.state().task!.workspace!.expectedAnswer).toMatch(mode === 'object_type' ? /^"Nebula"/ : /^"Small telescope"/);
    expect(String(demand(h).question)).not.toContain(key);
    if (mode === 'object_type') {
      expect(text(h)).not.toMatch(/Orion/);
      expect(String(demand(h).shown)).not.toMatch(KIND_WORDS);
      expect(String(demand(h).question)).not.toMatch(KIND_WORDS);
    }
    // pick_instrument draws the object through just your eyes: the rings are not drawn before credit.
    if (mode === 'pick_instrument') expect(h.view.container.querySelector('[data-seen-through]')!.getAttribute('data-seen-through')).toBe('eyes');
  }
  h.close();
});

it('find_by_look: a look-alike names near_match and closes the view; clue_pictures and closer_look draw; right, after, is helped', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('find_by_look');
  expect(askOf(FIND)).toBe('Find a ball with a ring around it.');
  expect(levers(h)).toEqual([CLOSER_LEVER, CLUE_PICTURES_LEVER, DROP_LEVER]);
  tapSky(h, 0);
  expect(last(h)).toMatchObject({ correct: false, miss: 'near_match' });
  expect(String(demand(h).learnerWork)).toMatch(/^Picked one object: a reddish-orange ball/);
  h.touch(skyTarget(1));
  expect(String(demand(h).learnerWork)).toMatch(/reddish-orange/);
  expect(nextLever(h.state().task!.workspace!.levers!, 'near_match')).toBe(CLOSER_LEVER);
  expect(h.dispatch('pull_lever', { lever: CLUE_PICTURES_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="clue-pictures"]')!.textContent).toMatch(/ball.*with a ring around it/);
  expect(String(demand(h).onScreen)).toMatch(/one model picture for each clue: ball; with a ring around it/);
  const closer = h.dispatch('pull_lever', { lever: CLOSER_LEVER });
  expect(closer.status).toBe('committed');
  expect(h.view.container.querySelector('[data-seen-through]')!.getAttribute('data-seen-through')).toBe('large');
  expect(String(demand(h).shown)).toMatch(/through a large telescope/);
  expect(text(h)).not.toMatch(NAMES);
  h.dispatch('retry'); h.confirmVisible();
  expect(demand(h).learnerWork).toBe('Nothing picked yet');
  tapSky(h, 1);
  expect(last(h)).toMatchObject({ correct: true, assisted: true, levers: [CLUE_PICTURES_LEVER, CLOSER_LEVER] });
  expect(text(h)).toMatch(/Saturn/);
  expect(String(demand(h).credited)).toMatch(/found Saturn/);
  h.dispatch('advance'); h.confirmVisible(); h.settle(); h.settle();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [, , metrics] = seam.submit.mock.calls[0];
  expect(metrics).toMatchObject({ type: 'telescope-simulator', targetObjectsTotal: 1 });
  h.close();
});

it('brightest: drop_one greys the dimmest; a big faint patch is picked_biggest; same_size and side_by_side redraw', () => {
  const h = mount('brightest');
  expect(levers(h)).toEqual([SAME_SIZE_LEVER, SIDE_BY_SIDE_LEVER, DROP_LEVER]);
  expect(h.dispatch('pull_lever', { lever: DROP_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector(`[data-pip-object="${skyTarget(0)}"]`)!.getAttribute('data-dropped')).toBe('true');
  expect(String(demand(h).onScreen)).toMatch(/oval smudge.*is greyed out and is not the answer/);
  // A greyed-out object takes no tap.
  h.touch(skyTarget(0));
  expect(demand(h).learnerWork).toBe('Nothing picked yet');
  tapSky(h, 2);
  expect(last(h)).toMatchObject({ correct: false, miss: 'picked_dimmer' });
  expect(h.dispatch('pull_lever', { lever: SAME_SIZE_LEVER }).status).toBe('committed');
  expect(String(demand(h).onScreen)).toMatch(/dot of the same size/);
  expect(h.dispatch('pull_lever', { lever: SIDE_BY_SIDE_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelectorAll('[data-lever="side-by-side"] circle')).toHaveLength(3);
  h.dispatch('retry'); h.confirmVisible();
  tapSky(h, 1);
  expect(last(h)).toMatchObject({ correct: true, assisted: true });
  expect(text(h)).toMatch(/Sirius/);
  h.close();
  // Without the drop, the big faint galaxy is the miss the pattern names.
  expect(telescopeMiss(BRIGHT, { pick: 0, choice: null })).toBe('picked_biggest');
});

it('object_type: a wrong kind names its family; closer_look and type_pictures; said aloud and credited, the name shows', async () => {
  const h = mount('object_type');
  expect(levers(h)).toEqual([CLOSER_LEVER, TYPE_PICTURES_LEVER, DROP_LEVER]);
  tap(h, 'Star');
  expect(last(h)).toMatchObject({ correct: false, miss: 'other_family' });
  expect(h.view.container.querySelector('button[aria-label="Galaxy"]')!.hasAttribute('disabled')).toBe(true);
  expect(nextLever(h.state().task!.workspace!.levers!, 'other_family')).toBe(TYPE_PICTURES_LEVER);
  expect(h.dispatch('pull_lever', { lever: TYPE_PICTURES_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="type-pictures"]')!.textContent).toBe('StarNebulaGalaxy');
  expect(h.dispatch('pull_lever', { lever: CLOSER_LEVER }).status).toBe('committed');
  expect(String(demand(h).shown)).toMatch(/through a large telescope/);
  expect(String(demand(h).shown)).not.toMatch(KIND_WORDS);
  h.dispatch('retry'); h.confirmVisible();
  h.say("it's a nebula"); await flush(); h.feedback('correct', 'advance'); h.confirmVisible(); h.settle(); await flush(); h.settle();
  expect(h.state().status).toBe('completed');
  h.close();
});

it('pick_instrument: too_strong; my_pick_view shows the learner\'s own pick; the ladder; the key draws the detail', () => {
  const h = mount('pick_instrument');
  expect(levers(h)).toEqual([LADDER_LEVER, DROP_LEVER]);
  tap(h, 'Large telescope');
  expect(last(h)).toMatchObject({ correct: false, miss: 'too_strong' });
  expect(levers(h)).toEqual([LADDER_LEVER, MY_PICK_LEVER]);
  expect(h.dispatch('pull_lever', { lever: MY_PICK_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="my-pick"]')!.textContent).toBe("Large telescope: Saturn's rings can be seen.");
  expect(h.view.container.querySelector('[data-seen-through]')!.getAttribute('data-seen-through')).toBe('large');
  expect(h.dispatch('pull_lever', { lever: LADDER_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="ladder"]')!.textContent).toMatch(/Binoculars: makes things look about 10 times bigger/);
  h.dispatch('retry'); h.confirmVisible();
  tap(h, 'Binoculars');
  expect(last(h)).toMatchObject({ correct: false, miss: 'too_weak' });
  expect(h.view.container.querySelector('[data-lever="my-pick"]')!.textContent).toBe("Binoculars: Saturn's rings cannot be seen.");
  h.dispatch('retry'); h.confirmVisible();
  tap(h, 'Small telescope');
  expect(last(h)).toMatchObject({ correct: true });
  expect(h.view.container.querySelector('[data-seen-through]')!.getAttribute('data-seen-through')).toBe('small');
  expect(String(demand(h).credited)).toMatch(/through a small telescope, where Saturn's rings can be seen/);
  h.close();
});

describe('the pure rules', () => {
  const all = (mode: TelescopeMode) => TIERS.flatMap(tier => [1, 2, 3, 4, 5].flatMap(seed =>
    buildTelescopeItems({ modes: [mode], tier, rng: seededRng(`${mode}${tier}${seed}`) }).map(i => ({ i, tier }))));

  it.each(MODES)('%s builds four valid, keyed, different items at every tier', mode => {
    for (const tier of TIERS) for (const seed of [1, 2, 3, 4, 5]) {
      const items = buildTelescopeItems({ modes: [mode], tier, rng: seededRng(`${mode}${tier}${seed}`) });
      expect(items, `${mode} ${tier} ${seed}`).toHaveLength(4);
      for (const i of items) expect(validTelescopeItem(i), `${mode} ${tier} ${i.id}`).toBe(true);
    }
  });

  it('the tiers are structural', () => {
    for (const { i, tier } of all('find_by_look')) {
      if (i.mode !== 'find_by_look') continue;
      expect(i.objects.length).toBe(tier === 'easy' ? 3 : 4);
      const key = tapKey(i);
      const shown = i.objects.map((_, k) => (k === key ? -1 : i.clues.filter(c => lookOf(objectDef(i.objects[k].object)!, i.scope).some(t => t.id === c)).length));
      if (tier === 'easy') expect(Math.max(...shown)).toBe(0);
      if (tier === 'medium') expect(i.objects.some((p, k) => k !== key && lookOf(objectDef(p.object)!, i.scope).some(t => t.id === i.clues[0]))).toBe(true);
      if (tier === 'hard') expect(shown).toContain(i.clues.length - 1);
    }
    for (const { i, tier } of all('brightest')) {
      if (i.mode !== 'brightest') continue;
      expect(i.objects.length).toBe(tier === 'easy' ? 2 : tier === 'medium' ? 3 : 4);
      const bs = i.objects.map(p => brightness(objectDef(p.object)!)).sort((a, b) => b - a);
      expect(bs[0] - bs[1]).toBeGreaterThanOrEqual(BRIGHT_GAP[tier] - 1e-9);
      if (tier === 'hard') {
        const fp = i.objects.map(p => brightFootprint(objectDef(p.object)!));
        expect(fp.indexOf(Math.max(...fp))).not.toBe(tapKey(i));
      }
    }
    for (const { i, tier } of all('object_type')) {
      if (i.mode !== 'object_type') continue;
      expect(i.choices.length).toBe(tier === 'easy' ? 2 : tier === 'medium' ? 3 : 4);
      expect(i.scope).toBe(tier === 'hard' ? 'binoculars' : 'small');
      expect([...i.choices]).toEqual(KINDS.filter(k => i.choices.includes(k)));
    }
    for (const { i, tier } of all('pick_instrument')) {
      if (i.mode !== 'pick_instrument') continue;
      expect(i.choices.length).toBe(tier === 'easy' ? 2 : tier === 'medium' ? 3 : 4);
      const at = i.choices.indexOf(choiceKey(i) as never);
      expect(at).toBeGreaterThanOrEqual(0);
    }
    // The key's place among the instruments varies: neither "always the strongest" nor "always the weakest" works.
    const places = new Set(all('pick_instrument').map(({ i }) => (i as InstrumentItem).choices.indexOf(choiceKey(i as InstrumentItem) as never)));
    expect(places.size).toBeGreaterThan(1);
  });

  it('every wrong answer names a catalog miss, and every miss an item can show is answered by a help lever first', () => {
    const entry = getComponentById('telescope-simulator')!;
    expect(entry.teachingWorkspace!.levers).toBe(true);
    for (const mode of MODES) {
      expect([...entry.teachingWorkspace!.misses![mode]].sort()).toEqual([...TELESCOPE_MISSES[mode]].sort());
      for (const { i } of all(mode)) {
        const ls = telescopeLevers(i, NO_LEVERS);
        const misses = possibleMisses(i);
        expect(misses.length, i.id).toBeGreaterThan(0);
        for (const m of misses) {
          expect(TELESCOPE_MISSES[mode]).toContain(m);
          expect(ls.find(l => l.id === nextLever(ls, m))?.kind, `${i.id} ${m}`).toBe('help');
        }
        const a = telescopeHarnessAnswers(i);
        expect(telescopeCorrect(i, a.correct), i.id).toBe(true);
        expect(telescopeCorrect(i, a.plainWrong), i.id).toBe(false);
        expect(telescopeMiss(i, a.plainWrong), i.id).toBeDefined();
      }
    }
  });

  it('no ask, scene or lever line names an unnamed object, and object_type says no kind', () => {
    for (const mode of MODES) for (const { i } of all(mode)) {
      const s = { ...NO_LEVERS, pulled: telescopeLevers(i, NO_LEVERS).filter(l => l.kind === 'help').map(l => l.id) };
      const scene = workspaceScene(i, { work: { pick: null, choice: null }, solved: false, scope: isTapItem(i) || i.mode === 'object_type' ? i.scope : 'eyes' });
      const lines = [askOf(i), String(scene.facts!.shown), leverFacts(i, s) ?? '', ...clueLines(i)];
      if (mode !== 'pick_instrument') for (const l of lines) expect(l, `${i.id}: ${l}`).not.toMatch(NAMES);
      if (mode === 'object_type') for (const l of [askOf(i), String(scene.facts!.shown)]) expect(l, `${i.id}: ${l}`).not.toMatch(KIND_WORDS);
      if (mode === 'pick_instrument') expect(askOf(i)).not.toMatch(/binoculars|telescope|eyes/i);
      if (i.mode === 'find_by_look') expect(findMatches(i)).toHaveLength(1);
    }
    // The detail table: every key is above just your eyes, so the pre-answer view never shows the detail.
    for (const d of DETAILS) expect(scopeRank(d.min)).toBeGreaterThan(0);
    expect(SCOPES).toHaveLength(5);
  });

  it('a legacy payload (sky objects and targets, no items) still builds code items by grade', () => {
    const legacy = { title: 'Explore the Night Sky', gradeLevel: '2', celestialObjects: [{ id: 'venus' }], targetObjects: ['venus'] };
    const items = telescopeItems(legacy);
    expect(new Set(items.map(i => i.mode))).toEqual(new Set(['find_by_look', 'brightest']));
    expect(telescopeItems(legacy)).toEqual(items);
  });
});
