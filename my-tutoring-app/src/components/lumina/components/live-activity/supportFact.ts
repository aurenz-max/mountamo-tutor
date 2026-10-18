/**
 * The `support` scene fact: when the model lever comes, by the item's support tier, in one wording every family
 * shares (2026-10-18). DI's model is a DIFFERENT item, never the learner's own (user ruling 2026-10-02): easy pulls
 * the model card before the learner tries, medium only after a miss, and at hard nothing is modelled before a try.
 * What a model lever does is `LEVER_TYPE_DOCTRINE.model`; this fact only says when.
 * Pure: the server route and the catalog may import it.
 */

export type SupportTier = 'easy' | 'medium' | 'hard';

export interface SupportWords {
  /** What the model card shows: "a different fact", "different stories". */
  different: string;
  /** The model lever's id; omit when it depends on the mode ("the model lever"). */
  lever?: string;
  /** What is never said before a try at the cold tier: "this fact's answer", "this sound". */
  own: string;
}

export function supportFact(tier: SupportTier, { different, lever, own }: SupportWords): string {
  if (tier === 'hard') return `answer it cold: model nothing before the learner tries, and never say ${own}`;
  if (tier === 'medium') return `the learner tries first; after a miss, model ${different} with the ${lever ?? 'model'} lever, never this one`;
  return `before the learner tries, pull the model lever${lever ? ` (${lever})` : ''}, a card of ${different}: model it as `
    + 'your turn, then ask this one. Never model this one';
}
