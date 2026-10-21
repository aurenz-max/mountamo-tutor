// @vitest-environment jsdom
/**
 * digital-skills-sim on its boss (`digitalSkillsSim.boss.ts`) and its lever set (`SKILL_LEVERS`): what is its own. The generic
 * W1 contract (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 * Every mode is a gesture checked by code: a click or a drop on the arena SVG (read in viewBox units), or keys. No
 * key reaches the tutor and nothing on screen marks the target. A wrong action names its miss, and every miss has a
 * help lever first.
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
import type { DigitalSkillsSimData } from './DigitalSkillsSim';
import {
  BOXES, buildSkillItems, HOMES, keyLabel, neighbours, SKILL_MISSES, skillCorrect, skillHarnessAnswers, skillItems, skillMiss,
  SPOTS, THEME_IDS, THEMES, validSkillItem, workspaceScene, emptyWork, seededRng,
  type ClickItem, type DragItem, type Point, type SkillItem, type SkillMode, type SkillTier, type TypeItem,
} from './digitalSkillsWorkspace';
import {
  BIG_BOXES_LEVER, BIG_KEYS_LEVER, BIG_TARGETS_LEVER, bigLeverSeparate, CAPITAL_CARD_LEVER, FEWER_BOXES_LEVER,
  FEWER_PICTURES_LEVER, GLOW_ROW_LEVER, glowLeak, glowRow, ONE_LETTER_LEVER, possibleMisses, SHOW_PICTURE_LEVER,
  simplerItem, SKILL_LEVERS,
} from './digitalSkillsLevers';
import { digitalSkillsSimBoss } from './digitalSkillsSim.boss';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const MODES: SkillMode[] = ['click', 'drag', 'type'];
const CTX = { typed: 0 };
const TIERS: SkillTier[] = ['easy', 'medium', 'hard'];
const farm = (...names: string[]) => names.map(n => THEMES.farm.find(x => x.name === n)!);
const home = (...names: string[]) => names.map(n => HOMES.find(x => x.name === n)!);

// Hand-built items: three farm pictures with the pig asked (its spot is the middle one), two pictures; an apple to
// drop into the bucket among three boxes, and two boxes; a small b (its mirror is d), and the word CAT.
const CLICK3: ClickItem = { id: 'click-1', mode: 'click', theme: 'farm', things: farm('cow', 'pig', 'hen'), target: 1 };
const CLICK2: ClickItem = { id: 'click-2', mode: 'click', theme: 'farm', things: farm('duck', 'horse'), target: 0 };
const DRAG3: DragItem = { id: 'drag-1', mode: 'drag', theme: 'food', thing: THEMES.food[0], homes: home('basket', 'box', 'bucket'), target: 2 };
const DRAG2: DragItem = { id: 'drag-2', mode: 'drag', theme: 'food', thing: THEMES.food[1], homes: home('cart', 'bowl'), target: 1 };
const LOW_B: TypeItem = { id: 'type-1', mode: 'type', text: 'B', lower: true };
const WORD: TypeItem = { id: 'type-2', mode: 'type', text: 'CAT', lower: false };
const BY_MODE: Record<SkillMode, SkillItem[]> = { click: [CLICK3, CLICK2], drag: [DRAG3, DRAG2], type: [LOW_B, WORD] };

const data = (mode: SkillMode, items = BY_MODE[mode]): DigitalSkillsSimData =>
  ({ title: 'Farm Mouse Practice', description: 'Practice!', challengeTypes: [mode], items });
const mount = (mode: SkillMode, items = BY_MODE[mode]) => {
  const h = mountWorkspace({ primitiveId: 'digital-skills-sim', evalMode: mode, instanceId: 'digital-skills-sim', data: data(mode, items) as never });
  h.settle(1000);
  return h;
};
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.kind, l.pulled]);
const lever = (h: WorkspaceHarness, id: string) => h.view.container.querySelector(`[data-lever="${id}"]`);

/** A press, moves and release on the arena SVG, in viewBox units (as the sweep and the driver do it). */
const stroke = (h: WorkspaceHarness, points: Point[]) => {
  const svg = h.view.container.querySelector('[data-pip-object="arena"]') as SVGSVGElement;
  expect(svg).toBeTruthy();
  Object.assign(svg, { getScreenCTM: () => ({ inverse: () => ({}) }),
    createSVGPoint: () => ({ x: 0, y: 0, matrixTransform() { return this; } }),
    setPointerCapture: () => {}, releasePointerCapture: () => {} });
  const at = (type: string, p: Point) => act(() => {
    const e = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: p.x, clientY: p.y });
    Object.assign(e, { pointerId: 1, pointerType: 'mouse', isPrimary: true });
    svg.dispatchEvent(e);
  });
  at('pointerdown', points[0]);
  for (const p of points.slice(1)) at('pointermove', p);
  at('pointerup', points[points.length - 1]);
  h.settle();
};
const click = (h: WorkspaceHarness, p: Point) => stroke(h, [p]);
const drag = (h: WorkspaceHarness, to: Point) => stroke(h, [{ x: 90, y: 150 }, { x: (90 + to.x) / 2, y: (150 + to.y) / 2 }, to]);
const keys = (h: WorkspaceHarness, ...ks: string[]) => { for (const k of ks) h.press(keyLabel(k)); h.settle(); };
const retry = (h: WorkspaceHarness) => { h.dispatch('retry'); h.confirmVisible(); };
const advance = (h: WorkspaceHarness) => { h.dispatch('advance'); h.confirmVisible(); };

it.each(MODES)('%s binds as a gesture with no key, and nothing on screen marks the target', mode => {
  const h = mount(mode);
  const item = BY_MODE[mode][0];
  expect(getComponentById('digital-skills-sim')!.evalModes!.map(m => m.evalMode)).toEqual(MODES);
  expect(h.state().owner).toBe('tutor');
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(h.state().task!.task).toBe(digitalSkillsSimBoss.assignment!(item).task);
  expect(demand(h).response).toBe('gesture');
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  expect(JSON.stringify(demand(h))).not.toMatch(/\b(left|right side|top|bottom|row|middle|highlight(ed)? key)\b/i);
  expect(h.view.container.querySelector('[data-lever]')).toBeNull();
  // No pulsing, ringed or labelled target: every picture, box or key is drawn alike.
  const html = h.view.container.innerHTML;
  expect(html).not.toMatch(/animate-pulse|animate-bounce|ring-blue/);
  if (mode === 'click') expect(new Set(Array.from(h.view.container.querySelectorAll('[data-thing] circle')).map(c => `${c.getAttribute('r')}${c.getAttribute('stroke')}`)).size).toBe(1);
  if (mode === 'drag') expect(h.view.container.querySelector('[data-pip-object="arena"]')!.textContent).not.toMatch(/basket|box|bucket/);
  if (mode === 'type') expect(new Set(Array.from(h.view.container.querySelectorAll('button[aria-label^="Tap "]')).map(b => b.className)).size).toBe(1);
  h.close();
});

it('click: a wrong picture and an empty click name their misses and close the arena; big_targets widens the reach; submits once', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('click');
  click(h, SPOTS[3][0]);
  expect(last(h)).toMatchObject({ correct: false, miss: 'wrong_picture' });
  expect(demand(h).learnerWork).toBe('Clicked the cow');
  // Closed until Try again: another click does nothing.
  click(h, SPOTS[3][1]);
  expect(h.state().task!.workspace!.attempts).toHaveLength(1);
  retry(h);
  expect(demand(h).learnerWork).toBe('Nothing done yet');
  const near = { x: 300, y: 155 };
  click(h, near);
  expect(last(h)).toMatchObject({ correct: false, miss: 'missed_picture' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'missed_picture')).toBe(BIG_TARGETS_LEVER);
  const receipt = h.dispatch('pull_lever', { lever: BIG_TARGETS_LEVER });
  expect(receipt.status).toBe('committed');
  expect(lever(h, 'big-targets')).not.toBeNull();
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/Every picture is drawn bigger/);
  retry(h);
  click(h, near);
  expect(last(h)).toMatchObject({ correct: true, assisted: true, levers: [BIG_TARGETS_LEVER] });
  advance(h);
  expect(h.state().task!.itemId).toBe('click-2');
  // Two pictures: no simpler item.
  expect(levers(h)).toEqual([[SHOW_PICTURE_LEVER, 'help', false], [BIG_TARGETS_LEVER, 'help', false]]);
  click(h, SPOTS[2][0]);
  advance(h); h.settle();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [, , metrics, work] = seam.submit.mock.calls[0];
  expect(metrics).toMatchObject({ type: 'digital-skills-sim', totalChallenges: 2 });
  expect(work.teachingAttempts.map((a: { correct: boolean; miss?: string }) => [a.correct, a.miss ?? null]))
    .toEqual([[false, 'wrong_picture'], [false, 'missed_picture'], [true, null], [true, null]]);
  h.close();
});

it('click: show_picture puts the picture beside the question only; fewer_pictures opens a two-picture item with another target', () => {
  const h = mount('click');
  expect(h.dispatch('pull_lever', { lever: SHOW_PICTURE_LEVER }).status).toBe('committed');
  const card = lever(h, 'show-picture')!;
  expect(card.textContent).toBe('🐖');
  expect(h.view.container.querySelector('[data-pip-object="arena"]')!.contains(card)).toBe(false);
  const step = h.dispatch('pull_lever', { lever: FEWER_PICTURES_LEVER });
  expect(step.status).toBe('committed');
  expect(step.state.task).toMatchObject({ itemId: 'click-1~simpler' });
  const practice = simplerItem(CLICK3) as ClickItem;
  expect(practice.things).toHaveLength(2);
  expect(practice.things[practice.target].name).not.toBe('pig');
  click(h, SPOTS[2][practice.target]);
  expect(last(h)).toMatchObject({ itemId: 'click-1~simpler', correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'click-1' });
  click(h, SPOTS[3][1]);
  expect(last(h)).toMatchObject({ itemId: 'click-1', correct: true });
  h.close();
});

it('drag: a short drop and a wrong box name their misses; big_boxes catches a near drop; fewer_boxes practices first', () => {
  const h = mount('drag');
  // A press that does not start on the picture moves nothing and commits nothing.
  stroke(h, [{ x: 300, y: 40 }, { x: 315, y: 150 }]);
  expect(h.state().task!.workspace!.attempts).toHaveLength(0);
  const bucket = BOXES[3][2], near = { x: bucket.x - 8, y: bucket.y + bucket.h / 2 };
  drag(h, near);
  expect(last(h)).toMatchObject({ correct: false, miss: 'let_go_outside' });
  expect(demand(h).learnerWork).toBe('Let go of the apple outside every box');
  expect(nextLever(h.state().task!.workspace!.levers!, 'let_go_outside')).toBe(BIG_BOXES_LEVER);
  expect(h.dispatch('pull_lever', { lever: BIG_BOXES_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelectorAll('[data-lever="big-boxes"]')).toHaveLength(3);
  retry(h);
  drag(h, { x: BOXES[3][0].x + 50, y: BOXES[3][0].y + 40 });
  expect(last(h)).toMatchObject({ correct: false, miss: 'wrong_box' });
  expect(demand(h).learnerWork).toBe('Dropped the apple into the basket');
  expect(nextLever(h.state().task!.workspace!.levers!, 'wrong_box')).toBe(SHOW_PICTURE_LEVER);
  retry(h);
  drag(h, near);
  expect(last(h)).toMatchObject({ correct: true, levers: [BIG_BOXES_LEVER] });
  advance(h);
  expect(levers(h).map(([id]) => id)).toEqual([SHOW_PICTURE_LEVER, BIG_BOXES_LEVER]);
  h.close();

  const g = mount('drag');
  const step = g.dispatch('pull_lever', { lever: FEWER_BOXES_LEVER });
  expect(step.state.task).toMatchObject({ itemId: 'drag-1~simpler' });
  const practice = simplerItem(DRAG3) as DragItem;
  expect(practice.homes).toHaveLength(2);
  expect(practice.thing.name).not.toBe('apple');
  const b = BOXES[2][practice.target];
  drag(g, { x: b.x + b.w / 2, y: b.y + b.h / 2 });
  expect(last(g)).toMatchObject({ itemId: 'drag-1~simpler', correct: true });
  g.close();
});

it('type: a mirror, a neighbour and a far key are named; capital_card and glow_row draw; a word keeps its order; one_letter practices', () => {
  const h = mount('type');
  expect(h.view.container.textContent).toContain('b');
  expect(levers(h).map(([id]) => id)).toEqual([GLOW_ROW_LEVER, BIG_KEYS_LEVER, CAPITAL_CARD_LEVER]);
  keys(h, 'D');
  expect(last(h)).toMatchObject({ correct: false, miss: 'mirror_letter' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'mirror_letter')).toBe(CAPITAL_CARD_LEVER);
  expect(h.dispatch('pull_lever', { lever: CAPITAL_CARD_LEVER }).status).toBe('committed');
  expect(lever(h, 'capital-card')!.textContent).toMatch(/b\s+·\s+B/);
  retry(h);
  keys(h, 'V');
  expect(last(h)!.miss).toBe('neighbour_key');
  expect(h.dispatch('pull_lever', { lever: BIG_KEYS_LEVER }).status).toBe('committed');
  expect(lever(h, 'big-keys')).not.toBeNull();
  retry(h);
  keys(h, 'Q');
  expect(last(h)!.miss).toBe('wrong_key');
  expect(h.dispatch('pull_lever', { lever: GLOW_ROW_LEVER }).status).toBe('committed');
  expect(lever(h, 'glow-row')!.querySelectorAll('button')).toHaveLength(7);
  expect(String(demand(h).onScreen)).toMatch(/The bottom row of the keyboard glows \(7 keys\); no single key is marked/);
  retry(h);
  keys(h, 'B');
  expect(last(h)).toMatchObject({ correct: true, levers: [CAPITAL_CARD_LEVER, BIG_KEYS_LEVER, GLOW_ROW_LEVER] });
  advance(h);
  expect(h.state().task!.itemId).toBe('type-2');
  keys(h, 'C', 'A');
  expect(h.state().task!.workspace!.attempts.filter(a => a.itemId === 'type-2')).toHaveLength(0);
  expect(demand(h).typed).toBe('Typed so far: CA');
  keys(h, 'X');
  expect(last(h)).toMatchObject({ itemId: 'type-2', correct: false, miss: 'wrong_key' });
  expect(h.dispatch('pull_lever', { lever: GLOW_ROW_LEVER }).status).toBe('committed');
  // The row of the letter to press next (T), not of the first.
  expect(String(demand(h).onScreen)).toMatch(/The top row/);
  const one = h.dispatch('pull_lever', { lever: ONE_LETTER_LEVER });
  expect(one.state.task).toMatchObject({ itemId: 'type-2~simpler' });
  const practice = simplerItem(WORD) as TypeItem;
  expect(practice.text).toHaveLength(1);
  expect('CAT').not.toContain(practice.text);
  keys(h, practice.text);
  expect(last(h)).toMatchObject({ itemId: 'type-2~simpler', correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'type-2' });
  keys(h, 'C', 'A', 'T');
  expect(last(h)).toMatchObject({ itemId: 'type-2', correct: true });
  h.close();
});

describe('the pure rules', () => {
  const all = (mode: SkillMode) => TIERS.flatMap(tier => THEME_IDS.flatMap(theme =>
    buildSkillItems({ modes: [mode], tier, theme, rng: seededRng(`${mode}${tier}${theme}`) }).map(i => ({ i, tier }))));

  it.each(MODES)('%s builds valid, keyed items at every tier, the target in more than one place', mode => {
    const built = all(mode);
    for (const { i } of built) {
      expect(validSkillItem(i), i.id).toBe(true);
      const a = skillHarnessAnswers(i);
      const right = i.mode === 'type' ? { release: null, keys: a.correct as string[] } : { release: (a.correct as Point[]).at(-1)!, keys: [] };
      const wrong = i.mode === 'type' ? { release: null, keys: a.plainWrong as string[] } : { release: (a.plainWrong as Point[]).at(-1)!, keys: [] };
      expect(skillCorrect(i, right), i.id).toBe(true);
      expect(skillCorrect(i, wrong), i.id).toBe(false);
      expect(skillMiss(i, wrong), i.id).toBeDefined();
    }
    if (mode !== 'type') {
      for (const tier of TIERS) for (const theme of THEME_IDS) {
        const set = buildSkillItems({ modes: [mode], tier, theme, rng: seededRng(`${theme}${tier}`) });
        expect(new Set(set.map(i => (i as ClickItem | DragItem).target)).size, `${mode} ${tier} ${theme}`).toBeGreaterThan(1);
      }
    }
  });

  it('the tiers are structural', () => {
    for (const { i, tier } of all('click')) if (i.mode === 'click') expect(i.things.length).toBe({ easy: 2, medium: 3, hard: 4 }[tier]);
    for (const { i, tier } of all('drag')) if (i.mode === 'drag') expect(i.homes.length).toBe({ easy: 2, medium: 3, hard: 4 }[tier]);
    for (const { i, tier } of all('type')) {
      if (i.mode !== 'type') continue;
      expect(i.text.length > 1).toBe(tier === 'hard');
      expect(i.lower).toBe(tier === 'medium');
    }
  });

  it('every wrong action names a catalog miss, and every miss an item can show is answered by a help lever first', () => {
    const entry = getComponentById('digital-skills-sim')!;
    expect(entry.teachingWorkspace!.levers).toBe(true);
    for (const mode of MODES) {
      expect([...entry.teachingWorkspace!.misses![mode]].sort()).toEqual([...SKILL_MISSES[mode]].sort());
      for (const { i } of all(mode)) {
        const ls = SKILL_LEVERS.declare(i, CTX, []);
        for (const m of possibleMisses(i)) {
          expect(SKILL_MISSES[mode]).toContain(m);
          expect(ls.find(l => l.id === nextLever(ls, m))?.kind, `${i.id} ${m}`).toBe('help');
        }
      }
    }
    expect(neighbours('B', 'V')).toBe(true);
    expect(neighbours('B', 'Q')).toBe(false);
    expect(neighbours('F', 'R')).toBe(true);
  });

  it('the levers never single out the target: the big levers never overlap, glow_row lights a whole row, facts name no key', () => {
    for (const n of [2, 3, 4]) { expect(bigLeverSeparate(n, 'click'), `click ${n}`).toBe(true); expect(bigLeverSeparate(n, 'drag'), `drag ${n}`).toBe(true); }
    for (const { i } of all('type')) {
      if (i.mode !== 'type') continue;
      for (let typed = 0; typed < i.text.length; typed++) expect(glowLeak(glowRow(i, typed))).toBe(false);
      const fact = SKILL_LEVERS.onScreen(i, CTX, [GLOW_ROW_LEVER, BIG_KEYS_LEVER]);
      expect(fact).not.toMatch(new RegExp(`\\b${i.text[0]}\\b`));
    }
    for (const mode of ['click', 'drag'] as const) for (const { i } of all(mode)) {
      const fact = SKILL_LEVERS.onScreen(i, CTX, SKILL_LEVERS.declare(i, CTX, []).filter(l => l.kind === 'help').map(l => l.id));
      const name = i.mode === 'click' ? i.things[i.target].name : i.mode === 'drag' ? i.homes[i.target].name : '';
      expect(fact, i.id).not.toContain(`the ${name}`);
      const scene = JSON.stringify(workspaceScene(i, { work: emptyWork(), reach: { big: false } }).facts.shown);
      expect(scene).not.toMatch(/\b(left|right|top|bottom|middle|first|second)\b/);
    }
  });

  it('the simpler item stays in the mode, never repeats the target, and never shrinks twice', () => {
    for (const mode of MODES) for (const { i } of all(mode)) {
      const s = simplerItem(i);
      if (!s) continue;
      expect(s.mode).toBe(mode);
      expect(validSkillItem(s)).toBe(true);
      expect(simplerItem(s)).toBeNull();
      // A practice item never shrinks again (the component also declares no lever while one is on screen).
      expect(SKILL_LEVERS.declare(s, CTX, []).some(l => l.kind === 'simplify')).toBe(false);
      if (s.mode === 'click' && i.mode === 'click') { expect(s.things).toHaveLength(2); expect(s.things[s.target].name).not.toBe(i.things[i.target].name); }
      if (s.mode === 'drag' && i.mode === 'drag') { expect(s.homes).toHaveLength(2); expect(s.thing.name).not.toBe(i.thing.name); expect(s.homes[s.target].name).not.toBe(i.homes[i.target].name); }
      if (s.mode === 'type' && i.mode === 'type') { expect(s.text).toHaveLength(1); expect(i.text).not.toContain(s.text); }
    }
    expect(simplerItem(CLICK2)).toBeNull();
    expect(simplerItem(LOW_B)).toBeNull();
  });

  it('a legacy lesson (model-written challenges) still builds code items in its modes', () => {
    const legacy = { title: 'Fun Mouse Clicking', challenges: [{ type: 'click' }, { type: 'type' }] };
    const items = skillItems(legacy);
    expect(new Set(items.map(i => i.mode))).toEqual(new Set(['click', 'type']));
    expect(skillItems(legacy)).toEqual(items);
  });
});
