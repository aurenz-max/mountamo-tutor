/**
 * The in-item levers on letter spotter, as one lever set (`bossLevers.ts`; `/add-support-tiers`, handoff 22 L1, name_it
 * handoff 24). Shape descriptions are banned in the tutor's voice, so every lever here is visual or names a sound.
 *
 * find_it (the tutor names a letter; the learner taps it in a grid of capitals):
 * - `other_case_reference` (clue): the named letter in LOWERCASE beside the grid. Answers `same_shape_family`. Leak
 *   rule (`referenceLeaks`): never the grid's own case, and only where the two cases differ in shape.
 * - `row_scan` (marks): a highlight that sweeps the rows in turn, looping, alike on every row. Answers `other_letter`.
 *   Leak rule: it never stops on or marks the target's row.
 * - `small_far_grid` (easier): a practice grid of four with a new letter the session never targets, the others from
 *   other shape families.
 * match_it (a big capital; the learner taps its lowercase):
 * - `wrong_choice_partner` (marks): the capital of each letter the learner TAPPED wrongly, on that tile. Offered only
 *   after a wrong tap. Leak rule: only the learner's own wrong choices, never the target's capital.
 * - `two_far_choices` (easier): a practice item with a new capital and two lowercase choices, the foil far in shape.
 * Every practice item is ungraded and uses no letter the session answers (the session invariant).
 * name_it (the tutor reads a sentence; the learner says the letter the starred word starts with):
 * - `first_letter_model` (model): another picture word, printed, its first letter lit; the tutor says the word, its
 *   first sound and that letter. Leak rule (`firstLetterModelLeak`): its first letter is no session target and it is no
 *   word of any session sentence. No simplify: another word asks the same thing, not less.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { LETTER_GROUPS, normalizeLetterGroup } from '../../../service/literacy/letterGroups';
import { letterSpotterCard } from './letterSpotter.card';
import { evalModeOf, MIRRORS, SHAPE_FAMILIES, type LetterSpotterItem } from './letterSpotterDomain';
import { emojiForKeyword, keywordFor, keywordNamesItsPicture } from './letterSoundLinkDomain';

export const CASE_LEVER = 'other_case_reference';
export const SCAN_LEVER = 'row_scan';
export const SMALL_GRID_LEVER = 'small_far_grid';
export const PARTNER_LEVER = 'wrong_choice_partner';
export const TWO_CHOICES_LEVER = 'two_far_choices';
export const FIRST_LETTER_LEVER = 'first_letter_model';

/** Letters whose lowercase is the capital's shape at another size: a reference in the other case is the same glyph. */
const SAME_SHAPE_CASES = new Set('cosuvwxzkp'.split(''));
/** Capitals a K reader confuses by shape, beyond the lowercase families. */
const UPPER_NEAR = ['EF', 'MNW', 'OQCG', 'PRB', 'ILT', 'UV', 'KX', 'HN'];

const familyOf = (l: string) => SHAPE_FAMILIES.find(f => f.includes(l.toLowerCase())) ?? '';
const far = (a: string, b: string) => {
  const x = a.toLowerCase(), y = b.toLowerCase();
  if (x === y || familyOf(x).includes(y) || MIRRORS.has(x + y) || MIRRORS.has(y + x)) return false;
  return !UPPER_NEAR.some(g => g.includes(x.toUpperCase()) && g.includes(y.toUpperCase()));
};

export const hasOtherCaseShape = (letter: string) => !SAME_SHAPE_CASES.has(letter.toLowerCase());

/** Leak rule for the reference: true when it is drawn in the grid's own case or the cases share a shape. */
export const referenceLeaks = (item: LetterSpotterItem, drawn: string) =>
  drawn !== item.targetLetter.toLowerCase() || !hasOtherCaseShape(item.targetLetter)
  || (item.letterGrid ?? []).includes(drawn);

/** The capitals drawn on wrong tiles: the learner's own wrong taps, never the target. */
export const partnerCapitals = (item: LetterSpotterItem, wrongTaps: readonly string[]) =>
  Array.from(new Set(wrongTaps.map(l => l.toLowerCase()))).filter(l => l !== item.targetLetter.toLowerCase() && item.options.includes(l));

/** Every letter the session asks for. A practice item may answer none of them. */
export const sessionTargets = (items: readonly LetterSpotterItem[]) => new Set(items.map(i => i.targetLetter.toLowerCase()));

/** A stable spread of the target over the four cells, so it is not always first. */
const slot = (id: string) => Array.from(id).reduce((n, ch) => n + ch.charCodeAt(0), 0) % 4;

/**
 * The practice item for `item`, or null: a new letter in the letter group that the session never targets, with
 * letters far from it and from each other. find_it: a grid of four capitals. match_it: two lowercase tiles.
 */
export function practiceItem(item: LetterSpotterItem, items: readonly LetterSpotterItem[], letterGroup: number | undefined): LetterSpotterItem | null {
  if (item.mode === 'name-it') return null;
  const group = LETTER_GROUPS[normalizeLetterGroup(letterGroup) ?? 4].filter(l => l.length === 1);
  const used = sessionTargets(items);
  const foilCount = item.mode === 'find-it' ? 3 : 1;
  for (const target of group.filter(l => !used.has(l) && hasOtherCaseShape(l))) {
    const foils: string[] = [];
    for (const l of group) {
      if (foils.length === foilCount) break;
      if (far(l, target) && foils.every(f => far(f, l))) foils.push(l);
    }
    if (foils.length < foilCount) continue;
    const base = { ...item, id: `${item.id}~simpler`, targetLetter: target };
    if (item.mode === 'match-it') return { ...base, options: [target, ...foils].sort() };
    const grid = foils.map(f => f.toUpperCase());
    grid.splice(slot(item.id), 0, target.toUpperCase());
    return { ...base, letterGrid: grid, options: [] };
  }
  return null;
}

/** Leak rule for a practice item: true if it answers a session letter or offers no far choice. */
export const practiceLeak = (practice: LetterSpotterItem, items: readonly LetterSpotterItem[]) =>
  sessionTargets(items).has(practice.targetLetter.toLowerCase())
  || (practice.mode === 'find-it' ? practice.letterGrid ?? [] : practice.options)
    .filter(l => l.toLowerCase() !== practice.targetLetter).some(l => !far(l, practice.targetLetter));

// -- first_letter_model: name_it --

export interface FirstLetterModel { word: string; emoji: string; letter: string }
/** Continuants first: a held first sound is the easiest to hear. */
const MODEL_ORDER = 'msfnlrvzhbdgptcjkw'.split('');
const sentenceWords = (items: readonly LetterSpotterItem[]) =>
  new Set(items.flatMap(i => (i.spokenSentence ?? '').toLowerCase().match(/[a-z]+/g) ?? []));

/** Leak rule for the model: true when its first letter is a session target or it is a word of a session sentence. */
export const firstLetterModelLeak = (m: FirstLetterModel, items: readonly LetterSpotterItem[]) =>
  sessionTargets(items).has(m.letter) || sentenceWords(items).has(m.word);

/** The model for a name_it item: a keyword picture word of a group letter, else of any letter, that passes. */
export function firstLetterModelFor(item: LetterSpotterItem, items: readonly LetterSpotterItem[], letterGroup: number | undefined): FirstLetterModel | null {
  if (item.mode !== 'name-it') return null;
  const group = LETTER_GROUPS[normalizeLetterGroup(letterGroup) ?? 4];
  const ordered = [...MODEL_ORDER.filter(l => group.includes(l)), ...MODEL_ORDER.filter(l => !group.includes(l))];
  const model = (l: string): FirstLetterModel => ({ letter: l, word: keywordFor(l), emoji: emojiForKeyword(keywordFor(l)) });
  const letter = ordered.find(l => keywordNamesItsPicture(l) && keywordFor(l)[0] === l && !firstLetterModelLeak(model(l), items));
  return letter ? model(letter) : null;
}

// ── The lever set ────────────────────────────────────────────────────────────

/** What the set reads beyond the item: the session's items, the letter group, and the learner's wrong taps on the
 *  current item so far (kept through Try again, for `wrong_choice_partner`). */
export interface LetterSpotterLeverContext {
  items: readonly LetterSpotterItem[];
  letterGroup: number | undefined;
  wrongTaps: readonly string[];
}

export const LETTER_SPOTTER_LEVERS = leverSet<LetterSpotterItem, LetterSpotterLeverContext>({
  modeOf: evalModeOf,
  missesOf: mode => letterSpotterCard.modes[mode].misses,
  // The reference names the letter the ask already names (find_it's stimulus); its answer is a position.
  answersOf: () => [],
  support: { tier: item => item.tier, different: 'another picture word, its first letter lit',
    own: 'the letter this item\'s word starts with' },
  specs: [
    { id: FIRST_LETTER_LEVER, type: 'model', modes: ['name_it'], answers: 'all',
      when: 'The learner says the word, a letter from later in it, or a letter it does not have.',
      // The model word is named only in the scene fact once pulled: named here, the tutor spoke of it before any pull.
      does: 'Shows another picture word in print with its first letter lit. Once it is on screen, say that word, its first '
        + 'sound, and the letter it starts with. It is not this item\'s word.',
      content: (item, ctx) => firstLetterModelFor(item, ctx.items, ctx.letterGroup),
      fact: (m: FirstLetterModel) => `A model on another word, ${m.word}, is shown as a picture and in print with its first `
        + `letter lit: ${m.word} starts with ${m.letter.toUpperCase()}. It is not this item's word.` },
    { id: CASE_LEVER, type: 'clue', modes: ['find_it'], carrier: 'shown', answers: ['same_shape_family'],
      when: 'The learner taps a letter that looks like the named one.',
      does: 'Shows the named letter as a small letter on a card beside the grid of big letters.',
      offer: item => hasOtherCaseShape(item.targetLetter),
      fact: 'The named letter is shown as a small letter on a card beside the grid.' },
    { id: SCAN_LEVER, type: 'marks', modes: ['find_it'], answers: ['other_letter'],
      when: 'The learner taps a letter that looks nothing like the named one, as if not searching.',
      does: 'A highlight sweeps the rows of the grid one at a time, over and over, so the learner can check each row in turn.',
      fact: 'A highlight sweeps the rows of the grid one at a time, over and over.' },
    { id: SMALL_GRID_LEVER, type: 'easier', modes: ['find_it'], carrier: 'shown', answers: 'all',
      when: 'The learner cannot yet pick this letter out from letters like it.',
      does: 'Opens an easier practice item first: a different letter, in a grid of four, the others shaped nothing like it. '
        + 'It is not graded; the full item comes back after it.',
      content: (item, ctx) => practiceItem(item, ctx.items, ctx.letterGroup) },
    { id: PARTNER_LEVER, type: 'marks', modes: ['match_it'], answers: 'all',
      when: 'The learner tapped a little letter that does not go with the big one.',
      does: 'Shows the big letter that goes with each little letter the learner tapped wrongly, on that tile.',
      content: (item, ctx) => { const partners = partnerCapitals(item, ctx.wrongTaps); return partners.length ? partners : null; },
      fact: (partners: string[]) => 'The big letter that goes with each little letter the learner tapped wrongly '
        + `(${partners.join(', ')}) is shown on that tile.` },
    { id: TWO_CHOICES_LEVER, type: 'easier', modes: ['match_it'], carrier: 'shown', answers: 'all',
      when: 'The learner cannot yet pick this letter out from letters like it.',
      does: 'Opens an easier practice item first: a different letter, with two little letters to choose from, the other '
        + 'shaped nothing like it. It is not graded; the full item comes back after it.',
      content: (item, ctx) => practiceItem(item, ctx.items, ctx.letterGroup) },
  ],
});
