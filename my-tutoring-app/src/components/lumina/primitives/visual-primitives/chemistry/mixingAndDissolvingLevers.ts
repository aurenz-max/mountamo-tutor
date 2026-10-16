/**
 * The in-item levers on a mixing-and-dissolving challenge (`/add-support-tiers`, report
 * qa/eval-reports/mixing-and-dissolving-levers-2026-10-15.md). No real-learner evidence: the misses are what
 * `dissolvingMiss` names, against the catalog's documented struggles. Pure: the component draws from these.
 *
 * - `model_beakers` (help, shown): small model beakers beside the question, filled with things that are not in this
 *   lesson, each tagged with what it does in water: one that spreads through it, one that sits on the bottom, one that
 *   floats in a layer (sort tags: dissolves or not; classify tags: solution, suspension, two layers). Leak rule (`modelsLeak`): no model shares a word with a lesson
 *   substance or the solvent, so no model is the item's substance.
 * - `particle_view` (help, shown): opens the particle view of the learner's own beaker on the particle question (the
 *   question asks about that view). Refused while the beaker is empty or the view is already open.
 * - `method_cards` (help, shown): a card for each separation method among the choices, saying in fixed words what it
 *   catches. Names no substance and marks no card; the learner still has to see whether the substance dissolved.
 * - `drop_far_choice` (simplify, shown): greys out the wrong choice sharing the fewest words with the key, on the item
 *   itself (user ruling 09-27: removing a choice is assisted work). Only while two untried wrong choices remain.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { DissolvingChallenge, MixingAndDissolvingData } from './MixingAndDissolving';
import { methodsIn, type DissolvingMiss, type Method } from './mixingAndDissolvingWorkspace';

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
  distillation: 'Distillation: boil the liquid and cool the steam back into liquid in another glass. Anything dissolved stays in the first one.',
  chromatography: 'Chromatography: let the liquid creep up paper. Colours mixed together spread apart.',
  magnet: 'Magnet: pulls out bits of iron. Nothing else sticks to it.',
  decanting: 'Decanting: pour off the top layer slowly. A layer that floats, or bits that sank, stay behind.',
};

/** The methods the choices name, in the order they appear. */
export const methodsOnChoices = (ch: DissolvingChallenge): Method[] =>
  Array.from(new Set(ch.options.flatMap(o => methodsIn(o))));

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

// ── the levers ───────────────────────────────────────────────────────────────

const MISSES: Record<DissolvingChallenge['type'], DissolvingMiss[]> = {
  dissolve_sort: ['chose_dissolves', 'chose_does_not_dissolve', 'other_choice'],
  particle_explain: ['chose_disappeared', 'chose_sank', 'other_choice'],
  classify: ['called_solution', 'called_suspension', 'called_layers'],
  separate: ['filter_for_dissolved', 'evaporate_for_undissolved', 'other_method', 'other_choice'],
  factor_test: ['other_choice'], saturation: ['other_choice'], concentration: ['other_choice'],
};

/** The levers this item declares, with their state. A lever that cannot be pulled now and was not pulled is left out. */
export function dissolvingLevers(ch: DissolvingChallenge | null | undefined, s: DissolvingLeverState, lab: Lab,
  view: DissolvingLeverView): WorkspaceLever[] {
  if (!ch) return [];
  const on = (id: string) => s.pulled.includes(id);
  const answers = MISSES[ch.type] ?? ['other_choice'];
  const levers: WorkspaceLever[] = [];
  if (on(MODELS_LEVER) || modelsFor(ch, lab)) levers.push({ id: MODELS_LEVER, kind: 'help', carrier: 'both', pulled: on(MODELS_LEVER), answers,
    when: ch.type === 'classify' ? 'The learner picks the wrong kind of mixture, or cannot tell a solution from a suspension.'
      : 'The learner says it dissolves when it does not, or the other way round.',
    does: 'Draws three small model beakers beside the question, filled with things that are not in '
      + 'this lesson, each tagged with what it does in water. Read the tags if you like. Never say which model the learner\'s '
      + 'substance is like.' });
  if (ch.type === 'particle_explain' && view.particleViewAvailable && (on(PARTICLE_LEVER) || (!view.beakerEmpty && !view.particleViewOn)))
    levers.push({ id: PARTICLE_LEVER, kind: 'help', carrier: 'shown', pulled: on(PARTICLE_LEVER), answers,
      when: 'The learner says the particles disappeared or sank, or is stuck, and the particle view is closed.',
      does: 'Opens the particle view of the learner\'s own beaker: the liquid\'s particles as blue dots and each added substance\'s '
        + 'particles in its colour. Ask what the learner sees; never say where the particles went.' });
  if (on(METHODS_LEVER) || methodsOnChoices(ch).length >= 2) levers.push({ id: METHODS_LEVER, kind: 'help', carrier: 'both', pulled: on(METHODS_LEVER), answers,
    when: 'The learner picks a method that cannot get this substance back, or does not know what the methods do.',
    does: 'Shows a card for each method among the choices, saying what it catches, none marked. Never say which card fits this '
      + 'substance or whether the substance dissolved.' });
  if (on(DROP_LEVER) || farChoice(ch, s) !== null) levers.push({ id: DROP_LEVER, kind: 'simplify', carrier: 'shown', pulled: on(DROP_LEVER), answers,
    when: 'The learner still picks a wrong choice after help, or is stuck with too many choices.',
    does: 'Greys out one wrong choice that is easy to rule out, so fewer choices remain. The next answer counts as helped.' });
  return levers;
}

/** What the pulled levers put on screen, for the tutor and JEV. Names the greyed-out choice, never the key. */
export function leverFacts(ch: DissolvingChallenge, s: DissolvingLeverState, lab: Lab): string | null {
  const parts: string[] = [];
  const models = s.pulled.includes(MODELS_LEVER) ? modelsFor(ch, lab) : null;
  if (models) parts.push(`beside the question, model beakers of things not in this lesson, each tagged: ${models.map(m => `${m.name} (${m.tag})`).join('; ')}. `
    + 'Nothing marks which one the item\'s substance is like');
  if (s.pulled.includes(PARTICLE_LEVER)) parts.push('the particle view of the learner\'s beaker is open');
  if (s.pulled.includes(METHODS_LEVER)) parts.push(`method cards, none marked: ${methodsOnChoices(ch).map(m => METHOD_CARDS[m]).join(' ')}`);
  for (const i of s.dropped) if (ch.options[i] !== undefined) parts.push(`choice ${i + 1}, "${ch.options[i]}", is greyed out and is not the answer`);
  return parts.length ? parts.join('; ') : null;
}
