/**
 * The in-item levers on sentence-analyzer (`/add-support-tiers`, table `qa/support-levers/sentence-analyzer-lever-table-2026-10-03.md`,
 * lever plan 2026-10-03 step 2). The child says a grammar label from memory; the relation between the asked word and
 * its label IS the answer, so no lever marks the item's sentence.
 *
 * R1/R2 (answer-blind): every model and practice pick is a function of the grade wall, the session's words and the
 * item id, never of the item's answer, and a model shows every label of each two-label set on the wall, so it never
 * points at one. A practice item may share the item's label: it is assisted work, and only the full item is credited.
 *
 * Help: `model_sentence` (name-pos), `two_row_model` (name-role), `split_model` (name-side), `wall_examples` (every
 * walled action). Simplify: `short_sentence` (name-pos, name-role), `short_subject` (name-side), `plain_kind`
 * (name-type). Leak rule (`poolLeak`): no pool word is a session target word, and no pool word of 4+ letters is in a
 * session sentence.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { isReadableAloud, speechSafe, type SentenceAnalyzerItem } from './sentenceAnalyzerScript';
import type { SpokenSentenceMiss } from './sentenceAnalyzerWorkspace';
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
  const fits = MODEL_SENTENCES.filter(p => !poolLeak(p, session) && p.words.every(w => item.wallLabels.includes(w.pos))
    && pairsOnWall(item.wallLabels).every(pair => pair.every(label => p.words.some(w => w.pos === label))));
  return pick(fits, seedOf(item.id));
}

/** name-role: every role on the grade wall present, and no role off it. Each word carries its part of speech too. */
export function twoRowModelFor(item: SentenceAnalyzerItem, session: SessionWords, posWall: readonly string[]): PoolSentence | null {
  const fits = MODEL_SENTENCES.filter(p => !poolLeak(p, session)
    && p.words.every(w => item.wallLabels.includes(w.role) && posWall.includes(w.pos))
    && item.wallLabels.every(label => p.words.some(w => w.role === label)));
  return pick(fits, seedOf(item.id));
}

/** name-side: a subject that opens with a small word and a describing word, so the signature words sit inside it. */
export function splitModelFor(item: SentenceAnalyzerItem, session: SessionWords): PoolSentence | null {
  const fits = MODEL_SENTENCES.filter(p => !poolLeak(p, session) && p.subjectEnd !== null && p.subjectEnd >= 2
    && p.words[0].pos === 'Determiner' && p.words.slice(1, p.subjectEnd).some(w => w.pos === 'Adjective'));
  return pick(fits, seedOf(item.id));
}

/** One example per wall label, all labels at once; null when a label has no example clear of the session. */
export function wallExamplesFor(item: SentenceAnalyzerItem, session: SessionWords): Record<string, WallExample> | null {
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

export interface Practice { item: SentenceAnalyzerItem; words: string[] }

const practiceItem = (item: SentenceAnalyzerItem, p: PoolSentence, index: number, answer: string, readsAloud: boolean): Practice => {
  const spoken = isReadableAloud(p.sentence) ? speechSafe(p.sentence) : '';
  return { words: p.words.map(w => w.text), item: { ...item, id: `${item.id}~simpler`, answer, sentence: p.sentence,
    spokenSentence: spoken, sentenceIndex: -1, targetIndex: index, targetWord: index >= 0 ? p.words[index].text : '',
    readAloud: readsAloud && spoken ? `Listen. ${spoken} ` : '', introducesAction: false } };
};

/**
 * The practice item for `item`, or null. The target is drawn by seed over the practice sentence's on-wall words,
 * preferring words whose label belongs to a pair on the wall: the same draw whichever member the item's answer is.
 */
export function practiceFor(item: SentenceAnalyzerItem, session: SessionWords, opts: { readsAloud: boolean; subjectWords: number }): Practice | null {
  const seed = seedOf(item.id);
  const clear = (pool: PoolSentence[]) => pool.filter(p => !poolLeak(p, session));
  if (item.action === 'name-pos' || item.action === 'name-role') {
    const labelOf = (w: PoolSentence['words'][number]) => (item.action === 'name-pos' ? w.pos : w.role);
    const pairs = pairsOnWall(item.wallLabels).flat();
    for (let k = 0; k < 12; k++) {
      const p = pick(clear(item.action === 'name-pos' ? PRACTICE_POS : PRACTICE_ROLE), seed + k);
      if (!p) return null;
      const onWall = p.words.map((w, i) => ({ i, label: labelOf(w) })).filter(x => item.wallLabels.includes(x.label));
      const preferred = onWall.filter(x => pairs.includes(x.label));
      const target = pick(preferred.length ? preferred : onWall, seed);
      if (target) return practiceItem(item, p, target.i, target.label, opts.readsAloud);
    }
    return null;
  }
  if (item.action === 'name-side') {
    // Nothing to drop when the item's complete subject is already two words or fewer.
    if (opts.subjectWords <= 2) return null;
    const p = pick(clear(PRACTICE_SIDE), seed);
    if (!p || p.subjectEnd === null) return null;
    const i = seed % p.words.length;
    return practiceItem(item, p, i, i <= p.subjectEnd ? 'Subject' : 'Predicate', opts.readsAloud);
  }
  const p = pick(clear(PRACTICE_KIND), seed);
  return p ? practiceItem(item, p, -1, p.kind, opts.readsAloud) : null;
}

// ── the levers ───────────────────────────────────────────────────────────────

export interface LeverContext { items: readonly SentenceAnalyzerItem[]; posWall: readonly string[]; readsAloud: boolean; subjectWords: number }

const labelled = (p: PoolSentence, row: 'pos' | 'role' | 'both') => p.words.map(w => `${w.text.replace(/[.?!]$/, '')} (${
  row === 'pos' ? w.pos : row === 'role' ? w.role : `${w.pos}, ${w.role}`})`).join(' ');

/** What the pulled levers put on screen, for the tutor and the observer. Never this sentence's labels. */
export function leversOnScreen(pulled: readonly string[], item: SentenceAnalyzerItem, ctx: LeverContext): string | null {
  const session = sessionWords(ctx.items);
  const on = (id: string) => pulled.includes(id);
  const model = on(MODEL_LEVER) ? modelSentenceFor(item, session) : null;
  const two = on(TWO_ROW_LEVER) ? twoRowModelFor(item, session, ctx.posWall) : null;
  const split = on(SPLIT_LEVER) ? splitModelFor(item, session) : null;
  const parts = [
    model && `a model card with another sentence, every word labelled: ${labelled(model, 'pos')}`,
    two && `a model card with another sentence, each word with its part of speech over its job: ${labelled(two, 'both')}`,
    split && `a model card with another sentence, its subject "${split.words.slice(0, split.subjectEnd! + 1).map(w => w.text).join(' ')}" `
      + 'bracketed and labelled subject, the rest bracketed and labelled predicate',
    on(EXAMPLES_LEVER) && 'an example phrase under every label on the wall, its example word underlined',
  ].filter(Boolean);
  return parts.length ? `${parts.join('; ')}. Models are other sentences, not this one` : null;
}

const ANSWERS: Record<string, SpokenSentenceMiss[]> = {
  [MODEL_LEVER]: ['confusable_label', 'describing_word'],
  [TWO_ROW_LEVER]: ['part_of_speech', 'named_the_side'],
  [SPLIT_LEVER]: ['other_side'],
  [SHORT_SUBJECT_LEVER]: ['other_side'],
  [PLAIN_KIND_LEVER]: ['other_label'],
};

export function sentenceAnalyzerLevers(item: SentenceAnalyzerItem | null, ctx: LeverContext, pulled: readonly string[],
  starting: readonly string[] = []): WorkspaceLever[] {
  if (!item) return [];
  const session = sessionWords(ctx.items);
  const levers: WorkspaceLever[] = [];
  const add = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: readonly string[], when: string, does: string) => {
    if (!starting.includes(id)) levers.push({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  };
  const fence = 'Read only the card the receipt names; never make up a model of your own. The learner reads its labels: '
    + 'do not say a label aloud before the learner tries, never say which model '
    + 'word is like the asked word, and never label a word of this sentence.';
  if (item.action === 'name-pos' && modelSentenceFor(item, session)) add(MODEL_LEVER, 'help', 'both', ANSWERS[MODEL_LEVER],
    'The learner mixes up two labels, such as adjective and adverb, or says "describing word".',
    `Shows a card with a different sentence, every word labelled with its part of speech. Once it is on screen you may walk the card by what each word does (names a thing, tells which one, shows an action). ${fence}`);
  if (item.action === 'name-role' && twoRowModelFor(item, session, ctx.posWall)) add(TWO_ROW_LEVER, 'help', 'both', ANSWERS[TWO_ROW_LEVER],
    'The learner says a part of speech for a job, or says subject or predicate for a word inside them.',
    `Shows a card with a different sentence, each word with its part of speech over its job. Once it is on screen you may walk the card by what each word does. ${fence}`);
  if (item.action === 'name-side' && splitModelFor(item, session)) add(SPLIT_LEVER, 'help', 'both', ANSWERS[SPLIT_LEVER],
    'The learner puts a small word or a describing word on the wrong side.',
    `Shows a card with a different sentence, its complete subject bracketed and labelled subject, the rest predicate. ${fence}`);
  if (item.wallLabels.length && item.action !== 'name-side' && wallExamplesFor(item, session)) add(EXAMPLES_LEVER, 'help', 'shown',
    item.action === 'name-type' ? ['other_label'] : ['confusable_label', 'other_label'],
    'The learner says another label from the wall.',
    'Puts one example under every label on the wall, its example word underlined. It marks no label. Do not point to one '
    + 'or read a label aloud.');
  const practice = practiceFor(item, session, { readsAloud: ctx.readsAloud, subjectWords: ctx.subjectWords });
  if (practice) {
    const id = item.action === 'name-side' ? SHORT_SUBJECT_LEVER : item.action === 'name-type' ? PLAIN_KIND_LEVER : SHORT_SENTENCE_LEVER;
    add(id, 'simplify', 'both', ANSWERS[id] ?? (item.action === 'name-role'
      ? ['part_of_speech', 'confusable_label', 'other_label', 'named_the_side'] : ['confusable_label', 'other_label', 'describing_word']),
    'The learner still cannot name it after help.',
    `Opens an easier practice sentence first (${id === SHORT_SUBJECT_LEVER ? 'a two-word subject' : id === PLAIN_KIND_LEVER
      ? 'a short sentence in its plainest form' : 'three or four words'}), with one word or the whole sentence to name. Ask it. `
      + 'It is not graded; the full item comes back after it.');
  }
  return levers;
}

/** Phase 6: easy starts with the wall examples drawn (not offered, not recorded); other tiers with nothing. */
export const startingLevers = (tier: string | undefined): string[] => (tier === 'easy' ? [EXAMPLES_LEVER] : []);
