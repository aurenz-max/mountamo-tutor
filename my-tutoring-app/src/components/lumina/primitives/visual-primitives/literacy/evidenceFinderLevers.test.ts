/**
 * evidence-finder levers, pure: every lever's leak rule per mode, the practice builders over every pool topic, and
 * "this miss, then this lever" (`nextLever`), all through the one lever set (`EVIDENCE_LEVERS`).
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { EvidenceFinderData } from './EvidenceFinder';
import {
  EVIDENCE_LEVERS, POOL, countLeaks, exampleTopic, practiceFor, practiceLeaks, practiceTopic, poolLeaks, proofExample,
  strengthGuide,
} from './evidenceFinderLevers';
import { FIND_MISSES, RATE_MISSES, evidenceFinderItems, findCorrect, rateList, type Strength } from './evidenceFinderWorkspace';

type Sentence = EvidenceFinderData['passage']['sentences'][number];
const S = (id: string, text: string, claimIndex?: number, evidenceStrength?: Strength): Sentence =>
  claimIndex === undefined ? { id, text, isEvidence: false } : { id, text, isEvidence: true, claimIndex, evidenceStrength };
const passage = (title: string, claims: string[], sentences: Sentence[], cerEnabled = false): EvidenceFinderData => ({
  title, gradeLevel: '4', cerEnabled, passage: { text: sentences.map(s => s.text).join(' '), sentences },
  claims: claims.map((text, i) => ({ id: `c${i}`, text, color: 'blue' })),
});

const BY_MODE: Record<string, EvidenceFinderData> = {
  locate_evidence: passage('Bees', ['Bees carry pollen.'], [
    S('s1', 'Bees live in hives.'), S('s2', 'Pollen sticks to a bee.', 0, 'strong'), S('s3', 'Honey is sweet.'),
    S('s4', 'The bee brushes pollen onto the next flower.', 0, 'strong')]),
  match_evidence_to_claim: passage('Bees', ['Bees carry pollen.', 'Farms need bees.'], [
    S('s1', 'Bees live in hives.'), S('s2', 'Pollen sticks to a bee.', 0, 'strong'), S('s3', 'Farmers rent hives.', 1, 'strong'),
    S('s4', 'Honey is sweet.'), S('s5', 'Without bees, harvests shrink.', 1, 'moderate')]),
  evaluate_evidence_strength: passage('Bees', ['Bees help plants make seeds.'], [
    S('s1', 'Bees live in hives.'), S('s2', 'Pollen from a bee lets a flower make seeds.', 0, 'strong'),
    S('s3', 'Bees visit many flowers.', 0, 'moderate'), S('s4', 'Honey is sweet.'), S('s5', 'Gardens with bees look pretty.', 0, 'weak')], true),
};
const sessionWords = (d: EvidenceFinderData) => [...d.passage.sentences.map(s => s.text), ...d.claims.map(c => c.text)];
const CTX = { highlighted: { s2: 0 } };

describe.each(Object.keys(BY_MODE))('%s', mode => {
  const d = BY_MODE[mode];
  const items = evidenceFinderItems(d);

  it('every help fact and drawing names no sentence or claim of the passage', () => {
    for (const item of items) {
      const levers = EVIDENCE_LEVERS.declare(item, CTX, []);
      const facts = EVIDENCE_LEVERS.onScreen(item, CTX, levers.map(l => l.id));
      expect(facts.length).toBeGreaterThan(0);
      for (const w of sessionWords(d)) expect(facts).not.toContain(w);
    }
    const drawn = JSON.stringify([proofExample(d), strengthGuide(d)]);
    for (const w of sessionWords(d)) expect(drawn).not.toContain(w);
  });

  it('every checked miss of the mode is answered by a lever on its item, help before simplify', () => {
    for (const item of items) {
      const levers = EVIDENCE_LEVERS.declare(item, CTX, []);
      for (const miss of item.kind === 'find' ? FIND_MISSES : RATE_MISSES) {
        const lever = nextLever(levers, miss);
        expect(lever, `${item.id} ${miss}`).not.toBeNull();
        expect(levers.find(l => l.id === lever)!.kind).toBe('help');
      }
      expect(nextLever(levers.map(l => ({ ...l, pulled: l.kind === 'help' })), item.kind === 'find' ? 'missed_evidence' : 'mixed_ratings'))
        .toBe(item.kind === 'find' ? 'practice_passage' : 'practice_ratings');
    }
  });

  it('the practice item keeps the step: same claims count on find, strong and weak to rate, solvable, never the session\'s', () => {
    for (const item of items) {
      const practice = EVIDENCE_LEVERS.simpler(item, CTX, item.kind === 'find' ? 'practice_passage' : 'practice_ratings')!;
      expect(practice).toMatchObject({ id: `${item.kind}~simpler`, kind: item.kind });
      const p = practice.data;
      expect(practiceLeaks(p, d)).toBe(false);
      if (item.kind === 'find') {
        expect(p.claims).toHaveLength(d.claims.length);
        expect(p.passage.sentences.some(s => !s.isEvidence)).toBe(true);
        p.claims.forEach((_, i) => expect(p.passage.sentences.some(s => s.isEvidence && s.claimIndex === i)).toBe(true));
        const key = Object.fromEntries(p.passage.sentences.filter(s => s.isEvidence).map(s => [s.id, s.claimIndex!]));
        expect(findCorrect(p, key)).toBe(true);
      } else {
        expect(rateList(p).map(s => s.evidenceStrength)).toEqual(['strong', 'weak']);
      }
    }
  });

  it('the model lever comes by the item\'s tier, and only where it is offered', () => {
    const [find] = items;
    expect(EVIDENCE_LEVERS.support(find, CTX)).toMatch(/after a miss, model a worked example on another topic.*proof_example/);
    expect(EVIDENCE_LEVERS.support({ ...find, supportTier: 'hard' }, CTX)).toMatch(/never say which sentences of this passage are evidence/);
    if (items[1]) expect(EVIDENCE_LEVERS.support(items[1], CTX)).toBe('');
  });
});

it('a pool topic the passage is about is never used; with every topic taken there is no example and no practice', () => {
  const frogs = passage('Frogs', ['Frogs are good jumpers.'], [S('s1', 'A frog sits.'), S('s2', 'Frogs leap far.', 0, 'strong')]);
  expect(poolLeaks(POOL.find(t => t.topic === 'frogs')!, frogs)).toBe(true);
  expect(exampleTopic(frogs)!.topic).not.toBe('frogs');
  expect(practiceTopic(frogs)!.topic).not.toBe('frogs');
  // The example and the practice differ when they can, so the example never shows the practice's answer.
  expect(exampleTopic(frogs)!.topic).not.toBe(practiceTopic(frogs)!.topic);
  const all = passage('Animals', ['Frogs, owls and bikes.'], [S('s1', 'Frogs and owls.'), S('s2', 'A bike.', 0, 'strong')]);
  expect(exampleTopic(all)).toBeNull();
  expect(practiceFor('find', all)).toBeNull();
  expect(EVIDENCE_LEVERS.declare(evidenceFinderItems(all)[0], CTX, []).map(l => l.id)).toEqual(['evidence_count']);
});

it('the count is refused when a claim has nothing that clearly proves it', () => {
  const lopsided = passage('Bees', ['A', 'B'], [S('s1', 'x'), S('s2', 'y', 0, 'strong'), S('s3', 'z', 1, 'weak')]);
  expect(countLeaks(lopsided)).toBe(true);
  expect(countLeaks(BY_MODE.match_evidence_to_claim)).toBe(false);
  expect(EVIDENCE_LEVERS.declare(evidenceFinderItems(lopsided)[0], CTX, []).map(l => l.id)).not.toContain('evidence_count');
});
