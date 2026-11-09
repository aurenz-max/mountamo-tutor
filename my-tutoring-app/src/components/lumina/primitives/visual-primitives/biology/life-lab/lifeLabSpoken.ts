/**
 * How a Life Lab child answers (`/agent-primitive` I11). The author sets `respond: show | say` per item, by the
 * nature of the problem; code checks it fits the answer and derives everything the tutor judges with. Pure: the boss,
 * the author's checks and the tests share it.
 *
 * A world's answer can be said when it is one named thing: the option picked by its look (a beak, a seed shape, any
 * declared part), a coloring, or a prediction. Moving animals, setting conditions, an order, a path and one of several
 * young told apart only by their looks are shown. A kit item can be said when it is a choice among cards that all carry
 * words. A sayable answer defaults to `say`, and the tap still counts (USER 2026-10-13: voice beside the tap).
 */
import type { KnownMiss } from '../../../../components/live-activity/runtime/spokenMissContract';
import type { SpokenKey } from '../../../../components/live-activity/spokenKey';
import type { SurfaceItem } from '../../../../service/agent-kit/surfaces';
import { beingOf, classify, nameOf, normalizeWorld, optionsOf, predictionKey, workingOptions, zoneOf, type LifeWorld } from './lifeLabWorld';

export const RESPONDS = ['show', 'say'] as const;
export type LifeRespond = typeof RESPONDS[number];
interface Spoken { world?: LifeWorld; item?: SurfaceItem; respond?: LifeRespond }

const traitControl = (w: LifeWorld) => normalizeWorld(w).controls.find(c => c.type === 'trait') as Extract<LifeWorld['controls'][number], { type: 'trait' }> | undefined;
const predictOf = (w: LifeWorld) => (normalizeWorld(w).controls.find(c => c.type === 'predict') as { of: string } | undefined)?.of;

/** Whether a kit item's answer is one thing a child can say: a choice among cards that all carry words. */
const itemSayable = (item: SurfaceItem) => item.surface === 'choose' && item.options.every(o => !!o.label?.trim());
const rightCard = (item: SurfaceItem) => item.options.find(o => o.id === item.key);

/** Whether the world's answer is one thing a child can say. */
export function sayable(w: LifeWorld): boolean {
  return !!traitControl(w) || w.goal.kind === 'prediction';
}
const canSay = (c: Spoken) => (c.item ? itemSayable(c.item) : sayable(c.world!));

/** The production the item uses: the author's, or `say` for a sayable answer and `show` otherwise. */
export const respondOf = (c: Spoken): LifeRespond => c.respond ?? (canSay(c) ? 'say' : 'show');

/** The production does not fit the answer, as a sentence the author can act on. */
export function respondError(c: Spoken): string | null {
  const r = respondOf(c);
  if (r === 'say' && !canSay(c)) return c.item
    ? 'the child picks this on the board (cards in order, a sort, or cards with no words): respond show'
    : 'the answer is moves, settings or an order, which a child cannot say: respond show';
  if (r === 'show' && canSay(c)) return c.item
    ? 'a child can say this answer (the words on one card): respond say, and the tap still counts'
    : 'a child can say this answer (one part, coloring or prediction): respond say, and the tap still counts';
  return null;
}

const preyName = (w: LifeWorld) => nameOf(w, predictOf(w) ?? '');

/** The spoken key, or null for a shown item. */
export function lifeSpokenKey(c: Spoken): SpokenKey | null {
  if (respondOf(c) !== 'say' || !canSay(c)) return null;
  if (c.item) {
    const right = rightCard(c.item);
    return right?.label ? { answer: right.label, alsoAccept: [], acceptRule: 'Any wording that names this card by what it says counts.' } : null;
  }
  const w = c.world!;
  if (w.goal.kind === 'prediction') {
    const key = predictionKey(w);
    if (!key) return null;
    const prey = preyName(w);
    return { answer: `more ${key} ${prey}s`, alsoAccept: [key, `the ${key} ones`, `${key} ${prey}s`, `more ${key}`],
      signatureError: 'Naming the other coloring, or both, is not this prediction.' };
  }
  const right = workingOptions(w), color = traitControl(w)?.part === 'color';
  if (!right.length) return null;
  return {
    answer: right[0].label,
    alsoAccept: Array.from(new Set([...right.slice(1).map(o => o.label), ...right.map(o => o.value).filter(v => v !== right[0].label), ...(color ? right.map(o => `${o.value} one`) : [])])),
    acceptRule: color ? 'Any wording that names this coloring counts.' : 'Any wording that names this option by its look counts ("the thick one").',
  };
}

/**
 * What the ask says by design: a camouflage world names its background ("on this sandy ground"), and matching the
 * coloring to that background is the skill, so the background's color may be heard in the ask.
 */
export function lifeGiven(c: Spoken): string[] {
  if (respondOf(c) !== 'say' || !c.world) return [];
  const tc = traitControl(c.world);
  const prey = tc?.part === 'color' ? tc.being : c.world.goal.kind === 'prediction' ? predictOf(c.world) : undefined;
  const bg = prey ? zoneOf(c.world, beingOf(c.world, prey)!.zone)?.cond.color : undefined;
  return bg ? [String(bg)] : [];
}

/** The wrong answers a child is likely to say on this item, named for the catalog's miss list. */
export function lifeSpokenMisses(c: Spoken): KnownMiss[] {
  if (!lifeSpokenKey(c)) return [];
  if (c.item) {
    const wrong = c.item.options.filter(o => o.id !== c.item!.key);
    return [{ id: 'wrong_choice', pattern: `The learner names ${wrong.map(o => `"${o.label}"`).join(' or ')}, which is not the card that fits.`, examples: wrong.map(o => o.label!) }];
  }
  const w = c.world!, mode = classify(w)?.mode;
  if (!mode) return [];
  if (w.goal.kind === 'prediction') {
    const key = predictionKey(w)!;
    const other = (beingOf(w, predictOf(w)!)?.variants ?? []).map(v => v.value).find(v => v !== key)!;
    return [{ id: 'wrong_prediction', pattern: `The learner predicts more ${other} ones: the coloring the hunter can see.`, examples: [other, `more ${other}`] }];
  }
  const right = workingOptions(w).map(o => o.value), wrong = optionsOf(w).filter(o => !right.includes(o.value));
  const id = mode === 'hide_from_the_hunter' ? 'seen_by_hunter' : 'wrong_part';
  return [{ id, pattern: `The learner names ${wrong.map(o => `"${o.label}"`).join(' or ')}, which does not work here.`, examples: wrong.map(o => o.label) }];
}

/** The journey's spoken answers: the key's own words, and a plainly wrong one of the same kind. */
export function lifeSay(c: Spoken): { correct: string; plainWrong: string } {
  const key = lifeSpokenKey(c);
  if (!key) throw new Error('life-lab: a shown item has nothing to say');
  if (c.item) return { correct: key.answer, plainWrong: c.item.options.find(o => o.id !== c.item!.key)!.label! };
  const w = c.world!;
  if (w.goal.kind === 'prediction') {
    const k = predictionKey(w)!;
    const other = (beingOf(w, predictOf(w)!)?.variants ?? []).map(v => v.value).find(v => v !== k)!;
    return { correct: key.answer, plainWrong: `more ${other} ${preyName(w)}s` };
  }
  const right = workingOptions(w).map(o => o.value);
  return { correct: key.answer, plainWrong: optionsOf(w).find(o => !right.includes(o.value))!.label };
}
