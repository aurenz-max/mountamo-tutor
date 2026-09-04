import { describe, expect, it } from 'vitest';
import {
  findRepeatedConsecutiveAsks,
  spokenSpansOf,
  validateJudgedScriptPack,
  type JudgedScriptPack,
} from '../../../hooks/judgedScriptContract';
import {
  completeCue,
  contextFor,
  itemCue,
  moveOnCue,
  retryPrompt,
  type DiDiceRollChallenge,
  type DiDiceRollSupportTier,
} from './diDiceRollScript';

const items: DiDiceRollChallenge[] = [
  {
    id: 'count-1',
    challengeType: 'count_pips',
    action: 'count_pips',
    answerKind: 'voice',
    responseClass: 'number_word_to_20',
    sides: 6,
    value: 4,
    spokenAnswer: 'four',
    asrAliases: ['four', '4'],
  },
  {
    id: 'compare-1',
    challengeType: 'compare_dice',
    action: 'compare_dice',
    answerKind: 'voice',
    responseClass: 'short_spoken_word',
    sides: 6,
    value: 5,
    secondValue: 2,
    comparison: 'left',
    spokenAnswer: 'left',
    asrAliases: ['left', 'the left one', 'the left die'],
  },
  {
    id: 'sum-1',
    challengeType: 'sum_two_dice',
    action: 'sum_two_dice',
    answerKind: 'voice',
    responseClass: 'number_word_to_20',
    sides: 6,
    value: 3,
    secondValue: 5,
    total: 8,
    spokenAnswer: 'eight',
    asrAliases: ['eight', '8'],
  },
];

const pack: JudgedScriptPack<DiDiceRollChallenge> = {
  primitiveType: 'di-dice-roll',
  activityLine: 'live direct instruction dice counting, comparing, and adding',
  items,
  itemCue,
  moveOnCue,
  completeCue,
  contextFor,
};

const atTier = (
  item: DiDiceRollChallenge,
  supportTier: DiDiceRollSupportTier,
): DiDiceRollChallenge => ({ ...item, supportTier });

describe('di-dice-roll script contract', () => {
  it('passes the judged-pack gates for a mixed task sequence', () => {
    expect(validateJudgedScriptPack(pack)).toEqual([]);
    expect(findRepeatedConsecutiveAsks(pack)).toEqual([]);
  });

  it.each([
    ['count_pips', items[0], /four|4/i, 'Tap the die'],
    ['compare_dice', items[1], /left has more|5|2/i, 'Tap both dice'],
    ['sum_two_dice', items[2], /eight|8|three and five|3|5/i, 'Tap both dice'],
  ])('keeps the %s answer out of the spoken ask', (_mode, item, answer, opening) => {
    const spoken = spokenSpansOf(itemCue(item, { opening: true, howToPlay: true }));
    expect(spoken[0]).not.toMatch(answer);
    expect(spoken[0]).toContain(opening);
  });

  it('keeps runtime context action-side only for every identity', () => {
    const [counted, compared, summed] = items.map((item) => JSON.stringify(contextFor(item)));
    expect(counted).toContain('count_pips');
    expect(counted).not.toMatch(/\bfour\b|\b4\b/i);
    expect(compared).toContain('compare_dice');
    expect(compared).not.toMatch(/left has more|\b5\b|\b2\b/i);
    expect(summed).toContain('sum_two_dice');
    expect(summed).not.toMatch(/\beight\b|\b8\b|three and five|\b3\b|\b5\b/i);
  });

  it('threads the active support tier through answer-safe runtime context', () => {
    const context = contextFor(atTier(items[0], 'hard'));
    expect(context.supportTier).toBe('hard');
    expect(JSON.stringify(context)).not.toMatch(/\bfour\b|\b4\b/i);
  });

  it.each([
    ['count_pips', items[0], 'Touch each dot as you count.', 'Count the dots carefully.'],
    ['compare_dice', items[1], 'Match the dots across the dice one by one.', 'Compare both dot patterns carefully.'],
    ['sum_two_dice', items[2], 'Count the left die, then count on with the right die.', 'Count all the dots carefully.'],
  ])('withdraws the retry strategy across %s support tiers', (_mode, item, easyLine, mediumLine) => {
    const easy = itemCue(atTier(item, 'easy'), { opening: false, howToPlay: false });
    const medium = itemCue(atTier(item, 'medium'), { opening: false, howToPlay: false });
    const hard = itemCue(atTier(item, 'hard'), { opening: false, howToPlay: false });

    expect(easy).toContain(easyLine);
    expect(medium).toContain(mediumLine);
    expect(medium).not.toContain(easyLine);
    expect(hard).not.toContain(easyLine);
    expect(hard).not.toContain(mediumLine);
    expect(hard).toContain('My turn:');
    expect(hard).toContain(item.spokenAnswer);
    expect(hard).toContain('Your turn.');
  });

  it.each([
    ['count_pips', items[0], 'Touch each dot once as you count', 'Count the dots carefully'],
    ['compare_dice', items[1], 'Count each die, match the amounts', 'Compare both dot patterns carefully'],
    ['sum_two_dice', items[2], 'Count the left die, then count on', 'Count all the dots carefully'],
  ])('keeps the visible %s retry prompt tiered and answer-free', (_mode, item, easyLine, mediumLine) => {
    const easy = retryPrompt(atTier(item, 'easy'));
    const medium = retryPrompt(atTier(item, 'medium'));
    const hard = retryPrompt(atTier(item, 'hard'));

    expect(easy).toContain(easyLine);
    expect(medium).toContain(mediumLine);
    expect(hard).toBe('Try these dice again.');
    for (const prompt of [easy, medium, hard]) {
      expect(prompt).not.toContain(item.spokenAnswer);
      if (item.challengeType === 'compare_dice') {
        expect(prompt).not.toMatch(/\b(?:left|right|same)\b/i);
      }
    }
  });

  it.each([
    ['count_pips', items[0], 'this die shows four', 'Your turn. How many dots?'],
    ['compare_dice', items[1], 'left has more', 'Which has more: left, right, or same?'],
    ['sum_two_dice', items[2], 'three and five make eight', 'How many dots altogether?'],
  ])('re-models and re-elicits after an incorrect %s response', (_mode, item, model, ask) => {
    const cue = itemCue(item, { opening: false, howToPlay: false });
    expect(cue).toContain('My turn: not ⟨what they said⟩');
    expect(cue).toContain(model);
    expect(cue).toContain(ask);
  });

  it('announces the next task identity without exposing its answer', () => {
    const cue = moveOnCue(items[0], items[1]);
    const spoken = spokenSpansOf(cue);
    expect(spoken[0]).toContain('roll the next one');
    expect(spoken[0]).toContain('left, right, or same');
    expect(spoken[0]).not.toMatch(/left has more|5|2/i);
  });
});
