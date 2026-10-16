/**
 * The in-item levers on telescope-simulator (`/add-support-tiers`; report
 * qa/eval-reports/telescope-simulator-levers-2026-10-16.md). No real-learner evidence: the misses are what
 * `telescopeMiss` observes. Every lever starts released; `config.difficulty` changes the items, not the levers.
 *
 * - `closer_look` (help; find_by_look, object_type): the same view through the next stronger instrument, every object
 *   bigger and sharper. On find_by_look only where the ask still matches one object there.
 * - `clue_pictures` (help; find_by_look): a card with a small model picture for each clue in the ask (a ring, stripes,
 *   a twinkle, a colour swatch). Models only: never an object of the view, never a position.
 * - `same_size` (help; brightest, sizes differ): every object drawn as a dot of the same size, keeping its brightness.
 * - `side_by_side` (help; brightest): the objects again in a row under the view, in their left-to-right order in the
 *   sky, the same size, each as bright as it shines. Never sorted by brightness.
 * - `type_pictures` (help; object_type): a card with a simple model picture of each kind offered, captioned with the
 *   kind. None is this object.
 * - `ladder` (help; pick_instrument): the five instruments from least to most powerful, with how much bigger each makes
 *   things look. Names no object and no detail.
 * - `my_pick_view` (help; pick_instrument, after a tapped wrong choice): the object drawn through the learner's own last
 *   pick, with whether the asked detail shows there.
 * - `drop_one` (simplify; on the item, user ruling 09-27: a removed choice is assisted work): greys out one wrong object
 *   or choice that is easy to rule out, while at least two untried ones remain.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import {
  brightFootprint, brightness, choiceKey, choiceLabel, cluesShown, clueTags, detailDef, FAMILY, findMatches, isTapItem,
  choiceMiss, KIND_TEXT, objectDef, SCOPE_TEXT, SCOPES, scopeRank, tapKey, tapMiss, TELESCOPE_MISSES, viewLook,
  type Kind, type Scope, type TelescopeItem, type TelescopeMiss,
} from './telescopeWorkspace';

export const CLOSER_LEVER = 'closer_look';
export const CLUE_PICTURES_LEVER = 'clue_pictures';
export const SAME_SIZE_LEVER = 'same_size';
export const SIDE_BY_SIDE_LEVER = 'side_by_side';
export const TYPE_PICTURES_LEVER = 'type_pictures';
export const LADDER_LEVER = 'ladder';
export const MY_PICK_LEVER = 'my_pick_view';
export const DROP_LEVER = 'drop_one';

/** Per session item: the levers pulled, what is greyed out, the wrong picks tried, and the learner's last wrong instrument. */
export interface TelescopeLeverState {
  pulled: readonly string[];
  /** Object indexes (find, brightest) or choice indexes (kind, instrument) greyed out. */
  dropped: readonly number[];
  /** Indexes tried wrong, in the same space as `dropped`. */
  picked: readonly number[];
  wrongs: number;
  lastPick: Scope | null;
}
export const NO_LEVERS: TelescopeLeverState = { pulled: [], dropped: [], picked: [], wrongs: 0, lastPick: null };

export const strongerScope = (s: Scope): Scope | null => SCOPES[scopeRank(s) + 1] ?? null;

/** closer_look can be pulled: a stronger instrument exists and, on find_by_look, the ask still names one object there. */
export function closerOk(item: TelescopeItem): boolean {
  if (item.mode !== 'find_by_look' && item.mode !== 'object_type') return false;
  const next = strongerScope(item.scope);
  if (!next) return false;
  if (item.mode === 'object_type') return true;
  const m = findMatches(item, next);
  return m.length === 1 && m[0] === tapKey(item);
}

/** The instrument the view is drawn through, with the levers pulled. */
export function viewScope(item: TelescopeItem, s: TelescopeLeverState): Scope {
  if (item.mode === 'pick_instrument') return s.pulled.includes(MY_PICK_LEVER) && s.lastPick ? s.lastPick : 'eyes';
  return s.pulled.includes(CLOSER_LEVER) && closerOk(item) ? strongerScope(item.scope)! : item.scope;
}

/** brightest: the objects are drawn at different sizes (a dot's glow grows with brightness; patches are big). */
const sizesDiffer = (item: TelescopeItem) => item.mode === 'brightest'
  && new Set(item.objects.map(p => Math.round(brightFootprint(objectDef(p.object)!)))).size > 1;

const keyIndexOf = (item: TelescopeItem) => (isTapItem(item) ? tapKey(item) : (item.choices as string[]).indexOf(choiceKey(item)));
const optionCount = (item: TelescopeItem) => (isTapItem(item) ? item.objects.length : item.choices.length);

/**
 * The option `drop_one` greys out now, or null when fewer than two untried options would be left. find_by_look: the
 * object showing the fewest clues; brightest: the dimmest; object_type: a kind of the other family; pick_instrument: the
 * instrument farthest from the key. On a tie, the last one.
 */
export function dropTarget(item: TelescopeItem, s: TelescopeLeverState): number | null {
  const n = optionCount(item), key = keyIndexOf(item);
  const live = Array.from({ length: n }, (_, i) => i).filter(i => !s.dropped.includes(i));
  const tried = Math.max(s.wrongs, new Set(s.picked).size);
  if (live.length - 1 - tried < 2) return null;
  const foils = live.filter(i => i !== key && !s.picked.includes(i));
  if (!foils.length) return null;
  const distance = (i: number): number => {
    if (item.mode === 'find_by_look') return -cluesShown(item, i);
    if (item.mode === 'brightest') return -brightness(objectDef(item.objects[i].object)!);
    if (item.mode === 'object_type') return FAMILY[item.choices[i]] !== FAMILY[choiceKey(item) as Kind] ? 1 : 0;
    return Math.abs(scopeRank(item.choices[i]) - scopeRank(choiceKey(item) as Scope));
  };
  return [...foils].sort((a, b) => distance(b) - distance(a) || b - a)[0];
}

const lever = (id: string, kind: WorkspaceLever['kind'], s: TelescopeLeverState, answers: readonly TelescopeMiss[], when: string, does: string): WorkspaceLever =>
  ({ id, kind, carrier: 'shown', pulled: s.pulled.includes(id), answers, when, does });

/** The levers this item declares, with their state. One that cannot be pulled now and was not pulled is left out. */
export function telescopeLevers(item: TelescopeItem | undefined, s: TelescopeLeverState): WorkspaceLever[] {
  if (!item) return [];
  const on = (id: string) => s.pulled.includes(id);
  const out: WorkspaceLever[] = [];
  const all = TELESCOPE_MISSES[item.mode];
  if (item.mode === 'find_by_look') {
    if (on(CLOSER_LEVER) || closerOk(item)) out.push(lever(CLOSER_LEVER, 'help', s, ['near_match', 'shares_clue'],
      'The learner picks an object that looks almost right, or cannot make out the clues.',
      `Shows the same view ${SCOPE_TEXT[strongerScope(item.scope) ?? item.scope].with}: every object bigger and sharper. Nothing is named or marked.`));
    out.push(lever(CLUE_PICTURES_LEVER, 'help', s, all,
      'The learner does not hold every clue in mind, or cannot picture one of them.',
      'Shows a card with one small model picture for each clue in the question. It shows no object of the view and no position.'));
  } else if (item.mode === 'brightest') {
    if (on(SAME_SIZE_LEVER) || sizesDiffer(item)) out.push(lever(SAME_SIZE_LEVER, 'help', s, ['picked_biggest', 'picked_dimmer'],
      'The learner picks the biggest object, or is fooled by size.',
      'Draws every object as a dot of the same size, keeping how bright each one shines.'));
    out.push(lever(SIDE_BY_SIDE_LEVER, 'help', s, all,
      'The learner cannot compare objects that are far apart in the view.',
      'Lines the objects up in a row under the view, in the same left-to-right order as in the sky, the same size and each as bright as it shines.'));
  } else if (item.mode === 'object_type') {
    if (on(CLOSER_LEVER) || closerOk(item)) out.push(lever(CLOSER_LEVER, 'help', s, ['sharp_mixup', 'fuzzy_mixup'],
      'The learner mixes up two kinds that look alike from far away.',
      `Shows the same object ${SCOPE_TEXT[strongerScope(item.scope) ?? item.scope].with}, bigger and sharper. Nothing is named.`));
    out.push(lever(TYPE_PICTURES_LEVER, 'help', s, all,
      'The learner does not know what each kind looks like.',
      'Shows a card with a simple model picture of each kind offered, captioned with its name. None of them is this object.'));
  } else {
    out.push(lever(LADDER_LEVER, 'help', s, all,
      'The learner does not know which instruments are more powerful, or reads "least powerful" as "most powerful".',
      'Shows a card listing the five instruments from least to most powerful, with how much bigger each makes things look.'));
    if (on(MY_PICK_LEVER) || s.lastPick) out.push(lever(MY_PICK_LEVER, 'help', s, all,
      'The learner picked an instrument and needs to see what it really shows.',
      "Shows the object through the learner's own last pick, and whether the asked detail can be seen there."));
  }
  if (on(DROP_LEVER) || dropTarget(item, s) !== null) out.push(lever(DROP_LEVER, 'simplify', s, all,
    'The learner still picks wrong after help, or is stuck with too many to choose from.',
    `Greys out one ${isTapItem(item) ? 'object' : 'choice'} that is easy to rule out, so fewer remain. The next answer counts as helped.`));
  return out;
}

/** clue_pictures: the clue words the card pictures, in the ask's order. */
export function clueLines(item: TelescopeItem): string[] {
  if (item.mode !== 'find_by_look') return [];
  const key = objectDef(item.objects[tapKey(item)]?.object ?? '');
  return clueTags(item.clues, key, item.scope).map(t => t.text);
}

/** ladder: the five instruments, least to most powerful. */
export const ladderLines = (): string[] => SCOPES.map(s => `${SCOPE_TEXT[s].button}: ${SCOPE_TEXT[s].power}.`);

/** my_pick_view: what the learner's own pick shows. */
export function myPickLine(item: TelescopeItem, pick: Scope | null): string | null {
  if (item.mode !== 'pick_instrument' || !pick) return null;
  const d = detailDef(item.detail)!;
  const seen = scopeRank(pick) >= scopeRank(d.min);
  return `${SCOPE_TEXT[pick].button}: ${seen ? `${d.text} can be seen` : `${d.text} cannot be seen`}.`;
}

/** What the pulled levers put on screen, for the tutor and JEV. Never the key, a name or a position. */
export function leverFacts(item: TelescopeItem, s: TelescopeLeverState): string | null {
  const parts: string[] = [];
  const on = (id: string) => s.pulled.includes(id);
  if (on(CLOSER_LEVER) && (item.mode === 'find_by_look' || item.mode === 'object_type')) {
    parts.push(`the view is now ${SCOPE_TEXT[viewScope(item, s)].with}, every object bigger and sharper`);
  }
  if (on(CLUE_PICTURES_LEVER)) parts.push(`a card shows one model picture for each clue: ${clueLines(item).join('; ')}; it shows no object of the view`);
  if (on(SAME_SIZE_LEVER)) parts.push('every object is drawn as a dot of the same size; only how bright it shines differs');
  if (on(SIDE_BY_SIDE_LEVER)) parts.push('under the view, the objects are lined up in a row in their left-to-right order in the sky, the same size, each as bright as it shines');
  if (on(TYPE_PICTURES_LEVER) && item.mode === 'object_type') parts.push(`a card shows a model picture of each kind offered (${item.choices.map(c => KIND_TEXT[c]).join(', ')}); none is this object`);
  if (on(LADDER_LEVER)) parts.push(`a card lists the instruments from least to most powerful: ${ladderLines().join(' ')}`);
  if (on(MY_PICK_LEVER)) { const line = myPickLine(item, s.lastPick); if (line) parts.push(`the view shows the object through the learner's last pick. ${line}`); }
  for (const i of s.dropped) {
    if (isTapItem(item)) {
      const o = objectDef(item.objects[i]?.object ?? '');
      if (o) parts.push(`one object, ${viewLook(item, o, viewScope(item, s))}, is greyed out and is not the answer`);
    } else if (item.choices[i] !== undefined) {
      parts.push(`the choice "${choiceLabel(item, item.choices[i])}" is greyed out and is not the answer`);
    }
  }
  return parts.length ? parts.join('; ') : null;
}

/** For tests: every miss an item's wrong answers can show. */
export function possibleMisses(item: TelescopeItem): TelescopeMiss[] {
  const out = new Set<TelescopeMiss>();
  if (isTapItem(item)) {
    item.objects.forEach((_, i) => { const m = tapMiss(item, i); if (m) out.add(m); });
  } else {
    for (const c of item.choices as string[]) { const m = choiceMiss(item, c); if (m) out.add(m); }
  }
  return Array.from(out);
}
