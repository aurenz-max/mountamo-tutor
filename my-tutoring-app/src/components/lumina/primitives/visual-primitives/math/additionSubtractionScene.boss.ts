/**
 * addition-subtraction-scene's boss, on the spoken preset (`components/live-activity/boss.ts`): solve-story and
 * Grade 1 act-out are a spoken number the tutor judges against the key; a picture (Kindergarten act-out,
 * create-story) or a number sentence (build-equation) has no key, the activity checks it, and it plays through
 * `show`. The card is `additionSubtractionScene.card.ts`; this file holds the content check, the items, the ask and
 * key, the levers and the harness play.
 */
import type { AdditionSubtractionSceneData } from './AdditionSubtractionScene';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss } from '../../../components/live-activity/boss';
import { validateChallengePool } from '../../../components/live-activity/adapters/adapterContract';
import { additionSubtractionSceneCard, type AddSubMiss, type SpokenAddSubMiss } from './additionSubtractionScene.card';
import { ADD_SUB_LEVERS, practiceParent, smallerStory } from './additionSubtractionSceneLevers';
import { addSubHarnessAnswers, itemsFromChallenges, type AddSubSceneItem } from './additionSubtractionSceneDomain';
import {
  addSubAsk, additionSubtractionGiven, additionSubtractionKey, additionSubtractionSpokenMisses,
} from './additionSubtractionSceneWorkspace';

/** The session's items, built through the family's own gate (an unaskable story is dropped). */
export const addSubItems = (d: Pick<AdditionSubtractionSceneData, 'challenges' | 'gradeBand'>): AddSubSceneItem[] =>
  itemsFromChallenges(d.challenges ?? [], { band: d.gradeBand ?? 'K' });

/** Reject a story the lesson would drop: inconsistent arithmetic, an answer of zero or past twenty, or a story that
 *  states the number the child must find. */
export function validateAdditionSubtractionSceneData(value: unknown): AdditionSubtractionSceneData {
  const band = (value as AdditionSubtractionSceneData)?.gradeBand ?? 'K';
  return validateChallengePool<AdditionSubtractionSceneData>(value, c => !!c && itemsFromChallenges([c], { band }).length === 1,
    { pool: 'Generated addition-subtraction scene has invalid lesson content.', item: 'A story in this scene cannot be asked.' });
}

export const additionSubtractionSceneBoss = spokenBoss<AdditionSubtractionSceneData, AddSubSceneItem, AddSubMiss | SpokenAddSubMiss>({
  card: additionSubtractionSceneCard,
  validate: validateAdditionSubtractionSceneData,
  items: addSubItems,
  levers: ADD_SUB_LEVERS,
  speech: {
    ask: addSubAsk,
    // A picture or a number sentence has no key: the activity checks it.
    key: additionSubtractionKey,
    given: additionSubtractionGiven,
    misses: additionSubtractionSpokenMisses,
    say: item => { const { correct, plainWrong } = addSubHarnessAnswers(item); return { correct, plainWrong }; },
    // Tiles pressed for a number sentence, or the picture brought to a count (the add button brings one in, a tap
    // on the last object sends it away). Hands turns commit on stillness.
    show: (right, item, ctx) => {
      const answers = addSubHarnessAnswers(item);
      if (answers.tapped) return (right ? answers.tapped.correct : answers.tapped.wrong).split(' ')
        .map((tile): DriverInput => ({ type: 'choose', label: `Add tile ${tile}` }));
      const placed = answers.placed!;
      const now = Number(ctx.demand?.inPicture ?? 0);
      // A wrong picture must be a move: when one short is where the picture starts, go one past instead.
      const target = right ? placed.correct : placed.wrong !== now ? placed.wrong : placed.correct + 1;
      return target >= now
        ? Array.from({ length: target - now }, (): DriverInput => ({ type: 'choose', label: `Add one ${item.objectType}` }))
        : Array.from({ length: now - target }, (_, i): DriverInput => ({ type: 'touch', target: `object-${now - 1 - i}` }));
    },
  },
  drive: {
    component: 'primitives/visual-primitives/math/AdditionSubtractionScene.tsx',
    instanceId: 'story',
    defaults: { grade: 'Kindergarten', mode: 'act_out', topic: 'Ducks joining and leaving a pond' },
    mounted: '[data-pip-object="scene"]',
    // The session item, or a practice story (`~simpler`) rebuilt from its parent with the same builder.
    current: ctx => {
      const d = ctx.data as AdditionSubtractionSceneData;
      const all = addSubItems(d);
      const parent = practiceParent(ctx.itemId, all);
      return parent ? smallerStory(parent, { items: all, maxNumber: d.maxNumber ?? 10 }) ?? undefined
        : all.find(i => i.id === ctx.itemId);
    },
  },
});
