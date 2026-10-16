import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import type { OrbitMechanicsLabData } from '../../primitives/visual-primitives/astronomy/OrbitMechanicsLab';
import {
  buildOrbitItems, defaultModes, ORBIT_MODES, type OrbitMode, type OrbitTier,
} from '../../primitives/visual-primitives/astronomy/orbitWorkspace';
import { resolveEvalModes, type ChallengeTypeDoc } from '../evalMode';

export type { OrbitMechanicsLabData };

/**
 * Orbit Mechanics Lab generator (rebuilt 2026-10-16 under the 10-15 ruling). Gemini reads the topic and writes only
 * the frame: a title and a one-sentence overview. Every item, push, rocket, burn, choice and key is built by code from
 * the physics (`orbitWorkspace.ts`, `buildOrbitItems`). The old schema had the model pick the challenge type, the
 * target altitude and the thrust range; two of its challenge types had no completion check, and K-1 always had the
 * middle picture as the answer.
 * `config.difficulty` picks the structural band: how many pushes, rockets or choices, and how close they are.
 */
const CHALLENGE_TYPE_DOCS: Record<OrbitMode, ChallengeTypeDoc> = {
  pick_speed: { promptDoc: 'pick the sideways push that makes a rocket above Earth fall back, go around in a circle, or fly away', schemaDescription: 'Pick the push' },
  orbit_speed: { promptDoc: 'pick which rocket on its track around Earth moves fastest or slowest, or takes the shortest or longest trip around', schemaDescription: 'Which rocket' },
  predict_burn: { promptDoc: 'predict what a push forward or backward does to the path of a rocket going around Earth', schemaDescription: 'Predict the burn' },
  circularize: { promptDoc: 'choose where and which way to fire a rocket once to turn its stretched loop into a circle', schemaDescription: 'Make it a circle' },
};

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short title for the rocket lab, e.g. 'Rocket Around the World'. Never says what a push or a burn does." },
    overview: { type: Type.STRING, description: "One neutral sentence about what the learner will do. Never says what makes a rocket orbit, fall or fly away." },
  },
  required: ["title", "overview"],
};

export type OrbitMechanicsGrade = 'K' | '1' | '2' | '3' | '4' | '5';

/**
 * Resolve the grade rung from the CANONICAL grade (`ctx.grade`), never from the prose `gradeContext` (a string compare
 * on prose once put a Kindergartener on the Grade 3 rung). NO floor: K is served (pick_speed is pictures and a tap).
 * Returns null when there is no canonical grade, so the prose fallback stands.
 */
export const orbitMechanicsGradeFromGrade = (grade?: string): OrbitMechanicsGrade | null => {
  const g = (grade ?? '').toString().trim().toUpperCase();
  if (!g) return null;
  if (g === 'K' || g === 'KINDERGARTEN' || g === 'PRESCHOOL') return 'K';
  const n = parseInt(g, 10);
  if (isNaN(n)) return null;
  if (n <= 0) return 'K';
  if (n >= 5) return '5';                          // 6+ tops out at the ceiling
  return String(n) as '1' | '2' | '3' | '4';
};

/** Legacy prose fallback — kept as the second resolver, never the first. */
const orbitMechanicsGradeFromProse = (prose?: string): OrbitMechanicsGrade => {
  const p = (prose ?? '').toLowerCase();
  if (/\b(kindergarten|preschool)\b/.test(p)) return 'K';
  if (/\b(grade 1|1st grade)\b/.test(p)) return '1';
  if (/\b(grade 2|2nd grade)\b/.test(p)) return '2';
  if (/\b(grade 3|3rd grade)\b/.test(p)) return '3';
  if (/\b(grade 4|4th grade)\b/.test(p)) return '4';
  if (/\b(grade 5|5th grade|middle|high school)\b/.test(p)) return '5';
  return '3';
};

const normalizeTier = (d?: unknown): OrbitTier => {
  const t = String(d ?? '').toLowerCase().trim();
  return t === 'easy' || t === 'hard' ? t : 'medium';
};

export const generateOrbitMechanicsLab = async (
  ctx: GenerationContext,
): Promise<OrbitMechanicsLabData> => {
  const { topic } = ctx;
  const config = (ctx.raw ?? {}) as { difficulty?: string; gradeLevel?: string };
  const gradeLevel: OrbitMechanicsGrade = (orbitMechanicsGradeFromGrade(config.gradeLevel) ?? orbitMechanicsGradeFromGrade(ctx.grade))
    ?? orbitMechanicsGradeFromProse(ctx.gradeContext);
  const resolution = await resolveEvalModes(
    'orbit-mechanics-lab',
    { targetEvalMode: ctx.targetEvalMode, intent: ctx.intent, objectiveText: ctx.objective?.text },
    CHALLENGE_TYPE_DOCS,
  );
  const modes: OrbitMode[] = resolution
    ? ORBIT_MODES.filter(m => resolution.allowedTypes.includes(m))
    : defaultModes(gradeLevel);
  const tier = normalizeTier(ctx.supportTier ?? config.difficulty);
  console.log(`[orbit-mechanics-lab] modes: ${resolution ? `${resolution.modes.map(m => m.evalMode).join('+')} (${resolution.source})` : `grade ${gradeLevel} default`} → [${modes.join(', ')}], tier ${tier}`);

  const intent = ctx.intent ? `\nLEARNING FOCUS: "${ctx.intent}".` : '';
  const prompt = `Frame a rocket-and-gravity lab about "${topic}" for grade ${gradeLevel}.${intent}

Code builds every question, push, rocket and answer.
The learner will: ${modes.map(m => CHALLENGE_TYPE_DOCS[m].promptDoc).join('; ')}.

Return only:
1. title: short and inviting, at most six words${gradeLevel === 'K' || gradeLevel === '1' ? ', in words a five-year-old knows' : ''}.
2. overview: one neutral sentence, spoken to the learner ("you"), about predicting what gravity does with a rocket.
   The learner answers BEFORE anything flies or moves, so say they predict or choose; never say they try, test, watch,
   observe or see what happens. Never say what speed, push or burn makes a rocket go around, fall or fly away, and never
   say which rocket is faster. Describe only this rocket task, even when the subject above is about something else: no
   counting, numbers or other subjects.`;

  let raw: { title?: string; overview?: string } = {};
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        systemInstruction: 'You are a science teacher framing a rocket lab. You never state what makes an orbit.',
      },
    });
    raw = JSON.parse(response.text || '{}');
  } catch (error) {
    console.error('[orbit-mechanics-lab] framing call failed; using the topic-neutral frame', error);
  }

  const items = buildOrbitItems({ modes, tier, rng: Math.random });
  const data: OrbitMechanicsLabData = {
    title: raw.title?.trim() || 'Rocket Around Earth',
    overview: raw.overview?.trim() || 'Send the rocket and watch where gravity takes it.',
    gradeLevel,
    challengeTypes: modes,
    difficulty: tier,
    items,
  };
  console.log('🚀 Orbit Mechanics Lab Generated:', { title: data.title, gradeLevel, tier, modes, items: items.map(i => i.id) });
  return data;
};
