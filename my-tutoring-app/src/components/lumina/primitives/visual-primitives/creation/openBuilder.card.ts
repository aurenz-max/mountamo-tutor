/**
 * open-builder's card: how its mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `openBuilder.boss.ts`.
 * One mode: the learner builds freely with blocks to meet a goal and presses "I'm done!"; a building buddy (the vision
 * judge) reads a picture of the board. One project at a time, built, activity-judged: a bespoke boss.
 */
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What the buddy's not-met verdict names (`OpenBuilderVerdict.miss`, `TeachingAttempt.miss`): `missing_part` a part
 * the goal names is not in the build; `does_not_work` the build has the parts but does not do the job.
 */
export type OpenBuilderMiss = 'missing_part' | 'does_not_work';
export const OPEN_BUILDER_MISSES: readonly OpenBuilderMiss[] = ['missing_part', 'does_not_work'];

export const openBuilderCard = defineCard<OpenBuilderMiss>({
  id: 'open-builder',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  // The mode publishes levers (`openBuilderLevers.ts`); every miss is answered by a help lever on every project.
  modes: {
    build_to_goal: { answer: 'build', judge: 'activity', flow: 'one-at-a-time', misses: OPEN_BUILDER_MISSES,
      moves: 'picks a block shape and a color, taps a column of the board to drop the block (Undo and Start over take '
        + 'blocks back), then presses I\'m done! for the building buddy to look at a picture of the board' },
  },
  words: {
    job: 'build something with blocks that does the job a project\'s goal names, in a scene; many different builds can meet it',
    answer: 'the build they make',
    question: 'the project\'s goal and the scenery on the board',
  },
  levers: true,
});
