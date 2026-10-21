// @vitest-environment jsdom
/**
 * Within-mode SUPPORT TIER verification for poetry-lab, mounted the way a lesson mounts it (the teaching workspace is
 * the only path). The tier is display withdrawal only; the poem, the choices, the template and the check are the same:
 *   L1 figurative count            easy/no tier "(N to find)" → medium and hard: none (the phrase_count lever shows it)
 *   L2 rhyme-scheme preview        easy colored letters → medium letters without color → hard none
 *   L3 composition syllable chips  easy judged N/M + placeholder targets → medium neutral count → hard none
 * Keep-trues: the prompt panel and the acrostic letters at every tier. rhyme_hunt is a TIER NO-OP: the K-1 band
 * contract wins, so a stray tier changes nothing. (The scripted path's running "Found" count and its review phase went
 * with that path: on the workspace every item is checked on its own.)
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../../components/live-activity/runtime/testing/workspaceHarness';
import type { PoetryLabData, RhymeHuntRound } from '../PoetryLab';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

type Tier = PoetryLabData['supportTier'];

const POEM_LINES = ['The sun smiled down at me', 'The day was bright and free', 'A gentle wind did blow', 'It made the flowers grow'];
const analysisData = (tier: Tier, only: 'figurative' | 'rhyme'): PoetryLabData => ({
  title: 'Poem Study', gradeLevel: '3', mode: 'analysis', ...(tier ? { supportTier: tier } : {}),
  poem: POEM_LINES.join('\n'), poemLines: POEM_LINES, moodOptions: [],
  figurativeInstances: only === 'figurative' ? [{ text: 'sun smiled', startIndex: 4, endIndex: 14, type: 'personification' }] : [],
  ...(only === 'rhyme' ? { rhymeScheme: 'AABB', rhymeSchemeOptions: ['AABB', 'ABAB', 'ABCB'] } : {}),
});
const haikuData = (tier: Tier): PoetryLabData => ({
  title: 'Write a Haiku', gradeLevel: '3', mode: 'composition', ...(tier ? { supportTier: tier } : {}), templateType: 'haiku',
  compositionPrompt: 'Write a haiku about the forest', templateConstraints: { lineCount: 3, syllablesPerLine: [5, 7, 5] },
});
const acrosticData = (tier: Tier): PoetryLabData => ({
  title: 'Acrostic Time', gradeLevel: '4', mode: 'composition', ...(tier ? { supportTier: tier } : {}), templateType: 'acrostic',
  compositionPrompt: 'Write an acrostic poem about your pet', templateConstraints: { lineCount: 3, acrosticWord: 'CAT' },
});
const rounds: RhymeHuntRound[] = [
  { id: 'r1', type: 'rhyme_hunt', poemLines: ['Moon is bright', 'Cat has a hat', 'Stars glow at night', 'Hello little cat'],
    candidates: [{ word: 'bright', emoji: '☀️' }, { word: 'hat', emoji: '🎩' }, { word: 'night', emoji: '🌙' }, { word: 'cat', emoji: '🐱' }],
    rhymeWordA: 'hat', rhymeWordB: 'cat' },
];

const mount = (mode: string, data: PoetryLabData) =>
  mountWorkspace({ primitiveId: 'poetry-lab', evalMode: mode, instanceId: 'poetry', data: data as never });
const FULL: Tier[] = [undefined, 'easy'];

describe('L1: figurative count', () => {
  it.each(FULL)('%s shows "(N to find)" and tells the tutor', tier => {
    const h = mount('analysis', analysisData(tier, 'figurative'));
    expect(h.view.container.textContent).toContain('(1 to find)');
    expect(h.state().task!.demand.toFind).toBeTruthy();
    h.close();
  });

  it.each(['medium', 'hard'] as Tier[])('%s hides the count, and offers phrase_count instead', tier => {
    const h = mount('analysis', analysisData(tier, 'figurative'));
    expect(h.view.container.textContent).not.toContain('to find');
    expect(h.state().task!.demand.toFind).toBeUndefined();
    expect(h.state().task!.workspace!.levers!.map(l => l.id)).toContain('phrase_count');
    h.close();
  });
});

describe('L2: rhyme-scheme preview', () => {
  const chips = (h: ReturnType<typeof mount>) => Array.from(h.view.container.querySelectorAll('span.rounded-full'))
    .filter(el => /^[A-D]$/.test(el.textContent ?? ''));

  it.each(FULL)('%s paints the colored letters on a pick', tier => {
    const h = mount('analysis', analysisData(tier, 'rhyme'));
    h.press('AABB');
    expect(chips(h).map(c => c.textContent)).toEqual(['A', 'A', 'B', 'B']);
    expect(chips(h)[0].className).toContain('text-blue-300');
    h.close();
  });

  it('medium keeps the letters without color', () => {
    const h = mount('analysis', analysisData('medium', 'rhyme'));
    h.press('AABB');
    expect(chips(h)).toHaveLength(4);
    for (const c of chips(h)) expect(c.className).toContain('text-slate-300');
    h.close();
  });

  it('hard shows no preview, and every choice stays', () => {
    const h = mount('analysis', analysisData('hard', 'rhyme'));
    h.press('AABB');
    expect(chips(h)).toHaveLength(0);
    for (const s of ['ABAB', 'ABCB']) expect(h.view.getByRole('button', { name: s })).toBeTruthy();
    h.close();
  });
});

describe('L3: composition syllable chips', () => {
  it.each(FULL)('%s shows judged N/M chips and placeholder targets', tier => {
    const h = mount('composition', haikuData(tier));
    expect(h.view.getByPlaceholderText('Line 1 (5 syllables)...')).toBeTruthy();
    expect(h.view.getAllByText('0/5')).toHaveLength(2);
    expect(h.view.getAllByText('0/5')[0].className).toContain('text-rose-300');
    h.close();
  });

  it('medium shows a neutral live count only', () => {
    const h = mount('composition', haikuData('medium'));
    expect(h.view.queryByText('0/5')).toBeNull();
    act(() => { fireEvent.change(h.view.getByPlaceholderText('Line 1...'), { target: { value: 'hello world' } }); });
    expect(h.view.getByText('3').className).toContain('text-slate-300');
    h.close();
  });

  it('hard shows no chips; the prompt panel and the acrostic letters stay', () => {
    const h = mount('composition', haikuData('hard'));
    expect(h.view.queryByText('0')).toBeNull();
    expect(h.view.getByText('Syllables per line: 5-7-5')).toBeTruthy();
    expect(h.view.getByText('Write a haiku about the forest')).toBeTruthy();
    h.close();
    const a = mount('composition', acrosticData('hard'));
    for (const letter of ['C', 'A', 'T', 'CAT']) expect(a.view.getByText(letter)).toBeTruthy();
    a.close();
  });
});

describe('rhyme_hunt is a tier no-op', () => {
  it('a stray hard tier renders the same markup, scene and levers as none: four pictured cards and the poem', () => {
    const plain = mount('rhyme_hunt', { title: 'Rhyme Hunt', gradeLevel: 'K', mode: 'rhyme_hunt', rounds });
    const html = plain.view.container.innerHTML, task = JSON.stringify(plain.state().task!.demand);
    const levers = plain.state().task!.workspace!.levers;
    plain.close(); cleanup();
    const tiered = mount('rhyme_hunt', { title: 'Rhyme Hunt', gradeLevel: 'K', mode: 'rhyme_hunt', rounds, supportTier: 'hard' });
    expect(tiered.view.container.innerHTML).toBe(html);
    expect(JSON.stringify(tiered.state().task!.demand)).toBe(task);
    expect(tiered.state().task!.workspace!.levers).toEqual(levers);
    for (const w of ['bright', 'hat', 'night', 'cat']) expect(tiered.view.getByRole('button', { name: w })).toBeTruthy();
    expect(tiered.view.getByText('Moon is bright')).toBeTruthy();
    expect(tiered.view.queryByText(/Grade K/)).toBeNull();
    tiered.close();
  });
});
