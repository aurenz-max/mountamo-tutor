import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import type { MissionPlannerData } from '../../primitives/visual-primitives/astronomy/MissionPlanner';
import {
  buildMissionItems, defaultModes, MISSION_MODES, storyPlaces, type MissionMode, type MissionTier,
} from '../../primitives/visual-primitives/astronomy/missionWorkspace';
import { resolveEvalModes, type ChallengeTypeDoc } from '../evalMode';

export type { MissionPlannerData };

/**
 * Mission Planner generator (rebuilt 2026-10-16 under the 10-15 ruling and the 10-16 ruling for this primitive). Gemini
 * reads the topic and writes only the title; the overview is code's. Every place, launch month, trip,
 * route and key is built by code (`missionWorkspace.ts`, `buildMissionItems`). The old schema had the model write the
 * travel days, which launch window was optimal and the fuel multipliers, with descriptions that stated the answer.
 *
 * Grades 2-5 are graded; `config.difficulty` picks the structural band (how many choices, how close the key is to the
 * next one, a crew to feed). K and Grade 1 get the ungraded planning story whatever the pin (user ruling 10-16).
 */
const CHALLENGE_TYPE_DOCS: Record<MissionMode, ChallengeTypeDoc> = {
  farther_closer: { promptDoc: 'choose which of several places in space (the Moon, Mars, the asteroid belt, the giant planets) is farthest or closest from Earth', schemaDescription: 'Near or far?' },
  pick_window: { promptDoc: 'choose the launch month that needs the least (or most) fuel, from where Earth and the target planet are that month', schemaDescription: 'When to launch' },
  pack_days: { promptDoc: 'work out how many food packs a trip to the Moon needs: there, staying and home again, for each astronaut', schemaDescription: 'Pack the food' },
  assist_tradeoff: { promptDoc: 'choose the route to a giant planet that uses the least fuel (flybys past planets save fuel) and still arrives within a year limit', schemaDescription: 'Pick a route' },
};

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short title for the mission activity, e.g. 'Mission Control'. Never says which place, month or route is best." },
  },
  required: ["title"],
};

export type MissionGrade = 'K' | '1' | '2' | '3' | '4' | '5';
const MISSION_GRADES: MissionGrade[] = ['K', '1', '2', '3', '4', '5'];

/**
 * Canonical grade -> mission-planner rung. Reads `ctx.grade`, never prose (reader-fit 15A/S7: `generationContext.ts`
 * states the contract outright: never parse grade out of `gradeContext`).
 */
export const missionPlannerGradeFromGrade = (grade?: string): MissionGrade | null => {
  const g = (grade ?? '').toString().trim().toUpperCase();
  if (!g) return null;
  if (g === 'K' || g === 'KINDERGARTEN' || g === 'PRESCHOOL') return 'K';
  const n = parseInt(g, 10);
  if (isNaN(n)) return null;
  if (n <= 0) return 'K';
  return (String(Math.min(n, 5)) as MissionGrade);
};

/** Prose fallback — the SECOND resolver, never the first. */
export const missionPlannerGradeFromProse = (prose?: string): MissionGrade => {
  const p = (prose ?? '').toLowerCase();
  if (/\b(kindergarten|preschool)\b/.test(p)) return 'K';
  const m = p.match(/\bgrade\s*([1-9])\b/) || p.match(/\b([1-9])(?:st|nd|rd|th)\s*grade\b/);
  if (m) return (String(Math.min(parseInt(m[1], 10), 5)) as MissionGrade);
  return '3';
};

/** ORDINAL rung index ('K' sorts above '2' as a string; reader-fit 15A/S7). */
export const missionRungIndex = (g: string): number => {
  const i = MISSION_GRADES.indexOf(g as MissionGrade);
  return i === -1 ? 3 : i;
};

const normalizeTier = (d?: unknown): MissionTier => {
  const t = String(d ?? '').toLowerCase().trim();
  return t === 'easy' || t === 'hard' ? t : 'medium';
};

export const generateMissionPlanner = async (
  ctx: GenerationContext,
): Promise<MissionPlannerData> => {
  const { topic } = ctx;
  const config = (ctx.raw ?? {}) as { difficulty?: string; gradeLevel?: string };
  const gradeLevel: MissionGrade = missionPlannerGradeFromGrade(config.gradeLevel)
    ?? missionPlannerGradeFromGrade(ctx.grade) ?? missionPlannerGradeFromProse(ctx.gradeContext);
  const story = missionRungIndex(gradeLevel) <= 1;
  const resolution = story ? null : await resolveEvalModes(
    'mission-planner',
    { targetEvalMode: ctx.targetEvalMode, intent: ctx.intent, objectiveText: ctx.objective?.text },
    CHALLENGE_TYPE_DOCS,
  );
  const modes: MissionMode[] = story ? [] : resolution
    ? MISSION_MODES.filter(m => resolution.allowedTypes.includes(m))
    : defaultModes(gradeLevel);
  const tier = normalizeTier(ctx.supportTier ?? config.difficulty);
  console.log(`[mission-planner] ${story ? `grade ${gradeLevel}: ungraded story${ctx.targetEvalMode ? ` (pin ${ctx.targetEvalMode} not served at K-1)` : ''}`
    : `modes: ${resolution ? `${resolution.modes.map(m => m.evalMode).join('+')} (${resolution.source})` : `grade ${gradeLevel} default`} → [${modes.join(', ')}], tier ${tier}`}`);

  const intent = ctx.intent ? `
LEARNING FOCUS: "${ctx.intent}".` : '';
  // Gemini writes the title only. The first payloads (10-16) showed why the overview is code's: "choosing the launch
  // month that needs the least fuel" on a session that also asks for the most, and "the trip there, the stay, and the
  // journey home" over a question whose trap is forgetting the journey home.
  const prompt = `Write a title for a space-mission activity about "${topic}" for grade ${gradeLevel}.${intent}
${story ? 'The child picks a place in space and flies a spaceship there. Nothing is scored.' : 'The learner answers questions while planning a space mission.'}

Return only title: short and inviting, at most six words${story ? ', in words a five-year-old knows' : ''}. Never name a planet,
a month, a number, fuel, food or a route. Describe only this mission activity, even when the subject above is about something else.`;

  let raw: { title?: string } = {};
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        systemInstruction: 'You are a science teacher titling a space-mission activity. You never hint at an answer.',
      },
    });
    raw = JSON.parse(response.text || '{}');
  } catch (error) {
    console.error('[mission-planner] title call failed; using the topic-neutral title', error);
  }

  const data: MissionPlannerData = {
    title: raw.title?.trim() || (story ? 'Fly to Space!' : 'Mission Control'),
    overview: story ? 'Pick a place in space and fly your ship there.' : 'Plan the mission: answer each question by choosing one.',
    gradeLevel,
    challengeTypes: modes,
    difficulty: tier,
    items: story ? [] : buildMissionItems({ modes, tier, rng: Math.random }),
    ...(story ? { story: { places: storyPlaces(gradeLevel) } } : {}),
  };
  console.log('🛸 Mission Planner Generated:', { title: data.title, gradeLevel, tier, modes, items: data.items!.map(i => i.id) });
  return data;
};
