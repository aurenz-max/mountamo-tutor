/**
 * figurative-language-finder's in-item levers, declared once as a lever set (`bossLevers.ts`). The levers follow the
 * item's step (its kind), not its mode: the four passage modes run the same find and meaning steps.
 *
 * find:    `device_guide` (legend): what each kind of figure does, under every kind's button alike.
 *          `model_figure` (model): an example sentence NOT in this passage, its figure marked and named.
 *          `mark_sentences` (marks): marks the sentences that still hold a figure; the learner still names the kind.
 * meaning: `model_figure` (model): a different figure of the same kind and what it really means.
 * make:    `device_guide` (legend): what the asked kind of figure does (the task names the kind).
 *          `model_figure` (model): one figure of that kind about a different subject.
 *          `fill_frame` (custom): puts a frame with blanks for that kind in the answer box.
 * A model is not offered when its phrase is the item's own.
 */
import { leverSet, type LeverSpec } from '../../../components/live-activity/bossLevers';
import { figurativeLanguageFinderCard } from './figurativeLanguageFinder.card';
import {
  CLUE, FRAME, FRAME_LEVER, GUIDE_LEVER, MARK_LEVER, MODEL_FIGURE, MODEL_LEVER, type FigItem, type FigType,
} from './figurativeSteps';

/** The lesson's context: the kinds on the buttons (the find model shows the first). */
export interface FigCtx { chips: readonly FigType[] }

const low = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, '').trim();
export const article = (t: FigType) => (['alliteration', 'onomatopoeia', 'imagery'].includes(t) ? '' : /^[aeiou]/.test(t) ? 'an ' : 'a ');
const by = <T>(item: FigItem, find: T, meaning: T, make: T) => (item.kind === 'find' ? find : item.kind === 'meaning' ? meaning : make);

/** The worked example a model lever shows on this item, of the item's kind; null when it is the item's own phrase. */
export function modelFor(item: FigItem, ctx: FigCtx): { type: FigType; sentence: string; phrase: string; means: string } | null {
  const type = item.kind === 'find' ? ctx.chips[0] ?? 'simile' : item.kind === 'meaning' ? item.type : item.device;
  const model = { type, ...MODEL_FIGURE[type] };
  return item.kind === 'meaning' && low(model.phrase) === low(item.phrase) ? null : model;
}

const specs: LeverSpec<FigItem, FigCtx>[] = [
  { id: GUIDE_LEVER, type: 'legend', answers: ['wrong_type', 'no_device', 'wrong_job'],
    answersOn: item => by(item, ['wrong_type', 'no_device'], [], ['wrong_job']),
    when: item => by(item, 'The learner names the wrong kind, or picks a plain sentence.', '',
      'The learner\'s sentence is not this kind of figure.'),
    does: item => by(item, 'Shows what each kind of figure of speech does, next to its button. Never marks a sentence.', '',
      `Shows what ${item.kind === 'make' ? `${article(item.device)}${item.device}` : 'the figure'} does.`),
    content: item => (item.kind === 'find' ? 'every kind' : item.kind === 'make' ? CLUE[item.device] : null),
    fact: (clue: string, item) => (item.kind === 'find' ? 'What each kind of figure of speech does is shown under its button.'
      : `What ${item.kind === 'make' ? `${article(item.device)}${item.device}` : 'the figure'} does is shown: it ${clue}.`) },
  { id: MODEL_LEVER, type: 'model', answers: ['wrong_type', 'no_device', 'unchanged', 'not_sense', 'wrong_job'],
    answersOn: item => by(item, ['wrong_type', 'no_device'], ['unchanged', 'not_sense', 'wrong_job'], ['wrong_job', 'not_sense']),
    when: item => by(item, 'The learner does not know what a figure looks like in a sentence.',
      'The learner copies the phrase or says what its words say.', 'The learner does not know how to start.'),
    does: item => (item.kind === 'find' ? 'Shows one sentence that is NOT in this passage with its figure marked and named.'
      : item.kind === 'meaning' ? `Shows a different ${item.type} with what it really means, before and after.`
        : `Shows one ${item.device} about a DIFFERENT subject.`),
    content: modelFor,
    fact: (m: NonNullable<ReturnType<typeof modelFor>>, item) => (item.kind === 'find'
      ? `An example sentence that is not in this passage is shown: "${m.sentence}" Its figure is "${m.phrase}", ${article(m.type)}${m.type}.`
      : item.kind === 'meaning' ? `A different ${m.type} is shown: "${m.sentence}" "${m.phrase}" means: ${m.means}`
        : `One ${m.type} about a different subject is shown: "${m.sentence}"`) },
  { id: MARK_LEVER, type: 'marks', answers: ['no_device'],
    when: 'The learner keeps picking sentences with no figure in them.',
    does: 'Marks the sentences that still hold a figure, so the learner only has to choose among them and name the kind.',
    content: item => (item.kind === 'find' ? true : null),
    fact: 'The sentences that still hold a figure are marked.' },
  { id: FRAME_LEVER, type: 'custom', carrier: 'shown', answers: ['too_short', 'wrong_job'],
    why: 'It edits the learner\'s own answer box (puts a frame with blanks in it to fill), which no stock type does: it is '
      + 'not a clue, a mark, a layout or a different item.',
    when: 'The learner cannot write it from a blank box.',
    does: item => `Puts a ${item.kind === 'make' ? `${item.device} ` : ''}frame with blanks in the box for the learner to fill.`,
    content: item => (item.kind === 'make' && FRAME[item.device] ? FRAME[item.device] : null) },
];

export const FIG_LEVERS = leverSet<FigItem, FigCtx>({
  missesOf: mode => figurativeLanguageFinderCard.modes[mode]?.misses ?? [],
  support: {
    tier: item => item.supportTier ?? 'medium',
    different: item => by(item, 'an example sentence that is not in this passage, its figure named',
      'a different figure of this kind and what it really means', 'one figure of this kind about a different subject'),
    own: item => by(item, 'a figure in this passage', 'what this phrase means', 'a sentence about this subject'),
  },
  specs,
});
