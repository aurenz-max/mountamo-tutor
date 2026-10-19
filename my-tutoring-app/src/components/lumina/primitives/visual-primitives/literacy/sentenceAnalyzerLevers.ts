/**
 * The in-item levers on sentence-analyzer, as one lever set (`bossLevers.ts`; `/add-support-tiers`, table
 * `qa/support-levers/sentence-analyzer-lever-table-2026-10-03.md`, lever plan 2026-10-03 step 2). The child says a
 * grammar label from memory; the relation between the asked word and its label IS the answer, so no lever marks the
 * item's sentence.
 *
 * R1/R2 (answer-blind): every model and practice pick is a function of the grade wall, the session's words and the
 * item id, never of the item's answer, and a model shows every label of each two-label set on the wall, so it never
 * points at one. A practice item may share the item's label: it is assisted work, and only the full item is credited.
 *
 * Help: `model_sentence` (name-pos), `two_row_model` (name-role), `split_model` (name-side), `wall_examples` (every
 * walled action). Simplify: `short_sentence` (name-pos, name-role), `short_subject` (name-side), `plain_kind`
 * (name-type). Leak rule (`poolLeak`): no pool word is a session target word, and no pool word of 4+ letters is in a
 * session sentence. The tier is where the levers start (`startingLevers`): a starting lever is drawn from the first
 * render and never offered as a pull.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { sentenceAnalyzerCard } from './sentenceAnalyzer.card';
import { gradeNumberOf, isReadableAloud, itemsFromPayload, posWallFor, PRACTICE_SUFFIX, speechSafe, type ResolvedSentence,
  type SentenceAnalyzerItem, type SentenceAnalyzerPayloadLike } from './sentenceAnalyzerDomain';
import { MODEL_SENTENCES, PRACTICE_KIND, PRACTICE_POS, PRACTICE_ROLE, PRACTICE_SIDE, WALL_EXAMPLES, type PoolSentence,
  type WallExample } from './sentenceModels';

export const MODEL_LEVER = 'model_sentence';
export const TWO_ROW_LEVER = 'two_row_model';
export const SPLIT_LEVER = 'split_model';
export const EXAMPLES_LEVER = 'wall_examples';
export const SHORT_SENTENCE_LEVER = 'short_sentence';
export const SHORT_SUBJECT_LEVER = 'short_subject';
export const PLAIN_KIND_LEVER = 'plain_kind';

const bare = (text: string) => text.toLowerCase().replace(/[^a-z']/g, '');
/** A stable number from the item id: the seed for every pick. Never the answer. */
const seedOf = (id: string) => Array.from(id).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export interface SessionWords { targets: Set<string>; words: Set<string> }
export const sessionWords = (items: readonly SentenceAnalyzerItem[]): SessionWords => ({
  targets: new Set(items.map(i => bare(i.targetWord)).filter(Boolean)),
  words: new Set(items.flatMap(i => i.sentence.split(/\s+/).map(bare)).filter(Boolean)),
});

/** What a lever reads beyond the item: the session's items, words and sentences, the grade's part-of-speech wall and
 *  whether the band reads aloud. */
export interface SentenceSession {
  items: readonly SentenceAnalyzerItem[];
  words: SessionWords;
  sentences: readonly ResolvedSentence[];
  posWall: readonly string[];
  readsAloud: boolean;
}

export const sentenceSession = (data: SentenceAnalyzerPayloadLike): SentenceSession => {
  const { items, sentences, readsAloud } = itemsFromPayload(data);
  return { items, words: sessionWords(items), sentences, posWall: posWallFor(gradeNumberOf(data.gradeLevel)), readsAloud };
};

/** The number of words in the complete subject of the item's sentence (0 when it has none). */
const subjectWordsOf = (item: SentenceAnalyzerItem, s: SentenceSession) =>
  (s.sentences.find(x => x.index === item.sentenceIndex)?.subjectEndIndex ?? -1) + 1;

/** A pool word the child could carry to the item: a session target, or a 4+ letter word of a session sentence. */
export const wordLeaks = (word: string, session: SessionWords) => {
  const w = bare(word);
  return !!w && (session.targets.has(w) || (w.length >= 4 && session.words.has(w)));
};
export const poolLeak = (p: PoolSentence, session: SessionWords) => p.words.some(w => wordLeaks(w.text, session));

/** The two-label sets the lesson separates (CONFUSABLE_WITH) that are both on this wall. */
const PAIRS: Array<[string, string]> = [['Adjective', 'Adverb'], ['Noun', 'Pronoun']];
const pairsOnWall = (wall: readonly string[]) => PAIRS.filter(([a, b]) => wall.includes(a) && wall.includes(b));
const pick = <T>(list: readonly T[], seed: number): T | null => (list.length ? list[seed % list.length] : null);

// ── help: the model cards ────────────────────────────────────────────────────

/** name-pos: every word's part of speech on the wall, both members of each pair on the wall present. */
export function modelSentenceFor(item: SentenceAnalyzerItem, session: SessionWords): PoolSentence | null {
  if (item.action !== 'name-pos') return null;
  const fits = MODEL_SENTENCES.filter(p => !poolLeak(p, session) && p.words.every(w => item.wallLabels.includes(w.pos))
    && pairsOnWall(item.wallLabels).every(pair => pair.every(label => p.words.some(w => w.pos === label))));
  return pick(fits, seedOf(item.id));
}

/** name-role: every role on the grade wall present, and no role off it. Each word carries its part of speech too. */
export function twoRowModelFor(item: SentenceAnalyzerItem, session: SessionWords, posWall: readonly string[]): PoolSentence | null {
  if (item.action !== 'name-role') return null;
  const fits = MODEL_SENTENCES.filter(p => !poolLeak(p, session)
    && p.words.every(w => item.wallLabels.includes(w.role) && posWall.includes(w.pos))
    && item.wallLabels.every(label => p.words.some(w => w.role === label)));
  return pick(fits, seedOf(item.id));
}

/** name-side: a subject that opens with a small word and a describing word, so the signature words sit inside it. */
export function splitModelFor(item: SentenceAnalyzerItem, session: SessionWords): PoolSentence | null {
  if (item.action !== 'name-side') return null;
  const fits = MODEL_SENTENCES.filter(p => !poolLeak(p, session) && p.subjectEnd !== null && p.subjectEnd >= 2
    && p.words[0].pos === 'Determiner' && p.words.slice(1, p.subjectEnd).some(w => w.pos === 'Adjective'));
  return pick(fits, seedOf(item.id));
}

/** One example per wall label, all labels at once; null when a label has no example clear of the session. */
export function wallExamplesFor(item: SentenceAnalyzerItem, session: SessionWords): Record<string, WallExample> | null {
  if (!item.wallLabels.length || item.action === 'name-side') return null;
  const out: Record<string, WallExample> = {};
  for (const label of item.wallLabels) {
    const ok = (WALL_EXAMPLES[label] ?? []).find(e => !wordLeaks(e.word, session)
      && !e.phrase.split(/\s+/).some(w => bare(w).length >= 4 && wordLeaks(w, session)));
    if (!ok) return null;
    out[label] = ok;
  }
  return out;
}

// ── simplify: the practice items ─────────────────────────────────────────────

const practiceItem = (item: SentenceAnalyzerItem, p: PoolSentence, index: number, answer: string, readsAloud: boolean): SentenceAnalyzerItem => {
  const spoken = isReadableAloud(p.sentence) ? speechSafe(p.sentence) : '';
  return { ...item, id: `${item.id}${PRACTICE_SUFFIX}`, answer, sentence: p.sentence, spokenSentence: spoken, sentenceIndex: -1,
    targetIndex: index, targetWord: index >= 0 ? p.words[index].text : '', readAloud: readsAloud && spoken ? `Listen. ${spoken} ` : '',
    practiceWords: p.words.map(w => w.text) };
};

/**
 * The practice item for `item`, or null. The target is drawn by seed over the practice sentence's on-wall words,
 * preferring words whose label belongs to a pair on the wall: the same draw whichever member the item's answer is.
 */
export function practiceFor(item: SentenceAnalyzerItem, s: SentenceSession): SentenceAnalyzerItem | null {
  const seed = seedOf(item.id);
  const clear = (pool: PoolSentence[]) => pool.filter(p => !poolLeak(p, s.words));
  if (item.action === 'name-pos' || item.action === 'name-role') {
    const labelOf = (w: PoolSentence['words'][number]) => (item.action === 'name-pos' ? w.pos : w.role);
    const pairs = pairsOnWall(item.wallLabels).flat();
    for (let k = 0; k < 12; k++) {
      const p = pick(clear(item.action === 'name-pos' ? PRACTICE_POS : PRACTICE_ROLE), seed + k);
      if (!p) return null;
      const onWall = p.words.map((w, i) => ({ i, label: labelOf(w) })).filter(x => item.wallLabels.includes(x.label));
      const preferred = onWall.filter(x => pairs.includes(x.label));
      const target = pick(preferred.length ? preferred : onWall, seed);
      if (target) return practiceItem(item, p, target.i, target.label, s.readsAloud);
    }
    return null;
  }
  if (item.action === 'name-side') {
    // Nothing to drop when the item's complete subject is already two words or fewer.
    if (subjectWordsOf(item, s) <= 2) return null;
    const p = pick(clear(PRACTICE_SIDE), seed);
    if (!p || p.subjectEnd === null) return null;
    const i = seed % p.words.length;
    return practiceItem(item, p, i, i <= p.subjectEnd ? 'Subject' : 'Predicate', s.readsAloud);
  }
  const p = pick(clear(PRACTICE_KIND), seed);
  return p ? practiceItem(item, p, -1, p.kind, s.readsAloud) : null;
}

/** The session item a practice id stands in for. */
export const practiceParent = (id: string, items: readonly SentenceAnalyzerItem[]) =>
  items.find(i => `${i.id}${PRACTICE_SUFFIX}` === id) ?? null;

// ── the tier's starting levers ───────────────────────────────────────────────

/** Phase 6: easy starts with the wall examples drawn (not offered, not recorded); other tiers with nothing. */
export const startingLevers = (tier: string | undefined): string[] => (tier === 'easy' ? [EXAMPLES_LEVER] : []);

const notStarting = (id: string) => (item: SentenceAnalyzerItem) => !startingLevers(item.tier).includes(id);

// ── the lever set ────────────────────────────────────────────────────────────

const labelled = (p: PoolSentence, row: 'pos' | 'role' | 'both') => p.words.map(w => `${w.text.replace(/[.?!]$/, '')} (${
  row === 'pos' ? w.pos : row === 'role' ? w.role : `${w.pos}, ${w.role}`})`).join(' ');
const OTHER = 'It is another sentence, not this one.';
const FENCE = 'Read only the card the receipt names; never make up a model of your own. The learner reads its labels: '
  + 'do not say a label aloud before the learner tries, never say which model word is like the asked word, and never '
  + 'label a word of this sentence.';
const PRACTICE = 'with one word or the whole sentence to name. Ask it. It is not graded; the full item comes back after it.';
const POS_MODES = ['identify_pos', 'label_all'];
const WORD_MODES = ['identify_pos', 'label_all', 'identify_role'];
type Mode = keyof typeof sentenceAnalyzerCard.modes;

const examples = (modes: string[], answers: string[]) => ({
  id: EXAMPLES_LEVER, type: 'meaning' as const, carrier: 'shown' as const, modes, answers,
  offer: notStarting(EXAMPLES_LEVER),
  when: 'The learner says another label from the wall.',
  does: 'Puts one example under every label on the wall, its example word underlined. It marks no label. Do not point to one '
    + 'or read a label aloud.',
  content: (item: SentenceAnalyzerItem, s: SentenceSession) => wallExamplesFor(item, s.words),
  fact: 'An example phrase under every label on the wall, its example word underlined.',
});
const shortSentence = (modes: string[], answers: string[]) => ({
  id: SHORT_SENTENCE_LEVER, type: 'easier' as const, modes, answers,
  when: 'The learner still cannot name it after help.',
  does: `Opens an easier practice sentence first (three or four words), ${PRACTICE}`,
  content: (item: SentenceAnalyzerItem, s: SentenceSession) =>
    (item.action === 'name-pos' || item.action === 'name-role' ? practiceFor(item, s) : null),
});

/** Every lever of the family, by type, in the order the tutor sees them. */
export const SENTENCE_LEVERS = leverSet<SentenceAnalyzerItem, SentenceSession>({
  modeOf: item => item.mode,
  missesOf: mode => sentenceAnalyzerCard.modes[mode as Mode]?.misses ?? [],
  answersOf: item => [item.answer],
  support: { tier: item => item.tier,
    different: item => (item.action === 'name-side' ? 'another sentence split into its subject and predicate'
      : 'another sentence, every word labelled'),
    own: item => (item.action === 'name-type' ? 'this sentence\'s kind' : 'this word\'s label') },
  specs: [
    { id: MODEL_LEVER, type: 'model', modes: POS_MODES, answers: ['confusable_label', 'describing_word'],
      when: 'The learner mixes up two labels, such as adjective and adverb, or says "describing word".',
      does: 'Shows a card with a different sentence, every word labelled with its part of speech. Once it is on screen you may '
        + `walk the card by what each word does (names a thing, tells which one, shows an action). ${FENCE}`,
      content: (item, s) => modelSentenceFor(item, s.words),
      fact: (m: PoolSentence) => `A model card with another sentence, every word labelled: ${labelled(m, 'pos')}. ${OTHER}` },
    { id: TWO_ROW_LEVER, type: 'model', modes: ['identify_role'], answers: ['part_of_speech', 'named_the_side'],
      when: 'The learner says a part of speech for a job, or says subject or predicate for a word inside them.',
      does: 'Shows a card with a different sentence, each word with its part of speech over its job. Once it is on screen you '
        + `may walk the card by what each word does. ${FENCE}`,
      content: (item, s) => twoRowModelFor(item, s.words, s.posWall),
      fact: (m: PoolSentence) => `A model card with another sentence, each word with its part of speech over its job: ${labelled(m, 'both')}. ${OTHER}` },
    { id: SPLIT_LEVER, type: 'model', modes: ['parse_structure'], answers: ['other_side'],
      when: 'The learner puts a small word or a describing word on the wrong side.',
      does: `Shows a card with a different sentence, its complete subject bracketed and labelled subject, the rest predicate. ${FENCE}`,
      content: (item, s) => splitModelFor(item, s.words),
      fact: (m: PoolSentence) => `A model card with another sentence, its subject "${m.words.slice(0, (m.subjectEnd ?? 0) + 1).map(w => w.text).join(' ')}" `
        + `bracketed and labelled subject, the rest bracketed and labelled predicate. ${OTHER}` },
    examples(WORD_MODES, ['confusable_label', 'other_label']),
    examples(['parse_structure'], ['other_label']),
    shortSentence(POS_MODES, ['confusable_label', 'other_label', 'describing_word']),
    shortSentence(['identify_role'], ['part_of_speech', 'confusable_label', 'other_label', 'named_the_side']),
    { id: SHORT_SUBJECT_LEVER, type: 'easier', modes: ['parse_structure'], answers: ['other_side'],
      when: 'The learner still cannot name it after help.',
      does: `Opens an easier practice sentence first (a two-word subject), ${PRACTICE}`,
      content: (item, s) => (item.action === 'name-side' ? practiceFor(item, s) : null) },
    { id: PLAIN_KIND_LEVER, type: 'easier', modes: ['parse_structure'], answers: ['other_label'],
      when: 'The learner still cannot name it after help.',
      does: `Opens an easier practice sentence first (a short sentence in its plainest form), ${PRACTICE}`,
      content: (item, s) => (item.action === 'name-type' ? practiceFor(item, s) : null) },
  ],
});
