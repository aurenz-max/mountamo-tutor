/**
 * Digital Skills Sim generator. Gemini reads the topic and writes only the frame: a title, a one-sentence description
 * and which picture theme to draw from. Every item, picture, box, letter and key is built by code
 * (`digitalSkillsWorkspace.ts`, `buildSkillItems`): the old schema had the model write each challenge, and the screen
 * showed a single pulsing target, a single drop zone, or the target key highlighted on the keyboard, so every answer
 * was on screen. `config.difficulty` picks the structural band (easy: 2 pictures or boxes, a capital letter; medium: 3,
 * a small letter on a capital key; hard: 4 smaller, a three-letter word in order).
 */
import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import type { DigitalSkillsSimData } from '../../primitives/visual-primitives/core/DigitalSkillsSim';
import {
  buildSkillItems, SKILL_MODES, THEME_IDS, type SkillMode, type SkillTier, type ThemeId,
} from '../../primitives/visual-primitives/core/digitalSkillsWorkspace';
import { resolveEvalModeConstraint, logEvalModeResolution, type ChallengeTypeDoc } from '../evalMode';
import { buildScopePromptSection } from '../scopeContext';

const CHALLENGE_TYPE_DOCS: Record<SkillMode, ChallengeTypeDoc> = {
  click: { promptDoc: 'click the picture a question names', schemaDescription: 'Click practice' },
  drag: { promptDoc: 'drag a picture into the box a question names', schemaDescription: 'Drag practice' },
  type: { promptDoc: 'find and press letters on an on-screen keyboard', schemaDescription: 'Type practice' },
};

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short, friendly title for young learners (2-6 words) that names the topic." },
    description: { type: Type.STRING, description: 'One short, encouraging sentence about what the learner will practice.' },
    theme: { type: Type.STRING, enum: THEME_IDS, description: "The picture set that fits the topic: 'farm', 'ocean', 'space', 'food', 'school' or 'toys'." },
  },
  required: ['title', 'description', 'theme'],
};

const normalizeTier = (d?: string): SkillTier => {
  const x = (d ?? '').toLowerCase().trim();
  return x === 'easy' || x === 'hard' ? x : 'medium';
};

export const generateDigitalSkillsSim = async (ctx: GenerationContext): Promise<DigitalSkillsSimData> => {
  const { topic } = ctx;
  const config = (ctx.raw ?? {}) as { difficulty?: string; targetEvalMode?: string; theme?: string };
  const constraint = resolveEvalModeConstraint('digital-skills-sim', ctx.targetEvalMode ?? config.targetEvalMode, CHALLENGE_TYPE_DOCS);
  logEvalModeResolution('DigitalSkillsSim', ctx.targetEvalMode ?? config.targetEvalMode, constraint);
  const modes: SkillMode[] = constraint ? SKILL_MODES.filter(m => constraint.allowedTypes.includes(m)) : [...SKILL_MODES];
  const tier = normalizeTier(config.difficulty);

  // The lesson's objective and intent steer the title and the picture set; code still builds every task.
  const prompt = `Frame a computer-skills practice for children aged 5-7 about "${topic}".
${buildScopePromptSection(ctx.scope)}
Code builds every task. The learner will: ${modes.map(m => CHALLENGE_TYPE_DOCS[m].promptDoc).join('; ')}.

Return only:
1. title: short, friendly, about the topic.
2. description: one short encouraging sentence about practicing ${modes.map(m => ({ click: 'clicking', drag: 'dragging', type: 'typing letters' })[m]).join(' and ')}. Mention nothing else to do.
3. theme: the picture set that fits the topic best.`;

  let raw: { title?: string; description?: string; theme?: string } = {};
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: { responseMimeType: 'application/json', responseSchema: schema },
    });
    raw = JSON.parse(response.text || '{}');
  } catch (error) {
    console.error('[DigitalSkillsSim] framing call failed; using the topic-neutral frame', error);
  }

  const pick = config.theme ?? raw.theme;
  const theme: ThemeId = (THEME_IDS as string[]).includes(pick ?? '') ? pick as ThemeId : 'toys';
  const items = buildSkillItems({ modes, tier, theme, rng: Math.random });

  const data: DigitalSkillsSimData = {
    title: raw.title?.trim() || 'Mouse and Keyboard Practice',
    description: raw.description?.trim() || 'Practice clicking, dragging and typing.',
    theme,
    challengeTypes: modes,
    difficulty: tier,
    items,
  };
  console.log('[DigitalSkillsSim] Generated:', { title: data.title, theme, tier, modes, items: items.map(i => i.id) });
  return data;
};
