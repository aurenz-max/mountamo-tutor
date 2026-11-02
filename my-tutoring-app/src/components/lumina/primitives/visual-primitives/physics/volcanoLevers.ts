/**
 * The in-item levers on a volcano-island item, as one lever set (`bossLevers.ts`; `/add-support-tiers`). No real-learner
 * evidence yet: the misses are what `kitchenMiss` observes, and the documented misconception that more of anything makes
 * a bigger eruption.
 *
 * - `fizz_pairs` (layout): once both volcanoes have erupted, each one's spoons of soda are drawn in a row beside the cups
 *   of vinegar they fizzed with, with the leftovers set apart. The pairs are the foam marks; the leftovers did nothing.
 *   Answers the claims the eruptions did not show (`kept_prediction`, `misread_result`).
 * - `changes_marked` (marks): in volcano B's panel, every amount that is different from volcano A is marked "changed".
 *   Answers an unfair or empty test (`changed_both`, `no_change`).
 * - `one_step_less` (easier): an easier test first, ungraded: change the amount that runs out first, the other locked.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { VOLCANO_MISSES_BY_MODE } from './volcanoIsland.card';
import { changeMatters, makeKitchen, type VolcanoChallenge } from './volcanoModel';
import { magmaByKey, makeMagma } from './magmaModel';
import { makeLayers } from './layersModel';
import { buildVillage, fewestWalls } from './villageModel';
import { makeRock } from './rockModel';
import { seeded } from './buoyancyModel';

export const FIZZ_LEVER = 'fizz_pairs';
export const CHANGES_LEVER = 'changes_marked';
export const EASIER_LEVER = 'one_step_less';
export const MAGMA_TAGS_LEVER = 'magma_tags';
export const NEW_LAYER_LEVER = 'new_layer_marked';
export const CRACK_LEVER = 'crack_marked';
export const TRAIL_LEVER = 'lava_trail';
export const ZOOM_LEVER = 'crystal_zoom';
export const PRACTICE_SUFFIX = '~easier';
export const isPractice = (c: Pick<VolcanoChallenge, 'id'>) => c.id.endsWith(PRACTICE_SUFFIX);
export const PRACTICE_NOTE = 'An easier practice item, ungraded; the full item comes back after it.';

/** What the screen shows that a lever needs: whether both volcanoes have erupted (kitchen), or the learner's eruption
 *  has laid its new layer (layers). */
export interface VolcanoLeverCtx { bothErupted: boolean; newLayer?: boolean; tested?: boolean }

/** An easier test: the soda runs out first and the vinegar is locked. None when the item is already that. */
export function practiceItem(c: VolcanoChallenge): VolcanoChallenge | null {
  if (isPractice(c)) return null;
  if (c.type === 'cool_the_rock') {
    // Two places, slow and very fast, and a rock just like one test.
    if (c.places.length === 2) return null;
    const tested = [{ cooling: 'underground' as const, gassy: false }, { cooling: 'sea' as const, gassy: false }];
    return makeRock(`${c.id}${PRACTICE_SUFFIX}`, tested, tested[0], ['underground', 'sea']);
  }
  if (c.type === 'save_the_village') {
    // A map that one wall saves (with a spare); none when one wall already saves this one.
    if (fewestWalls(c, c.maxWalls)?.length === 1) return null;
    return buildVillage('easy', seeded(c.volume * 7919 + c.village[0]), `${c.id}${PRACTICE_SUFFIX}`);
  }
  if (c.type === 'layers_over_time') {
    // Two old layers, no crack.
    if (!c.dike && c.layers.length === 2) return null;
    return makeLayers(`${c.id}${PRACTICE_SUFFIX}`, ['soil', 'lava'], 'ash', false);
  }
  if (c.type === 'runny_or_sticky') {
    // Two kinds, and a mystery exactly like a test: Kīlauea and Mount St. Helens, then Mauna Loa.
    if (c.outcomes.length === 2 && c.mystery.key === 'mauna-loa') return null;
    return makeMagma(`${c.id}${PRACTICE_SUFFIX}`, [magmaByKey('kilauea')!, magmaByKey('st-helens')!], magmaByKey('mauna-loa')!, ['flows', 'explodes']);
  }
  if (c.lockOther && changeMatters(c.a, c.change)) return null;
  return makeKitchen(`${c.id}${PRACTICE_SUFFIX}`, { soda: 1, vinegar: 3 }, 'soda', true);
}
export const practiceParent = (itemId: string | null | undefined, challenges: readonly VolcanoChallenge[]) =>
  itemId?.endsWith(PRACTICE_SUFFIX) ? challenges.find(c => `${c.id}${PRACTICE_SUFFIX}` === itemId) ?? null : null;

const notPractice = (c: VolcanoChallenge) => (isPractice(c) ? null : true);

export const VOLCANO_LEVERS = leverSet<VolcanoChallenge, VolcanoLeverCtx>({
  modeOf: c => c.type,
  missesOf: mode => VOLCANO_MISSES_BY_MODE[mode as keyof typeof VOLCANO_MISSES_BY_MODE] ?? [],
  specs: [
    { id: FIZZ_LEVER, type: 'layout', modes: ['kitchen_volcano'], answers: ['kept_prediction', 'misread_result'],
      when: 'The learner says which erupted higher from the guess or a misread, not from the foam.',
      does: 'Under the lab notebook, draws each volcano\'s spoons of soda beside the cups of vinegar they fizzed with, '
        + 'with any leftovers set apart.',
      content: notPractice,
      offer: (_c, ctx) => ctx.bothErupted,
      fact: 'Under the lab notebook, each volcano\'s spoons of soda are drawn beside the cups of vinegar they fizzed with; '
        + 'leftovers are set apart.' },
    { id: CHANGES_LEVER, type: 'marks', modes: ['kitchen_volcano'], answers: ['changed_both', 'no_change'],
      when: 'Volcano B changes more than one amount, or nothing.',
      does: 'In volcano B\'s panel, marks every amount that is different from volcano A as "changed".',
      content: notPractice,
      fact: 'In volcano B\'s panel, every amount that is different from volcano A is marked "changed".' },
    { id: MAGMA_TAGS_LEVER, type: 'legend', modes: ['runny_or_sticky'], answers: ['missed_thickness', 'missed_gas'],
      when: 'The learner does not use what the magma is like (runny or thick, how much gas) to decide.',
      does: 'Puts a picture tag beside every magma, the tests and the new one alike: a syrup drip or a peanut-butter lump '
        + 'for runny or thick, and one or three bubbles for the gas.',
      content: notPractice,
      fact: 'A picture tag beside every magma (tests and the new one alike) shows runny or thick and how much gas it has.' },
    { id: NEW_LAYER_LEVER, type: 'marks', modes: ['layers_over_time'], answers: ['top_is_oldest'],
      when: 'The learner reads the layers from the top down, as if the top were the oldest.',
      does: 'Outlines the layer the learner\'s own eruption just laid, with an arrow: "your eruption made this".',
      content: notPractice,
      offer: (_c, ctx) => !!ctx.newLayer,
      fact: 'The layer the learner\'s own eruption just laid is outlined, with an arrow: "your eruption made this".' },
    { id: CRACK_LEVER, type: 'marks', modes: ['layers_over_time'], answers: ['crack_too_early'],
      when: 'The learner puts the lava crack before a layer it cuts through.',
      does: 'Marks every place where the lava crack cuts through a layer with a small zigzag.',
      content: c => (c.type === 'layers_over_time' && c.dike && !isPractice(c) ? true : null),
      fact: 'Every place where the lava crack cuts through a layer is marked with a small zigzag.' },
    { id: TRAIL_LEVER, type: 'marks', modes: ['save_the_village'], answers: ['walls_off_path', 'lava_went_around'],
      when: 'The learner places walls where the lava does not go, or does not see which way it goes next.',
      does: 'Keeps the last test\'s lava drawn on the map with small arrows showing which way it flowed downhill.',
      content: notPractice,
      offer: (_c, ctx) => !!ctx.tested,
      fact: 'The last test\'s lava stays drawn on the map, with small arrows showing which way it flowed downhill.' },
    { id: ZOOM_LEVER, type: 'marks', modes: ['cool_the_rock'], answers: ['speed_swapped', 'fast_mixup'],
      when: 'The learner does not link the crystal size to how slowly the lava cooled.',
      does: 'Draws a magnifying ring on every rock, the tests and the found rock alike, with its crystals drawn larger.',
      content: notPractice,
      fact: 'A magnifying ring on every rock (tests and the found rock alike) shows its crystals drawn larger.' },
    { id: EASIER_LEVER, type: 'easier', answers: 'all',
      when: 'The learner cannot yet run this test and say what it showed.',
      does: c => (c.type === 'cool_the_rock' ? 'Opens an easier test first: lava cooled deep underground and in the sea, and a rock like one of them.'
        : c.type === 'save_the_village' ? 'Opens an easier map first: one wall in the right place saves the village.'
        : c.type === 'layers_over_time' ? 'Opens an easier cutaway first: two old layers and no crack.'
        : c.type === 'runny_or_sticky'
        ? 'Opens an easier test first: one runny and one thick, gassy magma, and a new magma just like one of them.'
        : 'Opens an easier test first: change the baking soda, with the vinegar locked.')
        + ' It is not graded; the full item comes back after it.',
      content: c => practiceItem(c) },
  ],
});
