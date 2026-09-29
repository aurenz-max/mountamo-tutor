/**
 * Interactive book on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C3). Its only teaching path: the scripted
 * runner was retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component and the journey read the same assignment and scene. Find a book part
 * is a tap on a printed part of the page, which the activity checks. Read the glowing word is
 * spoken: the tutor reads the sentence up to the glowing word and the learner reads the word.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { FEATURE_SPOKEN, askFor, interactiveBookHarnessAnswers, type InteractiveBookItem } from './interactiveBookScript';
import type { BookFeatureKind, InteractiveBookVolume } from './InteractiveBook';

export interface BookHotspot {
  id: string;
  feature: BookFeatureKind;
  text: string;
}

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

/** The pack's own ask, without its "Your turn." hand-over. */
const ask = (item: InteractiveBookItem) => askFor(item).replace(/\s*Your turn\.\s*/, ' ').trim();

/** The code check for a tapped printed part: its text against the target's. */
export const tapMatches = (item: InteractiveBookItem, tappedText: string) =>
  tappedText.replace(/["“”]/g, '').trim().toLowerCase() === item.targetText.trim().toLowerCase();

/**
 * What a checked wrong tap on find-feature shows (handoff 20): which other printed part was tapped, by its kind
 * (`tapped_title`, `tapped_author` on the cover; `tapped_heading`, `tapped_caption`, `tapped_page_number` on a
 * page). read-focus-word is spoken (Part B).
 */
export type InteractiveBookMiss = 'tapped_title' | 'tapped_author' | 'tapped_heading' | 'tapped_caption' | 'tapped_page_number';

const TAPPED: Record<BookHotspot['feature'], InteractiveBookMiss | undefined> = {
  title: 'tapped_title', author: 'tapped_author', heading: 'tapped_heading', caption: 'tapped_caption', 'page-number': 'tapped_page_number',
  'focus-word': undefined,
};

export const interactiveBookMiss = (item: InteractiveBookItem, hotspot: BookHotspot): InteractiveBookMiss | undefined =>
  item.mode !== 'find-feature' || tapMatches(item, hotspot.text) ? undefined : TAPPED[hotspot.feature];

export function interactiveBookAssignment(item: InteractiveBookItem): TeachingAssignment {
  if (item.mode === 'find-feature') return { id: item.id, task: ask(item), response: 'gesture' };
  const misses = interactiveBookSpokenMisses(item);
  return { id: item.id, task: ask(item), response: 'speech',
    expectedAnswer: `${item.targetText}, the glowing word read aloud. The sentence lead-in said back, or a different `
      + 'word, is not it.', ...(misses.length ? { misses } : {}) };
}

/** What a wrong spoken read of the glowing word shows (handoff 20 Part B). */
export type SpokenInteractiveBookMiss = 'said_lead_in' | 'context_guess';

/**
 * read-focus-word's known wrong answers, most specific first: the sentence lead-in said back (the pack's signature
 * wrong), a different word that fits the sentence (`context_guess`, which the dots lever answers). No code knows
 * which words fit, so `context_guess` carries no example.
 */
export function interactiveBookSpokenMisses(item: InteractiveBookItem): KnownMiss[] {
  if (item.mode !== 'read-focus-word') return [];
  const word = item.targetText.toLowerCase(), lead = item.readLead?.trim();
  return [
    ...(lead ? [{ id: 'said_lead_in', pattern: `The sentence begins "${lead}" and then the glowing word "${word}". The learner says the beginning of the sentence back, "${lead}", and not the glowing word.`, examples: [lead] }] : []),
    { id: 'context_guess', pattern: `The glowing word is "${word}"${lead ? `, after "${lead}"` : ''}. The learner says a different word that would make sense in the sentence but is not "${word}".` },
  ];
}

export function interactiveBookScene(item: InteractiveBookItem): WorkspaceScene {
  const page = item.targetPageId === 'cover' ? 'the book cover' : 'one page of the book';
  if (item.mode === 'find-feature') {
    return { objects: [], facts: {
      shown: `${page}, with its printed parts (${item.targetPageId === 'cover' ? 'title and author' : 'heading, picture caption and page number'}).`,
      lookingFor: `the ${FEATURE_SPOKEN[item.feature ?? 'title']}`,
      constraints: 'The learner answers by tapping a printed part; the activity checks the tap. You cannot tap. Do not '
        + 'read out or point to which printed words are the part asked for before the learner tries.',
    } };
  }
  return { objects: [], facts: {
    shown: `${page}: its picture and its paragraphs, with one word glowing.`,
    readUpToTheWord: item.readLead ?? '',
    constraints: 'You read the sentence up to the glowing word, then stop; the learner reads the glowing word out '
      + 'loud. Never say the glowing word before they try.',
  } };
}

/** How a tap reads to the tutor and the observer: the printed words tapped, never the key. */
export const describeBookTap = (text: string) => `Tapped the printed words "${text}".`;

/** What hear-again asks the tutor to say: the question only, never the answer. */
export const hearQuestionRequest = (item: InteractiveBookItem) =>
  `The learner tapped to hear the question again. Say only this, once: "${ask(item)}" Never say the answer.`;

/** The journey's answers: the word read, or the Pip object ids of the right part and a wrong one to tap. */
export function interactiveBookJourneyAnswers(item: InteractiveBookItem, book: InteractiveBookVolume):
  { correct: string; plainWrong: string; tapped?: { correct: string; wrong: string } } {
  if (item.mode !== 'find-feature') {
    const { correct, plainWrong } = interactiveBookHarnessAnswers(item);
    return { correct, plainWrong };
  }
  const parts = hotspotsFor(book, item.targetPageId);
  const right = parts.find(p => tapMatches(item, p.text));
  const wrong = parts.find(p => !tapMatches(item, p.text));
  if (!right || !wrong) throw new Error(`interactive-book find-feature: no right and wrong part on ${item.targetPageId}`);
  const { correct, plainWrong } = interactiveBookHarnessAnswers(item, wrong.text);
  return { correct, plainWrong, tapped: { correct: `part-${right.id}`, wrong: `part-${wrong.id}` } };
}
