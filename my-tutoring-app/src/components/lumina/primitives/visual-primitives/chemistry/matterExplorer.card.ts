/**
 * matter-explorer's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `matterExplorer.boss.ts`.
 * Every item is one spoken answer computed from the object, judged by the tutor against the key, so the boss is the
 * spoken preset.
 */
import type { SpokenMatterMiss } from './matterExplorerDomain';
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

export const matterExplorerCard = defineCard<SpokenMatterMiss>({
  id: 'matter-explorer',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2'],
  // Each item's known wrong answers (`matterSpokenMisses`), named by the `spoken_miss` observer.
  modes: {
    sort: { ...SPOKEN, misses: ['other_state', 'said_object_back'] },
    property: { ...SPOKEN, misses: ['other_shape', 'state_word'] },
    change: { ...SPOKEN, misses: ['other_way', 'said_change_back', 'state_word'] },
    mystery: { ...SPOKEN, misses: ['other_state'] },
  },
  words: {
    job: 'say whether an everyday thing is a solid, a liquid or a gas, what it does when it goes into a cup, or whether '
      + 'a change that happened to it can go back the way it was; on mystery, say the state of a secret thing from its clues',
    answer: 'the spoken answer',
    question: 'the ask, the change line and the clues',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
