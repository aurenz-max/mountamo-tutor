/**
 * opinion-builder `build_opinion` generator (open build, OB-7L). The model writes questions a child can take either side
 * of, and for EACH side an opinion, two reasons, an example and a restatement, plus off-topic sentences. Code turns
 * them into cards with roles and sides and keeps a set only when `askableOpinion` passes.
 */
import { Type, type Schema } from '@google/genai';
import { ai } from '../geminiClient';
import { MAX_CARD_CHARS, opinionsFrom, type OpinionBuildData, type OpinionCard, type OpinionItem, type Side } from '../../primitives/visual-primitives/literacy/opinionBuild';

const sideSchema: Schema = { type: Type.OBJECT, properties: {
  opinion: { type: Type.STRING, description: 'I think ... (this side).' },
  reasons: { type: Type.ARRAY, minItems: '2', maxItems: '2', items: { type: Type.STRING }, description: 'Two reasons for THIS side.' },
  example: { type: Type.STRING, description: 'A specific example or experience that backs up the first reason.' },
  restate: { type: Type.STRING, description: 'The same opinion again in other words, opening with "That is why" or "So".' },
}, required: ['opinion', 'reasons', 'example', 'restate'] };

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    questions: { type: Type.ARRAY, minItems: '3', maxItems: '3', items: { type: Type.OBJECT, properties: {
      question: { type: Type.STRING, description: 'A yes/no question a child can argue either way: "Should kids have homework?"' },
      yes: sideSchema,
      no: sideSchema,
      offTopic: { type: Type.ARRAY, minItems: '1', maxItems: '2', items: { type: Type.STRING },
        description: 'True sentences about something else entirely (not a reason for either side).' },
    }, required: ['question', 'yes', 'no', 'offTopic'] } },
  },
  required: ['title', 'questions'],
};

export async function generateOpinionBuild(topic: string, gradeContext: string,
    config: { intent?: string; grade?: string } = {}): Promise<OpinionBuildData> {
  const prompt = `Write opinion-building cards for: "${topic}".
TARGET AUDIENCE: ${gradeContext}
INTENT: ${config.intent || 'Build an opinion with a reason and an example (OREO)'}

Write 3 yes/no questions a child can honestly argue either way, about things in a child's life that fit the topic. For
EACH side (yes and no) write: an opinion ("I think kids should..."), two reasons for that side, one example that backs
up the first reason, and the opinion again in other words opening with "That is why" or "So". Then 1-2 true sentences
about something else entirely.

Rules: every sentence is short (at most ${MAX_CARD_CHARS} characters) and easy to read at this grade; each side's
reasons and example clearly support ONLY that side; no two sentences are the same; never begin a sentence with "Yes" or
"My turn".`;

  const draw = async (): Promise<{ title: string; items: OpinionItem[] }> => {
    const res = await ai.models.generateContent({
      model: 'gemini-flash-latest', contents: prompt,
      config: { responseMimeType: 'application/json', responseSchema: schema, maxOutputTokens: 25000 },
    });
    type SideOut = { opinion: string; reasons: string[]; example: string; restate: string };
    const out = JSON.parse(res.text ?? '{}') as { title?: string; questions?: { question: string; yes: SideOut; no: SideOut; offTopic: string[] }[] };
    const items: OpinionItem[] = (out.questions ?? []).map((q, n) => {
      const side = (s: Side, o: SideOut | undefined): OpinionCard[] => o ? [
        { id: `${n + 1}${s}o`, text: o.opinion, role: 'opinion', side: s },
        ...(o.reasons ?? []).map((t, i) => ({ id: `${n + 1}${s}r${i + 1}`, text: t, role: 'reason' as const, side: s })),
        { id: `${n + 1}${s}e`, text: o.example, role: 'example', side: s },
        { id: `${n + 1}${s}a`, text: o.restate, role: 'restate', side: s },
      ] : [];
      const cards = [...side('yes', q.yes), ...side('no', q.no),
        ...(q.offTopic ?? []).map((t, i) => ({ id: `${n + 1}x${i + 1}`, text: t, role: 'off_topic' as const }))]
        .map(c => ({ ...c, text: String(c.text ?? '').trim() }));
      return { id: `o${n + 1}`, question: String(q.question ?? '').trim(), cards };
    });
    return { title: out.title || 'Build an Opinion', items: opinionsFrom(items) };
  };

  let made = await draw();
  if (made.items.length < 2) { console.warn('[OpinionBuild] fewer than 2 askable questions, drawing again'); made = await draw(); }
  console.log('🍪 Opinion build:', { topic, questions: made.items.map(i => i.question) });
  return { title: made.title, task: 'opinion_build', opinions: made.items,
    ...(config.grade ? { gradeLevel: `Grade ${String(config.grade).replace(/[^0-9]/g, '') || '3'}` } : {}) };
}
