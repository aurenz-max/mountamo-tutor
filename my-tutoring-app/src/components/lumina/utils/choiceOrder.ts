/**
 * Shared answer-position policy for Lumina choice surfaces.
 *
 * Choice order must not trust generator order: models, fallbacks, and repair
 * passes commonly build `[correct, ...distractors]`. The shuffle is seeded so
 * React re-renders never move a learner's targets while they are answering.
 */
export function stableShuffle<T>(items: readonly T[], seed: string): T[] {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    state ^= seed.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }

  const random = () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  const shuffled = items.slice();
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export interface ShuffledIndexedChoices<T> {
  options: T[];
  correctIndex: number;
  /** New-position -> original-position mapping for aligned picture arrays. */
  order: number[];
}

/** Shuffle index-keyed options and carry their answer key with them. */
export function shuffleIndexedChoices<T>(
  options: readonly T[],
  correctIndex: number,
  seed: string,
): ShuffledIndexedChoices<T> {
  if (options.length < 2 || correctIndex < 0 || correctIndex >= options.length) {
    return { options: options.slice(), correctIndex, order: options.map((_, index) => index) };
  }
  const order = stableShuffle(options.map((_, index) => index), seed);
  return {
    options: order.map((index) => options[index]),
    correctIndex: order.indexOf(correctIndex),
    order,
  };
}
