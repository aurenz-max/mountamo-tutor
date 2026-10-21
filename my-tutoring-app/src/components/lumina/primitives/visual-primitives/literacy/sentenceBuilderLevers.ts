/**
 * sentence-builder's in-item levers, declared once as a lever set (`bossLevers.ts`) over both item kinds: a tile order
 * (simple, compound, complex, compound_complex) and a sentence to make from word tiles (build_sentence).
 *
 * Tile modes: `tile_roles` (marks: every tile labelled with its job), `model_sentence` (model: a finished sentence of
 * the same kind with other words), `shorter_sentence` (easier: a practice item of the first clause and the end mark).
 * build_sentence: `sentence_frame` (layout: the kind's shape above the row), `model_sentence` (model: a finished
 * sentence of the same kind about another animal), `fewer_tiles` (easier: the same ask with only one sentence's tiles).
 *
 * No clue or meaning lever, so nothing worded to leak. A model is not offered when it is one of the item's own
 * sentences.
 */
import { leverSet, type LeverSpec } from '../../../components/live-activity/bossLevers';
import { sentenceBuilderCard } from './sentenceBuilder.card';
import {
  MODEL_LEVER as ORDER_MODEL, ROLES_LEVER, SHORTER_LEVER, orderModelFor, shorterFor, type OrderItem,
} from './sentenceOrder';
import {
  FEWER_LEVER, FRAME_LEVER, MODEL_LEVER as BUILD_MODEL, fewerTilesFor, frameFor, modelFor, sentenceText, type SentenceItem,
} from './sentenceBuild';

export type SentenceBuilderItem = OrderItem | SentenceItem;
export const isBuildItem = (item: SentenceBuilderItem): item is SentenceItem => 'bank' in item;
export const modeOfItem = (item: SentenceBuilderItem): string => (isBuildItem(item) ? 'build_sentence' : item.mode ?? 'simple');

const ORDER_MODES = ['simple', 'compound', 'complex', 'compound_complex'];
const BUILD = ['build_sentence'];

/** The build model, unless it is one of the item's own sentences. */
const buildModelFor = (item: SentenceItem) => {
  const model = modelFor(item);
  return item.examples.some(ex => sentenceText(ex).toLowerCase() === model.toLowerCase()) ? null : model;
};

const orderSpecs: LeverSpec<OrderItem, null>[] = [
  { id: ROLES_LEVER, type: 'marks', modes: ORDER_MODES, answers: ['not_sense', 'end_mark_not_last'],
    when: 'The learner\'s order does not make sense, or the end mark is not last.',
    does: 'Labels every tile with its job (who or what, does what, joining word, end mark). No tile is placed.',
    fact: 'Every tile is labelled with its job (who or what, does what, to what, more about it, joining word, end mark).' },
  { id: ORDER_MODEL, type: 'model', modes: ORDER_MODES, answers: ['not_sense', 'tiles_left'],
    when: 'The learner still cannot make a sentence of this kind, or leaves tiles out.',
    does: 'Shows one finished sentence of the same kind with other words.',
    content: orderModelFor,
    fact: (model: string) => `A finished sentence of the same kind with other words is shown: ${model}` },
  { id: SHORTER_LEVER, type: 'easier', modes: ORDER_MODES, answers: ['not_sense', 'tiles_left'],
    when: 'The learner cannot order this many tiles.',
    does: 'Opens a practice item with the first part of the sentence only (up to the joining word) and the end mark, '
      + 'ungraded. The full item comes back after it.',
    content: shorterFor },
];

const buildSpecs: LeverSpec<SentenceItem, null>[] = [
  { id: FRAME_LEVER, type: 'layout', modes: BUILD,
    answers: ['no_end_mark', 'end_mark_inside', 'wrong_end_mark', 'too_short', 'not_question_start', 'question_start'],
    when: 'The learner leaves out the end mark, uses the wrong one, or starts the sentence the wrong way for its kind.',
    does: 'Shows the shape of the sentence kind above the row (an asking word ... ? for a question; who or what, does '
      + 'what, . for a telling sentence). No tile is placed.',
    fact: (_c: unknown, item: SentenceItem) => `The sentence shape is shown above the row: ${frameFor(item).join(' ')}.` },
  { id: BUILD_MODEL, type: 'model', modes: BUILD, answers: ['not_sense', 'off_topic'],
    when: 'The learner\'s sentence does not make sense or is about something else.',
    does: 'Shows one finished sentence of the same kind about a different animal, so the learner hears how one sounds.',
    content: buildModelFor,
    fact: (model: string) => `A model sentence about another animal is shown: ${model}` },
  { id: FEWER_LEVER, type: 'easier', modes: BUILD, answers: ['not_sense', 'off_topic', 'too_short'],
    when: 'The learner cannot put a sentence together from so many tiles.',
    does: 'Opens the same ask with only the tiles one sentence needs plus the end marks, ungraded. The full set comes '
      + 'back after it.',
    content: fewerTilesFor },
];

/**
 * The lever set. Each spec names its modes, and `declare`, `onScreen`, `simpler` and `support` read a spec only on an
 * item of its mode (`modeOf`), so an order spec only ever sees a tile order and a build spec a sentence to make.
 */
export const SENTENCE_LEVERS = leverSet<SentenceBuilderItem, null>({
  modeOf: modeOfItem,
  missesOf: mode => sentenceBuilderCard.modes[mode]?.misses ?? [],
  support: {
    tier: item => item.supportTier ?? 'medium',
    different: item => (isBuildItem(item) ? 'a finished sentence of the same kind about another animal'
      : 'a finished sentence of the same kind with other words'),
    own: item => (isBuildItem(item) ? 'a sentence for this ask' : 'this sentence\'s order'),
  },
  specs: [
    ...(orderSpecs as LeverSpec<SentenceBuilderItem, null>[]),
    ...(buildSpecs as LeverSpec<SentenceBuilderItem, null>[]),
  ],
});
