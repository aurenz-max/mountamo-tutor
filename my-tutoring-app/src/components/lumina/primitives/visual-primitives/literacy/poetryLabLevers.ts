/**
 * poetry-lab's in-item levers (/add-support-tiers; report qa/eval-reports/poetry-lab-levers-2026-10-09.md), declared
 * once as a lever set (`POETRY_LEVERS`, `bossLevers.ts`). No real-learner evidence: the misses are what `poetryMiss`
 * observes. Every key here is a fact about THIS poem (which two words rhyme, its mood, where its figures are, its
 * scheme), so no lever marks a card, a choice or a word of the poem: model levers show a solved example OUTSIDE the
 * item, the others put the same thing on every choice or count what is on screen, and easier levers open a different,
 * shorter practice item of the same kind, built in code.
 *
 * rhyme_hunt (`same_start`, `one_of_pair`, `neither_of_pair`):
 * - `rhyme_model` (model) two pictured words that rhyme and one that only starts the same, from a family no round uses.
 * - `fewer_cards` (easier) a three-line practice poem ("I see a ...") with three pictured cards, from free families.
 * analysis, mood (`other_mood`): `mood_faces` (meaning) a face on EVERY mood choice, offered only when every printed
 *   mood has one; `easier_mood` (easier) a two-line pool poem with two moods.
 * analysis, figurative (`literal_picked`, `missed_some`): `figure_models` (model) one example of each kind of figure,
 *   none sharing a word with the poem; `phrase_count` (clue) "N phrases to find", offered when the tier hides it;
 *   `easier_figures` (easier) a two-line pool poem with one figure.
 * analysis, rhyme (`aabb_abab`, `other_scheme`): `end_words` (layout) the last word of every line in a column,
 *   unmarked; `easier_scheme` (easier) a four-line pool poem with two scheme choices.
 * composition (every form miss): `model_poem` (model) a finished poem of the same form on another subject (copying
 *   one of its lines fails the check); `syllable_beats` (marks, counted forms) a dot per counted syllable under each
 *   word the learner typed; `first_letters` (marks, acrostic) the first letter of each typed line beside its letter;
 *   `one_line` (easier) one line of the same form on a pool subject.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { freeFamilies, pickModelRhymeSet, rimeOfWord, sessionWords, type PicturedWord, type RhymeModelSet } from './rhymeModels';
import type { PoetryLabData, RhymeHuntRound } from './PoetryLab';
import { poetryLabCard } from './poetryLab.card';
import {
  countSyllables, lineCount, showsFigurativeCount, type PoetryItem, type PoetryItemKind,
} from './poetryLabWorkspace';

export const RHYME_MODEL_LEVER = 'rhyme_model';
export const FEWER_CARDS_LEVER = 'fewer_cards';
export const MOOD_FACES_LEVER = 'mood_faces';
export const EASIER_MOOD_LEVER = 'easier_mood';
export const FIGURE_MODELS_LEVER = 'figure_models';
export const PHRASE_COUNT_LEVER = 'phrase_count';
export const EASIER_FIGURES_LEVER = 'easier_figures';
export const END_WORDS_LEVER = 'end_words';
export const EASIER_SCHEME_LEVER = 'easier_scheme';
export const MODEL_POEM_LEVER = 'model_poem';
export const SYLLABLE_BEATS_LEVER = 'syllable_beats';
export const FIRST_LETTERS_LEVER = 'first_letters';
export const ONE_LINE_LEVER = 'one_line';
export const PRACTICE_SUFFIX = '~simpler';
export const PRACTICE_NOTE = 'A shorter practice item, ungraded; the full item comes back after it.';

const norm = (s: string) => s.trim().toLowerCase();
const contentWords = (s: string) => (norm(s).match(/[a-z']{4,}/g) ?? []);
const seedOf = (s: string) => Array.from(s).reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 0);
export const practiceId = (id: string) => `${id}${PRACTICE_SUFFIX}`;
export const practiceSource = (id: string | null | undefined): string | null =>
  id?.endsWith(PRACTICE_SUFFIX) ? id.slice(0, -PRACTICE_SUFFIX.length) : null;

// ── rhyme_hunt ─────────────────────────────────────────────────────────────

const roundWords = (d: PoetryLabData) => sessionWords((d.rounds ?? []).flatMap(r => r.candidates.map(c => c.word)));

/** The model set no round uses (word or ending), or null: a model on a session family answers its rounds. */
export const rhymeModel = (d: PoetryLabData): RhymeModelSet | null => pickModelRhymeSet(roundWords(d));

/** A three-line practice round from two free families: a pair and one card that does not rhyme with it. */
export function practiceRound(round: RhymeHuntRound, d: PoetryLabData): RhymeHuntRound | null {
  const free = freeFamilies(roundWords(d));
  if (free.length < 2) return null;
  const start = seedOf(round.id + (d.title ?? ''));
  const fam = free[start % free.length], other = free[(start + 1) % free.length];
  if (fam.words.length < 2 || fam.rime === other.rime) return null;
  const [a, b] = fam.words, foil = other.words[0];
  const cards: PicturedWord[] = [a, foil, b];
  return { id: practiceId(round.id), type: 'rhyme_hunt',
    poemLines: cards.map(c => `I see a ${c.word}.`) as unknown as RhymeHuntRound['poemLines'],
    candidates: cards as unknown as RhymeHuntRound['candidates'], rhymeWordA: a.word, rhymeWordB: b.word };
}

// ── analysis ───────────────────────────────────────────────────────────────

/** A face for a mood word. A mood with none means the lever is not offered: a face on some choices marks them. */
export const MOOD_FACES: Record<string, string> = {
  happy: '😊', joyful: '😄', cheerful: '😁', excited: '🤩', playful: '😜', silly: '🤪', proud: '😌', hopeful: '🌅',
  peaceful: '😌', calm: '😌', relaxed: '😌', cozy: '☕', dreamy: '💭', sleepy: '😴', tired: '😴', thoughtful: '🤔',
  curious: '🤔', mysterious: '🕵️', sad: '😢', lonely: '😔', gloomy: '🌧️', worried: '😟', nervous: '😬', scary: '😨',
  scared: '😨', spooky: '👻', angry: '😠', grumpy: '😤', bored: '😐', surprised: '😮', amazed: '🤩', loving: '🥰',
  grateful: '🙏', brave: '🦁', wild: '🌪️', energetic: '⚡', serious: '😐', nostalgic: '📷', wonder: '✨', hopeless: '😞',
};
export const moodFace = (mood: string) => MOOD_FACES[norm(mood)];
/** Leak rule: offered only when every printed mood has a face. */
export const moodFacesLeak = (d: PoetryLabData) => !(d.moodOptions ?? []).every(m => !!moodFace(m));

/** One example per kind of figure, two each so one that shares a word with the poem can be skipped. */
const FIGURE_MODELS: Array<{ kind: string; examples: [string, string] }> = [
  { kind: 'simile', examples: ['as quiet as a mouse', 'swims like a fish'] },
  { kind: 'metaphor', examples: ['the snow is a white blanket', 'my brother is a busy bee'] },
  { kind: 'personification', examples: ['the wind whispered', 'the old car groaned'] },
  { kind: 'hyperbole', examples: ['I could eat a horse', 'a backpack that weighs a ton'] },
  { kind: 'alliteration', examples: ['six slippery snakes', 'big brown bears'] },
  { kind: 'onomatopoeia', examples: ['the bees buzz', 'the door went creak'] },
];
const poemWordsOf = (d: PoetryLabData) => new Set(contentWords((d.poemLines ?? []).join(' ')));
/** Leak rule: a model never shares a word of four letters or more with the poem. */
export const figureModelLeaks = (d: PoetryLabData, example: string) => contentWords(example).some(w => poemWordsOf(d).has(w));
export function figureModels(d: PoetryLabData): Array<{ kind: string; example: string }> {
  return FIGURE_MODELS.flatMap(m => {
    const ex = m.examples.find(e => !figureModelLeaks(d, e));
    return ex ? [{ kind: m.kind, example: ex }] : [];
  });
}

/** The last word of every line, in line order. The same on every poem; no line is marked. */
export const endWords = (d: PoetryLabData) => (d.poemLines ?? []).map(l => (l.trim().split(/\s+/).at(-1) ?? '').replace(/[^a-z']/gi, ''));

interface PoolPoem { lines: string[]; mood?: [string, string]; figures?: Array<{ text: string; type: string }>; scheme?: [string, string] }
const MOOD_POOL: PoolPoem[] = [
  { lines: ['The puppy jumps and spins around,', 'It barks a bouncy, giggly sound.'], mood: ['happy', 'sad'] },
  { lines: ['The old house creaks when night comes near,', 'A shadow moves, I shake with fear.'], mood: ['scary', 'silly'] },
  { lines: ['My best friend moved so far away,', 'There is no one to come and play.'], mood: ['lonely', 'excited'] },
];
const FIGURE_POOL: PoolPoem[] = [
  { lines: ['My cat is as soft as a cloud,', 'She naps on my bed all day.'], figures: [{ text: 'as soft as a cloud', type: 'simile' }] },
  { lines: ['The sun smiled on the garden,', 'And the flowers grew tall.'], figures: [{ text: 'sun smiled', type: 'personification' }] },
  { lines: ['Our kitchen is a busy zoo,', 'With pots and pans and noise.'], figures: [{ text: 'kitchen is a busy zoo', type: 'metaphor' }] },
];
const SCHEME_POOL: PoolPoem[] = [
  { lines: ['I like to swing up high,', 'Up into the sky.', 'I kick my feet with glee,', 'Above the apple tree.'], scheme: ['AABB', 'ABAB'] },
  { lines: ['The duck went for a swim,', 'Beside the shady bank,', 'It waved a wing at Jim,', 'And then it slowly sank.'], scheme: ['ABAB', 'AABB'] },
  { lines: ['My dog can catch a ball,', 'He jumps against the wall,', 'He naps upon the mat,', 'And dreams about a cat.'], scheme: ['AABB', 'ABAB'] },
];

/** Leak rule for every practice poem: not the session's poem, and no line of it. */
export function practiceLeaks(p: PoetryLabData, d: PoetryLabData): boolean {
  const theirs = new Set((d.poemLines ?? []).map(norm));
  return (p.poemLines ?? []).some(l => theirs.has(norm(l)));
}

function analysisPractice(kind: 'mood' | 'figurative' | 'rhyme', d: PoetryLabData): PoetryLabData | null {
  const pool = kind === 'mood' ? MOOD_POOL : kind === 'figurative' ? FIGURE_POOL : SCHEME_POOL;
  const start = seedOf(`${d.title}|${(d.poemLines ?? []).join('|')}`);
  for (let k = 0; k < pool.length; k++) {
    const s = pool[(start + k) % pool.length];
    const poem = s.lines.join('\n');
    const p: PoetryLabData = { title: 'Practice poem', gradeLevel: d.gradeLevel, mode: 'analysis', supportTier: d.supportTier,
      poemLines: s.lines, poem,
      ...(s.mood ? { correctMood: s.mood[0], moodOptions: [...s.mood] } : {}),
      ...(s.figures ? { figurativeInstances: s.figures.map(f => {
        const at = poem.toLowerCase().indexOf(f.text.toLowerCase());
        return { text: f.text, type: f.type, startIndex: at, endIndex: at + f.text.length };
      }) } : {}),
      ...(s.scheme ? { rhymeScheme: s.scheme[0], rhymeSchemeOptions: [...s.scheme] } : {}) };
    if (!practiceLeaks(p, d)) return p;
  }
  return null;
}

// ── composition ────────────────────────────────────────────────────────────

const MODEL_POEMS: Record<string, Array<{ subject: string; lines: string[] }>> = {
  haiku: [
    { subject: 'a cat', lines: ['A sleepy gray cat', 'curls up in a patch of sun', 'and purrs a soft song'] },
    { subject: 'snow', lines: ['White flakes drifting down', 'cover the quiet backyard', 'my boots leave deep tracks'] },
  ],
  limerick: [
    { subject: 'a frog', lines: ['A frog with a very loud croak', 'would sing every night by the oak', 'the owls said, "Please stop,"',
      'so he gave one big hop', 'and croaked from a log as a joke'] },
    { subject: 'a cook', lines: ['There once was a cook named Lou', 'who made a big pot of stew', 'she added some cheese',
      'and a handful of peas', 'and then she ate some of it too'] },
  ],
  acrostic: [
    { subject: 'a cat', lines: ['Curled up on the rug', 'Always ready for a nap', 'Tail swishing slowly'] },
    { subject: 'the sun', lines: ['Shining over the hills', 'Up early every morning', 'Never forgets to rise'] },
  ],
  'sonnet-intro': [
    { subject: 'the sea', lines: ['The waves roll in beneath the morning light,', 'They crash and foam upon the sandy shore,',
      'The gulls above them circle out of sight,', 'And still the sea keeps singing as before.'] },
    { subject: 'a garden', lines: ['The garden wakes when spring comes back again,', 'The tulips stretch their petals to the sky,',
      'The robins sing a song about the rain,', 'And bees go humming as the clouds drift by.'] },
  ],
  'free-verse': [
    { subject: 'a kite', lines: ['My kite climbs higher', 'than the tallest tree', 'pulling my hand', 'like a puppy on a leash'] },
    { subject: 'a train', lines: ['The train rumbles past', 'windows full of faces', 'a long silver snake', 'racing the afternoon'] },
  ],
};

const promptWords = (d: PoetryLabData) => new Set(contentWords(d.compositionPrompt ?? ''));
/** Leak rule: the model is never on the learner's subject (it shares no word of four letters or more with the prompt). */
export const modelPoemLeaks = (d: PoetryLabData, m: { subject: string; lines: string[] }) =>
  contentWords(`${m.subject} ${m.lines.join(' ')}`).some(w => promptWords(d).has(w));

/** A finished poem of the session's form on another subject, or null. */
export function modelPoem(d: PoetryLabData): { subject: string; lines: string[] } | null {
  const pool = MODEL_POEMS[d.templateType ?? 'free-verse'] ?? MODEL_POEMS['free-verse'];
  const word = d.templateConstraints?.acrosticWord;
  return pool.find(m => !modelPoemLeaks(d, m)
    && (!word || m.lines.map(l => l[0].toUpperCase()).join('') !== word.toUpperCase())) ?? null;
}

const PRACTICE_SUBJECTS = ['a puppy', 'the moon', 'a rainbow', 'a bicycle', 'the ocean', 'a pumpkin'];
/** One line of the same form on a pool subject: the first line's syllable target, or one acrostic letter. */
export function oneLinePractice(d: PoetryLabData): PoetryLabData | null {
  const tc = d.templateConstraints;
  const start = seedOf(d.compositionPrompt ?? '');
  const subject = PRACTICE_SUBJECTS.map((_, k) => PRACTICE_SUBJECTS[(start + k) % PRACTICE_SUBJECTS.length])
    .find(s => !contentWords(s).some(w => promptWords(d).has(w)));
  if (!subject) return null;
  const letter = tc?.acrosticWord ? (contentWords(subject)[0] ?? subject).charAt(0).toUpperCase() : undefined;
  return { title: 'Practice line', gradeLevel: d.gradeLevel, mode: 'composition', supportTier: d.supportTier,
    templateType: d.templateType,
    compositionPrompt: `Practice: write one line about ${subject}${letter ? `, starting with ${letter}` : ''}.`,
    templateConstraints: { lineCount: 1, ...(tc?.syllablesPerLine ? { syllablesPerLine: [tc.syllablesPerLine[0]] } : {}),
      ...(letter ? { acrosticWord: letter } : {}) } };
}

/** Each word the learner typed with a dot per counted syllable ("rainbow ●●"). Their own words only. */
export const syllableBeats = (line: string) => line.trim().split(/\s+/).filter(Boolean)
  .map(w => `${w} ${'●'.repeat(countSyllables(w))}`).join('  ');

// ── practice ───────────────────────────────────────────────────────────────

/** The practice item a simplify lever opens on a session item: the same kind, shorter, drawn from its own lesson. */
export function practiceFor(item: PoetryItem, d: PoetryLabData): PoetryItem | null {
  if (item.practice) return null;
  if (item.kind === 'rhyme_hunt') {
    const round = item.round && practiceRound(item.round, d);
    return round ? { id: round.id, kind: 'rhyme_hunt', round, practice: { ...d, rounds: [round] } } : null;
  }
  const p = item.kind === 'compose' ? oneLinePractice(d) : analysisPractice(item.kind, d);
  return p ? { id: practiceId(item.id), kind: item.kind, ...(item.tier ? { tier: item.tier } : {}),
    ...(p.compositionPrompt ? { prompt: p.compositionPrompt } : {}), practice: p } : null;
}

// ── the lever set ──────────────────────────────────────────────────────────

/** What the levers read: the session's lesson, and the learner's typed lines (the composition marks show them). */
export interface PoetryCtx { data: PoetryLabData; lines?: readonly string[] }

const MODE_OF: Record<PoetryItemKind, string> = {
  rhyme_hunt: 'rhyme_hunt', mood: 'analysis', figurative: 'analysis', rhyme: 'analysis', compose: 'composition',
};
const at = (...kinds: PoetryItemKind[]) => (item: PoetryItem) => kinds.includes(item.kind);
const BACK = 'It is not graded; this item comes back after it, blank.';
/** The model lever's words for the support fact, by step. */
const MODEL_WORDS: Partial<Record<PoetryItemKind, { different: string; own: string }>> = {
  rhyme_hunt: { different: 'a rhyming pair from no round', own: 'which two cards rhyme' },
  figurative: { different: 'figures from no poem in this lesson', own: 'which words of this poem are figurative' },
  compose: { different: 'a finished poem of this form on another subject', own: "a line or a word of the learner's poem" },
};
const lineList = (ctx: PoetryCtx, show: (line: string) => string) => Array.from({ length: lineCount(ctx.data) },
  (_, i) => `line ${i + 1}: ${show(ctx.lines?.[i] ?? '')}`);

/**
 * The levers, declared once (`bossLevers.ts`); none on a practice item (the component declares nothing while one is
 * on screen). Each is offered on its own step only.
 */
export const POETRY_LEVERS = leverSet<PoetryItem, PoetryCtx>({
  modeOf: item => MODE_OF[item.kind],
  missesOf: mode => poetryLabCard.modes[mode]?.misses ?? [],
  // What a worded lever must never name: the item's key.
  answersOf: (item, { data }) => (item.kind === 'rhyme_hunt' && item.round ? [item.round.rhymeWordA, item.round.rhymeWordB]
    : item.kind === 'mood' ? [data.correctMood ?? ''] : item.kind === 'rhyme' ? [data.rhymeScheme ?? '']
    : item.kind === 'figurative' ? (data.figurativeInstances ?? []).map(f => f.text) : []).filter(Boolean),
  // rhyme_hunt items carry no tier (the K-1 band contract), so its model comes after a miss.
  support: { tier: item => item.tier ?? 'medium', different: item => MODEL_WORDS[item.kind]?.different ?? 'a model',
    own: item => MODEL_WORDS[item.kind]?.own ?? "this item's answer" },
  specs: [
    { id: RHYME_MODEL_LEVER, type: 'model', modes: ['rhyme_hunt'], answers: 'all',
      when: 'The learner taps two cards that do not rhyme, often two that start the same.',
      does: 'Shows a model above the poem with pictures: two words that rhyme and one that only starts the same, none from this '
        + 'poem. Say the model words aloud and stretch their endings; it marks no card.',
      content: (_item, { data }) => rhymeModel(data),
      fact: (m: RhymeModelSet) => `A model with pictures, from no round: ${m.words[0].word} and ${m.words[1].word} rhyme (same ending `
        + `sound); ${m.words[0].word} and ${m.onsetFoil.word} start the same but do not rhyme.` },
    { id: FEWER_CARDS_LEVER, type: 'easier', modes: ['rhyme_hunt'], answers: 'all', carrier: 'shown',
      when: 'The learner still cannot find the pair among four cards.',
      does: `Opens a practice poem of three short lines ("I see a ...") with three pictured cards, two of which rhyme. ${BACK}`,
      content: (item, { data }) => practiceFor(item, data) },
    { id: MOOD_FACES_LEVER, type: 'meaning', modes: ['analysis'], answers: ['other_mood'], carrier: 'shown',
      when: "The learner picks a mood the poem's words do not support, or cannot tell the mood words apart.",
      does: 'Puts a face on every mood choice, so each feeling word has a picture. Every choice gets one; none is marked.',
      offer: (item, { data }) => item.kind === 'mood' && !moodFacesLeak(data),
      fact: 'Every mood choice shows a face for its feeling word.' },
    { id: EASIER_MOOD_LEVER, type: 'easier', modes: ['analysis'], answers: ['other_mood'], carrier: 'shown',
      when: 'The learner cannot find the mood in a poem this long yet.',
      does: `Opens a two-line practice poem with two mood choices. ${BACK}`,
      offer: at('mood'), content: (item, { data }) => practiceFor(item, data) },
    { id: FIGURE_MODELS_LEVER, type: 'model', modes: ['analysis'], answers: ['literal_picked', 'missed_some'], carrier: 'shown',
      when: 'The learner taps words that mean just what they say, or misses figures, as if unsure what figurative language is.',
      does: 'Shows one short example of each kind of figure (a simile, a metaphor, personification and others), none from this '
        + 'poem. It marks no word of the poem.',
      offer: at('figurative'),
      content: (_item, { data }) => (figureModels(data).length >= 3 ? figureModels(data) : null),
      fact: (models: Array<{ kind: string; example: string }>) =>
        `Examples of figures, none from the poem: ${models.map(m => `${m.kind}: "${m.example}"`).join('; ')}.` },
    { id: PHRASE_COUNT_LEVER, type: 'clue', modes: ['analysis'], answers: ['missed_some'], carrier: 'shown',
      when: 'The learner stops before finding every figure.',
      does: 'Shows how many figurative phrases the poem has. It says how many, never where.',
      offer: item => item.kind === 'figurative' && !showsFigurativeCount(item.tier),
      content: (_item, { data }) => data.figurativeInstances?.length ?? 0,
      fact: (n: number) => `The screen says the poem has ${n} figurative phrases.` },
    { id: EASIER_FIGURES_LEVER, type: 'easier', modes: ['analysis'], answers: ['literal_picked', 'missed_some'], carrier: 'shown',
      when: 'The learner cannot find figures in a poem this long yet.',
      does: `Opens a two-line practice poem with one figure in it. ${BACK}`,
      offer: at('figurative'), content: (item, { data }) => practiceFor(item, data) },
    { id: END_WORDS_LEVER, type: 'layout', modes: ['analysis'], answers: ['aabb_abab', 'other_scheme'],
      when: 'The learner picks a scheme that does not fit the line endings, as if not comparing the last words.',
      does: 'Lists the last word of every line in a column beside the poem, in line order, with no letters or colors. It does not '
        + 'mark which ones rhyme.',
      offer: at('rhyme'),
      fact: (_c, _item, { data }) => `The last word of each line is listed, unmarked: ${endWords(data).join(', ')}.` },
    { id: EASIER_SCHEME_LEVER, type: 'easier', modes: ['analysis'], answers: ['aabb_abab', 'other_scheme'], carrier: 'shown',
      when: 'The learner cannot work out the scheme of this poem yet.',
      does: `Opens a four-line practice poem with two scheme choices. ${BACK}`,
      offer: at('rhyme'), content: (item, { data }) => practiceFor(item, data) },
    { id: MODEL_POEM_LEVER, type: 'model', modes: ['composition'], answers: 'all', carrier: 'shown',
      when: 'The learner does not know what a finished poem of this form looks like.',
      does: 'Shows a finished poem of the same form on another subject. Copying one of its lines does not pass the check.',
      content: (_item, { data }) => modelPoem(data),
      fact: (m: { subject: string; lines: string[] }) => `A model poem of this form about ${m.subject}: ${m.lines.join(' / ')}.` },
    { id: SYLLABLE_BEATS_LEVER, type: 'marks', modes: ['composition'], answers: ['syllables_off'],
      when: 'A line has too many or too few syllables.',
      does: 'Under each line, puts a dot for every syllable the counter hears in each word the learner typed. Their own words only.',
      offer: (_item, { data }) => !!data.templateConstraints?.syllablesPerLine,
      fact: (_c, _item, ctx) => `Syllable dots under each typed word: ${lineList(ctx, l => syllableBeats(l) || '(empty)').join('; ')}.` },
    { id: FIRST_LETTERS_LEVER, type: 'marks', modes: ['composition'], answers: ['wrong_first_letter'],
      when: 'A line does not start with its letter.',
      does: 'Beside each line, shows the letter that line starts with now, next to the letter it should start with.',
      offer: (_item, { data }) => !!data.templateConstraints?.acrosticWord,
      fact: (_c, _item, ctx) => `Each line's first letter now: ${lineList(ctx, l => l.trim().charAt(0).toUpperCase() || '(empty)').join(', ')}.` },
    { id: ONE_LINE_LEVER, type: 'easier', modes: ['composition'], answers: 'all', carrier: 'shown',
      when: 'The learner cannot write a whole poem in this form yet.',
      does: `Opens a practice: one line of the same form about something else. ${BACK}`,
      content: (item, { data }) => practiceFor(item, data) },
  ],
});

/** The rime check, so a practice round's pair truly rhymes and its foil does not. */
export const rhymes = (a: string, b: string) => norm(a) !== norm(b) && rimeOfWord(a) === rimeOfWord(b);
