/**
 * addition-subtraction-scene's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `additionSubtractionScene.boss.ts`.
 * solve_story and Grade 1 act_out are one spoken number the tutor judges against the key. Kindergarten act_out and
 * create_story are a picture the learner builds, and build_equation a number sentence built from tiles: those have no
 * key and the activity checks them once the learner stops.
 */
import type { OffByMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/**
 * What a wrong picture or number sentence shows (`addSubMiss`, `TeachingAttempt.miss`):
 * - a picture (act_out at K, create_story): `no_change` (it ends on the story's start number), `wrong_way`
 *   (objects sent away on a joining story, or brought in on a leaving one), then the off-by misses from the answer;
 * - a number sentence: `unfinished_equation`, `false_equation` (it does not add up), `other_operation` (true, with
 *   the other sign), `other_numbers` (true, with numbers the story does not have).
 */
export type AddSubMiss = 'no_change' | 'wrong_way' | OffByMiss
  | 'unfinished_equation' | 'false_equation' | 'other_operation' | 'other_numbers';

/** What a wrong spoken story answer shows (`additionSubtractionSpokenMisses`, named by the `spoken_miss` observer). */
export type SpokenAddSubMiss = OffByMiss | 'said_start' | 'said_change' | 'said_result' | 'other_operation';

/** The activity's own check of a picture or number sentence, and the spoken items' known wrong numbers, by mode. */
export const ADD_SUB_MISSES = {
  act_out: ['no_change', 'wrong_way', 'one_short', 'one_over', 'short_by_more', 'over_by_more', 'said_start', 'said_change',
    'other_operation'],
  solve_story: ['said_start', 'said_change', 'said_result', 'other_operation', 'one_short', 'one_over', 'short_by_more',
    'over_by_more'],
  create_story: ['no_change', 'wrong_way', 'one_short', 'one_over', 'short_by_more', 'over_by_more'],
  build_equation: ['unfinished_equation', 'false_equation', 'other_operation', 'other_numbers'],
} as const satisfies Record<string, readonly (AddSubMiss | SpokenAddSubMiss)[]>;

const CHECKED = { judge: 'activity', flow: 'one-at-a-time' } as const;

export const additionSubtractionSceneCard = defineCard<AddSubMiss | SpokenAddSubMiss>({
  id: 'addition-subtraction-scene',
  grades: ['Kindergarten', 'Grade 1'],
  modes: {
    act_out: { ...SPOKEN, moves: 'at Kindergarten presses the add button to bring one in or taps one in the picture to send '
      + 'it away, and the picture is checked once the learner stops; at Grade 1 taps the ones that go away (or presses '
      + 'Show me for the ones that join), then says how many', misses: ADD_SUB_MISSES.act_out },
    build_equation: { answer: 'build', ...CHECKED, moves: 'taps number and sign tiles to build the number sentence (a tap '
      + 'on a placed tile takes it off); the tray is checked once the learner stops', misses: ADD_SUB_MISSES.build_equation },
    solve_story: { ...SPOKEN, moves: 'may tap objects in the picture to count them', misses: ADD_SUB_MISSES.solve_story },
    create_story: { answer: 'manipulate', ...CHECKED, moves: 'presses the add button to bring one in or taps one in the '
      + 'picture to send it away, until the picture matches the number sentence; the picture is checked once the learner '
      + 'stops', misses: ADD_SUB_MISSES.create_story },
  },
  words: {
    job: 'act out an adding or take-away story on a picture, build its number sentence from tiles, or make the picture '
      + 'for a given number sentence; or say the answer to a story problem',
    answer: 'their answer',
    question: 'the story and its question',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
