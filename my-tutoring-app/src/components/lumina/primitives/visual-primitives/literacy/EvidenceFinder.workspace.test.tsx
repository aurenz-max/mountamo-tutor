// @vitest-environment jsdom
/**
 * Evidence finder on the teaching workspace (W1, plain shape): what is its own. Each phase of the one passage is a
 * checked item (find, and rate on a CER passage); no answer (which sentences are evidence, which claim each supports,
 * how strong each is) reaches the tutor; a wrong check commits its named miss, stays closed, and Try again clears only
 * that phase; the last right check completes once. The generic W1 contract runs in `runtime/workspaceContract.test.tsx`.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { validateEvidenceFinderData } from '../../../components/live-activity/adapters/evidenceFinderLive';
import type { EvidenceFinderData } from './EvidenceFinder';
import { EMPTY_VIEW, claimOf, evidenceFinderMiss, findCorrect, type Strength } from './evidenceFinderWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

type Sentence = EvidenceFinderData['passage']['sentences'][number];
const S = (id: string, text: string, claimIndex?: number, evidenceStrength?: Strength): Sentence =>
  claimIndex === undefined ? { id, text, isEvidence: false } : { id, text, isEvidence: true, claimIndex, evidenceStrength };

const passage = (claims: string[], sentences: Sentence[], cerEnabled = false): EvidenceFinderData => ({
  title: 'Busy Bees', gradeLevel: '4', cerEnabled,
  passage: { text: sentences.map(s => s.text).join(' '), sentences },
  claims: claims.map((text, i) => ({ id: `claim${i + 1}`, text, color: i ? 'violet' : 'blue' })),
});

const BY_MODE: Record<string, EvidenceFinderData> = {
  locate_evidence: passage(['Bees carry pollen between flowers.'], [
    S('s1', 'Bees live in hives.'),
    S('s2', 'Pollen sticks to a bee\'s fuzzy legs.', 0, 'strong'),
    S('s3', 'Honey tastes sweet.'),
    S('s4', 'The bee brushes that pollen onto the next flower.', 0, 'strong'),
  ]),
  match_evidence_to_claim: passage(['Bees carry pollen between flowers.', 'Farms need bees.'], [
    S('s1', 'Bees live in hives.'),
    S('s2', 'Pollen sticks to a bee\'s fuzzy legs.', 0, 'strong'),
    S('s3', 'Apple farmers rent hives each spring.', 1, 'strong'),
    S('s4', 'Honey tastes sweet.'),
    S('s5', 'Without bees, berry harvests shrink.', 1, 'moderate'),
  ]),
  evaluate_evidence_strength: passage(['Bees help plants make seeds.'], [
    S('s1', 'Bees live in hives.'),
    S('s2', 'Pollen from a bee lets a flower make seeds.', 0, 'strong'),
    S('s3', 'Bees visit many flowers in a day.', 0, 'moderate'),
    S('s4', 'Honey tastes sweet.'),
    S('s5', 'Gardens with bees look pretty.', 0, 'weak'),
  ], true),
};

const mount = (mode: string, data: EvidenceFinderData) =>
  mountWorkspace({ primitiveId: 'evidence-finder', evalMode: mode, instanceId: 'evidence', data: data as unknown as Record<string, unknown> });

/** Every evidence sentence under the claim given (its own by default), then Check. */
const find = (h: WorkspaceHarness, d: EvidenceFinderData, claimFor = (s: Sentence) => claimOf(d, s), extra: string[] = []) => {
  d.claims.forEach((c, i) => {
    if (d.claims.length > 1) h.press(c.text);
    d.passage.sentences.filter(s => s.isEvidence && claimFor(s) === i).forEach(s => h.touch(`sentence-${s.id}`));
    if (i === 0) extra.forEach(id => h.touch(`sentence-${id}`));
  });
  h.press('Check Evidence');
};
const LABEL: Record<Strength, string> = { strong: 'Strong', moderate: 'Moderate', weak: 'Weak' };
const rate = (h: WorkspaceHarness, d: EvidenceFinderData, as = (s: Sentence) => s.evidenceStrength!) => {
  d.passage.sentences.filter(s => s.isEvidence).forEach(s => h.press(`${LABEL[as(s)]}: ${s.text}`));
  h.press('Check Ratings');
};
const advance = (h: WorkspaceHarness) => { h.dispatch('advance'); h.confirmVisible(); };

it.each(Object.keys(BY_MODE))('%s binds every phase with no scripted cue and no answer in the packet', mode => {
  const d = BY_MODE[mode];
  const h = mount(mode, d);
  const keyFree = () => {
    const demand = JSON.stringify(h.state().task!.demand);
    expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
    expect(demand).not.toMatch(/isEvidence|evidenceStrength|claimIndex|"strong"|"moderate"|"weak"/);
  };
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.itemId).toBe('find');
  keyFree();
  find(h, d); advance(h);
  if (d.cerEnabled) {
    expect(h.state().task!.itemId).toBe('rate');
    keyFree();
    rate(h, d); advance(h);
  }
  expect(h.state().status).toBe('completed');
  expect(seam.legacyAI).not.toHaveBeenCalled();
  // No scripted reasoning box and no Finish on the workspace.
  expect(h.view.container.querySelector('textarea')).toBeNull();
  expect(h.view.container.textContent).not.toMatch(/Next: Reasoning/);
  h.close();
});

it('a wrong find commits its miss, stays closed, and Try again clears the highlights; then a wrong rating reopens', () => {
  seam.evaluationContext = { lesson: 'test' };
  const d = BY_MODE.evaluate_evidence_strength;
  const h = mount('evaluate_evidence_strength', d);
  find(h, d, s => claimOf(d, s), ['s4']);
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(JSON.stringify(h.state().task)).toContain('not_evidence');
  // Closed until Try again: a tap changes nothing.
  const work = h.state().task!.demand.learnerWork;
  h.touch('sentence-s1');
  expect(h.state().task!.demand.learnerWork).toBe(work);
  h.dispatch('retry');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'Nothing highlighted yet' });
  // The weak sentence is optional: the strong and moderate ones alone are the find.
  h.touch('sentence-s2'); h.touch('sentence-s3'); h.press('Check Evidence');
  expect(h.state().task!.evidence.correctness).toBe('correct');
  advance(h);
  // Every evidence sentence is rated, the weak one too; Strong on it is "mentions vs proves".
  rate(h, d, s => (s.id === 's5' ? 'strong' : s.evidenceStrength!));
  expect(JSON.stringify(h.state().task)).toContain('weak_as_strong');
  h.dispatch('retry');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'No evidence rated yet' });
  rate(h, d); advance(h);
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [, , metrics, studentWork, , evidence] = seam.submit.mock.calls[0];
  expect(metrics).toMatchObject({ type: 'evidence-finder', correctEvidenceFound: 2, falseEvidenceSelected: 0, evidenceStrengthRatingAccuracy: 100 });
  expect(studentWork.teachingAttempts).toHaveLength(4);
  expect(evidence.phases).toEqual([expect.objectContaining({ itemId: 'find', miss: 'not_evidence' }),
    expect.objectContaining({ itemId: 'rate', miss: 'weak_as_strong' })]);
  h.close();
});

it('match: evidence under the wrong claim is wrong_claim, and the screen never says which', () => {
  const d = BY_MODE.match_evidence_to_claim;
  const h = mount('match_evidence_to_claim', d);
  find(h, d, () => 0);
  expect(JSON.stringify(h.state().task)).toContain('wrong_claim');
  expect(h.view.container.textContent).toMatch(/under the wrong claim/);
  h.dispatch('retry');
  find(h, d); advance(h);
  expect(h.state().status).toBe('completed');
  h.close();
});

it('evidenceFinderMiss names each phase\'s error; the validator refuses an unanswerable passage', () => {
  const m = BY_MODE.match_evidence_to_claim, e = BY_MODE.evaluate_evidence_strength;
  const v = EMPTY_VIEW;
  expect(evidenceFinderMiss({ id: 'find' }, m, { ...v, highlighted: { s2: 0 } })).toBe('missed_evidence');
  expect(evidenceFinderMiss({ id: 'find' }, m, { ...v, highlighted: { s2: 0, s3: 1, s5: 1, s1: 0 } })).toBe('not_evidence');
  expect(evidenceFinderMiss({ id: 'find' }, m, { ...v, highlighted: { s2: 1, s3: 1, s5: 1 } })).toBe('wrong_claim');
  expect(findCorrect(m, { s2: 0, s3: 1, s5: 1 })).toBe(true);
  expect(findCorrect(e, {})).toBe(false);
  const rated = (r: Record<string, Strength>) => evidenceFinderMiss({ id: 'rate' }, e, { ...v, ratings: r });
  expect(rated({ s2: 'strong', s3: 'strong', s5: 'weak' })).toBe('rated_too_strong');
  expect(rated({ s2: 'moderate', s3: 'weak', s5: 'weak' })).toBe('rated_too_weak');
  expect(rated({ s2: 'moderate', s3: 'strong', s5: 'weak' })).toBe('mixed_ratings');
  expect(rated({ s2: 'strong', s3: 'moderate', s5: 'weak' })).toBeUndefined();
  // Two claims with no claim index, every sentence evidence, or a CER passage without strengths cannot be checked.
  expect(() => validateEvidenceFinderData({ ...m, passage: { ...m.passage, sentences: m.passage.sentences.map(s => ({ ...s, claimIndex: undefined })) } })).toThrow();
  expect(() => validateEvidenceFinderData({ ...m, passage: { ...m.passage, sentences: m.passage.sentences.map(s => ({ ...s, isEvidence: true, claimIndex: 0 })) } })).toThrow();
  expect(() => validateEvidenceFinderData({ ...e, passage: { ...e.passage, sentences: e.passage.sentences.map(s => ({ ...s, evidenceStrength: undefined })) } })).toThrow();
  expect(validateEvidenceFinderData(BY_MODE.locate_evidence)).toBe(BY_MODE.locate_evidence);
});
