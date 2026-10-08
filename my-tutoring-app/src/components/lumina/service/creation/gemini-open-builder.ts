import { Type, type Schema } from '@google/genai';
import { ai } from '../geminiClient';
import type { GenerationContext } from '../generation/generationContext';
import type { OpenBuilderData } from '../../primitives/visual-primitives/creation/OpenBuilder';
import {
  SCENES, SCENE_IDS, presetProjects, type OpenBuilderChallenge, type SceneId,
} from '../../primitives/visual-primitives/creation/openBuilderModel';

export type { OpenBuilderData };

/**
 * Open builder generator. The scenes are code (scenery the board can draw and the judge is told about);
 * Gemini picks the ones that fit the lesson and words each goal for the child's age. The goal keeps the
 * scene's job (cross the river, reach the giraffe), because that job is what the child can see and the
 * vision judge checks. A pick outside the scene list falls back to that scene's own goal.
 */

const MODEL = 'gemini-flash-latest';
const SHIPPED = 3;

type Band = 'K-2' | '3-5';

/** 'K-2' for kindergarten through grade 2; '3-5' otherwise or when the grade is unknown. */
export function openBuilderBand(ctx: Pick<GenerationContext, 'grade' | 'gradeLevel' | 'gradeContext'>): Band {
  const g = (ctx.grade ?? '').toString().trim().toUpperCase();
  if (g === 'K') return 'K-2';
  const n = parseInt(g, 10);
  if (!isNaN(n)) return n <= 2 ? 'K-2' : '3-5';
  if (['kindergarten', 'preschool', 'toddler'].includes((ctx.gradeLevel ?? '').toLowerCase())) return 'K-2';
  return /\b(kindergarten|preschool|grade [12]|[12](st|nd) grade)\b/i.test(ctx.gradeContext ?? '') ? 'K-2' : '3-5';
}

const shuffle = <T,>(xs: readonly T[]) => [...xs].sort(() => Math.random() - 0.5);

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    projects: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
      sceneId: { type: Type.STRING, enum: [...SCENE_IDS] },
      title: { type: Type.STRING, description: 'Short project name, 2-5 words' },
      goal: { type: Type.STRING, description: 'What the child hears, 1-2 short sentences' },
    }, required: ['sceneId', 'title', 'goal'] } },
  },
  required: ['projects'],
};

function openBuilderData(challenges: OpenBuilderChallenge[], band: Band): OpenBuilderData {
  return {
    title: band === 'K-2' ? 'Little Builders' : 'Build It Your Way',
    description: 'Build with blocks to do what the project asks. There are lots of ways to do it!',
    challenges, challengeType: 'build_to_goal', gradeBand: band,
  };
}

export const generateOpenBuilder = async (ctx: GenerationContext): Promise<OpenBuilderData> => {
  const band = openBuilderBand(ctx);
  const k2 = band === 'K-2';
  const menu = shuffle(SCENE_IDS).map(id => `- ${id}: ${SCENES[id].sceneNote} Default goal: "${SCENES[id].goal}"`).join('\n');
  let picked: OpenBuilderChallenge[] = [];
  try {
    const res = await ai.models.generateContent({
      model: MODEL,
      contents: `Choose ${SHIPPED} different building projects for a ${k2 ? '5-7' : '8-10'} year old in a block-building game.
Lesson topic: ${ctx.topic}${ctx.intent ? `\nLesson goal: ${ctx.intent}` : ''}
The child builds with plain blocks (small, plank, long, tall, big, triangle, wheel) on a side-view board. Each project uses one of these scenes:
${menu}

Pick the ${SHIPPED} scenes that fit the lesson best (any ${SHIPPED} if none fit). For each, write a title and a goal.
The goal keeps the scene's job exactly (what must be reached, crossed, covered, kept apart or built) and names the scenery's characters, because the child sees them on the board. ${k2
    ? 'Simple words a 5-year-old understands when read aloud; one idea; 1-2 short sentences.'
    : 'Up to 2 sentences. You may add ONE extra demand the child can see in a block build (for example "with a window" or "at least two blocks wide").'}
Say what the build must do, never how to build it: no block counts, no positions.`,
      config: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.8 },
    });
    const raw = (JSON.parse(res.text ?? '{}').projects ?? []) as { sceneId: string; title: string; goal: string }[];
    const seen = new Set<string>();
    picked = raw.filter(p => SCENES[p.sceneId as SceneId] && !seen.has(p.sceneId) && seen.add(p.sceneId))
      .map((p, i) => ({ id: `ob-${i + 1}`, type: 'build_to_goal' as const, sceneId: p.sceneId as SceneId,
        title: String(p.title ?? '').trim().slice(0, 60) || SCENES[p.sceneId as SceneId].title,
        goal: String(p.goal ?? '').trim() || SCENES[p.sceneId as SceneId].goal }));
  } catch (err) {
    console.warn('[open-builder] goal writing failed; using the scenes\' own goals', err);
  }
  if (picked.length < SHIPPED) {
    const have = new Set(picked.map(p => p.sceneId));
    const fill = presetProjects(shuffle(SCENE_IDS.filter(id => !have.has(id))).slice(0, SHIPPED - picked.length));
    picked = [...picked, ...fill].map((p, i) => ({ ...p, id: `ob-${i + 1}` }));
  }
  console.log(`[open-builder] ${picked.map(p => p.sceneId).join(', ')}`);
  return openBuilderData(picked.slice(0, SHIPPED), band);
};
