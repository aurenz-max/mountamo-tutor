/**
 * Independent solve of a wonder walk: a reader that did not write it hears each stop the way the child does (the
 * narration, the ask, the picture names in screen order; no key, no idea, no traps) and picks one. A wrong pick or a
 * second picture that also fits means the stop's answer is not settled by what the child meets. Code cannot judge
 * that; a second reader can.
 */
import { Type, ThinkingLevel, type Schema } from '@google/genai';
import { ai } from '../../geminiClient';
import type { WonderWalkStop } from '../../../primitives/visual-primitives/core/wonder-walk/WonderWalk';

export interface StopVerdict {
  stop: number;
  pick: string;
  alsoFits: string[];
  note: string;
}

const SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    stops: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          stop: { type: Type.INTEGER },
          pick: { type: Type.STRING, description: 'The one picture name that best answers the ask, copied exactly.' },
          alsoFits: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Other picture names a careful 5-year-old could fairly defend as right. Usually empty.' },
          note: { type: Type.STRING, description: 'One short sentence on what makes the stop unclear, or empty.' },
        },
        required: ['stop', 'pick', 'alsoFits', 'note'],
      },
    },
  },
  required: ['stops'],
};

export async function reviewWalk(bigIdea: string, stops: WonderWalkStop[], timeoutMs = 25_000): Promise<StopVerdict[]> {
  const prompt = `A Kindergarten child is on a picture walk about: "${bigIdea}". At each stop the tutor says the narration, then asks the question, and the child taps one picture. Answer each stop as a careful adult who knows Kindergarten science and stories, using only what the child hears. If the ask could fairly mean two pictures, list the other in alsoFits.

${stops.map((s, i) => `[${i}] Narration: ${s.narration}\nAsk: ${s.ask}\nPictures: ${s.options.map(o => o.word).join(' | ')}`).join('\n\n')}`;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const call = ai.models.generateContent({
    model: 'gemini-flash-latest',
    contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: SCHEMA, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
  });
  const response = await Promise.race([call, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('review timed out')), timeoutMs); })]);
  clearTimeout(timer);
  const parsed = JSON.parse(response.text ?? '{}') as { stops?: StopVerdict[] };
  return (parsed.stops ?? []).filter(v => stops[v.stop]).map(v => ({
    stop: v.stop,
    pick: String(v.pick ?? '').trim().toLowerCase(),
    alsoFits: (v.alsoFits ?? []).map(x => String(x).trim().toLowerCase()).filter(x => x && x !== String(v.pick).trim().toLowerCase()),
    note: String(v.note ?? ''),
  }));
}

export interface SentenceVerdict { stop: number; ok: boolean; better: string; note: string }

const SENTENCE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    sentences: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          stop: { type: Type.INTEGER },
          ok: { type: Type.BOOLEAN, description: 'True when the sentence is correct, natural English a Kindergarten teacher would write.' },
          better: { type: Type.STRING, description: 'The corrected sentence when ok is false; else empty.' },
          note: { type: Type.STRING, description: 'One short sentence on what is wrong, or empty.' },
        },
        required: ['stop', 'ok', 'better', 'note'],
      },
    },
  },
  required: ['sentences'],
};

/**
 * Independent read of a walk's sentences. Code checks a sentence's structure (roles, cards, the end mark against the
 * first word) and cannot tell whether it is English: "can frog jump?" passed every check on 2026-11-10. A reader that
 * did not write it says whether each sentence is one a teacher would put in front of a child.
 */
export async function reviewSentences(sentences: Array<{ stop: number; text: string }>, timeoutMs = 25_000): Promise<SentenceVerdict[]> {
  const prompt = `A Kindergarten teacher will show a child each sentence below as word cards, one word per card. For each one, say whether it is a correct, natural English sentence: a naming word has "a" or "the" where English needs it, the doing-word agrees with who does it, the words are in order, and the end mark fits (a question ends in a question mark). Short is fine ("Dogs run."). Capital letters do not matter. If it is not correct, give the corrected sentence with as few changes as possible.

${sentences.map(s => `[${s.stop}] ${s.text}`).join('\n')}`;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const call = ai.models.generateContent({
    model: 'gemini-flash-latest',
    contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: SENTENCE_SCHEMA, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
  });
  const response = await Promise.race([call, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('sentence review timed out')), timeoutMs); })]);
  clearTimeout(timer);
  const parsed = JSON.parse(response.text ?? '{}') as { sentences?: SentenceVerdict[] };
  const known = new Set(sentences.map(s => s.stop));
  return (parsed.sentences ?? []).filter(v => known.has(v.stop)).map(v => ({ stop: v.stop, ok: v.ok === true, better: String(v.better ?? '').trim(), note: String(v.note ?? '') }));
}
