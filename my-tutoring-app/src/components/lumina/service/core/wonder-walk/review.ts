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
