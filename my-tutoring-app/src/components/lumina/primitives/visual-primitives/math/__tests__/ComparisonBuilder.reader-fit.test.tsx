// @vitest-environment jsdom
/**
 * Reader-fit behavior of comparison-builder on its bound workspace (the only path since the boss, 2026-10-19).
 * At K (PRE band) the pictures, numerals and number cells ARE the tappable answer surface (tap=choose,
 * picture-primary): no "More/Fewer/The Same" text buttons, no `< > =` symbols, no Check outside order, no adult
 * chrome, and a wrong tap shakes the touched object instead of a text card. Grade 1 keeps the text buttons, the
 * Check and the chrome. The tutor reads the ask for a non-reader (the boss's ask, `comparisonAsk`); the K Read-me
 * button and the scripted DISAMBIGUATE beat went with the scripted path, and a one-more-and-one-less ask names both.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../../components/live-activity/runtime/testing/workspaceHarness';
import type { ComparisonBuilderChallenge } from '../ComparisonBuilder';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const MODE: Record<ComparisonBuilderChallenge['type'], string> = {
  'compare-groups': 'compare_groups', 'compare-numbers': 'compare_numbers', order: 'order', 'one-more-one-less': 'one_more_less' };

const groups = (id: string, leftCount: number, rightCount: number, correctAnswer: 'more' | 'less' | 'equal'): ComparisonBuilderChallenge =>
  ({ id, type: 'compare-groups', instruction: 'Which side has more?', leftGroup: { count: leftCount, objectType: 'bears' },
    rightGroup: { count: rightCount, objectType: 'bears' }, correctAnswer });
const oneMoreLess = (id: string, targetNumber: number, askFor: 'one-more' | 'one-less' | 'both'): ComparisonBuilderChallenge =>
  ({ id, type: 'one-more-one-less', instruction: `One more and one less than ${targetNumber}?`, targetNumber, askFor });
const numbers = (id: string, leftNumber: number, rightNumber: number, correctSymbol: '<' | '>' | '='): ComparisonBuilderChallenge =>
  ({ id, type: 'compare-numbers', instruction: 'Which number is bigger?', leftNumber, rightNumber, correctSymbol });
const orderCh = (id: string, nums: number[], direction: 'ascending' | 'descending'): ComparisonBuilderChallenge =>
  ({ id, type: 'order', instruction: 'Put the numbers in order.', numbers: nums, direction });

/** A bound mount at a band; the mode is the first challenge's. */
function mount(challenges: ComparisonBuilderChallenge[], gradeBand: 'K' | '1' = 'K', extra: Record<string, unknown> = {}) {
  return mountWorkspace({ primitiveId: 'comparison-builder', evalMode: MODE[challenges[0].type], instanceId: 'compare',
    data: { title: 'Reader-fit test', gradeBand, showCorrespondenceLines: true, useAlligatorMnemonic: true, challenges, ...extra } });
}
type H = ReturnType<typeof mount>;
const correctness = (h: H) => h.state().task!.evidence.correctness;
const click = (el: Element) => act(() => { fireEvent.click(el); });

// The compare-groups SVG has exactly two <rect> during solve (the group boxes, index 0 = left, 1 = right) and one
// <circle> (the middle "=") at K.
const workspaceSvg = () => document.querySelector('svg rect')?.closest('svg') ?? null;
const groupRects = () => Array.from(document.querySelectorAll('svg rect'));
const sameCircle = () => workspaceSvg()?.querySelector('circle') as SVGCircleElement;
// class attribute works for both HTML and SVG elements (SVG className is not a plain string).
const hasShake = (el: Element | null) => !!el && (el.getAttribute('class') ?? '').includes('animate-lumina-shake');

describe('ComparisonBuilder reader-fit (K band, compare-groups)', () => {
  it('K surface: no text answer buttons and no Check — pictures are the answer', () => {
    mount([groups('c1', 3, 1, 'more'), groups('c2', 1, 1, 'equal')]);
    expect(screen.queryByRole('button', { name: /^more$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^fewer$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /the same/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^check/i })).toBeNull();
    expect(groupRects().length).toBe(2);
    expect(sameCircle()).toBeTruthy();
  });

  it.each([
    ['the LEFT group when left has more', groups('c1', 3, 1, 'more'), 0],
    ['the RIGHT group when right has more', groups('c1', 2, 4, 'less'), 1],
  ] as const)('tapping %s completes the challenge', (_name, c, side) => {
    const h = mount([c, groups('c2', 2, 2, 'equal')]);
    click(groupRects()[side]);
    expect(correctness(h)).toBe('correct');
  });

  it('tapping the middle "=" when the groups are equal completes', () => {
    const h = mount([groups('c1', 3, 3, 'equal'), groups('c2', 1, 2, 'less')]);
    click(sameCircle());
    expect(correctness(h)).toBe('correct');
  });

  it('a WRONG tap is a miss with no text card, and the tapped side shakes', () => {
    const h = mount([groups('c1', 1, 4, 'less'), groups('c2', 2, 2, 'equal')]);
    click(groupRects()[0]);
    expect(correctness(h)).toBe('incorrect');
    expect(screen.queryByText(/not quite/i)).toBeNull();
    expect(hasShake(groupRects()[0])).toBe(true);
  });
});

describe('ComparisonBuilder reader-fit (K chrome band-gate)', () => {
  it('the "Left: N / Right: N" count badges, the mode tabs, the counter and the grade badge are hidden at K', () => {
    mount([groups('c1', 3, 5, 'less'), groups('c2', 2, 2, 'equal')]);
    expect(screen.queryByText(/Left:/)).toBeNull();
    expect(screen.queryByText(/Compare Groups/i)).toBeNull();
    expect(screen.queryByText(/Challenge 1 of/i)).toBeNull();
    expect(screen.queryByText(/Kindergarten/i)).toBeNull();
  });

  it('GRADE-1 control: mode tabs, counter and grade badge present; a wrong answer shows the text card', () => {
    const h = mount([groups('c1', 1, 4, 'less'), groups('c2', 2, 2, 'equal')], '1');
    expect(screen.getAllByText(/Compare Groups/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Challenge 1 of/i)).toBeTruthy();
    expect(screen.getByText(/Grade 1/i)).toBeTruthy();
    h.press(/^more$/i); h.press(/check/i);
    expect(screen.getByText(/not quite — count each group/i)).toBeTruthy();
  });
});

describe('ComparisonBuilder reader-fit (compare-numbers @ K)', () => {
  it('K surface: no < > symbol buttons, no Check — the numerals + "=" are the answer', () => {
    mount([numbers('c1', 3, 7, '<'), numbers('c2', 2, 2, '=')]);
    expect(screen.queryByRole('button', { name: '<' })).toBeNull();
    expect(screen.queryByRole('button', { name: '>' })).toBeNull();
    expect(screen.queryByRole('button', { name: /check/i })).toBeNull();
    expect(screen.getByRole('button', { name: '3' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '7' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /the same/i })).toBeTruthy();
  });

  it('tapping the BIGGER numeral completes', () => {
    const h = mount([numbers('c1', 3, 7, '<'), numbers('c2', 2, 2, '=')]);
    click(screen.getByRole('button', { name: '7' }));
    expect(correctness(h)).toBe('correct');
  });

  it('tapping the "=" when the numbers are equal completes', () => {
    const h = mount([numbers('c1', 5, 5, '='), numbers('c2', 3, 1, '>')]);
    click(screen.getByRole('button', { name: /the same/i }));
    expect(correctness(h)).toBe('correct');
  });

  it('a WRONG numeral tap is a miss and shakes that box', () => {
    const h = mount([numbers('c1', 3, 7, '<'), numbers('c2', 2, 2, '=')]);
    click(screen.getByRole('button', { name: '3' }));
    expect(correctness(h)).toBe('incorrect');
    expect(hasShake(screen.getByRole('button', { name: '3' }))).toBe(true);
  });

  it('GRADE-1 control: symbol buttons + Check are present', () => {
    mount([numbers('c1', 3, 7, '<')], '1');
    expect(screen.getByRole('button', { name: /check/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: '=' })).toBeTruthy();
  });
});

describe('ComparisonBuilder reader-fit (order direction @ K)', () => {
  it('K: the text direction badge is hidden; the scene says the bars carry the direction', () => {
    const h = mount([orderCh('c1', [3, 1, 2], 'ascending')]);
    expect(screen.queryByText(/least/i)).toBeNull();
    expect(screen.queryByText(/greatest/i)).toBeNull();
    expect(h.state().task!.demand.labels).toMatch(/short to tall/);
  });

  it('GRADE-1 control: the text direction badge is present', () => {
    mount([orderCh('c1', [3, 1, 2], 'ascending')], '1');
    expect(screen.getByText(/least/i)).toBeTruthy();
  });
});

describe('ComparisonBuilder reader-fit (one-more-one-less @ K)', () => {
  it('K caps the answer surface to a 5-cell window around the target (no 0 / no 20)', () => {
    mount([oneMoreLess('c1', 5, 'both')]);
    expect(screen.queryAllByRole('button', { name: /^one (more|less) (0|1|20)$/ })).toHaveLength(0);
    expect(screen.getAllByRole('button', { name: /^one more \d+$/ }).map(b => b.textContent)).toEqual(['3', '4', '5', '6', '7']);
    expect(screen.getByRole('button', { name: 'one more 6' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'one less 4' })).toBeTruthy();
  });

  it("'both': the ask names one more and one less alike, and the scene says what the arrows mean", () => {
    const h = mount([oneMoreLess('c1', 5, 'both')]);
    expect(h.state().task!.task).toBe('Find the number one more than 5 and the number one less than 5, and tap each one.');
    expect(h.state().task!.demand.labels).toMatch(/up arrow marks the one more row and a down arrow the one less row/);
  });

  it('single ask: tapping the correct cell completes (no Check at K)', () => {
    const h = mount([oneMoreLess('c1', 5, 'one-more'), oneMoreLess('c2', 6, 'one-more')]);
    expect(screen.queryByRole('button', { name: /check/i })).toBeNull();
    click(screen.getByRole('button', { name: '6' }));
    expect(correctness(h)).toBe('correct');
  });

  it("'both': answering one-more then one-less completes the challenge", () => {
    const h = mount([oneMoreLess('c1', 5, 'both'), oneMoreLess('c2', 5, 'both')]);
    click(screen.getByRole('button', { name: 'one more 6' }));
    click(screen.getByRole('button', { name: 'one less 4' }));
    expect(correctness(h)).toBe('correct');
  });

  it('a WRONG cell tap is a miss and shakes that cell', () => {
    const h = mount([oneMoreLess('c1', 5, 'one-more')]);
    click(screen.getByRole('button', { name: '4' }));
    expect(correctness(h)).toBe('incorrect');
    expect(hasShake(screen.getByRole('button', { name: '4' }))).toBe(true);
  });
});

// Leak fix (handoff 21, 2026-09-28): nothing on screen states the answer during the solve. Easy tier used to ship
// correspondenceMode 'live' (every match line drawn, leftovers circled) and Grade 1 printed "Left: N / Right: N"
// before the answer. The first payload below is a real K easy generation that shipped 'live'.
describe('ComparisonBuilder compare-groups: no answer on screen before the answer', () => {
  const savedEasyK = JSON.parse(readFileSync(resolve(process.cwd(),
    'qa/curriculum-coverage/math-k/evidence/COUNT001-03-A-comparison-builder-compare_groups-1.json'), 'utf-8'))
    .response.fullData;
  const svgLines = () => workspaceSvg()?.querySelectorAll('line').length ?? 0;
  const dashedRings = () => workspaceSvg()?.querySelectorAll('circle[stroke-dasharray]').length ?? 0;

  it("a saved K easy payload carrying correspondenceMode 'live' draws no lines or leftover rings during the solve", () => {
    expect(savedEasyK.correspondenceMode).toBe('live');
    const i = savedEasyK.challenges.findIndex((c: ComparisonBuilderChallenge) => c.leftGroup!.count !== c.rightGroup!.count);
    const challenges = [savedEasyK.challenges[i], ...savedEasyK.challenges.filter((_: unknown, j: number) => j !== i)];
    mountWorkspace({ primitiveId: 'comparison-builder', evalMode: 'compare_groups', instanceId: 'compare',
      data: { ...savedEasyK, challenges } });
    expect(svgLines()).toBe(0);
    expect(dashedRings()).toBe(0);
  });

  it('a correct answer reveals the lines and leftovers; a wrong one does not', () => {
    const h = mount([groups('c1', 5, 2, 'more'), groups('c2', 2, 2, 'equal')], 'K', { correspondenceMode: 'live' });
    click(groupRects()[0]);
    expect(correctness(h)).toBe('correct');
    expect(svgLines()).toBe(2);
    expect(dashedRings()).toBe(3);
    cleanup();
    mount([groups('c1', 1, 4, 'less'), groups('c2', 2, 2, 'equal')], 'K', { correspondenceMode: 'live' });
    click(groupRects()[0]);
    expect(svgLines()).toBe(0);
    expect(screen.queryByRole('button', { name: /show matching lines/i })).toBeNull();
  });

  it("hard tier ('off') never offers the lines, even after answering", () => {
    const h = mount([groups('c1', 5, 2, 'more'), groups('c2', 2, 2, 'equal')], 'K', { correspondenceMode: 'off' });
    click(groupRects()[0]);
    expect(correctness(h)).toBe('correct');
    expect(screen.queryByRole('button', { name: /show matching lines/i })).toBeNull();
  });

  it('Grade 1: the count badges appear only once the item is answered', () => {
    const h = mount([groups('c1', 3, 5, 'less'), groups('c2', 2, 2, 'equal')], '1', { showCountBadges: true });
    expect(screen.queryByText(/Left:/)).toBeNull();
    h.press(/^fewer$/i); h.press(/check/i);
    expect(correctness(h)).toBe('correct');
    expect(screen.getByText(/Left:/)).toBeTruthy();
  });
});
