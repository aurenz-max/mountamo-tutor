import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import type {
  PictureVocabularyData,
  PictureVocabChallenge,
  PictureVocabChallengeType,
  PictureVocabOption,
} from "../../primitives/visual-primitives/literacy/PictureVocabulary";
import {
  resolveEvalModeConstraint,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

// ---------------------------------------------------------------------------
// ORCHESTRATOR REFACTOR (SP-14 nested-optional variant + cross-contamination)
//
// The old design used ONE multi-purpose pool schema whose mode-specific fields
// (oppositeWord/oppositeEmoji, frameDisplay/frameSpoken) were OPTIONAL. Flash
// Lite dropped the opposite pair (opposite mode hard-failed 0/5 — PV-1) and
// mixed adjectives-with-proxy-emojis into the naming/receptive pool (big→🐘 —
// PV-2). Fix: three per-category sub-generators, each with a FLAT schema whose
// fields are ALL REQUIRED. Code owns all challenge assembly, exactly as before.
//   - nouns   → receptive_match | naming   (concrete nouns, emoji IS the referent)
//   - pairs   → opposite                   (all four fields required)
//   - frames  → sentence_frame             (all four fields required)
// ---------------------------------------------------------------------------

// Kept only to drive resolveEvalModeConstraint (mode selection + logging).
// Prompts are now per-sub-generator, so these docs are no longer injected.
const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  receptive_match: {
    promptDoc: `"receptive_match": hear a word, tap its picture from 4 emoji-only cards.`,
    schemaDescription: "'receptive_match' (hear word, tap picture)",
  },
  naming: {
    promptDoc: `"naming": see one picture, say the word aloud.`,
    schemaDescription: "'naming' (see picture, say the word)",
  },
  opposite: {
    promptDoc: `"opposite": see a word+picture, say its opposite aloud.`,
    schemaDescription: "'opposite' (see word, say its opposite)",
  },
  association: {
    promptDoc: `"association": see a word+picture, say the thing that GOES WITH it (sock→shoe).`,
    schemaDescription: "'association' (say what goes with it)",
  },
  gradable_scale: {
    promptDoc: `"gradable_scale": see an ordered word gradient with one rung blank, say the missing rung.`,
    schemaDescription: "'gradable_scale' (say the missing rung)",
  },
  sentence_frame: {
    promptDoc: `"sentence_frame": hear a sentence with a blank, say the missing word.`,
    schemaDescription: "'sentence_frame' (say the missing word)",
  },
};

// ---------------------------------------------------------------------------
// Per-category schemas — flat, ALL fields required (no nullable mode fields
// for Flash Lite to silently drop). Kept to 2 object types each.
// ---------------------------------------------------------------------------

const nounPoolSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Engaging, kid-friendly title including the topic (e.g., 'Farm Animal Words!')." },
    description: { type: Type.STRING, description: "One friendly sentence telling a K-1 student what they'll do (no answer words)." },
    words: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING, description: "A concrete, picturable NOUN in lowercase (dog, sun, cup, bed). One word, no spaces." },
          emoji: { type: Type.STRING, description: "Exactly one emoji that IS the noun itself (dog → 🐶, sun → ☀️). Never an example-emoji." },
        },
        required: ["word", "emoji"],
      },
      description: "10-12 concrete nouns, each with an unambiguous emoji; all emojis visually distinct.",
    },
  },
  required: ["title", "description", "words"],
};

const oppositePairsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Engaging, kid-friendly title including the topic (e.g., 'Opposite Words!')." },
    description: { type: Type.STRING, description: "One friendly sentence telling a K-1 student what they'll do (no answer words)." },
    pairs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING, description: "One side of the pair, lowercase single word (e.g., 'big')." },
          emoji: { type: Type.STRING, description: "Exactly one emoji depicting 'word' (an exemplar is fine — the word is shown next to it)." },
          oppositeWord: { type: Type.STRING, description: "The TRUE opposite of 'word', lowercase single word (e.g., 'small')." },
          oppositeEmoji: { type: Type.STRING, description: "Exactly one emoji depicting 'oppositeWord'." },
        },
        required: ["word", "emoji", "oppositeWord", "oppositeEmoji"],
      },
      description: "6-8 true, concrete, picturable opposite pairs. EVERY pair fully filled — never leave a field blank.",
    },
  },
  required: ["title", "description", "pairs"],
};

const associationPairsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Engaging, kid-friendly title including the topic (e.g., 'Things That Go Together!')." },
    description: { type: Type.STRING, description: "One friendly sentence telling a K-1 student what they'll do (no answer words)." },
    pairs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING, description: "One concrete object, lowercase single word (e.g., 'sock')." },
          emoji: { type: Type.STRING, description: "Exactly one emoji that IS 'word' (sock → 🧦)." },
          relatedWord: { type: Type.STRING, description: "A DIFFERENT concrete thing that naturally GOES WITH 'word' (sock→shoe, spoon→fork, bed→pillow), lowercase single word. Never the same thing, never an opposite." },
          relatedEmoji: { type: Type.STRING, description: "Exactly one emoji that IS 'relatedWord' (shoe → 👟)." },
        },
        required: ["word", "emoji", "relatedWord", "relatedEmoji"],
      },
      description: "6-8 pairs of things that go together. EVERY pair fully filled — never leave a field blank.",
    },
  },
  required: ["title", "description", "pairs"],
};

const gradableScalesSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Engaging, kid-friendly title including the topic (e.g., 'Word Scales!')." },
    description: { type: Type.STRING, description: "One friendly sentence telling a K-1 student what they'll do (no answer words)." },
    scales: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          concept: { type: Type.STRING, description: "The gradable dimension, lowercase (e.g., 'size', 'temperature', 'speed')." },
          emoji: { type: Type.STRING, description: "One emoji representing the concept (size → 📏, temperature → 🌡️, speed → 🏃)." },
          words: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3-5 words ordered STRICTLY low→high along the concept (e.g., ['tiny','small','big','huge'] or ['freezing','cold','cool','warm','hot']). Each a lowercase single token.",
          },
        },
        required: ["concept", "emoji", "words"],
      },
      description: "4-6 gradable scales, each an ordered low→high sequence of 3-5 single-word rungs.",
    },
  },
  required: ["title", "description", "scales"],
};

const framePoolSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Engaging, kid-friendly title including the topic (e.g., 'Finish the Sentence!')." },
    description: { type: Type.STRING, description: "One friendly sentence telling a K-1 student what they'll do (no answer words)." },
    words: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING, description: "A concrete, picturable noun in lowercase. One word, no spaces." },
          emoji: { type: Type.STRING, description: "Exactly one emoji that depicts the word." },
          frameDisplay: { type: Type.STRING, description: "A short simple sentence with the word replaced by '____' (e.g., 'We sleep in a ____.'). MUST NOT contain the word." },
          frameSpoken: { type: Type.STRING, description: "The same sentence the tutor SAYS aloud, blank spoken as 'hmm' (e.g., 'We sleep in a... hmm... what?'). MUST NOT contain the word." },
        },
        required: ["word", "emoji", "frameDisplay", "frameSpoken"],
      },
      description: "6-8 words, each with a complete display+spoken frame. NEITHER frame may contain its own target word.",
    },
  },
  required: ["title", "description", "words"],
};

// ---------------------------------------------------------------------------
// Raw shapes + normalized pool word
// ---------------------------------------------------------------------------

interface RawNoun { word?: string; emoji?: string; }
interface RawNounPool { title?: string; description?: string; words?: RawNoun[]; }

interface RawPair { word?: string; emoji?: string; oppositeWord?: string; oppositeEmoji?: string; }
interface RawPairPool { title?: string; description?: string; pairs?: RawPair[]; }

interface RawAssocPair { word?: string; emoji?: string; relatedWord?: string; relatedEmoji?: string; }
interface RawAssocPool { title?: string; description?: string; pairs?: RawAssocPair[]; }

interface RawScale { concept?: string; emoji?: string; words?: string[]; }
interface RawScalePool { title?: string; description?: string; scales?: RawScale[]; }

interface RawFrame { word?: string; emoji?: string; frameDisplay?: string; frameSpoken?: string; }
interface RawFramePool { title?: string; description?: string; words?: RawFrame[]; }

/** A validated, ordered gradable gradient (e.g. ['tiny','small','big','huge']). */
interface GradableScale { concept: string; emoji: string; words: string[]; }

/** A pool entry that survived validation, normalized. */
interface PoolWord {
  word: string;
  emoji: string;
  oppositeWord?: string;
  oppositeEmoji?: string;
  /** association mode: the thing that goes with `word` (sock→shoe). */
  relatedWord?: string;
  relatedEmoji?: string;
  /** Normalized frame (blank guaranteed, prompt-law verified) — present only if valid. */
  frameDisplay?: string;
  frameSpoken?: string;
}

interface SubPool {
  words: PoolWord[];
  title: string;
  description: string;
}

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Single token, no spaces, 2-12 chars. */
const isValidWordToken = (w: string): boolean => /^\S{2,12}$/.test(w) && !/\s/.test(w);

/**
 * PROMPT LAW (code-enforced): frames may never contain the target word — the
 * tutor speaks frameSpoken with the mic about to open. Returns normalized frames
 * (blank guaranteed in frameDisplay), or null to REJECT.
 */
const normalizeFrames = (
  word: string,
  frameDisplay: string | undefined,
  frameSpoken: string | undefined,
): { frameDisplay: string; frameSpoken: string } | null => {
  let display = frameDisplay?.trim();
  const spoken = frameSpoken?.trim();
  if (!display || !spoken) return null;

  // frameDisplay must contain a blank written as "____". If Gemini wrote the
  // word instead, blank it — but ONLY if the word appears exactly once.
  if (!/_{2,}/.test(display)) {
    const wordRe = new RegExp(escapeRegExp(word), 'gi');
    const occurrences = display.match(wordRe);
    if (!occurrences || occurrences.length !== 1) return null;
    display = display.replace(wordRe, '____');
  }

  const target = word.toLowerCase();
  if (display.toLowerCase().includes(target)) return null;
  if (spoken.toLowerCase().includes(target)) return null;

  return { frameDisplay: display, frameSpoken: spoken };
};

const hasValidOpposite = (e: PoolWord): boolean =>
  Boolean(
    e.oppositeWord
    && e.oppositeEmoji
    && isValidWordToken(e.oppositeWord)
    && e.oppositeWord.toLowerCase() !== e.word.toLowerCase(),
  );

const hasValidAssociation = (e: PoolWord): boolean =>
  Boolean(
    e.relatedWord
    && e.relatedEmoji
    && isValidWordToken(e.relatedWord)
    && e.relatedWord.toLowerCase() !== e.word.toLowerCase(),
  );

// ---------------------------------------------------------------------------
// Per-category validation (REJECT, never fabricate)
// ---------------------------------------------------------------------------

const validateNounPool = (raw: RawNounPool): PoolWord[] => {
  const survivors: PoolWord[] = [];
  const seenWords = new Set<string>();
  const seenEmojis = new Set<string>();
  let rejected = 0;

  for (const entry of raw.words ?? []) {
    const word = entry.word?.trim().toLowerCase();
    const emoji = entry.emoji?.trim();
    if (!word || !emoji || !isValidWordToken(word)) { rejected += 1; continue; }
    // Dedup by word AND emoji so receptive_match's emoji-only cards stay distinct.
    if (seenWords.has(word) || seenEmojis.has(emoji)) { rejected += 1; continue; }
    seenWords.add(word);
    seenEmojis.add(emoji);
    survivors.push({ word, emoji });
  }

  if (rejected > 0) {
    console.warn(`[PictureVocabulary] noun pool: rejected ${rejected} malformed entr${rejected === 1 ? 'y' : 'ies'} (${survivors.length} survived)`);
  }
  return survivors;
};

const validateOppositePairs = (raw: RawPairPool): PoolWord[] => {
  const survivors: PoolWord[] = [];
  const seenWords = new Set<string>();
  let rejected = 0;

  for (const entry of raw.pairs ?? []) {
    const word = entry.word?.trim().toLowerCase();
    const emoji = entry.emoji?.trim();
    const oppositeWord = entry.oppositeWord?.trim().toLowerCase();
    const oppositeEmoji = entry.oppositeEmoji?.trim();

    // All four required — a pair missing any half is unusable.
    if (!word || !emoji || !oppositeWord || !oppositeEmoji) { rejected += 1; continue; }
    if (!isValidWordToken(word) || !isValidWordToken(oppositeWord)) { rejected += 1; continue; }
    if (word === oppositeWord) { rejected += 1; continue; }
    // Keep pairs disjoint so a word can't be both a base and an opposite elsewhere.
    if (seenWords.has(word) || seenWords.has(oppositeWord)) { rejected += 1; continue; }
    seenWords.add(word);
    seenWords.add(oppositeWord);
    survivors.push({ word, emoji, oppositeWord, oppositeEmoji });
  }

  if (rejected > 0) {
    console.warn(`[PictureVocabulary] opposite pairs: rejected ${rejected} malformed pair${rejected === 1 ? '' : 's'} (${survivors.length} survived)`);
  }
  return survivors;
};

const validateAssociationPairs = (raw: RawAssocPool): PoolWord[] => {
  const survivors: PoolWord[] = [];
  const seenWords = new Set<string>();
  let rejected = 0;

  for (const entry of raw.pairs ?? []) {
    const word = entry.word?.trim().toLowerCase();
    const emoji = entry.emoji?.trim();
    const relatedWord = entry.relatedWord?.trim().toLowerCase();
    const relatedEmoji = entry.relatedEmoji?.trim();

    // All four required — a pair missing any half is unusable.
    if (!word || !emoji || !relatedWord || !relatedEmoji) { rejected += 1; continue; }
    if (!isValidWordToken(word) || !isValidWordToken(relatedWord)) { rejected += 1; continue; }
    if (word === relatedWord) { rejected += 1; continue; }
    // Keep pairs disjoint so a word can't be both a prompt and a partner elsewhere.
    if (seenWords.has(word) || seenWords.has(relatedWord)) { rejected += 1; continue; }
    seenWords.add(word);
    seenWords.add(relatedWord);
    survivors.push({ word, emoji, relatedWord, relatedEmoji });
  }

  if (rejected > 0) {
    console.warn(`[PictureVocabulary] association pairs: rejected ${rejected} malformed pair${rejected === 1 ? '' : 's'} (${survivors.length} survived)`);
  }
  return survivors;
};

/** Ordered gradient: 3-5 distinct single-token rungs, low→high as Gemini emitted them. */
const validateGradableScales = (raw: RawScalePool): GradableScale[] => {
  const survivors: GradableScale[] = [];
  let rejected = 0;

  for (const s of raw.scales ?? []) {
    const concept = s.concept?.trim().toLowerCase();
    const emoji = s.emoji?.trim();
    const words = (s.words ?? [])
      .map(w => w?.trim().toLowerCase())
      .filter((w): w is string => Boolean(w) && isValidWordToken(w));
    // A real gradient needs 3-5 rungs, all distinct (order preserved — it IS the scale).
    const distinct = Array.from(new Set(words));
    if (!concept || !emoji || distinct.length < 3 || distinct.length !== words.length) {
      rejected += 1;
      continue;
    }
    survivors.push({ concept, emoji, words: words.slice(0, 5) });
  }

  if (rejected > 0) {
    console.warn(`[PictureVocabulary] gradable scales: rejected ${rejected} malformed scale${rejected === 1 ? '' : 's'} (${survivors.length} survived)`);
  }
  return survivors;
};

const validateFramePool = (raw: RawFramePool): PoolWord[] => {
  const survivors: PoolWord[] = [];
  const seenWords = new Set<string>();
  const seenEmojis = new Set<string>();
  let rejected = 0;

  for (const entry of raw.words ?? []) {
    const word = entry.word?.trim().toLowerCase();
    const emoji = entry.emoji?.trim();
    if (!word || !emoji || !isValidWordToken(word)) { rejected += 1; continue; }
    if (seenWords.has(word) || seenEmojis.has(emoji)) { rejected += 1; continue; }
    const frames = normalizeFrames(word, entry.frameDisplay, entry.frameSpoken);
    if (!frames) { rejected += 1; continue; } // frame is the whole point of this mode
    seenWords.add(word);
    seenEmojis.add(emoji);
    survivors.push({ word, emoji, frameDisplay: frames.frameDisplay, frameSpoken: frames.frameSpoken });
  }

  if (rejected > 0) {
    console.warn(`[PictureVocabulary] frame pool: rejected ${rejected} malformed entr${rejected === 1 ? 'y' : 'ies'} (${survivors.length} survived)`);
  }
  return survivors;
};

/**
 * Every valid opposite pair works in BOTH directions — big→small and small→big
 * are equally real challenges (code DERIVES the reversal, never fabricates).
 * Deduped by directional key so a pair Gemini emitted both ways isn't tripled.
 */
const expandOpposites = (pairs: PoolWord[]): PoolWord[] => {
  const seen = new Set<string>();
  const expanded: PoolWord[] = [];
  for (const e of pairs) {
    const key = `${e.word}→${e.oppositeWord}`;
    if (!seen.has(key)) {
      seen.add(key);
      expanded.push(e);
    }
    const revKey = `${e.oppositeWord}→${e.word}`;
    if (!seen.has(revKey)) {
      seen.add(revKey);
      expanded.push({
        word: e.oppositeWord!,
        emoji: e.oppositeEmoji!,
        oppositeWord: e.word,
        oppositeEmoji: e.emoji,
      });
    }
  }
  return expanded;
};

/**
 * "Goes-with" is symmetric — sock→shoe and shoe→sock are both real challenges.
 * Same bidirectional expansion as opposites, over the related-word fields.
 */
const expandAssociations = (pairs: PoolWord[]): PoolWord[] => {
  const seen = new Set<string>();
  const expanded: PoolWord[] = [];
  for (const e of pairs) {
    const key = `${e.word}→${e.relatedWord}`;
    if (!seen.has(key)) {
      seen.add(key);
      expanded.push(e);
    }
    const revKey = `${e.relatedWord}→${e.word}`;
    if (!seen.has(revKey)) {
      seen.add(revKey);
      expanded.push({
        word: e.relatedWord!,
        emoji: e.relatedEmoji!,
        relatedWord: e.word,
        relatedEmoji: e.emoji,
      });
    }
  }
  return expanded;
};

// ---------------------------------------------------------------------------
// Challenge assembly (all structure is code-owned) — unchanged behavior.
// ---------------------------------------------------------------------------

const shuffle = <T,>(arr: readonly T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Build the 4-option set: target + 3 distractors, no duplicate words,
 * target included exactly once. Returns null if the pool can't supply
 * 3 valid distractors (caller skips this entry — never fabricates).
 */
const buildOptions = (
  target: PictureVocabOption,
  candidates: PictureVocabOption[],
  opts: { distinctEmojis: boolean; forcedDistractors?: PictureVocabOption[] },
): PictureVocabOption[] | null => {
  const picked: PictureVocabOption[] = [target];
  const usedWords = new Set([target.word.toLowerCase()]);
  const usedEmojis = new Set([target.emoji]);

  const seat = (opt: PictureVocabOption): boolean => {
    if (usedWords.has(opt.word.toLowerCase())) return false;
    if (opts.distinctEmojis && usedEmojis.has(opt.emoji)) return false;
    picked.push(opt);
    usedWords.add(opt.word.toLowerCase());
    usedEmojis.add(opt.emoji);
    return true;
  };

  for (const forced of opts.forcedDistractors ?? []) {
    if (!seat(forced)) return null; // forced distractor collides with target — unusable entry
  }
  for (const c of shuffle(candidates)) {
    if (picked.length === 4) break;
    seat(c);
  }
  return picked.length === 4 ? shuffle(picked) : null;
};

/**
 * Build one challenge of the given type from `entry`, drawing distractors from
 * `pool`. Returns null when distractors can't be assembled.
 */
const buildChallenge = (
  type: PictureVocabChallengeType,
  entry: PoolWord,
  pool: PoolWord[],
): PictureVocabChallenge | null => {
  const others = pool.filter(e => e !== entry);

  if (type === 'opposite') {
    if (!hasValidOpposite(entry)) return null;
    const target: PictureVocabOption = { word: entry.oppositeWord!, emoji: entry.oppositeEmoji! };
    // Distractor candidates: other entries' words AND their opposites.
    const candidates: PictureVocabOption[] = others.flatMap(e => {
      const c: PictureVocabOption[] = [{ word: e.word, emoji: e.emoji }];
      if (hasValidOpposite(e)) c.push({ word: e.oppositeWord!, emoji: e.oppositeEmoji! });
      return c;
    });
    const options = buildOptions(target, candidates, {
      distinctEmojis: false,
      // The base word is the classic error — always seat it as a distractor.
      forcedDistractors: [{ word: entry.word, emoji: entry.emoji }],
    });
    if (!options) return null;
    return {
      id: 'pv-pending',
      type,
      word: entry.oppositeWord!,
      emoji: entry.oppositeEmoji!,
      options,
      baseWord: entry.word,
      baseEmoji: entry.emoji,
    };
  }

  if (type === 'association') {
    if (!hasValidAssociation(entry)) return null;
    const target: PictureVocabOption = { word: entry.relatedWord!, emoji: entry.relatedEmoji! };
    // Distractor candidates: other entries' words AND their partners.
    const candidates: PictureVocabOption[] = others.flatMap(e => {
      const c: PictureVocabOption[] = [{ word: e.word, emoji: e.emoji }];
      if (hasValidAssociation(e)) c.push({ word: e.relatedWord!, emoji: e.relatedEmoji! });
      return c;
    });
    // No forced base distractor: the prompt object itself is never a valid "goes-with" answer.
    const options = buildOptions(target, candidates, { distinctEmojis: false });
    if (!options) return null;
    return {
      id: 'pv-pending',
      type,
      word: entry.relatedWord!,
      emoji: entry.relatedEmoji!,
      options,
      baseWord: entry.word,
      baseEmoji: entry.emoji,
    };
  }

  if (type === 'sentence_frame') {
    if (!entry.frameDisplay || !entry.frameSpoken) return null;
    const target: PictureVocabOption = { word: entry.word, emoji: entry.emoji };
    const options = buildOptions(target, others.map(e => ({ word: e.word, emoji: e.emoji })), {
      distinctEmojis: false,
    });
    if (!options) return null;
    return {
      id: 'pv-pending',
      type,
      word: entry.word,
      emoji: entry.emoji,
      options,
      frameDisplay: entry.frameDisplay,
      frameSpoken: entry.frameSpoken,
    };
  }

  // receptive_match | naming
  const target: PictureVocabOption = { word: entry.word, emoji: entry.emoji };
  const options = buildOptions(target, others.map(e => ({ word: e.word, emoji: e.emoji })), {
    // receptive_match renders emoji-only cards → emojis must be distinct.
    distinctEmojis: type === 'receptive_match',
  });
  if (!options) return null;
  return { id: 'pv-pending', type, word: entry.word, emoji: entry.emoji, options };
};

/** Single-mode session: 5 challenges of one type. */
const assembleSingleMode = (
  mode: PictureVocabChallengeType,
  eligible: PoolWord[],
  fullPool: PoolWord[],
): PictureVocabChallenge[] => {
  const challenges: PictureVocabChallenge[] = [];
  // In 'opposite' mode `eligible` contains both directions of each pair
  // (expandOpposites). Prefer unique pairs; only reuse a pair's reverse
  // direction when the pool is too thin to fill the session otherwise.
  const usedPairs = new Set<string>();
  const deferred: PoolWord[] = [];
  // opposite + association are both bidirectional pairs (expand*): don't use both
  // directions of the same pair unless the pool is too thin to fill the session.
  const partnerOf = (e: PoolWord): string | undefined => e.oppositeWord ?? e.relatedWord;
  for (const entry of shuffle(eligible)) {
    if (challenges.length === 5) break;
    const partner = partnerOf(entry);
    if ((mode === 'opposite' || mode === 'association') && partner) {
      const pairKey = [entry.word, partner].sort().join('|');
      if (usedPairs.has(pairKey)) { deferred.push(entry); continue; }
      usedPairs.add(pairKey);
    }
    const ch = buildChallenge(mode, entry, fullPool);
    if (ch) challenges.push(ch);
  }
  for (const entry of deferred) {
    if (challenges.length === 5) break;
    const ch = buildChallenge(mode, entry, fullPool);
    if (ch) challenges.push(ch);
  }
  return challenges;
};

/**
 * Build one gradable-scale challenge: blank the `targetIndex` rung, draw the 4
 * options from the scale's OWN rungs (the natural confusables) first, padding
 * from other scales only if the scale is short. Emoji='' on options (word-only
 * cards); challenge.emoji is the concept emoji, used only in the success line.
 */
const buildGradableChallenge = (
  scale: GradableScale,
  targetIndex: number,
  otherScales: GradableScale[],
): PictureVocabChallenge | null => {
  const words = scale.words;
  if (targetIndex < 0 || targetIndex >= words.length) return null;
  const target: PictureVocabOption = { word: words[targetIndex], emoji: '' };
  const sameScale: PictureVocabOption[] = words
    .filter((_, i) => i !== targetIndex)
    .map(w => ({ word: w, emoji: '' }));
  const padPool: PictureVocabOption[] = otherScales.flatMap(s => s.words.map(w => ({ word: w, emoji: '' })));
  const options = buildOptions(target, [...sameScale, ...shuffle(padPool)], { distinctEmojis: false });
  if (!options) return null;
  return {
    id: 'pv-pending',
    type: 'gradable_scale',
    word: words[targetIndex],
    emoji: scale.emoji,
    options,
    scaleWords: words,
    scaleTargetIndex: targetIndex,
  };
};

/**
 * 5 challenges, one per distinct scale where possible. Prefer an INTERIOR rung
 * (endpoints are guessable; a missing middle forces real gradient reasoning).
 * Pads by reusing scales with a shifted rung when there are fewer than 5.
 */
const assembleGradable = (scales: GradableScale[]): PictureVocabChallenge[] => {
  const challenges: PictureVocabChallenge[] = [];
  const shuffled = shuffle(scales);
  const interiorIndex = (n: number): number =>
    n <= 3 ? 1 : 1 + Math.floor(Math.random() * (n - 2)); // [1, n-2]

  for (const scale of shuffled) {
    if (challenges.length === 5) break;
    const others = shuffled.filter(s => s !== scale);
    const ch = buildGradableChallenge(scale, interiorIndex(scale.words.length), others);
    if (ch) challenges.push(ch);
  }
  // Thin pool: reuse scales with a shifted target rung to reach 5 (best-effort).
  let guard = 0;
  while (challenges.length < 5 && shuffled.length > 0 && guard < 20) {
    const scale = shuffled[guard % shuffled.length];
    const others = shuffled.filter(s => s !== scale);
    const idx = (interiorIndex(scale.words.length) + guard) % scale.words.length;
    const ch = buildGradableChallenge(scale, idx, others);
    if (ch) challenges.push(ch);
    guard += 1;
  }
  return challenges;
};

/**
 * Mixed session (the tester's "Auto" button): an explicit easy→hard ladder.
 * 2× receptive_match, 2× naming from the noun pool, then 1× opposite and 1×
 * sentence_frame when those pools are available (best-effort). Never collapses
 * to a single type. Receptive/naming distractors come from NOUNS only so the
 * emoji cards are never ambiguous; opposite/frame options are word-labeled.
 */
const assembleMixed = (
  nouns: PoolWord[],
  opposites: PoolWord[], // already expanded
  frames: PoolWord[],
): PictureVocabChallenge[] => {
  const challenges: PictureVocabChallenge[] = [];
  const nounShuffled = shuffle(nouns);
  let cursor = 0;

  const ladder: PictureVocabChallengeType[] = ['receptive_match', 'receptive_match', 'naming', 'naming'];
  for (const type of ladder) {
    while (cursor < nounShuffled.length) {
      const ch = buildChallenge(type, nounShuffled[cursor], nouns);
      cursor += 1;
      if (ch) { challenges.push(ch); break; }
    }
  }

  for (const entry of shuffle(opposites)) {
    const ch = buildChallenge('opposite', entry, opposites);
    if (ch) { challenges.push(ch); break; }
  }
  for (const entry of shuffle(frames)) {
    const ch = buildChallenge('sentence_frame', entry, [...frames, ...nouns]);
    if (ch) { challenges.push(ch); break; }
  }

  // Pool couldn't support the hard rungs — pad back to 5 with easy noun types.
  let padType: PictureVocabChallengeType = 'receptive_match';
  while (challenges.length < 5 && cursor < nounShuffled.length) {
    const ch = buildChallenge(padType, nounShuffled[cursor], nouns);
    cursor += 1;
    if (ch) {
      challenges.push(ch);
      padType = padType === 'receptive_match' ? 'naming' : 'receptive_match';
    }
  }

  return challenges;
};

// ---------------------------------------------------------------------------
// Sub-generators — one focused Gemini call each.
// ---------------------------------------------------------------------------

type PictureVocabularyConfig = Partial<PictureVocabularyData & {
  /** Target eval mode from the IRT calibration system. */
  targetEvalMode: string;
}>;

const MODEL = 'gemini-flash-lite-latest';

const SYSTEM_INSTRUCTION =
  `You are an expert early-childhood vocabulary specialist. You choose words for K-1 students that are `
  + `concrete, picturable, and part of a young child's everyday world. Every emoji you pick must visually `
  + `match its word so clearly that a five-year-old recognizes it instantly. You only give a word an opposite `
  + `when a true, concrete, picturable opposite exists. You NEVER put a sentence frame's answer word inside `
  + `the frame itself — the frame is spoken aloud right before the child answers, so containing the answer `
  + `would give it away.`;

/** Shared Gemini call. Throws on empty/unparseable output (never fabricates). */
const callGemini = async <T,>(schema: Schema, prompt: string, corrective?: string): Promise<T> => {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: corrective ? `${prompt}\n\n${corrective}` : prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: schema,
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  });
  const text = response.text;
  if (!text) throw new Error('No data returned from Gemini API');
  return JSON.parse(text) as T;
};

const preamble = (topic: string, intent: string | undefined, grade: string): string =>
  `Topic: "${topic}".`
  + `${intent ? `\nSPECIFIC FOCUS: lean word choices toward "${intent}" when possible — but ALWAYS prioritize concreteness and picturability over this focus.` : ''}`
  + `\nTARGET GRADE LEVEL: ${grade}`;

const generateNounPool = async (
  topic: string, intent: string | undefined, grade: string, corrective?: string,
): Promise<SubPool> => {
  const prompt = `Create a themed word pool for a K-1 spoken picture-vocabulary session.
${preamble(topic, intent, grade)}

Produce 10-12 CONCRETE NOUNS a young child can name from a picture alone.

STRICT RULES:
- Every word is a concrete, picturable NOUN (a thing you can point to): dog, sun, cup, bed, apple, bus.
- NEVER include adjectives, feelings, sizes, temperatures, or relationship words (big, small, hot, cold, happy, fast) — those have no picture of their own.
- Every emoji must BE the thing itself, not an example of it: cat → 🐱 (the emoji IS a cat). NEVER an example-emoji — never 🐘 for "big" or 🐁 for "small".
- Every word: lowercase single token, 2-12 letters, no spaces.
- All emojis must be visually DISTINCT from each other.
- Theme the words to "${topic}" wherever a concrete noun fits; fill remaining slots with everyday K nouns.

Also provide:
- title: fun, kid-friendly session title including the topic.
- description: one friendly sentence telling the student what they'll do (NO answer words).`;
  const raw = await callGemini<RawNounPool>(nounPoolSchema, prompt, corrective);
  return { words: validateNounPool(raw), title: raw.title ?? '', description: raw.description ?? '' };
};

const generateOppositePairs = async (
  topic: string, intent: string | undefined, grade: string, corrective?: string,
): Promise<SubPool> => {
  const prompt = `Create pairs of OPPOSITE words for a K-1 "say the opposite" vocabulary game.
${preamble(topic, intent, grade)}

Produce 6-8 opposite PAIRS. For EACH pair give ALL FOUR fields (word, emoji, oppositeWord, oppositeEmoji).

STRICT RULES:
- Only TRUE, concrete, picturable opposites: big/small, hot/cold, day/night, wet/dry, happy/sad, fast/slow, up/down, open/closed, full/empty, on/off.
- BOTH members must have a clear emoji. An EXEMPLAR emoji is fine here (big → 🐘, small → 🐭) because the WORD is always shown next to the picture.
- Each word: lowercase single token, 2-12 letters, no spaces.
- Never repeat a word across pairs.
- EVERY pair must be completely filled — never leave oppositeWord or oppositeEmoji blank. This is the whole activity.

Also provide:
- title: fun, kid-friendly session title including the topic.
- description: one friendly sentence telling the student what they'll do (NO answer words).`;
  const raw = await callGemini<RawPairPool>(oppositePairsSchema, prompt, corrective);
  return { words: validateOppositePairs(raw), title: raw.title ?? '', description: raw.description ?? '' };
};

const generateAssociationPairs = async (
  topic: string, intent: string | undefined, grade: string, corrective?: string,
): Promise<SubPool> => {
  const prompt = `Create pairs of things that GO TOGETHER for a K-1 "what goes with it?" vocabulary game.
${preamble(topic, intent, grade)}

Produce 6-8 "goes-with" PAIRS. For EACH pair give ALL FOUR fields (word, emoji, relatedWord, relatedEmoji).

STRICT RULES:
- Only NATURAL, concrete, picturable associations a young child knows: sock/shoe, spoon/fork, bed/pillow, cup/plate, dog/bone, key/lock, pencil/paper, bird/nest, toothbrush/toothpaste.
- These are NOT opposites and NOT the same thing — two DIFFERENT things that belong together.
- Both members must have a clear emoji that IS the thing itself.
- Each word: lowercase single token, 2-12 letters, no spaces. Never repeat a word across pairs.
- EVERY pair completely filled — never leave relatedWord or relatedEmoji blank. This is the whole activity.

Also provide:
- title: fun, kid-friendly session title including the topic.
- description: one friendly sentence telling the student what they'll do (NO answer words).`;
  const raw = await callGemini<RawAssocPool>(associationPairsSchema, prompt, corrective);
  return { words: validateAssociationPairs(raw), title: raw.title ?? '', description: raw.description ?? '' };
};

const generateGradableScales = async (
  topic: string, intent: string | undefined, grade: string, corrective?: string,
): Promise<{ scales: GradableScale[]; title: string; description: string }> => {
  const prompt = `Create ordered WORD SCALES for a K-1 "which word is missing?" gradient game.
${preamble(topic, intent, grade)}

Produce 4-6 gradable scales. Each scale is 3-5 words ordered STRICTLY low → high along ONE concept.

STRICT RULES:
- Each scale is a TRUE ordered gradient a young child can reason about: size (tiny, small, big, huge), temperature (freezing, cold, cool, warm, hot), speed (slow, medium, fast), loudness (quiet, medium, loud), brightness (dark, dim, bright).
- Order STRICTLY low → high. Every word a lowercase single token (2-12 letters). No duplicates within a scale.
- Prefer 4-5 rung scales when the concept supports it — a longer scale gives a real "missing middle" to reason about.
- concept: the dimension name (size, temperature, speed...). emoji: one emoji for the concept.

Also provide:
- title: fun, kid-friendly session title including the topic.
- description: one friendly sentence telling the student what they'll do (NO answer words).`;
  const raw = await callGemini<RawScalePool>(gradableScalesSchema, prompt, corrective);
  return { scales: validateGradableScales(raw), title: raw.title ?? '', description: raw.description ?? '' };
};

const generateFramePool = async (
  topic: string, intent: string | undefined, grade: string, corrective?: string,
): Promise<SubPool> => {
  const prompt = `Create a themed word pool for a K-1 "finish the sentence" vocabulary game.
${preamble(topic, intent, grade)}

Produce 6-8 words. For EACH word give ALL FOUR fields (word, emoji, frameDisplay, frameSpoken).

STRICT RULES:
- Each word: a concrete, picturable noun, lowercase single token, 2-12 letters. emoji depicts it.
- frameDisplay: a short simple sentence with the target word replaced by "____" (e.g., "We sleep in a ____.").
- frameSpoken: the same sentence the tutor SAYS aloud, the blank spoken as "hmm" (e.g., "We sleep in a... hmm... what?").
- PROMPT LAW: NEITHER frame may contain the target word anywhere. The tutor speaks the frame with the mic about to open.
- Theme to "${topic}" wherever a concrete noun fits.

Also provide:
- title: fun, kid-friendly session title including the topic.
- description: one friendly sentence telling the student what they'll do (NO answer words).`;
  const raw = await callGemini<RawFramePool>(framePoolSchema, prompt, corrective);
  return { words: validateFramePool(raw), title: raw.title ?? '', description: raw.description ?? '' };
};

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export const generatePictureVocabulary = async (
  ctx: GenerationContext,
): Promise<PictureVocabularyData> => {
  const { topic } = ctx;
  const intent = ctx.intent;
  const grade = ctx.gradeContext;
  const config = ctx.raw as PictureVocabularyConfig;

  // ── Eval mode resolution — the challenge TYPE is decided in CODE (Gemini
  //    only emits a word pool), so the constraint picks which sub-generator runs.
  const evalConstraint = resolveEvalModeConstraint(
    'picture-vocabulary',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('PictureVocabulary', config?.targetEvalMode, evalConstraint);
  const mode = (evalConstraint?.allowedTypes[0] ?? null) as PictureVocabChallengeType | null;

  try {
    let assembled: PictureVocabChallenge[];
    let title: string;
    let description: string;

    if (mode === 'opposite') {
      // One corrective retry to the pair floor, then throw (never fabricate).
      let pool = await generateOppositePairs(topic, intent, grade);
      let expanded = expandOpposites(pool.words);
      if (expanded.length < 5) {
        console.warn(`[PictureVocabulary] opposite: only ${expanded.length}/5 usable pairs — retrying once`);
        pool = await generateOppositePairs(topic, intent, grade,
          `PREVIOUS ATTEMPT REJECTED: too few complete pairs. Regenerate 8 opposite pairs. `
          + `EVERY pair MUST fill all four fields (word, emoji, oppositeWord, oppositeEmoji) — no blanks.`);
        expanded = expandOpposites(pool.words);
      }
      if (expanded.length < 5) {
        throw new Error(`[PictureVocabulary] Opposite pool too small after retry: ${expanded.length}/5 usable directions`);
      }
      assembled = assembleSingleMode('opposite', expanded, expanded);
      ({ title, description } = pool);

    } else if (mode === 'association') {
      // One corrective retry to the pair floor, then throw (never fabricate).
      let pool = await generateAssociationPairs(topic, intent, grade);
      let expanded = expandAssociations(pool.words);
      if (expanded.length < 5) {
        console.warn(`[PictureVocabulary] association: only ${expanded.length}/5 usable pairs — retrying once`);
        pool = await generateAssociationPairs(topic, intent, grade,
          `PREVIOUS ATTEMPT REJECTED: too few complete pairs. Regenerate 8 "goes-with" pairs. `
          + `EVERY pair MUST fill all four fields (word, emoji, relatedWord, relatedEmoji) — no blanks, no opposites.`);
        expanded = expandAssociations(pool.words);
      }
      if (expanded.length < 5) {
        throw new Error(`[PictureVocabulary] Association pool too small after retry: ${expanded.length}/5 usable directions`);
      }
      assembled = assembleSingleMode('association', expanded, expanded);
      ({ title, description } = pool);

    } else if (mode === 'gradable_scale') {
      let pool = await generateGradableScales(topic, intent, grade);
      let assembledScales = assembleGradable(pool.scales);
      if (assembledScales.length < 5) {
        console.warn(`[PictureVocabulary] gradable_scale: only ${assembledScales.length}/5 usable — retrying once`);
        pool = await generateGradableScales(topic, intent, grade,
          `PREVIOUS ATTEMPT REJECTED: too few usable scales. Regenerate 6 gradable scales, each an ordered `
          + `low→high sequence of 3-5 single-word rungs (no duplicates within a scale).`);
        assembledScales = assembleGradable(pool.scales);
      }
      if (assembledScales.length < 5) {
        throw new Error(`[PictureVocabulary] Gradable pool too small after retry: ${assembledScales.length}/5 usable scales`);
      }
      assembled = assembledScales;
      title = pool.title;
      description = pool.description;

    } else if (mode === 'sentence_frame') {
      let pool = await generateFramePool(topic, intent, grade);
      if (pool.words.length < 5) {
        console.warn(`[PictureVocabulary] sentence_frame: only ${pool.words.length}/5 usable frames — retrying once`);
        pool = await generateFramePool(topic, intent, grade,
          `PREVIOUS ATTEMPT REJECTED: too few complete frames. Regenerate 8 words, each with a full `
          + `frameDisplay ("____" in place of the word) + frameSpoken, and NEITHER may contain the target word.`);
      }
      if (pool.words.length < 5) {
        throw new Error(`[PictureVocabulary] Frame pool too small after retry: ${pool.words.length}/5 usable frames`);
      }
      assembled = assembleSingleMode('sentence_frame', pool.words, pool.words);
      ({ title, description } = pool);

    } else if (mode === 'receptive_match' || mode === 'naming') {
      let pool = await generateNounPool(topic, intent, grade);
      if (pool.words.length < 5) {
        console.warn(`[PictureVocabulary] ${mode}: only ${pool.words.length}/5 usable nouns — retrying once`);
        pool = await generateNounPool(topic, intent, grade,
          `PREVIOUS ATTEMPT REJECTED: too few usable nouns. Regenerate 12 concrete nouns, each a lowercase `
          + `single token (2-12 letters) with a distinct emoji that IS the noun itself (no adjectives, no example-emojis).`);
      }
      if (pool.words.length < 5) {
        throw new Error(`[PictureVocabulary] Noun pool too small after retry: ${pool.words.length}/5 usable nouns`);
      }
      assembled = assembleSingleMode(mode, pool.words, pool.words);
      ({ title, description } = pool);

    } else {
      // ── Mixed / Auto: all three in parallel. Nouns are required; opposite
      //    and frame pools are best-effort (mixed pads with nouns if thin).
      const [nounRes, oppRes, frameRes] = await Promise.all([
        generateNounPool(topic, intent, grade),
        generateOppositePairs(topic, intent, grade).catch((e): SubPool => {
          console.warn('[PictureVocabulary] mixed: opposite pool failed, continuing without it', e);
          return { words: [], title: '', description: '' };
        }),
        generateFramePool(topic, intent, grade).catch((e): SubPool => {
          console.warn('[PictureVocabulary] mixed: frame pool failed, continuing without it', e);
          return { words: [], title: '', description: '' };
        }),
      ]);
      if (nounRes.words.length < 5) {
        throw new Error(`[PictureVocabulary] Mixed session noun pool too small: ${nounRes.words.length}/5 nouns`);
      }
      assembled = assembleMixed(nounRes.words, expandOpposites(oppRes.words), frameRes.words);
      title = nounRes.title;
      description = nounRes.description;
    }

    if (!title || !description) {
      throw new Error('[PictureVocabulary] Gemini pool missing title/description');
    }
    if (assembled.length < 5) {
      throw new Error(`[PictureVocabulary] Could only assemble ${assembled.length}/5 challenges from the validated pool`);
    }

    // Index-derived ids — stable and deterministic (never Date.now()).
    const challenges = assembled.map((ch, i) => ({ ...ch, id: `pv-${i + 1}` }));

    const data: PictureVocabularyData = {
      title,
      description,
      // Session-level mode; mixed sessions render per challenge.type —
      // 'naming' is representative metadata only.
      challengeType: mode ?? 'naming',
      challenges,
      gradeLevel: ctx.gradeContext,
    };

    console.log('Picture Vocabulary Generated:', {
      title: data.title,
      mode: mode ?? 'mixed',
      challengeCount: challenges.length,
      types: challenges.map(c => c.type),
      words: challenges.map(c => c.word),
    });

    return data;
  } catch (error) {
    console.error('Error generating picture vocabulary:', error);
    throw error;
  }
};
