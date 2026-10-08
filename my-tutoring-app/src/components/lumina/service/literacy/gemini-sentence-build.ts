/**
 * sentence-builder `build_sentence` generator (open build, qa/open-build/ROADMAP.md OB-3L L7). The model writes, per
 * item, what the sentence is about, its kind (question or telling), a small word bank, and 3+ sentences the bank
 * makes. Code adds the end marks to the bank and keeps an item only when `askableSentence` passes. The examples are
 * hidden; the shared judge reads whatever sentence is made.
 */
import { Type, type Schema } from '@google/genai';
import { ai } from '../geminiClient';
import { END_MARKS, sentencesFrom, type SentenceBuildData, type SentenceItem } from '../../primitives/visual-primitives/literacy/sentenceBuild';

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    items: {
      type: Type.ARRAY, minItems: '4', maxItems: '5',
      items: { type: Type.OBJECT, properties: {
        about: { type: Type.STRING, description: 'What the sentence is about, with its article: "the dog", "my cat".' },
        kind: { type: Type.STRING, enum: ['question', 'telling'] },
        words: { type: Type.ARRAY, minItems: '7', maxItems: '12', items: { type: Type.STRING },
          description: 'Lowercase single words, no punctuation. Includes every word of the examples plus 1-2 extra.' },
        examples: { type: Type.ARRAY, minItems: '3', maxItems: '5', items: { type: Type.STRING },
          description: 'Sentences made ONLY from the words, written lowercase with spaces and the end mark as its own token: "can the dog run ?"' },
      }, required: ['about', 'kind', 'words', 'examples'] },
    },
  },
  required: ['title', 'items'],
};

export async function generateSentenceBuild(topic: string, gradeContext: string,
    config: { intent?: string; grade?: string } = {}): Promise<SentenceBuildData> {
  const prompt = `Create word-tile sentence building for: "${topic}".
TARGET AUDIENCE: ${gradeContext}
INTENT: ${config.intent || 'Build questions and telling sentences'}

The child taps word tiles and an end mark (. or ?) to MAKE a sentence for each ask, such as "Make a question about the
dog." Many sentences can be right, so each bank must make at least three different good sentences.

Rules (an item that breaks one is dropped):
1. 4-5 items, alternating question and telling. Each is about something concrete a young child knows (an animal, a
   toy, a person at school), fitting the lesson topic.
2. words: 7-12 lowercase single words, easy to read at this grade. No punctuation in a word.
3. A question starts with who, what, where, when, why, how, is, are, can, do, does or did, and ends with "?".
   A telling sentence starts with a naming word (the, my, a, or a name) and ends with ".".
4. Each example uses only the words, has at least three words, and mentions the thing it is about.
5. Never begin a word list or sentence with "yes" or "my turn".`;

  const draw = async (): Promise<{ title: string; items: SentenceItem[] }> => {
    const res = await ai.models.generateContent({
      model: 'gemini-flash-latest', contents: prompt,
      config: { responseMimeType: 'application/json', responseSchema: schema, maxOutputTokens: 25000 },
    });
    const out = JSON.parse(res.text ?? '{}') as { title?: string; items?: { about: string; kind: string; words: string[]; examples: string[] }[] };
    const items: SentenceItem[] = (out.items ?? []).map((it, n) => {
      const words = Array.from(new Set((it.words ?? []).map(w => String(w).trim().toLowerCase()).filter(w => /^[a-z']+$/.test(w))));
      return { id: `s${n + 1}`, kind: it.kind === 'question' ? 'question' : 'telling', about: String(it.about ?? '').trim(), ways: 1,
        bank: [...words, ...END_MARKS],
        examples: (it.examples ?? []).map(e => String(e).toLowerCase().replace(/([.?])/g, ' $1').split(/\s+/).filter(Boolean)) };
    });
    return { title: out.title || 'Make a Sentence', items: sentencesFrom(items) };
  };

  let made = await draw();
  if (made.items.length < 3) { console.warn('[SentenceBuild] fewer than 3 askable items, drawing again'); made = await draw(); }
  console.log('🧱 Sentence build:', { topic, items: made.items.map(i => `${i.kind}: ${i.about}`) });
  return { title: made.title, task: 'sentence_build', sentences: made.items.map(i => ({ ...i, ways: 1 })),
    ...(config.grade ? { gradeLevel: `Grade ${String(config.grade).replace(/[^0-9K]/gi, '') || '1'}` } : {}) };
}
