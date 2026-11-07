/**
 * Code checks for a wonder walk. The author writes stops through tools; every write comes back with these checks, and
 * the walk ships only when none blocks. They hold the pre-reader contract and the answer-leak rules in code:
 * pictures only from the reviewed library, 2-3 equal choices, short spoken sentences in words a Kindergartner knows,
 * and the right picture never named in the narration, the ask, the why-card or the scene.
 *
 * Math stops are worlds the author describes (`world.ts`): places, what is in them, a story, and an answer. Code
 * derives the key, names the eval mode from the structure, solves the stop for shortcuts and scores its difficulty;
 * every write returns that difficulty and mode, so the author can aim a stop at the walk's tier and its modes.
 */
import type { WonderWalkOption, WonderWalkStop, WonderWalkStopType, WonderWalkTrap } from '../../../primitives/visual-primitives/core/wonder-walk/WonderWalk';
import { baseForm, hardWords, pictureOf, picturedNear } from './pictures';
import { STANDARDS, buildWorld, worldChecks, worldDifficulty, worldKey, worldWalkChecks, type Difficulty, type SupportTier, type WorldDraft, type WorldKey } from './world';
import { WORD_MODES, WORD_STANDARDS, buildWordWorld, fillSounds, sayAnyExamples, wordChecks, wordDifficulty, wordModeOf, wordWalkChecks, readWords, type WordDraft } from './words';
import { SAY_ANY_RULES, respondError, respondOf, stopSpokenKey } from '../../../primitives/visual-primitives/core/wonder-walk/wonderWalkSpoken';
import { spokenKeyText } from '../../../components/live-activity/spokenKey';
import { tapKey } from '../../../primitives/visual-primitives/core/wonder-walk/wonderWalkWords';

export type { SupportTier } from './world';

export interface StopDraft {
  /** The stop type (eval mode); which-one when absent. */
  kind?: WonderWalkStopType;
  ideaIndex: number;
  narration: string;
  sceneWords: string[];
  imagePrompt: string;
  ask: string;
  /** which-one: the right picture and the wrong ones. */
  correctWord: string;
  wrongWords: Array<{ word: string; trap: string }>;
  why: string;
  /** Math stops: the world the author described. */
  world?: WorldDraft;
  /** Language stops: the word world the author described (the ask may hold [sound] tokens code fills). */
  words?: WordDraft;
  /** What the child produces (`wonderWalkSpoken.ts`): show, say, say-any. Absent: say when the answer can be said. */
  respond?: 'show' | 'say' | 'say-any';
}

export interface Checks { blocking: string[]; advisory: string[] }
export interface StopChecks extends Checks { difficulty?: Difficulty; key?: WorldKey | string | Record<string, string | null> | string[]; mode?: WonderWalkStopType; ask?: string;
  /** How the child answers and, when spoken, the key the tutor will judge with (for the author; never shown to the child). */
  answeredBy?: string }

/** What the walk's math may use: the lesson's count range, the requested tier and the open eval modes. */
export interface MathScope { max: number; tier?: SupportTier; openModes: WonderWalkStopType[] }
/** What the walk's language stops may use: the requested tier and the open eval modes. */
export interface WordScope { tier?: SupportTier; openModes: WonderWalkStopType[] }
const WORD_KINDS = new Set<WonderWalkStopType>(WORD_MODES);
export const isWordKind = (k?: WonderWalkStopType) => !!k && WORD_KINDS.has(k);

const kindOf = (d: StopDraft): WonderWalkStopType => d.kind ?? 'which-one';
const TRAPS = new Set<WonderWalkTrap>(['looks_like', 'goes_with', 'other']);
const sentences = (s: string) => s.split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(Boolean);
const wordCount = (s: string) => (s.match(/[A-Za-z']+/g) ?? []).length;

/** A word, or its plural, appears in a text. */
export function names(text: string, word: string): boolean {
  const w = baseForm(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${w}(e?s)?\\b`, 'i').test(text) || new RegExp(`\\b${w.replace(/y$/, 'ies')}\\b`, 'i').test(text);
}

const MAX_SENTENCE = 12;

// ── Stop checks ──────────────────────────────────────────────────────

function spokenChecks(d: StopDraft, ideaCount: number, blocking: string[], advisory: string[]) {
  if (!(d.ideaIndex >= 0 && d.ideaIndex < ideaCount)) blocking.push(`ideaIndex ${d.ideaIndex} is not one of the planned ideas (0-${ideaCount - 1})`);
  for (const [field, text, maxSentences] of [['narration', d.narration, 3], ['ask', d.ask, 1], ['why', d.why, 2]] as const) {
    if (!text.trim()) { blocking.push(`${field} is empty`); continue; }
    const ss = sentences(text);
    if (ss.length > maxSentences) blocking.push(`${field} has ${ss.length} sentences; at most ${maxSentences}`);
    const long = ss.filter(s => wordCount(s) > MAX_SENTENCE);
    if (long.length) blocking.push(`${field}: a sentence over ${MAX_SENTENCE} words ("${long[0]}")`);
  }
  if (d.ask.trim() && !/\?\s*$/.test(d.ask.trim())) blocking.push('ask must be one question ending in "?"');
  // Words a Kindergartner knows.
  const hard = Array.from(new Set([d.narration, d.ask, d.why].flatMap(hardWords)));
  if (hard.length >= 3) blocking.push(`words a Kindergartner may not know: ${hard.join(', ')}; use everyday words`);
  else if (hard.length) advisory.push(`check these words are known at K: ${hard.join(', ')}`);
}

function whichOneChecks(d: StopDraft, blocking: string[], advisory: string[]) {
  // Pictures: every word must be one the library can picture, all different.
  const right = pictureOf(d.correctWord);
  if (!right) blocking.push(`no picture for "${d.correctWord}"; pick a word from the picture list (near: ${picturedNear(d.correctWord).join(', ')})`);
  if (d.wrongWords.length < 1 || d.wrongWords.length > 2) blocking.push(`give 1-2 wrong pictures, not ${d.wrongWords.length}`);
  const wrong = d.wrongWords.map(x => ({ pic: pictureOf(x.word), raw: x }));
  for (const { pic, raw } of wrong) {
    if (!pic) blocking.push(`no picture for "${raw.word}"; pick a word from the picture list (near: ${picturedNear(raw.word).join(', ')})`);
    if (!TRAPS.has(raw.trap as WonderWalkTrap)) blocking.push(`trap for "${raw.word}" must be looks_like, goes_with or other`);
  }
  const pics = [right, ...wrong.map(x => x.pic)].filter((p): p is { word: string; emoji: string } => !!p);
  if (new Set(pics.map(p => p.word)).size < pics.length) blocking.push('two pictures are the same word');
  else if (new Set(pics.map(p => p.emoji)).size < pics.length) blocking.push(`two pictures share one emoji (${pics.map(p => `${p.word} ${p.emoji}`).join(', ')}); pick words that look different`);

  // Leaks: the right picture is never said, shown in the scene, or drawn in the scene image.
  if (right) {
    for (const [field, text] of [['narration', d.narration], ['ask', d.ask], ['why', d.why], ['imagePrompt', d.imagePrompt]] as const)
      if (names(text, right.word)) blocking.push(`${field} names the right picture "${right.word}": the child must use the idea on a new thing, so say the idea with a different example`);
    if (d.sceneWords.some(w => baseForm(w) === right.word)) blocking.push(`the scene shows the right picture "${right.word}"; show a different example of the idea`);
  }

  // The scene's fallback picture.
  if (d.sceneWords.length < 1 || d.sceneWords.length > 3) blocking.push(`sceneWords: 1-3 library word(s), not ${d.sceneWords.length}`);
  for (const w of d.sceneWords) if (!pictureOf(w)) blocking.push(`no picture for sceneWords word "${w}" (near: ${picturedNear(w).join(', ')})`);
  if (!d.imagePrompt.trim()) advisory.push('imagePrompt is empty: the scene will show only its emoji');
}

/**
 * The author's answer channel against the stop as built: does `respond` fit what the answer is, and what will the tutor
 * judge? Runs on a trial build of the one stop, so the rule is the same one the boss validates with.
 */
function withRespond(d: StopDraft, c: StopChecks): StopChecks {
  if (c.blocking.length) return c;
  let stop: WonderWalkStop;
  try { stop = buildStops([d], Array.from({ length: d.ideaIndex + 1 }, () => ''), 1, [])[0]; } catch { return c; }
  const error = respondError(stop);
  if (error) return { ...c, blocking: [...c.blocking, `respond: ${error}`] };
  const key = stopSpokenKey(stop);
  const respond = respondOf(stop);
  const answeredBy = key ? `${respond}: the tutor judges the spoken answer against ${spokenKeyText(key)} A tap is checked by the activity.`
    : 'show: the activity checks it on screen.';
  return { ...c, answeredBy };
}

export function stopChecks(d: StopDraft, ideaCount: number, math?: MathScope, words?: WordScope): StopChecks {
  return withRespond(d, baseStopChecks(d, ideaCount, math, words));
}

function baseStopChecks(d: StopDraft, ideaCount: number, math?: MathScope, words?: WordScope): StopChecks {
  const blocking: string[] = [];
  const advisory: string[] = [];
  spokenChecks(d, ideaCount, blocking, advisory);
  const kind = kindOf(d);
  if (kind === 'which-one') { whichOneChecks(d, blocking, advisory); return { blocking, advisory }; }
  if (d.words || isWordKind(kind)) {
    if (!words || !d.words) { blocking.push('language stops are not open in this walk'); return { blocking, advisory }; }
    const m = wordChecks(d.words, { ask: d.ask, why: d.why, narration: d.narration, openModes: words.openModes });
    return { blocking: [...blocking, ...m.blocking], advisory: [...advisory, ...m.advisory], difficulty: wordDifficulty(d.words),
      ...(m.key !== undefined ? { key: m.key } : {}), ...(m.mode ? { mode: m.mode } : {}), ...(m.ask ? { ask: m.ask } : {}) };
  }
  if (!math || !d.world) { blocking.push('math stops are not open in this walk'); return { blocking, advisory }; }
  const m = worldChecks(d.world, { max: math.max, ask: d.ask, why: d.why, narration: d.narration, openModes: math.openModes });
  return { blocking: [...blocking, ...m.blocking], advisory: [...advisory, ...m.advisory], difficulty: worldDifficulty(d.world),
    ...(m.key ? { key: m.key } : {}), ...(m.mode ? { mode: m.mode } : {}) };
}

export function walkChecks(input: { planned: boolean; ideas: string[]; stops: StopDraft[]; math?: MathScope; words?: WordScope }, minStops = 3): Checks {
  const blocking: string[] = [];
  const advisory: string[] = [];
  if (!input.planned) blocking.push('call plan_walk first');
  if (input.stops.length < minStops || input.stops.length > 5) blocking.push(`a walk has ${minStops}-5 stops; this one has ${input.stops.length}`);
  const untaught = input.ideas.map((idea, i) => ({ idea, i })).filter(({ i }) => !input.stops.some(s => s.ideaIndex === i));
  for (const { idea, i } of untaught) blocking.push(`idea ${i} ("${idea}") has no stop`);
  const keys = input.stops.filter(s => kindOf(s) === 'which-one').map(s => baseForm(s.correctWord));
  // A language stop's answer picture counts too: the same word is not the answer twice in one walk.
  for (const s of input.stops) if (s.words) { const w = readWords(s.words).world; const k = tapKey(w); const word = k ? w.things.find(t => t.id === k)?.word : undefined; if (word) keys.push(word); }
  const dup = keys.find((k, i) => keys.indexOf(k) !== i);
  if (dup) blocking.push(`"${dup}" is the right picture at two stops; every stop needs its own`);
  const worlds = input.stops.filter(s => kindOf(s) !== 'which-one' && s.world).map(s => s.world!);
  if (input.math && worlds.length) worldWalkChecks(worlds, { tier: input.math.tier, openModes: input.math.openModes }).forEach(x => blocking.push(x));
  const wordDrafts = input.stops.filter(s => s.words).map(s => s.words!);
  if (input.words && wordDrafts.length) wordWalkChecks(wordDrafts, { tier: input.words.tier, openModes: input.words.openModes }).forEach(x => blocking.push(x));
  // Producing a word is the stronger half of RF.K.2a and RF.K.2d (make a rhyme, name a word that starts with a sound):
  // a walk of 3+ language stops whose rules allow it has the child make a word at least once.
  const anyable = input.stops.filter(s => s.words?.answer.kind === 'tap' && s.words.answer.rule && SAY_ANY_RULES.has(s.words.answer.rule.type as never)
    && !(['sound', 'same-sound'].includes(s.words.answer.rule.type) && s.words.answer.rule.at === 'middle'));
  if (input.stops.filter(s => s.words).length >= 3 && anyable.length && !input.stops.some(s => s.respond === 'say-any'))
    blocking.push(`no stop asks the child to make a word: make one ${Array.from(new Set(anyable.map(s => s.words!.answer.rule!.type))).join(' or ')} stop respond say-any, with an ask that invites the child's own word ("Can you think of a word that rhymes with cat?")`);
  input.stops.forEach((s, i) => {
    const c = stopChecks(s, input.ideas.length, input.math, input.words);
    c.blocking.forEach(x => blocking.push(`stop ${i}: ${x}`));
    c.advisory.forEach(x => advisory.push(`stop ${i}: ${x}`));
  });
  return { blocking, advisory };
}

/** A tiny seeded RNG (mulberry32), so one seed gives one option order. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One math stop as the child meets it: the world laid out by code, the key derived from it, the mode named from it. */
function worldStop(d: StopDraft, i: number, rand: () => number) {
  const w = d.world!;
  const key = worldKey(w);
  if ('error' in key) throw new Error(`stop ${i}: ${key.error}`);
  const world = buildWorld(w, key, rand, i);
  const diff = worldDifficulty(w);
  const mode = d.kind && d.kind !== 'which-one' ? d.kind : 'how-many';
  return {
    challengeType: mode,
    world,
    standards: STANDARDS[mode],
    difficulty: { band: diff.band, score: diff.score, reasons: diff.reasons },
    sceneWords: Array.from(new Set(world.objects.map(o => o.word))),
    sceneEmoji: Array.from(new Set(world.objects.map(o => o.emoji))),
    options: [] as WonderWalkOption[],
    correctOptionId: 'place' in key ? `place-${key.place}` : 'number' in key ? `num-${key.number}` : '',
  };
}

/**
 * The stops as the child meets them. Code owns option order: shuffled per stop, then nudged so the right picture
 * is not in the same place at every stop. Math stops are laid out from their blocks and get no scene image.
 */
export function buildStops(drafts: StopDraft[], ideas: string[], seed: number, images: Array<string | null>): WonderWalkStop[] {
  const rand = rng(seed);
  const stops = drafts.map((d, i): WonderWalkStop => {
    const base = { id: `stop-${i + 1}`, idea: ideas[d.ideaIndex], narration: d.narration.trim(), ask: d.ask.trim(), why: d.why.trim(),
      ...(d.respond ? { respond: d.respond } : {}) };
    if (d.words) {
      const words = buildWordWorld(d.words, d.ask, rand);
      const key = tapKey(words);
      const mode = wordModeOf(words);
      const diff = wordDifficulty(d.words);
      return { ...base, ask: fillSounds(base.ask, words).text, narration: fillSounds(base.narration, words, false).text, why: fillSounds(base.why, words, false).text,
        challengeType: mode, words, standards: WORD_STANDARDS[mode], difficulty: { band: diff.band, score: diff.score, reasons: diff.reasons },
        sceneWords: words.refs.map(r => r.word ?? r.letter ?? '').filter(Boolean), sceneEmoji: words.refs.map(r => r.emoji ?? '').filter(Boolean),
        sceneImage: null, options: [], correctOptionId: key ? `thing-${key}` : '',
        ...(d.respond === 'say-any' ? { sayAny: sayAnyExamples(words, `${fillSounds(base.narration, words, false).text} ${fillSounds(base.ask, words).text}`) } : {}) };
    }
    if (kindOf(d) !== 'which-one' && d.world) return { ...base, ...worldStop(d, i, rand), sceneImage: null };
    const right = pictureOf(d.correctWord)!;
    const options: WonderWalkOption[] = [
      { id: `s${i}-a`, word: right.word, emoji: right.emoji, trap: null },
      ...d.wrongWords.map((x, k) => { const p = pictureOf(x.word)!; return { id: `s${i}-${'bc'[k]}`, word: p.word, emoji: p.emoji, trap: x.trap as WonderWalkTrap }; }),
    ];
    for (let k = options.length - 1; k > 0; k--) { const j = Math.floor(rand() * (k + 1)); [options[k], options[j]] = [options[j], options[k]]; }
    return {
      ...base,
      challengeType: 'which-one',
      sceneWords: d.sceneWords.map(w => pictureOf(w)!.word),
      sceneEmoji: d.sceneWords.map(w => pictureOf(w)!.emoji),
      sceneImage: images[i] ?? null,
      options,
      correctOptionId: `s${i}-a`,
    };
  });
  const tapped = stops.filter(s => s.options.length && s.correctOptionId);
  const at = (s: WonderWalkStop) => s.options.findIndex(o => o.id === s.correctOptionId);
  if (tapped.length > 2 && tapped.every(s => at(s) === at(tapped[0]))) {
    const s = tapped[tapped.length - 1];
    const k = (at(s) + 1) % s.options.length;
    const j = at(s);
    [s.options[j], s.options[k]] = [s.options[k], s.options[j]];
  }
  return stops;
}
