// @vitest-environment jsdom
/**
 * picture-vocabulary `pair_build` (open build) on the real teaching workspace, with a real generation as the payload,
 * through the shared pair surface (`RhymePairSurface.tsx`) and the picture-pair rules. The Live context, evaluation
 * writes and sound are substituted; the pair check is the real code.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { getComponentById } from '../../../service/manifest/catalog';
import { validatePictureVocabularyData } from '../../../components/live-activity/adapters/pictureVocabularyLive';
import { pictureVocabularyOracle } from '../../../service/qa/oracles/picture-vocabulary';
import payload from '../../../components/live-activity/runtime/testing/w1-payloads/picture-vocabulary.pair_build.json';
import {
  PAIR_PICTURES, askablePicturePairItem, clashes, makePicturePairItems, pairAdjacent, pairPictureOf, passingPairs,
  picturePairItemsFrom, picturePairLevers, picturePairMiss, picturePairModelFor, picturePairSmallBoard, relationsFor,
  type PicturePairItem,
} from './picturePairBuild';
import { RHYME_PAIR_RULES, pairMiss } from './rhymePairBuild';

const data = (payload as unknown as { data: Record<string, unknown> & { pairItems: PicturePairItem[] } }).data;
const items = picturePairItemsFrom(data.pairItems);
beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const pairsOf = (n: number) => passingPairs(items[n].board, items[n].relation).map(p => p.split('+'));
const decoyOf = (n: number) => {
  const { board, relation } = items[n];
  const want = relation === 'opposite' ? 'alike' : 'same_kind';
  for (const a of board) for (const c of board) if (a < c && picturePairMiss([a, c], [], relation) === want) return [a, c];
  throw new Error('no decoy');
};

describe('pair_build rules (pure)', () => {
  it('opposites are the same kind at other poles; alike is the same pole; goes together is a listed partner', () => {
    expect(picturePairMiss(['hot', 'cold'], [], 'opposite')).toBeUndefined();
    expect(picturePairMiss(['hot', 'freezing'], [], 'opposite')).toBeUndefined();
    expect(picturePairMiss(['happy', 'laughing'], [], 'opposite')).toBe('alike');
    expect(picturePairMiss(['happy', 'up'], [], 'opposite')).toBe('not_opposite');
    expect(picturePairMiss(['sock', 'shoe'], [], 'goes_with')).toBeUndefined();
    expect(picturePairMiss(['sock', 'hat'], [], 'goes_with')).toBe('same_kind');
    expect(picturePairMiss(['sock', 'key'], [], 'goes_with')).toBe('no_link');
    expect(picturePairMiss(['shoe', 'sock'], ['shoe+sock'], 'goes_with')).toBe('same_pair');
    // The rhyme rules the shared surface defaults to are unchanged.
    expect(RHYME_PAIR_RULES.miss(['cat', 'car'], [], { id: 'r', board: [], ways: 1 })).toBe(pairMiss(['cat', 'car']));
  });

  it('the table: unique words and pictures, partners point back, every opposite kind has both poles', () => {
    expect(new Set(PAIR_PICTURES.map(p => p.word)).size).toBe(PAIR_PICTURES.length);
    expect(new Set(PAIR_PICTURES.map(p => p.emoji)).size).toBe(PAIR_PICTURES.length);
    for (const p of PAIR_PICTURES) if (p.partner) expect(pairPictureOf(p.partner)?.partner, p.word).toBe(p.word);
    const kinds = new Set(PAIR_PICTURES.filter(p => p.relation === 'opposite').map(p => p.kind));
    for (const k of Array.from(kinds)) expect(new Set(PAIR_PICTURES.filter(p => p.kind === k && p.relation === 'opposite').map(p => p.pole)).size, k).toBe(2);
  });

  it('code-owned boards: 3+ right pairs, a decoy, nothing that clashes, no right pair side by side; no pair repeats in a session', () => {
    for (let n = 0; n < 25; n++) {
      const session = makePicturePairItems(4);
      expect(session.map(i => i.relation)).toEqual(['opposite', 'goes_with', 'opposite', 'goes_with']);
      const right = session.flatMap(i => passingPairs(i.board, i.relation));
      expect(new Set(right).size).toBe(right.length);
      for (const item of session) {
        expect(item.board).toHaveLength(8);
        expect(passingPairs(item.board, item.relation).length).toBeGreaterThanOrEqual(3);
        expect(askablePicturePairItem({ ...item, ways: 2 })).not.toBeNull();
        expect(pairAdjacent(item.board, item.relation)).toBe(false);
        expect(picturePairSmallBoard(item), item.board.join()).not.toBeNull();
        expect(picturePairModelFor(item), item.board.join()).not.toBeNull();
        const pics = item.board.map(w => pairPictureOf(w)!);
        expect(pics.some((p, i) => pics.slice(i + 1).some(q => clashes(p, q)))).toBe(false);
        expect(pictureVocabularyOracle.verify({ task: 'pair_build', pairItems: [item] }, {} as never).violations).toEqual([]);
      }
    }
    expect(relationsFor('Opposites like hot and cold', 3)).toEqual(['opposite', 'opposite', 'opposite']);
    expect(relationsFor('Things that go together', 2)).toEqual(['goes_with', 'goes_with']);
  });

  it('a board with a right pair side by side, or with no decoy, is refused', () => {
    expect(askablePicturePairItem({ id: 'x', relation: 'opposite', ways: 1,
      board: ['hot', 'cold', 'up', 'big', 'down', 'small', 'tiny', 'happy'] })).toBeNull();
    expect(askablePicturePairItem({ id: 'x', relation: 'opposite', ways: 1,
      board: ['happy', 'big', 'up', 'laughing', 'down', 'sad', 'small', 'tiny'] })).not.toBeNull();
    expect(askablePicturePairItem({ id: 'x', relation: 'opposite', ways: 1,
      board: ['happy', 'big', 'up', 'night', 'down', 'sad', 'small', 'day'] })).toBeNull();
  });

  it('the small board has one right pair apart; the model is a right pair off the board; every miss but same_pair is answered', () => {
    for (const item of items) {
      const small = picturePairSmallBoard(item)!;
      expect(passingPairs(small.board, small.relation)).toHaveLength(1);
      expect(pairAdjacent(small.board, small.relation)).toBe(false);
      const model = picturePairModelFor(item)!;
      expect(item.board).not.toContain(model[0].word);
      expect(item.board).not.toContain(model[1].word);
      expect(picturePairMiss([model[0].word, model[1].word], [], item.relation)).toBeUndefined();
    }
    const tw = getComponentById('picture-vocabulary')!.teachingWorkspace!;
    const answered = new Set(items.flatMap(i => picturePairLevers(i, []).flatMap(l => l.answers ?? [])));
    for (const m of tw.misses!.pair_build) if (m !== 'same_pair') expect(answered.has(m), m).toBe(true);
    expect(tw.unanswered!.pair_build).toEqual(['same_pair']);
    expect(picturePairLevers(items[0], []).every(l => !l.pulled)).toBe(true);
    expect(() => validatePictureVocabularyData(data)).not.toThrow();
    expect(pictureVocabularyOracle.verify(data, {} as never).violations).toEqual([]);
  });
});

function mount() {
  const h = mountWorkspace({ primitiveId: 'picture-vocabulary', evalMode: 'pair_build', data, instanceId: 'pp' });
  const pick = (...words: string[]) => words.forEach(w => h.press(`picture ${w}`));
  const takeBack = (...words: string[]) => words.forEach(w => h.press(`take back ${w}`));
  const demand = () => h.state().task!.demand as Record<string, unknown>;
  const last = () => h.state().task!.workspace!.attempts.at(-1);
  const later = () => act(() => { vi.advanceTimersByTime(2000); });
  const next = () => { h.dispatch('advance'); h.confirmVisible(); };
  return { ...h, pick, takeBack, demand, last, later, next };
}

describe('pair_build on the workspace', () => {
  it('binds a gesture task with no key and no print; the tray starts empty and the levers bare', () => {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'picture-vocabulary', pin: 'pair_build', objectiveIds: ['o'], data })).not.toBeNull();
    const h = mount();
    expect(h.state().task!.task).toMatch(/^Find two pictures that are opposites/);
    expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
    for (const w of items[0].board) expect(screen.queryByText(w)).toBeNull();
    expect(screen.getByRole('button', { name: "I'm done!" })).toHaveProperty('disabled', true);
    expect(h.demand()).toMatchObject({ picturesInTray: 0, tray: 'empty' });
    expect((h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.kind, l.pulled])).toEqual([
      ['say_names', 'help', false], ['model_pair', 'help', false], ['small_board', 'simplify', false]]);
  });

  it('the decoy is the named alike miss; Try again keeps the tray; the history shows the fix; a right pair passes', () => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mount();
    h.later();
    const [a, c] = decoyOf(0);
    h.pick(a, c);
    expect(h.demand()).toMatchObject({ picturesInTray: 2 });
    h.press("I'm done!");
    expect(h.last()).toMatchObject({ correct: false, miss: 'alike' });
    expect(screen.getByText(/Those two are alike/)).toBeTruthy();
    h.dispatch('retry'); h.confirmVisible();
    expect(screen.getByRole('button', { name: `take back ${a}` })).toBeTruthy();
    h.later();
    h.takeBack(a, c);
    expect(h.demand()).toMatchObject({ picturesInTray: 0, workHistory: expect.stringContaining('picturesInTray 0 → 2 → 0') });
    const [p, q] = pairsOf(0)[0];
    h.pick(p, q); h.press("I'm done!");
    expect(h.last()).toMatchObject({ itemId: items[0].id, correct: true });
  });

  it('a two-pair goes-together board keeps the first pair, refuses it again, names a same-kind pair, and opens empty', () => {
    const h = mount();
    const [p, q] = pairsOf(0)[0];
    h.pick(p, q); h.press("I'm done!"); h.next();
    expect(h.state().task!.task).toMatch(/^Find two pictures that go together.*Then find a different pair/);
    expect(h.demand()).toMatchObject({ picturesInTray: 0, waysAsked: 2, waysMade: 0 });
    const [[a, b], [c, d]] = pairsOf(1);
    h.pick(a, b); h.press("I'm done!");
    expect(h.state().task!.evidence.correctness).not.toBe('correct');
    expect(screen.getByTestId('rp-made')).toBeTruthy();
    h.pick(b, a); h.press("I'm done!");
    expect(h.last()).toMatchObject({ correct: false, miss: 'same_pair' });
    h.dispatch('retry'); h.confirmVisible();
    h.takeBack(b, a);
    const [x, y] = decoyOf(1);
    h.pick(x, y); h.press("I'm done!");
    expect(h.last()).toMatchObject({ correct: false, miss: 'same_kind' });
    expect(screen.getByText(/same kind of thing/)).toBeTruthy();
    h.dispatch('retry'); h.confirmVisible();
    h.takeBack(x, y);
    h.pick(c, d); h.press("I'm done!");
    expect(h.last()).toMatchObject({ itemId: items[1].id, correct: true });
  });

  it('the simplify lever opens a four-picture practice board; a speaker asks the tutor for that name only', () => {
    const h = mount();
    h.press(`say ${items[0].board[0]}`);
    expect(seam.send).toHaveBeenCalledWith(expect.stringContaining(`"${items[0].board[0]}"`), expect.objectContaining({ silent: true }));
    h.later();
    h.pick(...decoyOf(0)); h.press("I'm done!");
    expect(h.dispatch('pull_lever', { lever: 'small_board' } as never).status).toBe('committed');
    expect(screen.getByText('Practice board')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^picture / })).toHaveLength(4);
  });
});
