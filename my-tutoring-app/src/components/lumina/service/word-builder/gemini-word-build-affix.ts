/**
 * word-builder `build_affix` generator (open build, qa/open-build/ROADMAP.md OB-3L L1). The model writes a board of
 * prefixes, roots and suffixes with meanings, and asks that each name a MEANING ("Make a word that means to do
 * something again") with two or more board words that fit. Code keeps only askable items (`buildItemsFrom`): an ask
 * that names a passing word, or that fewer than two board words fit, is dropped. No key ships to the learner: the
 * examples are hidden and the shared judge reads whatever word is made.
 *
 * The scope follows the lesson grade (user ruling R11, 10-07): grade 1-2 gets short decodable roots and the common
 * affixes, older grades a wider set. No grade floor.
 */
import { Type, type Schema } from '@google/genai';
import { ai } from '../geminiClient';
import { buildItemsFrom, MAX_ASK_CHARS, type AffixBuildItem, type BuildPart } from '../../primitives/visual-primitives/literacy/affixBuild';
import type { WordBuilderData } from './gemini-word-builder';

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'A short, friendly title for the activity.' },
    parts: {
      type: Type.ARRAY, minItems: '8', maxItems: '14',
      items: { type: Type.OBJECT, properties: {
        id: { type: Type.STRING, description: "'pre-re', 'root-play', 'suf-ed'" },
        text: { type: Type.STRING, description: 'The part, lowercase letters only.' },
        type: { type: Type.STRING, enum: ['prefix', 'root', 'suffix'] },
        meaning: { type: Type.STRING, description: '1-3 plain words.' },
      }, required: ['id', 'text', 'type', 'meaning'] },
    },
    asks: {
      type: Type.ARRAY, minItems: '4', maxItems: '6',
      items: { type: Type.OBJECT, properties: {
        ask: { type: Type.STRING, description: 'One sentence naming a MEANING, never a word that answers it.' },
        examples: { type: Type.ARRAY, minItems: '2', maxItems: '5', items: { type: Type.STRING },
          description: "Board words that fit the ask, each as its part ids joined by '+': 'pre-re+root-play'." },
      }, required: ['ask', 'examples'] },
    },
  },
  required: ['title', 'parts', 'asks'],
};

const gradeOf = (grade: unknown): number => {
  const s = String(grade ?? '').toLowerCase();
  if (/\bk\b|kinder/.test(s)) return 0;
  const n = Number(s.replace(/[^0-9]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 2;
};

const bandFor = (g: number) => g <= 2
  ? `Grade 1-2 readers. Roots are short everyday words a grade 1-2 child can sound out (play, jump, help, kind, paint, fill, `
    + `lock, heat, view, tie, safe, slow). Prefixes from: un (not / opposite), re (again), pre (before). Suffixes from: ed `
    + `(in the past), ing (happening now), ly (in a way), ful (full of), er (one who).`
  : `Grade ${g} readers. Everyday roots, plus prefixes from un, re, pre, dis, mis, over and suffixes from ed, ing, ly, ful, `
    + `er, less, ness, able.`;

export async function generateAffixBuild(topic: string, gradeContext: string,
    config: { intent?: string; grade?: string; difficulty?: string } = {}): Promise<WordBuilderData> {
  const g = gradeOf(config.grade);
  const prompt = `Create a word-making activity about prefixes and suffixes for: "${topic}"
TARGET AUDIENCE: ${gradeContext}. ${bandFor(g)}
INTENT: ${config.intent || 'Make words by joining a prefix or suffix to a root'}

The child sees a board of word-part cards, each printed with its meaning, and taps cards into a row to MAKE a word for
each ask. Many words can be right, so every ask must have at least two different board words that fit it.

Rules (an item that breaks one is dropped):
1. Board: 8-14 parts. 2-3 prefixes, 2-4 suffixes, 4-7 roots. Lowercase letters only, at least 2 letters each.
2. Every example word is spelled EXACTLY by joining its parts in order, with no letter added, removed or changed
   (re+play = replay). Never a word that needs a spelling change at the join (happy+ly, hop+ing, care+ing).
3. Each ask is ONE sentence of at most ${MAX_ASK_CHARS} characters that describes a MEANING in a child's words: "Make a
   word that means to do something again." It never contains any word that would answer it, never names a part, and
   has no quotation marks. Each ask names a different meaning.
   ${g <= 2 ? 'Use only words a six-year-old says every day, at most 12 words, and say one plain meaning: "Make a word that means it already happened." "Make a word that means to do it again." "Make a word that means not happy or not kind." Never abstract words such as action, describes, reversing, individual.'
    : 'Name one specific meaning in plain words; avoid vague asks that many unrelated words could fit ("how someone acts").'}
4. Each ask lists 2-5 example words from the board that truly mean what it asks, in their usual meaning, each written
   as part ids joined by "+" (pre-re+root-play). Each example uses exactly one root.
5. Part ids: "pre-{text}", "root-{text}", "suf-{text}".
6. Never begin an ask or a meaning with "Yes" or "My turn".`;

  const draw = async () => {
    const res = await ai.models.generateContent({
      model: 'gemini-flash-latest', contents: prompt,
      config: { responseMimeType: 'application/json', responseSchema: schema, maxOutputTokens: 25000 },
    });
    const out = JSON.parse(res.text ?? '{}') as { title?: string; parts?: BuildPart[]; asks?: { ask: string; examples: string[] }[] };
    const board = (out.parts ?? []).filter(p => p && /^[a-z]{2,}$/.test(p.text ?? '') && ['prefix', 'root', 'suffix'].includes(p.type)
      && typeof p.id === 'string' && (p.meaning ?? '').trim().length > 0 && !/^\s*(yes|my turn)\b/i.test(p.meaning));
    const raw: AffixBuildItem[] = (out.asks ?? []).map((a, i) => ({ id: `b${i + 1}`, ask: a.ask, ways: 1,
      examples: (a.examples ?? []).map(e => String(e).split('+').map(s => s.trim()).filter(Boolean)) }));
    return { title: out.title || 'Make New Words', board, raw };
  };

  let made = await draw();
  if (buildItemsFrom(made.raw, made.board).length < 3) {
    console.warn('[WordBuildAffix] fewer than 3 askable items, drawing again');
    made = await draw();
  }
  const tier = (config.difficulty ?? '').toLowerCase().trim();
  const supportTier = tier === 'easy' || tier === 'medium' || tier === 'hard' ? tier : undefined;
  const kept = buildItemsFrom(made.raw, made.board, supportTier);
  console.log('🧩 Word Build (build_affix):', { topic, grade: g, parts: made.board.length, asks: made.raw.length, askable: kept.length });
  return {
    title: made.title, complexityLevel: 'simple_affix', task: 'build_affix',
    availableParts: made.board, targets: [], buildItems: kept,
    gradeLevel: g === 0 ? 'Kindergarten' : `Grade ${Math.min(g, 8)}`,
    ...(supportTier ? { supportTier } : {}),
  };
}
