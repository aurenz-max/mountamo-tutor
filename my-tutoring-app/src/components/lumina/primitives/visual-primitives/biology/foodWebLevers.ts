/**
 * The in-item levers on food-web-builder's open build, `build_chain` (/add-eval-modes references/build-mode.md),
 * designed from why learners fail a food chain. Choosing the living things and the way each arrow points IS the task,
 * so the item starts bare and the levers come on a miss, never from the tier.
 * - `arrow_words` (help): writes "eaten by" along every arrow the learner drew, so each arrow reads as a sentence.
 *   The classic error is drawing "eats" (eater → food) where the arrow means "is eaten by" (food → eater, the way
 *   the energy goes); read aloud, a backwards arrow says something false, and a gap has no sentence.
 * - `food_tags` (help): tags each living thing, in the list and in the scene, with what it eats (makes its own food,
 *   eats plants, eats animals, breaks down dead things), for a chain that starts mid-way or joins two that do not
 *   feed each other. It names no pair.
 * - `chain_count` (help): under the scene, how many living things are on the learner's longest line of arrows.
 * - `shorter_chain` (simplify): an ungraded ask for a chain one living thing shorter to the same end, then the full item.
 * `wrong_end` has no lever: the ask on screen names the end.
 *
 * The whole web, `complete_web`, from its own misses (`foodWebMiss`):
 * - `arrow_words` (help, `backwards_arrows`): the same "eaten by" words on every arrow the learner drew, right or wrong.
 * - `food_tags` (help, `wrong_arrows`): what each living thing eats, in plain words under its level label.
 * - `arrow_counts` (help, `missing_arrows`): on each living thing, how many feeding arrows join it in the whole web. It
 *   is counted from the lesson's relations, never from the learner's arrows, so it does not move when a right arrow is
 *   drawn and cannot be used to test arrows one by one. It names no partner and no direction.
 * - `smaller_web` (simplify): the same task on fewer living things (the top eaters, else the decomposers, left out),
 *   ungraded, then the full web back empty.
 *
 * Declared once as a lever set (`FOOD_WEB_LEVERS`, `bossLevers.ts`); the component calls its declare, onScreen and
 * simpler. None is offered on a practice item: the component declares nothing while one is on screen.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import type { Connection, FoodWebChallenge, Organism } from './FoodWebBuilder';
import { chainAsk, feedingChains } from './foodWebWorkspace';
import { foodWebBuilderCard } from './foodWebBuilder.card';

export const ARROW_WORDS_LEVER = 'arrow_words';
export const FOOD_TAGS_LEVER = 'food_tags';
export const CHAIN_COUNT_LEVER = 'chain_count';
export const SHORTER_LEVER = 'shorter_chain';
export const ARROW_COUNTS_LEVER = 'arrow_counts';
export const SMALLER_WEB_LEVER = 'smaller_web';

const SHORTER = '~shorter';
export const isPracticeChain = (c: Pick<FoodWebChallenge, 'id'>) => c.id.endsWith(SHORTER);

/** The words a food tag shows, by trophic level. */
export const FOOD_TAG: Record<Organism['trophicLevel'], string> = {
  producer: 'makes its own food',
  'primary-consumer': 'eats plants',
  'secondary-consumer': 'eats animals',
  'tertiary-consumer': 'eats animals',
  decomposer: 'breaks down dead things',
};

/** The easier ask: one living thing fewer, the same end, when the lesson's feeding relations make such a chain. */
export function shorterChain(c: FoodWebChallenge, organisms: readonly Organism[], connections: readonly Connection[]): FoodWebChallenge | null {
  if (c.type !== 'build_chain' || isPracticeChain(c) || c.length < 3) return null;
  const length = c.length - 1;
  if (!feedingChains(organisms, connections, length).some(p => p.length === length && p[p.length - 1] === c.endId)) return null;
  const end = organisms.find(o => o.id === c.endId)?.name ?? c.endId;
  return { ...c, id: `${c.id}${SHORTER}`, length, instruction: chainAsk(length, end) };
}

// -- complete_web ---------------------------------------------------------------

const SMALLER = '~smaller';
export const isPracticeWeb = (c: Pick<FoodWebChallenge, 'id'>) => c.id.endsWith(SMALLER);
const CONSUMER_LEVELS: readonly Organism['trophicLevel'][] = ['tertiary-consumer', 'secondary-consumer', 'primary-consumer'];

/** The living things and feeding relations a whole-web item shows: all of them, or a smaller web's part. */
export function webPart(c: FoodWebChallenge | null, organisms: readonly Organism[], connections: readonly Connection[]) {
  const only = c?.type === 'complete_web' ? c.only : undefined;
  if (!only) return { organisms, connections };
  return { organisms: organisms.filter(o => only.includes(o.id)),
    connections: connections.filter(r => only.includes(r.fromId) && only.includes(r.toId)) };
}

/**
 * The easier whole web: one level of living things left out, the top eaters first, else the decomposers, and every
 * living thing no relation is left on dropped too. It keeps at least two relations and fewer than the full web, so it
 * is the same task and never the learner's own item. Null when no level can go.
 */
export function smallerWeb(c: FoodWebChallenge, organisms: readonly Organism[], connections: readonly Connection[]): FoodWebChallenge | null {
  if (c.type !== 'complete_web' || c.only) return null;
  const level = new Map(organisms.map(o => [o.id, o.trophicLevel]));
  const top = CONSUMER_LEVELS.find(l => organisms.some(o => o.trophicLevel === l));
  for (const drop of [top, 'decomposer' as const]) {
    if (!drop) continue;
    const kept = connections.filter(r => level.has(r.fromId) && level.has(r.toId) && level.get(r.fromId) !== drop && level.get(r.toId) !== drop);
    if (kept.length < 2 || kept.length >= connections.length) continue;
    const only = organisms.filter(o => kept.some(r => r.fromId === o.id || r.toId === o.id)).map(o => o.id);
    return { id: `${c.id}${SMALLER}`, type: 'complete_web', only };
  }
  return null;
}

/** How many of the lesson's feeding relations touch each living thing: from the relations only, never the learner's arrows. */
export function webArrowCounts(organisms: readonly Organism[], connections: readonly Connection[]): Record<string, number> {
  return Object.fromEntries(organisms.map(o => [o.id, connections.filter(r => r.fromId === o.id || r.toId === o.id).length]));
}

/** What the levers read beside the item: the lesson's living things and the feeding relations the item is judged against. */
export interface FoodWebLeverContext { organisms: readonly Organism[]; relations: readonly Connection[] }

const CHAIN = ['build_chain'], WEB = ['complete_web'];

export const FOOD_WEB_LEVERS = leverSet<FoodWebChallenge, FoodWebLeverContext>({
  modeOf: c => c.type,
  missesOf: mode => foodWebBuilderCard.modes[mode]?.misses ?? [],
  specs: [
    // build_chain
    { id: ARROW_WORDS_LEVER, type: 'marks', modes: CHAIN, answers: ['arrow_backwards', 'broken_chain'],
      when: 'The learner draws an arrow from the eater to its food, or leaves a gap or a branch in the chain.',
      does: 'Writes "eaten by" along every arrow the learner drew in the scene, so each arrow reads as a sentence. It turns no arrow round.',
      fact: 'Along every arrow in the scene is written "eaten by".' },
    { id: FOOD_TAGS_LEVER, type: 'legend', modes: CHAIN, answers: ['no_producer', 'not_a_feeding_pair'],
      when: 'The learner starts the chain without a living thing that makes its own food, or joins two that do not feed each other.',
      does: 'Puts a tag on every living thing in the list and in the scene saying what it eats. It names no pair and draws no arrow.',
      fact: 'Every living thing has a tag saying what it eats.' },
    { id: CHAIN_COUNT_LEVER, type: 'marks', modes: CHAIN, answers: ['too_short', 'too_long'],
      when: 'The learner loses count of the living things joined in the chain.',
      does: 'Shows under the scene how many living things are on the learner\'s longest line of arrows. Never the number asked for.',
      fact: 'Under the scene is how many living things are on the learner\'s longest line of arrows.' },
    { id: SHORTER_LEVER, type: 'easier', modes: CHAIN, answers: ['broken_chain', 'not_a_feeding_pair', 'too_long'],
      when: 'The learner cannot build a chain this long yet.',
      does: 'Opens an easier ask first, a chain with one living thing fewer that ends at the same living thing, on an empty scene. '
        + 'It is not graded; the full item comes back after it.',
      content: (c, ctx) => shorterChain(c, ctx.organisms, ctx.relations) },
    // complete_web
    { id: ARROW_WORDS_LEVER, type: 'marks', modes: WEB, answers: ['backwards_arrows'],
      when: 'The learner draws an arrow from the eater to its food.',
      does: 'Writes "eaten by" along every arrow the learner drew and in their list of arrows, the same words on every arrow, so '
        + 'each reads as a sentence. It turns no arrow round and marks none.',
      fact: 'Along every arrow the learner drew is written "eaten by".' },
    { id: FOOD_TAGS_LEVER, type: 'legend', modes: WEB, answers: ['wrong_arrows'],
      when: 'The learner joins two living things where neither eats the other.',
      does: 'Puts a tag on every living thing saying what it eats in plain words. It names no pair and draws no arrow.',
      fact: 'Every living thing has a tag saying what it eats.' },
    { id: ARROW_COUNTS_LEVER, type: 'marks', modes: WEB, answers: ['missing_arrows'],
      when: 'The learner leaves feeding relationships out of the web.',
      does: 'Shows on every living thing how many feeding arrows join it in the whole web. It is counted from the web, not from '
        + 'the arrows the learner drew, so it does not change as arrows are drawn; it names no partner and no direction.',
      fact: 'Every living thing shows how many feeding arrows join it in the whole web.' },
    { id: SMALLER_WEB_LEVER, type: 'easier', modes: WEB, answers: ['missing_arrows', 'wrong_arrows'],
      when: 'The learner cannot keep the whole web in view yet.',
      does: 'Opens an easier web first: the same task with some living things left out, on an empty web. It is not graded; the '
        + 'full web comes back after it, empty.',
      content: (c, ctx) => smallerWeb(c, ctx.organisms, ctx.relations) },
  ],
});
