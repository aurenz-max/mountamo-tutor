/**
 * interactiveBookDomain — what interactive-book TEACHES, with no teaching engine attached: which challenges can be
 * asked, the ask, the spoken key and known misses of read-focus-word, the printed parts and checked misses of
 * find-feature, and the drawn scene. The boss (`interactiveBook.card.ts` + `interactiveBook.boss.ts`) wires these to the
 * live tutor; the generator reads the same build gates. The runner-era DISTAR script (cue lines, sentinel verdicts,
 * judging and tap contracts) is deleted.
 *
 *   read-focus-word  the answer is a WORD of print     → spoken: the ask reads the sentence up to the glowing word and
 *                                                         stops; the learner reads the word; the tutor judges the key
 *   find-feature     the answer is a POSITION on the page → one tap on a printed part, checked by the activity
 *
 * What may be said before a try follows what the answer is made of: the reading ask says the lead-in and never the
 * word (the print is the learner's); the find ask names the PART and never the page's printed text (a learner who
 * hears the words can match the sound without knowing what a title is).
 */
import type { TeachingItem } from '../../../hooks/teachingItemContract';
import { opensWithSentinel } from '../../../hooks/judgedScriptContract';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { SupportTier } from '../../../components/live-activity/supportFact';
import type { InteractiveBookMiss } from './interactiveBook.card';
import type { BookFeatureKind, InteractiveBookVolume } from './InteractiveBook';

export type { InteractiveBookMiss, SpokenInteractiveBookMiss } from './interactiveBook.card';

// Re-exported so the generator imports its build gates from ONE address.
export { opensWithSentinel };

export type InteractiveBookItemMode = 'find-feature' | 'read-focus-word';

/** The five findable print features. `focus-word` is the read mode's material, never a find-feature target. */
export type InteractiveBookFeature = 'title' | 'author' | 'heading' | 'caption' | 'page-number';

/** How the ask SAYS each feature: one spoken name per feature, invariant. */
export const FEATURE_SPOKEN: Record<InteractiveBookFeature, string> = {
  title: 'title',
  author: "author's name",
  heading: 'heading',
  caption: 'picture caption',
  'page-number': 'page number',
};

/** What each kind of part is for, said after a tap: the print concept itself, never this page's text. */
const FEATURE_JOB: Record<InteractiveBookFeature, string> = {
  title: 'the title is the big words that tell the name of the whole book',
  author: "the author's name tells who wrote the book",
  heading: 'a heading tells what the page is about',
  caption: 'a caption is the little line that tells about the picture',
  'page-number': 'the page number counts the pages',
};

/** A printed part of the view on screen. */
export interface BookHotspot {
  id: string;
  feature: BookFeatureKind;
  text: string;
}

// ── The item ────────────────────────────────────────────────────────────────

export interface InteractiveBookItem extends TeachingItem {
  mode: InteractiveBookItemMode;
  /** Which book view the item shows ('cover', a page id, or 'practice' for a lever's practice view). */
  targetPageId: string;
  /** find-feature: the printed text of the target part, the code's match key, never told to the tutor.
   *  read-focus-word: the glowing word, the answer. */
  targetText: string;
  /** The lesson's support tier: when the model lever comes (`supportFact`). */
  tier: SupportTier;
  /** find-feature only. */
  feature?: InteractiveBookFeature;
  /** read-focus-word: the sentence up to the glowing word, read in the ask. */
  readLead?: string;
  /** read-focus-word: the printed rest of the sentence after the word. */
  readTail?: string;
  /** A practice page (`two_part_page`): its own tappable parts, none of them the book's. */
  parts?: BookHotspot[];
  /** A practice sentence (`cvc_focus`): its printed line, not from the book. */
  line?: string;
}

// ── Build gates: DROP an unaskable item, never repair it into one ───────────

/** Structural challenge shape as the generator emits it (duck-typed so this module never imports the component). */
export interface InteractiveBookChallengeLike {
  id: string;
  type: string;
  targetPageId: string;
  targetFeature: string;
  targetText: string;
  optionTexts?: string[];
  readLead?: string;
  readTail?: string;
}

/** One breath for a spoken lead-in. */
export const MAX_LEAD_CHARS = 90;
/** A one-word lead ("A —") is a headless fragment, not an oral cloze. */
export const MIN_LEAD_WORDS = 2;
/** A focus word is ONE sayable token. */
export const MAX_WORD_CHARS = 12;
/** Feature text is a short phrase. */
export const MAX_FEATURE_CHARS = 40;

/** A focus word answered with "yes"/"no" sounds like a verdict, not a read word. */
const VERDICT_WORDS: ReadonlySet<string> = new Set(['yes', 'yeah', 'no', 'nope']);

const wordsIn = (text: string): number => (text.trim() ? text.trim().split(/\s+/).length : 0);

/** No double quotes and no underscores (blank markers read aloud). */
const speakableText = (text: string): boolean => text.trim().length > 0 && !/["“”_]/.test(text);

export const isSayableWord = (word: string): boolean => new RegExp(`^[a-z]{1,${MAX_WORD_CHARS}}$`, 'i').test(word.trim());

export const isSayableLead = (lead: string): boolean =>
  speakableText(lead) && lead.trim().length <= MAX_LEAD_CHARS && wordsIn(lead) >= MIN_LEAD_WORDS;

export const isSayableFeatureText = (text: string): boolean =>
  speakableText(text) && text.trim().length <= MAX_FEATURE_CHARS && wordsIn(text) <= 4 && !/[.!?]/.test(text);

const isFeature = (value: string): value is InteractiveBookFeature => value in FEATURE_SPOKEN;

const wholeWordIn = (text: string, word: string): boolean => {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Za-z])${escaped}([^A-Za-z]|$)`, 'i').test(text);
};

/**
 * One item, or null when the challenge cannot be asked; nothing backfills.
 *  - find-feature needs a known feature, a short target text, and options (the view's printed parts) that hold the
 *    target exactly once: two parts printing the same text is one question with two right answers. One option is
 *    nothing to choose from.
 *  - read-focus-word needs a single sayable word that is not yes/no, a lead of two words or more the tutor can say in
 *    one breath, and the word in neither the lead nor the tail (it is printed exactly once).
 */
export const itemFromChallenge = (ch: InteractiveBookChallengeLike, tier: SupportTier = 'medium'): InteractiveBookItem | null => {
  const targetText = (ch.targetText ?? '').trim();
  if (!targetText || !ch.targetPageId) return null;

  if (ch.type === 'read-focus-word') {
    const readLead = (ch.readLead ?? '').trim();
    const readTail = (ch.readTail ?? '').trim();
    if (!isSayableWord(targetText)) return null;
    if (VERDICT_WORDS.has(targetText.toLowerCase())) return null;
    if (!isSayableLead(readLead)) return null;
    if (readTail && /["“”_]/.test(readTail)) return null;
    if (readTail.length > MAX_LEAD_CHARS) return null;
    if (opensWithSentinel(readLead) || opensWithSentinel(targetText)) return null;
    if (wholeWordIn(readLead, targetText) || wholeWordIn(readTail, targetText)) return null;
    return { id: ch.id, mode: 'read-focus-word', answerKind: 'voice', responseClass: 'short_spoken_word',
      action: 'read-focus-word', targetPageId: ch.targetPageId, targetText: targetText.toLowerCase(), tier, readLead, readTail };
  }

  if (ch.type !== 'find-feature') return null;
  if (!isFeature(ch.targetFeature)) return null;
  if (!isSayableFeatureText(targetText) || opensWithSentinel(targetText)) return null;
  const options = (ch.optionTexts ?? []).map((o) => (o ?? '').trim()).filter(Boolean);
  if (options.length < 2) return null;
  if (!options.every((o) => isSayableFeatureText(o) && !opensWithSentinel(o))) return null;
  const normalized = options.map((o) => o.toLowerCase());
  if (new Set(normalized).size !== options.length) return null;
  if (normalized.filter((o) => o === targetText.toLowerCase()).length !== 1) return null;
  return { id: ch.id, mode: 'find-feature', answerKind: 'gesture', responseClass: 'manipulation', action: 'find-feature',
    targetPageId: ch.targetPageId, targetText, tier, feature: ch.targetFeature };
};

/** The session, dropping what cannot be asked. */
export const itemsFromChallenges = (challenges: InteractiveBookChallengeLike[], tier: SupportTier = 'medium'): InteractiveBookItem[] =>
  challenges.map((ch) => itemFromChallenge(ch, tier)).filter((item): item is InteractiveBookItem => item !== null);

/** The generator's side of the same gate. */
export const challengeAskable = (ch: InteractiveBookChallengeLike): boolean => itemFromChallenge(ch) !== null;

// ── The ask and the key ─────────────────────────────────────────────────────

const featureSpoken = (item: InteractiveBookItem): string => FEATURE_SPOKEN[item.feature ?? 'title'];

/** The ask: the part named (find), or the sentence up to the glowing word, hanging unfinished (read). Never the
 *  word, never the page's printed text. */
export const askFor = (item: InteractiveBookItem): string => (item.mode === 'find-feature'
  ? `Find the ${featureSpoken(item)}. Tap the ${featureSpoken(item)}.`
  : `Listen: ${item.readLead} — hmm. Read the glowing word.`);

/** read-focus-word's key: the printed word. find-feature has none: the activity checks the tap. */
export function interactiveBookKey(item: InteractiveBookItem): SpokenKey | null {
  if (item.mode !== 'read-focus-word') return null;
  return { answer: item.targetText, alsoAccept: [],
    acceptRule: 'The word inside a short phrase, or slow sounding-out that lands on it, counts: judge what the learner '
      + 'lands on, never speed.',
    signatureError: 'The sentence lead-in said back, or a different word that fits the sentence or means nearly the '
      + 'same, is wrong however smoothly it comes: the task is reading this printed word, not guessing from the story.' };
}

/**
 * read-focus-word's known wrong answers, most specific first: the sentence lead-in said back, a different word that
 * fits the sentence (`context_guess`, which the dots lever answers). No code knows which words fit, so `context_guess`
 * carries no example.
 */
export function interactiveBookSpokenMisses(item: InteractiveBookItem): KnownMiss[] {
  if (item.mode !== 'read-focus-word') return [];
  const word = item.targetText.toLowerCase(), lead = item.readLead?.trim();
  return [
    ...(lead ? [{ id: 'said_lead_in', pattern: `The sentence begins "${lead}" and then the glowing word "${word}". The learner says the beginning of the sentence back, "${lead}", and not the glowing word.`, examples: [lead] }] : []),
    { id: 'context_guess', pattern: `The glowing word is "${word}"${lead ? `, after "${lead}"` : ''}. The learner says a different word that would make sense in the sentence but is not "${word}".` },
  ];
}

// ── find-feature: the printed parts and the tap's check ────────────────────

/** The printed parts a view shows: title and author on the cover; heading, caption and page number on a page. */
export function hotspotsFor(book: InteractiveBookVolume, pageId: string): BookHotspot[] {
  if (pageId === 'cover') {
    return [
      { id: 'cover-title', feature: 'title', text: book.bookTitle },
      { id: 'cover-author', feature: 'author', text: book.author },
    ];
  }
  const page = book.pages.find((candidate) => candidate.id === pageId);
  if (!page) return [];
  return [
    { id: `${page.id}-heading`, feature: 'heading', text: page.heading },
    { id: `${page.id}-caption`, feature: 'caption', text: page.caption },
    { id: `${page.id}-number`, feature: 'page-number', text: `Page ${page.pageNumber}` },
  ];
}

/** The parts on screen for an item: a practice page's own, else its book view's. */
export const partsOf = (item: InteractiveBookItem, book: InteractiveBookVolume): BookHotspot[] =>
  item.parts ?? hotspotsFor(book, item.targetPageId);

/** The code check for a tapped printed part: its text against the target's. */
export const tapMatches = (item: InteractiveBookItem, tappedText: string) =>
  tappedText.replace(/["“”]/g, '').trim().toLowerCase() === item.targetText.trim().toLowerCase();

const TAPPED: Record<BookHotspot['feature'], InteractiveBookMiss | undefined> = {
  title: 'tapped_title', author: 'tapped_author', heading: 'tapped_heading', caption: 'tapped_caption',
  'page-number': 'tapped_page_number', 'focus-word': undefined,
};

/** What a wrong tap shows: the kind of part tapped, never what was asked. */
export const interactiveBookMiss = (item: InteractiveBookItem, hotspot: BookHotspot): InteractiveBookMiss | undefined =>
  item.mode !== 'find-feature' || tapMatches(item, hotspot.text) ? undefined : TAPPED[hotspot.feature];

/** How a tap reads to the tutor and the observer: the printed words tapped, never the key. */
export const describeBookTap = (text: string) => `Tapped the printed words "${text}".`;

/** What hear-again asks the tutor to say: the question only, never the answer. */
export const hearQuestionRequest = (item: InteractiveBookItem) =>
  `The learner tapped to hear the question again. Say only this, once: "${askFor(item)}" Never say the answer.`;

// ── The scene ───────────────────────────────────────────────────────────────

/** What the tutor is shown: the view and its never-say rules. Never a part's text as the answer, never the word. */
export function interactiveBookScene(item: InteractiveBookItem): SceneOf {
  if (item.mode === 'find-feature') {
    const feature = item.feature ?? 'title';
    const shown = item.parts
      ? `a practice page, not from the book, with two printed parts: ${item.parts.map(part => `"${part.text}"`).join(' and ')}.`
      : item.targetPageId === 'cover'
        ? 'the book cover, with its printed parts (title and author).'
        : 'one page of the book, with its printed parts (heading, picture caption and page number).';
    return { objects: [], facts: {
      kind: item.mode,
      shown,
      ...(item.parts ? { practice: 'An easier practice page, ungraded. The book page comes back after it.' } : {}),
      lookingFor: `the ${FEATURE_SPOKEN[feature]}`,
      constraints: 'Before the learner taps, never read any printed words of the page aloud, never say which printed '
        + 'words are the part asked for, and never say where on the page it sits. The screen shows only this view: '
        + `there is no page to turn. After a tap you may say what the part is for: ${FEATURE_JOB[feature]}.`,
    } };
  }
  return { objects: [], facts: {
    kind: item.mode,
    shown: item.line
      ? 'a practice sentence, not from the book, with one short word glowing.'
      : `${item.targetPageId === 'cover' ? 'the book cover' : 'one page of the book'}: its picture and its paragraphs, with one word glowing.`,
    ...(item.line ? { practice: 'An easier practice sentence, ungraded. The book page comes back after it.' } : {}),
    readUpToTheWord: item.readLead ?? '',
    constraints: 'Read the sentence only up to the glowing word, then stop: the glowing word is the learner\'s to read. '
      + 'Before they try, never spell it or sound it out either.',
  } };
}

// ── Harness answer material ──────────────────────────────────────────────────

/** The journey's spoken answers on a read item: the word, or a plainly different word. */
export function interactiveBookHarnessAnswers(item: InteractiveBookItem): { correct: string; plainWrong: string } {
  if (item.mode === 'find-feature') return { correct: item.targetText, plainWrong: 'a different book part' };
  return { correct: item.targetText, plainWrong: item.targetText === 'banana' ? 'turtle' : 'banana' };
}

/** The journey's taps on a find item: the Pip object ids of the right part and of another one on the same view. */
export function interactiveBookTaps(item: InteractiveBookItem, book: InteractiveBookVolume): { correct: string; wrong: string } {
  const parts = partsOf(item, book);
  const right = parts.find(p => tapMatches(item, p.text));
  const wrong = parts.find(p => !tapMatches(item, p.text));
  if (!right || !wrong) throw new Error(`interactive-book find-feature: no right and wrong part on ${item.targetPageId}`);
  return { correct: `part-${right.id}`, wrong: `part-${wrong.id}` };
}
