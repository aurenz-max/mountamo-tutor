import type {
  JudgedScriptItem,
  JudgedScriptPack,
} from '../../../hooks/judgedScriptContract';
import type { SpatialSceneChallenge } from './SpatialScene';

export type SpatialSceneDescriptionItem = SpatialSceneChallenge & JudgedScriptItem;

const relationText = (relation: SpatialSceneChallenge['correctPosition']): string =>
  relation.replaceAll('_', ' ');

export const modelSpatialDescription = (item: SpatialSceneChallenge): string =>
  `The ${item.targetObject.name} is ${relationText(item.correctPosition)} the ${item.referenceObjectName}.`;

export const buildSpatialDescriptionItems = (
  challenges: SpatialSceneChallenge[],
): SpatialSceneDescriptionItem[] => challenges
  .filter((challenge) => challenge.type === 'describe_scene')
  .map((challenge) => ({
    ...challenge,
    answerKind: 'voice' as const,
    responseClass: 'concept_statement' as const,
    action: 'describe_scene',
  }));

const ask = (item: SpatialSceneDescriptionItem): string =>
  `Look from the YOU arrow. Tell where the ${item.targetObject.name} is compared with the ${item.referenceObjectName}.`;

export const spatialSceneDescriptionPack = (
  items: SpatialSceneDescriptionItem[],
): JudgedScriptPack<SpatialSceneDescriptionItem> => ({
  primitiveType: 'spatial-scene',
  activityLine: 'Describe visible spatial relationships aloud from the fixed viewer perspective.',
  items,
  itemCue: (item, { opening }) => `[SPATIAL_DESCRIPTION_ITEM] Say exactly: "${opening ? 'Let\u2019s describe where things are. ' : ''}${ask(item)}"
Then wait for the child to speak. Do not name or print the relation before the attempt.
JUDGE ONLY the child\u2019s next spoken description of the pictured relationship.
The fixed viewpoint is the YOU arrow at the bottom of the scene. The target is ${item.targetObject.name}; the reference object is ${item.referenceObjectName}.
ACCEPT a natural sentence or short phrase only when it identifies BOTH the intended relation "${relationText(item.correctPosition)}" AND the reference object ${item.referenceObjectName}. The child may also name the target, but do not require an article or the exact model wording.
For "in front of", the target must be nearer the YOU arrow than the reference. For "behind", it must be farther from the YOU arrow. For left/right, judge from the child\u2019s visible viewpoint, never from an object\u2019s imagined facing direction.
REFUSE the opposite relation, a response that names only a direction with no reference object, a response about a different pair of objects, or a vague answer such as "over there".
If correct, begin with "Yes." Briefly restate: "${modelSpatialDescription(item)}"
If wrong, begin with "My turn." Point out the YOU arrow, model "${modelSpatialDescription(item)}", then ask the child to try once more.`,
  moveOnCue: (item, next) => `[SPATIAL_DESCRIPTION_MOVE_ON] Say exactly: "${modelSpatialDescription(item)} ${next ? ask(next) : 'We can keep looking for position words.'}"`,
  completeCue: () => '[SPATIAL_DESCRIPTION_COMPLETE] Say exactly: "You used position words to make the scene clear."',
  pronounceCue: (item) => `[SPATIAL_DESCRIPTION_HEAR] Say exactly: "${ask(item)}"`,
  contextFor: (item) => ({
    challengeType: item.type,
    instruction: item.instruction,
    targetObject: item.targetObject.name,
    referenceObjectName: item.referenceObjectName ?? '',
    correctPosition: item.correctPosition,
    scenePerspective: item.scenePerspective ?? 'viewer_depth',
  }),
  maxCorrections: 2,
  passThreshold: 60,
  statusLines: {
    idle: 'Tap the microphone, then describe the scene.',
    ready: (item) => `Tell where the ${item.targetObject.name} is.`,
    listening: 'Listening for your description\u2026',
    judging: 'Checking the relation and reference object\u2026',
    retry: () => 'Look from the YOU arrow and try again.',
    noVerdict: () => 'Say the relation and the object it compares with.',
    affirmedNext: 'That description matches the scene.',
    affirmedLast: 'That description matches the scene.',
    moveOn: 'Here is the relation shown in the scene.',
    retake: 'Try this scene once more.',
    dead: 'The tutor went quiet \u2014 tap the microphone to reconnect.',
    done: 'You described the scene clearly.',
  },
  diagnosisObservation: (item, { lastHeard }) => ({
    challenge: ask(item),
    expected: modelSpatialDescription(item),
    observed: lastHeard ?? '(Speech was not transcribed.)',
  }),
});
