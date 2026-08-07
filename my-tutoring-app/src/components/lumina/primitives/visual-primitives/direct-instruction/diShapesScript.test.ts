/**
 * diShapesScript — cue composition + sentinel discipline for DI pack #5.
 *
 * The engine reads verdicts from sentence OPENERS ("Yes" / "My turn"), so the
 * one structural invariant every DI script must hold is that NO other line
 * opens a sentence with either sentinel. The collision scan below runs over
 * every cue the pack can emit for every shape in the menu — the same check
 * the family's other scripts pin.
 */

import { describe, expect, it } from 'vitest';
import { DI_SENTINELS, scanForSentinel } from '../../../hooks/judgedLoopModel';
import {
  answerWordFor,
  completeCue,
  contrastCorrectionLine,
  correctionLine,
  countNoun,
  guideLine,
  isCountingType,
  itemCue,
  judgingContract,
  modelLine,
  moveOnCue,
  testLine,
  verifyLine,
  type DiShapesChallenge,
} from './diShapesScript';

const challenge = (over: Partial<DiShapesChallenge> = {}): DiShapesChallenge => ({
  id: 'dish-1-triangle',
  challengeType: 'name_shape',
  shape: 'triangle',
  shapeWord: 'triangle',
  article: 'a',
  sides: 3,
  corners: 3,
  rotationDeg: 12,
  asrAliases: ['triangle'],
  ...over,
});

const OVAL = challenge({
  id: 'dish-2-oval', shape: 'oval', shapeWord: 'oval', article: 'an',
  sides: null, corners: null, rotationDeg: 0,
});
const RHOMBUS = challenge({
  id: 'dish-3-rhombus', shape: 'rhombus', shapeWord: 'rhombus', article: 'a',
  sides: 4, corners: 4, rotationDeg: 0, spokenAlternates: ['diamond'],
});

/** L1 counting items — the generator stamps countNumeral/countWord in code. */
const SIDES = challenge({
  id: 'dish-4-triangle', challengeType: 'count_sides',
  countNumeral: 3, countWord: 'three', asrAliases: ['three', '3'],
});
const CORNERS = challenge({
  id: 'dish-5-hexagon', challengeType: 'count_corners',
  shape: 'hexagon', shapeWord: 'hexagon', sides: 6, corners: 6, rotationDeg: -8,
  countNumeral: 6, countWord: 'six', asrAliases: ['six', '6'],
});
/** A review item is the NAMING act over a wide draw — same lines as name_shape. */
const REVIEW = challenge({ id: 'dish-6-square', challengeType: 'shape_review', shape: 'square', shapeWord: 'square', sides: 4, corners: 4 });

describe('diShapesScript — cue lines', () => {
  it('composes the DISTAR sequence with the right article', () => {
    const it_ = challenge();
    expect(modelLine(it_)).toBe('Listen: this shape is a triangle.');
    expect(guideLine(it_)).toBe('Together: this shape is a triangle.');
    expect(testLine(it_)).toBe('Your turn. What shape is this?');
    expect(modelLine(OVAL)).toBe('Listen: this shape is an oval.');
  });

  it('verify opens "Yes" and both corrections open "My turn" (engine sentinels)', () => {
    const it_ = challenge();
    expect(verifyLine(it_).startsWith('Yes')).toBe(true);
    expect(correctionLine(it_).startsWith('My turn')).toBe(true);
    expect(contrastCorrectionLine(it_).startsWith('My turn')).toBe(true);
    // Both corrections re-model then re-elicit (standing gate 3).
    expect(correctionLine(it_)).toContain('a triangle');
    expect(correctionLine(it_)).toContain('What shape is this?');
    expect(contrastCorrectionLine(it_)).toContain('⟨what they said⟩');
  });

  it('states a judged alternate ("diamond" for rhombus) inside the contract', () => {
    expect(judgingContract(RHOMBUS)).toContain('"diamond"');
    // …and only there: a shape without alternates has no such clause.
    expect(judgingContract(challenge())).not.toContain('also call');
  });

  it('never leaks the shape name into the ask itself', () => {
    // The test line is the one sentence spoken WITHOUT the answer in it.
    expect(testLine(challenge())).not.toContain('triangle');
  });
});

describe('diShapesScript — L1 counting identities', () => {
  it('classifies the four identities and their answer nouns', () => {
    expect(isCountingType('name_shape')).toBe(false);
    expect(isCountingType('shape_review')).toBe(false);
    expect(isCountingType('count_sides')).toBe(true);
    expect(isCountingType('count_corners')).toBe(true);
    expect(countNoun('count_sides')).toBe('sides');
    expect(countNoun('count_corners')).toBe('corners');
  });

  it('composes the DISTAR sequence over the COUNT, not the name', () => {
    expect(modelLine(SIDES)).toBe('Listen: this shape has three sides.');
    expect(guideLine(SIDES)).toBe('Together: this shape has three sides.');
    expect(testLine(SIDES)).toBe('Your turn. How many sides does this shape have?');
    expect(verifyLine(SIDES)).toBe('Yes, this shape has three sides.');
    expect(modelLine(CORNERS)).toBe('Listen: this shape has six corners.');
    expect(testLine(CORNERS)).toBe('Your turn. How many corners does this shape have?');
  });

  it('the ask never contains the answer, and under a counting mode the shape NAME is withheld too', () => {
    // The name hands the count to any child who knows it (triangle → three),
    // so it must not appear anywhere in a counting item's cue.
    const cue = itemCue(SIDES);
    expect(testLine(SIDES)).not.toContain('three');
    expect(cue).not.toContain('triangle');
    expect(itemCue(CORNERS)).not.toContain('hexagon');
  });

  it('answerWordFor returns the count under counting modes and the name under naming modes', () => {
    expect(answerWordFor(SIDES)).toBe('three');
    expect(answerWordFor(CORNERS)).toBe('six');
    expect(answerWordFor(challenge())).toBe('triangle');
    expect(answerWordFor(REVIEW)).toBe('square');
  });

  it('shape_review reuses the NAMING lines byte-for-byte (same act, wider pool)', () => {
    const asNaming = { ...REVIEW, challengeType: 'name_shape' as const };
    expect(modelLine(REVIEW)).toBe(modelLine(asNaming));
    expect(testLine(REVIEW)).toBe(testLine(asNaming));
    expect(judgingContract(REVIEW)).toBe(judgingContract(asNaming));
  });

  it('the counting contract accepts counting-aloud and stays strict on a different number', () => {
    const contract = judgingContract(SIDES);
    expect(contract).toContain('counting aloud and ending on three');
    expect(contract).toContain('A DIFFERENT number');
    expect(contract).toContain('judge only the number they finish on');
    // Both corrections re-model then re-elicit (standing gate 3).
    expect(correctionLine(SIDES).startsWith('My turn')).toBe(true);
    expect(contrastCorrectionLine(SIDES).startsWith('My turn')).toBe(true);
    expect(correctionLine(SIDES)).toContain('How many sides does this shape have?');
    expect(contrastCorrectionLine(SIDES)).toContain('⟨what they said⟩');
    // A count has no synonym — the naming-only alternates clause must not leak in.
    expect(contract).not.toContain('also call this shape');
  });
});

describe('diShapesScript — sentinel collision scan (engine DI_SENTINELS)', () => {
  it('no cue sentence outside the verdict branches opens with a sentinel', () => {
    // Every challenge type the pack can emit — the L1 counting contract is a
    // whole second body of prose and gets the same scan.
    for (const it_ of [challenge(), OVAL, RHOMBUS, SIDES, CORNERS, REVIEW]) {
      // Everything the pack sends as CUES (the tutor speaks these verbatim).
      // The judging contract QUOTES the verdict lines — strip them, then scan
      // the rest sentence by sentence exactly as the engine would.
      const cueTexts = [
        itemCue(it_, true),
        itemCue(it_),
        moveOnCue(it_, RHOMBUS),
        moveOnCue(it_),
        completeCue(),
      ];
      for (const cue of cueTexts) {
        const withoutQuoted = cue
          .split(verifyLine(it_)).join(' ')
          .split(correctionLine(it_)).join(' ')
          .split(contrastCorrectionLine(it_)).join(' ')
          .split(verifyLine(RHOMBUS)).join(' ')
          .split(correctionLine(RHOMBUS)).join(' ')
          .split(contrastCorrectionLine(RHOMBUS)).join(' ');
        for (const sentence of withoutQuoted.split(/[.!?]+/)) {
          expect(
            scanForSentinel(`${sentence.trim()}.`, DI_SENTINELS),
            `collision in: "${sentence.trim()}"`,
          ).not.toBe('affirmed');
          // "My turn" may legitimately survive quoting-edge splits only if the
          // quoted lines above were not fully stripped — a corrected scan here
          // means a NEW collision was authored.
          expect(
            scanForSentinel(`${sentence.trim()}.`, DI_SENTINELS),
            `collision in: "${sentence.trim()}"`,
          ).not.toBe('corrected');
        }
      }
    }
  });
});
