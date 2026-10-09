/**
 * figurative-language-finder `build_figurative` generator (open build, OB-7L). Code picks the figures by grade; the
 * model writes only the subjects (short things from the topic a child can describe). The learner writes the figure.
 */
import { Type, type Schema } from '@google/genai';
import { ai } from '../geminiClient';
import { figItems, type FigMake, type FigType } from '../../primitives/visual-primitives/literacy/figurativeSteps';

/** Figures a child at this grade can make, easiest first. Idiom is never made: it is a fixed saying. */
const DEVICES_BY_GRADE: Record<string, FigType[]> = {
  '2': ['simile', 'alliteration', 'onomatopoeia', 'simile'],
  '3': ['simile', 'alliteration', 'onomatopoeia', 'personification'],
  '4': ['simile', 'metaphor', 'personification', 'hyperbole'],
  '5': ['simile', 'metaphor', 'personification', 'hyperbole', 'imagery'],
  '6': ['metaphor', 'personification', 'hyperbole', 'alliteration', 'imagery'],
};

const schema: Schema = { type: Type.OBJECT, properties: {
  title: { type: Type.STRING },
  subjects: { type: Type.ARRAY, minItems: '5', maxItems: '7', items: { type: Type.STRING },
    description: 'Short, concrete things from the topic a child can describe: "the thunder", "a lazy cat". 1-4 words each.' },
}, required: ['title', 'subjects'] };

export async function generateFigurativeBuild(topic: string, gradeContext: string,
    config: { intent?: string; grade?: string } = {}) {
  const g = String(config.grade ?? '').replace(/[^0-9]/g, '');
  const devices = DEVICES_BY_GRADE[g] ?? (Number(g) > 6 ? DEVICES_BY_GRADE['6'] : Number(g) < 2 && g ? DEVICES_BY_GRADE['2'] : DEVICES_BY_GRADE['4']);
  const res = await ai.models.generateContent({
    model: 'gemini-flash-latest',
    contents: `List short, concrete things a child could describe with a simile or a metaphor, for the topic "${topic}".
TARGET AUDIENCE: ${gradeContext}
${config.intent ? `FOCUS: ${config.intent}\n` : ''}Each is 1-4 words naming something you can see, hear or feel ("the thunder", "an old oak tree"), all different, never a feeling word alone.`,
    config: { responseMimeType: 'application/json', responseSchema: schema, maxOutputTokens: 4000 },
  });
  const out = JSON.parse(res.text ?? '{}') as { title?: string; subjects?: string[] };
  const subjects = Array.from(new Set((out.subjects ?? []).map(s => String(s).trim()).filter(s => s && s.split(/\s+/).length <= 5)));
  const makes: FigMake[] = devices.slice(0, subjects.length).map((device, i) => ({ id: `m${i + 1}`, device, subject: subjects[i] }));
  const data = { title: out.title || 'Make Figurative Language', task: 'figurative_build' as const, makes,
    passage: '', instances: [], translateInstanceIds: [], availableTypes: Array.from(new Set(devices)),
    gradeLevel: g || '4' };
  if (figItems(data).length < 3) throw new Error('Figurative build: fewer than 3 subjects came back');
  console.log('🎨 Figurative build:', { topic, makes: makes.map(m => `${m.device}: ${m.subject}`) });
  return data;
}
