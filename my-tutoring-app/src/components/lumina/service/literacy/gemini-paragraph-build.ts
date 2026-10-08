/**
 * paragraph-architect `build_paragraph` generator (open build, qa/open-build/ROADMAP.md OB-3L L6). The model writes,
 * per paragraph, a topic sentence, four facts that belong, two facts about a DIFFERENT topic, and a closing sentence
 * with no new fact. Code turns them into cards with roles and keeps a set only when `askableParagraph` passes.
 */
import { Type, type Schema } from '@google/genai';
import { ai } from '../geminiClient';
import { MAX_CARD_CHARS, paragraphsFrom, type ParagraphBuildData, type ParagraphItem } from '../../primitives/visual-primitives/literacy/paragraphBuild';

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    paragraphs: {
      type: Type.ARRAY, minItems: '3', maxItems: '4',
      items: { type: Type.OBJECT, properties: {
        topic: { type: Type.STRING, description: 'What the paragraph is about, 1-3 words a child says (sharks, the sun).' },
        topicSentence: { type: Type.STRING, description: 'Names the topic and says what it is (Sharks are fish that live in the ocean.).' },
        facts: { type: Type.ARRAY, minItems: '4', maxItems: '4', items: { type: Type.STRING }, description: 'Four true facts about THIS topic.' },
        otherFacts: { type: Type.ARRAY, minItems: '2', maxItems: '2', items: { type: Type.STRING },
          description: 'Two true facts about a DIFFERENT, nearby topic (for sharks: whales, octopuses), naming that other thing.' },
        closing: { type: Type.STRING, description: 'Wraps up the topic with no new fact (Now you know about sharks.).' },
      }, required: ['topic', 'topicSentence', 'facts', 'otherFacts', 'closing'] },
    },
  },
  required: ['title', 'paragraphs'],
};

const gradeOf = (grade: unknown) => {
  const s = String(grade ?? '').toLowerCase();
  if (/\bk\b|kinder/.test(s)) return 0;
  const n = Number(s.replace(/[^0-9]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 2;
};

export async function generateParagraphBuild(topic: string, gradeContext: string,
    config: { intent?: string; grade?: string } = {}): Promise<ParagraphBuildData> {
  const g = gradeOf(config.grade);
  const words = g <= 1 ? 8 : g === 2 ? 10 : 14;
  const prompt = `Write sentence cards for a paragraph-building activity about: "${topic}".
TARGET AUDIENCE: ${gradeContext}
INTENT: ${config.intent || 'Organize facts into an informative paragraph'}

Write 3 short informative paragraphs, each on a different topic that fits the lesson (if the lesson names one topic,
use it once and pick close relatives for the others). The child sorts the cards: topic sentence first, facts that
belong in the middle, closing last, and must leave out the two facts about a different topic.

Rules:
1. Every sentence is at most ${words} words and ${MAX_CARD_CHARS} characters, plain and true, readable at this grade.
2. The topic sentence names the topic and says what it is. Only the topic sentence does that.
3. Each fact is about THIS topic and could sit in any order. Facts never start with First, Next, Then or Finally.
4. The two other facts are true facts about a DIFFERENT thing and name that thing ("Whales breathe air."), so a careful
   reader can tell they do not belong. Never about the topic itself.
5. The closing restates the topic, adds no new fact, and BEGINS with one of: "Now you know", "That is why", "That is how", "These facts", "As you can see" ("Now you know about sharks.").
6. No two sentences are the same. Never begin a sentence with "Yes" or "My turn".`;

  const draw = async (): Promise<{ title: string; items: ParagraphItem[] }> => {
    const res = await ai.models.generateContent({
      model: 'gemini-flash-latest', contents: prompt,
      config: { responseMimeType: 'application/json', responseSchema: schema, maxOutputTokens: 25000 },
    });
    const out = JSON.parse(res.text ?? '{}') as { title?: string; paragraphs?: { topic: string; topicSentence: string; facts: string[];
      otherFacts: string[]; closing: string }[] };
    const items: ParagraphItem[] = (out.paragraphs ?? []).map((p, n) => ({ id: `p${n + 1}`, topic: (p.topic ?? '').trim(), cards: [
      { id: 't', text: p.topicSentence, role: 'topic' as const },
      ...(p.facts ?? []).map((t, i) => ({ id: `f${i + 1}`, text: t, role: 'detail' as const })),
      ...(p.otherFacts ?? []).map((t, i) => ({ id: `x${i + 1}`, text: t, role: 'off_topic' as const })),
      { id: 'c', text: p.closing, role: 'closing' as const },
    ].map(c => ({ ...c, id: `${n + 1}${c.id}`, text: String(c.text ?? '').trim() })) }));
    return { title: out.title || 'Build a Paragraph', items: paragraphsFrom(items) };
  };

  let made = await draw();
  if (made.items.length < 2) { console.warn('[ParagraphBuild] fewer than 2 askable paragraphs, drawing again'); made = await draw(); }
  console.log('🧱 Paragraph build:', { topic, grade: g, paragraphs: made.items.map(i => i.topic) });
  return { title: made.title, task: 'paragraph_build', paragraphs: made.items, gradeLevel: g === 0 ? 'Kindergarten' : `Grade ${g}` };
}
