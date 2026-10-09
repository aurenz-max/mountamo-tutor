import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { buildScopePromptSection } from '../scopeContext';
import { resolveEvalModes, type ChallengeTypeDoc } from '../evalMode';
import type { TowerStackerData } from '../../primitives/visual-primitives/engineering/TowerStacker';
import {
  MIXED_MODES, TOWER_MODES, towerBand, towerChallenges, type TowerMode,
} from '../../primitives/visual-primitives/engineering/towerWorkspace';

export type { TowerStackerData };

/**
 * Tower Stacker: three open builds (/add-eval-modes references/build-mode.md). Code owns every target, the ask, the
 * pieces and the check (`towerChallenges`, `towerMiss`); the model writes only a title that fits the lesson's topic.
 * A model-written description is not used: the old one said "a big base helps towers stay standing", which is the
 * answer to every item.
 */
const CHALLENGE_TYPE_DOCS: Record<TowerMode, ChallengeTypeDoc> = {
  build_tall: {
    promptDoc: '"build_tall": build a tower that reaches the green line and stays standing (K-2).',
    schemaDescription: "'build_tall' (reach the line and stand)",
  },
  build_few: {
    promptDoc: '"build_few": reach the green line using no more than N pieces (grades 2-4).',
    schemaDescription: "'build_few' (reach the line with few pieces)",
  },
  build_windproof: {
    promptDoc: '"build_windproof": reach the green line and stay up when a strong wind blows (grades 2-5).',
    schemaDescription: "'build_windproof' (reach the line and survive the wind)",
  },
};

const titleSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'A short, engaging title for a tower-building activity on this topic (2-6 words).' },
  },
  required: ['title'],
};

/** Tower builds per session (mastery-over-demo: three towers, never one). */
const TOWERS = 3;

export const generateTowerStacker = async (ctx: GenerationContext): Promise<TowerStackerData> => {
  const resolution = await resolveEvalModes(
    'tower-stacker',
    { targetEvalMode: ctx.targetEvalMode, intent: ctx.intent, objectiveText: ctx.objective.text },
    CHALLENGE_TYPE_DOCS,
  );
  const band = towerBand(ctx.grade, ctx.gradeContext);
  const allowed = (resolution?.allowedTypes ?? []).filter((t): t is TowerMode => (TOWER_MODES as readonly string[]).includes(t));
  // Mixed (no pin, broad intent): every tier the band builds, easiest first (SP-21).
  const modes: readonly TowerMode[] = allowed.length ? allowed : MIXED_MODES[band];
  const challenges = towerChallenges(modes, band, TOWERS);
  console.log(`[TowerStacker] modes: ${resolution ? `${resolution.modes.map(m => m.evalMode).join('+')} (${resolution.source})` : 'mixed'} `
    + `band ${band} -> ${challenges.map(c => `${c.type}@${c.targetHeight}${c.maxPieces ? `/${c.maxPieces}` : ''}`).join(', ')}`);

  let title = 'Tower Stacker';
  try {
    const result = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: `Write a title for a tower-building activity for ${ctx.gradeContext} students, on the topic "${ctx.topic}"\n`
        + `${buildScopePromptSection(ctx.scope)}.\nThe title names what is built (a tower, a skyscraper, a lookout), never how to make it stand.`,
      config: { responseMimeType: 'application/json', responseSchema: titleSchema },
    });
    const t = result.text ? String(JSON.parse(result.text).title ?? '').trim() : '';
    if (t && t.length <= 60) title = t;
  } catch (e) {
    console.warn('[TowerStacker] title call failed; using the default title', e);
  }

  return {
    title,
    challengeType: allowed.length === 1 ? allowed[0] : 'mixed',
    challenges,
  };
};
