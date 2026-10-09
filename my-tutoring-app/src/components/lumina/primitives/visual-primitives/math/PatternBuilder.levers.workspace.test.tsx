// @vitest-environment jsdom
/**
 * pattern-builder levers (`patternBuilderLevers.ts`), mounted the way a lesson mounts it. create: the model row is the
 * asked shape in pictures off the palette, the A B practice row is ungraded. extend / find_rule / identify_core /
 * translate: a help picture changes the screen and the scene fact in one commit and leaves the answer to the learner;
 * the simpler row is ungraded and gives the full item back blank; only the full item's answer is credited, with the
 * levers recorded.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever, observerLever } from '../../../components/live-activity/runtime/observerLever';
import type { PatternBuilderChallenge, PatternBuilderData } from './PatternBuilder';
import {
  createInstruction, patternBuilderHarnessInputs, patternBuilderMatches, paletteFor, repeatKey, shapeOf, translationOf, CREATE_SHAPES,
  type PatternBuilderView,
} from './patternBuilderWorkspace';
import {
  AB_LEVER, CORE_MODEL_LEVER, GROUPS_LEVER, LINE_LEVER, MARKER_LEVER, MODEL_LEVER, SIMPLER_LEVER, abPractice, coreModel,
  coreModelLeaks, lineLeaks, markerFact, modelLeaks, numberLine, patternBuilderLevers, practiceItem, practiceLeaks,
  practiceParent, repeatGroups, shapeModel,
} from './patternBuilderLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const PALETTE = ['red', 'blue', 'yellow'];
const make = (id: string, shape: string, supportTier?: 'easy' | 'medium' | 'hard'): PatternBuilderChallenge => ({ id, type: 'create',
  instruction: createInstruction(shape), answer: [], hint: '', narration: '', createShape: shape, availableTokens: PALETTE, supportTier });
const lesson = (challenges: PatternBuilderChallenge[], available = PALETTE): PatternBuilderData => ({ title: 'Patterns',
  patternType: 'repeating', gradeBand: 'K-1', sequence: { given: [], hidden: [], core: [], rule: null },
  tokens: { available, type: 'colors' }, challenges });
const tap = (h: WorkspaceHarness, tokens: string[]) => { for (const t of tokens) h.touch(`token-${PALETTE.indexOf(t)}`); };
const q = (h: WorkspaceHarness, sel: string) => h.view.container.querySelectorAll(sel);
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);

describe('create: the lever rules', () => {
  it.each(CREATE_SHAPES)('%s: the model is the shape twice, and no model picture is on any palette it is built for', shape => {
    for (const palette of [PALETTE, ['🍎', '🐟', 'apple', 'red'], ['circle', 'square', 'star']]) {
      const model = shapeModel(make('c', shape), palette)!;
      expect(model.glyphs).toHaveLength(2 * shape.length);
      expect(modelLeaks(model, palette)).toBe(false);
      const letters = Array.from(new Set(shape.split('')));
      expect(model.glyphs.map(g => String.fromCharCode(65 + Array.from(new Set(model.glyphs)).indexOf(g))).join(''))
        .toBe(shape + shape.split('').map(l => String.fromCharCode(65 + letters.indexOf(l))).join(''));
    }
  });
  it('the A B practice: same mode and palette, a new id, never on an A B ask', () => {
    expect(abPractice(make('c', 'ABB'))).toMatchObject({ id: 'c~simpler', type: 'create', createShape: 'AB', availableTokens: PALETTE });
    expect(abPractice(make('c', 'AB'))).toBeNull();
    expect(patternBuilderLevers(make('c', 'AB'), lesson([]), []).map(l => l.id)).toEqual([MODEL_LEVER]);
  });
  it.each([
    ['too_short', [], MODEL_LEVER], ['other_shape', [], MODEL_LEVER], ['no_repeat', [], MODEL_LEVER],
    ['other_shape', [MODEL_LEVER], AB_LEVER], ['no_repeat', [MODEL_LEVER], AB_LEVER],
  ])('after %s with %j pulled, the next lever is %s', (miss, pulled, want) => {
    expect(nextLever(patternBuilderLevers(make('c', 'ABB'), lesson([]), pulled as string[]), miss)).toBe(want);
  });
  it('an older create with no asked shape has no levers', () => {
    expect(patternBuilderLevers({ ...make('c', 'ABB'), createShape: undefined }, lesson([]), [])).toEqual([]);
  });
});

it('a wrong row, then the model: drawn beside the build in the same commit, off the palette, recorded on the next try', () => {
  const h = mountWorkspace({ primitiveId: 'pattern-builder', evalMode: 'create', data: lesson([make('c1', 'ABB')]) as never });
  expect(levers(h).map(l => [l.id, l.pulled])).toEqual([[MODEL_LEVER, false], [AB_LEVER, false]]);
  expect(q(h, '[data-lever]')).toHaveLength(0);
  tap(h, ['red', 'blue', 'red', 'blue', 'red', 'blue']);
  h.press("I'm done!");
  expect(last(h)).toMatchObject({ correct: false, miss: 'other_shape' });
  expect(observerLever(h.state(), true)).toBe(MODEL_LEVER);
  const receipt = h.dispatch('pull_lever', { lever: MODEL_LEVER });
  expect(receipt.status).toBe('committed');
  expect(q(h, '[data-lever="shape-model"]')).toHaveLength(1);
  expect(q(h, '[data-lever="shape-model"]')[0].textContent).toBe('Like this:🍎🐟🐟🍎🐟🐟');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/apple, fish, fish, apple, fish, fish/);
  expect(JSON.stringify(receipt.state.task!.demand.onScreen)).not.toMatch(/red|blue|yellow/);
  expect(h.dispatch('pull_lever', { lever: MODEL_LEVER }).status).toBe('blocked');
  h.dispatch('retry');
  h.settle(2000);
  h.press('Start over');
  tap(h, ['yellow', 'red', 'red', 'yellow', 'red', 'red']);
  h.press("I'm done!");
  expect(last(h)).toMatchObject({ itemId: 'c1', correct: true, assisted: true, levers: [MODEL_LEVER] });
  h.close();
});

it('the A B practice row is ungraded and keeps its row on Try again; the full item comes back blank and is credited', () => {
  const h = mountWorkspace({ primitiveId: 'pattern-builder', evalMode: 'create', data: lesson([make('c1', 'ABB')]) as never });
  tap(h, ['red', 'blue', 'red', 'blue', 'red', 'blue']);
  h.press("I'm done!");
  h.dispatch('pull_lever', { lever: MODEL_LEVER });
  h.dispatch('pull_lever', { lever: AB_LEVER });
  expect(h.state().task).toMatchObject({ itemId: 'c1~simpler' });
  expect(h.state().task!.demand).toMatchObject({ askedShape: 'A B', tokensInRow: 0 });
  expect(q(h, '[data-asked-shape]')[0].getAttribute('aria-label')).toBe('Shape A B');
  expect(q(h, '[data-lever="shape-model"]')).toHaveLength(0);
  expect(levers(h)).toEqual([]);
  tap(h, ['red', 'blue', 'red']);
  h.press("I'm done!");
  expect(last(h)).toMatchObject({ itemId: 'c1~simpler', correct: false, miss: 'too_short' });
  h.dispatch('retry');
  expect(q(h, '[data-created-token]')).toHaveLength(3);
  tap(h, ['blue']);
  h.press("I'm done!");
  expect(last(h)).toMatchObject({ itemId: 'c1~simpler', correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'c1' });
  expect(q(h, '[data-created-token]')).toHaveLength(0);
  expect(q(h, '[data-lever="shape-model"]')).toHaveLength(1);
  tap(h, ['blue', 'yellow', 'yellow', 'blue', 'yellow', 'yellow']);
  h.press("I'm done!");
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['c1', false, false], ['c1~simpler', false, true], ['c1~simpler', true, true], ['c1', true, false]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: [MODEL_LEVER, AB_LEVER] });
  h.close();
});

it('easy starts with the model shown, and that is not a pull', () => {
  const h = mountWorkspace({ primitiveId: 'pattern-builder', evalMode: 'create', data: lesson([make('c1', 'AAB', 'easy')]) as never });
  expect(levers(h).find(l => l.id === MODEL_LEVER)!.pulled).toBe(true);
  expect(q(h, '[data-lever="shape-model"]')[0].textContent).toBe('Like this:🍎🍎🐟🍎🍎🐟');
  tap(h, ['red', 'red', 'blue', 'red', 'red', 'blue']);
  h.press("I'm done!");
  expect(last(h)).toMatchObject({ correct: true });
  expect(last(h)!.levers).toBeUndefined();
  h.close();
});

// ── extend, find_rule, identify_core, translate ───────────────────────────────

const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
const base = { answer: [] as string[], hint: '', narration: '', instruction: 'Do the pattern.' };
const row = (shape: string, tokens: string[], times: number) =>
  Array.from({ length: times }, () => shape.split('').map(l => tokens[l.charCodeAt(0) - 65])).flat();
const repeating = (id: string, type: 'extend' | 'identify_core', shape: string, tokens: string[], times = 2, blanks = 2,
  palette = COLORS.slice(0, 4), supportTier?: 'easy' | 'medium' | 'hard'): PatternBuilderChallenge => {
  const given = row(shape, tokens, times), key = repeatKey(given, blanks)!;
  return { ...base, id, type, supportTier, sequence: { given, hidden: type === 'extend' ? key.hidden : key.core, core: key.core },
    availableTokens: palette };
};
const numbers = (id: string, given: number[], hidden: number[], palette: number[]): PatternBuilderChallenge => ({
  ...base, id, type: 'find_rule', sequence: { given: given.map(String), hidden: hidden.map(String), core: [] },
  availableTokens: palette.map(String) });
const translating = (id: string, shape: string, from: string[], to: string[], times = 2): PatternBuilderChallenge => ({
  ...base, id, type: 'translate', sequence: { given: row(shape, from, times), hidden: [], core: from },
  translationMapping: Object.fromEntries(from.map((f, i) => [f, to[i]])), availableTokens: to });
const dataOf = (challenges: PatternBuilderChallenge[]) => lesson(challenges, COLORS);
const SHAPES = ['AB', 'AAB', 'ABB', 'ABC', 'AABB'];

/** The view that answers an item right. */
function rightView(data: PatternBuilderData, c: PatternBuilderChallenge): PatternBuilderView {
  const seq = c.sequence!;
  const coreAt = seq.given.findIndex((_, i) => seq.core.every((t, k) => seq.given[i + k] === t));
  return { extension: seq.hidden, created: [], translated: translationOf(data, c) ?? [],
    coreIndices: seq.core.map((_, k) => coreAt + k) };
}

/** Random items of every mode, with a seeded generator so a failure repeats. */
function randomItems(seed: number): PatternBuilderData {
  let s = seed;
  const rnd = (n: number) => { s = (s * 1103515245 + 12345) % 2147483648; return s % n; };
  const pick = <T,>(xs: readonly T[]) => xs[rnd(xs.length)];
  const tokens = [...COLORS].sort(() => rnd(3) - 1).slice(0, 3);
  const shape = pick(SHAPES), times = 2 + rnd(2), blanks = 1 + rnd(3);
  const start = 1 + rnd(10), step = 1 + rnd(6), ratio = 2 + rnd(2);
  const add = Array.from({ length: 3 + rnd(3) }, (_, i) => start + i * step);
  const mult = Array.from({ length: 3 }, (_, i) => start * ratio ** i);
  const nums = rnd(2) ? add : mult;
  const next = rnd(2) === 0 || nums === mult ? [nums.at(-1)! * (nums === mult ? ratio : 1) + (nums === mult ? 0 : step)] : [nums.at(-1)! + step, nums.at(-1)! + 2 * step];
  return dataOf([
    repeating('e', 'extend', shape, tokens, times, blanks, COLORS.slice(0, 5)),
    repeating('i', 'identify_core', shape, tokens, times, 2, COLORS.slice(0, 5)),
    numbers('f', nums, next, [...next, next[0] + 1, next[0] - 1]),
    translating('t', shape, tokens, ['circle', 'square', 'star'], times),
  ]);
}

describe('help pictures: each leak rule', () => {
  it('repeat_groups: on the shown row only, never on identify_core', () => {
    const data = dataOf([repeating('e', 'extend', 'AAB', ['red', 'blue']), repeating('i', 'identify_core', 'AAB', ['red', 'blue'])]);
    expect(repeatGroups(data, data.challenges[0])).toBe(3);
    expect(repeatGroups(data, data.challenges[1])).toBeNull();
    expect(patternBuilderLevers(data.challenges[1], data, []).map(l => l.id)).not.toContain(GROUPS_LEVER);
  });
  it('number_line: over 200 random rows, the line holds the shown numbers only and ends at them', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const data = randomItems(seed), c = data.challenges[2];
      const line = numberLine(data, c)!;
      expect(line).not.toBeNull();
      expect(lineLeaks(line, data, c)).toBe(false);
      for (const h of c.sequence!.hidden) if (!c.sequence!.given.includes(h)) expect(line.points).not.toContain(Number(h));
    }
  });
  it('core_model: over 200 random rows, a different shape from the item\'s part, in pictures not on the palette or row', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const data = randomItems(seed), c = data.challenges[1];
      const model = coreModel(data, c)!;
      expect(model.shape).not.toBe(shapeOf(c.sequence!.core));
      expect(coreModelLeaks(model, data, c)).toBe(false);
      expect(model.glyphs).toHaveLength(3 * model.shape.length);
    }
  });
  it('place_marker: its fact names places, never a token', () => {
    const data = dataOf([translating('t', 'AAB', ['green', 'yellow'], ['triangle', 'star'])]);
    for (let placed = 0; placed <= 7; placed++) {
      expect(markerFact(data, data.challenges[0], placed)).not.toMatch(/green|yellow|triangle|star/);
    }
  });
});

describe('simpler rows: the builders', () => {
  it('over 200 random lessons: same mode, a new id, solvable, never the item\'s row or answer, and only on items not already plainest', () => {
    let built = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const data = randomItems(seed);
      for (const c of data.challenges) {
        const p = practiceItem(c, data);
        if (!p) continue;
        built++;
        expect(p).toMatchObject({ id: `${c.id}~simpler`, type: c.type });
        expect(practiceLeaks(p, c, data)).toBe(false);
        expect(patternBuilderMatches(data, p, rightView(data, p))).toBe(true);
        // Every token the answer needs is on the practice palette.
        const need = c.type === 'translate' ? translationOf(data, p)! : c.type === 'identify_core' ? [] : p.sequence!.hidden;
        for (const t of need) expect(paletteFor(data, p)).toContain(t);
        expect(practiceParent(p.id, data.challenges)).toBe(c);
        expect(p.sequence!.given.length).toBeLessThanOrEqual(c.sequence!.given.length + 2);
      }
    }
    expect(built).toBeGreaterThan(300);
  });
  it.each([
    ['extend A B, one blank', repeating('e', 'extend', 'AB', ['red', 'blue'], 3, 1)],
    ['identify_core A B', repeating('i', 'identify_core', 'AB', ['red', 'blue'], 3)],
    ['find_rule adding 2', numbers('f', [2, 4, 6, 8], [10, 12], [10, 11, 12])],
    ['translate A B, four long', translating('t', 'AB', ['red', 'blue'], ['circle', 'square'])],
  ])('no simpler row on an item already the plainest: %s', (_, c) => {
    const data = dataOf([c]);
    expect(practiceItem(c, data)).toBeNull();
    expect(patternBuilderLevers(c, data, []).map(l => l.kind)).toEqual(['help']);
  });
  it('the simpler rows by mode: A B in other tokens, a skip-count step, B A with two key entries', () => {
    const e = repeating('e', 'extend', 'AAB', ['red', 'blue']), i = repeating('i', 'identify_core', 'ABC', ['red', 'blue', 'green']);
    const f = numbers('f', [4, 8], [12, 16], [12, 14, 16]), t = translating('t', 'AAB', ['green', 'yellow'], ['triangle', 'star']);
    const data = dataOf([e, i, f, t]);
    expect(practiceItem(e, data)!.sequence).toEqual({ given: ['green', 'yellow', 'green', 'yellow', 'green', 'yellow'],
      hidden: ['green', 'yellow'], core: ['green', 'yellow'] });
    expect(shapeOf(practiceItem(i, data)!.sequence!.core)).toBe('AB');
    expect(practiceItem(f, data)!.sequence).toMatchObject({ given: ['2', '4', '6', '8'], hidden: ['10'] });
    expect(practiceItem(t, data)).toMatchObject({ sequence: { given: ['yellow', 'green', 'yellow', 'green'] },
      translationMapping: { green: 'triangle', yellow: 'star' } });
  });
  it('a simpler row never repeats another item of the lesson', () => {
    const e = repeating('e', 'extend', 'AAB', ['red', 'blue']);
    const taken = repeating('e2', 'extend', 'AB', ['green', 'yellow'], 3);
    const data = dataOf([e, taken]);
    expect(practiceItem(e, data)!.sequence!.given).not.toEqual(taken.sequence!.given);
  });
});

describe('which lever comes next', () => {
  const e = repeating('e', 'extend', 'AAB', ['red', 'blue']), i = repeating('i', 'identify_core', 'AAB', ['red', 'blue']);
  const f = numbers('f', [4, 8], [12, 16], [12, 14, 16]), t = translating('t', 'AAB', ['green', 'yellow'], ['triangle', 'star']);
  const data = dataOf([e, i, f, t]);
  it.each([
    [e, 'repeated_last', [], GROUPS_LEVER], [e, 'one_wrong', [], GROUPS_LEVER], [e, 'repeated_last', [GROUPS_LEVER], SIMPLER_LEVER],
    [e, 'one_wrong', [GROUPS_LEVER], SIMPLER_LEVER],
    [f, 'several_wrong', [], LINE_LEVER], [f, 'started_over', [LINE_LEVER], SIMPLER_LEVER],
    [i, 'too_long', [], CORE_MODEL_LEVER], [i, 'two_repeats', [CORE_MODEL_LEVER], SIMPLER_LEVER], [i, 'too_short', [CORE_MODEL_LEVER], SIMPLER_LEVER],
    [t, 'blanks_left', [], MARKER_LEVER], [t, 'extra_tokens', [], MARKER_LEVER], [t, 'two_swapped', [MARKER_LEVER], SIMPLER_LEVER],
  ] as const)('%#: %s after %s with %j pulled -> %s', (c, miss, pulled, want) => {
    expect(nextLever(patternBuilderLevers(c, data, pulled as unknown as string[]), miss)).toBe(want);
  });
  it('easy starts each help shown, and the simpler row released', () => {
    for (const c of [e, i, f, t]) {
      expect(patternBuilderLevers({ ...c, supportTier: 'easy' }, data, []).map(l => [l.kind, l.pulled]))
        .toEqual([['help', true], ['simplify', false]]);
    }
  });
});

/** Perform the journey's inputs for the item on screen (a practice row is rebuilt from its parent, as the journey does). */
function perform(h: WorkspaceHarness, data: PatternBuilderData, wrong: boolean) {
  const id = h.state().task!.itemId;
  const parent = practiceParent(id, data.challenges);
  const c = parent ? practiceItem(parent, data)! : data.challenges.find(x => x.id === id)!;
  for (const input of patternBuilderHarnessInputs(data, c, wrong)) {
    if (input.type === 'choose') h.press(input.label); else h.touch(input.target);
  }
}
const frozen = (h: WorkspaceHarness) => {
  const t = h.state().task!;
  return JSON.stringify({ demand: t.demand, levers: t.workspace!.levers, attempts: t.workspace!.attempts, html: h.view.container.innerHTML });
};

const MOUNTS = [
  ['extend', repeating('c1', 'extend', 'AAB', ['red', 'blue'], 2, 2, COLORS.slice(0, 4), 'hard'), GROUPS_LEVER, '[data-lever="repeat-gap"]', 1,
    /gap each time it starts over: red, red, blue \| red, red, blue/],
  ['find_rule', numbers('c1', [4, 8, 12], [16, 20], [14, 15, 16, 18, 20, 22]), LINE_LEVER, '[data-lever="number-line"] [data-hop]', 2,
    /number line beside the row from 4 to 12/],
  ['identify_core', repeating('c1', 'identify_core', 'AAB', ['red', 'blue'], 3), CORE_MODEL_LEVER, '[data-model-part]', 3,
    /its own repeating part boxed each time: \[apple, fish\] \[apple, fish\] \[apple, fish\]/],
  // After a wrong Check the learner's whole row is still there: a tick under every place.
  ['translate', translating('c1', 'AAB', ['green', 'yellow'], ['triangle', 'star']), MARKER_LEVER, '[data-place="done"]', 6,
    /A tick under every place of the original row \(6 tokens made for 6 places\)/],
] as const;

describe.each(MOUNTS)('%s, mounted', (mode, item, help, drawn, count, fact) => {
  it('a wrong answer, then help: the picture and its fact in one commit; a refused pull changes nothing; the next try records it', () => {
    const data = dataOf([item]);
    const h = mountWorkspace({ primitiveId: 'pattern-builder', evalMode: mode, data: data as never });
    expect(levers(h).map(l => [l.id, l.kind, l.pulled])).toEqual([[help, 'help', false], [SIMPLER_LEVER, 'simplify', false]]);
    expect(q(h, '[data-lever]')).toHaveLength(0);
    perform(h, data, true);
    expect(last(h)).toMatchObject({ itemId: 'c1', correct: false });
    expect(last(h)!.miss).toBeTruthy();
    const receipt = h.dispatch('pull_lever', { lever: help });
    expect(receipt.status).toBe('committed');
    expect(q(h, drawn)).toHaveLength(count);
    expect(String(receipt.state.task!.demand.onScreen)).toMatch(fact);
    const before = frozen(h);
    expect(h.dispatch('pull_lever', { lever: help }).status).toBe('blocked');
    expect(frozen(h)).toBe(before);
    h.dispatch('retry');
    perform(h, data, false);
    expect(last(h)).toMatchObject({ itemId: 'c1', correct: true, assisted: true, levers: [help] });
    h.close();
  });

  it('the simpler row: ungraded, its own id, the full item back blank after it and credited', () => {
    const data = dataOf([item]);
    const h = mountWorkspace({ primitiveId: 'pattern-builder', evalMode: mode, data: data as never });
    perform(h, data, true);
    h.dispatch('pull_lever', { lever: help });
    const receipt = h.dispatch('pull_lever', { lever: SIMPLER_LEVER });
    expect(receipt.status).toBe('committed');
    expect(h.state().task).toMatchObject({ itemId: 'c1~simpler' });
    expect(h.state().task!.demand.practice).toBeTruthy();
    expect(q(h, '[data-practice]')).toHaveLength(1);
    expect(q(h, '[data-lever]')).toHaveLength(0);
    expect(levers(h)).toEqual([]);
    expect(String(h.state().task!.demand.pattern)).not.toBe(String(item.sequence!.given.join(', ')));
    perform(h, data, true);
    expect(last(h)).toMatchObject({ itemId: 'c1~simpler', correct: false });
    h.dispatch('retry');
    perform(h, data, false);
    expect(last(h)).toMatchObject({ itemId: 'c1~simpler', correct: true });
    h.dispatch('advance');
    expect(h.state().task).toMatchObject({ itemId: 'c1' });
    expect(q(h, '[data-practice]')).toHaveLength(0);
    expect(q(h, `[data-lever]`).length).toBeGreaterThan(0);
    // Blank: no blank filled, nothing selected, nothing built.
    expect(Array.from(q(h, '[data-pip-object^="slot-"]')).every(el => el.textContent === '?')).toBe(true);
    expect(q(h, '[data-pip-object^="seq-"].ring-orange-400')).toHaveLength(0);
    expect(q(h, '[data-pip-object="build"] div')).toHaveLength(0);
    perform(h, data, false);
    const attempts = h.state().task!.workspace!.attempts;
    expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
      ['c1', false, false], ['c1~simpler', false, true], ['c1~simpler', true, true], ['c1', true, false]]);
    expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: [help, SIMPLER_LEVER] });
    h.close();
  });
});

it('translate: the marker follows the learner\'s own row', () => {
  const item = translating('c1', 'AAB', ['green', 'yellow'], ['triangle', 'star']);
  const h = mountWorkspace({ primitiveId: 'pattern-builder', evalMode: 'translate', data: dataOf([item]) as never });
  h.dispatch('pull_lever', { lever: MARKER_LEVER });
  h.touch('token-0'); h.touch('token-0');
  expect(q(h, '[data-place="done"]')).toHaveLength(2);
  expect(Array.from(q(h, '[data-place]')).findIndex(el => el.getAttribute('data-place') === 'next')).toBe(2);
  expect(String(h.state().task!.demand.onScreen)).toMatch(/place 3 of 6/);
  h.close();
});

it('extend on a hard tier: the gaps lift the tier\'s "do not point where it starts over"', () => {
  const item = repeating('c1', 'extend', 'AAB', ['red', 'blue'], 2, 2, COLORS.slice(0, 4), 'hard');
  const h = mountWorkspace({ primitiveId: 'pattern-builder', evalMode: 'extend', data: dataOf([item]) as never });
  expect(String(h.state().task!.demand.coaching)).toMatch(/Do not name the rule or point out/);
  h.dispatch('pull_lever', { lever: GROUPS_LEVER });
  expect(String(h.state().task!.demand.coaching)).toMatch(/you may point to them. Never say a blank/);
  h.close();
});
