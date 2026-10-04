/**
 * The in-item levers on text-structure-analyzer (`/add-support-tiers`, table `qa/support-levers/text-structure-analyzer-lever-table-2026-10-03.md`,
 * lever plan 2026-10-03 step 4). Every mode runs three actions on one passage, so the levers are per action:
 *
 * - find-signal: `focus_sentence` (rings the asked sentence; offered only where the tier left it off), `link_model`
 *   (a different sentence, its linking word underlined between two bracketed ideas), simplify `short_link_sentence`.
 * - name-structure: `structure_model` (a different mini passage, its structure named), `say_choices` (the printed
 *   menu read aloud where the tier left it unspoken), simplify `structure_practice` (R5: a mini passage of another
 *   structure, named from two far options). Grade 2 has none: its two-option menu answers by elimination.
 * - place-idea: `anchor_idea` (a spare idea of the passage shown filed, marked as an example), `source_sentence`
 *   (rings the passage sentence the idea came from), simplify `two_part_practice` (3-part charts: a spare idea asked
 *   with two parts).
 *
 * Nothing marks a word inside the passage, and the passage is never read aloud. Leak rules are the pure functions
 * below; the pool is `textStructureModels.ts`.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { STRUCTURE_GLOSS, STRUCTURE_LABEL, TRANSITION_WORDS, choicesPhrase, countConnectives, isStructureType,
  passageNamesStructure, structureDistance, wordBoundedIndexOf, type PassageSentence, type SpareIdea, type StructureTypeId,
  type TextStructureItem } from './textStructureAnalyzerScript';
import type { SpokenTextStructureMiss } from './textStructureAnalyzerWorkspace';
import { LINK_MODELS, MINI_PASSAGES, structuresForGrade, type LinkModel, type MiniPassage } from './textStructureModels';

export const FOCUS_LEVER = 'focus_sentence';
export const LINK_MODEL_LEVER = 'link_model';
export const SHORT_LINK_LEVER = 'short_link_sentence';
export const STRUCTURE_MODEL_LEVER = 'structure_model';
export const SAY_CHOICES_LEVER = 'say_choices';
export const STRUCTURE_PRACTICE_LEVER = 'structure_practice';
export const ANCHOR_LEVER = 'anchor_idea';
export const SOURCE_LEVER = 'source_sentence';
export const TWO_PART_LEVER = 'two_part_practice';

const seedOf = (id: string) => Array.from(id).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 13);
const pick = <T>(list: readonly T[], seed: number): T | null => (list.length ? list[seed % list.length] : null);
const words = (s: string) => s.toLowerCase().match(/[a-z]+/g) ?? [];
const STOP = new Set(['that', 'this', 'with', 'into', 'from', 'there', 'then', 'they', 'their', 'when', 'were', 'have', 'them',
  'what', 'over', 'also', 'after', 'before', 'because', 'since', 'some']);
const content = (s: string) => new Set(words(s).filter(w => w.length >= 4 && !STOP.has(w)));

export interface TsaSession {
  passage: string; sentences: readonly PassageSentence[]; items: readonly TextStructureItem[]; spares: readonly SpareIdea[];
  grade: number; structure: StructureTypeId | null; hasAnchor: boolean;
}

/** Passage words of 4+ letters: a model or practice may share none. */
const passageWords = (s: TsaSession) => content(s.passage);
const sharesPassageWord = (text: string, s: TsaSession) => { const pw = passageWords(s); return Array.from(content(text)).some(w => pw.has(w)); };
/** A linking word the passage uses, or shares a stem with (after / afterward). */
const linkInPassage = (word: string, s: TsaSession) => {
  const w = word.toLowerCase(), ws = words(s.passage);
  return wordBoundedIndexOf(s.passage.toLowerCase(), w) >= 0 || ws.some(x => x.startsWith(w) || (x.length >= 4 && w.startsWith(x)));
};

// ── find-signal ──────────────────────────────────────────────────────────────

export const linkModelLeak = (m: LinkModel, s: TsaSession) => linkInPassage(m.word, s) || sharesPassageWord(m.sentence, s)
  || countConnectives(m.sentence) !== 1;

export function linkModelFor(item: TextStructureItem, s: TsaSession): LinkModel | null {
  return pick(LINK_MODELS.filter(m => !linkModelLeak(m, s)), seedOf(item.id));
}

/** The two ideas a model's linking word joins, for the brackets on the card. */
export function linkParts(m: LinkModel): [string, string, string] {
  const at = wordBoundedIndexOf(m.sentence.toLowerCase(), m.word.toLowerCase());
  return [m.sentence.slice(0, at).trim(), m.sentence.slice(at, at + m.word.length), m.sentence.slice(at + m.word.length).trim()];
}

export function shortLinkFor(item: TextStructureItem, s: TsaSession): TextStructureItem | null {
  const model = linkModelFor(item, s);
  const p = pick(LINK_MODELS.filter(m => !linkModelLeak(m, s) && m.word !== model?.word && m.sentence.split(' ').length <= 8), seedOf(item.id) + 1);
  return p ? { ...item, id: `${item.id}~simpler`, answer: p.word, stimulusText: p.sentence, sentenceIndex: -1,
    showFocusSentence: false, onCard: true } : null;
}

// ── name-structure ───────────────────────────────────────────────────────────

export const passageLeak = (p: MiniPassage, answer: StructureTypeId, s: TsaSession) => p.structure === answer
  || passageNamesStructure(p.text, answer) || passageNamesStructure(p.text, p.structure) || sharesPassageWord(p.text, s);

const answerOf = (item: TextStructureItem): StructureTypeId | null =>
  (Object.keys(STRUCTURE_LABEL) as StructureTypeId[]).find(k => STRUCTURE_LABEL[k] === item.answer) ?? null;

/** A different structure: off the menu and in the grade band first; a menu structure only on a menu of 3+. */
export function structureModelFor(item: TextStructureItem, s: TsaSession): MiniPassage | null {
  const answer = answerOf(item);
  // Grade 2: its only in-band structures are the answer and one other, so any in-band model answers by elimination.
  if (!answer || item.choices.length < 3 || s.grade <= 2) return null;
  const band = structuresForGrade(s.grade), onMenu = new Set(item.choices);
  const ok = MINI_PASSAGES.filter(p => band.includes(p.structure) && !passageLeak(p, answer, s));
  const off = ok.filter(p => !onMenu.has(STRUCTURE_LABEL[p.structure]));
  return pick(off.length ? off : ok, seedOf(item.id));
}

export function structurePracticeFor(item: TextStructureItem, s: TsaSession): { item: TextStructureItem; text: string } | null {
  const answer = answerOf(item);
  if (!answer || item.choices.length < 3 || s.grade <= 2) return null;
  const model = structureModelFor(item, s);
  const band = structuresForGrade(s.grade);
  const p = pick(MINI_PASSAGES.filter(x => band.includes(x.structure) && !passageLeak(x, answer, s) && x !== model), seedOf(item.id) + 1);
  if (!p) return null;
  const foil = [...band].filter(k => k !== p.structure).sort((a, b) => structureDistance(p.structure, b) - structureDistance(p.structure, a))[0];
  const pair: StructureTypeId[] = seedOf(item.id) % 2 ? [p.structure, foil] : [foil, p.structure];
  return { text: p.text, item: { ...item, id: `${item.id}~simpler`, answer: STRUCTURE_LABEL[p.structure],
    choices: pair.map(k => STRUCTURE_LABEL[k]), choiceNotes: pair.map(k => STRUCTURE_GLOSS[k]),
    diagnosticWrong: STRUCTURE_LABEL[foil], namesChoices: true, onCard: true } };
}

// ── place-idea ───────────────────────────────────────────────────────────────

/** The passage sentence an idea came from: the unique best content-word overlap of 2+, else null. */
export function sourceSentenceOf(idea: string, s: TsaSession): PassageSentence | null {
  const want = content(idea);
  const scored = s.sentences.map(x => ({ x, n: Array.from(content(x.text)).filter(w => want.has(w)).length })).sort((a, b) => b.n - a.n);
  if (!scored.length || scored[0].n < 2 || (scored[1] && scored[1].n === scored[0].n)) return null;
  return scored[0].x;
}

/** The ring would say the part: the sentence holds a word of the answer's label and of no other label. */
export function sourceLeak(item: TextStructureItem, sentence: PassageSentence): boolean {
  const own = new Set(words(item.answer).filter(w => w.length >= 3 && w !== 'and'));
  const others = new Set(item.choices.filter(c => c !== item.answer).flatMap(c => words(c)));
  const said = new Set(words(sentence.text));
  return Array.from(own).some(w => said.has(w) && !others.has(w)) && !Array.from(others).some(w => w.length >= 3 && said.has(w));
}

export function sourceFor(item: TextStructureItem, s: TsaSession): PassageSentence | null {
  const src = sourceSentenceOf(item.stimulusText, s);
  return src && !sourceLeak(item, src) ? src : null;
}

/** A spare idea filed on its mat, never asked, not from the current idea's sentence. */
export function anchorFor(item: TextStructureItem, s: TsaSession): SpareIdea | null {
  if (s.hasAnchor) return null;
  const src = sourceSentenceOf(item.stimulusText, s)?.index;
  return s.spares.find(sp => sp.text !== item.stimulusText && (src == null || sourceSentenceOf(sp.text, s)?.index !== src)) ?? null;
}

/** The part a 3-part chart drops for its practice: the shared part of a comparison (else its last), the middle of a sequence. */
const droppedPart = (choices: readonly string[], structure: StructureTypeId | null) => {
  if (choices.length !== 3) return null;
  if (structure === 'compare-contrast') return choices.find(c => /both|shared|same|alike|similar|common/i.test(c)) ?? choices[2];
  return structure === 'chronological' ? choices[1] : null;
};

export function twoPartFor(item: TextStructureItem, s: TsaSession): TextStructureItem | null {
  const dropped = droppedPart(item.choices, s.structure);
  if (!dropped) return null;
  const anchor = anchorFor(item, s);
  const spare = s.spares.find(sp => sp.id !== anchor?.id && sp.region !== dropped && sp.text !== item.stimulusText
    && sourceSentenceOf(sp.text, s)?.index !== sourceSentenceOf(item.stimulusText, s)?.index);
  if (!spare) return null;
  const choices = item.choices.filter(c => c !== dropped);
  return { ...item, id: `${item.id}~simpler`, answer: spare.region, stimulusText: spare.text, choices,
    choiceNotes: choices.map(() => ''), namesChoices: true };
}

// ── the levers ───────────────────────────────────────────────────────────────

export function leversOnScreen(pulled: readonly string[], item: TextStructureItem, s: TsaSession): string | null {
  const on = (id: string) => pulled.includes(id);
  const link = on(LINK_MODEL_LEVER) ? linkModelFor(item, s) : null;
  const model = on(STRUCTURE_MODEL_LEVER) ? structureModelFor(item, s) : null;
  const anchor = on(ANCHOR_LEVER) ? anchorFor(item, s) : null;
  const src = on(SOURCE_LEVER) ? sourceFor(item, s) : null;
  const parts = [
    on(FOCUS_LEVER) && 'the asked sentence is highlighted in the passage',
    link && `a model card with another sentence, "${link.sentence}": "${link.word}" underlined between its two bracketed ideas. `
      + 'You may read the model card; it is not the passage',
    model && `a model card with another short passage, "${model.text}", its linking words underlined and named ${STRUCTURE_LABEL[model.structure]}. `
      + 'You may read the model card; it is not the passage',
    on(SAY_CHOICES_LEVER) && `a speaker mark on the printed choices: read them in screen order: ${choicesPhrase(item)}`,
    anchor && `an example idea filed on its part: "${anchor.text}" under ${anchor.region}. It is never asked`,
    src && `the sentence the idea came from is highlighted in the passage (sentence ${src.index + 1})`,
  ].filter(Boolean);
  return parts.length ? parts.join('; ') : null;
}

export function textStructureLevers(item: TextStructureItem | null, s: TsaSession, pulled: readonly string[],
  starting: readonly string[] = []): WorkspaceLever[] {
  if (!item) return [];
  const levers: WorkspaceLever[] = [];
  const add = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: SpokenTextStructureMiss[], when: string, does: string) => {
    if (!starting.includes(id)) levers.push({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  };
  const fence = 'Read only the card the receipt names; never make up a model of your own. Never apply it to the passage or say '
    + 'which word or part of the passage is like it.';
  if (item.action === 'find-signal') {
    if (!item.showFocusSentence) add(FOCUS_LEVER, 'help', 'shown', ['not_in_sentence'], 'The learner answers from the wrong sentence.',
      'Highlights the whole asked sentence in the passage. It marks no word in it.');
    if (linkModelFor(item, s)) add(LINK_MODEL_LEVER, 'help', 'both', ['content_word', 'not_in_sentence'],
      'The learner names a thing or an action, or a word not in the sentence.',
      `Shows a card with another sentence, its linking word underlined between its two bracketed ideas. Once it is on screen you may read the model card aloud, "My turn", then ask about the numbered sentence again. ${fence}`);
    if (shortLinkFor(item, s)) add(SHORT_LINK_LEVER, 'simplify', 'both', ['content_word'],
      'The learner still cannot find the linking word after help.',
      'Opens an easier practice sentence on a card: two short ideas and one linking word. The learner reads it; do not read it. It is not graded; the full item comes back after it.');
  } else if (item.action === 'name-structure') {
    const answered: SpokenTextStructureMiss[] = ['other_structure', 'said_topic', 'said_signal_word'];
    if (structureModelFor(item, s)) add(STRUCTURE_MODEL_LEVER, 'help', 'both', answered,
      'The learner names the wrong structure, the topic, or a linking word.',
      `Shows a card with another short passage of a different structure, its linking words underlined and its structure named. Once it is on screen you may read the model card aloud, "My turn". ${fence}`);
    if (!item.namesChoices) add(SAY_CHOICES_LEVER, 'help', 'voiced', [],
      'The learner cannot read the printed choices.',
      `Puts a speaker mark on the printed choices. Once it is on screen, read them in screen order, all of them, stressing none: ${choicesPhrase(item)}`);
    if (structurePracticeFor(item, s)) add(STRUCTURE_PRACTICE_LEVER, 'simplify', 'both', ['other_structure'],
      'The learner still names the wrong structure after help.',
      'Opens an easier practice passage on a card, named from two far-apart choices. The learner reads it; do not read it. It is not graded; the full item comes back after it.');
  } else {
    if (!item.namesChoices) add(SAY_CHOICES_LEVER, 'help', 'voiced', [],
      'The learner cannot read the part names.',
      `Puts a speaker mark on the part names. Once it is on screen, read them in screen order, all of them, stressing none: ${choicesPhrase(item)}`);
    if (anchorFor(item, s)) add(ANCHOR_LEVER, 'help', 'both', ['said_idea_back', 'other_part'],
      'The learner says the idea back, or names the other part.',
      'Shows one more idea of this passage filed on its part, marked as an example. It is never asked. You may read it; never say where the current idea goes.');
    if (sourceFor(item, s)) add(SOURCE_LEVER, 'help', 'shown', ['other_part'], 'The learner names the other part.',
      'Highlights the whole passage sentence the idea came from, so the learner can reread it and its linking word. Do not read it.');
    if (twoPartFor(item, s)) add(TWO_PART_LEVER, 'simplify', 'both', ['other_part'],
      'The learner still names the wrong part after help.',
      'Opens an easier practice idea from this passage, asked with two parts instead of three. Read the idea, as on every part question. It is not graded; the full item comes back after it.');
  }
  return levers;
}

/** Phase 6: easy starts with the focus ring, the spoken choices and the anchor; medium with the ring and the spoken choices. */
export const startingLevers = (tier: string | undefined): string[] =>
  tier === 'hard' ? [] : tier === 'easy' ? [FOCUS_LEVER, SAY_CHOICES_LEVER, ANCHOR_LEVER] : [FOCUS_LEVER, SAY_CHOICES_LEVER];

export { isStructureType, TRANSITION_WORDS };
