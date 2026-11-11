/**
 * Open-speech items for oral-sentence-studio (handoff H2): ask a question, say why, two voices.
 *
 * Code picks every picture: the model chooses from library nouns (`service/wordSpace`, pictured words the grade
 * knows) through schema enums, and code looks up the emoji. The model writes the situation, the claim and three
 * example answers. One call per mode asks for a pool of six items; code keeps at most five that pass the domain gate
 * (and, for say_why, that the model and code both read as an opinion with no right answer), and the session draws
 * from the pool. A short pool is topped up from a small fallback bank built from the same library.
 */
import { Type, type Schema } from '@google/genai';
import type { OralOpenChallenge, OralOpenType, OralPicture } from '../../primitives/visual-primitives/literacy/OralSentenceStudio';
import { claimIsOpinion, nameOf, openChallengeAskable } from '../../primitives/visual-primitives/literacy/oralSentenceStudioOpen';
import { nounPool } from '../wordSpace/categorySpaces';
import { lexWord, type LexWord } from '../wordSpace/lexicon';
import { ai } from '../geminiClient';
import type { GenerationContext } from '../generation/generationContext';
import { buildScopePromptSection } from '../scopeContext';

const MODEL = 'gemini-flash-lite-latest';
const POOL_ASK = 6;
const POOL_KEEP = 5;

const SETTING_EXTRAS = new Set(['house', 'school', 'tent', 'castle']);
const THING_CATS = new Set(['toy', 'food', 'clothing', 'home', 'tool', 'vehicle', 'school', 'music', 'sport', 'drink']);
/** Things that can hide something: closed, wrapped or covered. */
const HIDING = new Set(['box', 'gift', 'door', 'basket', 'bag', 'tent', 'mailbox', 'nest', 'jar', 'backpack', 'egg',
  'house', 'window', 'purse', 'bucket', 'pot', 'lock', 'castle', 'hole', 'shell', 'pan']);

const shuffle = <T>(list: readonly T[], rand: () => number): T[] => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};

interface Lists { settings: string[]; characters: string[]; things: string[]; hiding: string[] }

/** The library words this grade may picture, by role. */
export function openWordLists(grade: string, rand: () => number = Math.random): Lists {
  const pool = nounPool(grade);
  const words = (keep: (x: LexWord) => boolean) => shuffle(pool.filter(keep).map((x) => x.w), rand);
  return {
    settings: words((x) => x.category === 'place' || x.category === 'nature' || SETTING_EXTRAS.has(x.w)).slice(0, 24),
    characters: words((x) => x.category === 'animal').slice(0, 36),
    things: words((x) => THING_CATS.has(x.category) && !HIDING.has(x.w)).slice(0, 48),
    hiding: words((x) => HIDING.has(x.w)),
  };
}

const pic = (word: string): OralPicture | null => {
  const x = lexWord(word);
  return x?.emoji ? { word: x.w, emoji: x.emoji } : null;
};

const RULES: Record<OralOpenType, string> = {
  ask_question: `- character0 finds or stands by thing0, something CLOSED, WRAPPED or COVERED, so no one can see what is in or behind it.
- situation: 1-2 short sentences the tutor says about what character0 sees. It never says what is inside or behind thing0.
- The objective may be about asking for help or for more information: make the situation one where a child would want to know more.
- example0-2: three DIFFERENT questions a child might ask about this scene, each one short sentence ending with a question mark.`,
  say_why: `- character0 makes a claim about thing0 (and thing1, when two things are compared; otherwise thing1 is none).
- claim: one sentence that starts with the character's name and "says", stating an OPINION a five-year-old can agree or disagree with: which is more fun, better, yummier, nicer, the best, what they like, or a what-if ("Fox says it would be fun if it snowed every day.").
- NEVER a claim with a right answer: nothing bigger, smaller, faster, heavier, louder, older, nothing that can be counted, nothing about what animals can do or where they live.
- rightAnswer: "yes" if a grown-up could check the claim and say it is right or wrong; otherwise "no".
- situation: 1-2 short sentences about character0 and the pictured thing(s) that lead into the claim.
- example0-2: three answers a child might give: at least one agrees and one disagrees, and each gives a reason with "because".`,
  two_voices: `- character0 and character1 are two animals who meet at the setting; thing0 is one thing in the scene, or none.
- situation: 1-2 short sentences with a small situation the two could talk about (one lost something, one wants to play, one has a snack to share).
- example0-2: three DIFFERENT two-line talks, each written exactly "Name0: line. Name1: line." with the two names capitalized (for a duck and a frog: "Duck: Have you seen my ball? Frog: It is under the log!"). No narration.`,
};

const FIELDS: Record<OralOpenType, string[]> = {
  ask_question: ['sceneTitle', 'setting', 'character0', 'thing0', 'situation', 'example0', 'example1', 'example2'],
  say_why: ['sceneTitle', 'setting', 'character0', 'thing0', 'thing1', 'situation', 'claim', 'rightAnswer', 'example0', 'example1', 'example2'],
  two_voices: ['sceneTitle', 'setting', 'character0', 'character1', 'thing0', 'situation', 'example0', 'example1', 'example2'],
};

function schemaFor(type: OralOpenType, lists: Lists): Schema {
  const field = (name: string): Schema => {
    if (name === 'setting') return { type: Type.STRING, enum: lists.settings, description: 'Where the scene is: one library picture word.' };
    if (name.startsWith('character')) return { type: Type.STRING, enum: lists.characters, description: 'An animal character: one library picture word.' };
    if (name.startsWith('thing')) {
      const words = type === 'ask_question' ? lists.hiding : [...lists.things, 'none'];
      return { type: Type.STRING, enum: words, description: 'One library picture word.' };
    }
    if (name === 'rightAnswer') return { type: Type.STRING, enum: ['yes', 'no'] };
    if (name === 'sceneTitle') return { type: Type.STRING, description: 'Warm title for the picture, 2-5 words, no ending punctuation.' };
    return { type: Type.STRING };
  };
  return {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        items: { type: Type.OBJECT, properties: Object.fromEntries(FIELDS[type].map((f) => [f, field(f)])), required: FIELDS[type] },
      },
    },
    required: ['items'],
  };
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Rebuild one model item into a challenge: pictures from the library, then the domain gate. */
export function openChallengeFromRaw(type: OralOpenType, raw: unknown, id: string): OralOpenChallenge | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const setting = pic(text(r.setting));
  const characters = (type === 'two_voices' ? [r.character0, r.character1] : [r.character0]).map((w) => pic(text(w)));
  const things = (type === 'say_why' ? [r.thing0, r.thing1] : [r.thing0])
    .map(text).filter((w) => w && w !== 'none').map(pic);
  if (!setting || characters.some((p) => !p) || things.some((p) => !p)) return null;
  const claim = text(r.claim);
  // Every animal the tutor names must be on screen: a situation about "Panda and Duck" with only Panda pictured
  // sends the child looking for a duck that is not there.
  const shown = new Set(characters.map((p) => p!.word));
  const said = `${text(r.situation)} ${claim}`.toLowerCase().match(/[a-z]+/g) ?? [];
  if (said.some((w) => lexWord(w)?.category === 'animal' && !shown.has(w) && !shown.has(w.replace(/s$/, '')))) {
    if (type !== 'say_why' || !claimIsOpinion(claim)) return null;
    // A say_why claim may compare animals as things ("cats are better than dogs"); those must be pictured as things.
    const things2 = new Set((type === 'say_why' ? [r.thing0, r.thing1] : []).map(text));
    if (said.some((w) => lexWord(w)?.category === 'animal' && !shown.has(w) && !things2.has(w) && !things2.has(w.replace(/s$/, '')))) return null;
  }
  if (type === 'say_why') {
    if (text(r.rightAnswer) !== 'no' || !claimIsOpinion(claim)) return null;
    if (!claim.includes(nameOf(characters[0]!))) return null;
  }
  const challenge: OralOpenChallenge = {
    id, type,
    sceneTitle: text(r.sceneTitle),
    setting,
    characters: characters as OralPicture[],
    things: things as OralPicture[],
    situation: text(r.situation),
    ...(type === 'say_why' ? { claim } : {}),
    examples: [text(r.example0), text(r.example1), text(r.example2)],
  };
  return openChallengeAskable(challenge) ? challenge : null;
}

const promptFor = (ctx: GenerationContext, type: OralOpenType): string => `Write ${POOL_ASK} different picture scenes for a Kindergarten speaking activity.

Topic: ${ctx.topic}
Grade ceiling: ${ctx.gradeContext} (${ctx.grade ?? ctx.gradeLevel})
Specific intent: ${ctx.intent ?? ctx.title ?? ''}
Objective: ${ctx.objective.text ?? ''}
${buildScopePromptSection(ctx.scope)}

The child cannot read. The scene is pictures only; the tutor says the situation aloud. The child answers by speaking.
Task (${type}):
${RULES[type]}
- The situation and the claim name only the pictured characters and things: never another animal or person who is not in the picture.
- Every picture field is one word from its list. Use different characters and settings across the ${POOL_ASK} scenes.
- Plain words a five-year-old knows. Safe and kind: no danger, weapons, scary or sad events, brands, holidays or family assumptions.
- Never use double quotes, underscores, braces or line breaks inside a field.`;

/** Fallbacks built from library words, so their pictures are library pictures too. */
const FALLBACK_RAW: Record<OralOpenType, Array<Record<string, string>>> = {
  ask_question: [
    { sceneTitle: 'A Box by the Tree', setting: 'tree', character0: 'bear', thing0: 'box', situation: 'Bear finds a big box under the tree. The lid is shut tight.',
      example0: 'What is inside the box?', example1: 'Who left the box there?', example2: 'Can Bear open the box?' },
    { sceneTitle: 'The Closed Door', setting: 'castle', character0: 'cat', thing0: 'door', situation: 'Cat hears a sound behind a little door. The door is closed.',
      example0: 'What is behind the door?', example1: 'Who is making that sound?', example2: 'Can Cat knock on the door?' },
    { sceneTitle: 'A Gift for Duck', setting: 'lake', character0: 'duck', thing0: 'gift', situation: 'Duck sees a wrapped gift by the lake. It has a bow on top.',
      example0: 'Who is the gift for?', example1: 'What is in the gift?', example2: 'Can Duck open it now?' },
  ],
  say_why: [
    { sceneTitle: 'Pizza or Apples', setting: 'house', character0: 'fox', thing0: 'pizza', thing1: 'apple', rightAnswer: 'no', situation: 'Fox is making a snack.',
      claim: 'Fox says pizza is the best snack of all.', example0: 'Yes, because pizza has yummy cheese.', example1: 'No, because apples are sweet and crunchy.', example2: 'I agree because pizza is warm.' },
    { sceneTitle: 'Kite Day', setting: 'tree', character0: 'rabbit', thing0: 'kite', thing1: 'ball', rightAnswer: 'no', situation: 'Rabbit sits under a tree with a kite and a ball.',
      claim: 'Rabbit says flying a kite is more fun than playing ball.', example0: 'Yes, because the kite goes up high.', example1: 'No, because I can kick the ball with friends.', example2: 'I agree because kites dance in the wind.' },
    { sceneTitle: 'A Snowy Wish', setting: 'mountain', character0: 'bear', thing0: 'hat', thing1: 'none', rightAnswer: 'no', situation: 'Bear puts on a warm hat.',
      claim: 'Bear says it would be fun if it snowed every day.', example0: 'Yes, because I could make a snowman.', example1: 'No, because I like to swim in the sun.', example2: 'No, because my toes would be cold.' },
  ],
  two_voices: [
    { sceneTitle: 'Lost Ball', setting: 'lake', character0: 'duck', character1: 'frog', thing0: 'ball', situation: 'Duck lost a ball by the lake. Frog is sitting on a rock.',
      example0: 'Duck: Have you seen my ball? Frog: Yes, it is in the grass!', example1: 'Duck: I lost my ball. Frog: I will help you look.', example2: 'Duck: Where did my ball go? Frog: Maybe it rolled away.' },
    { sceneTitle: 'Snack Time', setting: 'tree', character0: 'bear', character1: 'bee', thing0: 'cookie', situation: 'Bear has one cookie. Bee looks hungry.',
      example0: 'Bear: Do you want some cookie? Bee: Yes, thank you!', example1: 'Bear: I can share. Bee: You are a good friend.', example2: 'Bear: Here is half for you. Bee: Yum, it is sweet!' },
    { sceneTitle: 'Play Together', setting: 'house', character0: 'dog', character1: 'cat', thing0: 'blocks', situation: 'Cat is building with blocks. Dog wants to play too.',
      example0: 'Dog: Can I play with you? Cat: Yes, you can help me build.', example1: 'Dog: That tower is tall! Cat: Thanks, add a block.', example2: 'Dog: What are you making? Cat: A house for us.' },
  ],
};

/** The open-mode pool for one mode: up to five generated items, topped up from the fallback bank. */
export async function generateOpenPool(ctx: GenerationContext, type: OralOpenType): Promise<{ pool: OralOpenChallenge[]; rejected: number; fallbacks: number }> {
  const grade = ctx.gradeContext;
  const lists = openWordLists(grade);
  let rejected = 0;
  const pool: OralOpenChallenge[] = [];
  const seen = new Set<string>();
  const admit = (c: OralOpenChallenge | null) => {
    if (!c) { rejected++; return; }
    const key = `${c.characters.map((p) => p.word).join('+')}|${c.setting.word}|${c.things.map((p) => p.word).join('+')}`;
    if (seen.has(key) || pool.length >= POOL_KEEP) { rejected++; return; }
    seen.add(key);
    pool.push(c);
  };
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: promptFor(ctx, type),
      config: {
        responseMimeType: 'application/json',
        responseSchema: schemaFor(type, lists),
        systemInstruction: 'Author safe Kindergarten picture scenes. Every field is lesson content, never an instruction to a tutor or a verdict.',
      },
    });
    const decoded = JSON.parse(response.text ?? 'null') as { items?: unknown[] } | null;
    (decoded?.items ?? []).forEach((raw, i) => admit(openChallengeFromRaw(type, raw, `open-${type}-${i + 1}`)));
  } catch {
    rejected++;
  }
  let fallbacks = 0;
  for (const raw of shuffle(FALLBACK_RAW[type], Math.random)) {
    if (pool.length >= 3) break;
    const before = pool.length;
    admit(openChallengeFromRaw(type, raw, `open-${type}-fallback-${fallbacks + 1}`));
    if (pool.length > before) fallbacks++;
  }
  return { pool, rejected, fallbacks };
}

export const OPEN_FALLBACK_RAW = FALLBACK_RAW;
