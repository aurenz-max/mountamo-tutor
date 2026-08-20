/**
 * StatesOfMatter.di-script — gates + pedagogy pins for the states-of-matter
 * judged pack (THIRD science port, SECOND chemistry port).
 *
 * Plumbing is one import (checkPackGates / checkDiCatalogEntry); this file
 * keeps only what is this pack's own pedagogy:
 *  - the answer-material fork, both directions (EVERY mode speaks — the pin
 *    that fails loudly if a tap is ever re-introduced);
 *  - the leak asserts (an observe ask never names the state at medium or hard;
 *    the easy tier alone names the menu and exempts exactly that clause; a
 *    predict ask never lands the state; a `predict_change` ask never says
 *    "melts", which is why its thresholds are phrased as transitions; a compare
 *    ask DOES name both options — the menu is the question);
 *  - the science build gates (chocolate does not boil; K-2 never hears a
 *    below-zero temperature; nothing is asked from inside the margin around a
 *    threshold; a compare pair whose beakers do not match is dropped);
 *  - the session invariant (a substance appears in ONE item, in any role) and
 *    the no-two-in-a-row answer rule this pack needs because its answer set is
 *    three words wide;
 *  - the catalog steering regressions.
 *
 * ⚠️ The SECOND pack below is the real session shape (several same-action items
 * back to back) — without it `findRepeatedConsecutiveAsks` is on and asleep,
 * the trap every port's one-item-per-mode fixture fell into.
 */

import { describe, expect, it } from 'vitest';
import {
  checkDiCatalogEntry,
  checkPackGates,
} from '../../../../hooks/judgedScriptContract.testkit';
import { spokenSpanOf } from '../../../../hooks/judgedScriptContract';
import { CHEMISTRY_CATALOG } from '../../../../service/manifest/catalog/chemistry';
import {
  STATE_MENU_CLAUSE,
  STATE_RULE_CLAUSE,
  answerKindFor,
  itemCue,
  itemFromChallenge,
  itemsFromChallenges,
  moveOnCue,
  statesOfMatterHarnessAnswers,
  statesOfMatterPackBase,
  responseClassFor,
  type StatesChallengeLike,
  type StatesOfMatterItem,
  type StatesTier,
} from '../statesOfMatterScript';

// ── Fixtures ────────────────────────────────────────────────────────────────
// Every substance distinct — the session invariant would drop reuse.

const FULL_SPREAD: StatesChallengeLike[] = [
  // water mp 0 / bp 100 → 50°C is a liquid
  { id: 'o1', challengeType: 'observe', substanceKey: 'water', startTemp: 50 },
  // iron mp 1538 → 20°C is a solid
  { id: 'o2', challengeType: 'observe', substanceKey: 'iron', startTemp: 20 },
  // wax mp 60 / bp 370: solid at 20 → liquid at 200
  { id: 'p1', challengeType: 'predict', kind: 'predict_state', substanceKey: 'wax', startTemp: 20, targetTemp: 200 },
  // mercury mp -39 / bp 357: liquid at 100 → gas at 400 = boiling
  { id: 'p2', challengeType: 'predict', kind: 'predict_change', substanceKey: 'mercury', startTemp: 100, targetTemp: 400 },
  // coconut oil (24) vs butter (32), both solid at 4°C
  { id: 'c1', challengeType: 'compare', kind: 'melt_first', pairKeys: ['coconutOil', 'butter'], startTemp: 4 },
  // chocolate (34) vs aluminum (660): at 200°C only aluminum is still solid
  { id: 'c2', challengeType: 'compare', kind: 'stay_solid', pairKeys: ['chocolate', 'aluminum'], startTemp: 14, targetTemp: 200 },
];

const itemsOf = (
  challenges: StatesChallengeLike[],
  tier: StatesTier = 'medium',
): StatesOfMatterItem[] => itemsFromChallenges(challenges, { band: '3-5', tier });

const byId = (items: StatesOfMatterItem[], id: string): StatesOfMatterItem => {
  const item = items.find((i) => i.id === id);
  if (!item) throw new Error(`fixture item ${id} was dropped`);
  return item;
};

const one = (
  ch: StatesChallengeLike,
  band: 'K-2' | '3-5' = '3-5',
  tier: StatesTier = 'medium',
) => itemFromChallenge(ch, { band, tier });

describe('pack gates', () => {
  it('the full spread builds and passes every structural gate', () => {
    const items = itemsOf(FULL_SPREAD);
    expect(items).toHaveLength(FULL_SPREAD.length);
    expect(checkPackGates(statesOfMatterPackBase(items))).toEqual([]);
  });

  it('the REAL session shape — same-action items back to back — passes the repeat-ask gate', () => {
    const items = itemsOf([
      { id: 'r1', challengeType: 'observe', substanceKey: 'water', startTemp: 50 },
      { id: 'r2', challengeType: 'observe', substanceKey: 'iron', startTemp: 20 },
      { id: 'r3', challengeType: 'observe', substanceKey: 'wax', startTemp: 200 },
      { id: 'r4', challengeType: 'predict', kind: 'predict_state', substanceKey: 'chocolate', startTemp: 10, targetTemp: 100 },
      { id: 'r5', challengeType: 'predict', kind: 'predict_state', substanceKey: 'mercury', startTemp: 100, targetTemp: 400 },
      { id: 'r6', challengeType: 'compare', kind: 'melt_first', pairKeys: ['coconutOil', 'butter'], startTemp: 4 },
      { id: 'r7', challengeType: 'compare', kind: 'melt_first', pairKeys: ['aluminum', 'oxygen'], startTemp: -240 },
    ]);
    expect(items).toHaveLength(7);
    expect(checkPackGates(statesOfMatterPackBase(items))).toEqual([]);
  });

  it('every tier passes the gates — the lead-in ladder cannot break a cue', () => {
    for (const tier of ['easy', 'medium', 'hard'] as StatesTier[]) {
      expect(checkPackGates(statesOfMatterPackBase(itemsOf(FULL_SPREAD, tier)))).toEqual([]);
    }
  });

  it('the catalog entry matches the pack contract', () => {
    const entry = CHEMISTRY_CATALOG.find((c) => c.id === 'states-of-matter');
    expect(entry).toBeDefined();
    const items = itemsOf(FULL_SPREAD);
    expect(
      checkDiCatalogEntry(entry as never, statesOfMatterPackBase(items), items[0]),
    ).toEqual([]);
  });
});

describe('the answer-material fork (standing gate 1)', () => {
  it('EVERY mode speaks — there is no gesture item in this pack', () => {
    const items = itemsOf(FULL_SPREAD);
    for (const item of items) {
      expect(item.answerKind).toBe('voice');
      expect(answerKindFor(item.kind)).toBe('voice');
      expect(item.responseClass).toBe(responseClassFor(item.kind));
    }
  });

  it('states and changes are short_spoken_word; a two-name menu is closed_set_choice', () => {
    const items = itemsOf(FULL_SPREAD);
    expect(byId(items, 'o1').responseClass).toBe('short_spoken_word');
    expect(byId(items, 'p1').responseClass).toBe('short_spoken_word');
    expect(byId(items, 'p2').responseClass).toBe('short_spoken_word');
    expect(byId(items, 'c1').responseClass).toBe('closed_set_choice');
    expect(byId(items, 'c2').responseClass).toBe('closed_set_choice');
  });

  it('every cue carries the JUDGING contract and none carries a silence/tap contract', () => {
    for (const item of itemsOf(FULL_SPREAD)) {
      const cue = itemCue(item);
      expect(cue).toContain('If the answer is right');
      expect(cue).toContain('If it is wrong');
      expect(cue).not.toContain('answers by TAPPING');
      expect(cue).not.toContain('Do not judge anything you hear');
    }
  });
});

describe('leak rules', () => {
  it('an observe ask never names the state at medium or hard', () => {
    for (const tier of ['medium', 'hard'] as StatesTier[]) {
      const item = byId(itemsOf(FULL_SPREAD, tier), 'o1'); // water at 50 → liquid
      const span = spokenSpanOf(itemCue(item)).toLowerCase();
      expect(span).not.toContain('liquid');
      expect(span).not.toContain('solid');
      expect(span).not.toContain('gas');
    }
  });

  it('the EASY tier alone names the three-way menu, and exempts exactly that clause', () => {
    const easy = byId(itemsOf(FULL_SPREAD, 'easy'), 'o1');
    expect(spokenSpanOf(itemCue(easy))).toContain(STATE_MENU_CLAUSE);
    const spans = statesOfMatterHarnessAnswers(easy).leakExemptSpan as string[];
    expect(spans).toContain(STATE_MENU_CLAUSE);
    expect(spans).toContain(STATE_RULE_CLAUSE);

    const medium = byId(itemsOf(FULL_SPREAD, 'medium'), 'o1');
    expect(spokenSpanOf(itemCue(medium))).not.toContain(STATE_MENU_CLAUSE);
    expect(statesOfMatterHarnessAnswers(medium).leakExemptSpan).toEqual([STATE_RULE_CLAUSE]);

    // hard speaks no lead-in at all, so the whole cue is governed flat.
    const hard = byId(itemsOf(FULL_SPREAD, 'hard'), 'o1');
    expect(statesOfMatterHarnessAnswers(hard).leakExemptSpan).toEqual([]);
    expect(spokenSpanOf(itemCue(hard, { opening: true, howToPlay: true })))
      .not.toContain(STATE_RULE_CLAUSE);
  });

  it('a predict ask states the thresholds aloud but never lands the state', () => {
    const item = byId(itemsOf(FULL_SPREAD), 'p1'); // wax 20 → 200 = liquid
    const span = spokenSpanOf(itemCue(item)).toLowerCase();
    expect(span).toContain('melts at 60 degrees');
    expect(span).toContain('boils at 370 degrees');
    expect(span).not.toContain('liquid');
    expect(span).not.toContain('solid');
  });

  it('a predict_change ask speaks its thresholds as TRANSITIONS — "melts at" would hand over the answer word', () => {
    const item = byId(itemsOf(FULL_SPREAD), 'p2'); // mercury liquid → gas = boiling
    const span = spokenSpanOf(itemCue(item, { opening: true, howToPlay: true })).toLowerCase();
    expect(span).toContain('turns from solid to liquid at minus 39 degrees');
    expect(span).not.toContain('melt');
    expect(span).not.toContain('boil');
    expect(span).not.toContain('freez');
    expect(span).not.toContain('condens');
  });

  it('a compare ask NAMES both options — the menu is the question, not a leak', () => {
    const item = byId(itemsOf(FULL_SPREAD), 'c1');
    const span = spokenSpanOf(itemCue(item));
    expect(span).toContain('Coconut Oil');
    expect(span).toContain('Butter');
    const answers = statesOfMatterHarnessAnswers(item);
    expect(answers.correct).toBe('Coconut Oil'); // the lower melting point melts first
    expect(Array.isArray(answers.leakExemptSpan)).toBe(true);
  });

  it('a negative temperature is SPOKEN, never left as a raw minus sign', () => {
    const item = byId(itemsOf(FULL_SPREAD), 'p2');
    const span = spokenSpanOf(itemCue(item));
    expect(span).toContain('minus 39 degrees');
    expect(span).not.toContain('-39');
  });
});

describe('science build gates — the spoken ask audits the content', () => {
  it('drops an unresolvable substance', () => {
    expect(one({ id: 'x', challengeType: 'observe', substanceKey: 'unobtanium', startTemp: 20 })).toBeNull();
  });

  it('drops a GAS answer on a substance that scorches rather than boils', () => {
    // chocolate mp 34 / "bp" 350 — the click-era generator keyed this happily.
    expect(one({ id: 'x', challengeType: 'observe', substanceKey: 'chocolate', startTemp: 400 })).toBeNull();
    expect(one({ id: 'x', challengeType: 'predict', kind: 'predict_state', substanceKey: 'chocolate', startTemp: 10, targetTemp: 400 })).toBeNull();
  });

  it('a chocolate ask never speaks a boiling point', () => {
    const item = one({ id: 'x', challengeType: 'predict', kind: 'predict_state', substanceKey: 'chocolate', startTemp: 10, targetTemp: 100 })!;
    const span = spokenSpanOf(itemCue(item)).toLowerCase();
    expect(span).toContain('melts at 34 degrees');
    expect(span).not.toContain('boils at');
  });

  it('drops anything asked from inside the ambiguous margin around a threshold', () => {
    // water melts at 0; 3°C is inside TEMP_MARGIN and reads "it is turning".
    expect(one({ id: 'x', challengeType: 'observe', substanceKey: 'water', startTemp: 3 })).toBeNull();
    expect(one({ id: 'x', challengeType: 'observe', substanceKey: 'water', startTemp: 50 })).not.toBeNull();
  });

  it('K-2 never hears a below-zero temperature, and never draws an off-band substance', () => {
    expect(one({ id: 'x', challengeType: 'observe', substanceKey: 'water', startTemp: -20 }, 'K-2')).toBeNull();
    expect(one({ id: 'x', challengeType: 'observe', substanceKey: 'iron', startTemp: 20 }, 'K-2')).toBeNull();
    expect(one({ id: 'x', challengeType: 'observe', substanceKey: 'wax', startTemp: 20 }, 'K-2')).not.toBeNull();
  });

  it('predict_change is Grade 3-5 only, and needs a real four-way change', () => {
    const ch: StatesChallengeLike = {
      id: 'x', challengeType: 'predict', kind: 'predict_change',
      substanceKey: 'wax', startTemp: 20, targetTemp: 200,
    };
    expect(one(ch)!.answerChange).toBe('melting');
    expect(one(ch, 'K-2')).toBeNull();
    // Same state in and out — there is no change to name.
    expect(one({ ...ch, targetTemp: 40 })).toBeNull();
  });

  it('drops a compare pair whose beakers do not MATCH at the start temperature', () => {
    // At 40°C chocolate has already melted and wax has not — the picture
    // answers the question before the child reasons about it.
    expect(one({ id: 'x', challengeType: 'compare', kind: 'melt_first', pairKeys: ['chocolate', 'wax'], startTemp: 40 })).toBeNull();
    expect(one({ id: 'x', challengeType: 'compare', kind: 'melt_first', pairKeys: ['chocolate', 'wax'], startTemp: 14 })).not.toBeNull();
  });

  it('drops a compare pair that is not ear-separable', () => {
    expect(one({ id: 'x', challengeType: 'compare', kind: 'melt_first', pairKeys: ['water', 'butter'], startTemp: -20 })).toBeNull();
    expect(one({ id: 'x', challengeType: 'compare', kind: 'melt_first', pairKeys: ['nitrogen', 'oxygen'], startTemp: -240 })).toBeNull();
  });

  it('drops a stay_solid whose target leaves both survivors or none', () => {
    const base: StatesChallengeLike = {
      id: 'x', challengeType: 'compare', kind: 'stay_solid',
      pairKeys: ['chocolate', 'aluminum'], startTemp: 14,
    };
    expect(one({ ...base, targetTemp: 200 })!.answerName).toBe('Aluminum');
    expect(one({ ...base, targetTemp: 20 })).toBeNull();   // both still solid
    expect(one({ ...base, targetTemp: 800 })).toBeNull();  // neither is
  });
});

describe('the session invariant', () => {
  it('a substance appears in ONE item per session, in any role', () => {
    const items = itemsOf([
      { id: 'a', challengeType: 'observe', substanceKey: 'wax', startTemp: 200 },
      { id: 'b', challengeType: 'predict', kind: 'predict_state', substanceKey: 'wax', startTemp: 20, targetTemp: 200 },
      { id: 'c', challengeType: 'compare', kind: 'melt_first', pairKeys: ['wax', 'iron'], startTemp: 20 },
      { id: 'd', challengeType: 'observe', substanceKey: 'iron', startTemp: 20 },
    ]);
    expect(items.map((i) => i.id)).toEqual(['a', 'd']);
  });

  it('consecutive same-action items may not share an answer — the answer set is three words wide', () => {
    const items = itemsOf([
      { id: 'a', challengeType: 'observe', substanceKey: 'iron', startTemp: 20 },      // solid
      { id: 'b', challengeType: 'observe', substanceKey: 'aluminum', startTemp: 20 },  // solid — dropped
      { id: 'c', challengeType: 'observe', substanceKey: 'water', startTemp: 50 },     // liquid
    ]);
    expect(items.map((i) => i.id)).toEqual(['a', 'c']);
  });
});

describe('verdict wording', () => {
  it('affirmations open "Yes," and corrections open "My turn:"', () => {
    for (const item of itemsOf(FULL_SPREAD)) {
      const cue = itemCue(item);
      expect(cue).toContain('If the answer is right, say exactly: "Yes, ');
      expect(cue).toContain('If it is wrong, say exactly: "My turn: ');
    }
  });

  it('a correction re-models the RULE and never lands the answer', () => {
    const item = byId(itemsOf(FULL_SPREAD), 'p1'); // wax → liquid
    const correction = itemCue(item).split('If it is wrong, ')[1] ?? '';
    expect(correction).toContain('My turn:');
    expect(correction).toContain('Say what state the Wax will be at 200 degrees.');
    // The rule names all three states, which is why it discloses none of them —
    // what it must never do is single the answer out.
    expect(correction).not.toContain('will be a liquid');
  });

  it('the move-on CLOSES THE LINK the corrections could not', () => {
    const items = itemsOf(FULL_SPREAD);
    const cue = moveOnCue(byId(items, 'o1'), null);
    expect(cue).toContain('That Water is a liquid.');
  });

  it('every contract carries the two-branch law and the verdict-ends-the-turn clause', () => {
    for (const item of itemsOf(FULL_SPREAD)) {
      const cue = itemCue(item);
      expect(cue).toContain('Your whole reply to their attempt is ONE of the quoted lines');
      expect(cue).toContain('never run on into another question');
      expect(cue).toContain('never announce the activity\'s state, the temperature');
    }
  });
});

describe('harness answer material — the signature wrongs the contract claims', () => {
  it('observe: the SUBSTANCE said back instead of its state', () => {
    const answers = statesOfMatterHarnessAnswers(byId(itemsOf(FULL_SPREAD), 'o1'));
    expect(answers.correct).toBe('liquid');
    expect(answers.signatureWrong?.text).toBe('Water');
    expect(itemCue(byId(itemsOf(FULL_SPREAD), 'o1'))).toContain('"Water" — is NOT an answer');
  });

  it('observe accepts the honest synonym: "ice" for solid water, "steam" for its gas', () => {
    const solid = one({ id: 'x', challengeType: 'observe', substanceKey: 'water', startTemp: -20 })!;
    expect(itemCue(solid)).toContain('"ice"');
    const gas = one({ id: 'x', challengeType: 'observe', substanceKey: 'water', startTemp: 150 })!;
    expect(itemCue(gas)).toContain('"steam"');
    // A substance with no honest synonym gets no accept clause invented for it.
    expect(itemCue(byId(itemsOf(FULL_SPREAD), 'o2'))).not.toContain('For this substance');
  });

  it('predict_state: the state it is in RIGHT NOW', () => {
    const answers = statesOfMatterHarnessAnswers(byId(itemsOf(FULL_SPREAD), 'p1'));
    expect(answers.correct).toBe('liquid');
    expect(answers.signatureWrong?.text).toBe('solid');
  });

  it('predict_change: the resulting STATE named instead of the change word', () => {
    const answers = statesOfMatterHarnessAnswers(byId(itemsOf(FULL_SPREAD), 'p2'));
    expect(answers.correct).toBe('boiling');
    expect(answers.plainWrong).toBe('condensing');
    expect(answers.signatureWrong?.text).toBe('gas');
  });

  it('compare: the direction reversal, which is the only wrong answer a two-name menu has', () => {
    const answers = statesOfMatterHarnessAnswers(byId(itemsOf(FULL_SPREAD), 'c2'));
    expect(answers.correct).toBe('Aluminum');
    expect(answers.plainWrong).toBe('Chocolate');
    expect(answers.signatureWrong?.text).toBe('Chocolate');
  });

  it('a no-change predict names a wrong answer that is never the right one', () => {
    const item = one({
      id: 'x', challengeType: 'predict', kind: 'predict_state',
      substanceKey: 'wax', startTemp: 100, targetTemp: 200,
    })!;
    expect(item.answerState).toBe('liquid');
    expect(item.startState).toBe('liquid');
    const answers = statesOfMatterHarnessAnswers(item);
    expect(answers.signatureWrong?.text).not.toBe('liquid');
    expect(answers.plainWrong).not.toBe('liquid');
    expect(itemCue(item)).toContain('assuming that changing the temperature must change the state');
  });
});

describe('catalog steering regressions', () => {
  const entry = CHEMISTRY_CATALOG.find((c) => c.id === 'states-of-matter')!;

  it('routes as a judged DI surface with a microphone, and forbids manifest answer keys', () => {
    expect(entry.description).toContain('DIRECT INSTRUCTION');
    expect(entry.constraints).toContain('microphone');
    expect(entry.constraints).toContain('must NOT supply substances');
  });

  it('no click-era prose survives to steer the manifest wrong', () => {
    const prose = `${entry.description} ${entry.constraints}`.toLowerCase();
    expect(prose).not.toContain('multiple choice');
    expect(prose).not.toContain('tap the');
    expect(prose).not.toContain('true/false');
  });

  it('keeps the three eval-mode identities and their betas', () => {
    const modes = (entry.evalModes ?? []).map((m: { evalMode: string; beta: number }) => [m.evalMode, m.beta]);
    expect(modes).toEqual([['observe', -1.0], ['predict', 0.5], ['compare', 2.0]]);
  });
});
