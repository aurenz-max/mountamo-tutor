/**
 * The in-item levers on a reaction-lab challenge (`/add-support-tiers`, report
 * qa/eval-reports/reaction-lab-levers-2026-10-15.md). No real-learner evidence: the misses are what `reactionMiss`
 * names and the catalog's documented struggles. Pure: the component draws from these, the workspace publishes them,
 * the tests hold each leak rule.
 *
 * - `signs_legend` (help, shown): a card of the seven signs that a new substance may be forming, with their pictures,
 *   none marked. Withheld when a choice is itself one of the card's signs, and on a question about signs whose right
 *   choice alone names one (the card would single it out).
 * - `replay_reaction` (help, shown): the beaker plays the reaction again. After the reaction has run, while it is not
 *   already playing. It shows only what the learner already saw.
 * - `particle_view` (help, shown): opens the particle view (reactant and product molecules, bonds breaking and
 *   forming) with no caption, on an explain-mode challenge. Withheld when a choice is one of the molecules.
 * - `drop_far_choice` (simplify, shown): greys out one wrong choice, the one sharing the fewest words with the right
 *   one, on the item itself (user ruling 09-27). At least two untried choices stay, so a 4-choice question has it after
 *   one wrong answer and a 3-choice one only before any.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { answerForm, itemChoices, keyValue, keyLabel, REACTION_MISSES, type ReactionItem, type ReactionMiss } from './reactionLabWorkspace';

export const LEGEND_LEVER = 'signs_legend';
export const REPLAY_LEVER = 'replay_reaction';
export const PARTICLE_LEVER = 'particle_view';
export const DROP_LEVER = 'drop_far_choice';

/** Per session item: the levers pulled, the choices greyed out, the choices tried wrong, and the wrong attempts. */
export interface ReactionLeverState { pulled: readonly string[]; dropped: readonly string[]; picked: readonly string[]; wrongs: number }
export const NO_LEVERS: ReactionLeverState = { pulled: [], dropped: [], picked: [], wrongs: 0 };

/** The legend card: every sign of a chemical change the lab draws, in a fixed order. Names no substance. */
export const SIGN_LEGEND: ReadonlyArray<{ sign: string; emoji: string; label: string }> = [
  { sign: 'fizzing', emoji: '🫧', label: 'Fizzing / Bubbles' },
  { sign: 'color_change', emoji: '🎨', label: 'Color Change' },
  { sign: 'temperature_change', emoji: '🌡️', label: 'Temperature Change' },
  { sign: 'gas_produced', emoji: '💨', label: 'Gas Produced' },
  { sign: 'precipitate', emoji: '⬇️', label: 'Precipitate Formed' },
  { sign: 'light', emoji: '💡', label: 'Light / Glow' },
  { sign: 'odor', emoji: '👃', label: 'New Smell' },
];
export const LEGEND_TITLE = 'Signs that a new substance may be forming';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9₀-₉\s]/g, ' ').replace(/\s+/g, ' ').trim();
const LEGEND_PHRASES = SIGN_LEGEND.flatMap(l => [norm(l.label), ...l.label.split('/').map(norm)]).filter(Boolean);
const SIGN_WORDS = /\b(fizz\w*|bubbl\w*|colou?r|temperature|warm\w*|hot(ter)?|cold(er)?|cool\w*|gas|precipitate|glow\w*|light|smell\w*|odou?r)\b/i;

/** Why the legend may not be shown beside this item, or null when it may. Every choice is tested alike. */
export function legendLeak(item: ReactionItem): string | null {
  const choices = itemChoices(item.challenge);
  const onCard = choices.find(x => LEGEND_PHRASES.includes(norm(x.label)));
  if (onCard) return `the choice "${onCard.label}" is a sign on the card`;
  const key = keyValue(item.challenge);
  if (/\bsigns?\b/i.test(item.challenge.instruction) && SIGN_WORDS.test(keyLabel(item.challenge))
    && choices.filter(x => x.value !== key).every(x => !SIGN_WORDS.test(x.label)))
    return 'the right choice alone names a sign, so the card would single it out';
  return null;
}

/** Why the particle view may not be opened beside this item, or null. */
export function particleLeak(item: ReactionItem, molecules: readonly string[]): string | null {
  const names = new Set(molecules.map(norm));
  const hit = itemChoices(item.challenge).find(x => names.has(norm(x.label)));
  return hit ? `the choice "${hit.label}" is a molecule in the particle view` : null;
}

const EXPLAIN_TYPES = ['explain', 'balance', 'conservation'];
const wordsOf = (s: string) => new Set(norm(s).split(' ').filter(w => w.length >= 3));

/** The wrong choice `drop_far_choice` greys out now, or null when too few untried choices would be left. */
export function farChoice(item: ReactionItem, s: ReactionLeverState): string | null {
  const c = item.challenge;
  if (answerForm(c) !== 'choice') return null;
  const live = itemChoices(c).filter(x => !s.dropped.includes(x.value));
  const tried = Math.max(s.wrongs, new Set(s.picked).size);
  if (live.length - 1 - tried < 2) return null;
  const key = wordsOf(keyLabel(c)), keyId = keyValue(c);
  const foils = live.filter(x => x.value !== keyId && !s.picked.includes(x.value));
  if (!foils.length) return null;
  const shared = (label: string) => Array.from(wordsOf(label)).filter(w => key.has(w)).length;
  return [...foils].sort((a, b) => shared(a.label) - shared(b.label) || live.indexOf(b) - live.indexOf(a))[0].value;
}

/** The mode whose miss list an item's levers answer, from its challenge type. */
const modeOf = (item: ReactionItem): keyof typeof REACTION_MISSES =>
  item.stage === 'before' ? 'predict' : EXPLAIN_TYPES.includes(item.challenge.type) ? 'explain' : 'observe';

export interface LeverContext {
  reactionRun: boolean;
  animating: boolean;
  /** The particle view may be drawn at this grade band, and the reaction has molecules to show. */
  particleAllowed: boolean;
  particleOpen: boolean;
  molecules: readonly string[];
}

/** The levers this item declares, with their state. A lever that cannot be pulled now and was not pulled is left out. */
export function reactionLevers(item: ReactionItem | null | undefined, s: ReactionLeverState, ctx: LeverContext): WorkspaceLever[] {
  if (!item) return [];
  const on = (id: string) => s.pulled.includes(id);
  const misses = REACTION_MISSES[modeOf(item)];
  const levers: WorkspaceLever[] = [];
  if (on(LEGEND_LEVER) || (modeOf(item) !== 'explain' && !legendLeak(item))) levers.push({ id: LEGEND_LEVER, kind: 'help',
    carrier: 'shown', pulled: on(LEGEND_LEVER), answers: misses,
    when: 'The learner picks a wrong choice or is stuck, and does not know what to look for in a reaction.',
    does: `Shows a card beside the question: "${LEGEND_TITLE}", the seven signs with their pictures, none marked. Never say which sign this reaction shows, and never ask which choice matches a sign on the card: whether this reaction shows a sign at all is part of the question.` });
  if (item.stage === 'after' && ctx.reactionRun && (on(REPLAY_LEVER) || !ctx.animating)) levers.push({ id: REPLAY_LEVER, kind: 'help',
    carrier: 'shown', pulled: on(REPLAY_LEVER), answers: misses,
    when: 'The learner picks a wrong choice about what happened, or did not watch the reaction closely.',
    does: 'Plays the reaction again in the beaker. Ask the learner to watch; never say what to look for.' });
  if (modeOf(item) === 'explain' && ctx.reactionRun && ctx.particleAllowed && (on(PARTICLE_LEVER)
    || (!ctx.particleOpen && !particleLeak(item, ctx.molecules)))) levers.push({ id: PARTICLE_LEVER, kind: 'help',
    carrier: 'shown', pulled: on(PARTICLE_LEVER), answers: misses,
    when: 'The learner cannot say why the reaction happened, or mixes up what changes and what stays.',
    does: 'Opens the particle view to the right of the beaker: the reactant molecules, an arrow, the product molecules, with no caption. Say only where it is; never say what the particles do or turn into, or which choice they show.' });
  if (on(DROP_LEVER) || farChoice(item, s) !== null) levers.push({ id: DROP_LEVER, kind: 'simplify', carrier: 'shown',
    pulled: on(DROP_LEVER), answers: misses.filter((m): m is ReactionMiss => m !== 'true_false_flipped'),
    when: 'The learner still picks a wrong choice after help, or is stuck with too many choices.',
    does: 'Greys out one wrong choice that is easy to rule out, so fewer choices remain. The next answer counts as helped.' });
  return levers;
}

/** What the pulled levers put on screen, for the tutor and JEV. Names the greyed-out choice, never the key. */
export function leverFacts(item: ReactionItem, s: ReactionLeverState, ctx: Pick<LeverContext, 'animating'>): string | null {
  const parts: string[] = [];
  if (s.pulled.includes(LEGEND_LEVER)) parts.push(`a card beside the question lists "${LEGEND_TITLE}": `
    + `${SIGN_LEGEND.map(l => l.label.toLowerCase()).join(', ')}; none is marked`);
  if (s.pulled.includes(REPLAY_LEVER)) parts.push(ctx.animating ? 'the reaction is playing again in the beaker' : 'the reaction was played again');
  if (s.pulled.includes(PARTICLE_LEVER)) parts.push('the particle view is open to the right of the beaker, with no caption');
  const choices = itemChoices(item.challenge);
  for (const v of s.dropped) {
    const x = choices.find(ch => ch.value === v);
    if (x) parts.push(`choice ${x.letter}, "${x.label}", is greyed out and is not the answer`);
  }
  return parts.length ? parts.join('; ') : null;
}
