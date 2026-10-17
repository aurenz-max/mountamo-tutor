import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import type { RocketBuilderData, RocketComponent } from '../../primitives/visual-primitives/astronomy/RocketBuilder';
import {
  buildRocketItems, defaultModes, ROCKET_MODES, type RocketMode, type RocketTier,
} from '../../primitives/visual-primitives/astronomy/rocketWorkspace';
import { resolveEvalModes, type ChallengeTypeDoc } from '../evalMode';

export type { RocketBuilderData, RocketComponent };

/**
 * Rocket Builder generator (rebuilt 2026-10-16 under the 10-15 ruling). Gemini reads the topic and writes only the
 * frame: a title and a one-sentence overview. Every rocket, part, weight, push, coin, budget and key is built by code
 * (`rocketWorkspace.ts`, `buildRocketItems`). The old schema had the model write the parts library, the target altitude
 * and the budget, none of which was checked for reachability, and its hints stated the lift-off rule.
 * `config.difficulty` picks the structural band: how many parts, rockets or options, and how close push is to weight.
 */
const CHALLENGE_TYPE_DOCS: Record<RocketMode, ChallengeTypeDoc> = {
  can_it_lift: { promptDoc: 'predict whether a rocket lifts off the launch pad, from the weight of its parts and the push of its engines', schemaDescription: 'Will it lift off?' },
  add_to_lift: { promptDoc: 'choose the one part to add so a rocket that stays on the pad lifts off', schemaDescription: 'Add one part' },
  on_budget: { promptDoc: 'choose the rocket that lifts off and costs no more than a budget of coins', schemaDescription: 'On budget' },
  reach_target: { promptDoc: 'predict which of several rockets, differing in fuel, engine, weight or dropped tanks, flies the highest', schemaDescription: 'Which flies highest' },
};

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short title for the rocket activity, e.g. 'Ready for Lift-Off?'. Never says what makes a rocket lift off or fly higher." },
    overview: { type: Type.STRING, description: "One neutral sentence about what the learner will do. Never states a rule about push, weight, fuel or cost." },
  },
  required: ["title", "overview"],
};

export type RocketBuilderGrade = 'K' | '1' | '2' | '3' | '4' | '5';

/**
 * Resolve the grade rung from the CANONICAL grade (`ctx.grade`), never from the prose `gradeContext` (prose once put
 * every degraded lesson on the Grade 3 rung). NO floor: K is served (can_it_lift is a count of pictures and a tap).
 * Returns null when there is no canonical grade, so the prose fallback stands.
 */
export const rocketBuilderGradeFromGrade = (grade?: string): RocketBuilderGrade | null => {
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
const rocketBuilderGradeFromProse = (prose?: string): RocketBuilderGrade => {
  const p = (prose ?? '').toLowerCase();
  if (/\b(kindergarten|preschool)\b/.test(p)) return 'K';
  if (/\b(grade 1|1st grade)\b/.test(p)) return '1';
  if (/\b(grade 2|2nd grade)\b/.test(p)) return '2';
  if (/\b(grade 3|3rd grade)\b/.test(p)) return '3';
  if (/\b(grade 4|4th grade)\b/.test(p)) return '4';
  if (/\b(grade 5|5th grade|middle|high school)\b/.test(p)) return '5';
  return '3';
};

/** Ordinal position of a rung. K is 0 — BELOW grade 1. */
export const rocketRungIndex = (gradeLevel: RocketBuilderGrade): number =>
  gradeLevel === 'K' ? 0 : parseInt(gradeLevel, 10);

const normalizeTier = (d?: unknown): RocketTier => {
  const t = String(d ?? '').toLowerCase().trim();
  return t === 'easy' || t === 'hard' ? t : 'medium';
};

export const generateRocketBuilder = async (
  ctx: GenerationContext,
): Promise<RocketBuilderData> => {
  const { topic } = ctx;
  const config = (ctx.raw ?? {}) as { difficulty?: string; gradeLevel?: string };
  const gradeLevel: RocketBuilderGrade = (rocketBuilderGradeFromGrade(config.gradeLevel) ?? rocketBuilderGradeFromGrade(ctx.grade))
    ?? rocketBuilderGradeFromProse(ctx.gradeContext);
  const resolution = await resolveEvalModes(
    'rocket-builder',
    { targetEvalMode: ctx.targetEvalMode, intent: ctx.intent, objectiveText: ctx.objective?.text },
    CHALLENGE_TYPE_DOCS,
  );
  const modes: RocketMode[] = resolution
    ? ROCKET_MODES.filter(m => resolution.allowedTypes.includes(m))
    : defaultModes(gradeLevel);
  const tier = normalizeTier(ctx.supportTier ?? config.difficulty);
  console.log(`[rocket-builder] modes: ${resolution ? `${resolution.modes.map(m => m.evalMode).join('+')} (${resolution.source})` : `grade ${gradeLevel} default`} → [${modes.join(', ')}], tier ${tier}`);

  const intent = ctx.intent ? `\nLEARNING FOCUS: "${ctx.intent}".` : '';
  const prompt = `Frame a rocket-building activity about "${topic}" for grade ${gradeLevel}.${intent}

Code builds every rocket, part and answer.
The learner will: ${modes.map(m => CHALLENGE_TYPE_DOCS[m].promptDoc).join('; ')}.

Return only:
1. title: short and inviting, at most six words${gradeLevel === 'K' || gradeLevel === '1' ? ', in words a five-year-old knows' : ''}.
2. overview: one neutral sentence, spoken to the learner ("you"), about predicting what a rocket will do.
   The learner answers BEFORE any rocket launches, so say they predict or choose; never say they try, test, build and
   launch, watch, observe or see what happens. Never state a rule: never say what makes a rocket lift off, what push or
   weight must be, whether more fuel is better, or what a part does. Describe only this rocket task, even when the
   subject above is about something else: no other subjects.`;

  let raw: { title?: string; overview?: string } = {};
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        systemInstruction: 'You are a science teacher framing a rocket activity. You never state what makes a rocket lift off.',
      },
    });
    raw = JSON.parse(response.text || '{}');
  } catch (error) {
    console.error('[rocket-builder] framing call failed; using the topic-neutral frame', error);
  }

  const items = buildRocketItems({ modes, tier, rng: Math.random });
  const data: RocketBuilderData = {
    title: raw.title?.trim() || 'Ready for Lift-Off?',
    overview: raw.overview?.trim() || 'Look at each rocket and predict what it will do.',
    gradeLevel,
    challengeTypes: modes,
    difficulty: tier,
    items,
  };
  console.log('🚀 Rocket Builder Generated:', { title: data.title, gradeLevel, tier, modes, items: items.map(i => i.id) });
  return data;
};
