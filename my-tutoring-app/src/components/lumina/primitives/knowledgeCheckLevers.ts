/**
 * The in-item levers on knowledge-check (`/add-support-tiers`, handoff 25). The four modes are Bloom tiers that share
 * the same item kinds, so the levers are per ITEM KIND: both act on a closed-set choice (`choice`, spoken, and
 * `choice_tap`, touched).
 *
 * - `cue_picture` (help, both): a generated picture of what the question is about, beside the question. Withheld by
 *   `cueLeak` when it pictures or names any choice, or when the key is a number (a picture beside a number question is
 *   a count). Recall/apply only: the generator asks for a cue at those tiers and at `mixed`.
 * - `drop_far_choice` (simplify, shown): greys out one wrong choice the learner has not picked, on the item itself.
 *   Numeric menus pick the one farthest from the key; text menus pick one the generator tagged `far`. User ruling
 *   09-27: removing a choice is allowed and is assisted work, never unaided credit (the pull records the lever on the
 *   next attempt). Guard: after the drop at least two choices remain that the learner has not already tried. A spoken
 *   wrong answer does not say which choice it was, so every wrong attempt counts as one tried choice.
 *
 * Every other kind (true/false, match, sort, blank, the production kinds) declares no lever; its misses are listed as
 * unanswered in the catalog with the reason.
 */
import type { WorkspaceLever } from '../components/live-activity/runtime/contract';
import { normalizeWord, type KnowledgeCheckItem } from './knowledgeCheckScript';
import type { KnowledgeCheckMiss } from './knowledgeCheckWorkspace';

export const CUE_LEVER = 'cue_picture';
export const DROP_LEVER = 'drop_far_choice';

/** Per item: the levers pulled, the choices greyed out, the choices the learner touched wrong, and wrong attempts. */
export interface KnowledgeCheckLeverState {
  pulled: readonly string[];
  dropped: readonly string[];
  picked: readonly string[];
  wrongs: number;
}
export const NO_LEVERS: KnowledgeCheckLeverState = { pulled: [], dropped: [], picked: [], wrongs: 0 };

const asNumber = (text?: string) => (text && /^\s*-?\d+(\.\d+)?\s*$/.test(text) ? Number(text) : NaN);
const isChoice = (item: KnowledgeCheckItem) => item.kind === 'choice' || item.kind === 'choice_tap';
const keyText = (item: KnowledgeCheckItem) => item.options?.find(o => o.id === item.correctOptionId)?.text;

const STOP = new Set(['the', 'and', 'with', 'for', 'from', 'that', 'this', 'its', 'are', 'was', 'has', 'have', 'into', 'some', 'one']);
const stem = (w: string) => (w.length > 4 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);
const contentWords = (text: string) =>
  normalizeWord(text).split(/[\s-]+/).filter(w => w.length >= 3 && !STOP.has(w)).map(stem);
const pictures = (text: string) =>
  Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), s => s.segment).filter(g => g.trim());

/** Why the item's cue may not be shown, or null when it may. */
export function cueLeak(item: KnowledgeCheckItem): string | null {
  const cue = item.cue;
  if (!cue?.picture.trim() || !cue.shows.trim()) return 'no cue';
  if (!isChoice(item)) return 'not a choice item';
  if (!Number.isNaN(asNumber(keyText(item)))) return 'the answer is a number: pictures beside it are a count';
  const pics = pictures(cue.picture);
  if (pics.length > 3) return 'more than three pictures';
  const options = item.options ?? [];
  if (options.some(o => (o.emoji && pics.includes(o.emoji)) || pics.some(p => /[^\x00-\x7F]/.test(p) && o.text.includes(p)))) {
    return 'pictures a choice';
  }
  // A shared word or a shared start ("sunny" / "sun") both count: the cue must not point at a choice's words. A word
  // in every choice ("Plant A ...", "Plant B ...") tells no choice apart, so it may be pictured.
  const said = contentWords(cue.shows);
  const near = (a: string, b: string) => a === b || a.startsWith(b) || b.startsWith(a);
  const words = options.map(o => contentWords(o.text));
  const inEvery = (w: string) => words.every(ws => ws.includes(w));
  if (words.some(ws => ws.some(w => !inEvery(w) && said.some(c => near(c, w))))) return 'names a choice';
  return null;
}

const cueFor = (item: KnowledgeCheckItem) => (item.cue && !cueLeak(item) ? item.cue : null);

/**
 * The wrong choice `drop_far_choice` greys out now, or null when none may go: not a choice item, no far choice
 * (numeric distance or the `far` tag), or fewer than two untried choices would remain.
 */
export function farChoice(item: KnowledgeCheckItem, s: KnowledgeCheckLeverState): string | null {
  if (!isChoice(item)) return null;
  const live = (item.options ?? []).filter(o => !s.dropped.includes(o.id));
  const tried = Math.max(s.wrongs, new Set(s.picked).size);
  if (live.length - 1 - tried < 2) return null;
  const foils = live.filter(o => o.id !== item.correctOptionId && !s.picked.includes(o.id));
  const want = asNumber(keyText(item));
  if (!Number.isNaN(want) && live.every(o => !Number.isNaN(asNumber(o.text)))) {
    const far = [...foils].sort((a, b) => Math.abs(asNumber(b.text) - want) - Math.abs(asNumber(a.text) - want))[0];
    return far?.id ?? null;
  }
  return foils.find(o => o.distance === 'far')?.id ?? null;
}

/** The misses each lever answers (J9): the tapped ids are the spoken choice's ids too. */
const CUE_ANSWERS = ['other_choice'] satisfies KnowledgeCheckMiss[];
const DROP_ANSWERS = ['one_less', 'one_more', 'other_number', 'other_choice'] satisfies KnowledgeCheckMiss[];

/** The levers this item declares, with their state. A lever that cannot be pulled now and was not pulled is left out. */
export function knowledgeCheckLevers(item: KnowledgeCheckItem | null | undefined, s: KnowledgeCheckLeverState): WorkspaceLever[] {
  if (!item || !isChoice(item)) return [];
  const levers: WorkspaceLever[] = [];
  if (cueFor(item)) levers.push({ id: CUE_LEVER, kind: 'help', carrier: 'both', pulled: s.pulled.includes(CUE_LEVER), answers: CUE_ANSWERS,
    when: 'The learner picks a wrong choice, or is stuck, on a question about a thing they may not picture.',
    does: 'Shows a picture of what the question is about beside it. Say what it shows. It never pictures the answer or a choice.' });
  const dropPulled = s.pulled.includes(DROP_LEVER);
  if (dropPulled || farChoice(item, s)) levers.push({ id: DROP_LEVER, kind: 'simplify', carrier: 'shown', pulled: dropPulled,
    answers: DROP_ANSWERS,
    when: 'The learner still picks a wrong choice after help, or is stuck with too many choices.',
    does: 'Greys out one wrong choice that is easy to rule out, so fewer choices remain. The next answer counts as helped.' });
  return levers;
}

/** What the pulled levers put on screen, for the tutor and JEV. Names the greyed-out choice, never the key. */
export function leversOnScreen(item: KnowledgeCheckItem, s: KnowledgeCheckLeverState): string | null {
  const parts: string[] = [];
  const cue = s.pulled.includes(CUE_LEVER) ? cueFor(item) : null;
  if (cue) parts.push(`a picture beside the question: ${cue.picture} (${cue.shows}). Say what it shows; it is not a choice`);
  const options = item.options ?? [];
  for (const id of s.dropped) {
    const i = options.findIndex(o => o.id === id);
    if (i >= 0) parts.push(`choice ${i + 1}, "${options[i].text}", is greyed out and is not the answer`);
  }
  return parts.length ? parts.join('; ') : null;
}
