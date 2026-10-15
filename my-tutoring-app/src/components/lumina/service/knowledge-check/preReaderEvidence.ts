/**
 * Pre-reader (K) problems are read aloud; the only things on screen are the option pictures and an inset.
 * A question that points at "the picture", "the group", or asks how many things there are, with nothing drawn,
 * cannot be answered ("There are 10 flying bugs in the picture"). This finds those, and when an `arrangement`
 * inset IS drawn, code owns the count: the key is the number of objects drawn, not what the model wrote.
 */
import type { ArrangementInset, ProblemData } from '../../types';
import { findInsetAnswerLeaks } from '../insets';
import { lexWord } from '../wordSpace/lexicon';

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
// The project targets ES5, where a `u`-flag literal does not compile; the constructor form does at runtime.
const PICTOGRAPH = new RegExp('\\p{Extended_Pictographic}', 'u');

function numberIn(text: string): number | undefined {
  // The first word: an option reads "8 fish" or "Eight frogs".
  const t = text.toLowerCase().trim().split(/\s+/)[0] ?? '';
  if (/^\d+$/.test(t)) return Number(t);
  const i = NUMBER_WORDS.indexOf(t.replace(/[^a-z]/g, ''));
  return i >= 0 ? i : undefined;
}

const stemOf = (p: ProblemData): string => String((p as any).question ?? (p as any).statement ?? '');

/** The stem refers to something the child must see, or asks for a count of a set. */
export function needsDrawnEvidence(stem: string): 'count' | 'see' | null {
  const s = stem.toLowerCase();
  if (/\bhow many\b[^?]*\b(are there|in all|altogether|do you see|can you see|are in|are on the|in the (picture|group|row|box))\b/.test(s)
    || /\bthere (are|is) (\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/.test(s)
    || /\bcount the\b/.test(s)) return 'count';
  // "Which picture/one ..." points at the option pictures, which are drawn.
  const rest = s.replace(/\bwhich (picture|pictures|one|thing)\b/g, '');
  if (/\b(picture|pictures|photo|shown|below|above|look at|you see|this group|big group|small group|the group|the box|the row|here)\b/.test(rest)) return 'see';
  return null;
}

/** Why a pre-reader MC/TF problem cannot be answered from what is on screen. Empty = answerable. */
export function phantomEvidenceReasons(p: ProblemData): string[] {
  if (p.type !== 'multiple_choice' && p.type !== 'true_false') return [];
  const stem = stemOf(p);
  const need = needsDrawnEvidence(stem);
  if (!need) return [];
  if ((p as any).inset || PICTOGRAPH.test(stem)) return [];
  return [need === 'count'
    ? `asks about a set of objects ("${stem.slice(0, 60)}") but none is drawn`
    : `refers to a picture ("${stem.slice(0, 60)}") but none is shown`];
}

const remainingOf = (a: ArrangementInset) => a.count - (a.removed ?? 0);

/** With a set drawn, any "how many" question, or a "there are N" claim, is about that set. */
const asksDrawnCount = (stem: string): boolean =>
  /\bhow many\b/i.test(stem) || needsDrawnEvidence(stem) === 'count';

/**
 * The picture is drawn by code, so a multiple-choice count draws what the key says: the model's key and rationale
 * agree with each other, and its drawn count is the one number it gets wrong (9 drawn, options 6/7/8). Only a plain
 * set (no groups) with a numeric key of 1-10 is redrawn; anything else is left for `countKeyReasons`.
 */
export function drawCountFromKey(p: ProblemData): void {
  const inset = (p as any).inset as ArrangementInset | undefined;
  if (p.type !== 'multiple_choice' || !inset || inset.insetType !== 'arrangement' || inset.groups?.length) return;
  if (!asksDrawnCount(stemOf(p))) return;
  const mc = p as any;
  const key = (mc.options ?? []).find((o: any) => o.id === mc.correctOptionId);
  const n = key ? numberIn(String(key.text)) : undefined;
  if (n === undefined || n < 1 || n > 10 || remainingOf(inset) === n) return;
  const removed = inset.removed ?? 0;
  console.warn(`[KC PRE] arrangement drawn to the key: ${remainingOf(inset)} → ${n}`);
  if (n + removed <= 10) inset.count = n + removed;
  else { inset.count = n; delete inset.removed; }
}

/**
 * With an arrangement drawn and a counting stem, the key must be what is drawn. MC: exactly one option names the drawn
 * number and it is the key. TF "There are N ...": `correct` must equal (N === drawn). A mismatch is a reason, not a
 * silent re-key, because the rationale was written for the model's key.
 */
export function countKeyReasons(p: ProblemData): string[] {
  drawCountFromKey(p);
  const inset = (p as any).inset as ArrangementInset | undefined;
  if (!inset || inset.insetType !== 'arrangement' || !asksDrawnCount(stemOf(p))) return [];
  const drawn = remainingOf(inset);
  if (p.type === 'multiple_choice') {
    const mc = p as any;
    const hits = (mc.options ?? []).filter((o: any) => numberIn(String(o.text)) === drawn);
    if (hits.length !== 1) return [`${hits.length} options name the ${drawn} objects drawn; exactly one must`];
    if (mc.correctOptionId !== hits[0].id) return [`the key is not the ${drawn} objects drawn`];
    // The question must not say the count, and the drawn set must be valid (1-10, no digit emoji).
    return findInsetAnswerLeaks(inset, { kind: 'how_many', ask: stemOf(p), expectedAnswer: String(drawn) });
  } else if (p.type === 'true_false') {
    const m = stemOf(p).toLowerCase().match(/\bthere (?:are|is) (\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/);
    const n = m ? numberIn(m[1]) : undefined;
    if (n !== undefined && (p as any).correct !== (n === drawn)) return [`the statement says ${n}, ${drawn} are drawn, and the key disagrees`];
  }
  return [];
}

/**
 * A "starts with" question where a wrong option starts with the key's sound has two right answers ("starts with /m/,
 * like mud": map and mug). Checked against the word library's phones; an option the library does not know skips it.
 * Odd-one-out questions ("a different sound", "not") are the reverse task and are skipped.
 */
export function firstSoundReasons(p: ProblemData): string[] {
  if (p.type !== 'multiple_choice') return [];
  const stem = stemOf(p).toLowerCase();
  if (!/\b(starts?|begins?)\b|first sound|beginning sound/.test(stem) || /\b(different|not|doesn't|does not)\b/.test(stem)) return [];
  const mc = p as any;
  const words = (mc.options ?? []).map((o: any) => ({ o, w: lexWord(String(o.text).toLowerCase().replace(/^(a|an|the)\s+/, '')) }));
  if (words.some((x: any) => !x.w)) return [];
  const key = words.find((x: any) => x.o.id === mc.correctOptionId);
  if (!key) return [];
  const twin = words.find((x: any) => x !== key && x.w.phones[0] === key.w.phones[0]);
  return twin ? [`"${twin.o.text}" starts with the same sound as the answer "${key.o.text}": two right answers`] : [];
}

/** A number question whose stem says the key's number ("Which group shows six stars?" → "Six stars"). */
export function keyNumberInStemReasons(p: ProblemData): string[] {
  if (p.type !== 'multiple_choice') return [];
  const mc = p as any;
  const key = (mc.options ?? []).find((o: any) => o.id === mc.correctOptionId);
  const n = key ? numberIn(String(key.text)) : undefined;
  if (n === undefined) return [];
  const words = stemOf(p).toLowerCase().split(/[^a-z0-9]+/);
  return words.includes(String(n)) || words.includes(NUMBER_WORDS[n]) ? [`the question says the answer (${n})`] : [];
}

/** Everything that makes a pre-reader problem unanswerable or ambiguous from what is on screen. */
export const preReaderReasons = (p: ProblemData): string[] => [
  ...phantomEvidenceReasons(p), ...countKeyReasons(p), ...firstSoundReasons(p), ...keyNumberInStemReasons(p),
];
