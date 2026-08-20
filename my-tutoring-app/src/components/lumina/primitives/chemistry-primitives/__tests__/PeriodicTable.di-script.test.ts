/**
 * PeriodicTable.di-script — gates + pedagogy pins for the periodic-table
 * judged pack (first CHEMISTRY DI port).
 *
 * Plumbing is one import (checkPackGates / checkDiCatalogEntry); this file
 * keeps only what is this pack's own pedagogy:
 *  - the answer-material fork, both directions (find taps; the rest speak);
 *  - the leak asserts (a name item's spoken line never contains the name; a
 *    position find never names its element; a valence ask never lands the
 *    count; a compare ask DOES name both options — the menu is the question);
 *  - the chemistry build gates (helium's valence contradiction, hydrogen in
 *    a reactivity pair, confusable-name pairs, lanthanide positions);
 *  - the session invariant (an element appears in ONE item per session);
 *  - the catalog steering regressions.
 *
 * ⚠️ The SECOND pack below is the real session shape (several same-action
 * items back to back) — without it `findRepeatedConsecutiveAsks` is on and
 * asleep, the trap every port's one-item-per-mode fixture fell into.
 */

import { describe, expect, it } from 'vitest';
import {
  checkDiCatalogEntry,
  checkPackGates,
} from '../../../hooks/judgedScriptContract.testkit';
import { spokenSpanOf } from '../../../hooks/judgedScriptContract';
import { CHEMISTRY_CATALOG } from '../../../service/manifest/catalog/chemistry';
import {
  answerKindFor,
  cellVerdictCue,
  itemCue,
  itemFromChallenge,
  itemsFromChallenges,
  periodicTableHarnessAnswers,
  periodicTablePackBase,
  responseClassFor,
  type PeriodicChallengeLike,
  type PeriodicTableItem,
} from '../periodicTableScript';

// ── Fixtures ────────────────────────────────────────────────────────────────
// All elements distinct (the session invariant would drop reuse).

const FULL_SPREAD: PeriodicChallengeLike[] = [
  { id: 'f1', challengeType: 'explore', findBy: 'name', targetNumber: 20 },      // calcium
  { id: 'f2', challengeType: 'explore', findBy: 'symbol', targetNumber: 26 },    // iron
  { id: 'f3', challengeType: 'explore', findBy: 'number', targetNumber: 8 },     // oxygen
  { id: 'f4', challengeType: 'explore', findBy: 'position', targetNumber: 12 },  // magnesium
  { id: 'n1', challengeType: 'identify', clueBy: 'position', targetNumber: 2 },  // helium
  { id: 'n2', challengeType: 'identify', clueBy: 'number', targetNumber: 11 },   // sodium
  { id: 'n3', challengeType: 'identify', clueBy: 'symbol', targetNumber: 79 },   // gold
  { id: 't1', challengeType: 'trend', axis: 'size', pairNumbers: [3, 19] },      // Li vs K
  { id: 't2', challengeType: 'trend', axis: 'reactivity', pairNumbers: [17, 53] }, // Cl vs I
  { id: 't3', challengeType: 'trend', targetNumber: 16 },                        // sulfur valence
];

const itemsOf = (challenges: PeriodicChallengeLike[]): PeriodicTableItem[] =>
  itemsFromChallenges(challenges, 'medium');

const byId = (items: PeriodicTableItem[], id: string): PeriodicTableItem => {
  const item = items.find((i) => i.id === id);
  if (!item) throw new Error(`fixture item ${id} was dropped`);
  return item;
};

describe('pack gates', () => {
  it('the full spread builds and passes every structural gate', () => {
    const items = itemsOf(FULL_SPREAD);
    expect(items).toHaveLength(FULL_SPREAD.length);
    expect(checkPackGates(periodicTablePackBase(items))).toEqual([]);
  });

  it('the REAL session shape — same-action items back to back — passes the repeat-ask gate', () => {
    const items = itemsOf([
      { id: 'r1', challengeType: 'explore', findBy: 'name', targetNumber: 6 },   // carbon
      { id: 'r2', challengeType: 'explore', findBy: 'name', targetNumber: 47 },  // silver
      { id: 'r3', challengeType: 'explore', findBy: 'name', targetNumber: 10 },  // neon
      { id: 'r4', challengeType: 'identify', clueBy: 'position', targetNumber: 18 }, // argon
      { id: 'r5', challengeType: 'identify', clueBy: 'position', targetNumber: 36 }, // krypton
      { id: 'r6', challengeType: 'trend', targetNumber: 15 },                    // phosphorus
      { id: 'r7', challengeType: 'trend', targetNumber: 35 },                    // bromine
    ]);
    expect(items).toHaveLength(7);
    expect(checkPackGates(periodicTablePackBase(items))).toEqual([]);
  });

  it('the catalog entry matches the pack contract', () => {
    const entry = CHEMISTRY_CATALOG.find((c) => c.id === 'periodic-table');
    expect(entry).toBeDefined();
    const items = itemsOf(FULL_SPREAD);
    expect(
      checkDiCatalogEntry(entry as never, periodicTablePackBase(items), items[0]),
    ).toEqual([]);
  });
});

describe('the answer-material fork (standing gate 1)', () => {
  it('find taps; name, compare and valence speak — both directions', () => {
    const items = itemsOf(FULL_SPREAD);
    for (const item of items) {
      expect(item.answerKind).toBe(answerKindFor(item.kind));
      expect(item.responseClass).toBe(responseClassFor(item.kind));
    }
    expect(byId(items, 'f1').answerKind).toBe('gesture');
    expect(byId(items, 'f1').responseClass).toBe('manipulation');
    expect(byId(items, 'n1').responseClass).toBe('short_spoken_word');
    expect(byId(items, 't1').responseClass).toBe('closed_set_choice');
    expect(byId(items, 't3').responseClass).toBe('number_word_to_20');
  });

  it('a spoken item carries the judging contract; a tap item carries the silence contract', () => {
    const items = itemsOf(FULL_SPREAD);
    const spoken = itemCue(byId(items, 'n2'));
    expect(spoken).toContain('If the answer is right');
    expect(spoken).not.toContain('answers by TAPPING');
    const tap = itemCue(byId(items, 'f1'));
    expect(tap).toContain('answers by TAPPING');
    expect(tap).toContain('Do not judge anything you hear through the microphone');
    expect(tap).not.toContain('If the answer is right');
  });
});

describe('leak rules', () => {
  it('a name item never speaks its answer', () => {
    const items = itemsOf(FULL_SPREAD);
    for (const id of ['n1', 'n2', 'n3']) {
      const item = byId(items, id);
      const span = spokenSpanOf(itemCue(item, { opening: true, howToPlay: true })).toLowerCase();
      expect(span).not.toContain(item.answerName!.toLowerCase());
    }
  });

  it('a position find never names its element or symbol — the identity is the reveal', () => {
    const items = itemsOf(FULL_SPREAD);
    const item = byId(items, 'f4'); // magnesium at group 2, period 3
    const span = spokenSpanOf(itemCue(item, { opening: true, howToPlay: true })).toLowerCase();
    expect(span).not.toContain('magnesium');
    expect(/\bmg\b/.test(span)).toBe(false);
    expect(span).toContain('group 2, period 3');
  });

  it('a valence ask never lands the count', () => {
    const items = itemsOf(FULL_SPREAD);
    const span = spokenSpanOf(itemCue(byId(items, 't3'))).toLowerCase(); // sulfur → six
    expect(span).not.toContain('six');
    expect(/\b6\b/.test(span)).toBe(false);
  });

  it('a compare ask NAMES both options — the menu is the question, not a leak', () => {
    const items = itemsOf(FULL_SPREAD);
    const span = spokenSpanOf(itemCue(byId(items, 't1'))).toLowerCase();
    expect(span).toContain('lithium');
    expect(span).toContain('potassium');
    const answers = periodicTableHarnessAnswers(byId(items, 't1'));
    expect(Array.isArray(answers.leakExemptSpan)).toBe(true);
    expect(answers.leakTokens).toEqual(['potassium']); // deeper period wins on size
  });

  it('find by name/symbol/number pushes no leak tokens (the answer is a position); by position it guards name AND symbol', () => {
    const items = itemsOf(FULL_SPREAD);
    expect(periodicTableHarnessAnswers(byId(items, 'f1')).leakTokens).toEqual([]);
    expect(periodicTableHarnessAnswers(byId(items, 'f4')).leakTokens).toEqual(['magnesium', 'mg']);
  });
});

describe('chemistry build gates — the spoken ask audits the content', () => {
  it('drops an unresolvable element', () => {
    expect(itemFromChallenge({ id: 'x', challengeType: 'identify', clueBy: 'number', targetNumber: 999 })).toBeNull();
  });

  it('drops helium valence — the taught tall-column rule (8) contradicts its real outer shell (2)', () => {
    expect(itemFromChallenge({ id: 'x', challengeType: 'trend', targetNumber: 2 })).toBeNull();
  });

  it('drops transition-metal valence — the rule the correction teaches does not cover the d-block', () => {
    expect(itemFromChallenge({ id: 'x', challengeType: 'trend', targetNumber: 26 })).toBeNull();
  });

  it('drops a cross-group compare pair', () => {
    expect(itemFromChallenge({ id: 'x', challengeType: 'trend', axis: 'size', pairNumbers: [11, 17] })).toBeNull();
  });

  it('drops the fluorine/chlorine pair — not ear-separable from a child', () => {
    expect(itemFromChallenge({ id: 'x', challengeType: 'trend', axis: 'size', pairNumbers: [9, 17] })).toBeNull();
  });

  it('drops hydrogen from a reactivity pair — it is group 1 and NOT an alkali metal', () => {
    expect(itemFromChallenge({ id: 'x', challengeType: 'trend', axis: 'reactivity', pairNumbers: [1, 19] })).toBeNull();
  });

  it('drops a position ask on a detached-row element (no honest group)', () => {
    expect(itemFromChallenge({ id: 'x', challengeType: 'explore', findBy: 'position', targetNumber: 58 })).toBeNull();
    expect(itemFromChallenge({ id: 'x', challengeType: 'identify', clueBy: 'position', targetNumber: 58 })).toBeNull();
  });
});

describe('the session invariant — an element appears in ONE item per session', () => {
  it('a later item on an already-touched element is dropped, in any role', () => {
    const items = itemsOf([
      { id: 'a', challengeType: 'identify', clueBy: 'number', targetNumber: 11 },
      { id: 'b', challengeType: 'explore', findBy: 'name', targetNumber: 11 },       // reuse as target
      { id: 'c', challengeType: 'trend', axis: 'size', pairNumbers: [11, 19] },      // reuse inside a pair
      { id: 'd', challengeType: 'explore', findBy: 'name', targetNumber: 19 },       // potassium is still free
    ]);
    expect(items.map((i) => i.id)).toEqual(['a', 'd']);
  });
});

describe('verdict wording', () => {
  it('affirmations open "Yes," and close the link; corrections open "My turn:" and re-model the route', () => {
    const items = itemsOf(FULL_SPREAD);
    const nameCue = itemCue(byId(items, 'n1')); // helium at group 18, period 1
    expect(nameCue).toContain('say exactly: "Yes, that element is Helium."');
    expect(nameCue).toContain('say exactly: "My turn: count across to group 18, then down to period 1');
    // The correction re-models the ROUTE and never names the answer.
    const correction = nameCue.split('If it is wrong, ')[1] ?? '';
    expect(correction.toLowerCase()).not.toContain('helium');
  });

  it('the tap verdict is code-computed and hands the tutor its exact line', () => {
    const items = itemsOf(FULL_SPREAD);
    const item = byId(items, 'f1'); // calcium
    const right = cellVerdictCue(item, 'Calcium');
    expect(right).toContain('that MATCHES');
    expect(right).toContain('Yes, that is Calcium');
    const wrong = cellVerdictCue(item, 'Potassium');
    expect(wrong).toContain('does NOT match');
    expect(wrong).toContain('My turn:');
  });

  it('the valence contract names the group-label signature miss where the label lies (group ≥ 13 only)', () => {
    const items = itemsOf(FULL_SPREAD);
    const sulfur = itemCue(byId(items, 't3'));
    expect(sulfur).toContain('"16" is the group number, not the outer electrons');
    const answers = periodicTableHarnessAnswers(byId(items, 't3'));
    expect(answers.correct).toBe('six');
    expect(answers.signatureWrong?.text).toBe('16');
  });
});

describe('catalog steering regressions', () => {
  const entry = CHEMISTRY_CATALOG.find((c) => c.id === 'periodic-table')!;

  it('routes as a judged DI surface with a microphone, and forbids manifest answer keys', () => {
    expect(entry.description).toContain('DIRECT INSTRUCTION');
    expect(entry.constraints).toContain('microphone');
    expect(entry.constraints).toContain('must NOT supply element lists');
  });

  it('keeps the three eval-mode identities and their betas', () => {
    const modes = (entry.evalModes ?? []).map((m: { evalMode: string; beta: number }) => [m.evalMode, m.beta]);
    expect(modes).toEqual([['explore', -1.0], ['identify', 0.5], ['trend', 2.0]]);
  });
});
