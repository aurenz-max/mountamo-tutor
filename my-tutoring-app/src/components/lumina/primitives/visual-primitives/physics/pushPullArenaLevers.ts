/**
 * The in-item levers on push-pull-arena (`/add-support-tiers`, report `qa/eval-reports/push-pull-arena-levers-2026-10-08.md`).
 * Every answer is one spoken word computed from the sim; no lever says it, draws it or turns the ask into a choice.
 *
 * - `mark_the_hand` (observe, help, shown): a hand at the arena's left edge, where every force comes from. The same
 *   picture on a push item and a pull item; the learner still watches whether the object goes away or comes closer.
 * - `push_pull_model` (observe, help, both): push and pull on a cart and a sled, never the item's object. Both words
 *   together, never one.
 * - `show_the_setup` (predict, compare, design; help, shown): one weight block per kilogram under each object; for
 *   predict and design the surface's grip as bumps; for predict the coming push as marks. What is drawn, never which
 *   one wins.
 * - `same_push_model` (compare, help, both): two other things given the same push, with their weight blocks and their
 *   tracks. Never the item's objects.
 * - `easier_item` (predict, compare, design; simplify): an ungraded item of the same mode, on objects the session
 *   never uses, with a decisive margin: an extreme setup on another surface (predict, design), or 1 kg against 10 kg
 *   (compare). Observe has none: one object and one force is already its plainest shape.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { FRICTION_MU, SURFACE_SPOKEN, itemFromChallenge, type ArenaItem, type ArenaSurfaceId } from './pushPullArenaScript';
import type { PushPullChallenge } from './PushPullArena';
import type { SpokenPushPullMiss } from './pushPullArenaWorkspace';

export const HAND_LEVER = 'mark_the_hand';
export const FORCE_MODEL_LEVER = 'push_pull_model';
export const SETUP_LEVER = 'show_the_setup';
export const SAME_PUSH_MODEL_LEVER = 'same_push_model';
export const EASIER_LEVER = 'easier_item';
/** A practice item's id is its parent's plus this. */
export const ARENA_SIMPLER = '~simpler';

interface Thing { name: string; weight: number; emoji: string }
/** Practice and model objects, none in the generator's OBJECT_LIBRARY. */
const LIGHT: Thing[] = [{ name: 'Feather', weight: 1, emoji: '🪶' }, { name: 'Balloon', weight: 1, emoji: '🎈' }, { name: 'Leaf', weight: 1, emoji: '🍃' }];
const HEAVY: Thing[] = [{ name: 'Couch', weight: 10, emoji: '🛋️' }, { name: 'Piano', weight: 10, emoji: '🎹' }, { name: 'Bathtub', weight: 10, emoji: '🛁' }];
/** observe's model: a cart pushed away, a sled pulled closer. */
export const FORCE_MODEL = { push: { name: 'cart', emoji: '🛒' }, pull: { name: 'sled', emoji: '🛷' } } as const;

/** The surface's grip, drawn as bumps: none on ice, most on carpet. */
export const GRIP_BUMPS: Record<ArenaSurfaceId, number> = { ice: 0, wood: 2, grass: 4, carpet: 5 };

const low = (s: string | undefined) => (s ?? '').trim().toLowerCase();
/** Every object name the session uses. */
export const arenaSessionNames = (session: readonly PushPullChallenge[]) =>
  new Set(session.flatMap(c => [c.objectName, c.object2Name]).map(low).filter(Boolean));
const offSession = (things: Thing[], used: Set<string>) => things.filter(t => !used.has(low(t.name)));

/** compare's model pair (a light and a heavy thing off the session), or null. Taken from the end of the lists, so it
 *  is not the practice pair. */
export function samePushModel(session: readonly PushPullChallenge[]): { light: Thing; heavy: Thing } | null {
  const used = arenaSessionNames(session);
  const light = offSession(LIGHT, used).at(-1), heavy = offSession(HEAVY, used).at(-1);
  return light && heavy ? { light, heavy } : null;
}

const instructionFor = (c: Pick<PushPullChallenge, 'type' | 'objectName'>) =>
  c.type === 'predict' ? `Think first: will the ${c.objectName} move, or stay?`
    : c.type === 'compare' ? 'Same push for both. Which one slides farther?'
      : `What kind of push does the ${c.objectName} need? Try it!`;

/**
 * The easier practice item: same mode, objects the session never uses, a decisive margin. predict and design move to
 * an extreme setup on ANOTHER surface (off ice: a 1 kg thing on ice; on ice: a 10 kg thing on carpet); compare puts
 * 1 kg against 10 kg on the item's surface, and is null when the item's gap is already 7 kg or more. Null for observe.
 */
export function arenaPracticeItem(parent: PushPullChallenge, session: readonly PushPullChallenge[]):
  { challenge: PushPullChallenge; item: ArenaItem } | null {
  if (parent.type === 'observe') return null;
  const used = arenaSessionNames(session);
  const light = offSession(LIGHT, used)[0], heavy = offSession(HEAVY, used)[0];
  const id = `${parent.id}${ARENA_SIMPLER}`;
  let challenge: PushPullChallenge;
  if (parent.type === 'compare') {
    if (Math.abs((parent.object2Weight ?? 0) - parent.objectWeight) >= 7 || !light || !heavy) return null;
    challenge = { id, type: 'compare', instruction: '', objectName: heavy.name, objectWeight: heavy.weight, objectEmoji: heavy.emoji,
      object2Name: light.name, object2Weight: light.weight, object2Emoji: light.emoji, surface: parent.surface,
      pushStrength: parent.pushStrength ?? 5, pushDirection: 'push' };
  } else {
    const onIce = parent.surface === 'ice';
    const thing = onIce ? heavy : light;
    if (!thing) return null;
    const surface: ArenaSurfaceId = onIce ? 'carpet' : 'ice';
    challenge = { id, type: parent.type, instruction: '', objectName: thing.name, objectWeight: thing.weight, objectEmoji: thing.emoji,
      surface, pushDirection: 'push', pushStrength: parent.type === 'predict' ? (onIce ? 1 : 10) : 5,
      ...(parent.type === 'design' ? { goalDescription: `Move the ${thing.name} all the way across ${SURFACE_SPOKEN[surface]}.` } : {}) };
  }
  challenge.instruction = instructionFor(challenge);
  challenge.showForceArrows = parent.showForceArrows;
  challenge.showMotionReadout = parent.showMotionReadout;
  const item = itemFromChallenge(challenge);
  return item && !practiceLeak(challenge, parent, session) ? { challenge, item } : null;
}

/** Leak rule for a practice item: another mode, the parent's id, a session object, or (predict, design) the parent's surface. */
export function practiceLeak(practice: PushPullChallenge, parent: PushPullChallenge, session: readonly PushPullChallenge[]): boolean {
  const used = arenaSessionNames(session);
  return practice.type !== parent.type || practice.id === parent.id
    || [practice.objectName, practice.object2Name].some(n => n && used.has(low(n)))
    || (parent.type !== 'compare' && practice.surface === parent.surface);
}

const has = (text: string, word: RegExp) => word.test(text.toLowerCase());
const PAIR: Record<string, [RegExp, RegExp]> = {
  push: [/\bpush/, /\bpull/], pull: [/\bpull/, /\bpush/],
  moves: [/\bmov/, /\bstay/], stays: [/\bstay/, /\bmov/],
  big: [/\bbig\b/, /\blittle\b/], little: [/\blittle\b/, /\bbig\b/],
};
/** Words that carry a design or compare answer without saying it. */
const HINT = /\b(heav\w*|light(er|est)?|grippy|slippery|strong\w*|gentle|farther|further|lighter)\b/;

/**
 * The leak rule every lever's text (its `does` and its scene fact) passes, per mode. A two-word ask (push or pull,
 * moves or stays, big or little) leaks when the text says the item's answer word without the other one; design also
 * leaks on a weight or grip adjective. compare leaks when the text names one of the item's objects and not the other,
 * or names them beside a comparative.
 */
export function leverTextLeaks(text: string, item: ArenaItem): boolean {
  if (item.kind === 'compare') {
    const a = has(text, new RegExp(`\\b${low(item.objectName)}\\b`)), b = has(text, new RegExp(`\\b${low(item.object2Name)}\\b`));
    return a !== b || ((a || b) && has(text, HINT));
  }
  const pair = PAIR[low(item.spokenAnswer)];
  if (pair && has(text, pair[0]) && !has(text, pair[1])) return true;
  return item.kind === 'design' && has(text, HINT);
}

const blocks = (n: number) => `${n} weight block${n === 1 ? '' : 's'}`;
const bumps = (s: ArenaSurfaceId) => GRIP_BUMPS[s] ? `${SURFACE_SPOKEN[s]} drawn with ${GRIP_BUMPS[s]} bumps` : `${SURFACE_SPOKEN[s]} drawn smooth, with no bumps`;

/** What the pulled help levers put on screen, for the tutor and JEV. What is drawn, never which way it comes out. */
export function arenaLeversOnScreen(challenge: PushPullChallenge, pulled: readonly string[], session: readonly PushPullChallenge[]): string | null {
  const parts: string[] = [];
  if (pulled.includes(HAND_LEVER)) parts.push('a hand at the left edge of the arena, where the force comes from (the same picture on every item)');
  if (pulled.includes(FORCE_MODEL_LEVER)) parts.push(`a model on other things: a hand and a ${FORCE_MODEL.push.name} that goes away from it, marked push; `
    + `a hand and a ${FORCE_MODEL.pull.name} that comes closer to it, marked pull. It is not this item`);
  if (pulled.includes(SETUP_LEVER)) {
    const setup = [`under the ${challenge.objectName}, ${blocks(challenge.objectWeight)}`];
    if (challenge.type === 'compare' && challenge.object2Name) setup.push(`under the ${challenge.object2Name}, ${blocks(challenge.object2Weight ?? 0)}`);
    else setup.push(bumps(challenge.surface));
    if (challenge.type === 'predict') setup.push(`the coming push drawn as ${challenge.pushStrength ?? 5} marks`);
    parts.push(setup.join('; '));
  }
  const model = pulled.includes(SAME_PUSH_MODEL_LEVER) ? samePushModel(session) : null;
  if (model) parts.push(`a model on other things: a ${low(model.light.name)} with ${blocks(model.light.weight)} and a ${low(model.heavy.name)} with `
    + `${blocks(model.heavy.weight)} got the same push; the ${low(model.light.name)}'s track is long and the ${low(model.heavy.name)}'s track is short. `
    + 'It is not this item');
  return parts.length ? parts.join('; ') : null;
}

/** The levers this item declares, with their state. */
export function arenaLevers(challenge: PushPullChallenge | null, pulled: readonly string[], session: readonly PushPullChallenge[]): WorkspaceLever[] {
  if (!challenge) return [];
  const levers: WorkspaceLever[] = [];
  const add = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: readonly SpokenPushPullMiss[], when: string, does: string) =>
    levers.push({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  switch (challenge.type) {
    case 'observe':
      add(HAND_LEVER, 'help', 'shown', ['opposite_force', 'described_motion'], 'The learner gives the other force word, or describes the motion with no force word.',
        'Draws a hand at the left edge of the arena, where the force comes from. The learner presses Go again and watches the object against it.');
      add(FORCE_MODEL_LEVER, 'help', 'both', ['opposite_force', 'described_motion'], 'The learner still mixes up the two force words.',
        `Shows push and pull on a ${FORCE_MODEL.push.name} and a ${FORCE_MODEL.pull.name}, not this item. Say the model through; never say which way the learner's object went or which word fits it.`);
      break;
    case 'predict':
      add(SETUP_LEVER, 'help', 'shown', ['opposite_outcome'], 'The learner gives the other outcome.',
        'Draws the object\'s weight as blocks, the surface\'s grip as bumps and the coming push as marks. Nothing runs; say what is drawn, never what happens.');
      break;
    case 'compare':
      add(SETUP_LEVER, 'help', 'shown', ['other_object'], 'The learner names the other object.',
        'Draws each object\'s weight as blocks under it. Say what is drawn; never say which one wins.');
      if (samePushModel(session)) add(SAME_PUSH_MODEL_LEVER, 'help', 'both', ['other_object'], 'The learner still names the other object after the blocks.',
        'Shows two other things given the same push, with their weight blocks and their tracks, not this item. Say the model through; never say which of the learner\'s two objects goes farther.');
      break;
    case 'design':
      add(SETUP_LEVER, 'help', 'shown', ['opposite_size'], 'The learner gives the other push size.',
        'Draws the object\'s weight as blocks and the surface\'s grip as bumps. The learner can still try pushes; say what is drawn, never the size it needs.');
      break;
  }
  if (arenaPracticeItem(challenge, session)) add(EASIER_LEVER, 'simplify', 'shown',
    challenge.type === 'predict' ? ['opposite_outcome'] : challenge.type === 'compare' ? ['other_object'] : ['opposite_size'],
    'The learner still misses after help.',
    'Opens an easier practice item first: the same question on other things, with a clearer setup. Not graded; the full item comes back after it.');
  return levers;
}
