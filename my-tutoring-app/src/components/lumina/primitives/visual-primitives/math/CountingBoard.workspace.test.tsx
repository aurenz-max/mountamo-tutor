// @vitest-environment jsdom
/**
 * counting-board on its boss (spoken preset; the hand, the handover and the build checked by the board), mounted the
 * way a lesson mounts it: what is its own. The generic W1 contract (runtime/workspaceContract.test.tsx), boss.test.ts
 * and the Pip contract cover ownership, the packet and the wiring; the levers have CountingBoard.levers.workspace.test.tsx
 * and the runtime CountingBoard.runtime.test.tsx (help, demonstration, the K flash, completion).
 *
 * Moved here from the scripted-path suites when the scripted controller was deleted (di, reader-fit item 13,
 * counting-out, capture): no self-advance button and no "/ total" tally; pre-reader chrome hidden at K; the number-free
 * hand picker; tap-to-count at K and visible objects at Grade 1; the counting-out family's board mechanics; compare's
 * drawn order (CNB-2); one submission whose eval mode is the catalog's (CNB-3).
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { getComponentById } from '../../../service/manifest/catalog';
import CountingBoard, { type CountingBoardChallenge, type CountingBoardData } from './CountingBoard';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); seam.evaluationContext = null; });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });

const ch = (id: string, type: CountingBoardChallenge['type'], count: number, extra: Partial<CountingBoardChallenge> = {}): CountingBoardChallenge =>
  ({ id, type, instruction: 'Can you count all the bears?', targetAnswer: count, count, arrangement: 'line', hint: '', narration: '', ...extra });
const board = (gradeBand: 'K' | '1', challenges: CountingBoardChallenge[], extra: Partial<CountingBoardData> = {}): CountingBoardData =>
  ({ title: 'Counting Time', description: 'Count the bears on the board.', objects: { type: 'bears' }, gradeBand, challenges, ...extra });
const mount = (mode: string, data: CountingBoardData) =>
  mountWorkspace({ primitiveId: 'counting-board', evalMode: mode, data: data as unknown as Record<string, unknown>, instanceId: 'board' });

const q = (h: WorkspaceHarness, selector: string) => h.view.container.querySelectorAll(selector);
const objects = (h: WorkspaceHarness) => q(h, 'svg text[font-size="24"]');
const tappable = (h: WorkspaceHarness) => q(h, 'g.cursor-pointer');
const countBadges = (h: WorkspaceHarness) => q(h, 'circle[fill="#eab308"]');
const faint = (h: WorkspaceHarness) => Array.from(objects(h)).filter(el => (el as SVGTextElement).style.opacity === '0.25');
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';

/** One hand-built board per catalog mode: the payloads do not cover every mode. */
const BY_MODE: Record<string, CountingBoardChallenge> = {
  subitize_perceptual: ch('m', 'subitize_perceptual', 2, { arrangement: 'scattered' }),
  count: ch('m', 'count_all', 5),
  give_me_n: ch('m', 'give_me_n', 8, { targetAnswer: 3 }),
  build_n: ch('m', 'build_n', 4),
  recount_moved: ch('m', 'recount_moved', 5),
  subitize: ch('m', 'subitize', 4),
  group: ch('m', 'group_count', 6, { arrangement: 'groups', groupSize: 2 }),
  add_more: ch('m', 'add_more', 4, { targetAnswer: 6, changeBy: 2 }),
  take_away: ch('m', 'take_away', 6, { targetAnswer: 4, changeBy: 2 }),
  count_on: ch('m', 'count_on', 8, { startFrom: 5 }),
  compare: ch('m', 'compare', 7, { targetAnswer: 4, arrangement: 'groups', compareGroups: [3, 4] }),
};
const BOARD_CHECKED = ['subitize_perceptual', 'give_me_n', 'build_n'];

describe('every catalog mode', () => {
  it('has a board here', () => {
    expect(Object.keys(BY_MODE).sort()).toEqual((getComponentById('counting-board')!.evalModes ?? []).map(m => m.evalMode).sort());
  });

  it.each(Object.keys(BY_MODE).flatMap(mode => (['K', '1'] as const).map(band => [mode, band] as const)))(
    '%s at %s: a spoken key is published only on a spoken item; no self-advance button and no "/ total" tally', (mode, band) => {
      const h = mount(mode, board(band, [BY_MODE[mode]]));
      const ws = h.state().task!.workspace!;
      if (BOARD_CHECKED.includes(mode)) expect(ws.expectedAnswer, 'the board checks it; the key never reaches the tutor').toBeUndefined();
      else expect(ws.expectedAnswer).toMatch(/^"(two|three|four|five|six|eight)"\. Counting aloud and ending on/);
      for (const label of [/check answer/i, /next challenge/i, /try again/i, /show spelling|skip/i]) expect(text(h)).not.toMatch(label);
      expect(Array.from(q(h, 'button')).map(b => b.textContent?.trim())).not.toContain('+');
      expect(text(h)).not.toMatch(/\/\s*\d/);
      // No reward before an affirmation.
      expect(text(h)).not.toMatch(/that hand matches!|bears!/i);
      h.close();
    });
});

describe('pre-reader chrome and the number-free hand match', () => {
  it('K hides the counter, badges, description, instruction and the reader hint', () => {
    const h = mount('count', board('K', [BY_MODE.count]));
    for (const hidden of ['Grade 1', 'Count All', 'Count the bears on the board.', 'Can you count all the bears?', 'Tap each object as you count'])
      expect(text(h)).not.toContain(hidden);
    h.close();
  });

  it('Grade 1 keeps the reader chrome', () => {
    const h = mount('count', board('1', [BY_MODE.count]));
    for (const shown of ['Grade 1', 'Can you count all the bears?', 'Tap each object as you count']) expect(text(h)).toContain(shown);
    h.close();
  });

  it('the Pre-K hand picker has three hands and no numerals', () => {
    const h = mount('subitize_perceptual', board('K', [BY_MODE.subitize_perceptual]));
    const hands = Array.from(q(h, 'button[aria-label="Pick this hand"]'));
    expect(hands).toHaveLength(3);
    for (const hand of hands) expect(hand.textContent ?? '').not.toMatch(/\d/);
    expect(text(h)).toContain('Which hand shows how many you saw?');
    // The objects are not tap-countable: matching is perception.
    expect(tappable(h)).toHaveLength(0);
    h.touch('hand-3');
    expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'one_over' });
    h.close();
  });
});

describe('reader-fit item 13: tap-counting where it is the task, never on a quick look', () => {
  it('K count_all: the objects stay visible and a tap counts one', () => {
    const h = mount('count', board('K', [BY_MODE.count, ch('c2', 'count_all', 4)]));
    expect(objects(h)).toHaveLength(5);
    h.touch('object-0');
    expect(countBadges(h)).toHaveLength(1);
    expect(h.state().task!.demand.markedOnBoard).toBe(1);
    h.close();
  });

  it('K subitize: nothing to count before the look; the objects are never tappable', () => {
    const h = mount('subitize', board('K', [BY_MODE.subitize]));
    expect(objects(h)).toHaveLength(0);
    h.dispatch('present');
    expect(objects(h)).toHaveLength(4);
    expect(tappable(h)).toHaveLength(0);
    h.settle(5000);
    expect(objects(h)).toHaveLength(0);
    h.close();
  });

  it('Grade-1 subitize keeps its objects visible, and they are not tap-countable', () => {
    const h = mount('subitize', board('1', [BY_MODE.subitize]));
    expect(objects(h)).toHaveLength(4);
    expect(tappable(h)).toHaveLength(0);
    h.close();
  });
});

describe('the K counting-out family on the board', () => {
  it('give_me_n: a tap hands one over and a second puts it back; the handover is the commit, only after something is taken', () => {
    const h = mount('give_me_n', board('K', [BY_MODE.give_me_n, ch('g2', 'give_me_n', 7, { targetAnswer: 2 })],
      { showOptions: { showLastNumber: true } }));
    const give = () => Array.from(q(h, 'button')).find(b => /give them to me/i.test(b.textContent ?? '')) as HTMLButtonElement;
    expect(objects(h)).toHaveLength(8);
    expect(give().disabled).toBe(true);
    h.touch('object-0'); h.touch('object-1');
    expect(countBadges(h)).toHaveLength(2);
    h.touch('object-0');
    expect(countBadges(h)).toHaveLength(1);
    expect(give().disabled).toBe(false);
    expect(h.state().task!.workspace!.attempts).toHaveLength(0);
    h.press('Give them to me');
    expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'short_by_more' });
    h.close();
  });

  it('take_away: the first changeBy taps take objects off and count nothing; the next one counts', () => {
    const h = mount('take_away', board('K', [BY_MODE.take_away, ch('t2', 'take_away', 5, { targetAnswer: 3, changeBy: 2 })]));
    expect(objects(h)).toHaveLength(6);
    h.touch('object-0'); h.touch('object-1');
    expect([objects(h).length, countBadges(h).length, h.state().task!.demand.takenOff]).toEqual([4, 0, 2]);
    h.touch('object-2');
    expect([objects(h).length, countBadges(h).length]).toEqual([4, 1]);
    h.close();
  });

  it('add_more: the extras are drawn faint from the start and a tap puts one on without counting it', () => {
    const h = mount('add_more', board('K', [BY_MODE.add_more, ch('a2', 'add_more', 3, { targetAnswer: 5, changeBy: 2 })]));
    expect([objects(h).length, faint(h).length]).toEqual([6, 2]);
    h.touch('object-4');
    expect([faint(h).length, countBadges(h).length, h.state().task!.demand.putOn]).toEqual([1, 0, 1]);
    h.close();
  });

  it('recount_moved: counting the last object moves the set, clears the count trace and freezes the board', () => {
    const h = mount('recount_moved', board('K', [ch('m1', 'recount_moved', 4), ch('m2', 'recount_moved', 5)]));
    expect(tappable(h)).toHaveLength(4);
    for (const i of [0, 1, 2]) h.touch(`object-${i}`);
    expect(countBadges(h)).toHaveLength(3);
    h.touch('object-3');
    expect([countBadges(h).length, tappable(h).length, objects(h).length, h.state().task!.demand.moved]).toEqual([0, 0, 4, 'yes']);
    expect(text(h)).toMatch(/they moved/i);
    h.close();
  });

  it('count_on: K covers the started group under a basket; Grade 1 keeps it visible', () => {
    const k = mount('count_on', board('K', [BY_MODE.count_on]));
    expect(objects(k)).toHaveLength(3);
    expect(text(k)).toContain('🧺');
    expect(k.state().task!.workspace!.objects).toHaveLength(3);
    k.close(); cleanup();
    const g1 = mount('count_on', board('1', [BY_MODE.count_on]));
    expect(objects(g1)).toHaveLength(8);
    expect(text(g1)).not.toContain('🧺');
    g1.close();
  });
});

describe('compare draws its two groups in board order, so the larger group can be on the right (CNB-2)', () => {
  const drawn = (compareGroups?: number[]) => {
    const compare = ch('m1', 'compare', 10, { arrangement: 'groups', groupSize: 7, targetAnswer: 7, ...(compareGroups ? { compareGroups } : {}) });
    const h = mount('compare', board('1', [compare], { showOptions: { showGroupCircles: true } }));
    const xs = Array.from(q(h, '[data-pip-object^="object-"] > text')).map(t => Number(t.getAttribute('x')));
    const rings = Array.from(q(h, '[data-group-ring]')).map(r => Number(r.getAttribute('cx')));
    h.close(); cleanup();
    return { xs, rings };
  };

  it('draws each order, and a board saved before compareGroups draws the larger group first', () => {
    const right = drawn([3, 7]);
    expect([right.xs.length, right.rings.length]).toEqual([10, 2]);
    expect(Math.max(...right.xs.slice(0, 3))).toBeLessThan(Math.min(...right.xs.slice(3)));
    expect(right.rings[0]).toBeLessThan(right.rings[1]);
    expect(Math.abs(right.rings[0] - right.xs.slice(0, 3).reduce((s, x) => s + x, 0) / 3)).toBeLessThan(1);
    const left = drawn([7, 3]);
    expect(Math.max(...left.xs.slice(0, 7))).toBeLessThan(Math.min(...left.xs.slice(7)));
    expect(drawn().xs).toEqual(left.xs);
  });
});

describe('the submission', () => {
  it.each([
    ['count', [ch('a1', 'count_all', 3), ch('a2', 'count_all', 5)], ['three', 'five'], 'count'],
    ['group', [ch('g1', 'group_count', 6, { arrangement: 'groups', groupSize: 2 }), ch('g2', 'group_count', 12, { arrangement: 'groups', groupSize: 4 })],
      ['six', 'twelve'], 'group'],
  ] as const)('%s: one submission, whose eval mode is the catalog mode, not the challenge type (CNB-3); a wrong first answer is kept', async (mode, challenges, answers, evalMode) => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mount(mode, board('1', [...challenges]));
    h.say('one'); h.feedback('incorrect', 'retry');
    h.say(answers[0]); h.feedback('correct');
    h.dispatch('advance'); h.confirmVisible();
    h.say(answers[1]); h.feedback('correct');
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
    const [success, , metrics, studentWork, , diagnosisEvidence] = seam.submit.mock.calls[0];
    expect([success, metrics.evalMode, metrics.type]).toEqual([true, evalMode, 'counting-board']);
    expect(diagnosisEvidence.firstResponseScore).toBe(50);
    expect(studentWork.teachingAttempts.map((a: { correct: boolean }) => a.correct)).toEqual([false, true, true]);
    h.close();
  });
});

it('with no tutor, the board shows the shared "needs the tutor" card instead of a scripted drill', () => {
  const view = render(<CountingBoard data={board('K', [BY_MODE.count])} />);
  expect(view.container.querySelector('[data-pip-object^="object-"]')).toBeNull();
  expect(view.container.textContent).toMatch(/tutor/i);
});
