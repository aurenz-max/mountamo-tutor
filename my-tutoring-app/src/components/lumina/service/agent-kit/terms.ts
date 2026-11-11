/**
 * The kit's Learn more capability (USER 2026-11-08): when a question uses a technical word (mandible, proboscis), the
 * agent writes what the word means and the child can open a drawer beside the question. It explains the words and leaves
 * the question to the child: a definition says what a thing is and looks like, never the job the question asks about.
 *
 * Pure (no React, no model). `LearnMore.tsx` draws the drawer; the look stage shows the reader the open drawer, so a
 * definition that gives the answer away comes back as a shortcut.
 */
import { displayHtml, displayIssues, displayToolSchema, displayText, esc, readDisplay, type Display, type DisplayCapability } from './displays';

export interface Term { term: string; means: string; display?: Display }
const MAX_TERMS = 6;
const MAX_MEANS = 180;

/** A writer's `terms` field. */
export const termsToolSchema = (cap: DisplayCapability) => ({
  type: 'array',
  description: 'Technical words on this screen, for the Learn more drawer (see "Learn more"). Usually left out.',
  items: { type: 'object', properties: {
    term: { type: 'string', description: 'The word, spelled as it is on the screen.' },
    means: { type: 'string', description: 'One short sentence: what it is, what it looks like, where it is. Never the job the question asks about.' },
    display: displayToolSchema(cap).items,
  }, required: ['term', 'means'] },
}) as const;

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function readTerms(v: unknown): Term[] {
  return (Array.isArray(v) ? v : []).map(x => {
    const a = (x ?? {}) as { term?: unknown; means?: unknown; display?: unknown };
    const display = a.display === undefined ? null : readDisplay(a.display);
    return { term: s(a.term), means: s(a.means), ...(display ? { display } : {}) };
  });
}

const has = (text: string, phrase: string) => !!phrase.trim() && text.toLowerCase().includes(phrase.trim().toLowerCase());
const wordIn = (text: string, word: string) => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(text);
const longWords = (text: string): string[] => text.toLowerCase().match(/[a-z]{5,}/g) ?? [];

/** The terms still on a screen: a simplify that drops a card drops its word. */
export const termsOnScreen = (terms: readonly Term[], screen: string) => terms.filter(t => has(screen, t.term));

export interface TermScreen {
  /** Every word the child can read on this screen. */
  text: string;
  /** The choices, when the question has one right choice. */
  cards?: ReadonlyArray<{ label?: string; right: boolean }>;
  /** The boxes of a sort. */
  categories?: readonly string[];
}

/** Why these terms cannot ship, as sentences the author can act on. */
export function termIssues(terms: readonly Term[], screen: TermScreen, cap: DisplayCapability): string[] {
  if (!terms.length) return [];
  if (terms.length > MAX_TERMS) return [`terms: at most ${MAX_TERMS}`];
  const out: string[] = [];
  const named = new Set<string>();
  for (const t of terms) {
    if (!t.term || !t.means) { out.push('terms: each needs a term and what it means'); continue; }
    if (named.has(t.term.toLowerCase())) out.push(`terms: "${t.term}" is there twice`);
    named.add(t.term.toLowerCase());
    if (!has(screen.text, t.term)) out.push(`terms: "${t.term}" is not on this screen. Use the word as the screen spells it, or leave it out.`);
    if (t.means.length > MAX_MEANS) out.push(`terms: what "${t.term}" means is at most ${MAX_MEANS} characters`);
    for (const c of screen.cards ?? []) if (c.label && !has(c.label, t.term) && has(t.means, c.label)) out.push(`terms: what "${t.term}" means names the card "${c.label}"`);
    const shared = (w: string) => (screen.categories ?? []).every(c => longWords(c).includes(w));
    for (const box of screen.categories ?? []) for (const w of longWords(box)) {
      if (!shared(w) && wordIn(t.means, w)) { out.push(`terms: what "${t.term}" means uses "${w}", the name of a box, so it tells the child where the card goes`); break; }
    }
  }
  const defined = (label?: string) => !!label && terms.some(t => has(label, t.term));
  const cards = screen.cards ?? [];
  if (cards.length >= 2 && cards.some(c => c.right && defined(c.label)) && cards.filter(c => !c.right).every(c => !defined(c.label)))
    out.push('terms: only the right choice has a Learn more word, which points at it. Define the hard words on the wrong choices too, or none.');
  out.push(...displayIssues(terms.flatMap(t => (t.display ? [t.display] : [])), cap).map(x => `terms: ${x}`));
  return out;
}

export const termsText = (terms: readonly Term[]) => terms.map(t => `${t.term} ${t.means} ${t.display ? displayText(t.display) : ''}`).join(' ');

/** The drawer in words, for the tutor. */
export const termWords = (terms: readonly Term[]) => terms.map(t => `${t.term}: ${t.means}`).join('; ');

/** The open drawer, for the reader of the look stage. */
export function termsHtml(terms: readonly Term[] | undefined): string {
  if (!terms?.length) return '';
  return `<div style="border:1px solid rgba(56,189,248,.4);border-radius:12px;padding:10px;margin-bottom:14px"><p style="margin:0 0 8px;font-size:13px;color:#38bdf8">Learn more drawer, shown open (the child can open it during the task):</p>${terms.map(t => `<div style="margin-bottom:8px">${t.display ? `<div style="max-width:220px">${displayHtml(t.display)}</div>` : ''}<b>${esc(t.term)}</b>: ${esc(t.means)}</div>`).join('')}</div>`;
}

/** What the look reader is told about the drawer. */
export const TERMS_DESIGN = 'A "Learn more" drawer explains hard words during the task. Words in it count as taught. It must not give the answer: report a shortcut if a definition says which choice is right or what job a choice does when that job is what is asked.';

/** The prompt section an author with `terms` reads. */
export const termsPrompt = (example: string) => `
## Learn more (terms)
Prefer words this child knows. When a question really needs a technical word, add it to terms on that question: the child can open a Learn more drawer beside the question. Most questions need none.
Each term: term (spelled as on the screen), means (one short sentence), display (optional, a drawing of it). Say what the thing is, what it looks like and where it is, never the job the question asks about, so the child still reasons from the description to the answer. Define the hard words on every choice, not only the right one. Never define a word whose meaning is what the question tests.
${example}`;
