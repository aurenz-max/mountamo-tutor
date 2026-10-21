/**
 * poetry-lab's items, check and scene: the pure half of its boss (`poetryLab.card.ts`, `poetryLab.boss.ts`).
 *
 * One lesson is a list of checked items; the item's kind is its step on the card:
 * - rhyme_hunt (K-1): one item per round. The learner hears a four-line poem and taps the two word cards that rhyme;
 *   the second tap is the check.
 * - analysis (G2-6): one item per phase the poem supports: `mood` (pick the mood), `figurative` (tap a word of every
 *   figurative phrase, no other word), `rhyme` (pick the rhyme scheme).
 * - composition (G3-6): one item, the poem (`compose`). The check is the template's FORM in code: every line written
 *   with two or more words, no line repeated, an acrostic line starting with its letter, a counted line within one
 *   syllable of its target. Rhyme, meaning and word choice are not checked.
 *
 * The activity's own check is the judge, so the tutor is never told the rhyming pair, the mood, which words are
 * figurative or the scheme. Pure: the component, the boss and the journey read the same items and scene.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SupportTier } from '../../../components/live-activity/supportFact';
import { textFacts } from '../../../components/live-activity/runtime/sceneFacts';
import { stableShuffle } from '../../../utils/choiceOrder';
import { onsetOf } from './rhymeModels';
import type { PoetryLabData, RhymeHuntCandidate, RhymeHuntRound } from './PoetryLab';
import type { CompositionMiss, PoetryMiss } from './poetryLab.card';

export {
  ANALYSIS_MISSES, COMPOSITION_MISSES, RHYME_HUNT_MISSES,
  type AnalysisMiss, type CompositionMiss, type PoetryMiss, type RhymeHuntMiss,
} from './poetryLab.card';

export type PoetryItemKind = 'rhyme_hunt' | 'mood' | 'figurative' | 'rhyme' | 'compose';

/**
 * One checked item. A rhyme round carries its round; the poem carries its prompt; analysis and composition items
 * carry the lesson's support tier (rhyme_hunt never reads one: the K-1 band contract wins). A practice item a
 * simplify lever opens (`<id>~simpler`) carries the practice lesson it is drawn from.
 */
export interface PoetryItem {
  id: string;
  kind: PoetryItemKind;
  round?: RhymeHuntRound;
  prompt?: string;
  tier?: SupportTier;
  practice?: PoetryLabData;
}

const normalize = (w: string) => w.trim().toLowerCase();

/** The analysis phases this poem supports (a K-1 poem has no figurative language). */
export function analysisKinds(d: PoetryLabData): Array<'mood' | 'figurative' | 'rhyme'> {
  return [
    ...((d.moodOptions?.length ?? 0) > 0 && d.correctMood ? ['mood' as const] : []),
    ...((d.figurativeInstances?.length ?? 0) > 0 ? ['figurative' as const] : []),
    ...((d.rhymeSchemeOptions?.length ?? 0) > 0 && d.rhymeScheme ? ['rhyme' as const] : []),
  ];
}

export function poetryItems(d: PoetryLabData): PoetryItem[] {
  if (d.mode === 'rhyme_hunt') return (d.rounds ?? []).map(round => ({ id: round.id, kind: 'rhyme_hunt' as const, round }));
  const tier = d.supportTier ? { tier: d.supportTier } : {};
  if (d.mode === 'composition') return d.compositionPrompt ? [{ id: 'compose', kind: 'compose', prompt: d.compositionPrompt, ...tier }] : [];
  return analysisKinds(d).map(kind => ({ id: kind, kind, ...tier }));
}

/** The lesson an item is drawn from: its practice lesson, or the session's. */
export const itemData = (item: PoetryItem, d: PoetryLabData) => item.practice ?? d;

/** The tier shows the figurative count: easy, or no tier (the full-help render). */
export const showsFigurativeCount = (tier: SupportTier | undefined) => !tier || tier === 'easy';

// ── screen order ───────────────────────────────────────────────────────────

/**
 * The word cards in screen order. The generator lists them in line order and the pair is always lines 2 and 4, so
 * drawing them as given put the answer in the same two places every round.
 */
export function rhymeCards(round: RhymeHuntRound): RhymeHuntCandidate[] {
  return stableShuffle(round.candidates, `${round.id}|${round.candidates.map(c => c.word).join('|')}`);
}

/** Mood and scheme choices in a stable mixed order: the generator often lists the answer first. */
export const moodChoices = (d: PoetryLabData) => stableShuffle(d.moodOptions ?? [], `mood|${d.title}|${(d.poemLines ?? []).join('|')}`);
export const schemeChoices = (d: PoetryLabData) => stableShuffle(d.rhymeSchemeOptions ?? [], `scheme|${d.title}|${(d.poemLines ?? []).join('|')}`);

/** One tappable word of the poem on the figurative item, and the figurative phrase it belongs to (or null). */
export interface PoemWord { key: string; text: string; line: number; fig: number | null }

/**
 * Every word of the poem as its own control. A figurative phrase is not one button: a multi-word button among
 * one-word buttons marks where the phrases are. A phrase counts as found when any of its words is tapped.
 */
export function poemWords(d: PoetryLabData): PoemWord[] {
  const poem = d.poem ?? (d.poemLines ?? []).join('\n');
  const figs = d.figurativeInstances ?? [];
  const out: PoemWord[] = [];
  for (const m of Array.from(poem.matchAll(/\S+/g))) {
    const start = m.index ?? 0, end = start + m[0].length;
    const fig = figs.findIndex(f => start < f.endIndex && end > f.startIndex);
    out.push({ key: `poem-word-${out.length}`, text: m[0], line: poem.slice(0, start).split('\n').length - 1, fig: fig < 0 ? null : fig });
  }
  return out;
}

// ── the ask ────────────────────────────────────────────────────────────────

/** What the learner is asked on one item; a practice item says it is one. Never the answer. */
export function poetryAsk(item: PoetryItem): string {
  const task = item.kind === 'rhyme_hunt' ? 'Listen to the poem. Tap the two word cards that rhyme.'
    : item.kind === 'mood' ? 'Read the poem. What mood or feeling does it create? Pick one, then check.'
    : item.kind === 'figurative' ? 'Find the figurative language in the poem: tap a word of each figurative phrase, then check.'
    : item.kind === 'rhyme' ? 'What is the rhyme scheme of this poem? Pick one, then check.'
    : `${item.prompt ?? 'Write a poem.'} Write each line in its box, then check.`;
  return item.practice ? `Practice: ${task}` : task;
}

// ── the learner's work ─────────────────────────────────────────────────────

export interface PoetryView {
  /** rhyme_hunt: the cards tapped so far. */
  picked: readonly string[];
  mood: string | null;
  /** figurative: keys of the tapped poem words. */
  tapped: readonly string[];
  scheme: string | null;
  /** composition: the typed lines. */
  lines: readonly string[];
  /** composition: lines of a model poem on screen (a lever); copying one counts as a repeated line. */
  modelLines?: readonly string[];
}

export const EMPTY_VIEW: PoetryView = { picked: [], mood: null, tapped: [], scheme: null, lines: [] };

/** Rough syllable count, the one the screen's chips and the check use. */
export function countSyllables(text: string): number {
  let total = 0;
  for (const w of text.toLowerCase().trim().split(/\s+/)) {
    const cleaned = w.replace(/[^a-z]/g, '');
    if (!cleaned) continue;
    let count = (cleaned.match(/[aeiouy]+/g) || []).length;
    if (cleaned.endsWith('e') && count > 1) count--;
    total += count || 1;
  }
  return total;
}

const wordsIn = (s: string) => s.trim().split(/\s+/).filter(w => /[a-z]/i.test(w));

/** The learner's work in their own terms, never the key. */
export function describePoetryWork(item: PoetryItem, d: PoetryLabData, view: PoetryView): string {
  switch (item.kind) {
    case 'rhyme_hunt':
      return view.picked.length ? `Tapped ${view.picked.map(w => `"${w}"`).join(' and ')}` : 'No card tapped yet';
    case 'mood': return view.mood ? `Picked the mood "${view.mood}"` : 'No mood picked yet';
    case 'figurative': {
      const words = poemWords(d).filter(w => view.tapped.includes(w.key));
      return words.length ? `Tapped the words: ${words.map(w => `"${w.text}" (line ${w.line + 1})`).join(', ')}` : 'No word tapped yet';
    }
    case 'rhyme': return view.scheme ? `Picked the rhyme scheme ${view.scheme}` : 'No rhyme scheme picked yet';
    default: {
      const n = lineCount(d);
      const lines = Array.from({ length: n }, (_, i) => (view.lines[i] ?? '').trim());
      return lines.some(Boolean) ? lines.map((l, i) => `Line ${i + 1}: ${l ? `"${l}"` : '(empty)'}`).join('; ') : 'No line written yet';
    }
  }
}

export const lineCount = (d: PoetryLabData) => Math.max(1, d.templateConstraints?.lineCount || 3);

// ── the activity's check ───────────────────────────────────────────────────

export function isRhymePair(picked: readonly string[], round: RhymeHuntRound): boolean {
  if (picked.length !== 2) return false;
  const actual = picked.map(normalize).sort().join('|');
  return actual === [round.rhymeWordA, round.rhymeWordB].map(normalize).sort().join('|');
}

function figurativeFound(d: PoetryLabData, tapped: readonly string[]) {
  const words = poemWords(d).filter(w => tapped.includes(w.key));
  return { found: new Set(words.filter(w => w.fig !== null).map(w => w.fig as number)), literal: words.filter(w => w.fig === null) };
}

/** The first line that breaks the template's form, and how; undefined when the form holds. */
export function compositionMiss(d: PoetryLabData, lines: readonly string[], modelLines: readonly string[] = []): CompositionMiss | undefined {
  const n = lineCount(d), tc = d.templateConstraints;
  const typed = Array.from({ length: n }, (_, i) => (lines[i] ?? '').trim());
  if (typed.some(l => !l)) return 'line_missing';
  if (typed.some(l => wordsIn(l).length < 2)) return 'line_too_short';
  const seen = new Set(modelLines.map(l => l.trim().toLowerCase()));
  if (new Set(typed.map(l => l.toLowerCase())).size !== typed.length || typed.some(l => seen.has(l.toLowerCase()))) return 'line_repeated';
  const letters = tc?.acrosticWord;
  if (letters && typed.some((l, i) => letters[i] && l.replace(/^[^a-z]+/i, '').charAt(0).toLowerCase() !== letters[i].toLowerCase()))
    return 'wrong_first_letter';
  const targets = tc?.syllablesPerLine;
  if (targets && typed.some((l, i) => targets[i] !== undefined && Math.abs(countSyllables(l) - targets[i]) > 1)) return 'syllables_off';
  return undefined;
}

export function poetryCorrect(item: PoetryItem, d: PoetryLabData, view: PoetryView): boolean {
  switch (item.kind) {
    case 'rhyme_hunt': return !!item.round && isRhymePair(view.picked, item.round);
    case 'mood': return !!view.mood && normalize(view.mood) === normalize(d.correctMood ?? '');
    case 'figurative': {
      const { found, literal } = figurativeFound(d, view.tapped);
      return !literal.length && found.size === (d.figurativeInstances?.length ?? 0);
    }
    case 'rhyme': return !!view.scheme && view.scheme === d.rhymeScheme;
    default: return !compositionMiss(d, view.lines, view.modelLines);
  }
}

export function poetryMiss(item: PoetryItem | null | undefined, d: PoetryLabData, view: PoetryView): PoetryMiss | undefined {
  if (!item || poetryCorrect(item, d, view)) return undefined;
  switch (item.kind) {
    case 'rhyme_hunt': {
      const round = item.round;
      if (!round || view.picked.length !== 2) return undefined;
      const [a, b] = view.picked.map(normalize);
      if (onsetOf(a) && onsetOf(a) === onsetOf(b)) return 'same_start';
      const pair = new Set([round.rhymeWordA, round.rhymeWordB].map(normalize));
      return pair.has(a) || pair.has(b) ? 'one_of_pair' : 'neither_of_pair';
    }
    case 'mood': return view.mood ? 'other_mood' : undefined;
    case 'figurative': {
      if (!view.tapped.length) return undefined;
      return figurativeFound(d, view.tapped).literal.length ? 'literal_picked' : 'missed_some';
    }
    case 'rhyme': {
      if (!view.scheme) return undefined;
      return new Set([view.scheme, d.rhymeScheme]).size === 2 && [view.scheme, d.rhymeScheme].every(s => s === 'AABB' || s === 'ABAB')
        ? 'aabb_abab' : 'other_scheme';
    }
    default: return compositionMiss(d, view.lines, view.modelLines);
  }
}

// ── scene ──────────────────────────────────────────────────────────────────

const TEMPLATE_NAMES: Record<string, string> = { haiku: 'haiku', limerick: 'limerick', acrostic: 'acrostic poem',
  'free-verse': 'free verse poem', 'sonnet-intro': 'four-line sonnet opening' };

/**
 * What is drawn and asked, from the lesson the item is drawn from (`itemData`). Choices are listed in screen order and
 * never marked right. `kind` names the step. Only this primitive's own facts: how the moves go is the card's.
 */
export function workspaceScene(item: PoetryItem, d: PoetryLabData, view: PoetryView): SceneOf {
  const facts: Record<string, string> = { kind: item.kind };
  if (item.kind === 'rhyme_hunt' && item.round) {
    Object.assign(facts, textFacts('poem', item.round.poemLines.join(' / ')));
    facts.wordCards = `Word cards, in screen order, each with a picture: ${rhymeCards(item.round).map(c => c.word).join(', ')}`;
  } else if (item.kind === 'compose') {
    const tc = d.templateConstraints;
    facts.prompt = d.compositionPrompt ?? '';
    facts.form = [`A ${TEMPLATE_NAMES[d.templateType ?? 'free-verse'] ?? 'poem'} of ${lineCount(d)} lines`,
      tc?.syllablesPerLine ? `syllables per line ${tc.syllablesPerLine.join('-')}` : '',
      tc?.acrosticWord ? `each line starts with the next letter of ${tc.acrosticWord}` : '',
      tc?.rhymePattern ? `rhyme pattern ${tc.rhymePattern} (shown, not checked)` : ''].filter(Boolean).join('; ');
    if (tc?.syllablesPerLine) {
      facts.syllablesCounted = Array.from({ length: lineCount(d) }, (_, i) => `line ${i + 1}: ${countSyllables(view.lines[i] ?? '')}`).join(', ');
    }
    facts.constraints = 'The activity checks the form only: every line written with two or more words, no line repeated'
      + (tc?.acrosticWord ? ', each line starting with its letter' : '')
      + (tc?.syllablesPerLine ? ', each line within one syllable of its target (by the counter shown)' : '')
      + '. It does not judge rhyme, meaning or word choice.';
  } else {
    Object.assign(facts, textFacts('poem', (d.poemLines ?? []).join(' / ')));
    if (item.kind === 'mood') {
      facts.moodChoices = `Printed moods (pick one): ${moodChoices(d).join(', ')}`;
    } else if (item.kind === 'figurative') {
      if (showsFigurativeCount(item.tier)) facts.toFind = `The screen says ${d.figurativeInstances?.length ?? 0} figurative phrases are to be found`;
      facts.constraints = 'A phrase counts when any of its words is tapped, and a word in no figurative phrase makes the check wrong.';
    } else {
      facts.schemeChoices = `Printed rhyme schemes (pick one): ${schemeChoices(d).join(', ')}`;
      if (item.tier !== 'hard') facts.schemePreview = 'A letter beside each line shows the scheme the learner picked.';
    }
  }
  facts.learnerWork = describePoetryWork(item, d, view);
  return { objects: [], facts };
}

// ── harness ────────────────────────────────────────────────────────────────

/** One-syllable words (by `countSyllables`) the harness writes lines from. */
const ONE_BEAT = ['sun', 'rain', 'wind', 'leaf', 'tree', 'bird', 'sky', 'moon', 'star', 'snow', 'bright', 'cold', 'warm',
  'soft', 'green', 'gold', 'song', 'light', 'pond', 'frog', 'hill', 'cloud', 'drop', 'path'];

/** A line of `beats` words starting at `from` in the pool, so no two lines repeat. */
const beatLine = (beats: number, from: number) => Array.from({ length: beats }, (_, k) => ONE_BEAT[(from + k) % ONE_BEAT.length]).join(' ');

/**
 * The learner's work the journey drives for an item: a right answer, or a complete wrong one that the check names.
 * rhyme_hunt wrong: one pair word with a card outside the pair; mood and rhyme wrong: another printed choice;
 * figurative wrong: a word of the first phrase and a word in no phrase; composition wrong: the first line too long
 * (a counted template), the first line on the wrong letter (acrostic), or the first line written twice.
 */
export function poetryHarnessWork(item: PoetryItem, d: PoetryLabData, wrong: boolean): PoetryView {
  switch (item.kind) {
    case 'rhyme_hunt': {
      const round = item.round!;
      const other = rhymeCards(round).find(c => ![round.rhymeWordA, round.rhymeWordB].map(normalize).includes(normalize(c.word)))!;
      const pairWord = (w: string) => rhymeCards(round).find(c => normalize(c.word) === normalize(w))!.word;
      return { ...EMPTY_VIEW, picked: wrong ? [pairWord(round.rhymeWordA), other.word] : [pairWord(round.rhymeWordA), pairWord(round.rhymeWordB)] };
    }
    case 'mood': {
      const key = moodChoices(d).find(m => normalize(m) === normalize(d.correctMood ?? ''))!;
      return { ...EMPTY_VIEW, mood: wrong ? moodChoices(d).find(m => m !== key)! : key };
    }
    case 'figurative': {
      const words = poemWords(d), n = d.figurativeInstances?.length ?? 0;
      const firstOf = Array.from({ length: n }, (_, f) => words.find(w => w.fig === f)?.key).filter((k): k is string => !!k);
      if (!wrong) return { ...EMPTY_VIEW, tapped: firstOf };
      const literal = words.find(w => w.fig === null);
      if (literal) return { ...EMPTY_VIEW, tapped: [firstOf[0], literal.key] };
      if (firstOf.length > 1) return { ...EMPTY_VIEW, tapped: [firstOf[0]] };
      throw new Error('poetry-lab figurative: the whole poem is one phrase, no wrong tap');
    }
    case 'rhyme': {
      const key = d.rhymeScheme ?? '';
      return { ...EMPTY_VIEW, scheme: wrong ? schemeChoices(d).find(s => s !== key)! : key };
    }
    default: {
      // A wrong poem shares no line with the right one (the sweep reads a right line inside it as a revealed key).
      const tc = d.templateConstraints, n = lineCount(d), shift = wrong ? 2 : 0;
      const lines = Array.from({ length: n }, (_, i) => {
        const beats = tc?.syllablesPerLine?.[i] ?? 4;
        const letter = tc?.acrosticWord?.[i];
        return letter ? `${letter.toUpperCase()} is ${beatLine(Math.max(1, beats - 2), i * 5 + shift)}` : beatLine(beats, i * 5 + shift);
      });
      if (wrong) {
        if (tc?.acrosticWord) lines[0] = `${tc.acrosticWord[0].toLowerCase() === 'q' ? 'Zed' : 'Quiet'} ${beatLine(3, 17)}`;
        else if (tc?.syllablesPerLine) lines[0] = beatLine(tc.syllablesPerLine[0] + 3, 17);
        else if (n > 1) lines[1] = lines[0];
        else lines[0] = 'sun';
      }
      return { ...EMPTY_VIEW, lines };
    }
  }
}
