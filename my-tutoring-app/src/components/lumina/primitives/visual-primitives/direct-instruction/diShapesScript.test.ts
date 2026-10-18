/**
 * diShapesScript — the answer helpers the component, levers and workspace share.
 */

import { describe, expect, it } from 'vitest';
import {
  answerWordFor,
  countNoun,
  isCountingType,
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
/** A review item is the NAMING act over a wide draw. */
const REVIEW = challenge({ id: 'dish-6-square', challengeType: 'shape_review', shape: 'square', shapeWord: 'square', sides: 4, corners: 4 });

describe('diShapesScript — L1 counting identities', () => {
  it('classifies the five identities and their answer nouns', () => {
    expect(isCountingType('name_shape')).toBe(false);
    expect(isCountingType('name_real_object')).toBe(false);
    expect(isCountingType('shape_review')).toBe(false);
    expect(isCountingType('count_sides')).toBe(true);
    expect(isCountingType('count_corners')).toBe(true);
    expect(countNoun('count_sides')).toBe('sides');
    expect(countNoun('count_corners')).toBe('corners');
  });

  it('answerWordFor returns the count under counting modes and the name under naming modes', () => {
    expect(answerWordFor(SIDES)).toBe('three');
    expect(answerWordFor(CORNERS)).toBe('six');
    expect(answerWordFor(challenge())).toBe('triangle');
    expect(answerWordFor(REVIEW)).toBe('square');
  });
});
