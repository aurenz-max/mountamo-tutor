// @vitest-environment jsdom
/**
 * evidence-finder levers mounted the way a lesson mounts them. A pull changes the screen and the scene fact in one
 * commit and marks no sentence of the passage; the next attempt records the lever; a refused pull changes nothing; a
 * practice passage is ungraded, shares nothing with the session's, and the full item comes back blank after it.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { EvidenceFinderData } from './EvidenceFinder';
import { practiceFor } from './evidenceFinderLevers';
import type { Strength } from './evidenceFinderWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

type Sentence = EvidenceFinderData['passage']['sentences'][number];
const S = (id: string, text: string, claimIndex?: number, evidenceStrength?: Strength): Sentence =>
  claimIndex === undefined ? { id, text, isEvidence: false } : { id, text, isEvidence: true, claimIndex, evidenceStrength };
const PASSAGE: EvidenceFinderData = {
  title: 'Busy Bees', gradeLevel: '5', cerEnabled: true,
  claims: [{ id: 'c1', text: 'Bees carry pollen between flowers.', color: 'blue' }, { id: 'c2', text: 'Farms need bees.', color: 'violet' }],
  passage: { text: '', sentences: [
    S('s1', 'Bees live in hives.'),
    S('s2', 'Pollen sticks to a bee\'s fuzzy legs.', 0, 'strong'),
    S('s3', 'Apple farmers rent hives each spring.', 1, 'strong'),
    S('s4', 'Honey tastes sweet.'),
    S('s5', 'Without bees, berry harvests shrink.', 1, 'moderate'),
    S('s6', 'Bees buzz all summer.', 0, 'weak'),
  ] },
};
const TEXTS = [...PASSAGE.passage.sentences.map(s => s.text), ...PASSAGE.claims.map(c => c.text)];

const mount = () => mountWorkspace({ primitiveId: 'evidence-finder', evalMode: 'evaluate_evidence_strength', instanceId: 'evidence',
  data: PASSAGE as unknown as Record<string, unknown> });
const find = (h: WorkspaceHarness, d: EvidenceFinderData, claimFor = (s: Sentence) => s.claimIndex ?? 0) => {
  d.claims.forEach((c, i) => {
    if (d.claims.length > 1) h.press(c.text);
    d.passage.sentences.filter(s => s.isEvidence && s.evidenceStrength !== 'weak' && claimFor(s) === i).forEach(s => h.touch(`sentence-${s.id}`));
  });
  h.press('Check Evidence');
};
const LABEL: Record<Strength, string> = { strong: 'Strong', moderate: 'Moderate', weak: 'Weak' };
const rate = (h: WorkspaceHarness, d: EvidenceFinderData, as = (s: Sentence) => s.evidenceStrength!) => {
  d.passage.sentences.filter(s => s.isEvidence).forEach(s => h.press(`${LABEL[as(s)]}: ${s.text}`));
  h.press('Check Ratings');
};
const advance = (h: WorkspaceHarness) => { h.dispatch('advance'); h.confirmVisible(); };
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const named = (s: string) => TEXTS.filter(w => s.includes(w));

it('find: a short find pulls the count in one commit, marking no sentence; the next attempt records it; a repeat pull changes nothing', () => {
  const h = mount();
  expect(levers(h)).toEqual([['evidence_count', false], ['proof_example', false], ['practice_passage', false]]);
  find(h, PASSAGE, s => (s.id === 's5' ? 9 : s.claimIndex!));
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'missed_evidence' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'missed_evidence')).toBe('evidence_count');
  const receipt = h.dispatch('pull_lever', { lever: 'evidence_count' });
  expect(receipt.status).toBe('committed');
  const fact = String(receipt.state.task!.demand.onScreen);
  expect(fact).toMatch(/claim 1: 1, 1 filled; claim 2: 2, 1 filled/);
  expect(named(fact)).toEqual([]);
  expect(q(h, '[data-lever="evidence_count"]')).toHaveLength(1);
  const before = { demand: JSON.stringify(h.state().task!.demand), levers: levers(h), html: h.view.container.innerHTML };
  expect(h.dispatch('pull_lever', { lever: 'evidence_count' }).status).toBe('blocked');
  expect({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h), html: h.view.container.innerHTML }).toEqual(before);
  h.dispatch('retry');
  find(h, PASSAGE);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'find', correct: true, levers: ['evidence_count'] });
  advance(h);
  // The rate item opens bare.
  expect(q(h, '[data-lever]')).toHaveLength(0);
  expect(levers(h)).toEqual([['strength_guide', false], ['practice_ratings', false]]);
});

it('find: a sentence that is not evidence pulls the worked example, on another topic; the right find still credits', () => {
  const h = mount();
  PASSAGE.claims.forEach((c, i) => { h.press(c.text); if (i === 0) h.touch('sentence-s1'); });
  find(h, PASSAGE);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'not_evidence' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'not_evidence')).toBe('proof_example');
  expect(h.dispatch('pull_lever', { lever: 'proof_example' }).status).toBe('committed');
  const card = q(h, '[data-lever="proof_example"]')[0].textContent ?? '';
  expect(card).toMatch(/proves claim 1.*proves claim 2.*proves nothing.*an opinion/);
  expect(named(card)).toEqual([]);
  expect(named(String(h.state().task!.demand.onScreen))).toEqual([]);
  h.dispatch('retry');
  find(h, PASSAGE);
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['proof_example'] });
});

it('rate: Strong on a weak sentence pulls the strength guide; the practice ratings are ungraded and the full item comes back blank', () => {
  const h = mount();
  find(h, PASSAGE); advance(h);
  rate(h, PASSAGE, s => (s.id === 's6' ? 'strong' : s.evidenceStrength!));
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'weak_as_strong' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'weak_as_strong')).toBe('strength_guide');
  expect(h.dispatch('pull_lever', { lever: 'strength_guide' }).status).toBe('committed');
  expect(q(h, '[data-lever="strength_guide"]')[0].textContent).toMatch(/Strong means.*Moderate means.*Weak means/);
  expect(named(String(h.state().task!.demand.onScreen))).toEqual([]);
  // Simplify: two sentences on another topic, one strong and one weak.
  const receipt = h.dispatch('pull_lever', { lever: 'practice_ratings' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('rate~simpler');
  expect(receipt.state.task!.workspace!.levers ?? []).toEqual([]);
  expect(receipt.state.task!.demand).toMatchObject({ practice: expect.any(String) });
  const p = practiceFor({ id: 'rate' }, PASSAGE)!;
  expect(named(h.view.container.textContent ?? '').filter(t => !PASSAGE.claims.some(c => c.text === t))).toEqual([]);
  expect(q(h, '[data-lever]')).toHaveLength(0);
  rate(h, p, s => (s.evidenceStrength === 'weak' ? 'strong' : 'strong'));
  h.dispatch('retry');
  // Try again keeps the practice item.
  expect(h.state().task!.itemId).toBe('rate~simpler');
  rate(h, p);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  advance(h);
  // Back on the full item, blank; the practice success credited nothing.
  expect(h.state().task!.itemId).toBe('rate');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'No evidence rated yet' });
  rate(h, PASSAGE);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'rate', correct: true });
  advance(h);
  expect(h.state().status).toBe('completed');
});

it('find practice: a two-claim practice passage that the same controls answer', () => {
  const h = mount();
  find(h, PASSAGE, () => 0);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'wrong_claim' });
  const receipt = h.dispatch('pull_lever', { lever: 'practice_passage' });
  expect(receipt.state.task!.itemId).toBe('find~simpler');
  const p = practiceFor({ id: 'find' }, PASSAGE)!;
  expect(p.claims).toHaveLength(2);
  find(h, p);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  advance(h);
  expect(h.state().task!.itemId).toBe('find');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'Nothing highlighted yet' });
});
