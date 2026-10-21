/**
 * paragraph-architect's in-item levers, declared once as a lever set (`bossLevers.ts`) over both item kinds: a writing
 * step (informational, narrative, opinion) and a paragraph of sentence cards (build_paragraph).
 *
 * Writing steps (`writingLeverSpecs`, shared with opinion-builder): `sentence_starters` (clue: the step's starters under
 * the box), `model_step` (model: a finished sentence for the same job on another topic), `fill_blank` (easier: a
 * practice step that fills one starter's blank).
 * build_paragraph: `paragraph_frame` (layout: labelled spaces Topic sentence, Fact, Fact, Closing sentence, no card in
 * them), `model_paragraph` (model: a solved paragraph about frogs, its parts labelled), `fewer_cards` (easier: a practice
 * set of five cards).
 *
 * No answer to leak: a writing step passes any sentence that does its job, and a build passes many orders. The model
 * levers are not offered on a lesson about the model's own subject.
 */
import { leverSet, type LeverSpec } from '../../../components/live-activity/bossLevers';
import { paragraphArchitectCard } from './paragraphArchitect.card';
import {
  FEWER_LEVER, FRAME_LEVER, MODEL_LEVER, fewerCardsFor, modelParagraphFor, type ParagraphItem,
} from './paragraphBuild';
import { WRITING_SUPPORT, writingLeverSpecs, type WritingStage } from './writingStages';

export type ParagraphArchitectItem = ParagraphItem | WritingStage;
export const isBuildItem = (item: ParagraphArchitectItem): item is ParagraphItem => 'cards' in item;
export const modeOfItem = (item: ParagraphArchitectItem) => (isBuildItem(item) ? 'build_paragraph' : item.kind);

const WRITING_MODES = ['informational', 'narrative', 'opinion'];
const BUILD = ['build_paragraph'];

const buildSpecs: LeverSpec<ParagraphItem, null>[] = [
  { id: FRAME_LEVER, type: 'layout', modes: BUILD, answers: ['topic_not_first', 'closing_not_last', 'too_few_details'],
    when: 'The learner puts the topic sentence or the closing in the wrong place, or uses fewer than two facts.',
    does: 'Shows labelled spaces above the paragraph: Topic sentence, Fact, Fact, Closing sentence. No card is placed or named.',
    fact: 'Labelled spaces sit above the paragraph: Topic sentence, Fact, Fact, Closing sentence. No card is in them.' },
  { id: MODEL_LEVER, type: 'model', modes: BUILD, answers: ['off_topic_detail', 'topic_not_first', 'closing_not_last'],
    when: 'The learner keeps a fact about something else, or the order is still not right after the frame.',
    does: 'Shows a solved paragraph about frogs (not this topic) with its parts labelled, so the learner sees what belongs.',
    content: modelParagraphFor,
    fact: (model: { topic: string }) => `A solved paragraph about ${model.topic} is shown with its parts labelled.` },
  { id: FEWER_LEVER, type: 'easier', modes: BUILD, answers: ['off_topic_detail', 'too_few_details'],
    when: 'The learner cannot sort the cards on a board of eight.',
    does: 'Opens a practice set of five cards (one topic sentence, two facts, one fact about something else, one closing), '
      + 'ungraded. The full set comes back after it.',
    content: fewerCardsFor },
];

/**
 * The lever set. Each spec names its modes, and `declare`, `onScreen`, `simpler` and `support` read a spec only on an
 * item of its mode (`modeOf`), so a writing spec only ever sees a writing step and a build spec a paragraph.
 */
export const PARAGRAPH_LEVERS = leverSet<ParagraphArchitectItem, null>({
  modeOf: modeOfItem,
  missesOf: mode => paragraphArchitectCard.modes[mode]?.misses ?? [],
  answersOf: () => [],
  support: {
    tier: item => item.supportTier ?? 'medium',
    different: item => (isBuildItem(item) ? 'a solved paragraph about another topic, its parts labelled'
      : WRITING_SUPPORT.different as string),
    own: item => (isBuildItem(item) ? 'which card goes first, last or in the middle' : WRITING_SUPPORT.own as string),
  },
  specs: [
    ...(writingLeverSpecs(WRITING_MODES) as LeverSpec<ParagraphArchitectItem, null>[]),
    ...(buildSpecs as LeverSpec<ParagraphArchitectItem, null>[]),
  ],
});
