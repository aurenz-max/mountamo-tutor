import { Type, type Schema } from '@google/genai';
import type {
  SpatialPathChallenge,
  SpatialPathData,
  SpatialPathRelation,
  SpatialRoute,
} from '../../primitives/visual-primitives/math/SpatialPath';
import { ai } from '../geminiClient';
import type { GenerationContext } from '../generation/generationContext';
import { buildScopePromptSection } from '../scopeContext';

const wrapperSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Short activity title. Do not name a correct route.' },
    description: { type: Type.STRING, description: 'One warm sentence about tracing movement paths.' },
    challengeType: { type: Type.STRING, enum: ['choose_route'] },
  },
  required: ['title', 'description', 'challengeType'],
};

const START = { x: 60, y: 160 } as const;
const END = { x: 540, y: 160 } as const;

const ROUTE_GEOMETRY: Record<SpatialPathRelation, { d: string; signature: string }> = {
  over: { d: 'M60 160 Q300 12 540 160', signature: 'arc-above-landmark' },
  under: { d: 'M60 160 Q300 308 540 160', signature: 'arc-below-landmark' },
  through: { d: 'M60 160 L540 160', signature: 'centerline-through-opening' },
  around: {
    d: 'M60 160 C90 55 180 48 215 120 C245 182 255 270 300 270 C345 270 355 182 385 120 C420 48 510 55 540 160',
    signature: 'perimeter-loop-around-landmark',
  },
  across: { d: 'M60 160 L190 82 L410 82 L540 160', signature: 'straight-crossing-on-bridge' },
};

export function buildSpatialRoutes(rotation = 0): SpatialRoute[] {
  const relations: SpatialPathRelation[] = ['over', 'under', 'through', 'around', 'across'];
  const rotated = relations.map((_, index) => relations[(index + rotation) % relations.length]);
  return rotated.map((relation) => ({
    id: `route-${relation}`,
    relation,
    d: ROUTE_GEOMETRY[relation].d,
    geometrySignature: ROUTE_GEOMETRY[relation].signature,
    start: { ...START },
    end: { ...END },
  }));
}

const SCENES = [
  { traveler: { name: 'fox', emoji: '🦊' }, landmark: { name: 'rocky tunnel', emoji: '⛰️' } },
  { traveler: { name: 'rabbit', emoji: '🐇' }, landmark: { name: 'garden wall', emoji: '🧱' } },
  { traveler: { name: 'train', emoji: '🚂' }, landmark: { name: 'bridge deck', emoji: '🌉' } },
  { traveler: { name: 'bee', emoji: '🐝' }, landmark: { name: 'hedge', emoji: '🌳' } },
  { traveler: { name: 'boat', emoji: '⛵' }, landmark: { name: 'low bridge', emoji: '🌉' } },
] as const;

export function validateSpatialPathChallenge(challenge: SpatialPathChallenge): string[] {
  const issues: string[] = [];
  if (challenge.routes.length < 3) issues.push('fewer than three routes');
  const starts = new Set(challenge.routes.map((route) => `${route.start.x},${route.start.y}`));
  const ends = new Set(challenge.routes.map((route) => `${route.end.x},${route.end.y}`));
  if (starts.size !== 1 || ends.size !== 1) issues.push('routes do not share endpoints');
  if (new Set(challenge.routes.map((route) => route.geometrySignature)).size !== challenge.routes.length) {
    issues.push('route geometry is duplicated');
  }
  const correct = challenge.routes.find((route) => route.id === challenge.correctRouteId);
  if (!correct) issues.push('correct route is missing');
  else if (correct.relation !== challenge.requestedRelation) issues.push('correct route relation mismatches request');
  return issues;
}

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
      instruction: `Choose the route that takes the ${scene.traveler.name} ${requestedRelation} the ${scene.landmark.name}, then animate it.`,
      traveler: { ...scene.traveler },
      landmark: { ...scene.landmark },
      requestedRelation,
      routes,
      correctRouteId: `route-${requestedRelation}`,
      contrast: `A route goes ${requestedRelation} by what its path does at the ${scene.landmark.name}, not by its final stop.`,
    };
    const issues = validateSpatialPathChallenge(challenge);
    if (issues.length > 0) throw new Error(`Invalid spatial path ${challenge.id}: ${issues.join(', ')}`);
    return challenge;
  });
}

export async function generateSpatialPath(ctx: GenerationContext): Promise<SpatialPathData> {
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
