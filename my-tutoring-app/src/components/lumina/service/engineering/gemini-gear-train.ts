import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { buildScopePromptSection } from '../scopeContext';
import { resolveEvalModes, type ChallengeTypeDoc } from '../evalMode';
import type { GearTrainBuilderData } from '../../primitives/visual-primitives/engineering/GearTrainBuilder';
import {
  GEAR_MODES, MIXED_MODES, gearBand, gearChallenges, type GearMode,
} from '../../primitives/visual-primitives/engineering/gearWorkspace';

export type { GearTrainBuilderData };

/**
 * Gear Train Builder: three open builds (/add-eval-modes references/build-mode.md). Code owns every target, the ask,
 * the tray and the check (`gearChallenges`, `gearMiss`); the model writes only a title that fits the lesson's topic.
 */
const CHALLENGE_TYPE_DOCS: Record<GearMode, ChallengeTypeDoc> = {
  build_direction: {
    promptDoc: '"build_direction": build a gear train whose last gear turns the same way as (or opposite to) the first (K-3).',
    schemaDescription: "'build_direction' (which way the last gear turns)",
  },
  build_speed: {
    promptDoc: '"build_speed": build a gear train whose last gear turns faster or slower than the first (grades 1-5).',
    schemaDescription: "'build_speed' (faster or slower)",
  },
  build_ratio: {
    promptDoc: '"build_ratio": build a gear train whose last gear turns an exact number of times per turn of the first (grades 3-5).',
    schemaDescription: "'build_ratio' (exact turns, counting teeth)",
  },
};

const titleSchema: Schema = {
  type: Type.OBJECT,
  properties: { title: { type: Type.STRING, description: 'A short, engaging title for a gear-building activity on this topic (2-6 words).' } },
  required: ['title'],
};

/** Gear trains per session (mastery-over-demo: three, never one). */
const TRAINS = 3;

export const generateGearTrainBuilder = async (ctx: GenerationContext): Promise<GearTrainBuilderData> => {
  const resolution = await resolveEvalModes(
    'gear-train-builder',
    { targetEvalMode: ctx.targetEvalMode, intent: ctx.intent, objectiveText: ctx.objective.text },
    CHALLENGE_TYPE_DOCS,
  );
  const band = gearBand(ctx.grade, ctx.gradeContext);
  const allowed = (resolution?.allowedTypes ?? []).filter((t): t is GearMode => (GEAR_MODES as readonly string[]).includes(t));
  // Mixed (no pin, broad intent): every tier the band builds, easiest first (SP-21).
  const challenges = gearChallenges(allowed.length ? allowed : MIXED_MODES[band], band, TRAINS);
  console.log(`[GearTrainBuilder] modes: ${resolution ? `${resolution.modes.map(m => m.evalMode).join('+')} (${resolution.source})` : 'mixed'} `
    + `band ${band} -> ${challenges.map(c => `${c.type}:${c.way ?? ''}${c.speed ?? ''}${c.ratio !== undefined ? `x${c.ratio.toFixed(2)}` : ''}/${c.minGears}`).join(', ')}`);

  let title = 'Gear Train Builder';
  try {
    const result = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: `Write a title for a gear-building activity for ${ctx.gradeContext} students, on the topic "${ctx.topic}"\n`
        + `${buildScopePromptSection(ctx.scope)}.\nThe title names a machine or a job (a clock, a toy, a mill), never which way or how fast a gear turns.`,
      config: { responseMimeType: 'application/json', responseSchema: titleSchema },
    });
    const t = result.text ? String(JSON.parse(result.text).title ?? '').trim() : '';
    if (t && t.length <= 60) title = t;
  } catch (e) {
    console.warn('[GearTrainBuilder] title call failed; using the default title', e);
  }
  return { title, challengeType: allowed.length === 1 ? allowed[0] : 'mixed', challenges };
};
