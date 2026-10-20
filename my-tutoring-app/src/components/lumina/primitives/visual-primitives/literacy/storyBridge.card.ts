/**
 * Story bridge's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `storyBridge.boss.ts`.
 * Two read-aloud stories stay on screen as pictures. Match characters, match settings, the picture Venn diagram and
 * event sequences are one tap each, checked by the activity. Say alike, say different and compare big ideas are one
 * spoken comparison each, judged by the tutor on meaning against the key.
 */
import { defineCard, SPOKEN, SPOKEN_AUDIO, TAP_ONE } from '../../../components/live-activity/boss';

/**
 * What a wrong answer shows, by mode (handoff 20).
 * Taps (`storyBridgeMiss`): match_character `same_look` (the tapped friend has the first friend's picture),
 * `other_character`; match_setting `same_for_different`, `different_for_same`; venn_place `both_for_one` (a one-story
 * detail put in the middle), `one_for_both` (a shared detail put on one side), `other_side`; sequence_two
 * `earlier_event`, `later_event`.
 * Spoken (`storyBridgeSpokenMisses`): `one_friend_only` (tells about one friend, no link to the other); say_alike
 * `told_difference`, say_different `told_likeness`; main_idea_compare `one_story_only`.
 */
export const STORY_BRIDGE_MISSES = {
  match_character: ['same_look', 'other_character'],
  match_setting: ['same_for_different', 'different_for_same'],
  venn_place: ['both_for_one', 'one_for_both', 'other_side'],
  sequence_two: ['earlier_event', 'later_event'],
  say_alike: ['one_friend_only', 'told_difference'],
  say_different: ['one_friend_only', 'told_likeness'],
  main_idea_compare: ['one_story_only'],
} as const;
type Misses = typeof STORY_BRIDGE_MISSES;
export type StoryBridgeMiss = Misses['match_character' | 'match_setting' | 'venn_place' | 'sequence_two'][number];
export type SpokenStoryBridgeMiss = Misses['say_alike' | 'say_different' | 'main_idea_compare'][number];

const HEAR = 'may tap the replay button to hear both stories again';
const tap = (mode: 'match_character' | 'match_setting' | 'venn_place' | 'sequence_two') =>
  ({ ...TAP_ONE, moves: HEAR, misses: STORY_BRIDGE_MISSES[mode] });
const said = (mode: 'say_alike' | 'say_different' | 'main_idea_compare') =>
  ({ ...SPOKEN, moves: HEAR, misses: STORY_BRIDGE_MISSES[mode] });

export const storyBridgeCard = defineCard<StoryBridgeMiss | SpokenStoryBridgeMiss>({
  id: 'story-bridge',
  grades: ['Kindergarten', 'Grade 1'],
  modes: {
    match_character: tap('match_character'),
    match_setting: tap('match_setting'),
    venn_place: tap('venn_place'),
    say_alike: said('say_alike'),
    sequence_two: tap('sequence_two'),
    say_different: said('say_different'),
    main_idea_compare: said('main_idea_compare'),
  },
  words: {
    job: 'compare two read-aloud stories: tap the matching friend, place, circle or event, or say one way two friends '
      + 'or the two big ideas are alike or different',
    answer: 'the comparison',
    question: 'both stories and the ask',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
