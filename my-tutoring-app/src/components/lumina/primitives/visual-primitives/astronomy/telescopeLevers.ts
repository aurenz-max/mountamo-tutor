/**
 * The in-item levers on telescope-simulator, as one lever set (`bossLevers.ts`; `/add-support-tiers`, report
 * qa/eval-reports/telescope-simulator-levers-2026-10-16.md). No real-learner evidence: the misses are what
 * `telescopeMiss` observes. Every lever starts released; `config.difficulty` changes the items, not the levers.
 *
 * - `closer_look` (layout; find_by_look, object_type): the same view through the next stronger instrument, every
 *   object bigger and sharper. On find_by_look only where the ask still matches one object there.
 * - `clue_pictures` (meaning; find_by_look): a card with a small model picture for each clue in the ask (a ring,
 *   stripes, a twinkle, a colour swatch). Models only: never an object of the view, never a position.
 * - `same_size` (layout; brightest, sizes differ): every object drawn as a dot of the same size, keeping its brightness.
 * - `side_by_side` (layout; brightest): the objects again in a row under the view, in their left-to-right order in the
 *   sky, the same size, each as bright as it shines. Never sorted by brightness.
 * - `type_pictures` (meaning; object_type): a card with a simple model picture of each kind offered, captioned with
 *   the kind. None is this object.
 * - `ladder` (meaning; pick_instrument): the five instruments from least to most powerful, with how much bigger each
 *   makes things look. Names no object and no detail.
 * - `my_pick_view` (custom; pick_instrument, after a tapped wrong choice): the object drawn through the learner's own
 *   last pick, with whether the asked detail shows there.
 * - `drop_one` (custom; on the item, user ruling 09-27: a removed choice is assisted work): greys out one wrong object
 *   or choice that is easy to rule out, while at least two untried ones remain.
 *
 * The meaning levers caption every choice alike, so what they must never name is the unnamed object itself
 * (`answersOf`), not the kind or instrument every choice already shows.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import {
  brightFootprint, brightness, choiceKey, choiceLabel, cluesShown, clueTags, detailDef, FAMILY, findMatches, isTapItem,
  choiceMiss, KIND_TEXT, objectDef, SCOPE_TEXT, SCOPES, scopeRank, tapKey, tapMiss, TELESCOPE_MISSES, viewLook,
  type Kind, type Scope, type TelescopeItem, type TelescopeMiss, type TelescopeMode,
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

/** What the levers read beside the item: this item's lever state. */
export interface TelescopeLeverContext { state: TelescopeLeverState }

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

/** The unnamed object a meaning lever must never name: the key object (find, brightest) or the one in view (kind). */
function unnamedObject(item: TelescopeItem): string[] {
  if (item.mode === 'pick_instrument') return [];
  const id = item.mode === 'object_type' ? item.object : item.objects[tapKey(item)]?.object ?? '';
  const o = objectDef(id);
  return o ? [o.name] : [];
}

const on = (ctx: TelescopeLeverContext, id: string) => ctx.state.pulled.includes(id);
const closerFact = (_c: unknown, item: TelescopeItem, ctx: TelescopeLeverContext) =>
  `The view is now ${SCOPE_TEXT[viewScope(item, ctx.state)].with}, every object bigger and sharper.`;
const closerContent = (item: TelescopeItem, ctx: TelescopeLeverContext) => on(ctx, CLOSER_LEVER) || closerOk(item);

export const TELESCOPE_LEVERS = leverSet<TelescopeItem, TelescopeLeverContext>({
  modeOf: item => item.mode,
  missesOf: mode => TELESCOPE_MISSES[mode as TelescopeMode],
  answersOf: item => unnamedObject(item),
  specs: [
    { id: CLOSER_LEVER, type: 'layout', modes: ['find_by_look'], answers: ['near_match', 'shares_clue'],
      when: 'The learner picks an object that looks almost right, or cannot make out the clues.',
      does: item => `Shows the same view ${SCOPE_TEXT[strongerScope((item as { scope: Scope }).scope) ?? 'space'].with}: every `
        + 'object bigger and sharper. Nothing is named or marked.',
      content: closerContent, fact: closerFact },
    { id: CLUE_PICTURES_LEVER, type: 'meaning', modes: ['find_by_look'], answers: 'all',
      when: 'The learner does not hold every clue in mind, or cannot picture one of them.',
      does: 'Shows a card with one small model picture for each clue in the question. It shows no object of the view and no position.',
      content: item => { const lines = clueLines(item); return lines.length ? lines : null; },
      fact: (lines: string[]) => `A card shows one model picture for each clue: ${lines.join('; ')}; it shows no object of the view.` },
    { id: CLOSER_LEVER, type: 'layout', modes: ['object_type'], answers: ['sharp_mixup', 'fuzzy_mixup'],
      when: 'The learner mixes up two kinds that look alike from far away.',
      does: item => `Shows the same object ${SCOPE_TEXT[strongerScope((item as { scope: Scope }).scope) ?? 'space'].with}, bigger `
        + 'and sharper. Nothing is named.',
      content: closerContent, fact: closerFact },
    { id: SAME_SIZE_LEVER, type: 'layout', modes: ['brightest'], answers: ['picked_biggest', 'picked_dimmer'],
      when: 'The learner picks the biggest object, or is fooled by size.',
      does: 'Draws every object as a dot of the same size, keeping how bright each one shines.',
      content: (item, ctx) => on(ctx, SAME_SIZE_LEVER) || sizesDiffer(item),
      fact: 'Every object is drawn as a dot of the same size; only how bright it shines differs.' },
    { id: SIDE_BY_SIDE_LEVER, type: 'layout', modes: ['brightest'], answers: 'all',
      when: 'The learner cannot compare objects that are far apart in the view.',
      does: 'Lines the objects up in a row under the view, in the same left-to-right order as in the sky, the same size and each as bright as it shines.',
      fact: 'Under the view, the objects are lined up in a row in their left-to-right order in the sky, the same size, each as bright as it shines.' },
    { id: TYPE_PICTURES_LEVER, type: 'meaning', modes: ['object_type'], answers: 'all',
      when: 'The learner does not know what each kind looks like.',
      does: 'Shows a card with a simple model picture of each kind offered, captioned with its name. None of them is this object.',
      content: item => (item.mode === 'object_type' ? item.choices.map(c => KIND_TEXT[c]) : null),
      fact: (kinds: string[]) => `A card shows a model picture of each kind offered (${kinds.join(', ')}); none is this object.` },
    { id: LADDER_LEVER, type: 'meaning', modes: ['pick_instrument'], answers: 'all',
      when: 'The learner does not know which instruments are more powerful, or reads "least powerful" as "most powerful".',
      does: 'Shows a card listing the five instruments from least to most powerful, with how much bigger each makes things look.',
      fact: `A card lists the instruments from least to most powerful: ${ladderLines().join(' ')}` },
    { id: MY_PICK_LEVER, type: 'custom', carrier: 'shown', modes: ['pick_instrument'], answers: 'all',
      why: 'It redraws this object through the learner\'s own last pick and says whether the detail shows there; no stock '
        + 'type shows what the learner\'s own choice would show.',
      when: 'The learner picked an instrument and needs to see what it really shows.',
      does: "Shows the object through the learner's own last pick, and whether the asked detail can be seen there.",
      content: (item, ctx) => myPickLine(item, ctx.state.lastPick),
      fact: (line: string) => `The view shows the object through the learner's last pick. ${line}` },
    { id: DROP_LEVER, type: 'custom', carrier: 'shown', answers: 'all',
      why: 'It narrows this item in place (one wrong option greyed out) rather than opening a practice item.',
      when: 'The learner still picks wrong after help, or is stuck with too many to choose from.',
      does: item => `Greys out one ${isTapItem(item) ? 'object' : 'choice'} that is easy to rule out, so fewer remain. The next answer counts as helped.`,
      content: (item, ctx) => (on(ctx, DROP_LEVER) || dropTarget(item, ctx.state) !== null ? ctx.state.dropped : null),
      fact: (dropped: readonly number[], item, ctx) => dropped.flatMap(i => {
        if (isTapItem(item)) {
          const o = objectDef(item.objects[i]?.object ?? '');
          return o ? [`One object, ${viewLook(item, o, viewScope(item, ctx.state))}, is greyed out and is not the answer.`] : [];
        }
        return item.choices[i] !== undefined ? [`The choice "${choiceLabel(item, item.choices[i])}" is greyed out and is not the answer.`] : [];
      }).join(' ') },
  ],
});

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
