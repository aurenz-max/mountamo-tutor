// @vitest-environment jsdom
/**
 * The di-word-problem-setup levers (DI family 10 of `/add-support-tiers`) on the shared teaching workspace. This pack
 * owns its lever state (it is not on DiTeachingStage): story links underline a tapped card's sentence; the read-along
 * highlight moves across the family; dots fill the bar model; a small-number story is practised first, ungraded, its
 * earlier steps drawn as given; the easy model card is not a pull.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { WORD_PROBLEM_BENCH_THEME } from '../../../service/qa/di/wordProblemBench';
import type { DiWordProblemSetupData } from './DiWordProblemSetup';
import type { WordProblemChallengeType, WordProblemSupportTier } from './diWordProblemScript';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

// Jen has 12. Tom has 8 more than Jen. How many does Tom have? → Tom's (the box) is the big number; the answer is 20.
const pack = (challengeType: WordProblemChallengeType, supportTier?: WordProblemSupportTier): DiWordProblemSetupData => ({
  title: 'Set Up the Story', description: 'Find the big number and say the family.', challengeType, gradeLevel: 'Grade 2',
  problems: [{ id: 'p1', frameId: 'comparison:more_person', theme: WORD_PROBLEM_BENCH_THEME, first: 12, second: 8, challengeType,
    ...(supportTier ? { supportTier } : {}) }] });
const mount = (data: DiWordProblemSetupData) =>
  mountWorkspace({ primitiveId: 'di-word-problem-setup', evalMode: data.challengeType, data: data as unknown as Record<string, unknown> });
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => l.id);
const place = (label: string, zone: HTMLElement) => {
  fireEvent.click(screen.getByRole('button', { name: `Select ${label}` }));
  fireEvent.click(zone);
};
const settle = () => act(() => { vi.advanceTimersByTime(2000); });
const buildFamily = (h: WorkspaceHarness) => {
  const smalls = screen.getAllByLabelText('small amount drop zone');
  place("Jen's stickers", smalls[0]); place('how many more', smalls[1]); place("Tom's stickers", screen.getByLabelText('big amount drop zone'));
  settle(); h.dispatch('advance'); h.confirmVisible();
};

it('easy starts with two different stories solved, one add and one subtract; a placement under it records no lever', () => {
  const h = mount(pack('build_family', 'easy'));
  expect(q(h, '[data-lever="model_story"] [data-model-story]').map(e => e.getAttribute('data-model-story')).sort()).toEqual(['add', 'subtract']);
  expect(q(h, '[data-lever="model_story"]')[0].textContent).not.toMatch(/\b(12|8|20)\b/);
  buildFamily(h);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true });
  expect(h.state().task!.workspace!.attempts.at(-1)!.levers ?? []).toEqual([]);
  h.close();
});

it('story_links: tapping a card underlines the sentence it comes from, and only that one', () => {
  const h = mount(pack('build_family'));
  expect(levers(h)).toEqual(['model_story', 'story_links']);
  h.dispatch('pull_lever', { lever: 'story_links' });
  fireEvent.click(screen.getByRole('button', { name: "Select Jen's stickers" }));
  const linked = q(h, '[data-story-sentence][data-linked="true"]');
  expect(linked).toHaveLength(1);
  expect(linked[0].textContent).toContain('12');
  h.close();
});

it('read_along moves across the built family; count_dots fills the known parts; within_ten is ungraded practice', () => {
  const h = mount(pack('build_family'));
  buildFamily(h);
  expect(h.state().task!.demand).toMatchObject({ kind: 'family' });
  h.dispatch('pull_lever', { lever: 'read_along' });
  const along = () => q(h, '[data-lever="read_along"]')[0].getAttribute('data-read-along-at');
  expect(along()).toBe('0');
  act(() => { vi.advanceTimersByTime(950); });
  expect(along()).toBe('1');
  h.say('twelve plus eight equals box'); h.feedback('correct', 'advance'); h.confirmVisible();
  h.say('add'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.demand).toMatchObject({ kind: 'solve' });
  const full = h.state().task!.itemId;
  h.say('nineteen'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'count_dots' });
  expect(q(h, '[data-count-dot]')).toHaveLength(20);
  expect(q(h, '[data-lever="count_dots"]')[0].textContent).toBe('');
  h.dispatch('pull_lever', { lever: 'within_ten' });
  expect(h.state().task!.itemId.startsWith(`${full}~simpler`)).toBe(true);
  // The small story's earlier steps are drawn as given: its family is on screen.
  expect(q(h, '[data-word-problem-credited="operation"]')).toHaveLength(1);
  h.say('ten'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe(full);
  h.say('twenty'); h.feedback('correct');
  const attempts = h.state().task!.workspace!.attempts.filter(a => a.itemId.startsWith(full));
  expect(attempts.map(a => [a.itemId === full, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    [true, false, false], [false, true, true], [true, true, false]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: ['count_dots', 'within_ten'] });
  h.close();
});
