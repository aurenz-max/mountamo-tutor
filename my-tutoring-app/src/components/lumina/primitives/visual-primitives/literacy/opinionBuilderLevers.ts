/**
 * opinion-builder's in-item levers, declared once as a lever set (`bossLevers.ts`) over both item kinds: a writing step
 * (OREO, CER) and a question with cards for either side (build_opinion).
 *
 * Writing steps (`writingLeverSpecs`, shared with paragraph-architect): `sentence_starters` (clue: the step's starters
 * under the box), `model_step` (model: a finished sentence for the same job on another question), `fill_blank` (easier:
 * a practice step that fills one starter's blank).
 * build_opinion: `oreo_frame` (layout: labelled spaces Opinion, Reason, Example, Opinion again, no card in them),
 * `model_opinion` (model: a finished answer to "Should every class have a pet?", its parts labelled), `one_side`
 * (easier: a practice set of one side's cards plus one off-topic card).
 *
 * No answer to leak: a writing step passes any sentence that does its job, and a build passes either side and many
 * orders. The model levers are not offered on a lesson about the model's own subject.
 */
import { leverSet, type LeverSpec } from '../../../components/live-activity/bossLevers';
import { opinionBuilderCard } from './opinionBuilder.card';
import { FEWER_LEVER, FRAME_LEVER, MODEL_LEVER, modelOpinionFor, oneSideFor, type OpinionItem } from './opinionBuild';
import { WRITING_SUPPORT, writingLeverSpecs, type WritingStage } from './writingStages';

export type OpinionBuilderItem = OpinionItem | WritingStage;
export const isBuildItem = (item: OpinionBuilderItem): item is OpinionItem => 'cards' in item;
export const modeOfItem = (item: OpinionBuilderItem) => (isBuildItem(item) ? 'build_opinion' : item.kind);

const WRITING_MODES = ['oreo', 'cer'];
const BUILD = ['build_opinion'];

const buildSpecs: LeverSpec<OpinionItem, null>[] = [
  { id: FRAME_LEVER, type: 'layout', modes: BUILD,
    answers: ['opinion_not_first', 'restate_not_last', 'no_reason', 'no_example', 'out_of_order'],
    when: 'The learner leaves out a part or puts the parts in the wrong order.',
    does: 'Shows labelled spaces above the answer: Opinion, Reason, Example, Opinion again. No card is placed or named.',
    fact: 'Labelled spaces sit above the answer: Opinion, Reason, Example, Opinion again. No card is in them.' },
  { id: MODEL_LEVER, type: 'model', modes: BUILD, answers: ['other_side', 'off_topic', 'out_of_order'],
    when: 'The learner mixes the two sides, or keeps a card about something else.',
    does: 'Shows a finished OREO answer to a different question (a class pet), each part labelled, so the learner sees one '
      + 'side all the way through.',
    content: modelOpinionFor,
    fact: (model: { question: string }) => `A finished answer to "${model.question}" is shown with its parts labelled.` },
  { id: FEWER_LEVER, type: 'easier', modes: BUILD, answers: ['other_side', 'off_topic'],
    when: 'The learner cannot keep the two sides apart on a full board.',
    does: 'Opens a practice set with one side\'s cards only, plus one card about something else, ungraded. The full set '
      + 'comes back after it.',
    content: oneSideFor },
];

/**
 * The lever set. Each spec names its modes, and `declare`, `onScreen`, `simpler` and `support` read a spec only on an
 * item of its mode (`modeOf`), so a writing spec only ever sees a writing step and a build spec a question with cards.
 */
export const OPINION_LEVERS = leverSet<OpinionBuilderItem, null>({
  modeOf: modeOfItem,
  missesOf: mode => opinionBuilderCard.modes[mode]?.misses ?? [],
  answersOf: () => [],
  support: {
    tier: item => item.supportTier ?? 'medium',
    different: item => (isBuildItem(item) ? 'a finished answer to another question, its parts labelled'
      : WRITING_SUPPORT.different as string),
    own: item => (isBuildItem(item) ? 'which card goes first, in the middle or last' : WRITING_SUPPORT.own as string),
  },
  specs: [
    ...(writingLeverSpecs(WRITING_MODES) as LeverSpec<OpinionBuilderItem, null>[]),
    ...(buildSpecs as LeverSpec<OpinionBuilderItem, null>[]),
  ],
});
