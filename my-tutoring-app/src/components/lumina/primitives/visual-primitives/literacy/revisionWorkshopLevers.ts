/**
 * revision-workshop's in-item levers, declared once as a lever set (`bossLevers.ts`).
 *
 * Typed revisions (add details, word choice, combine sentences, transitions, concision):
 *   - `revision_hint` (clue): the generator's tip for this sentence (what kind of change to make). Not offered when the
 *     item has no tip, or when the tip names one of the item's own revisions.
 *   - `model_revision` (model): a solved revision of a DIFFERENT sentence for the same skill, before and after.
 *   - `edit_original` (custom): puts the original sentence in the answer box, so the learner changes it.
 * reorganize: `model_revision` (model): two other sentences put in order, before and after.
 * A model is not offered when its "before" sentence is the item's own.
 */
import { leverSet, type LeverSpec } from '../../../components/live-activity/bossLevers';
import { REVISION_MISSES_BY_MODE, revisionWorkshopCard } from './revisionWorkshop.card';
import { EDIT_LEVER, HINT_LEVER, MODEL_LEVER, MODEL_REVISION, norm, type RevisionItem } from './revisionSteps';

const TYPED_MODES = ['add_details', 'word_choice', 'combine_sentences', 'transitions', 'concision'];
const ORDER = ['reorganize'];

/** The skill's solved model, unless its "before" is this item's own sentence. */
const modelFor = (item: RevisionItem) => {
  const model = MODEL_REVISION[item.skill];
  return norm(model[0]) === norm(item.original) ? null : model;
};
/** The misses this item's mode names (a lever across the typed modes lists the misses of all of them). */
const missesOn = (item: RevisionItem) => REVISION_MISSES_BY_MODE[item.mode] ?? [];

const specs: LeverSpec<RevisionItem, null>[] = [
  { id: HINT_LEVER, type: 'clue', modes: TYPED_MODES, answers: ['unchanged', 'wrong_job', 'not_combined', 'not_shorter'],
    answersOn: missesOn,
    when: 'The learner does not know what to change, or the change does a different job.',
    does: 'Shows the revision tip for this sentence (what kind of change to make), never a revised sentence.',
    content: item => item.suggestion || null,
    fact: (tip: string) => `The revision tip is shown: ${tip}` },
  { id: MODEL_LEVER, type: 'model', modes: TYPED_MODES, answers: ['wrong_job', 'not_sense', 'not_combined', 'not_shorter'],
    answersOn: missesOn,
    when: 'The learner\'s revision does a different job or does not make sense.',
    does: 'Shows one revision of a DIFFERENT sentence for this skill, before and after.',
    content: modelFor,
    fact: ([before, after]: [string, string]) => `A revision of a different sentence is shown. Before: ${before} After: ${after}` },
  { id: EDIT_LEVER, type: 'custom', carrier: 'shown', modes: TYPED_MODES, answers: ['too_short', 'unchanged', 'not_sense'],
    why: 'It edits the learner\'s own answer box (puts the original sentence in it to change), which no stock type does: '
      + 'it is not a clue, a mark, a layout or a different item.',
    when: 'The learner cannot start from a blank box, or wrote only part of the sentence.',
    does: 'Puts the original sentence in the answer box (in place of what is typed there), so the learner changes it '
      + 'instead of retyping it.' },
  { id: MODEL_LEVER, type: 'model', modes: ORDER, answers: ['wrong_order'],
    when: 'The learner\'s order does not make sense.',
    does: 'Shows two other sentences put in order, so the learner sees order words (first, then) doing their job.',
    content: modelFor,
    fact: ([before, after]: [string, string]) => `Two other sentences are shown put in order. Before: ${before} After: ${after}` },
];

export const REVISION_LEVERS = leverSet<RevisionItem, null>({
  modeOf: item => item.mode,
  missesOf: mode => revisionWorkshopCard.modes[mode]?.misses ?? [],
  // A clue never names one of the generator's revisions of this sentence.
  answersOf: item => item.ideal,
  support: {
    tier: item => item.supportTier ?? 'medium',
    different: item => (item.skill === 'reorganize' ? 'two other sentences put in order'
      : 'a revision of a different sentence for this skill, before and after'),
    own: item => (item.skill === 'reorganize' ? 'this draft\'s order' : 'a revision of this sentence'),
  },
  specs,
});
