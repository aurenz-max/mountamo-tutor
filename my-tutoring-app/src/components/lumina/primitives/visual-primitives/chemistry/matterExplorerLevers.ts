/**
 * The in-item levers on matter-explorer (`/add-support-tiers`, report qa/eval-reports/matter-explorer-levers-2026-10-08.md).
 * No real-learner evidence: the misses are what `matterSpokenMisses` names on each mode's spoken answer.
 *
 * Every answer is said out loud, and the scene must never classify the item's object. So no lever marks the item:
 * help draws MODELS beside it (other everyday things, never one the lesson carries), and simplify opens a practice
 * item `<item>~simpler` on a plainer thing.
 *
 * - sort, mystery: `three_models` (help) a solid, a liquid and a gas from everyday life, each drawn in a cup and tagged
 *   with its state and what it does there. `plain_object` (simplify) a practice item on a plain everyday thing with the
 *   three state words named in the ask (mystery: clues that point at the state, e.g. "it feels wet").
 * - property: `three_models` tagged with what each does in a cup, no state word. `plain_object` a practice item on a
 *   plain thing whose ask names two options, its answer and the far one, instead of three.
 * - change: `two_changes` (help) one model change that can go back and one that cannot, each tagged with why. Never the
 *   item's own change. No simplify: one premise and two options is the plainest shape of the ask.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import {
  CHANGE_CATALOG,
  CHANGE_OPTIONS,
  nameCarriesAnswer,
  PROPERTY_OPTIONS,
  SHAPE_OF_STATE,
  type EverydayChange,
  type MatterExplorerItem,
  type MatterState,
  type Reversibility,
  type ShapeBehaviour,
} from './matterExplorerScript';
import type { SpokenMatterMiss } from './matterExplorerWorkspace';

export const THREE_MODELS_LEVER = 'three_models';
export const TWO_CHANGES_LEVER = 'two_changes';
export const PLAIN_OBJECT_LEVER = 'plain_object';
export const PRACTICE_SUFFIX = '~simpler';

/** What a lever reads beyond the item: the name of every object the lesson carries, asked or not. */
export interface MatterLeverSession { objectNames: readonly string[] }

export const matterLeverSession = (data: { objects?: readonly { name?: string }[] }): MatterLeverSession =>
  ({ objectNames: (data.objects ?? []).map(o => (o.name ?? '').trim()).filter(Boolean) });

const seedOf = (id: string) => Array.from(id).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const rotate = <T,>(list: readonly T[], id: string) => { const at = seedOf(id) % list.length; return [...list.slice(at), ...list.slice(0, at)]; };
const words = (t: string) => t.toLowerCase().replace(/[^a-z]+/g, ' ').split(' ')
  .filter(w => w.length >= 3 && w !== 'the').map(w => w.replace(/s$/, ''));

/** A model or practice thing collides when it shares a word with any object of the lesson ("garden rock" and "rock"). */
export const collides = (name: string, s: MatterLeverSession) => {
  const mine = new Set(words(name));
  return s.objectNames.some(n => words(n).some(w => mine.has(w)));
};

// ── three_models (sort, property, mystery) ─────────────────────────────────

export interface MatterModel { name: string; icon: string; state: MatterState }

/** Plain everyday things, none of them an edge case (no sand, honey or fog). */
export const PLAIN_THINGS: Readonly<Record<MatterState, readonly { name: string; icon: string }[]>> = {
  solid: [{ name: 'rock', icon: '🪨' }, { name: 'wooden block', icon: '🧱' }, { name: 'spoon', icon: '🥄' }, { name: 'coin', icon: '🪙' }],
  liquid: [{ name: 'milk', icon: '🥛' }, { name: 'apple juice', icon: '🧃' }, { name: 'lemonade', icon: '🍋' }, { name: 'water', icon: '💧' }],
  gas: [{ name: 'air', icon: '🌬️' }, { name: 'smoke', icon: '💨' }, { name: 'steam', icon: '♨️' }],
};
const STATES: readonly MatterState[] = ['solid', 'liquid', 'gas'];

/** One model per state, none of them an object the lesson carries. Null when a state has none left. */
export function modelsFor(item: MatterExplorerItem, s: MatterLeverSession): MatterModel[] | null {
  if (item.kind === 'name_undo') return null;
  const picked = STATES.map(state => {
    const thing = rotate(PLAIN_THINGS[state], item.id).find(t => !collides(t.name, s) && !collides(t.name, { objectNames: [item.objectName] }));
    return thing ? { ...thing, state } : null;
  });
  return picked.every(Boolean) ? (picked as MatterModel[]) : null;
}

/** The tag under a model: its state and cup behaviour, or (property) its cup behaviour only. */
export const modelTag = (item: MatterExplorerItem, m: MatterModel) =>
  item.kind === 'name_property' ? PROPERTY_OPTIONS[SHAPE_OF_STATE[m.state]].phrase
    : `a ${m.state}: ${PROPERTY_OPTIONS[SHAPE_OF_STATE[m.state]].phrase}`;

/** Leak rule for models: exactly one per state, and none of them shares a word with the item or a lesson object. */
export const modelsLeak = (models: readonly MatterModel[], item: MatterExplorerItem, s: MatterLeverSession) =>
  STATES.some(st => models.filter(m => m.state === st).length !== 1)
  || models.some(m => collides(m.name, s) || collides(m.name, { objectNames: [item.objectName] }));

// ── two_changes (change) ───────────────────────────────────────────────────

export interface ChangeModel { name: string; icon: string; change: EverydayChange; reversibility: Reversibility }

/** Code-owned model changes. Each pair fits `changeFitsObject` by construction (melt/freeze need a changeable thing). */
export const MODEL_CHANGES: readonly ChangeModel[] = [
  { name: 'chocolate', icon: '🍫', change: 'melt', reversibility: 'can_go_back' },
  { name: 'butter', icon: '🧈', change: 'melt', reversibility: 'can_go_back' },
  { name: 'apple juice', icon: '🧃', change: 'freeze', reversibility: 'can_go_back' },
  { name: 'lemonade', icon: '🍋', change: 'freeze', reversibility: 'can_go_back' },
  { name: 'egg', icon: '🍳', change: 'cook', reversibility: 'changed_for_ever' },
  { name: 'cake batter', icon: '🎂', change: 'bake', reversibility: 'changed_for_ever' },
  { name: 'log', icon: '🪵', change: 'burn', reversibility: 'changed_for_ever' },
  { name: 'old nail', icon: '🔩', change: 'rust', reversibility: 'changed_for_ever' },
  { name: 'paper bag', icon: '🛍️', change: 'tear', reversibility: 'changed_for_ever' },
];

/** One model change that can go back and one that cannot, never the item's own change or a lesson object. */
export function changesFor(item: MatterExplorerItem, s: MatterLeverSession): [ChangeModel, ChangeModel] | null {
  if (item.kind !== 'name_undo' || !item.change) return null;
  const pick = (r: Reversibility) => rotate(MODEL_CHANGES.filter(m => m.reversibility === r), item.id)
    .find(m => m.change !== item.change && !collides(m.name, s) && !collides(m.name, { objectNames: [item.objectName] }));
  const back = pick('can_go_back'), ever = pick('changed_for_ever');
  return back && ever ? [back, ever] : null;
}

/** Leak rule for change models: one of each kind, neither the item's change, neither a lesson object. */
export const changesLeak = (pair: readonly ChangeModel[], item: MatterExplorerItem, s: MatterLeverSession) =>
  pair.length !== 2 || pair[0].reversibility === pair[1].reversibility
  || pair.some(m => m.change === item.change || collides(m.name, s) || collides(m.name, { objectNames: [item.objectName] }));

export const changeLine = (m: ChangeModel) => `${CHANGE_CATALOG[m.change].storyFor(m.name)}.`;
export const changeTag = (m: ChangeModel) => `${CHANGE_OPTIONS[m.reversibility].phrase}: ${CHANGE_CATALOG[m.change].because}`;

// ── plain_object (sort, property, mystery simplify) ────────────────────────

/** Mystery practice: clues that point at the state, still never a state, shape or flow word. */
export const PLAIN_MYSTERIES: readonly { name: string; state: MatterState; clues: string[] }[] = [
  { name: 'wooden block', state: 'solid', clues: ['it looks brown', 'it feels hard', 'you can stack it in a tower'] },
  { name: 'coin', state: 'solid', clues: ['it looks shiny', 'it feels hard and cold', 'it fits in your pocket'] },
  { name: 'milk', state: 'liquid', clues: ['it looks white', 'it feels wet', 'you drink it from a glass'] },
  { name: 'lemonade', state: 'liquid', clues: ['it looks yellow', 'it feels wet and cold', 'you drink it through a straw'] },
  { name: 'smoke', state: 'gas', clues: ['it looks grey', 'it floats up from a campfire', 'you cannot hold it in your hand'] },
];

/** The far option for a two-option practice menu: the cup behaviour least like the answer. */
const FAR_SHAPE: Readonly<Record<ShapeBehaviour, ShapeBehaviour>> = {
  keeps_shape: 'fills_space', takes_container: 'fills_space', fills_space: 'keeps_shape',
};

const isPlain = (name: string) => STATES.some(st => PLAIN_THINGS[st].some(t => t.name === name.toLowerCase().trim()));

/**
 * The practice item for a sort, property or mystery item: a plain thing that is no object of the lesson and no model
 * this item draws. Sort and mystery ask at the easy tier, so the three state words are named; property names two
 * options. Null on a sort item that is already a plain thing asked at the easy tier (nothing simpler exists), on a
 * change item, or when every plain thing collides.
 */
export function practiceItem(item: MatterExplorerItem, s: MatterLeverSession): MatterExplorerItem | null {
  if (item.kind === 'name_undo') return null;
  if (item.kind === 'name_state' && item.tier === 'easy' && isPlain(item.objectName)) return null;
  const taken = { objectNames: [...s.objectNames, item.objectName, ...(modelsFor(item, s) ?? []).map(m => m.name)] };
  const base = { ...item, id: `${item.id}${PRACTICE_SUFFIX}`, objectId: `${item.objectId}${PRACTICE_SUFFIX}`, tier: 'easy' as const,
    clues: undefined, change: undefined, answerUndo: undefined, menu: undefined };
  let built: MatterExplorerItem | null = null;
  if (item.kind === 'mystery_state') {
    const m = rotate(PLAIN_MYSTERIES, item.id).find(t => !collides(t.name, taken));
    if (m) built = { ...base, objectName: m.name, answerState: m.state, answerShape: SHAPE_OF_STATE[m.state], clues: [...m.clues] };
  } else {
    const all = STATES.flatMap(st => PLAIN_THINGS[st].map(t => ({ ...t, state: st })));
    const t = rotate(all, item.id).find(x => !collides(x.name, taken));
    if (t) {
      const shape = SHAPE_OF_STATE[t.state];
      built = { ...base, objectName: t.name, answerState: t.state, answerShape: shape,
        ...(item.kind === 'name_property' ? { menu: [shape, FAR_SHAPE[shape]] } : {}) };
    }
  }
  return built && !practiceLeaks(built, item, s) ? built : null;
}

/** The session item a practice id stands in for. */
export const practiceParent = (id: string, items: readonly MatterExplorerItem[]) =>
  items.find(i => `${i.id}${PRACTICE_SUFFIX}` === id) ?? null;

/**
 * Leak rule for a practice item: a new id, the same kind, a thing that is no object of the lesson, a name and clues
 * with no state, shape or flow word, and (property) a two-option menu that holds its answer.
 */
export function practiceLeaks(practice: MatterExplorerItem, item: MatterExplorerItem, s: MatterLeverSession): boolean {
  if (practice.id === item.id || practice.kind !== item.kind) return true;
  if (collides(practice.objectName, s) || collides(practice.objectName, { objectNames: [item.objectName] })) return true;
  if (nameCarriesAnswer(practice.objectName) || (practice.clues ?? []).some(c => nameCarriesAnswer(c))) return true;
  if (SHAPE_OF_STATE[practice.answerState] !== practice.answerShape) return true;
  if (practice.kind === 'name_property' && (practice.menu?.length !== 2 || !practice.menu.includes(practice.answerShape))) return true;
  return false;
}

// ── what is on screen ──────────────────────────────────────────────────────

/** What the pulled levers put on screen, for the tutor and JEV: what is drawn, never this item's answer. */
export function leversOnScreen(item: MatterExplorerItem, on: readonly string[], s: MatterLeverSession): string | null {
  const parts: string[] = [];
  const models = on.includes(THREE_MODELS_LEVER) ? modelsFor(item, s) : null;
  if (models) {
    const where = item.kind === 'mystery_state' ? 'the covered box' : `the ${item.objectName}`;
    parts.push(`beside ${where}, three model things that are not this item, each drawn in a cup and tagged: `
      + `${models.map(m => `${m.name} (${modelTag(item, m)})`).join('; ')}. Nothing marks which one the item is like`);
  }
  const pair = on.includes(TWO_CHANGES_LEVER) ? changesFor(item, s) : null;
  if (pair) {
    parts.push(`under the ${item.objectName}, two model changes that are not this item, each tagged: `
      + `${pair.map(m => `"${changeLine(m).replace(/\.$/, '')}" (${changeTag(m)})`).join('; ')}. Nothing marks which one the item is like`);
  }
  return parts.length ? parts.join('; ') : null;
}

// ── the levers ─────────────────────────────────────────────────────────────

const MISSES: Record<MatterExplorerItem['kind'], SpokenMatterMiss[]> = {
  name_state: ['other_state', 'said_object_back'],
  mystery_state: ['other_state'],
  name_property: ['other_shape', 'state_word'],
  name_undo: ['other_way', 'said_change_back', 'state_word'],
};

export function matterLevers(item: MatterExplorerItem | null, s: MatterLeverSession, pulled: readonly string[]): WorkspaceLever[] {
  if (!item) return [];
  const answers = MISSES[item.kind];
  const levers: WorkspaceLever[] = [];
  const add = (id: string, kind: WorkspaceLever['kind'], when: string, does: string) =>
    levers.push({ id, kind, carrier: 'both', pulled: pulled.includes(id), answers, when, does });
  if (item.kind === 'name_undo') {
    if (changesFor(item, s)) add(TWO_CHANGES_LEVER, 'help',
      'The learner picks the wrong way, says the change back, or says a state word.',
      'Shows two model changes from everyday life under the item, never this item\'s change: one tagged "it can go back the way it was" '
      + 'and one tagged "it is changed for ever", each with why. Read them if you like. Never say which model the learner\'s change is '
      + 'like, or whether the learner\'s change can go back.');
    return levers;
  }
  const property = item.kind === 'name_property';
  if (modelsFor(item, s)) add(THREE_MODELS_LEVER, 'help',
    property ? 'The learner picks another thing the question offered, or says a state word.'
      : item.kind === 'mystery_state' ? 'The learner names another state.' : 'The learner names another state, or says the object\'s name back.',
    `Draws three model things from everyday life beside the item, none of them in this lesson, each in a cup and tagged with `
    + `${property ? 'what it does there' : 'its state and what it does there'}. Read the tags if you like. Never say which model the `
    + `${item.kind === 'mystery_state' ? 'secret thing' : 'learner\'s object'} is like, or what it does in a cup.`);
  if (practiceItem(item, s)) add(PLAIN_OBJECT_LEVER, 'simplify', 'The learner still cannot answer after help.',
    property ? 'Opens an easier practice item first: a plain everyday thing, and the question offers two choices instead of three. '
      + 'Not graded; the full item comes back after it.'
      : item.kind === 'mystery_state' ? 'Opens an easier practice item first: a secret plain everyday thing with clues that point at it, '
        + 'and the question names the three states. Not graded; the full item comes back after it.'
        : 'Opens an easier practice item first: a plain everyday thing, and the question names the three states. '
          + 'Not graded; the full item comes back after it.');
  return levers;
}
