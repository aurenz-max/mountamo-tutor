/**
 * Grammar frames on di-spoken-practice (handoff H1, K Language Arts audit families GR8, GR9, GR15, GR16): a picture,
 * a heard sentence with one word missing, and the child says the word. Code builds every item from the word
 * library's grammar spaces (`service/wordSpace/grammarSpaces.ts`) — the sentence, the key, the wrong forms, the
 * correction, the model card and the easier item. The only model call is `pickGrammarFrames`, which reads which
 * frames of the mode the objective names (a/an or a/the); it never writes an item.
 *
 * The ask says the two choices at the easy tier. Agreement and tense frames say them on every tier: without them the
 * sentence cannot name its verb ("run or runs") except by saying one of the answers.
 */
import { Type, type Schema } from '@google/genai';
import { ai } from '../geminiClient';
import { mulberry32, tierPick } from '../wordSpace/pick';
import { filledSentence, grammarSpace, type FrameItem, type GrammarFrame } from '../wordSpace/grammarSpaces';
import { clampGradeToK2 } from '../scopeContext';
import {
  deriveResponseClass, HOW_TO_PLAY, type GrammarFrameMode, type GrammarModel, type SpokenPracticeItem,
} from '../../primitives/visual-primitives/direct-instruction/diSpokenPracticeScript';

type Tier = 'easy' | 'medium' | 'hard';

/** The frames each mode can serve, with the words the frame picker reads. */
export const MODE_FRAMES: Record<GrammarFrameMode, ReadonlyArray<{ frame: GrammarFrame; doc: string }>> = {
  article_choice: [
    { frame: 'a_an', doc: 'a or an before a noun, chosen by its first sound ("It is ... apple." -> an)' },
    { frame: 'a_the', doc: 'a for a thing named for the first time, the for one already named (definite vs indefinite)' },
  ],
  pronoun_choice: [
    { frame: 'he_she', doc: 'he or she for one pictured person (singular pronouns only)' },
    { frame: 'he_she_they', doc: 'he, she or they for a person or a group; also replacing a noun with a pronoun' },
    { frame: 'possessive', doc: 'his, her or their for whose thing it is (possessive pronouns)' },
    { frame: 'subject_object', doc: 'she/her, he/him, they/them by where the word goes (subject vs object pronouns)' },
  ],
  verb_form: [
    { frame: 'present_agreement', doc: 'present tense verb that agrees with one or more ("The dogs ... fast." -> run)' },
    { frame: 'be_ing', doc: 'is, are or am before an -ing action word (helping verbs, continuous actions)' },
  ],
  verb_tense: [
    { frame: 'past_regular', doc: 'past vs present with regular -ed verbs (walked / walk)' },
    { frame: 'past_irregular', doc: 'irregular past forms matched to the present (ran / run, went / go)' },
    { frame: 'future_will', doc: 'future with will vs the past (will walk / walked)' },
  ],
};

/**
 * Which of the mode's frames the objective asks for. One frame needs no call; no objective text means all frames
 * (broad practice of the mode). A failed call falls back to every frame: the mode itself was already resolved.
 */
export async function pickGrammarFrames(mode: GrammarFrameMode, objectiveText?: string, intent?: string): Promise<GrammarFrame[]> {
  const options = MODE_FRAMES[mode];
  const all = options.map((o) => o.frame);
  const signal = [objectiveText, intent].filter(Boolean).join(' — ').trim();
  if (options.length === 1 || !signal) return all;
  const schema: Schema = {
    type: Type.OBJECT,
    properties: { frames: { type: Type.ARRAY, items: { type: Type.STRING, enum: all } } },
    required: ['frames'],
  };
  try {
    const result = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: `A kindergarten spoken grammar lesson. Which of these sentence frames does the objective ask the child to practise?
OBJECTIVE: "${signal}"
FRAMES:
${options.map((o) => `- ${o.frame}: ${o.doc}`).join('\n')}
Return every frame the objective names, and only those. A frame that adds forms the objective does not name (they when it names only he and she) is not one of them.`,
      config: { responseMimeType: 'application/json', responseSchema: schema, maxOutputTokens: 256, httpOptions: { timeout: 20000 } },
    });
    const picked = (JSON.parse(result.text || '{}').frames ?? []) as string[];
    const frames = all.filter((f) => picked.includes(f));
    return frames.length ? frames : all;
  } catch (error) {
    console.warn('[DiSpokenPractice] frame pick failed; using every frame of the mode:', error);
    return all;
  }
}

const shuffle = <T,>(list: T[], rand: () => number): T[] => {
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
};

function askFor(sentence: string, menu: readonly string[] | null): string {
  const tail = menu ? `What word fits: ${menu[0]} or ${menu[1]}?` : 'What word fits?';
  return `Look at this picture and listen. ${sentence} ${tail}`;
}

function toItem(it: FrameItem, mode: GrammarFrameMode, id: string, menuSpoken: boolean, rand: () => number): SpokenPracticeItem {
  const p = it.payload;
  const menu = rand() < 0.5 ? [p.answer, p.wrong[0]] : [p.wrong[0], p.answer];
  const spoken = menuSpoken || p.menuAlways;
  const ask = askFor(p.sentence, spoken ? menu : null);
  return {
    id, targetId: `${p.frame}:${it.structure}:${it.words.join('+')}`,
    mode, action: mode, answerKind: 'voice',
    responseClass: spoken ? 'closed_set_choice' : deriveResponseClass(mode, p.answer, p.pictureLabel)!,
    stimulusKind: 'emoji', answerSource: 'recall',
    stimulusText: p.pictureLabel, stimulusEmoji: p.emoji, stimulusCount: 0,
    ...(spoken ? { choices: menu } : {}),
    ask, howToPlay: HOW_TO_PLAY[mode],
    expectedAnswer: p.answer, alternates: [], acceptRule: '',
    signatureError: `The learner ${p.miss}.`,
    correctionBody: `${filledSentence(p, p.answer)} ${p.rule}`,
    grammar: { frame: p.frame, sentence: p.sentence, wrong: p.wrong, menu, miss: p.miss, ...(p.noun ? { noun: p.noun } : {}), models: [] },
  };
}

/**
 * A session of `count` items over the frames: every answer group of every frame, round robin, each group tiered by
 * its own beta. Then each item gets its model card (one solved sentence per menu word) and an easier item, both
 * from words the session does not use. Null when the spaces cannot fill the session with the contrast intact.
 */
export function buildGrammarFrameItems(
  mode: GrammarFrameMode, frames: readonly GrammarFrame[], gradeLevel: string, tier: Tier, count: number, seed: number,
): SpokenPracticeItem[] | null {
  const grade = clampGradeToK2(/^k/i.test(gradeLevel) || /kinder/i.test(gradeLevel) ? 'K' : gradeLevel.replace(/[^0-9]/g, ''), 'K');
  const rand = mulberry32(seed);
  const spaces = new Map(frames.map((f) => [f, grammarSpace(f, grade)] as const));
  // Groups in frame order; a frame's groups alternate sides of its contrast (a, an; subject, object).
  const groups = frames.flatMap((f) => {
    const byGroup = new Map<string, FrameItem[]>();
    for (const it of spaces.get(f)!) byGroup.set(it.payload.group, [...(byGroup.get(it.payload.group) ?? []), it]);
    return shuffle(Array.from(byGroup.entries()), rand).map(([group, items]) => ({ frame: f, group, items }));
  });
  if (!groups.length) return null;
  // Interleave frames so a two-frame session holds both before it repeats one.
  const order = frames.flatMap((f) => groups.filter((g) => g.frame === f).map((g, i) => ({ g, i })))
    .sort((a, b) => a.i - b.i).map(({ g }) => g);
  const want = new Map<typeof order[number], number>();
  for (let k = 0; k < count; k++) want.set(order[k % order.length], (want.get(order[k % order.length]) ?? 0) + 1);
  const used = new Set<string>();
  const picked: FrameItem[] = [];
  for (const g of order) {
    const n = want.get(g) ?? 0;
    if (!n) continue;
    const got = tierPick(g.items, tier, n, rand, used);
    if (got.length < n) return null;
    picked.push(...got);
  }
  // Spread the groups through the session instead of answering a, a, an, an.
  const items = shuffle(picked, rand)
    .map((it, i) => toItem(it, mode, `dsp-${i + 1}`, tier === 'easy', rand));
  if (new Set(items.map((i) => i.expectedAnswer)).size < Math.min(2, groups.length)) return null;

  // Model cards and easier items: never the item's own words or a picture the session shows. They may repeat
  // across items (a narrow scope like he/she has few people), so they do not reserve words.
  const pictures = new Set(items.map((i) => i.stimulusEmoji));
  const free = (it: FrameItem, own: FrameItem) => !it.words.some((w) => own.words.includes(w)) && !pictures.has(it.payload.emoji)
    && it.payload.sentence !== own.payload.sentence;
  return items.map((item, k) => {
    const own = picked.find((it) => `${it.payload.frame}:${it.structure}:${it.words.join('+')}` === item.targetId)!;
    const all = spaces.get(own.payload.frame)!;
    const rot = <T,>(list: T[]) => list.length ? list[k % list.length] : undefined;
    // One solved sentence for each side of the contrast: the item's own group and the group of its likeliest wrong
    // form, each with other words, so the card shows the rule and never this item's answer in this sentence.
    const contrast = all.find((it) => it.payload.answer === own.payload.wrong[0])?.payload.group
      ?? all.find((it) => it.payload.group !== own.payload.group)?.payload.group;
    const models: GrammarModel[] = [own.payload.group, contrast].flatMap((g) => {
      const m = rot(all.filter((it) => it.payload.group === g && free(it, own)).sort((a, b) => a.beta - b.beta).slice(0, 4));
      return m ? [{ sentence: filledSentence(m.payload, m.payload.answer), answer: m.payload.answer, emoji: m.payload.emoji }] : [];
    });
    const easy = rot(all.filter((it) => free(it, own)).sort((a, b) => a.beta - b.beta).slice(0, 4));
    const easier = easy ? toItem(easy, mode, `${item.id}~simpler`, true, rand) : undefined;
    return { ...item, grammar: { ...item.grammar!, models: models.length === 2 ? models : [], ...(easier ? { easier } : {}) } };
  });
}

/** Every item is a frame of the session's mode with a code key, and the contrast is present. */
export function hasGrammarCoverage(items: readonly SpokenPracticeItem[], count: number): boolean {
  return items.length === count && items.every((i) => !!i.grammar && i.grammar.wrong.length > 0
    && !i.grammar.wrong.includes(i.expectedAnswer))
    && new Set(items.map((i) => i.expectedAnswer)).size >= 2;
}
