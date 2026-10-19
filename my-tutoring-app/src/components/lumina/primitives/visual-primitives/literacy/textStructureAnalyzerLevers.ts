/**
 * The in-item levers on text-structure-analyzer, as one lever set (`bossLevers.ts`; `/add-support-tiers`, table
 * `qa/support-levers/text-structure-analyzer-lever-table-2026-10-03.md`, lever plan 2026-10-03 step 4). Every mode runs
 * three actions on one passage, so the levers are offered by action:
 *
 * - find-signal: `focus_sentence` (rings the asked sentence; offered only where the tier left it off), `link_model`
 *   (a different sentence, its linking word underlined between two bracketed ideas), simplify `short_link_sentence`.
 * - name-structure: `structure_model` (a different mini passage, its structure named), `say_choices` (the printed
 *   menu read aloud where the tier left it unspoken), simplify `structure_practice` (R5: a mini passage of another
 *   structure, named from two far options). Grade 2 has neither model nor practice: its two-option menu answers by
 *   elimination.
 * - place-idea: `say_choices` (the part names read aloud), `anchor_idea` (a spare idea of the passage shown filed,
 *   marked as an example), `source_sentence` (rings the passage sentence the idea came from), simplify
 *   `two_part_practice` (3-part charts: a spare idea asked with two parts).
 *
 * Nothing marks a word inside the passage, and the passage is never read aloud. Leak rules are the pure functions
 * below; the pool is `textStructureModels.ts`. The tier is where the levers start (`startingLevers`): a starting lever
 * is drawn from the first render and never offered as a pull.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { textStructureAnalyzerCard } from './textStructureAnalyzer.card';
import { PRACTICE_SUFFIX, STRUCTURE_GLOSS, STRUCTURE_LABEL, choicesPhrase, countConnectives,
  isStructureType, passageNamesStructure, structureDistance, wordBoundedIndexOf, type PassageSentence, type SpareIdea,
  textStructureItems, type StructureTypeId, type TextStructureItem, type TextStructurePayloadLike } from './textStructureAnalyzerDomain';
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

/** What a lever reads beyond the item: the passage, its sentences, the session's items and spare ideas. */
export interface TsaSession {
  passage: string; sentences: readonly PassageSentence[]; items: readonly TextStructureItem[]; spares: readonly SpareIdea[];
  grade: number; structure: StructureTypeId | null; hasAnchor: boolean;
}

/** The session a lever reads, built exactly as the component builds it. */
export function tsaSession(data: TextStructurePayloadLike & { instanceId?: string }, instanceId = data.instanceId ?? 'text-structure-analyzer'): TsaSession {
  const { items, sentences, spares } = textStructureItems(data, instanceId);
  return { passage: data.passage ?? '', sentences, items, spares,
    grade: Number(String(data.gradeLevel ?? '').replace(/[^0-9]/g, '')) || 4,
    structure: isStructureType(data.structureType) ? data.structureType : null, hasAnchor: !!data.anchorIdeaId };
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
  return p ? { ...item, id: `${item.id}${PRACTICE_SUFFIX}`, answer: p.word, stimulusText: p.sentence, sentenceIndex: -1,
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
  if (item.action !== 'name-structure' || !answer || item.choices.length < 3 || s.grade <= 2) return null;
  const band = structuresForGrade(s.grade), onMenu = new Set(item.choices);
  const ok = MINI_PASSAGES.filter(p => band.includes(p.structure) && !passageLeak(p, answer, s));
  const off = ok.filter(p => !onMenu.has(STRUCTURE_LABEL[p.structure]));
  return pick(off.length ? off : ok, seedOf(item.id));
}

/** The practice item: a mini passage of another structure, named from two far options. Its text rides on `practiceText`. */
export function structurePracticeFor(item: TextStructureItem, s: TsaSession): TextStructureItem | null {
  const answer = answerOf(item);
  if (item.action !== 'name-structure' || !answer || item.choices.length < 3 || s.grade <= 2) return null;
  const model = structureModelFor(item, s);
  const band = structuresForGrade(s.grade);
  const p = pick(MINI_PASSAGES.filter(x => band.includes(x.structure) && !passageLeak(x, answer, s) && x !== model), seedOf(item.id) + 1);
  if (!p) return null;
  const foil = [...band].filter(k => k !== p.structure).sort((a, b) => structureDistance(p.structure, b) - structureDistance(p.structure, a))[0];
  const pair: StructureTypeId[] = seedOf(item.id) % 2 ? [p.structure, foil] : [foil, p.structure];
  return { ...item, id: `${item.id}${PRACTICE_SUFFIX}`, answer: STRUCTURE_LABEL[p.structure],
    choices: pair.map(k => STRUCTURE_LABEL[k]), choiceNotes: pair.map(k => STRUCTURE_GLOSS[k]),
    diagnosticWrong: STRUCTURE_LABEL[foil], namesChoices: true, onCard: true, practiceText: p.text };
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
  if (item.action !== 'place-idea') return null;
  const src = sourceSentenceOf(item.stimulusText, s);
  return src && !sourceLeak(item, src) ? src : null;
}

/** A spare idea filed on its mat, never asked, not from the current idea's sentence. */
export function anchorFor(item: TextStructureItem, s: TsaSession): SpareIdea | null {
  if (item.action !== 'place-idea' || s.hasAnchor) return null;
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
  if (item.action !== 'place-idea') return null;
  const dropped = droppedPart(item.choices, s.structure);
  if (!dropped) return null;
  const anchor = anchorFor(item, s);
  const spare = s.spares.find(sp => sp.id !== anchor?.id && sp.region !== dropped && sp.text !== item.stimulusText
    && sourceSentenceOf(sp.text, s)?.index !== sourceSentenceOf(item.stimulusText, s)?.index);
  if (!spare) return null;
  const choices = item.choices.filter(c => c !== dropped);
  return { ...item, id: `${item.id}${PRACTICE_SUFFIX}`, answer: spare.region, stimulusText: spare.text, choices,
    choiceNotes: choices.map(() => ''), namesChoices: true };
}

/** The practice item a simplify lever opens on a session item, by its action. */
export const practiceFor = (item: TextStructureItem, s: TsaSession): TextStructureItem | null =>
  (item.action === 'find-signal' ? shortLinkFor(item, s) : item.action === 'name-structure' ? structurePracticeFor(item, s) : twoPartFor(item, s));

/** The session item a practice id stands in for. */
export const practiceParent = (id: string, items: readonly TextStructureItem[]) =>
  items.find(i => `${i.id}${PRACTICE_SUFFIX}` === id) ?? null;

// ── the tier's starting levers ───────────────────────────────────────────────

/** Phase 6: easy starts with the focus ring, the spoken choices and the anchor; medium with the ring and the spoken choices. */
export const startingLevers = (tier: string | undefined): string[] =>
  tier === 'hard' ? [] : tier === 'easy' ? [FOCUS_LEVER, SAY_CHOICES_LEVER, ANCHOR_LEVER] : [FOCUS_LEVER, SAY_CHOICES_LEVER];

const notStarting = (id: string) => (item: TextStructureItem) => !startingLevers(item.tier).includes(id);

// ── the lever set ────────────────────────────────────────────────────────────

const FENCE = 'Read only the card the receipt names; never make up a model of your own. Never apply it to the passage or say '
  + 'which word or part of the passage is like it.';
const PRACTICE = 'It is not graded; the full item comes back after it.';
type Mode = keyof typeof textStructureAnalyzerCard.modes;

/** Every lever of the family, by type, in the order the tutor sees them. */
export const TSA_LEVERS = leverSet<TextStructureItem, TsaSession>({
  modeOf: item => item.mode,
  missesOf: mode => textStructureAnalyzerCard.modes[mode as Mode]?.misses ?? [],
  support: { tier: item => item.tier,
    different: item => (item.action === 'find-signal' ? 'another sentence'
      : item.action === 'name-structure' ? 'another short passage of a different structure' : 'another idea of this passage'),
    own: item => (item.action === 'find-signal' ? 'this sentence\'s linking word'
      : item.action === 'name-structure' ? 'this passage\'s structure' : 'where this idea goes') },
  specs: [
    { id: FOCUS_LEVER, type: 'marks', answers: ['not_in_sentence'],
      offer: item => item.action === 'find-signal' && !item.showFocusSentence && notStarting(FOCUS_LEVER)(item),
      when: 'The learner answers from the wrong sentence.',
      does: 'Highlights the whole asked sentence in the passage. It marks no word in it.',
      fact: 'The asked sentence is highlighted in the passage.' },
    { id: LINK_MODEL_LEVER, type: 'model', answers: ['content_word', 'not_in_sentence'],
      offer: item => item.action === 'find-signal',
      when: 'The learner names a thing or an action, or a word not in the sentence.',
      does: 'Shows a card with another sentence, its linking word underlined between its two bracketed ideas. Once it is on '
        + `screen you may read the model card aloud, "My turn", then ask about the numbered sentence again. ${FENCE}`,
      content: linkModelFor,
      fact: (m: LinkModel) => `A model card with another sentence, "${m.sentence}": "${m.word}" underlined between its two `
        + 'bracketed ideas. You may read the model card; it is not the passage.' },
    { id: SHORT_LINK_LEVER, type: 'easier', answers: ['content_word'],
      offer: item => item.action === 'find-signal',
      when: 'The learner still cannot find the linking word after help.',
      does: `Opens an easier practice sentence on a card: two short ideas and one linking word. The learner reads it; do not read it. ${PRACTICE}`,
      content: shortLinkFor },
    { id: STRUCTURE_MODEL_LEVER, type: 'model', answers: ['other_structure', 'said_topic', 'said_signal_word'],
      when: 'The learner names the wrong structure, the topic, or a linking word.',
      does: 'Shows a card with another short passage of a different structure, its linking words underlined and its structure '
        + `named. Once it is on screen you may read the model card aloud, "My turn". ${FENCE}`,
      content: structureModelFor,
      fact: (m: MiniPassage) => `A model card with another short passage, "${m.text}", its linking words underlined and named `
        + `${STRUCTURE_LABEL[m.structure]}. You may read the model card; it is not the passage.` },
    { id: SAY_CHOICES_LEVER, type: 'marks', carrier: 'voiced', answers: [],
      offer: item => item.action !== 'find-signal' && !item.namesChoices && notStarting(SAY_CHOICES_LEVER)(item),
      when: item => (item.action === 'name-structure' ? 'The learner cannot read the printed choices.' : 'The learner cannot read the part names.'),
      does: item => `Puts a speaker mark on the ${item.action === 'name-structure' ? 'printed choices' : 'part names'}. Once it is on `
        + `screen, read them in screen order, all of them, stressing none: ${choicesPhrase(item)}`,
      fact: (_c: unknown, item: TextStructureItem) => `A speaker mark on the printed choices: read them in screen order: ${choicesPhrase(item)}` },
    { id: STRUCTURE_PRACTICE_LEVER, type: 'easier', answers: ['other_structure'],
      when: 'The learner still names the wrong structure after help.',
      does: `Opens an easier practice passage on a card, named from two far-apart choices. The learner reads it; do not read it. ${PRACTICE}`,
      content: structurePracticeFor },
    { id: ANCHOR_LEVER, type: 'model', answers: ['said_idea_back', 'other_part'],
      offer: notStarting(ANCHOR_LEVER),
      when: 'The learner says the idea back, or names the other part.',
      does: 'Shows one more idea of this passage filed on its part, marked as an example. It is never asked. You may read it; '
        + 'never say where the current idea goes.',
      content: anchorFor,
      fact: (a: SpareIdea) => `An example idea filed on its part: "${a.text}" under ${a.region}. It is never asked.` },
    { id: SOURCE_LEVER, type: 'marks', answers: ['other_part'],
      when: 'The learner names the other part.',
      does: 'Highlights the whole passage sentence the idea came from, so the learner can reread it and its linking word. Do not read it.',
      content: sourceFor,
      fact: (src: PassageSentence) => `The sentence the idea came from is highlighted in the passage (sentence ${src.index + 1}).` },
    { id: TWO_PART_LEVER, type: 'easier', answers: ['other_part'],
      when: 'The learner still names the wrong part after help.',
      does: `Opens an easier practice idea from this passage, asked with two parts instead of three. Read the idea, as on every part question. ${PRACTICE}`,
      content: twoPartFor },
  ],
});
