/**
 * The in-item levers on interactive-book (`/add-support-tiers`, handoff 22): find-feature (L1), where the tutor names
 * a book part and the learner taps it, and read-focus-word (L3), where the learner reads one glowing word cold.
 *
 * Pure: the component draws from these, the workspace publishes them, and the tests hold each leak rule.
 * - `model_page` (help): a small MODEL cover or page beside the book, code-owned, with the asked kind of part
 *   outlined. Answers every miss. Leak rules: no model text is the book's, and the book's own parts are never
 *   outlined.
 * - `two_part_page` (simplify, inner pages only; a cover has two parts already): an ungraded practice page with
 *   two tappable parts, the asked kind and the one least like it by place (the caption under the picture
 *   against the top row). Leak rule: none of its text is the book's.
 * - `sound_dots` (help, read-focus-word): a dot under each grapheme of the glowing word (the shared kit overlay).
 *   Leak rule: no audio of unread print; the letters unchanged.
 * - `cvc_focus` (simplify, read-focus-word, when the glowing word is not CVC): an ungraded practice sentence from the
 *   code pool whose glowing word is CVC. Leak rule (R3): no word of it is printed anywhere in the book.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { PRACTICE_LINES, practiceLineLeak, printedSet } from './decodablePracticeLines';
import type { InteractiveBookVolume } from './InteractiveBook';
import type { InteractiveBookFeature, InteractiveBookItem } from './interactiveBookScript';
import type { BookHotspot } from './interactiveBookWorkspace';

export const MODEL_LEVER = 'model_page';
export const TWO_PARTS_LEVER = 'two_part_page';
export const FOCUS_DOTS_LEVER = 'sound_dots';
export const CVC_FOCUS_LEVER = 'cvc_focus';

export interface ModelPart { feature: InteractiveBookFeature; text: string; lit: boolean }

/** Model covers and pages, in order of preference; the first sharing no text with the book is drawn. */
const MODEL_COVERS = [{ title: 'Big Bear', author: 'by Sam Lee' }, { title: 'The Red Kite', author: 'by Ana Park' }];
const MODEL_PAGES = [{ heading: 'At the Pond', caption: 'A frog on a log', number: 'Page 4' },
  { heading: 'In the Snow', caption: 'A fox in the snow', number: 'Page 7' }];
/** Practice pages, never the model's, so a model on screen earlier does not answer the practice page. */
const PRACTICE_PAGES = [{ heading: 'The Big Ship', caption: 'A ship on the sea', number: 'Page 9' },
  { heading: 'Up the Hill', caption: 'A goat on a hill', number: 'Page 12' }];

const norm = (t: string) => t.replace(/["“”]/g, '').trim().toLowerCase();

/** Every printed text of the book: a model or practice text may be none of them. */
export function bookTexts(book: InteractiveBookVolume): Set<string> {
  return new Set([book.bookTitle, book.author, ...book.pages.flatMap(p => [p.heading, p.caption, `Page ${p.pageNumber}`])].map(norm));
}

const pageParts = (p: { heading: string; caption: string; number: string }): Array<{ feature: InteractiveBookFeature; text: string }> =>
  [{ feature: 'heading', text: p.heading }, { feature: 'caption', text: p.caption }, { feature: 'page-number', text: p.number }];

/** The model for this item: a cover for a cover item, a page for a page item, the asked kind outlined. */
export function modelFor(item: InteractiveBookItem, book: InteractiveBookVolume): { kind: 'cover' | 'page'; parts: ModelPart[] } | null {
  if (item.mode !== 'find-feature' || !item.feature) return null;
  const used = bookTexts(book), cover = item.targetPageId === 'cover';
  const options = cover
    ? MODEL_COVERS.map(c => [{ feature: 'title' as const, text: c.title }, { feature: 'author' as const, text: c.author }])
    : MODEL_PAGES.map(pageParts);
  const parts = options.find(o => o.every(p => !used.has(norm(p.text))));
  return parts ? { kind: cover ? 'cover' : 'page', parts: parts.map(p => ({ ...p, lit: p.feature === item.feature })) } : null;
}

/** Leak rule for the model: true when any model text is the book's, or anything but one part is lit. */
export const modelLeak = (model: { parts: readonly ModelPart[] }, book: InteractiveBookVolume) =>
  model.parts.some(p => bookTexts(book).has(norm(p.text))) || model.parts.filter(p => p.lit).length !== 1;

/** The far part for a page target: the caption against the top row (heading, page number), and back. */
const FAR: Partial<Record<InteractiveBookFeature, InteractiveBookFeature>> = { heading: 'caption', 'page-number': 'caption', caption: 'heading' };

/** The practice page and its item for a page target, or null (a cover item, or no page free of book text). */
export function practicePage(item: InteractiveBookItem, book: InteractiveBookVolume): { item: InteractiveBookItem; parts: BookHotspot[] } | null {
  if (item.mode !== 'find-feature' || item.targetPageId === 'cover' || !item.feature || !FAR[item.feature]) return null;
  const used = bookTexts(book);
  const page = PRACTICE_PAGES.find(p => pageParts(p).every(part => !used.has(norm(part.text))));
  if (!page) return null;
  const all = pageParts(page);
  const target = all.find(p => p.feature === item.feature)!, foil = all.find(p => p.feature === FAR[item.feature!])!;
  // In the page's own order: the top row first, the caption under the picture last.
  const parts = [target, foil].sort((a, b) => (a.feature === 'caption' ? 1 : 0) - (b.feature === 'caption' ? 1 : 0))
    .map(p => ({ id: `practice-${p.feature}`, feature: p.feature, text: p.text }));
  return { item: { ...item, id: `${item.id}~simpler`, targetPageId: 'practice', targetText: target.text }, parts };
}

// ── L3: read-focus-word ─────────────────────────────────────────────────────

/** Every word the book prints: title, author, parts and paragraphs. A practice sentence may use none of them (R3). */
export const bookWords = (book: InteractiveBookVolume) =>
  printedSet(book.bookTitle, book.author, ...book.pages.flatMap(p => [p.heading, p.caption, ...p.paragraphs]));

const CVC = /^[b-df-hj-np-tv-z][aeiou][b-df-hj-np-tv-z]$/i;

/** The practice for a read-focus item whose glowing word is not CVC: a pool sentence, its CVC word glowing after a
 *  lead of two words or more (the tutor reads the lead), sharing no word with the book. */
export function cvcFocus(item: InteractiveBookItem, book: InteractiveBookVolume): { item: InteractiveBookItem; line: string } | null {
  if (item.mode !== 'read-focus-word' || CVC.test(item.targetText)) return null;
  const printed = bookWords(book);
  for (const line of PRACTICE_LINES) {
    const words = line.text.replace(/\.$/, '').split(' ');
    const at = words.indexOf(line.focus);
    if (at < 2 || !CVC.test(line.focus) || practiceLineLeak(line.text, printed)) continue;
    return { line: line.text, item: { ...item, id: `${item.id}~simpler`, targetPageId: 'practice', targetText: line.focus.toLowerCase(),
      readLead: words.slice(0, at).join(' '), readTail: words.slice(at + 1).join(' ') } };
  }
  return null;
}

/** The levers this item declares on read-focus-word. */
function readFocusLevers(item: InteractiveBookItem, pulled: readonly string[], book: InteractiveBookVolume): WorkspaceLever[] {
  const levers: WorkspaceLever[] = [{
    id: FOCUS_DOTS_LEVER, kind: 'help', carrier: 'shown', pulled: pulled.includes(FOCUS_DOTS_LEVER), answers: ['context_guess'],
    when: 'The learner says a word that fits the sentence but is not the printed word.',
    does: 'Puts a dot under each sound of the glowing word so the learner reads its letters. Nothing is said: do not say '
      + 'the glowing word or its sounds.',
  }];
  if (cvcFocus(item, book)) levers.push({
    id: CVC_FOCUS_LEVER, kind: 'simplify', carrier: 'shown', pulled: pulled.includes(CVC_FOCUS_LEVER), answers: ['context_guess'],
    when: 'The learner cannot yet read a glowing word this long.',
    does: 'Opens an easier practice sentence first, not from the book, whose glowing word is a short three-letter word. '
      + 'Read it up to the glowing word as usual. It is not graded; the book page comes back after it.',
  });
  return levers;
}

/** The levers this item declares, with their state: find-feature (L1) and read-focus-word (L3). */
export function interactiveBookLevers(item: InteractiveBookItem | null, pulled: readonly string[], book: InteractiveBookVolume | null): WorkspaceLever[] {
  if (!item || !book) return [];
  if (item.mode === 'read-focus-word') return readFocusLevers(item, pulled, book);
  if (item.mode !== 'find-feature') return [];
  const all = ['tapped_title', 'tapped_author', 'tapped_heading', 'tapped_caption', 'tapped_page_number'];
  const levers: WorkspaceLever[] = [];
  if (modelFor(item, book)) levers.push({
    id: MODEL_LEVER, kind: 'help', carrier: 'both', pulled: pulled.includes(MODEL_LEVER), answers: all,
    when: 'The learner taps the wrong part of the book.',
    does: `Shows a small model ${item.targetPageId === 'cover' ? 'cover' : 'page'} beside the book, not this book, with the asked kind `
      + 'of part outlined. You may name that part on the model; never point to it in the book.',
  });
  if (practicePage(item, book)) levers.push({
    id: TWO_PARTS_LEVER, kind: 'simplify', carrier: 'shown', pulled: pulled.includes(TWO_PARTS_LEVER), answers: all,
    when: 'The learner cannot yet pick this part out from the others on a page.',
    does: 'Opens an easier practice page first, not from this book, with only two printed parts to choose from. '
      + 'It is not graded; the book page comes back after it.',
  });
  return levers;
}
