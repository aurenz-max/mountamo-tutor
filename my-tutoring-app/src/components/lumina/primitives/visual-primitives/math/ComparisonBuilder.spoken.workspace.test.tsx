// @vitest-environment jsdom
/**
 * Comparison builder answered aloud (ROLLOUT.md VB-1): a comparison or a single one-more / one-less is a spoken item
 * that still takes the tap. The observer credits a spoken answer from the tutor's feedback; the tap stays checked.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { getComponentById } from '../../../service/manifest/catalog';
import type { ComparisonBuilderChallenge } from './ComparisonBuilder';
import { comparisonSpokenMisses } from './comparisonBuilderWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });

const base = { instruction: 'Look closely and answer.' };
/** One spoken challenge per converted mode, with a wrong and a right spoken answer. */
const SPOKEN: Array<[string, ComparisonBuilderChallenge, string, string]> = [
  ['compare_groups', { ...base, id: 'g1', type: 'compare-groups', leftGroup: { count: 3, objectType: 'apples' },
    rightGroup: { count: 5, objectType: 'stars' }, correctAnswer: 'less' }, 'the same', 'fewer'],
  ['compare_numbers', { ...base, id: 'n1', type: 'compare-numbers', leftNumber: 8, rightNumber: 5, correctSymbol: '>' },
    'less than', 'eight is bigger'],
  ['one_more_less', { ...base, id: 's1', type: 'one-more-one-less', targetNumber: 6, askFor: 'one-less' }, 'six', 'five'],
];

const session = (challenges: ComparisonBuilderChallenge[]) => ({ title: 'Comparing', gradeBand: '1', showCorrespondenceLines: true,
  useAlligatorMnemonic: false, challenges });

it.each(SPOKEN)('%s: a wrong spoken answer retries, a right one credited by the tutor completes once', async (mode, c, wrong, right) => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mountWorkspace({ primitiveId: 'comparison-builder', evalMode: mode, data: session([c]) });
  const task = h.state().task!;
  expect(task.demand.response).toBe('speech');
  expect(task.workspace!.expectedAnswer).toBeTruthy();
  h.say(wrong); h.feedback('incorrect', 'retry');
  expect(h.state().status).not.toBe('completed');
  h.say(right); h.feedback('correct', 'advance');
  h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
});

it('a credited spoken comparison shows the choice, and the next challenge still takes the tap', () => {
  const next: ComparisonBuilderChallenge = { ...base, id: 'n2', type: 'compare-numbers', leftNumber: 2, rightNumber: 9, correctSymbol: '<' };
  const h = mountWorkspace({ primitiveId: 'comparison-builder', evalMode: 'compare_numbers', data: session([SPOKEN[1][1], next]) });
  h.say('eight is more than five'); h.feedback('correct');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'Chose: 8 > 5' });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('n2');
  h.press('<'); h.press(/check/i);
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('a tap after a spoken answer is checked by the activity and ends the pending speech', () => {
  const h = mountWorkspace({ primitiveId: 'comparison-builder', evalMode: 'compare_numbers', data: session([SPOKEN[1][1]]) });
  h.say('eight');
  expect(h.state().task!.workspace!.pendingResponse).toBeDefined();
  h.press('>'); h.press(/check/i);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(h.state().task!.workspace!.pendingResponse).toBeUndefined();
});

it('order and a one-more-and-one-less pair stay tap-only with no key', () => {
  const pair: ComparisonBuilderChallenge = { ...base, id: 'b1', type: 'one-more-one-less', targetNumber: 6, askFor: 'both' };
  const h = mountWorkspace({ primitiveId: 'comparison-builder', evalMode: 'one_more_less', data: session([pair]) });
  expect(h.state().task!.demand.response).toBe('gesture');
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
});

it('every spoken miss is one the catalog lists for its mode', () => {
  const lists = getComponentById('comparison-builder')!.teachingWorkspace!.misses as Record<string, readonly string[]>;
  const more = (askFor: 'one-more' | 'one-less', targetNumber: number): ComparisonBuilderChallenge =>
    ({ ...base, id: 'x', type: 'one-more-one-less', targetNumber, askFor });
  const cases: Array<[string, ComparisonBuilderChallenge]> = [...SPOKEN.map(([m, c]) => [m, c] as [string, ComparisonBuilderChallenge]),
    ['compare_groups', { ...SPOKEN[0][1], correctAnswer: 'equal', leftGroup: { count: 4, objectType: 'apples' }, rightGroup: { count: 4, objectType: 'stars' } }],
    ['compare_numbers', { ...SPOKEN[1][1], leftNumber: 6, rightNumber: 6, correctSymbol: '=' }],
    ['one_more_less', more('one-more', 1)], ['one_more_less', more('one-less', 1)], ['one_more_less', more('one-more', 19)]];
  for (const [mode, c] of cases) {
    const misses = comparisonSpokenMisses(c);
    expect(misses.length).toBeGreaterThan(0);
    expect(new Set(misses.map(m => m.id)).size).toBe(misses.length);
    for (const m of misses) expect(lists[mode]).toContain(m.id);
  }
});
