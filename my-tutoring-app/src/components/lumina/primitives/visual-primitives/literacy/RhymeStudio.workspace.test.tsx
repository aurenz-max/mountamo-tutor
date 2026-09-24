// @vitest-environment jsdom
/**
 * Rhyme studio on the teaching workspace: what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const data = (...challenges: unknown[]) => ({ title: 'Rhyme Time', gradeLevel: '1', challenges }) as unknown as Record<string, unknown>;
const REC = { id: 'rec', mode: 'recognition', targetWord: 'cat', targetWordImage: '', rhymeFamily: '-at', comparisonWord: 'dog', doesRhyme: false };
const IDF = { id: 'idf', mode: 'identification', targetWord: 'sun', targetWordImage: '', rhymeFamily: '-un',
  options: [{ word: 'bun', image: '', isCorrect: true }, { word: 'sock', image: '', isCorrect: false }] };
const PRO = { id: 'pro', mode: 'production', targetWord: 'bed', targetWordImage: '', rhymeFamily: '-ed' };
const COL = { id: 'col', mode: 'collection', targetWord: 'hat', targetWordImage: '', rhymeFamily: '-at' };
const BY_MODE: Record<string, { challenge: unknown; key: RegExp }> = {
  recognition: { challenge: REC, key: /^No: cat and dog do not rhyme/ },
  identification: { challenge: IDF, key: /^bun, the choice/ },
  production: { challenge: PRO, key: /^Any real word that rhymes with bed/ },
  collection: { challenge: COL, key: /^A real word that rhymes with hat/ },
};

it.each(Object.keys(BY_MODE))('%s binds: one spoken answer judged against the key; the ask never names the ending', mode => {
  const d = data(BY_MODE[mode].challenge);
  expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'rhyme-studio', pin: mode, objectiveIds: ['o'], data: d })).not.toBeNull();
  const h = mountWorkspace({ primitiveId: 'rhyme-studio', evalMode: mode, data: d });
  expect(h.state().task!.workspace!.expectedAnswer).toMatch(BY_MODE[mode].key);
  expect(h.state().task!.task).not.toMatch(/-(at|un|ed)\b/);
});

it('identification marks the rhyming choice only after credit; a miss reopens with nothing marked', () => {
  const h = mountWorkspace({ primitiveId: 'rhyme-studio', evalMode: 'identification', data: data(IDF) });
  const ringed = () => h.view.container.querySelectorAll('.ring-emerald-400\\/40').length;
  h.say('sock'); h.feedback('incorrect', 'retry');
  expect(ringed()).toBe(0);
  h.say('bun'); h.feedback('correct');
  expect(ringed()).toBe(1);
});

it('collection fills each spot with the credited word, tells the next slot what is taken, and completes once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mountWorkspace({ primitiveId: 'rhyme-studio', evalMode: 'collection', data: data(COL) });
  expect(screen.getByLabelText('Empty rhyme spot 1')).toBeTruthy();
  h.say('I said mat'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(screen.getByLabelText('Rhyme 1: mat')).toBeTruthy();
  expect(h.state().task!.workspace!.expectedAnswer).toContain('not one already collected (mat)');
  expect(h.state().task!.demand?.collected).toBe('mat');
  h.say('bat'); h.feedback('correct', 'advance'); h.confirmVisible();
  h.say('sat'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ challengeMode: 'collection', challengesCorrect: 3, challengesTotal: 3 });
});

it('a tapped card asks for the question silently, as the host, never which words rhyme', () => {
  mountWorkspace({ primitiveId: 'rhyme-studio', evalMode: 'identification', data: data(IDF) });
  fireEvent.click(screen.getByRole('button'));
  const [text, options] = seam.send.mock.calls.at(-1)!;
  expect(text).toContain('Which word on the screen rhymes with sun?');
  expect(text).not.toMatch(/\bbun\b/);
  expect(options).toMatchObject({ silent: true, author: 'host' });
});

it('the adapter refuses a recognition item with no verdict and an identification item with no rhyming choice', () => {
  const adapter = LIVE_ADAPTERS['rhyme-studio'];
  expect(() => adapter.validate(data({ ...REC, doesRhyme: undefined }))).toThrow();
  expect(() => adapter.validate(data({ ...IDF, options: [{ word: 'sock', image: '', isCorrect: false }, { word: 'map', image: '', isCorrect: false }] }))).toThrow();
  expect(adapter.validate(data(REC, IDF, PRO, COL))).toBeTruthy();
});
