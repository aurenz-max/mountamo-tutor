/**
 * Shape sorter's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `shapeSorter.boss.ts`.
 * Every mode is one spoken answer the tutor judges against the key, so the boss is the spoken preset.
 */
import type { SpokenShapeMiss } from './shapeSorterDomain';
import { defineCard, OFF_BY, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

const NAME = ['near_name', 'other_shape_name'] as const;

/** What a tutor must not say on a spoken shape item, true of every shape family's naming and counting (di-shapes too). */
export const SHAPE_ITEM_RULES = 'On a counting item never say the shape name: it gives the count away. On a naming item '
  + 'never describe the shape or offer a choice of names.';

export const shapeSorterCard = defineCard<SpokenShapeMiss>({
  id: 'shape-sorter',
  grades: ['Kindergarten', 'Grade 1'],
  // Each item's known wrong answers (`shapeSorterSpokenMisses`), named by the `spoken_miss` observer.
  modes: {
    identify: { ...SPOKEN, misses: NAME },
    find_real_object: { ...SPOKEN, misses: ['said_object', ...NAME] },
    count: { ...SPOKEN, misses: ['said_shape_name', ...OFF_BY] },
    sort: { ...SPOKEN, misses: ['said_shape_name', 'other_group'] },
  },
  words: {
    job: 'name the gold-ringed shape or the shape an everyday object is drawn as, say how many sides or corners it '
      + 'has, or say which printed mat it belongs on',
    answer: 'the answer',
    question: 'the ask',
    special: 'The gold ring (or the one object shown) marks what is asked; demonstrate draws purple dashed rings, which '
      + `never change it or put a shape on a mat. ${SHAPE_ITEM_RULES}`,
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
