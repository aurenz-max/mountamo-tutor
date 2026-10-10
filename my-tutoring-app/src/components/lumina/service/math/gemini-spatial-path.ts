import { Type, type Schema } from '@google/genai';
import type {
  SpatialPathChallenge,
  SpatialPathData,
  SpatialPathRelation,
} from '../../primitives/visual-primitives/math/SpatialPath';
import {
  SCENES,
  buildSpatialRoutes,
  routeContrast,
  routeInstruction,
  validateSpatialPathChallenge,
} from '../../primitives/visual-primitives/math/spatialPathRoutes';
import { ai } from '../geminiClient';
import type { GenerationContext } from '../generation/generationContext';
import { buildScopePromptSection } from '../scopeContext';
import { logEvalModeResolution } from '../evalMode';

export { buildSpatialRoutes, validateSpatialPathChallenge };

const wrapperSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Short activity title. Do not name a correct route.' },
    description: { type: Type.STRING, description: 'One warm sentence about tracing movement paths.' },
    challengeType: { type: Type.STRING, enum: ['choose_route'] },
  },
  required: ['title', 'description', 'challengeType'],
};

export function selectSpatialPathChallenges(count = 5): SpatialPathChallenge[] {
  const relations: SpatialPathRelation[] = ['through', 'around', 'across', 'over', 'under'];
  return Array.from({ length: Math.max(3, Math.min(6, count)) }, (_, index) => {
    const requestedRelation = relations[index % relations.length];
    const scene = SCENES[index % SCENES.length];
    // Permute independently of the requested-relation sequence. The former
    // rotation=index accidentally put every correct answer in slot 3, leaking the key.
    const routes = buildSpatialRoutes((index * 2 + 1) % relations.length);
    const challenge: SpatialPathChallenge = {
      id: `spatial-path-${index + 1}`,
      type: 'choose_route',
      instruction: routeInstruction(scene.traveler.name, requestedRelation, scene.landmark.name),
      traveler: { ...scene.traveler },
      landmark: { ...scene.landmark },
      requestedRelation,
      routes,
      correctRouteId: `route-${requestedRelation}`,
      contrast: routeContrast(requestedRelation, scene.landmark.name),
    };
    const issues = validateSpatialPathChallenge(challenge);
    if (issues.length > 0) throw new Error(`Invalid spatial path ${challenge.id}: ${issues.join(', ')}`);
    return challenge;
  });
}

export async function generateSpatialPath(ctx: GenerationContext): Promise<SpatialPathData> {
  // Single mode (choose_route): the pin is logged; every challenge is that one task.
  logEvalModeResolution('SpatialPath', ctx.targetEvalMode, null);
  const requestedCount = typeof ctx.raw.instanceCount === 'number' ? ctx.raw.instanceCount : 5;
  const challenges = selectSpatialPathChallenges(requestedCount);
  const scopeSection = buildScopePromptSection(ctx.scope);
  let wrapper: { title?: string; description?: string; challengeType?: string } = {};
  try {
    const result = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: `Create wrapper copy for a K-2 movement-preposition activity about "${ctx.topic}".
The local interaction presents ${challenges.length} route challenges. Every candidate route has the same start and finish; children choose by path geometry.
Do not name any correct route in the title or description. Do not generate route geometry or per-challenge answers.
${scopeSection}`,
      config: { responseMimeType: 'application/json', responseSchema: wrapperSchema },
    });
    wrapper = result.text ? JSON.parse(result.text) : {};
  } catch (error) {
    console.warn('[SpatialPath] Wrapper generation failed; using safe local copy.', error);
  }
  return {
    title: typeof wrapper.title === 'string' && wrapper.title.trim() ? wrapper.title : 'Path Explorer',
    description: typeof wrapper.description === 'string' && wrapper.description.trim()
      ? wrapper.description
      : 'Follow the shape of each route around a landmark.',
    challengeType: 'choose_route',
    challenges,
    gradeBand: ctx.grade === '2' ? '2' : ctx.grade === '1' ? '1' : 'K',
  };
}
