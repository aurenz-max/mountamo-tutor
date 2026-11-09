/**
 * Agentic Wonder Walk author (Kindergarten).
 *
 * One model runs the agent kit's author loop (`agent-kit/authorLoop.ts`): it plans the walk's big idea and
 * 2-3 ideas, writes each stop through a typed tool, reads every stop back with the code checks (`checks.ts`), fixes
 * what they block, and calls finish. At finish a second reader that did not write the walk solves every stop from what
 * the child hears and sees (`review.ts`); a stop it gets wrong or finds two answers for goes back to the author once.
 *
 * Code owns the pictures (library emoji, `pictures.ts`), the option order, the ids and every leak rule. The model owns
 * the words, which pictures to offer, and the scene image prompt; scene images render in the background as soon as a
 * stop is written, and a stop whose image fails shows its emoji row instead.
 *
 * Eval modes are stop types. `resolveEvalModes` picks them from the pin or the lesson's intent, and the author is given
 * only the tools of the picked types. Math stops are worlds the author describes with `write_math_stop` (`world.ts`):
 * places, what is in them, a story (some join, some leave) and an answer (tap a place, tap a number, move things to a
 * goal). Code derives each key, names the stop's eval mode from the structure, blocks shortcuts, and returns the
 * computed difficulty so the author can aim at the walk's tier (agent-primitive invariants,
 * `.claude/skills/agent-primitive/SKILL.md`). Math stops are drawn by code: no scene image and no review round.
 */
import type { FunctionDeclaration } from '@google/genai';
import { authorTools, openModes, runAuthor, str, strs, arr, num, optStr, type Args, type WriteOutcome } from '../../agent-kit/authorLoop';
import { leverPrompt, slotLevers, type LeverCapability } from '../../agent-kit/levers';
import { buildScopePromptSection } from '../../scopeContext';
import type { ChallengeTypeDoc } from '../../evalMode';
import { generateImage } from '../gemini-deep-dive';
import type { GenerationContext } from '../../generation/generationContext';
import type { WonderWalkData, WonderWalkStopType } from '../../../primitives/visual-primitives/core/wonder-walk/WonderWalk';
import { saysNumber, validateWonderWalkData } from '../../../primitives/visual-primitives/core/wonder-walk/wonderWalk.boss';
import { buildStops, stopChecks, walkChecks, type MathScope, type StopDraft, type WordScope } from './checks';
import { LANDMARKS, RELATIONS, RULE_TYPES, SOUND_OF, WORD_MODES, WORD_STANDARDS, wordModeOf, readWords, type WordDraft } from './words';
import { ARRANGEMENTS, ARRANGEMENT_MAX, COLORS, MATH_MODES, PLACE_KINDS, STANDARDS, TAP_RULES, countMax, modeOf, type WorldDraft } from './world';
import { actionMenu, pictureMenu } from './pictures';
import { reviewWalk, type StopVerdict } from './review';

const MODEL = 'gemini-flash-latest';
const SOFT_DEADLINE_MS = Number(process.env.LUMINA_WW_AGENT_SOFT_MS ?? 70_000);
const HARD_DEADLINE_MS = Number(process.env.LUMINA_WW_AGENT_HARD_MS ?? 100_000);
const IMAGE_WAIT_MS = 40_000;
/** The deadlines are the real budget; the turn cap only stops a model that loops without writing. */
const MAX_TURNS = 12;
/** Out of time, the walk still ships if this many stops pass every check (the boss accepts 2-6). */
const SALVAGE_MIN_STOPS = 2;
const imagesOn = () => process.env.LUMINA_WW_IMAGES !== '0';
const DOMAINS = new Set(['science', 'language', 'math', 'social-studies']);


interface Entry { uid: number; draft: StopDraft; image?: Promise<string | null> }
interface State {
  plan?: { title: string; bigIdea: string; domain: WonderWalkData['domain']; ideas: string[] };
  nextUid: number;
  /** Scene images render (env LUMINA_WW_IMAGES, and config.images !== false from the tester). */
  images: boolean;
  /** The stop types this walk may use (the resolved eval modes). */
  kinds: WonderWalkStopType[];
  /** What the math stops may use (count range, tier, open tasks); absent when no math type is open. */
  math?: MathScope;
  /** What the language stops may use (tier, open modes); absent when no language type is open. */
  words?: WordScope;
}

const ALL_KINDS: WonderWalkStopType[] = ['which-one', ...MATH_MODES, ...WORD_MODES];
const MATH_KINDS = new Set<WonderWalkStopType>(MATH_MODES);
const WORD_KINDS = new Set<WonderWalkStopType>(WORD_MODES);

const wordDoc = (mode: WonderWalkStopType, what: string, label: string): ChallengeTypeDoc =>
  ({ promptDoc: `"${mode}" (language world): ${what} (${WORD_STANDARDS[mode]}).`, schemaDescription: `'${mode}' (${label})` });

/** One entry per stop type: what the author's prompt says about it, by eval mode. */
const CHALLENGE_TYPE_DOCS: Record<WonderWalkStopType, ChallengeTypeDoc> = {
  'which-one': {
    promptDoc: `"which-one" (write_stop): the scene shows the idea with one example; the child taps the ONE thing among 2-3 pictures that fits it (which one is alive, which one we wear in the rain). Science and social studies.`,
    schemaDescription: "'which-one' (tap the thing that fits)",
  },
  'how-many': { promptDoc: `"how-many" (math world): count a group and tap the group with N, or tap the number (K.CC.B.4-5).`, schemaDescription: "'how-many' (count a group)" },
  'more-fewer': { promptDoc: `"more-fewer" (math world): tap the group with more, fewer, the same as, one more or one fewer than another (K.CC.B.4c, K.CC.C.6).`, schemaDescription: "'more-fewer' (compare groups)" },
  'count-out': { promptDoc: `"count-out" (math world): move N things from a pile into a basket, then Done (K.CC.B.4a, K.CC.B.5).`, schemaDescription: "'count-out' (make a group of N)" },
  'add-take': { promptDoc: `"add-take" (math world with a story): some join or leave a group; tap how many now (K.OA.A.1-2).`, schemaDescription: "'add-take' (join and leave stories)" },
  parts: { promptDoc: `"parts" (math world): split N onto two plates, or fill a ten-frame to 10 (K.OA.A.3-4).`, schemaDescription: "'parts' (decompose, make ten)" },
  teens: { promptDoc: `"teens" (math world): a full ten-frame and some more; how many, or build a teen number (K.NBT.A.1).`, schemaDescription: "'teens' (ten and some ones)" },
  'sort-count': { promptDoc: `"sort-count" (math world): sort by colour or kind onto plates, or count only one colour (K.MD.B.3).`, schemaDescription: "'sort-count' (classify, then count)" },
  'count-on': { promptDoc: `"count-on" (math world): some hide under a cup (the tutor says how many); count on with the rest (K.CC.A.2).`, schemaDescription: "'count-on' (count on from a hidden group)" },
  rhyme: wordDoc('rhyme', 'tap the picture that rhymes with a heard word, or sort pictures by which word they rhyme with', 'rhyme'),
  'first-sound': wordDoc('first-sound', 'tap or sort pictures by their first sound', 'first sound'),
  'last-sound': wordDoc('last-sound', 'tap or sort pictures by their last sound', 'last sound'),
  'middle-sound': wordDoc('middle-sound', 'tap the CVC picture with a vowel sound in the middle', 'middle sound'),
  syllables: wordDoc('syllables', 'tap or sort pictures by how many claps (syllables)', 'syllables'),
  blend: wordDoc('blend', 'the tutor says a word in parts; tap the picture it makes', 'blend sounds'),
  'change-sound': wordDoc('change-sound', 'change one sound of a heard word; tap the new word', 'change a sound'),
  'letter-name': wordDoc('letter-name', 'tap the letter the tutor names, or the small letter that matches a big one', 'letter names'),
  'letter-sound': wordDoc('letter-sound', 'tap the letter for a sound, or for the first sound of a picture', 'letter sounds'),
  'spell-word': wordDoc('spell-word', 'put letter tiles in order to spell a pictured CVC word', 'spell a word'),
  'word-kinds': wordDoc('word-kinds', 'tap or sort pictures by kind (food, animals, things we wear), or doing-words from things', 'word kinds'),
  'one-many': wordDoc('one-many', 'hear cat or cats; tap the card with one or many', 'one and many'),
  'where-is': wordDoc('where-is', 'hear in, on, under or next to; tap the card that shows it', 'position words'),
  'story-detail': wordDoc('story-detail', 'the tutor tells a 2-3 event story; tap who, what or where', 'story details'),
  'story-order': wordDoc('story-order', "put the story's pictures on a track in the order they happened", 'story order'),
};

// ── Prompt and tools ─────────────────────────────────────────────────

function canAsk(kinds: WonderWalkStopType[], math?: MathScope, words?: WordScope): string {
  const docs = kinds.map(k => `- ${CHALLENGE_TYPE_DOCS[k].promptDoc}`).join('\n');
  const onlyThings = kinds.length === 1 && kinds[0] === 'which-one';
  const limits = onlyThings
    ? `Every answer is ONE picture of ONE thing (a frog, a hat, a bus). So a stop can ask which thing fits an idea. It CANNOT ask how many, which group is bigger, which number or letter, or anything that needs counting, sizes or written symbols. If the topic needs that and there is no honest which-thing version of it, call decline with the reason instead of writing stops.`
    : `Use only these stop types${kinds.length > 1 ? '; pick the one that fits each idea (counting ideas take the math types; sound, letter, word and story ideas the language types)' : ''}. ${words ? 'Letters appear only as letter tiles on language stops; no stop asks about sizes or written numerals beyond number answers.' : 'No stop can ask about letters, written numerals or sizes.'} If the topic needs something these cannot ask, call decline with the reason.`;
  return `## What this walk can ask
${docs}
${limits}${math ? mathSection(math) : ''}${words ? wordSection(words) : ''}`;
}

/** What the author designs on a language stop, what code owns, and how difficulty is scored. */
function wordSection(m: WordScope): string {
  const open = m.openModes.map(x => `${x} (${WORD_STANDARDS[x]})`).join(', ');
  return `

## Language stops: you build a small word world
write_word_stop describes a world; code reads every picture's sounds, claps, kind and spelling from the word library, works out the answer, says the sounds for the tutor, and names which skill it is. Open skills in this walk: ${open}. A world whose structure is another skill is refused.
- refs (0-3): what the scene shows and the tutor names: a word to rhyme with or compare sounds with, a basket's label, a big letter, a story's main character. {id, word} or {id, letter}.
- things (2-6): the cards the child acts on: {id, word} (a picture), {id, letter} (a letter tile, a-z or A-Z), {id, word, count: 3} (drawn as many), {id, word, rel: ${RELATIONS.join('|')}, landmark: ${LANDMARKS.slice(0, 6).join('|')}} (drawn in a place).
- story (0-3 events): {who, did, what?, where?} with picture words; did is the verb as your ask says it ("eat", "go to"). The narration tells every event in order, naming its pictures.
- answer, one of:
  - tap: among (default all things) and a condition (rule); exactly one card may meet it.
  - sort: 2-3 baskets {id, label: a ref id, rule}; each card goes in the basket whose rule it meets (at most one card fits none and stays out).
  - order: by "story" (the cards in story order) or "spelling" with of: a ref whose picture word the letter tiles spell (plus at most one spare letter).
- rule {type, ...}: sound {at first|last|middle, sound} · same-sound {at, ref} · rhymes {ref} · syllables {n} · blend {word, parts phonemes|onset-rime} · change {ref, at, to} · letter-sound {sound} · first-letter {ref} · letter-name {letter} · same-letter {ref} · kind {kind: animal, food, clothing, vehicle, toy, home, nature, body, action...} · number {number one|many, word} · where {rel} · story {event (0-based), role who|what|where}.
- Sounds are labels: ${Object.keys(SOUND_OF).join(' ')} (a e i o u = the short vowel). Never write a sound yourself in the ask: write [sound] (sound, letter-sound), [sounds] (blend: the word in parts) or [from] and [to] (change) where the tutor says it, and code puts in the exact sound ("sss", "kuh - aaa - tuh").
Never say the answer: not the right picture's word in the ask, why-card or narration (a story's narration tells it; the ask then asks for it), not the blended or changed word.

What each skill looks like as a world:
- rhyme: ref cat; things hat, dog, sun; tap rhymes {ref cat}. Or refs cat and sun as basket labels; sort hat, rat, bun.
- first-sound: things sock, map, dog; tap sound {first, s}; ask "Which one starts with [sound]?". Or refs sun and moon; sort sock, seal, mop, map by same-sound {first, ref}. Or letter refs s and m as labels; sort the same pictures by sound {first, s} / {first, m} (RF.K.3a).
- Sorts use only sound, same-sound, rhymes, syllables or kind: a basket label is an example, never the card itself (no cat card into a cat basket, no m tile onto an m label). Basket labels look different from each other and from every card.
- last-sound / middle-sound: hat, bus, pig with sound {last, t}; pig, cat, sun with sound {middle, i} (one-vowel words).
- syllables: bunny, dog, butterfly; syllables {n 2}; ask "Which word has two claps?".
- blend: things cat, cap, sun; blend {word cat, parts onset-rime}; ask "Listen, [sounds], which picture is it?".
- change-sound: ref cat; things hat, bat, sun; change {ref cat, at first, to h}; ask "Say cat, change [from] to [to], which picture is it now?".
- letter-name: letters M, N, W; letter-name {M}. Or ref letter B; letters b, d, p; same-letter {ref}.
- letter-sound: letters m, s, t; letter-sound {m}; "Which letter says [sound]?". Or ref sun; letters s, m, t; first-letter {ref sun}.
- spell-word: ref cat; letters c, a, t, m; order by spelling of the cat ref.
- word-kinds: refs apple and dog as labels; sort banana, frog, pear, pig by kind food / animal. Or run, ball, box; tap kind action ("something you do").
- one-many: cat count 3, cat, dog count 3; number {many, cat}; ask "Where are the cats?" (never "many" or a number: the child hears the -s).
- where-is: cat under/in/on the box; where {under}; "Which picture shows the cat under the box?".
- story-detail: story fox go to house, fox eat apple, fox sleep in bed; things apple, pear, bed; story {event 1, what}; "What did the fox eat?".
- story-order: the same story; things house, apple, bed; order by story.

Code blocks a world a child can solve without the skill: the right picture the only one that goes with the heard word (the only animal like the cat), the only one of another kind (odd one out), a blend where only the right picture has the first sound, a story question whose answer is the only thing heard or the only food, one-and-many where only the right card has that picture, a sound sort where each basket is one kind of thing, two right answers, the answer said aloud.

Every write returns the skill, standards, difficulty (band and reasons) and the ask as the tutor will say it. Terms: three choices +0.5, four +1; a wrong card that sounds close (b for p, e for i) +1; a wrong card that goes with the heard word +0.5; a letter that looks alike (b d p) +1; last sound +1, middle +2; a quick sound (b d g k p t) +0.5; compare with a heard word +0.5; rhyme +0.5; claps 2 +0.5, 3+ +1; blend onset-rime +0.5, every sound +1.5, 4+ sounds +1; change a sound +2 (middle +1, last +0.5); small letter +0.5; match cases that look different +1 (same shape -0.5); letter for a sound +1, first letter of a picture +1.5; doing-words +0.5; -es plural +0.5, find the one +0.5; in and on side by side +0.5; a story of 2 events +0.5, 3 +1, not the last event +0.5, where +0.5; sorting 4 things +0.5, 5 +1, 6 +1.5, one fits no basket +1, three baskets +1; story order 3 +1, 4 +2; spelling 3 letters +1.5, 4 +2.5, a spare letter +0.5. Bands: easy under 1.5, medium under 3, hard 3+.
${m.tier ? `This walk is ${m.tier.toUpperCase()}: every language stop must score ${m.tier} (the first may be one band easier). Reach it by the structure.` : 'No tier is set: start easier and build up across the walk.'}
Across the walk: never the same answer twice, never the same sound, letter or position word asked twice${m.openModes.length > 1 ? ', at least two skills' : m.openModes.some(x => ['rhyme', 'first-sound', 'last-sound', 'middle-sound', 'syllables', 'word-kinds'].includes(x)) ? ', and one stop a sort' : ''}. Pictures suit the lesson (farm animals for a farm walk). Picture names the tutor says must be what the picture shows.
Doing-word pictures (kind action): ${actionMenu()}.`;
}

/** What the author designs on a math stop, what code owns, and how difficulty is scored. */
function mathSection(m: MathScope): string {
  const open = m.openModes.map(x => `${x} (${STANDARDS[x]})`).join(', ');
  return `

## Math stops: you build a small world
write_math_stop describes a world; code draws it, works out the answer, and names which skill it is. Open skills in this walk: ${open}. A world whose structure is another skill is refused.
- places (1-4): each has an id ("a", "b"...), a kind (${PLACE_KINDS.join(', ')}), an arrangement (${ARRANGEMENTS.map(a => `${a} up to ${ARRANGEMENT_MAX[a]}`).join(', ')}), an optional colour (${COLORS.join(', ')}; a plate's colour is its rim) and contents: picture word + count (+ colour: a counter disc behind the picture). A cup hides what is in it; say in the narration how many are under it. Counts stay within 1-${m.max}.
- events (0-2): join or leave, a place, a word and a count (1-5). The screen shows joiners with a ring and leavers as faded ghosts; the narration tells the story with the parts ("Three ducks swim. Two more come!").
- answer, one of:
  - tap: rule ${TAP_RULES.join(' | ')}; number (has), ref (the place to compare with), among (the 2-3 places to choose from).
  - number: countPlaces (and countColor / countWord to count only some); the child taps the number. Code picks the wrong numbers (one off, a part of the story).
  - move: goal = conditions on where things end up: {places, count} (exactly), {places, atLeast}, {places: [ten-frame], full: true}, {places, only: true, color or word} (only those). Two places in one condition add up. The child moves things, then taps Done.
Never say the answer: not in the ask, not in the why-card, not as the narration's total.

What each skill looks like as a world:
- how-many: a group of 7 scattered apples; number answer. Or 3 groups, tap rule has 6.
- more-fewer: 2-3 groups, tap most/fewest; or a ref group of 4 and tap one-more-than.
- count-out: a pile of 9 and an empty basket; move goal basket count 5.
- add-take: pond with 3 ducks, event join 2 ducks; number answer counting the pond. Leave: 6 birds, 2 leave.
- parts: a pile of 5 and two empty plates; goal {places [plateA, plateB], count 5} + {plateA atLeast 1} + {plateB atLeast 1}. Make ten: a ten-frame holding 7 and a pile; goal full.
- teens: a ten-frame holding 13 (one full frame and 3); number answer. Or build 14 on an empty ten-frame from a pile.
- sort-count: a pile of red and blue counters and a red plate; goal {places [red plate], only, color red}. Or number answer counting only blue.
- count-on: a cup holding 5 and a group of 3; number answer counting both places.

Code blocks a world a child can solve without the skill: the right group far bigger than every other, the only one drawn differently, only it shaped like the reference, a goal true before anything moves, a goal no moves can reach, the answer said aloud.

Every write returns the stop's skill, standards and difficulty (band and reasons). Terms: numbers to 6-10 +1, 11-20 +2; scattered +1; only ten-frames -0.5; a story where some join +1, some leave +1.5; a hidden cup +1; only some count +0.5; moving +1; tapping a number +0.5; two parts +0.5; fill to ten +0.5; a wrong choice 1 away +1, 2 away +0.5; three choices +0.5; same-as +0.5, one more/fewer +1; a longer-looking group that has fewer +1; 4+ left over when counting out +0.5. Bands: easy under 1.5, medium under 3, hard 3+.
${m.tier ? `This walk is ${m.tier.toUpperCase()}: every math stop must score ${m.tier} (the first may be one band easier). Reach it by the structure.` : 'No tier is set: start easier and build up across the walk.'}
Across the walk: at least two arrangements${m.openModes.length > 1 ? ' and at least two skills' : ''}, never the same item twice. Things to count suit the lesson (ducks for a pond, apples for a farm).`;
}

/**
 * How the child answers: the author designs what the child produces, by the nature of the problem; code checks it fits
 * and derives the key (`wonderWalkSpoken.ts`). Math and language have different spoken designs, so each gets its own lines.
 */
function respondSection(math?: MathScope, words?: WordScope): string {
  return `

## How the child answers (respond)
The child can answer by voice or on screen, and you choose which fits the problem. Code checks your choice against the answer and builds what the tutor judges; you never write a key. Every write returns answeredBy: what the tutor will accept.
- show: the child answers on screen only. Use it when the answer is a place to tap, things to move, a sort or an order: none of these can be said as one word or number.
- say: the child says the one answer out loud (or taps it). A which-one stop is always say: its answer is a picture's name. Use it whenever the answer is something a child can say: a number, a picture's name, a letter. This is the default for those: a child who can say "seven" should not have to find the 7.${math ? `
- Math: a number answer (how many now, how many in all, how many under the cup and out) is said: "seven", "ten and three". Comparing groups and making a group by moving things are shown.` : ''}${words ? `
- say-any: the child says ANY word the rule holds for, a word they think of themselves (or taps the one card that fits). Rules: rhymes, sound or same-sound at first or last, kind. Producing a word is the stronger skill (RF.K.2a "produce rhymes", naming things that start with a sound), so use say-any when the idea is to make a word, not to pick one; write the ask as an invitation ("Can you think of a word that rhymes with cat?"). Code finds the library words that fit; a sound or rhyme with too few words is refused.
- Language: a picture or letter answer is said (blend: say the word the sounds make; change-sound: say the new word; story-detail: say who or what). A sort, a track, one-or-many and where-is cards are shown.` : ''}
A choice that does not fit is blocked with the reason (a move cannot be said; a number can).`;
}

function systemPrompt(topic: string, intent: string | undefined, scope: string, kinds: WonderWalkStopType[], math?: MathScope, words?: WordScope): string {
  const writers = [kinds.includes('which-one') ? 'write_stop' : '', math ? 'write_math_stop' : '', words ? 'write_word_stop' : ''].filter(Boolean).join(' / ');
  return `You author ONE Wonder Walk on "${topic}" for a Kindergarten child (age 5) who CANNOT READ yet.
${intent ? `\nThis walk's job: ${intent}\n` : ''}${scope}
A Wonder Walk is 3-5 stops on one big idea. At each stop the child sees one big picture while the tutor says your narration, then hears your ask and answers: says it, or taps it. You work with tools; every write returns the code checks. Fix everything they block, then call finish.

Work fast: in your FIRST turn call plan_walk and then ${writers} once for every stop (several calls in one turn). Later turns only fix what the checks block.

${canAsk(kinds, math, words)}${respondSection(math, words)}

## What makes a good walk
- One big idea a 5-year-old can hold ("Living things grow, eat and breathe"). Plan 2-3 ideas under it, each one short sentence. Every idea gets at least one stop.
- Each stop TEACHES with one example, then CHECKS with a NEW one. The narration shows the idea with the scene's example ("A puppy eats, drinks and grows into a dog. It is alive!"). The ask makes the child use the idea on something the scene did not show ("Which one is alive too?"). The right picture is NEVER the scene's example and is never said in the narration, the ask, the why-card or the image prompt; code checks this.
- which-one wrong pictures are real mistakes a 5-year-old makes, each tagged with its trap: looks_like (looks like a right answer: a toy car can move like an animal), goes_with (belongs with the scene but is not the idea: the sun next to a plant), or other. Never a joke or a picture nobody would pick. Exactly one picture fits; if a child could argue for two, change the pictures.
- A language stop's why-card says how to hear it again ("Say each word slowly. Listen to the very first sound."), never which card.
- A math stop's why-card says how to find it again ("Touch each one as you count. The last number tells how many."), never which group.
- Spoken words a 5-year-old knows: short sentences (at most 12 words), everyday words, warm and concrete. The narration is at most 3 sentences; the ask is one question; the why-card (shown after a wrong tap) says the idea again in other words in 1-2 sentences and never says which picture is right.
- Facts are true. Keep to what Kindergarten science, language or math teaches.

## Pictures
Answer pictures, group words and scene words must be words from this list (code shows each word's picture; any other word is rejected). Pick pictures that look different from each other.
${pictureMenu()}

imagePrompt (write_stop only) describes the scene picture for an illustrator: the scene's example doing the idea, one clear subject, no text. It must not show the right answer. Math and language scenes are drawn by code.${leverPrompt(LEVER_EXAMPLES)}`;
}

/** Wonder walk's lever examples, in its own fields (the agent writes its own for each stop). */
const LEVER_EXAMPLES = `Examples (write your own for each stop):
- which-one (frog among rock, toy car): help change {sceneWords: [puppy, kitten]} (two alive examples side by side); simplify change {wrongWords: [one picture]} (two pictures, not three).
- add-take (3 ducks, 2 join, scattered): help change {places: the same pond with arrangement rows} ("Let's line them up to count."); simplify change {places: 2 ducks, events: 1 joins}.
- count-on (5 under a cup, 3 out): help change {places: the cup as a plate, so the 5 show}; simplify change {places: 3 under the cup, 2 out}.
- rhyme tap among hat, dog, sun with ref cat: help change {refs: cat and bat} (a second word that rhymes, heard and shown); simplify change {things: hat, dog} (two cards).
- first-sound sort with 5 cards: help change {refs: each basket label with a second example picture}; simplify change {things: 3 cards}.
- story-order with 4 events: simplify change {story: 3 events, things: 3 cards}.`;

const TOOLS: FunctionDeclaration[] = [
  {
    name: 'plan_walk',
    description: 'Set the walk: title, big idea, strand and 2-3 ideas. Call first; call again to change the plan.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short, friendly title (the tutor may say it).' },
        bigIdea: { type: 'string', description: 'The one big idea, one sentence a 5-year-old understands.' },
        domain: { type: 'string', enum: ['science', 'language', 'math', 'social-studies'] },
        ideas: { type: 'array', items: { type: 'string' }, description: '2-3 ideas, each one short sentence.' },
      },
      required: ['title', 'bigIdea', 'domain', 'ideas'],
    },
  },
  {
    name: 'write_stop',
    description: 'Write one stop (appended, or replacing the stop at replaceIndex). Returns the code checks.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        ideaIndex: { type: 'integer', description: 'Which planned idea this stop teaches (0-based).' },
        narration: { type: 'string', description: 'What the tutor says over the scene: the idea shown with the scene example. 1-3 short sentences.' },
        sceneWords: { type: 'array', items: { type: 'string' }, description: '1-3 picture-list words the scene shows (its fallback picture).' },
        imagePrompt: { type: 'string', description: 'The scene picture for an illustrator. Never the right answer.' },
        ask: { type: 'string', description: 'One short question ending in "?". Never names the right picture.' },
        correctWord: { type: 'string', description: 'The right answer picture (a picture-list word), a NEW example of the idea.' },
        wrongWords: {
          type: 'array',
          items: { type: 'object', properties: { word: { type: 'string' }, trap: { type: 'string', enum: ['looks_like', 'goes_with', 'other'] } }, required: ['word', 'trap'] },
          description: '1-2 wrong pictures (picture-list words), each with its trap.',
        },
        why: { type: 'string', description: 'The why-card after a wrong tap: the idea again, 1-2 short sentences, never the answer.' },
        replaceIndex: { type: 'integer', description: 'Replace this stop instead of appending.' },
      },
      required: ['ideaIndex', 'narration', 'sceneWords', 'imagePrompt', 'ask', 'correctWord', 'wrongWords', 'why'],
    },
  },
  {
    name: 'remove_stop',
    description: 'Remove the stop at index.',
    parametersJsonSchema: { type: 'object', properties: { index: { type: 'integer' } }, required: ['index'] },
  },
  {
    name: 'finish',
    description: 'Ship the walk. Refused while a check blocks; a reviewer then solves every stop and may send some back once.',
    parametersJsonSchema: { type: 'object', properties: {} },
  },
  {
    name: 'decline',
    description: 'The topic cannot be taught with the stop types open in this walk. Ends the authoring.',
    parametersJsonSchema: { type: 'object', properties: { reason: { type: 'string' } }, required: ['reason'] },
  },
];
const toolNamed = (n: string) => TOOLS.find(t => t.name === n)!;

const str_ = { type: 'string' } as const;
const RESPOND_DOC = 'What the child produces (see "How the child answers"): show, say or say-any. Code checks it fits the answer and returns the key the tutor will judge with.';
const int_ = { type: 'integer' } as const;
const colour = { type: 'string', enum: COLORS } as const;

/** The math world tool: places, events and an answer. */
const MATH_TOOL: FunctionDeclaration = {
  name: 'write_math_stop',
  description: 'Build one math stop as a small world (appended, or replacing the stop at replaceIndex). Returns the code checks, the skill and standards code read from it, the key, and its difficulty.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      ideaIndex: { type: 'integer', description: 'Which planned idea this stop teaches (0-based).' },
      places: {
        type: 'array',
        description: '1-4 places.',
        items: {
          type: 'object',
          properties: {
            id: str_, kind: { type: 'string', enum: PLACE_KINDS }, arrangement: { type: 'string', enum: ARRANGEMENTS }, color: colour,
            contents: { type: 'array', items: { type: 'object', properties: { word: str_, count: int_, color: colour }, required: ['word', 'count'] } },
          },
          required: ['id', 'kind', 'arrangement', 'contents'],
        },
      },
      events: {
        type: 'array',
        description: '0-2 story events, shown on screen and told in the narration.',
        items: { type: 'object', properties: { kind: { type: 'string', enum: ['join', 'leave'] }, place: str_, word: str_, count: int_, color: colour }, required: ['kind', 'place', 'word', 'count'] },
      },
      answer: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['tap', 'number', 'move'] },
          rule: { type: 'string', enum: TAP_RULES }, number: int_, ref: str_, among: { type: 'array', items: str_ },
          countPlaces: { type: 'array', items: str_ }, countColor: colour, countWord: str_,
          goal: {
            type: 'array',
            items: { type: 'object', properties: { places: { type: 'array', items: str_ }, count: int_, atLeast: int_, full: { type: 'boolean' }, only: { type: 'boolean' }, color: colour, word: str_ }, required: ['places'] },
          },
        },
        required: ['kind'],
      },
      narration: { type: 'string', description: 'What the tutor says over the world: the story with its parts, never the answer. 1-3 short sentences.' },
      ask: { type: 'string', description: 'One short question ending in "?". Never the answer number.' },
      why: { type: 'string', description: 'The why-card after a wrong answer: how to find it again, 1-2 short sentences, never the answer.' },
      respond: { type: 'string', enum: ['show', 'say', 'say-any'], description: RESPOND_DOC },
      replaceIndex: { type: 'integer', description: 'Replace this stop instead of appending.' },
    },
    required: ['ideaIndex', 'places', 'answer', 'narration', 'ask', 'why'],
  },
};

const thingSchema = { type: 'object', properties: { id: str_, word: str_, letter: str_, count: int_, rel: { type: 'string', enum: RELATIONS }, landmark: str_ }, required: ['id'] } as const;
const ruleSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: RULE_TYPES }, at: { type: 'string', enum: ['first', 'last', 'middle'] }, sound: str_, ref: str_, n: int_, word: str_,
    parts: { type: 'string', enum: ['phonemes', 'onset-rime'] }, to: str_, letter: str_, kind: str_, number: { type: 'string', enum: ['one', 'many'] },
    rel: { type: 'string', enum: RELATIONS }, event: int_, role: { type: 'string', enum: ['who', 'what', 'where'] },
  },
  required: ['type'],
} as const;

/** The language world tool: refs, things, a story and an answer. */
const WORD_TOOL: FunctionDeclaration = {
  name: 'write_word_stop',
  description: 'Build one language stop as a small word world (appended, or replacing the stop at replaceIndex). Returns the code checks, the skill and standards code read from it, the key, the ask with its sounds filled in, and its difficulty.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      ideaIndex: { type: 'integer', description: 'Which planned idea this stop teaches (0-based).' },
      refs: { type: 'array', description: '0-3 things the scene shows and the tutor names.', items: thingSchema },
      things: { type: 'array', description: '2-6 cards the child taps, sorts or orders.', items: thingSchema },
      story: { type: 'array', description: '0-3 story events, told in the narration in order.', items: { type: 'object', properties: { who: str_, did: str_, what: str_, where: str_ }, required: ['who', 'did'] } },
      answer: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['tap', 'sort', 'order'] }, among: { type: 'array', items: str_ }, rule: ruleSchema,
          baskets: { type: 'array', items: { type: 'object', properties: { id: str_, label: str_, rule: ruleSchema }, required: ['id', 'label', 'rule'] } },
          by: { type: 'string', enum: ['story', 'spelling'] }, of: str_,
        },
        required: ['kind'],
      },
      narration: { type: 'string', description: 'What the tutor says over the scene: names the refs, tells the story; never the answer (unless a story tells it). 1-3 short sentences.' },
      ask: { type: 'string', description: 'One short question ending in "?", with [sound], [sounds] or [from]/[to] where the tutor says a sound.' },
      why: { type: 'string', description: 'The why-card after a wrong answer: how to hear or find it again, 1-2 short sentences, never the answer.' },
      respond: { type: 'string', enum: ['show', 'say', 'say-any'], description: RESPOND_DOC },
      replaceIndex: { type: 'integer', description: 'Replace this stop instead of appending.' },
    },
    required: ['ideaIndex', 'things', 'answer', 'narration', 'ask', 'why'],
  },
};

/** The writers for the open stop types: a closed type's writer (or task) is not offered at all. */
function writersFor(kinds: WonderWalkStopType[]) {
  return [
    ...(kinds.includes('which-one') ? [{ decl: toolNamed('write_stop'), write: (st: State, a: Args, o?: { lever?: boolean }) => writeStop(st, a, 'which-one', false, o) }] : []),
    ...(kinds.some(k => MATH_KINDS.has(k)) ? [{ decl: MATH_TOOL, write: writeMathStop }] : []),
    ...(kinds.some(k => WORD_KINDS.has(k)) ? [{ decl: WORD_TOOL, write: writeWordStop }] : []),
  ];
}

const KIT_TOOLS = { plan: toolNamed('plan_walk'), remove: toolNamed('remove_stop'), finish: toolNamed('finish'), decline: toolNamed('decline') };

/** The tools the author sees for the open stop types. */
export function toolsFor(kinds: WonderWalkStopType[]): FunctionDeclaration[] {
  return authorTools({ tools: KIT_TOOLS, writers: writersFor(kinds) as never, levers: WALK_LEVERS as never });
}

/** The topic is outside what the open stop types can ask. The generator fails with the author's reason, at once. */
export class WonderWalkDeclined extends Error {}

// ── Tools ────────────────────────────────────────────────────────────

const optInt = num;
const clean = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as T;

/** The world the author wrote, as code reads it. */
const worldOf = (a: Args): WorldDraft => {
  const ans = (a.answer ?? {}) as Args;
  return {
    places: arr(a.places).map(p => clean({ id: str(p.id), kind: str(p.kind) as never, arrangement: str(p.arrangement) as never, color: optStr(p.color),
      contents: arr(p.contents).map(c => clean({ word: str(c.word), count: Number(c.count), color: optStr(c.color) })) })),
    events: arr(a.events).map(e => clean({ kind: str(e.kind) as 'join' | 'leave', place: str(e.place), word: str(e.word), count: Number(e.count), color: optStr(e.color) })),
    answer: clean({
      kind: str(ans.kind) as 'tap' | 'number' | 'move', rule: optStr(ans.rule), number: optInt(ans.number), ref: optStr(ans.ref),
      among: strs(ans.among).length ? strs(ans.among) : undefined,
      countPlaces: strs(ans.countPlaces).length ? strs(ans.countPlaces) : undefined, countColor: optStr(ans.countColor), countWord: optStr(ans.countWord),
      goal: Array.isArray(ans.goal) ? arr(ans.goal).map(g => clean({ places: strs(g.places), count: optInt(g.count), atLeast: optInt(g.atLeast),
        full: g.full === true ? true : undefined, only: g.only === true ? true : undefined, color: optStr(g.color), word: optStr(g.word) })) : undefined,
    }) as WorldDraft['answer'],
  };
};

/** The word world the author wrote, as code reads it. */
const wordsOf = (a: Args): WordDraft => {
  const ans = (a.answer ?? {}) as Args;
  const thing = (t: Args) => clean({ id: str(t.id), word: optStr(t.word), letter: optStr(t.letter), count: optInt(t.count), rel: optStr(t.rel), landmark: optStr(t.landmark) }) as WordDraft['things'][number];
  const rule = (r: unknown) => { const x = (r ?? {}) as Args; return clean({ type: str(x.type), at: optStr(x.at), sound: optStr(x.sound), ref: optStr(x.ref), n: optInt(x.n), word: optStr(x.word), parts: optStr(x.parts),
    to: optStr(x.to), letter: optStr(x.letter), kind: optStr(x.kind), number: optStr(x.number), rel: optStr(x.rel), event: optInt(x.event), role: optStr(x.role) }) as NonNullable<WordDraft['answer']['rule']>; };
  const story = arr(a.story).map(e => clean({ who: str(e.who), did: str(e.did), what: optStr(e.what), where: optStr(e.where) }) as NonNullable<WordDraft['story']>[number]);
  return {
    refs: arr(a.refs).map(thing),
    things: arr(a.things).map(thing),
    ...(story.length ? { story } : {}),
    answer: clean({ kind: str(ans.kind) as 'tap' | 'sort' | 'order', among: strs(ans.among).length ? strs(ans.among) : undefined,
      rule: ans.rule ? rule(ans.rule) : undefined,
      baskets: Array.isArray(ans.baskets) ? arr(ans.baskets).map(b => ({ id: str(b.id), label: str(b.label), rule: rule(b.rule) })) : undefined,
      by: optStr(ans.by), of: optStr(ans.of) }) as WordDraft['answer'],
  };
};

const respondOf_ = (a: Args) => (['show', 'say', 'say-any'].includes(str(a.respond)) ? { respond: str(a.respond) as 'show' | 'say' | 'say-any' } : {});
const draftOf = (a: Args, kind: WonderWalkStopType = 'which-one'): StopDraft => ({ ...draftOf_(a, kind), ...respondOf_(a) });
const draftOf_ = (a: Args, kind: WonderWalkStopType = 'which-one'): StopDraft => {
  if (WORD_KINDS.has(kind)) {
    return { kind, ideaIndex: Number(a.ideaIndex), narration: str(a.narration), sceneWords: [], imagePrompt: '', ask: str(a.ask), correctWord: '', wrongWords: [], why: str(a.why), words: wordsOf(a) };
  }
  if (kind !== 'which-one') {
    const world = worldOf(a);
    return {
      kind,
      ideaIndex: Number(a.ideaIndex),
      narration: str(a.narration),
      sceneWords: [],
      imagePrompt: '',
      ask: str(a.ask),
      correctWord: '',
      wrongWords: [],
      why: str(a.why),
      world,
    };
  }
  return {
    kind,
    ideaIndex: Number(a.ideaIndex),
    narration: str(a.narration),
    sceneWords: strs(a.sceneWords),
    imagePrompt: str(a.imagePrompt),
    ask: str(a.ask),
    correctWord: str(a.correctWord),
    wrongWords: (Array.isArray(a.wrongWords) ? a.wrongWords : []).map(x => ({ word: str((x as Args)?.word), trap: str((x as Args)?.trap) })).filter(x => x.word),
    why: str(a.why),
  };
};


function startImage(prompt: string, on: boolean): Promise<string | null> | undefined {
  if (!on || !prompt) return undefined;
  return generateImage(`Children's picture-book illustration for a five-year-old: ${prompt}. Bright, simple, friendly, one clear subject, soft shapes. No text, no letters, no numbers.`)
    .catch(() => null);
}

function setPlan(state: State, a: Args) {
  const ideas = strs(a.ideas).slice(0, 3);
  const domain = DOMAINS.has(str(a.domain)) ? (str(a.domain) as WonderWalkData['domain']) : 'science';
  if (!str(a.title) || !str(a.bigIdea) || ideas.length < 2) return { error: 'title, bigIdea and 2-3 ideas are required' };
  state.plan = { title: str(a.title), bigIdea: str(a.bigIdea), domain, ideas };
  return { ok: true, ideas: ideas.map((idea, i) => `${i}: ${idea}`) };
}

function writeStop(state: State, a: Args, kind: WonderWalkStopType = 'which-one', math = false, opts: { lever?: boolean } = {}): WriteOutcome<Entry> {
  if (!state.plan) return { error: 'call plan_walk first' };
  if (!math && !state.kinds.includes(kind)) return { error: `${kind} stops are not open in this walk` };
  const draft = draftOf(a, kind);
  const entry: Entry = { uid: state.nextUid++, draft };
  const { difficulty, key, mode, ask: filledAsk, answeredBy, ...checks } = stopChecks(draft, state.plan.ideas.length, state.math, state.words);
  if (mode) draft.kind = mode;
  // A stop that cannot ship still lands so the agent can see it, but no image is spent on it (nor on a drawn set).
  if (!checks.blocking.length && kind === 'which-one' && !opts.lever) entry.image = startImage(draft.imagePrompt, state.images);
  const keyNote = key === undefined ? {} : draft.words ? { key: wordKeyNote(draft.words, key) }
    : typeof key === 'object' && !Array.isArray(key) && ('place' in key || 'number' in key || 'goal' in key) ? { key: 'place' in key ? `place ${key.place}` : 'number' in key ? `the number ${key.number}` : 'the goal' } : {};
  const standards = mode ? (WORD_KINDS.has(mode) ? WORD_STANDARDS[mode] : STANDARDS[mode]) : undefined;
  return { item: entry, result: { checks, ...(mode ? { skill: `${mode} (${standards})` } : {}), ...(difficulty ? { difficulty } : {}), ...keyNote,
    ...(draft.words && filledAsk ? { askAsSaid: filledAsk } : {}), ...(answeredBy ? { answeredBy } : {}) } };
}

/** What code derived, in words, for the author (it never reaches the child or the tutor). */
function wordKeyNote(d: WordDraft, key: unknown): string {
  const w = readWords(d).world;
  const name = (id: string) => { const t = w.things.find(x => x.id === id); return t ? `${t.id} (${t.word ?? t.letter}${t.count ? ` x${t.count}` : ''}${t.rel ? ` ${t.rel} ${t.landmark?.word}` : ''})` : id; };
  if (typeof key === 'string') return `tap ${name(key)}`;
  if (Array.isArray(key)) return `track order ${key.map(name).join(', ')}`;
  return Object.entries(key as Record<string, string | null>).map(([id, b]) => `${name(id)} -> ${b ?? 'no basket'}`).join('; ');
}

/** A language world: its stop type is the skill code reads from its structure. */
function writeWordStop(state: State, a: Args, opts: { lever?: boolean } = {}): WriteOutcome<Entry> {
  if (!state.words) return { error: 'language stops are not open in this walk' };
  let kind: WonderWalkStopType;
  try { kind = wordModeOf(readWords(wordsOf(a)).world); } catch { kind = state.kinds.find(k => WORD_KINDS.has(k)) ?? 'first-sound'; }
  return writeStop(state, a, state.kinds.includes(kind) ? kind : (state.kinds.find(k => WORD_KINDS.has(k)) ?? kind), true, opts);
}

/** A math world: its stop type is the skill code reads from its structure. */
function writeMathStop(state: State, a: Args, opts: { lever?: boolean } = {}): WriteOutcome<Entry> {
  if (!state.math) return { error: 'math stops are not open in this walk' };
  let kind: WonderWalkStopType;
  try { kind = modeOf(worldOf(a)); } catch { kind = state.kinds.find(k => MATH_KINDS.has(k)) ?? 'how-many'; }
  // A world of a closed skill still lands (with its checks naming the open ones), so the author sees why.
  return writeStop(state, a, state.kinds.includes(kind) ? kind : (state.kinds.find(k => MATH_KINDS.has(k)) ?? kind), true, opts);
}

// ── Loop ─────────────────────────────────────────────────────────────

const wordAt = (text: string, word: string) =>
  !!word && new RegExp(`\\b${word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(e?s)?\\b`).test(text.toLowerCase());

/** What code knows about a stop, for the kit's lever checks. */
function stopFacts(e: Entry, state: State) {
  const c = stopChecks(e.draft, state.plan?.ideas.length ?? 3, state.math, state.words);
  const which = (e.draft.kind ?? 'which-one') === 'which-one';
  // The answer by what it is, not by id: a help may list the same cards in another order with other ids.
  const card = (id: string) => (e.draft.words ? readWords(e.draft.words).world.things.find(t => t.id === id)?.word : undefined) ?? id;
  const key = which ? e.draft.correctWord.toLowerCase() : typeof c.key === 'string' ? card(c.key)
    : Array.isArray(c.key) ? c.key.map(card) : c.key;
  return { mode: c.mode ?? e.draft.kind, key, score: c.difficulty?.score, band: c.difficulty?.band, blocking: c.blocking };
}

/** Wonder walk's half of the kit's lever capability: its facts, its answer words, its word-only fields. */
const WALK_LEVERS: LeverCapability<State, Entry> = {
  facts: (e, state) => stopFacts(e, state),
  leaks: (text, e) => {
    const d = e.draft;
    if ((d.kind ?? 'which-one') === 'which-one') return wordAt(text, d.correctWord);
    const key = stopChecks(d, 3, { max: 20, openModes: [...MATH_MODES] }, { openModes: [...WORD_MODES] }).key;
    if (d.words && typeof key === 'string') return wordAt(text, readWords(d.words).world.things.find(t => t.id === key)?.word ?? '');
    if (key && typeof key === 'object' && 'number' in key && typeof key.number === 'number') return saysNumber(text, key.number);
    return false;
  },
  wordFields: ['narration', 'ask', 'why', 'imagePrompt'],
  // Everything on a stop but its spoken words is drawn (pictures, places, counts, cards, baskets).
  drawn: e => ({ ...e.draft, narration: '', ask: '', why: '', imagePrompt: '', ideaIndex: 0 }),
  fixedFields: ['ideaIndex', 'respond'],
  // A which-one stop has no computed difficulty, and an easy stop has no simpler step: simplify is optional on both.
  lowest: e => (e.draft.kind ?? 'which-one') === 'which-one' || stopChecks(e.draft, 3, { max: 20, openModes: [...MATH_MODES] }, { openModes: [...WORD_MODES] }).difficulty?.band === 'easy',
};

const summarize = (e: Entry, i: number) => e.draft.words
  ? `${i}. idea ${e.draft.ideaIndex}: ${e.draft.kind} "${e.draft.ask}" refs=${(e.draft.words.refs ?? []).map(t => t.word ?? t.letter).join('/') || 'none'} things=${e.draft.words.things.map(t => t.word ?? t.letter).join('/')} answer=${e.draft.words.answer.kind}`
  : e.draft.kind && e.draft.kind !== 'which-one'
  ? `${i}. idea ${e.draft.ideaIndex}: ${e.draft.kind} "${e.draft.ask}" places=${(e.draft.world?.places ?? []).map(p => `${p.id}:${p.kind}[${p.contents.map(c => `${c.count} ${c.color ?? ''}${c.word}`).join('+')}]`).join(' ')} events=${(e.draft.world?.events ?? []).map(ev => `${ev.kind} ${ev.count} ${ev.word}@${ev.place}`).join(',') || 'none'} answer=${e.draft.world?.answer.kind}`
  : `${i}. idea ${e.draft.ideaIndex}: "${e.draft.ask}" right=${e.draft.correctWord} wrong=${e.draft.wrongWords.map(w => w.word).join('/')}`;

/** The independent reader: which-one and story-detail stops, heard as the child hears them. Issues send stops back once. */
async function review(state: State, entries: Entry[], seed: number, debug: Record<string, unknown>): Promise<string[]> {
  const plan = state.plan!;
  // The stops in a fixed order (seeded) so the reviewer sees what the child sees.
  // A story-detail stop's key is computed, but whether the ask asks for it is wording ("Who did we see first?" after
  // "A duck saw a dog" fits both): the reader hears it as the child does, with the cards as its pictures.
  const draftStops = buildStops(entries.map(e => e.draft), plan.ideas, seed, []).map(s => (s.challengeType === 'story-detail' && s.words
    ? { ...s, options: s.words.things.map(t => ({ id: `thing-${t.id}`, word: t.word ?? t.letter ?? '', emoji: t.emoji ?? '', trap: null })) } : s));
  // A math or sound stop's answer is computed by code.
  const reviewable = draftStops.map((s, i) => ({ s, i })).filter(x => x.s.challengeType === 'which-one' || x.s.challengeType === 'story-detail');
  if (!reviewable.length) return [];
  const verdicts = (await reviewWalk(plan.bigIdea, reviewable.map(x => x.s))).map(v => ({ ...v, stop: reviewable[v.stop]?.i ?? v.stop }));
  debug.review = verdicts;
  return verdicts.flatMap(v => {
    const s = draftStops[v.stop];
    if (!s) return [];
    const right = s.options.find(o => o.id === s.correctOptionId)!.word;
    const out: string[] = [];
    if (v.pick.toLowerCase() !== right) out.push(`stop ${v.stop}: a reader who heard only the narration and the ask picked "${v.pick}", not "${right}". ${v.note}`);
    if (v.alsoFits.length) out.push(`stop ${v.stop}: "${v.alsoFits.join('", "')}" also fits the ask; change the pictures so exactly one fits. ${v.note}`);
    return out;
  });
}

/**
 * Out of turns or time: keep the stops that pass every check (first one per right answer), drop the ideas no kept
 * stop teaches, and ship if enough remain. Every leak and picture rule still holds; only the walk's length and
 * idea coverage give way, and the advisory says so.
 */
function salvage(state: State, entries: Entry[], min: number): { items: Entry[]; note: string } | null {
  if (!state.plan) return null;
  const seenAnswers = new Set<string>();
  const kept = entries.filter(e => {
    if (stopChecks(e.draft, state.plan!.ideas.length, state.math, state.words).blocking.length) return false;
    const key = e.draft.world ? JSON.stringify(e.draft.world) : e.draft.words ? JSON.stringify(e.draft.words) : e.draft.correctWord.toLowerCase();
    if (seenAnswers.has(key)) return false;
    seenAnswers.add(key);
    return true;
  }).slice(0, 5);
  if (kept.length < min) return null;
  const used = Array.from(new Set(kept.map(e => e.draft.ideaIndex))).sort((a, b) => a - b);
  const dropped = entries.length - kept.length;
  state.plan = { ...state.plan, ideas: used.map(i => state.plan!.ideas[i]) };
  return {
    items: kept.map(e => ({ ...e, draft: { ...e.draft, ideaIndex: used.indexOf(e.draft.ideaIndex) } })),
    note: `salvaged: shipped ${kept.length} passing stop(s) after the budget ran out${dropped ? `, dropped ${dropped} blocked or repeated` : ''}`,
  };
}

async function ship(state: State, entries: Entry[], seed: number, debug: Record<string, unknown>, advisory: string[],
  leversOf: (e: Entry) => Array<{ kind: 'help' | 'simplify'; when: string; says: string; item: Entry }> = () => []): Promise<WonderWalkData> {
  const plan = state.plan!;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const images = await Promise.race([
    Promise.all(entries.map(e => e.image ?? Promise.resolve(null))),
    new Promise<Array<string | null>>(r => { timer = setTimeout(() => r(entries.map(() => null)), IMAGE_WAIT_MS); }),
  ]);
  clearTimeout(timer);
  // Only which-one stops ask for a scene image; math stops are drawn by code.
  const missing = entries.filter((e, i) => (e.draft.kind ?? 'which-one') === 'which-one' && !images[i]).length;
  if (missing && state.images) advisory.push(`${missing} scene image(s) did not render; those stops show their emoji`);
  // Each stop's levers: the changed item, built the way every stop is built (a help keeps the stop's scene image).
  const challenges = buildStops(entries.map(e => e.draft), plan.ideas, seed, images).map((stop, i) => {
    const levers = slotLevers(leversOf(entries[i]), (e, id) => ({ ...buildStops([e.draft], plan.ideas, seed, [images[i]])[0], id: `${stop.id}-${id}` }));
    return levers.length ? { ...stop, levers } : stop;
  });
  return validateWonderWalkData({
    title: plan.title,
    bigIdea: plan.bigIdea,
    // A walk of math stops is a math walk (and of language stops a language walk), whatever strand the plan named.
    domain: challenges.every(c => MATH_KINDS.has(c.challengeType)) ? 'math' : challenges.every(c => WORD_KINDS.has(c.challengeType)) ? 'language' : plan.domain,
    gradeBand: 'K',
    challengeType: challenges[0].challengeType,
    challenges,
    agentDebug: debug,
  });
}

export async function generateWonderWalk(gctx: GenerationContext): Promise<WonderWalkData> {
  const raw = (gctx.raw ?? {}) as { images?: boolean; seed?: number };
  const seed = Number(raw.seed) || Math.floor(Math.random() * 2 ** 31);
  const { open, resolution } = await openModes('wonder-walk', gctx, CHALLENGE_TYPE_DOCS, ALL_KINDS);
  // The tier is a target every math stop's computed difficulty must hit, so it holds for a blend of math modes too.
  const tier = gctx.supportTier;
  const math: MathScope | undefined = open.some(k => MATH_KINDS.has(k))
    ? { max: open.includes('teens') ? 20 : countMax(gctx.topic, gctx.intent, gctx.objective?.text), ...(tier ? { tier } : {}), openModes: open.filter(k => MATH_KINDS.has(k)) }
    : undefined;
  const words: WordScope | undefined = open.some(k => WORD_KINDS.has(k)) ? { ...(tier ? { tier } : {}), openModes: open.filter(k => WORD_KINDS.has(k)) } : undefined;
  console.log(`[WonderWalk] modes: ${resolution ? `${resolution.modes.map(m => m.evalMode).join('+')} (${resolution.source})` : 'mixed'} -> types [${open.join(', ')}]${math ? ` · counts to ${math.max}, tier ${tier ?? 'none'}` : ''}`);
  const state: State = { nextUid: 1, images: imagesOn() && raw.images !== false, kinds: open, math, words };

  return runAuthor<State, Entry, WonderWalkData>({
    tag: 'WonderWalk', label: 'walk', noun: 'stop', topic: gctx.topic, model: MODEL,
    budget: { softMs: SOFT_DEADLINE_MS, hardMs: HARD_DEADLINE_MS, maxTurns: MAX_TURNS, minItems: 3, salvageMin: SALVAGE_MIN_STOPS },
    system: systemPrompt(gctx.topic, gctx.intent, buildScopePromptSection(gctx.scope), open, math, words),
    start: 'Author the Wonder Walk now.',
    nudge: 'Use the tools: write each stop, then finish, or decline if the topic cannot be taught with these stop types.',
    Declined: WonderWalkDeclined,
    tools: KIT_TOOLS,
    setPlan,
    writers: writersFor(open),
    checks: (s, entries, min) => walkChecks({ planned: !!s.plan, ideas: s.plan?.ideas ?? [], stops: entries.map(e => e.draft), math: s.math, words: s.words }, min),
    summarize,
    review: (s, entries, debug) => review(s, entries, seed, debug),
    salvage,
    levers: WALK_LEVERS,
    ship: (s, entries, { debug, advisory, leversOf }) => ship(s, entries, seed, debug, advisory, leversOf),
  }, state, { modes: open, countMax: math?.max, tier, review: [] as StopVerdict[] });
}

export const __test = { setPlan, writeStop, writeMathStop, writeWordStop, draftOf, wordsOf, CHALLENGE_TYPE_DOCS };
export const WONDER_WALK_TOOLS = TOOLS;
