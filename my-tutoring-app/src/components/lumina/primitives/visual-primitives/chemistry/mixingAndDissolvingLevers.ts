/**
 * The in-item levers on a mixing-and-dissolving challenge, as one lever set (`bossLevers.ts`; `/add-support-tiers`,
 * report qa/eval-reports/mixing-and-dissolving-levers-2026-10-15.md). No real-learner evidence: the misses are what
 * `dissolvingMiss` names, against the catalog's documented struggles. Pure: the component draws from these.
 *
 * - `model_beakers` (model; dissolve, classify): small model beakers beside the question, filled with things that are
 *   not in this lesson, each tagged with what it does in water: one that spreads through it, one that sits on the
 *   bottom, one that floats in a layer (sort tags: dissolves or not; classify tags: solution, suspension, two layers).
 *   Leak rule (`modelsLeak`): no model shares a word with a lesson substance or the solvent, so no model is the item's
 *   substance. Support tier medium: the learner tries first, and the models come after a miss.
 * - `particle_view` (layout; dissolve): opens the particle view of the learner's own beaker on the particle question
 *   (the question asks about that view): the same beaker, drawn as particles. Offered once the beaker holds something
 *   and while the view is closed.
 * - `method_cards` (meaning): a card for each separation method among the choices, saying in fixed words what it
 *   catches. Names no substance and marks no card; the learner still has to see whether the substance dissolved.
 * - `drop_far_choice` (custom, shown): greys out the wrong choice sharing the fewest words with the key, on the item
 *   itself (user ruling 09-27: removing a choice is assisted work). Only while two untried wrong choices remain.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { keyAnswers } from '../../../components/live-activity/spokenKey';
import type { DissolvingChallenge, MixingAndDissolvingData } from './MixingAndDissolving';
import { DISSOLVING_MISSES } from './mixingAndDissolving.card';
import {
  dissolvingKey, dissolvingMode, methodsIn, type DissolvingMiss, type DissolvingMode, type Method,
} from './mixingAndDissolvingWorkspace';

export const MODELS_LEVER = 'model_beakers';
export const PARTICLE_LEVER = 'particle_view';
export const METHODS_LEVER = 'method_cards';
export const DROP_LEVER = 'drop_far_choice';

export interface DissolvingLeverState { pulled: readonly string[]; dropped: readonly number[]; picked: readonly number[]; wrongs: number }
export const NO_LEVERS: DissolvingLeverState = { pulled: [], dropped: [], picked: [], wrongs: 0 };

type Lab = Pick<MixingAndDissolvingData, 'solvent' | 'substances'>;
/** What the screen offers a lever: the beaker's contents and whether the particle view can open. */
export interface DissolvingLeverView { beakerEmpty: boolean; particleViewOn: boolean; particleViewAvailable: boolean }

// ── model_beakers ────────────────────────────────────────────────────────────

export type ModelLook = 'dissolves' | 'sinks' | 'layers';
export interface ModelBeaker { name: string; look: ModelLook; color: string; tag: string }

/** Everyday things a lesson rarely carries, by what they do in water. */
const MODEL_POOL: Readonly<Record<ModelLook, readonly { name: string; color: string }[]>> = {
  dissolves: [{ name: 'Drink powder', color: '#f97316' }, { name: 'Bath salts', color: '#a78bfa' }, { name: 'Lemonade powder', color: '#facc15' }],
  sinks: [{ name: 'Pebbles', color: '#94a3b8' }, { name: 'Marbles', color: '#38bdf8' }, { name: 'Plastic beads', color: '#f472b6' }],
  layers: [{ name: 'Lamp oil', color: '#fbbf24' }, { name: 'Liquid wax', color: '#fde68a' }],
};
const SORT_TAGS: Record<ModelLook, string> = {
  dissolves: 'dissolves: it spreads through the water and nothing is left to see on the bottom',
  sinks: 'does not dissolve: you can still see it, sitting on the bottom',
  layers: 'does not dissolve: it floats on top in a layer',
};
const CLASS_TAGS: Record<ModelLook, string> = {
  dissolves: 'a solution: it spreads evenly through the water and you cannot see the bits',
  sinks: 'a suspension: you can see the bits in the water, and they settle',
  layers: 'two layers: it does not mix and floats on top',
};

const words = (t: string) => t.toLowerCase().replace(/[^a-z]+/g, ' ').split(' ').filter(w => w.length >= 3).map(w => w.replace(/s$/, ''));
const collides = (name: string, lab: Lab) => {
  const mine = new Set(words(name));
  return [lab.solvent.name, ...lab.substances.map(s => s.name)].some(n => words(n).some(w => mine.has(w)));
};

/** The model beakers for a sort or classify item, or null when a kind has no model left after the leak rule. */
export function modelsFor(ch: DissolvingChallenge, lab: Lab): ModelBeaker[] | null {
  // Sort shows the floating layer too: an oil item matched neither "spreads through" nor "on the bottom" (replay 10-15).
  if (ch.type !== 'dissolve_sort' && ch.type !== 'classify') return null;
  const looks: ModelLook[] = ['dissolves', 'sinks', 'layers'];
  const tags = ch.type === 'classify' ? CLASS_TAGS : SORT_TAGS;
  const picked = looks.map(look => {
    const m = MODEL_POOL[look].find(x => !collides(x.name, lab));
    return m ? { ...m, look, tag: tags[look] } : null;
  });
  return picked.every(Boolean) ? (picked as ModelBeaker[]) : null;
}

/** Leak rule: one model per kind asked, none sharing a word with a lesson substance or the solvent. */
export const modelsLeak = (models: readonly ModelBeaker[], lab: Lab) =>
  new Set(models.map(m => m.look)).size !== models.length || models.some(m => collides(m.name, lab));

// ── method_cards ─────────────────────────────────────────────────────────────

export const METHOD_CARDS: Readonly<Record<Method, string>> = {
  filtration: 'Filtration: pour through filter paper. Solid bits that did not dissolve stay on the paper; the liquid runs through.',
  evaporation: 'Evaporation: heat the liquid until it is gone. Anything that was dissolved in it is left behind.',
  distillation: 'Distillation: boil the liquid and cool the steam back into liquid in another glass. Anything dissolved stays behind in the first glass.',
  chromatography: 'Chromatography: let the liquid creep up paper. Colours mixed together spread apart.',
  magnet: 'Magnet: pulls out bits of iron. Nothing else sticks to it.',
  decanting: 'Decanting: pour off the top layer slowly. A layer that floats, or bits that sank, stay behind.',
};

/** The methods the choices name, in the order they appear. */
export const methodsOnChoices = (ch: DissolvingChallenge): Method[] =>
  Array.from(new Set(ch.options.flatMap(o => methodsIn(o))));

/** A method card's words without its name, so the fact lists the cards by the order of the choices. */
const methodBody = (m: Method) => METHOD_CARDS[m].replace(/^[^:]+:\s*/, '');

// ── drop_far_choice ──────────────────────────────────────────────────────────

const STOP = new Set(['the', 'they', 'them', 'and', 'with', 'into', 'from', 'that', 'this', 'its', 'are', 'was', 'use', 'using']);
const contentWords = (s: string) => new Set(s.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3 && !STOP.has(w)));

/** The wrong choice to grey out now, or null when fewer than two untried wrong choices are left. */
export function farChoice(ch: DissolvingChallenge, s: DissolvingLeverState): number | null {
  const foils = ch.options.map((_, i) => i).filter(i => i !== ch.correctOptionIndex && !s.dropped.includes(i) && !s.picked.includes(i));
  if (foils.length < 2) return null;
  const key = contentWords(ch.options[ch.correctOptionIndex] ?? '');
  const shared = (i: number) => Array.from(contentWords(ch.options[i])).filter(w => key.has(w)).length;
  return [...foils].sort((a, b) => shared(a) - shared(b) || b - a)[0];
}

// ── The lever set ────────────────────────────────────────────────────────────

/** The misses a lever answers on an item, by its challenge type (the particle question sits in dissolve). */
const MISSES_BY_TYPE: Record<DissolvingChallenge['type'], readonly DissolvingMiss[]> = {
  dissolve_sort: ['chose_dissolves', 'chose_does_not_dissolve', 'other_choice'],
  particle_explain: ['chose_disappeared', 'chose_sank', 'other_choice'],
  classify: ['called_solution', 'called_suspension', 'called_layers'],
  separate: ['filter_for_dissolved', 'evaporate_for_undissolved', 'other_method', 'other_choice'],
  factor_test: ['other_choice'], saturation: ['other_choice'], concentration: ['other_choice'],
};
const onType = (ch: DissolvingChallenge) => MISSES_BY_TYPE[ch.type] ?? ['other_choice'];

/** What the levers read beside the item: the lesson's lab, the screen, and this item's lever state. */
export interface DissolvingLeverContext { lab: Lab; view: DissolvingLeverView; state: DissolvingLeverState }

export const DISSOLVING_LEVERS = leverSet<DissolvingChallenge, DissolvingLeverContext>({
  modeOf: dissolvingMode,
  missesOf: mode => DISSOLVING_MISSES[mode as DissolvingMode] ?? [],
  // A meaning card's words never name the key or a way of saying it.
  answersOf: ch => keyAnswers(dissolvingKey(ch)),
  // No lesson carries a support tier. The models come after a try: before the first answer they would show what
  // each kind of mixture looks like before the learner has looked at the beaker.
  support: { tier: () => 'medium', different: 'other things in water', own: 'what this substance does' },
  specs: [
    { id: MODELS_LEVER, type: 'model', modes: ['dissolve', 'classify'], answers: 'all', answersOn: onType,
      when: ch => (ch.type === 'classify' ? 'The learner picks the wrong kind of mixture, or cannot tell a solution from a suspension.'
        : 'The learner says it dissolves when it does not, or the other way round.'),
      does: 'Draws three small model beakers beside the question, filled with things that are not in this lesson, each '
        + 'tagged with what it does in water. Read the tags if you like. Never say which model the learner\'s substance is like.',
      content: (ch, { lab }) => modelsFor(ch, lab),
      fact: (models: ModelBeaker[]) => 'Beside the question, model beakers of things not in this lesson, each tagged: '
        + `${models.map(m => `${m.name} (${m.tag})`).join('; ')}. Nothing marks which one the item's substance is like.` },
    { id: PARTICLE_LEVER, type: 'layout', modes: ['dissolve'], answers: 'all', answersOn: onType,
      when: 'The learner says the particles disappeared or sank, or is stuck, and the particle view is closed.',
      does: 'Opens the particle view of the learner\'s own beaker: the liquid\'s particles as blue dots and each added '
        + 'substance\'s particles in its colour. Ask what the learner sees; never say where the particles went.',
      content: (ch, { view }) => ch.type === 'particle_explain' && view.particleViewAvailable,
      // Kept while pulled: the view it opened stays open.
      offer: (_ch, { view, state }) => state.pulled.includes(PARTICLE_LEVER) || (!view.beakerEmpty && !view.particleViewOn),
      fact: 'The particle view of the learner\'s beaker is open.' },
    { id: METHODS_LEVER, type: 'meaning', answers: 'all', answersOn: onType,
      when: 'The learner picks a method that cannot get this substance back, or does not know what the methods do.',
      does: 'Shows a card for each method among the choices, saying what it catches, none marked. Never say which card '
        + 'fits this substance or whether the substance dissolved.',
      content: ch => (methodsOnChoices(ch).length >= 2 ? methodsOnChoices(ch) : null),
      // In the order of the choices, not by name: a fact that repeats a choice's name beside its card reads as a pointer.
      fact: (methods: Method[]) => 'Method cards, none marked, one for each method among the choices, in their order: '
        + `${methods.map((m, i) => `${i + 1}. "${methodBody(m)}"`).join(' ')}` },
    { id: DROP_LEVER, type: 'custom', answers: 'all', answersOn: onType, carrier: 'shown',
      why: 'It narrows this item in place (one wrong choice greyed out) rather than opening a practice item.',
      when: 'The learner still picks a wrong choice after help, or is stuck with too many choices.',
      does: 'Greys out one wrong choice that is easy to rule out, so fewer choices remain. The next answer counts as helped.',
      // Offered while one more can be greyed out; once pulled, its fact names every greyed-out choice.
      content: (ch, { state }) => (state.pulled.includes(DROP_LEVER) || farChoice(ch, state) !== null ? state.dropped : null),
      fact: (dropped: readonly number[], ch) => dropped.filter(i => ch.options[i] !== undefined)
        .map(i => `Choice ${i + 1}, "${ch.options[i]}", is greyed out and is not the answer.`).join(' ') },
  ],
});
