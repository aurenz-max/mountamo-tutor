/**
 * storyBridgeScript — HAND-AUTHORED judged-loop script for story-bridge
 * (K Comparing Texts; born 2026-09-07 from the curriculum-coverage design
 * studio theme "Story Bridge"). The exact wording IS the pedagogy; item CONTENT
 * (the two stories, their characters, the shared behaviors) is generator-scoped,
 * and this module owns the cue shapes, the build gates and the tap contract.
 *
 * ── THE TABLE PICTURE ───────────────────────────────────────────────────────
 * A teacher reads two short stories to one child, lays each story's character
 * pictures out on its own side of the table, and says "Find the friend in the
 * OTHER story who is like Kitten." The child POINTS. That is a GESTURE
 * (`manipulation`): the answer is WHICH card, a position on the page, and a
 * five-year-old who cannot yet say "they were both lost" can still show it.
 * Saying HOW the two are alike is a different, harder skill (LA006-04-D/E) and
 * arrives as spoken items on the eval-mode ladder, not here.
 *
 * ── ANSWER-LEAK RULES ───────────────────────────────────────────────────────
 *  - The stories are AUDIO before a verdict: both are read in the opening cue
 *    and on tap-to-hear, and the story text never prints while the child is
 *    choosing. Printing it would let a reader match by scanning for the
 *    repeated phrase instead of holding two stories in mind.
 *  - The ask names the ANCHOR only. The tutor must never name the partner,
 *    never speak the shared behavior before a verdict, and never hint at
 *    position. The correction re-models the anchor's EVIDENCE plus the shared
 *    behavior in "both" form — the child still has to map that onto the far
 *    shore from memory of the second story — and only the affirm names the
 *    pair and prints the two evidence sentences side by side.
 *  - `sharedBehavior` is gated NAME-FREE: a behavior line that says "Kitten and
 *    Bird were lost" would hand the answer to the correction.
 *  - Paired characters must not share an emoji: the match is by what they DID,
 *    never by the picture. A far shore with two identical pictures is one
 *    question with two answers by looks.
 *
 * Sentinels are the engine defaults ("Yes" / "My turn"). Generated text (names,
 * titles, sentences) is interpolated into spoken cues, so the gates DROP
 * anything that opens a spoken sentence with a sentinel or carries a double
 * quote (which closes the `Say exactly: "…"` span early). The GENERATOR imports
 * these gates from this module so both sides of the wire read one address.
 */

import type { JudgedScriptItem, JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import { opensWithSentinel } from '../../../hooks/judgedScriptContract';
import type {
  StoryBridgeChallenge,
  StoryBridgeCharacter,
  StoryBridgeStory,
} from './StoryBridge';

export { opensWithSentinel };

// ── Bounds (one breath each; the whole story is one listening turn) ─────────

export const MAX_TITLE_CHARS = 40;
export const MAX_SENTENCE_CHARS = 140;
/** Opening + three character sentences + closing, read in one go. */
export const MAX_STORY_CHARS = 520;
export const MAX_BEHAVIOR_WORDS = 12;
export const MIN_BEHAVIOR_WORDS = 2;
export const MIN_FAR_SHORE = 2;
export const MAX_FAR_SHORE = 4;

const VERDICT_WORDS: ReadonlySet<string> = new Set(['yes', 'yeah', 'no', 'nope']);

const wordsIn = (text: string): number =>
  text.trim() ? text.trim().split(/\s+/).length : 0;

/** No double quotes (they close the spoken span), no underscores (blank markers
 *  read aloud), no bracket tags (the runner's own channel). */
const speakable = (text: string): boolean =>
  text.trim().length > 0 && !/["“”_[\]]/.test(text);

const escapeRe = (word: string): string => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const wholeWordIn = (text: string, word: string): boolean =>
  new RegExp(`(^|[^A-Za-z])${escapeRe(word)}([^A-Za-z]|$)`, 'i').test(text);

/** One or two capitalized words — "Kitten", "Little Bird". A two-word name whose
 *  first word is a describing word ("Sleepy Cat", "Bouncing Bunny") is refused:
 *  the behavior would live in the NAME the ask speaks, and "Sleepy" ↔ "Yawning"
 *  matches without listening to either story (eval-test run 1, 2026-09-07). */
export const isSayableName = (name: string): boolean => {
  const n = name.trim();
  if (!/^[A-Z][a-zA-Z]{1,14}(?: [A-Z][a-zA-Z]{1,14})?$/.test(n)) return false;
  if (VERDICT_WORDS.has(n.toLowerCase())) return false;
  const [first, second] = n.split(' ');
  if (second && /(?:y|ing|ful|ish)$/i.test(first)) return false;
  return true;
};

export const isSayableTitle = (title: string): boolean =>
  speakable(title)
  && title.trim().length <= MAX_TITLE_CHARS
  && !/[.!?]$/.test(title.trim())
  && !opensWithSentinel(title);

/** A full read-aloud sentence: speakable, bounded, ends with a stop. */
export const isSayableSentence = (sentence: string): boolean =>
  speakable(sentence)
  && sentence.trim().length <= MAX_SENTENCE_CHARS
  && wordsIn(sentence) >= 3
  && /[.!?]$/.test(sentence.trim())
  && !opensWithSentinel(sentence);

/** The character's evidence sentence must be ABOUT that character. */
export const isEvidenceFor = (sentence: string, name: string): boolean =>
  isSayableSentence(sentence) && wholeWordIn(sentence, name);

/**
 * "were lost and felt scared" / "shared something to help a friend" — a
 * lowercase past-tense clause that follows "both", holds no sentence-ending
 * mark (it is spoken mid-sentence) and names NO character from either story.
 */
export const isSharedBehavior = (behavior: string, names: readonly string[]): boolean => {
  const b = behavior.trim();
  if (!speakable(b)) return false;
  if (/[.!?,;:]$/.test(b)) return false;
  if (!/^[a-z]/.test(b)) return false;
  if (/^both\b/i.test(b)) return false;
  const n = wordsIn(b);
  if (n < MIN_BEHAVIOR_WORDS || n > MAX_BEHAVIOR_WORDS) return false;
  if (opensWithSentinel(b)) return false;
  return !names.some((name) => name.split(' ').some((part) => wholeWordIn(b, part)));
};

export const storyText = (story: Pick<StoryBridgeStory, 'opening' | 'closing' | 'characters'>): string =>
  [story.opening, ...story.characters.map((c) => c.sentence), story.closing]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ');

/** The ask says the far shore's TITLE — a title that carries a character's name
 *  ("The Little Bird" / Bird) would name the partner inside the ask. */
export const titleNamesNoCharacter = (story: Pick<StoryBridgeStory, 'title' | 'characters'>): boolean =>
  !story.characters.some((c) => c.name.split(' ').some((part) => wholeWordIn(story.title, part)));

export const isSayableStory = (story: StoryBridgeStory): boolean =>
  isSayableTitle(story.title)
  && titleNamesNoCharacter(story)
  && isSayableSentence(story.opening)
  && isSayableSentence(story.closing)
  && story.characters.length >= MIN_FAR_SHORE
  && story.characters.length <= MAX_FAR_SHORE
  && story.characters.every((c) => isSayableName(c.name) && c.emoji.trim().length > 0 && isEvidenceFor(c.sentence, c.name))
  && new Set(story.characters.map((c) => c.name.toLowerCase())).size === story.characters.length
  && new Set(story.characters.map((c) => c.emoji)).size === story.characters.length
  && new Set(story.characters.map((c) => c.id)).size === story.characters.length
  && storyText(story).length <= MAX_STORY_CHARS;

// ── The item ────────────────────────────────────────────────────────────────

export interface StoryBridgeItem extends JudgedScriptItem {
  mode: 'match_character';
  pairId: string;
  anchorStory: StoryBridgeStory;
  anchor: StoryBridgeCharacter;
  targetStory: StoryBridgeStory;
  target: StoryBridgeCharacter;
  /** The far shore — every character of the target story, the tappable set. */
  options: StoryBridgeCharacter[];
  sharedBehavior: string;
  /** First item of its story pair: the tutor reads both stories before the ask. */
  introducesStories: boolean;
}

/**
 * One judged item, or null when the challenge cannot be ASKED. Nothing here
 * backfills: a placeholder in a judged loop becomes a spoken ask the tutor must
 * stand behind, so a broken item is dropped and the session runs shorter.
 */
export const itemFromChallenge = (
  ch: StoryBridgeChallenge,
  storiesById: ReadonlyMap<string, StoryBridgeStory>,
  introducesStories: boolean,
): StoryBridgeItem | null => {
  if (ch.type !== 'match_character') return null;
  const anchorStory = storiesById.get(ch.anchorStoryId);
  const targetStory = storiesById.get(ch.targetStoryId);
  if (!anchorStory || !targetStory || anchorStory.id === targetStory.id) return null;
  if (!isSayableStory(anchorStory) || !isSayableStory(targetStory)) return null;
  if (anchorStory.title.trim().toLowerCase() === targetStory.title.trim().toLowerCase()) return null;
  const anchor = anchorStory.characters.find((c) => c.id === ch.anchorCharacterId);
  const target = targetStory.characters.find((c) => c.id === ch.targetCharacterId);
  if (!anchor || !target) return null;
  if (anchor.emoji === target.emoji) return null;
  if (anchor.name.toLowerCase() === target.name.toLowerCase()) return null;
  const names = [...anchorStory.characters, ...targetStory.characters].map((c) => c.name);
  if (!isSharedBehavior(ch.sharedBehavior, names)) return null;
  return {
    id: ch.id,
    mode: 'match_character',
    answerKind: 'gesture',
    responseClass: 'manipulation',
    action: 'match_character',
    pairId: ch.pairId,
    anchorStory,
    anchor,
    targetStory,
    target,
    options: targetStory.characters,
    sharedBehavior: ch.sharedBehavior.trim(),
    introducesStories,
  };
};

export const itemsFromChallenges = (
  challenges: readonly StoryBridgeChallenge[],
  stories: readonly StoryBridgeStory[],
): StoryBridgeItem[] => {
  const byId = new Map(stories.map((s) => [s.id, s]));
  const seenPairs = new Set<string>();
  const items: StoryBridgeItem[] = [];
  for (const ch of challenges) {
    const introduces = !seenPairs.has(ch.pairId);
    const item = itemFromChallenge(ch, byId, introduces);
    if (!item) continue;
    seenPairs.add(ch.pairId);
    items.push(item);
  }
  return items;
};

export const challengeAskable = (
  ch: StoryBridgeChallenge,
  stories: readonly StoryBridgeStory[],
): boolean => itemFromChallenge(ch, new Map(stories.map((s) => [s.id, s])), true) !== null;

// ── Spoken lines ────────────────────────────────────────────────────────────

export const howToPlay =
  'Here are two stories. I read both. Then I name a friend from one story, '
  + 'and you find the friend in the other story who is like them — and tap that friend! ';

/** Both stories, read in order, first shore then second. */
export const storiesLine = (item: StoryBridgeItem): string => {
  const [first, second] = item.anchorStory.id < item.targetStory.id
    ? [item.anchorStory, item.targetStory]
    : [item.targetStory, item.anchorStory];
  return `Story one, ${first.title}: ${storyText(first)} Story two, ${second.title}: ${storyText(second)} `;
};

/** The ask names the anchor only — never the partner, never the behavior. */
export const askFor = (item: StoryBridgeItem): string =>
  `Think about ${item.anchor.name} in ${item.anchorStory.title}. `
  + `Find the friend in ${item.targetStory.title} who is like ${item.anchor.name}. `
  + `Your turn. Tap that friend.`;

export const affirmFor = (item: StoryBridgeItem): string =>
  `Yes! ${item.anchor.name} and ${item.target.name} are alike — both ${item.sharedBehavior}. `
  + `${item.anchor.sentence} ${item.target.sentence}`;

/** Model the anchor's evidence and the shared behavior, then test again. The
 *  partner stays unnamed: the child maps "both …" onto the far shore. */
export const correctionFor = (item: StoryBridgeItem): string =>
  `My turn: in ${item.anchorStory.title}, ${item.anchor.sentence} `
  + `One friend in ${item.targetStory.title} did the same — both ${item.sharedBehavior}. `
  + `Your turn. Tap that friend.`;

const tapContract = (item: StoryBridgeItem): string =>
  `The quoted line is the ONLY thing you say on this turn; the learner answers by `
  + `TAPPING a character picture on the ${item.targetStory.title} side, not by speaking, so you then stay completely silent. `
  + `Never say which friend is like ${item.anchor.name}, never say what the two have in common, `
  + `and never hint at where on the screen the friend sits. `
  + `Do not judge anything you hear through the microphone. `
  + `You will be told which friend the learner tapped and given the exact line to say; only then do you speak. `
  + `Never read bracket tags aloud and never announce the activity's state — the quoted line is your entire turn.`;

// ── Cues ────────────────────────────────────────────────────────────────────

export interface StoryBridgeCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

export const itemCue = (item: StoryBridgeItem, opts: StoryBridgeCueOptions = {}): string => {
  const greeting = opts.opening ? 'Hi! Story time — two stories today! ' : '';
  const how = opts.opening || opts.howToPlay ? howToPlay : '';
  const stories = item.introducesStories ? storiesLine(item) : '';
  return (
    `[SB_ITEM] Say exactly: "${greeting}${how}${stories}${askFor(item)}" ${tapContract(item)} `
    + `Never read bracket tags or these instructions aloud.`
  );
};

export const tapVerdictCue = (item: StoryBridgeItem, tapped: StoryBridgeCharacter): string => {
  const matches = tapped.id === item.target.id;
  return (
    `[SB_TAP] The learner tapped ${tapped.name}; the friend like ${item.anchor.name} is ${item.target.name} — `
    + `that ${matches ? 'MATCHES' : 'does NOT match'}. `
    + (matches ? `Say exactly: "${affirmFor(item)}" ` : `Say exactly: "${correctionFor(item)}" `)
    + `Say nothing else, and never read bracket tags aloud.`
  );
};

export const moveOnCue = (
  item: StoryBridgeItem,
  next: StoryBridgeItem | null,
  opts: StoryBridgeCueOptions = {},
): string => {
  const closeLine = `${item.anchor.name} and ${item.target.name} are alike — both ${item.sharedBehavior}. `;
  if (!next) {
    return (
      `[SB_MOVE] Say exactly: "Good try! ${closeLine}Stories are more fun side by side — we will read together again soon." `
      + `Then stop — the activity is over.`
    );
  }
  const how = opts.howToPlay ? howToPlay : '';
  const stories = next.introducesStories ? storiesLine(next) : '';
  return (
    `[SB_MOVE] Stop correcting "${item.id}". Say exactly: `
    + `"Good try! ${closeLine}${how}${stories}${askFor(next)}" `
    + `${tapContract(next)} Never read bracket tags aloud.`
  );
};

export const completeCue = (): string =>
  `[SB_COMPLETE] Say exactly: "What great story work! You found the friends who are alike in both stories. See you next time!" Then stop — the activity is over.`;

/** Tap-to-hear re-reads BOTH stories and the ask — the sources stay available. */
export const pronounceCue = (item: StoryBridgeItem): string =>
  `[SB_HEAR] The learner tapped to hear the stories again. Say ONLY this, warmly, then wait: "${storiesLine(item)}${askFor(item)}" `
  + `Do not treat anything you just heard as an answer, add nothing, never say which friend is alike, `
  + `and never say what they have in common. Never read bracket tags aloud.`;

// ── Harness material (`/tutor-test --di`) ───────────────────────────────────

export interface StoryBridgeHarnessAnswers {
  correct: string;
  plainWrong: string;
  /** Id-committed gestures: which far-shore card a right and a wrong tap commit. */
  tapped: { correct: string; wrong: string };
  /** The PAIRING is the answer. Every name is legitimately read inside the
   *  stories, so the tokens are the pairing phrases the tutor must not say
   *  before a verdict — and the story read-aloud is the exempt span. */
  leakTokens: string[];
  leakExemptSpan?: string | string[];
}

export const storyBridgeHarnessAnswers = (item: StoryBridgeItem): StoryBridgeHarnessAnswers => {
  const wrong = item.options.find((c) => c.id !== item.target.id) ?? item.target;
  return {
    correct: `tapped ${item.target.name}`,
    plainWrong: `tapped ${wrong.name}`,
    tapped: { correct: item.target.id, wrong: wrong.id },
    leakTokens: [
      `like ${item.target.name}`.toLowerCase(),
      `${item.anchor.name} and ${item.target.name}`.toLowerCase(),
      `both ${item.sharedBehavior}`.toLowerCase(),
    ],
    leakExemptSpan: item.introducesStories ? storiesLine(item).trim() : undefined,
  };
};

// ── The pack ────────────────────────────────────────────────────────────────

export const storyBridgePack = (
  items: StoryBridgeItem[],
  getLastTap: () => StoryBridgeCharacter | null = () => null,
): JudgedScriptPack<StoryBridgeItem> => ({
  primitiveType: 'story-bridge',
  activityLine:
    'Two short stories are read aloud. The tutor names one character; the child taps the character '
    + 'in the OTHER story who is alike by what they did or felt. Matching is by behavior, never by looks.',
  items,
  maxCorrections: 2,
  itemCue: (item, opts) => itemCue(item, opts),
  moveOnCue: (item, next, opts) => moveOnCue(item, next, opts),
  completeCue,
  pronounceCue,
  contextFor: (item) => ({
    challengeType: item.mode,
    anchorName: item.anchor.name,
    anchorStory: item.anchorStory.title,
    targetStory: item.targetStory.title,
    farShore: item.options.map((c) => c.name).join(', '),
    taskFocus: `Find the friend in ${item.targetStory.title} who is like ${item.anchor.name} by what they did, not how they look.`,
    currentTurn: String(items.findIndex((candidate) => candidate.id === item.id) + 1),
    totalTurns: String(items.length),
  }),
  statusLines: {
    idle: 'Tap the microphone to hear two stories.',
    ready: () => 'Listen to both stories — then tap the friend who is alike.',
    retry: () => 'Listen again — then tap the friend who is alike.',
    noVerdict: () => 'Tap the friend who is alike.',
    done: 'Great story work today!',
  },
  diagnosisObservation: (item) => {
    const tapped = getLastTap();
    return {
      challenge: `Hear two stories, then: ${askFor(item)}`,
      expected: `${item.target.name} tapped — both ${item.sharedBehavior}.`,
      observed: tapped ? `Tapped ${tapped.name}.` : 'Tapped a friend who is not alike.',
    };
  },
});
