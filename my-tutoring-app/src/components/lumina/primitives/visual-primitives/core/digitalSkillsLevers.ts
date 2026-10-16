/**
 * The in-item levers on digital-skills-sim (`/add-support-tiers`; report
 * qa/eval-reports/digital-skills-sim-levers-2026-10-16.md). No real-learner evidence: the misses are what
 * `skillMiss` observes; the failures behind them are documented (the old catalog's commonStruggles: clicks that miss
 * the target, a drag let go before the zone, wrong keys) or inferred (a pre-reader who cannot hold the spoken name, a
 * small letter not matched to its capital key, b/d and p/q). Every lever starts released; `config.difficulty` changes
 * the items, not the levers.
 *
 * - `show_picture` (help; click, drag): a card beside the ask with the picture of what to click, or of the box the
 *   picture goes into. It sits outside the play area and marks no place in it.
 * - `big_targets` (help; click): every picture grows, and so does the area a click counts on.
 * - `big_boxes` (help; drag): every box's catch area grows, drawn as a dashed edge around each box.
 * - `fewer_pictures` / `fewer_boxes` (simplify; click, drag with 3 or more): a different target with only two to
 *   choose from, ungraded, then the full item back.
 * - `glow_row` (help; type): the keyboard row holding the (next) letter glows. A whole row, never one key.
 * - `big_keys` (help; type): the keys grow, with more space between them.
 * - `capital_card` (help; type, small-letter items): a card with the small letter beside its capital.
 * - `one_letter` (simplify; type, word items): one capital letter not in the word, ungraded, then the word back.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import {
  BOXES, buildClick, buildDrag, KEY_ROWS, PAD, radiusOf, rowOf, seededRng, SKILL_MISSES, SPOTS,
  type ClickItem, type DragItem, type SkillItem, type SkillMiss, type TypeItem,
} from './digitalSkillsWorkspace';

export const SHOW_PICTURE_LEVER = 'show_picture';
export const BIG_TARGETS_LEVER = 'big_targets';
export const BIG_BOXES_LEVER = 'big_boxes';
export const FEWER_PICTURES_LEVER = 'fewer_pictures';
export const FEWER_BOXES_LEVER = 'fewer_boxes';
export const GLOW_ROW_LEVER = 'glow_row';
export const BIG_KEYS_LEVER = 'big_keys';
export const CAPITAL_CARD_LEVER = 'capital_card';
export const ONE_LETTER_LEVER = 'one_letter';

/** The picture show_picture puts on its card: the click target, or the box a drag goes into. */
export const pictureOf = (item: ClickItem | DragItem) => (item.mode === 'click' ? item.things[item.target] : item.homes[item.target]);

/** The letter the keyboard levers act on: the next one to type (the first, until a key is right). */
export const nextLetter = (item: TypeItem, typed: number) => item.text[Math.min(typed, item.text.length - 1)];

/** The rows glow_row lights: one whole row (at least seven keys), never a single key. */
export const glowRow = (item: TypeItem, typed: number) => rowOf(nextLetter(item, typed));

// ── Leak rules (pure, tested per mode) ───────────────────────────────────────────────────

/** A lever never singles out a place in the play area: the big levers grow every picture or box alike. */
export function bigLeverEven(item: ClickItem | DragItem): boolean {
  if (item.mode === 'click') return new Set(SPOTS[item.things.length].map(() => radiusOf(item.things.length, true))).size === 1;
  return BOXES[item.homes.length].every(() => PAD > 0);
}
/** No two grown pictures or boxes overlap, so a big lever never makes one release land on two. */
export function bigLeverSeparate(n: number, mode: 'click' | 'drag'): boolean {
  if (mode === 'click') {
    const s = SPOTS[n], r = radiusOf(n, true);
    return s.every((a, i) => s.every((b, j) => i === j || Math.hypot(a.x - b.x, a.y - b.y) > 2 * r));
  }
  const bs = BOXES[n].map(b => ({ x: b.x - PAD, y: b.y - PAD, w: b.w + 2 * PAD, h: b.h + 2 * PAD }));
  return bs.every((a, i) => bs.every((b, j) => i === j || a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y));
}
/** glow_row lights a whole row of at least seven keys. */
export const glowLeak = (row: number) => !(row >= 0 && KEY_ROWS[row].length >= 7);

// ── Simplify: practice items ─────────────────────────────────────────────────────────────

const PRACTICE = '~simpler';
export const isPractice = (item: Pick<SkillItem, 'id'>) => item.id.endsWith(PRACTICE);
export const practiceParent = (id: string) => (id.endsWith(PRACTICE) ? id.slice(0, -PRACTICE.length) : null);

/** The simpler item, or null when the item is already as small as its mode allows. Never the item's own target. */
export function simplerItem(item: SkillItem): SkillItem | null {
  if (isPractice(item)) return null;
  const id = `${item.id}${PRACTICE}`;
  const rng = seededRng(item.id + JSON.stringify(item));
  if (item.mode === 'click') {
    if (item.things.length < 3) return null;
    return { ...buildClick(item.theme, 2, rng, item.things[item.target].name), id };
  }
  if (item.mode === 'drag') {
    if (item.homes.length < 3) return null;
    return { ...buildDrag(item.theme, 2, rng, { thing: item.thing.name, home: item.homes[item.target].name }), id };
  }
  if (item.text.length < 2) return null;
  const letters = KEY_ROWS.join('').split('').filter(k => !item.text.includes(k));
  return { id, mode: 'type', text: letters[Math.floor(rng() * letters.length)], lower: false };
}

// ── Levers on the current item ───────────────────────────────────────────────────────────

const lever = (id: string, kind: WorkspaceLever['kind'], pulled: readonly string[], answers: readonly SkillMiss[], when: string, does: string): WorkspaceLever =>
  ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });

/** The levers on the current session item. A practice item has none. */
export function skillLevers(item: SkillItem | undefined, pulled: readonly string[]): WorkspaceLever[] {
  if (!item || isPractice(item)) return [];
  const out: WorkspaceLever[] = [];
  const simpler = simplerItem(item);
  if (item.mode === 'click') {
    out.push(lever(SHOW_PICTURE_LEVER, 'help', pulled, ['wrong_picture'], 'The learner clicks a picture that is not the one asked for.',
      'Shows a card beside the question with the picture of what to click. It sits outside the play area and marks no place in it.'));
    out.push(lever(BIG_TARGETS_LEVER, 'help', pulled, ['missed_picture'], 'The learner clicks beside the pictures, on no picture.',
      'Makes every picture bigger, and the area a click counts on with it.'));
    if (simpler) out.push(lever(FEWER_PICTURES_LEVER, 'simplify', pulled, SKILL_MISSES.click, 'The learner cannot find or reach the picture among so many.',
      'Opens a practice item with only two pictures and a different one to click. It is not graded; this item comes back after it.'));
    return out;
  }
  if (item.mode === 'drag') {
    out.push(lever(SHOW_PICTURE_LEVER, 'help', pulled, ['wrong_box'], 'The learner drops the picture into a box that is not the one asked for.',
      'Shows a card beside the question with the picture of the box it goes into. It sits outside the play area and marks no box in it.'));
    out.push(lever(BIG_BOXES_LEVER, 'help', pulled, ['let_go_outside'], 'The learner lets go before the picture is over a box.',
      'Makes the area that catches a drop bigger around every box, drawn as a dashed edge.'));
    if (simpler) out.push(lever(FEWER_BOXES_LEVER, 'simplify', pulled, SKILL_MISSES.drag, 'The learner cannot manage so many boxes.',
      'Opens a practice item with only two boxes and a different picture to move. It is not graded; this item comes back after it.'));
    return out;
  }
  out.push(lever(GLOW_ROW_LEVER, 'help', pulled, ['wrong_key'], 'The learner presses a key far from the letter.',
    'Lights up the whole keyboard row that holds the letter to press next (seven to ten keys). It never marks one key.'));
  out.push(lever(BIG_KEYS_LEVER, 'help', pulled, ['neighbour_key'], 'The learner presses a key next to the right one.',
    'Makes every key bigger, with more space between them.'));
  if (item.lower) out.push(lever(CAPITAL_CARD_LEVER, 'help', pulled, ['mirror_letter'], 'The learner does not match the small letter to the capital on the key, or turns b, d, p or q around.',
    'Shows a card with the small letter beside its capital letter, the way the key shows it.'));
  if (simpler) out.push(lever(ONE_LETTER_LEVER, 'simplify', pulled, SKILL_MISSES.type, 'The learner cannot keep a whole word in order.',
    'Opens a practice item with one capital letter to find. It is not graded; the word comes back after it.'));
  return out;
}

const ROW_NAME = ['top', 'middle', 'bottom'];
/** What the pulled levers put on screen, as a scene fact. Never where the target is or which key is right. */
export function leverFact(item: SkillItem | undefined, pulled: readonly string[], typed = 0): string {
  if (!item || isPractice(item)) return '';
  const parts: string[] = [];
  if (item.mode === 'click' || item.mode === 'drag') {
    if (pulled.includes(SHOW_PICTURE_LEVER)) parts.push(`A card beside the question shows the picture of ${item.mode === 'click' ? 'what to click' : 'where the picture goes'}; nothing in the play area is marked.`);
    if (pulled.includes(BIG_TARGETS_LEVER)) parts.push('Every picture is drawn bigger.');
    if (pulled.includes(BIG_BOXES_LEVER)) parts.push('A dashed edge around every box shows the bigger area that catches a drop.');
  } else {
    if (pulled.includes(GLOW_ROW_LEVER)) parts.push(`The ${ROW_NAME[glowRow(item, typed)]} row of the keyboard glows (${KEY_ROWS[glowRow(item, typed)].length} keys); no single key is marked.`);
    if (pulled.includes(BIG_KEYS_LEVER)) parts.push('The keys are drawn bigger, with more space between them.');
    if (pulled.includes(CAPITAL_CARD_LEVER)) parts.push(`A card shows the small letter ${nextLetter(item, typed).toLowerCase()} beside its capital ${nextLetter(item, typed)}.`);
  }
  return parts.join(' ');
}

/** For tests: every miss this item's work can show. */
export function possibleMisses(item: SkillItem): SkillMiss[] {
  if (item.mode === 'click') return item.things.length > 1 ? ['wrong_picture', 'missed_picture'] : ['missed_picture'];
  if (item.mode === 'drag') return ['wrong_box', 'let_go_outside'];
  const out: SkillMiss[] = ['wrong_key', 'neighbour_key'];
  if (item.lower && /[BDPQ]/.test(item.text)) out.push('mirror_letter');
  return out;
}
