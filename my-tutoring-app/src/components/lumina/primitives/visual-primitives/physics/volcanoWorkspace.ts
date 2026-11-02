/**
 * Volcano Island's scene on the shared tutor/JEV teaching workspace. Every item is a test the activity checks (the card,
 * `volcanoIsland.card.ts`, names the moves; the boss gives the assignment), so no key reaches the tutor. The scene
 * carries what is on the table: volcano A's mix, volcano B's mix as the learner set it, the guess, which volcanoes have
 * erupted and how high their foam rose. Which one goes higher is never in it before both have erupted.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import { xy, type VillageChallenge } from './villageModel';
import { COOLING_WORDS, ROCK_LOOKS, rockOf, type Cooling, type RockChallenge, type RockKind } from './rockModel';
import { LAYER_WORDS, layerName, type LayersChallenge } from './layersModel';
import { OUTCOME_WORDS, magmaLooks, outcomeOf, type MagmaChallenge, type Outcome } from './magmaModel';
import { INGREDIENT_WORD, WHICH_WORDS, foamHeight, mixWords, type KitchenChallenge, type Mix, type Which } from './volcanoModel';

export interface KitchenView {
  b: Mix;
  prediction: Which | null;
  eruptedA: boolean;
  eruptedB: boolean;
  claim: Which | null;
}

const rose = (m: Mix) => `its foam rose to mark ${foamHeight(m)} on the measuring stick`;

export function kitchenScene(c: KitchenChallenge, view: KitchenView): SceneOf {
  const facts: Record<string, string | number> = {
    table: 'a kitchen table drawn in 3D with two clay volcanoes, A on the left and B on the right, each with a measuring stick of four coloured marks behind it',
    step: !view.prediction ? 'mixing volcano B and guessing' : !(view.eruptedA && view.eruptedB) ? 'erupting the volcanoes' : 'saying which erupted higher',
    goal: c.instruction,
    volcanoA: `${mixWords(c.a)}; ${view.eruptedA ? `erupted: ${rose(c.a)}` : 'not erupted yet'}`,
    volcanoB: `${mixWords(view.b)}${c.lockOther ? ` (only the ${INGREDIENT_WORD[c.change]} can change)` : ''}; ${view.eruptedB ? `erupted: ${rose(view.b)}` : 'not erupted yet'}`,
    guess: view.prediction ? `guessed ${WHICH_WORDS[view.prediction]} would erupt higher` : 'no guess yet',
    claim: view.claim ? `says ${WHICH_WORDS[view.claim]} erupted higher` : 'not said yet',
  };
  return { objects: [], facts };
}

export interface MagmaView {
  guesses: ReadonlyArray<Outcome | null>;
  erupted: readonly boolean[];
  call: Outcome | null;
  /** The new volcano has erupted (only after a right check). */
  revealed: boolean;
}

/** A magma item's scene: each magma's look and what each test did. The new volcano's eruption is never in it before a
 *  right check. */
export function magmaScene(c: MagmaChallenge, view: MagmaView): SceneOf {
  const tests = c.tested.map((m, i) => `${m.name}'s magma (${magmaLooks(m)}): ${view.erupted[i] ? `erupted: ${OUTCOME_WORDS[outcomeOf(m)]}` : 'not erupted yet'}`
    + (view.guesses[i] ? ` (guessed: ${OUTCOME_WORDS[view.guesses[i]!]})` : ''));
  const facts: Record<string, string | number> = {
    island: 'an island drawn in 3D with a volcano mountain and a village at its foot; each magma is erupted on it in turn',
    step: view.erupted.every(Boolean) ? 'deciding about the new volcano' : 'erupting the test magmas',
    goal: c.instruction,
    tests: tests.join('; '),
    newVolcano: `${c.mystery.name}'s magma (${magmaLooks(c.mystery)}): ${view.revealed ? `erupted after the check: ${OUTCOME_WORDS[outcomeOf(c.mystery)]}` : 'not erupted'}`,
    callsOnOffer: c.outcomes.map(o => OUTCOME_WORDS[o]).join('; '),
    call: view.call ? `says ${OUTCOME_WORDS[view.call]}` : 'no call yet',
  };
  return { objects: [], facts };
}

export type LayerGuess = 'top' | 'middle' | 'bottom';
export interface LayersView {
  guess: LayerGuess | null;
  erupted: boolean;
  order: readonly string[];
}

/** A layers item's scene: the cutaway's layers by what they look like, bottom to top (that is what is drawn), the
 *  crack, the new layer once laid, and the learner's taps. */
export function layersScene(c: LayersChallenge, view: LayersView): SceneOf {
  const facts: Record<string, string | number> = {
    island: 'an island drawn in 3D with a volcano; beside it a cutaway picture of the volcano\'s rock layers',
    step: !view.erupted ? 'guessing where the new layer will go, then erupting' : 'putting the layers in order, oldest first',
    goal: c.instruction,
    cutawayBottomToTop: [...c.layers.map(l => `a layer of ${LAYER_WORDS[l.kind]}`),
      ...(view.erupted ? [`the new layer of ${LAYER_WORDS[c.newKind]} the learner's eruption just laid`] : [])].join('; then '),
    crack: c.dike ? 'a dark lava crack cuts up through every old layer, but not the new one' : 'none',
    guess: view.guess ? `guessed the new layer would go at the ${view.guess}` : 'no guess yet',
    tapped: view.order.length ? view.order.map((x, i) => `${i + 1}: ${layerName(c, x)}`).join('; ') : 'nothing yet',
  };
  return { objects: [], facts };
}

export interface VillageView { walls: readonly number[]; tests: number; lastTestSafe: boolean | null }

/** A village item's scene: the map, the walls placed, and what the last test did. Where to put a wall is never in it. */
export function villageScene(c: VillageChallenge, view: VillageView): SceneOf {
  const at = (cell: number) => `row ${xy(cell).y + 1}, column ${xy(cell).x + 1}`;
  const facts: Record<string, string | number> = {
    island: 'an island drawn in 3D with a volcano; below it a square map of the slope (9 by 9), the crater at the top middle, the village on the shore at the bottom; darker squares are higher ground',
    step: view.tests ? 'placing walls and testing' : 'placing walls before the first test',
    goal: c.instruction,
    village: c.village.map(at).join(' and '),
    walls: view.walls.length ? `${view.walls.length} of ${c.maxWalls}: ${view.walls.map(at).join('; ')}` : `none yet (up to ${c.maxWalls})`,
    lastTest: view.lastTestSafe == null ? 'no test yet' : view.lastTestSafe ? 'the lava missed the village' : 'the lava reached the village',
  };
  return { objects: [], facts };
}

export interface RockView { guesses: ReadonlyArray<RockKind | null>; cooled: readonly boolean[]; call: Cooling | null }

/** A rock item's scene: each sample's place and lava, the rock it made once cooled, the found rock's look, the call. */
export function rockScene(c: RockChallenge, view: RockView): SceneOf {
  const facts: Record<string, string | number> = {
    island: 'an island drawn in 3D with a volcano; below it rock tiles that show each rock up close',
    step: view.cooled.every(Boolean) ? 'deciding where the found rock cooled' : 'cooling the lava samples',
    goal: c.instruction,
    samples: c.tested.map((t, i) => `${t.gassy ? 'gassy ' : ''}lava cooled ${COOLING_WORDS[t.cooling]}: `
      + (view.cooled[i] ? `made rock that is ${ROCK_LOOKS[rockOf(t)]}` : 'not cooled yet')).join('; '),
    foundRock: ROCK_LOOKS[rockOf(c.mystery)],
    call: view.call ? `says it cooled ${COOLING_WORDS[view.call]}` : 'no call yet',
  };
  return { objects: [], facts };
}
