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
  completeCue,
  contrastCorrectionLine,
  correctionLine,
  guideLine,
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

describe('diShapesScript — sentinel collision scan (engine DI_SENTINELS)', () => {
  it('no cue sentence outside the verdict branches opens with a sentinel', () => {
    for (const it_ of [challenge(), OVAL, RHOMBUS]) {
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
