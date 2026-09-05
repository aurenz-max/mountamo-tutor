import { Type, type Schema } from '@google/genai';
import type { ThreeDShapeExplorerData } from '../../primitives/visual-primitives/math/ThreeDShapeExplorer';
import {
  COLLECTION_ITEM_CAP,
  SHAPE_FACTS,
  buildThreeDShapeItems,
  canonicalPropertiesFor,
  canonicalRiddleCluesFor,
  gateThreeDShapeChallenge,
  propertyAnswerFor,
  wrapperTextForSession,
  type PropertyKey,
  type ThreeDShapeChallengeLike,
  type ThreeDShapeMode,
  type ThreeDShapeName,
  type ThreeDShapeTier,
} from '../../primitives/visual-primitives/math/threeDShapeExplorerScript';
import { ai } from '../geminiClient';
import type { GenerationContext } from '../generation/generationContext';
import { buildScopePromptSection } from '../scopeContext';
import {
  buildChallengeTypePromptSection,
  constrainChallengeTypeEnum,
  logEvalModeResolution,
  resolveEvalModeConstraint,
  type ChallengeTypeDoc,
} from '../evalMode';

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  'identify-3d': {
    promptDoc: '"identify-3d": Choose one target solid. The child will see it unlabeled and SAY its mathematical name.',
    schemaDescription: "'identify-3d' (say the solid name)",
  },
  'match-to-real-world': {
    promptDoc: '"match-to-real-world": Supply 2-4 familiar, short object names and their target solids. The child will see one object and SAY its solid-shape name. Never use an object name containing the answer (use party hat, not ice cream cone).',
    schemaDescription: "'match-to-real-world' (say an object's solid shape)",
  },
  '2d-vs-3d': {
    promptDoc: '"2d-vs-3d": Supply 2-4 canonical flat or solid shapes. The child sees one code-drawn shape and SAYS flat or solid. is3d must agree with the name.',
    schemaDescription: "'2d-vs-3d' (say flat or solid)",
  },
  'faces-and-properties': {
    promptDoc: '"faces-and-properties": Choose one target solid and 2-4 explicit propertyKey values. Code owns all geometry facts and answers. Allowed keys: flatFaces, curvedSurfaces, faceShape, canRoll, canStack, canSlide. Do not write facts or answer keys.',
    schemaDescription: "'faces-and-properties' (say one property answer)",
  },
  'shape-riddle': {
    promptDoc: '"shape-riddle": Choose one target solid only. Code supplies the true, answer-free, uniquely identifying clue set; the child SAYS the mystery solid name.',
    schemaDescription: "'shape-riddle' (say the mystery solid name)",
  },
};

const propertyKeys = ['flatFaces', 'curvedSurfaces', 'faceShape', 'canRoll', 'canStack', 'canSlide'];

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Neutral title that does not name any target shape' },
    description: { type: Type.STRING, description: 'Neutral one-sentence description with no target answer names' },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: 'Unique stable challenge id' },
          type: { type: Type.STRING, description: 'Challenge type' },
          shape3d: { type: Type.STRING, description: 'cube, sphere, cylinder, cone, or rectangular-prism' },
          displayShape: { type: Type.STRING, description: 'Target solid for property mode' },
          mixedShapes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING }, emoji: { type: Type.STRING }, is3d: { type: Type.BOOLEAN },
              },
              required: ['name', 'emoji', 'is3d'],
            },
          },
          matchPairs: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                realWorldObject: { type: Type.STRING }, emoji: { type: Type.STRING }, shape3d: { type: Type.STRING },
              },
              required: ['realWorldObject', 'emoji', 'shape3d'],
            },
          },
          propertyQuestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: { propertyKey: { type: Type.STRING, description: propertyKeys.join(', ') } },
              required: ['propertyKey'],
            },
          },
        },
        required: ['id', 'type'],
      },
      description: 'Enough source material to yield 4-6 single spoken judged items after collection fan-out',
    },
    gradeBand: { type: Type.STRING, description: 'K or 1' },
    showUnfoldAnimation: { type: Type.BOOLEAN },
    show3dRotation: { type: Type.BOOLEAN },
  },
  required: ['title', 'description', 'challenges', 'gradeBand', 'showUnfoldAnimation', 'show3dRotation'],
};

const tiers: readonly ThreeDShapeTier[] = ['easy', 'medium', 'hard'];
const normalizeTier = (value?: string): ThreeDShapeTier | null => {
  const tier = value?.trim().toLowerCase() ?? '';
  return tiers.includes(tier as ThreeDShapeTier) ? tier as ThreeDShapeTier : null;
};

const supportFor = (tier: ThreeDShapeTier | null) => ({
  supportTier: tier ?? 'medium' as ThreeDShapeTier,
  showElementLabels: tier === 'easy',
  showFaceHighlight: tier === 'easy',
});

/** Code authors truth after Gemini selects only a target/facet. */
export const materializeThreeDShapeChallenge = (
  raw: ThreeDShapeChallengeLike,
  tier: ThreeDShapeTier | null,
): ThreeDShapeChallengeLike => {
  const challenge: ThreeDShapeChallengeLike = { ...raw, ...supportFor(tier) };
  if (challenge.type === '2d-vs-3d') challenge.mixedShapes = (challenge.mixedShapes ?? []).slice(0, COLLECTION_ITEM_CAP);
  if (challenge.type === 'match-to-real-world') challenge.matchPairs = (challenge.matchPairs ?? []).slice(0, COLLECTION_ITEM_CAP);
  if (challenge.type === 'faces-and-properties' && typeof challenge.displayShape === 'string' && challenge.displayShape in SHAPE_FACTS) {
    const shape = challenge.displayShape as ThreeDShapeName;
    challenge.properties = challenge.properties ?? canonicalPropertiesFor(shape);
    const chosenQuestions = challenge.propertyQuestions?.length
      ? challenge.propertyQuestions
      : [{ propertyKey: 'flatFaces' }, { propertyKey: 'curvedSurfaces' }, { propertyKey: 'canRoll' }, { propertyKey: 'canStack' }];
    challenge.propertyQuestions = chosenQuestions.slice(0, COLLECTION_ITEM_CAP).map((question) => {
      const key = question.propertyKey as PropertyKey;
      const expected = propertyKeys.includes(key) ? propertyAnswerFor(shape, key) : null;
      return {
        ...question,
        answerType: key === 'faceShape' ? 'choice' : typeof expected === 'boolean' || expected === 0 ? 'boolean' : 'number',
        correctAnswer: question.correctAnswer ?? (expected === null ? '' : String(expected)),
      };
    });
  }
  if (challenge.type === 'shape-riddle' && typeof challenge.shape3d === 'string' && challenge.shape3d in SHAPE_FACTS && !challenge.clues) {
    challenge.clues = canonicalRiddleCluesFor(challenge.shape3d as ThreeDShapeName);
  }
  return challenge;
};

const FALLBACKS: Record<ThreeDShapeMode, ThreeDShapeChallengeLike[]> = {
  'identify-3d': ['sphere','cube','cylinder','cone'].map((shape, index) => ({ id: `fallback-identify-${index}`, type: 'identify-3d', shape3d: shape })),
  '2d-vs-3d': [{ id: 'fallback-dimension', type: '2d-vs-3d', mixedShapes: [
    { name: 'circle', emoji: '', is3d: false }, { name: 'sphere', emoji: '', is3d: true },
    { name: 'square', emoji: '', is3d: false }, { name: 'cube', emoji: '', is3d: true },
  ] }],
  'match-to-real-world': [{ id: 'fallback-match', type: 'match-to-real-world', matchPairs: [
    { realWorldObject: 'ball', emoji: '⚽', shape3d: 'sphere' }, { realWorldObject: 'toy block', emoji: '🧱', shape3d: 'cube' },
    { realWorldObject: 'soup can', emoji: '🥫', shape3d: 'cylinder' }, { realWorldObject: 'party hat', emoji: '🥳', shape3d: 'cone' },
  ] }],
  'faces-and-properties': [{ id: 'fallback-properties', type: 'faces-and-properties', displayShape: 'cylinder', propertyQuestions: [
    { propertyKey: 'flatFaces' }, { propertyKey: 'curvedSurfaces' }, { propertyKey: 'faceShape' }, { propertyKey: 'canStack' },
  ] }],
  'shape-riddle': ['sphere','cylinder','cone','rectangular-prism'].map((shape, index) => ({ id: `fallback-riddle-${index}`, type: 'shape-riddle', shape3d: shape })),
};

const challengeModes: ThreeDShapeMode[] = ['identify-3d','2d-vs-3d','match-to-real-world','faces-and-properties','shape-riddle'];

type Config = Partial<ThreeDShapeExplorerData> & { targetEvalMode?: string; difficulty?: string };

export const generateThreeDShapeExplorer = async (ctx: GenerationContext): Promise<ThreeDShapeExplorerData> => {
  const config = ctx.raw as Config;
  const evalConstraint = resolveEvalModeConstraint('3d-shape-explorer', config?.targetEvalMode, CHALLENGE_TYPE_DOCS);
  logEvalModeResolution('3DShapeExplorer', config?.targetEvalMode, evalConstraint);
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(schema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : schema;
  const tier = normalizeTier(config?.difficulty);
  const scope = buildScopePromptSection(ctx.scope);
  const typeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `Create a Kindergarten/Grade 1 solid-shape activity about "${ctx.topic}" for ${ctx.gradeContext}.
${scope}
${typeSection}
The five canonical solids are cube, sphere, cylinder, cone, rectangular-prism. The flat names are circle, square, triangle, rectangle.
Generate enough source material for 4-6 JUDGED OPPORTUNITIES after fan-out. Each collection yields at most ${COLLECTION_ITEM_CAP} items.
${evalConstraint ? 'Use only the allowed challenge type.' : 'Mix useful challenge types, keeping equal actions together.'}
Gemini chooses targets, object names, and property facets only. Do not invent geometry facts, property answers, riddles, teaching lines, or answer options; code owns them.
Every property question must carry one explicit propertyKey. Object names must be 1-4 child-owned words and must not contain the target shape name.
Use neutral wrapper text that does not name any target answer. Difficulty ${tier ?? 'medium'} changes visual support only, never the mathematical demand.`;

  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest', contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: activeSchema },
  });
  const parsed = response.text ? JSON.parse(response.text) as Record<string, unknown> : null;
  if (!parsed) throw new Error('No valid 3D shape explorer data returned from Gemini API');

  const rawChallenges = Array.isArray(parsed.challenges) ? parsed.challenges as ThreeDShapeChallengeLike[] : [];
  const dropped: Array<{ id: string; reasons: string[] }> = [];
  let challenges = rawChallenges
    .filter((challenge) => challengeModes.includes(challenge.type as ThreeDShapeMode))
    .map((challenge) => materializeThreeDShapeChallenge(challenge, tier))
    .filter((challenge) => {
      const reasons = gateThreeDShapeChallenge(challenge);
      if (reasons.length) dropped.push({ id: challenge.id ?? '(missing)', reasons });
      // The same item builder used by the component is authoritative. A
      // collection may keep its good children while logging every bad child;
      // an atomic challenge with no defensible item is dropped wholesale.
      return buildThreeDShapeItems([challenge]).items.length > 0;
    });

  let build = buildThreeDShapeItems(challenges);
  if (!build.items.length) {
    const fallbackMode = (evalConstraint?.allowedTypes[0] as ThreeDShapeMode | undefined) ?? 'identify-3d';
    challenges = FALLBACKS[fallbackMode].map((challenge) => materializeThreeDShapeChallenge(challenge, tier));
    challenges = challenges.filter((challenge) => gateThreeDShapeChallenge(challenge).length === 0);
    build = buildThreeDShapeItems(challenges);
  }

  const gradeBand = config.gradeBand === 'K' || config.gradeBand === '1'
    ? config.gradeBand
    : parsed.gradeBand === 'K' ? 'K' : '1';
  const wrapper = wrapperTextForSession(config.title ?? parsed.title, config.description ?? parsed.description, build.items);
  const data: ThreeDShapeExplorerData = {
    ...wrapper,
    challenges: challenges as ThreeDShapeExplorerData['challenges'],
    gradeBand,
    showUnfoldAnimation: config.showUnfoldAnimation ?? (typeof parsed.showUnfoldAnimation === 'boolean' ? parsed.showUnfoldAnimation : gradeBand === '1'),
    show3dRotation: config.show3dRotation ?? (tier !== 'hard'),
  };
  console.log(`[3DShapeExplorer] ${challenges.length} source challenge(s), ${build.items.length} judged item(s), ${build.droppedChallenges} total source drop(s), ${build.droppedItems.length} child drop(s), ${dropped.length} generated gate drop(s).`);
  if (dropped.length) console.warn('[3DShapeExplorer] Dropped generated content:', dropped);
  return data;
};
