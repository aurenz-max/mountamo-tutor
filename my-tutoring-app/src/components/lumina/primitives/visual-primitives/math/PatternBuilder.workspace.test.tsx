// @vitest-environment jsdom
/**
 * Pattern builder on the teaching workspace: what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { getComponentById } from '../../../service/manifest/catalog';
import type { PatternBuilderChallenge, PatternBuilderData } from './PatternBuilder';
import { patternBuilderHarnessInputs, repeatsAPart } from './patternBuilderWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });

const base = { hint: 'Look for what repeats.', narration: '', answer: [] as string[] };
const extend: PatternBuilderChallenge = { ...base, id: 'e1', type: 'extend', instruction: 'What comes next?',
  sequence: { given: ['red', 'blue', 'red', 'blue'], hidden: ['red', 'blue'], core: ['red', 'blue'] },
  availableTokens: ['red', 'blue', 'green'] };
const identify: PatternBuilderChallenge = { ...base, id: 'i1', type: 'identify_core', instruction: 'Find the part that repeats.',
  sequence: { given: ['star', 'star', 'heart', 'star', 'star', 'heart'], hidden: [], core: ['star', 'star', 'heart'] } };
const translate: PatternBuilderChallenge = { ...base, id: 't1', type: 'translate', instruction: 'Make it with shapes.',
  sequence: { given: ['red', 'blue', 'red', 'blue'], hidden: [], core: ['red', 'blue'] },
  translationMapping: { red: 'circle', blue: 'square' } };
const create: PatternBuilderChallenge = { ...base, id: 'c1', type: 'create', instruction: 'Make your own pattern.',
  availableTokens: ['yellow', 'purple', 'orange'] };
const findRule: PatternBuilderChallenge = { ...base, id: 'f1', type: 'find_rule', instruction: 'Find the rule and keep going.',
  sequence: { given: ['2', '4', '6', '8'], hidden: ['10', '12'], core: ['2', '4'] },
  availableTokens: ['9', '10', '11', '12', '14'] };
const copy: PatternBuilderChallenge = { ...base, id: 'k1', type: 'copy', instruction: 'Make the same pattern.',
  sequence: { given: ['green', 'yellow', 'green', 'yellow'], hidden: [], core: ['green', 'yellow'] },
  availableTokens: ['yellow', 'red', 'green'] };
// The gap holds 'blue' (index 3, between two reds); its neighbours are the other token.
const fillGap: PatternBuilderChallenge = { ...base, id: 'g1', type: 'fill_gap', instruction: 'Which token goes in the gap?',
  sequence: { given: ['red', 'blue', 'red', 'blue', 'red', 'blue'], hidden: ['blue'], core: ['red', 'blue'] }, gapIndex: 3,
  availableTokens: ['blue', 'green', 'red'] };
const BY_MODE: Record<string, PatternBuilderChallenge> = { extend, identify_core: identify, translate, create, find_rule: findRule,
  copy, fill_gap: fillGap };

const builder = (challenges: PatternBuilderChallenge[]): PatternBuilderData => ({
  title: 'Patterns', patternType: 'repeating', gradeBand: 'K-1',
  sequence: { given: ['red', 'blue', 'red', 'blue'], hidden: ['red', 'blue'], core: ['red', 'blue'], rule: null },
  tokens: { available: ['red', 'blue', 'green'], type: 'colors' },
  challenges,
});

type Mounted = ReturnType<typeof mountWorkspace>;
/** The journey's own inputs, performed through the builder's controls. */
function perform(h: Mounted, data: PatternBuilderData, c: PatternBuilderChallenge, wrong: boolean) {
  for (const input of patternBuilderHarnessInputs(data, c, wrong)) {
    if (input.type === 'choose') h.press(input.label);
    else h.touch(input.target);
  }
}
/** Tokens the learner has placed or selected: filled blanks, the build row, selected row tokens. */
const work = (h: Mounted) => {
  const c = h.view.container;
  const filled = Array.from(c.querySelectorAll('[data-pip-object^="slot-"]')).filter(el => el.textContent !== '?').length;
  const built = c.querySelector('[data-pip-object="build"]')?.querySelectorAll('div').length ?? 0;
  const selected = c.querySelectorAll('[data-pip-object^="seq-"].ring-orange-400').length;
  return filled + built + selected;
};
const check = (h: Mounted) => Array.from(h.view.container.querySelectorAll('button')).find(b => b.textContent === 'Check Answer')!;

it('every catalog mode binds', () => {
  const modes = (getComponentById('pattern-builder')?.evalModes ?? []).map(m => m.evalMode);
  expect(modes.sort()).toEqual(Object.keys(BY_MODE).sort());
  for (const mode of modes) {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'pattern-builder', pin: mode, objectiveIds: ['o'],
      data: builder([BY_MODE[mode]]) }), mode).not.toBeNull();
  }
});

it.each(Object.entries(BY_MODE))('%s: a checked gesture that publishes no key; a wrong Check reopens clean on Try again, the right one completes once',
  async (mode, c) => {
    seam.evaluationContext = { lesson: 'test' };
    const data = builder([c]);
    const h = mountWorkspace({ primitiveId: 'pattern-builder', evalMode: mode, data: data as never });
    const task = h.state().task!;
    // fill_gap's one token may also be said (its key reaches the judge); every other mode is a gesture with no key.
    if (c.type === 'fill_gap') {
      expect(task.demand.response).toBe('speech');
      expect(task.workspace!.expectedAnswer).toMatch(/blue/);
    } else {
      expect(task.workspace!.expectedAnswer).toBeUndefined();
      expect(task.demand.response).toBe('gesture');
    }
    const published = JSON.stringify(task);
    for (const key of ['"hidden"', '"answer"', '"core"', 'narration']) expect(published).not.toContain(key);
    if (c.type === 'extend') expect(published).toContain('red, blue, red, blue, ?, ?');
    if (c.type === 'find_rule') { expect(published).not.toContain('10, 12'); expect(published).toContain('2, 4, 6, 8, ?, ?'); }
    if (c.type === 'translate') { expect(published).not.toContain('circle, square, circle'); expect(published).toContain('red → circle'); }
    // The gap's token is never drawn or told: the row reaches the tutor with "?" in its place.
    if (c.type === 'fill_gap') {
      expect(published).toContain('red, blue, red, ?, red, blue');
      expect(published).not.toContain('red, blue, red, blue, red, blue');
      const cells = Array.from(h.view.container.querySelectorAll('[data-pip-object="pattern"] > div')).map(el => el.textContent);
      expect(cells[3]).toBe('?');
    }
    if (c.type === 'copy') expect(published).toContain('green, yellow, green, yellow');
    // The row is drawn; the part that repeats is never a fact of its own.
    if (c.type === 'identify_core') expect(Object.values(task.demand)).not.toContain('star, star, heart');

    perform(h, data, c, true);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(work(h)).toBeGreaterThan(0);
    // Input is closed until Try again: no second Check on the same miss.
    expect(check(h).disabled).toBe(true);
    h.dispatch('retry');
    // Try again clears the rejected work.
    expect(work(h)).toBe(0);
    expect(check(h).disabled).toBe(false);

    perform(h, data, c, false);
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
  });

it('a created pattern counts when one starting part repeats through at least four tokens', () => {
  expect(repeatsAPart(['a', 'b', 'a', 'b'])).toBe(true);
  expect(repeatsAPart(['a', 'a', 'b', 'a', 'a', 'b'])).toBe(true);
  expect(repeatsAPart(['a', 'b', 'a'])).toBe(false);
  expect(repeatsAPart(['a', 'b', 'b', 'a'])).toBe(false);
});

it('the tutor is told what is drawn: the row with its blanks, the choices, the key, the tier', () => {
  const tiered = { ...extend, supportTier: 'hard' as const };
  const h = mountWorkspace({ primitiveId: 'pattern-builder', evalMode: 'extend', data: builder([tiered]) as never });
  expect(h.state().task!.demand).toMatchObject({ pattern: 'red, blue, red, blue, ?, ?', choices: 'red | blue | green',
    supportTier: 'hard' });
  expect(String(h.state().task!.demand.coaching)).toMatch(/Do not name the rule/);
  cleanup();
  const t = mountWorkspace({ primitiveId: 'pattern-builder', evalMode: 'translate', data: builder([translate]) as never });
  expect(t.state().task!.demand).toMatchObject({ pattern: 'red, blue, red, blue', key: 'red → circle, blue → square',
    choices: 'circle | square' });
});

it('the adapter refuses a challenge its tokens cannot answer', () => {
  expect(() => LIVE_ADAPTERS['pattern-builder'].validate(builder([{ ...extend, availableTokens: ['red', 'green'] }]))).toThrow();
  expect(() => LIVE_ADAPTERS['pattern-builder'].validate(builder([{ ...findRule, availableTokens: ['9', '10', '11'] }]))).toThrow();
  expect(() => LIVE_ADAPTERS['pattern-builder'].validate(builder([{ ...translate, translationMapping: undefined }]))).toThrow();
  expect(() => LIVE_ADAPTERS['pattern-builder'].validate(builder([{ ...identify,
    sequence: { given: ['star', 'heart'], hidden: [], core: ['moon'] } }]))).toThrow();
  expect(() => LIVE_ADAPTERS['pattern-builder'].validate(builder([{ ...create, availableTokens: ['red'] }]))).toThrow();
  // A gap at the end is extend, and a gap whose token is not on the palette cannot be filled.
  expect(() => LIVE_ADAPTERS['pattern-builder'].validate(builder([{ ...fillGap, gapIndex: 5 }]))).toThrow();
  expect(() => LIVE_ADAPTERS['pattern-builder'].validate(builder([{ ...fillGap, availableTokens: ['red', 'green'] }]))).toThrow();
  expect(() => LIVE_ADAPTERS['pattern-builder'].validate(builder([{ ...copy, availableTokens: ['green', 'red'] }]))).toThrow();
});

it('fill_gap said aloud: a wrong token retries, the right one is credited once and shown in the gap', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mountWorkspace({ primitiveId: 'pattern-builder', evalMode: 'fill_gap', data: builder([fillGap]) as never });
  h.say('red'); h.feedback('incorrect', 'retry');
  expect(h.state().status).not.toBe('completed');
  h.say('blue'); h.feedback('correct', 'advance');
  expect(h.view.container.querySelector('[data-pip-object="slot-0"]')!.textContent).not.toBe('?');
  h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
});
