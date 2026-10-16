import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import type { ConstructionSequencePlannerData } from "../../primitives/visual-primitives/engineering/ConstructionSequencePlanner";
import {
  buildCspItems, CSP_MODES, PROJECT_IDS, resolveCspModes, type CspMode, type CspTier, type ProjectId,
} from "../../primitives/visual-primitives/engineering/constructionSequenceWorkspace";
import { resolveEvalModeConstraint, logEvalModeResolution, type ChallengeTypeDoc } from "../evalMode";

export type { ConstructionSequencePlannerData };

/**
 * Construction Sequence Planner generator. Gemini reads the topic and writes only the frame: a title, one neutral
 * sentence and which project to build. Every item, job, need, week count, deadline and answer is built by code
 * (`constructionSequenceWorkspace.ts`, `buildCspItems`) from a library of real jobs per project: the old schema had
 * the model write the task list and its needs, and the screen then showed the needs, live red borders on misplaced
 * jobs, the critical path outlined and its length, so the order and the total could be read off the screen.
 * `config.difficulty` picks the structural band (more jobs; parallel hard limits the crews; critical_path hard makes
 * the chain with the most jobs not the longest in weeks).
 */
const CHALLENGE_TYPE_DOCS: Record<CspMode, ChallengeTypeDoc> = {
  sequence: { promptDoc: "put construction jobs in the order they must happen", schemaDescription: "Order the jobs" },
  dependency_chain: { promptDoc: "order jobs whose cards say which jobs each one needs first", schemaDescription: "Follow the needs" },
  parallel: { promptDoc: "plan jobs into weeks, doing jobs that do not need each other at the same time, to meet a deadline", schemaDescription: "Plan the weeks" },
  critical_path: { promptDoc: "find the fewest weeks a build can take when crews work at the same time", schemaDescription: "Find the fewest weeks" },
};

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short title, e.g. 'Build It Right: The Town Bridge'. Never names an order or a number of weeks." },
    description: { type: Type.STRING, description: "One neutral sentence about the project the learner will plan. Never says which job comes first or how long anything takes." },
    projectType: { type: Type.STRING, enum: PROJECT_IDS, description: "The project that fits the topic best: house, bridge, tower, road or playground." },
  },
  required: ["title", "description", "projectType"],
};

const normalizeTier = (d?: string): CspTier => {
  const t = (d ?? '').toLowerCase().trim();
  return t === 'easy' || t === 'hard' ? t : 'medium';
};
const gradeOf = (grade?: string, gradeContext?: string): string => {
  const g = (grade ?? '').trim().toUpperCase();
  if (g === 'K' || /^[1-5]$/.test(g)) return g;
  const m = /grade\s*(\d)/i.exec(gradeContext ?? '') ?? /\b(\d)(st|nd|rd|th)\b/i.exec(gradeContext ?? '');
  if (m) return m[1];
  return /\b(k|kindergarten)\b/i.test(gradeContext ?? '') ? 'K' : '3';
};

export const generateConstructionSequencePlanner = async (ctx: GenerationContext): Promise<ConstructionSequencePlannerData> => {
  const { topic } = ctx;
  const config = (ctx.raw ?? {}) as { difficulty?: string; projectType?: string; targetEvalMode?: string };
  const gradeLevel = gradeOf(ctx.grade, ctx.gradeContext);
  const pin = ctx.targetEvalMode ?? config.targetEvalMode;
  const constraint = resolveEvalModeConstraint('construction-sequence-planner', pin, CHALLENGE_TYPE_DOCS);
  logEvalModeResolution('construction-sequence-planner', pin, constraint);
  const modes: CspMode[] = constraint ? CSP_MODES.filter(m => constraint.allowedTypes.includes(m)) : resolveCspModes({ gradeLevel });
  const tier = normalizeTier(config.difficulty);

  const intent = ctx.intent ? `\nLEARNING FOCUS: "${ctx.intent}".` : '';
  const prompt = `Frame a construction planning activity about "${topic}" for grade ${gradeLevel}.${intent}

Code builds every job card and question. The learner will: ${modes.map(m => CHALLENGE_TYPE_DOCS[m].promptDoc).join('; ')}.

Return only:
1. title: short and neutral.
2. description: one neutral sentence about the project. Never say which job comes first, what a job needs, or how long anything takes.
3. projectType: the project that fits the topic best.`;

  let raw: { title?: string; description?: string; projectType?: string } = {};
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        systemInstruction: 'You frame a construction planning activity for children. You never state an order, a need or a duration.',
      },
    });
    raw = JSON.parse(response.text || '{}');
  } catch (error) {
    console.error('[construction-sequence-planner] framing call failed; using the topic-neutral frame', error);
  }

  const pick = config.projectType ?? raw.projectType;
  const project: ProjectId = (PROJECT_IDS as string[]).includes(pick ?? '') ? pick as ProjectId : 'house';
  const items = buildCspItems({ modes, tier, project, rng: Math.random });

  const data: ConstructionSequencePlannerData = {
    title: raw.title?.trim() || 'Build It Right',
    description: raw.description?.trim() || `Plan the jobs to build a ${project}.`,
    projectType: project,
    gradeLevel,
    challengeTypes: modes,
    difficulty: tier,
    items,
  };
  console.log('🏗️ Construction Sequence Planner Generated:', { title: data.title, project, tier, modes, items: items.map(i => i.id) });
  return data;
};
