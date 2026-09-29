/**
 * word-flip's levers (`/add-support-tiers`, handoff 22 L2): the model and practice words are never the session's,
 * an irregular model never shares the item's pattern, and practice keeps the rule.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { LITERACY_CATALOG } from '../../../service/manifest/catalog/literacy';
import type { WordFlipChallenge } from './WordFlip';
import { FLIP_MISSES, changePattern, flipModelFor, flipSessionWords, practiceItemFor, practiceLeak, wordFlipLevers } from './wordFlipLevers';

const saved: WordFlipChallenge[] = JSON.parse(readFileSync(join(__dirname,
  '../../../components/live-activity/runtime/testing/w1-payloads/word-flip.plural_s.json'), 'utf8')).data.challenges;
const c = (id: string, type: WordFlipChallenge['type'], sourceWord: string, answer: string): WordFlipChallenge =>
  ({ id, type, sourceWord, answer, emoji: '⭐', count: 2 });
const SESSIONS: Array<[string, WordFlipChallenge[]]> = [
  ['saved plural_s', saved],
  ['plural_es', [c('a', 'plural_es', 'fox', 'foxes'), c('b', 'plural_es', 'bus', 'buses')]],
  ['plural_y', [c('a', 'plural_y', 'baby', 'babies'), c('b', 'plural_y', 'kitty', 'kitties')]],
  ['irregulars', [c('a', 'irregulars', 'foot', 'feet'), c('b', 'irregulars', 'man', 'men')]],
  ['past_ed', [c('a', 'past_ed', 'jump', 'jumped'), c('b', 'past_ed', 'kick', 'kicked')]],
  ['past_irregular', [c('a', 'past_irregular', 'sit', 'sat'), c('b', 'past_irregular', 'run', 'ran')]],
];

describe.each(SESSIONS)('%s', (_l, session) => {
  it('model and practice: off the session, distinct, same rule; an irregular model changes another way', () => {
    const used = flipSessionWords(session);
    for (const item of session) {
      const model = flipModelFor(item, session)!, practice = practiceItemFor(item, session)!;
      expect(model, item.id).toBeTruthy();
      expect(used.has(model.singular) || used.has(model.plural)).toBe(false);
      if (item.type === 'irregulars' || item.type === 'past_irregular')
        expect(changePattern(model.singular, model.plural)).not.toBe(changePattern(item.sourceWord, item.answer));
      expect(practice, item.id).toBeTruthy();
      expect(practiceLeak(practice, item, session)).toBe(false);
      expect(practice.sourceWord).not.toBe(model.singular);
      expect(practice.emoji).toBeTruthy();
    }
  });
});

describe('levers', () => {
  const entry = LITERACY_CATALOG.find(x => x.id === 'word-flip')!.teachingWorkspace!;
  it('foot never gets tooth or goose as its model: the oo-to-ee pattern is its answer', () => {
    const items = [c('a', 'irregulars', 'foot', 'feet')];
    expect(['tooth', 'goose']).not.toContain(flipModelFor(items[0], items)!.singular);
    expect(changePattern('sit', 'sat')).toBe('i-a');
  });

  it('regular and irregular levers, carriers, and every miss declared and unanswered', () => {
    expect(wordFlipLevers(saved[0], [], saved).map(l => l.id)).toEqual(['rule_model_cards', 'familiar_noun']);
    const odd = SESSIONS[3][1];
    expect(wordFlipLevers(odd[0], [], odd).map(l => l.id)).toEqual(['irregular_model', 'common_irregular']);
    for (const [, session] of SESSIONS) for (const item of session) {
      for (const l of wordFlipLevers(item, [], session)) {
        expect(['shown', 'both']).toContain(l.carrier);
        for (const miss of l.answers ?? []) expect(entry.misses![item.type]).toContain(miss);
      }
      expect(entry.misses![item.type]).toEqual(FLIP_MISSES[item.type]);
      expect(entry.unanswered![item.type]).toEqual(FLIP_MISSES[item.type]);
    }
    expect(nextLever(wordFlipLevers(saved[0], [], saved), 'unchanged')).toBe('rule_model_cards');
  });
});
