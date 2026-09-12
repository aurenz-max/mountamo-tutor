import { describe, expect, it } from 'vitest';
import { shuffleIndexedChoices, stableShuffle } from './choiceOrder';

describe('Lumina choice-order policy', () => {
  it('is deterministic and does not mutate authored options', () => {
    const authored = ['right', 'near', 'far', 'other'];
    const once = stableShuffle(authored, 'lesson:item');
    expect(stableShuffle(authored, 'lesson:item')).toEqual(once);
    expect(authored).toEqual(['right', 'near', 'far', 'other']);
    expect(once.slice().sort()).toEqual(authored.slice().sort());
  });

  it('moves an index answer key with its option and aligned arrays', () => {
    const shuffled = shuffleIndexedChoices(['A', 'B', 'C', 'D'], 0, 'question-7');
    const shuffledPictures = shuffled.order.map((index) => ['a', 'b', 'c', 'd'][index]);
    expect(shuffled.options[shuffled.correctIndex]).toBe('A');
    expect(shuffledPictures[shuffled.correctIndex]).toBe('a');
  });

  it('distributes a formerly first answer across positions', () => {
    const positions = new Set(
      Array.from({ length: 32 }, (_, index) =>
        shuffleIndexedChoices(['right', 'b', 'c', 'd'], 0, `session-${index}`).correctIndex),
    );
    expect(positions.size).toBe(4);
  });
});
