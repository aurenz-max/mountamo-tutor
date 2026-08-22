import { Type, type Schema } from '@google/genai';
import { ai } from '../geminiClient';
import type { GenerationContext } from '../generation/generationContext';
import { resolveBiologyBand } from './gradeBand';
import { buildScopePromptSection } from '../scopeContext';
import {
  buildModeConstraintSection,
  constrainChallengeTypeEnum,
  resolveEvalModes,
  type ChallengeTypeDoc,
} from '../evalMode';
import type {
  HabitatChallenge,
  HabitatChallengeType,
  HabitatDioramaData,
} from '../../primitives/visual-primitives/biology/HabitatDiorama';
import { itemFromChallenge } from '../../primitives/visual-primitives/biology/habitatDioramaScript';

export const ALL_HABITAT_CHALLENGE_TYPES: HabitatChallengeType[] = [
  'observe', 'connect', 'predict', 'restore', 'defend',
];

export const HABITAT_CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  observe: {
    promptDoc:
      '"observe": The learner uses an ecological-role clue to SAY the name of one living thing from the visible habitat. focusOrganismId is the answer; prompt must not contain its common name.',
    schemaDescription: "'observe' (name a living thing from ecological evidence)",
  },
  connect: {
    promptDoc:
      '"connect": The learner BUILDS one ecological relationship by linking fromId to toId, in the direction energy or benefit flows (for predation, fromId is eaten by toId). The pair must exist in relationships; prompt may name the source but never the destination.',
    schemaDescription: "'connect' (build an ecological relationship)",
  },
  predict: {
    promptDoc:
      '"predict": The learner hears one disruption and SAYS which visible population will increase, decrease, or stay similar. affectedOrganismId is the answer and must not be named in disruptionEvent.',
    schemaDescription: "'predict' (predict a population response)",
  },
  restore: {
    promptDoc:
      '"restore": The learner PLACES restorationEntityId into its best habitat zone. restorationZone must be canopy, open-land, water, shoreline, ground, or underground.',
    schemaDescription: "'restore' (place a restoration part in its viable zone)",
  },
  defend: {
    promptDoc:
      '"defend": The learner sees one ecological claim and 3 ear-separable evidence cards, then SAYS which evidence best supports the claim. correctEvidenceId identifies the key.',
    schemaDescription: "'defend' (select evidence for an ecological claim)",
  },
};

const positionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    x: { type: Type.STRING, description: 'Horizontal percentage, e.g. 25%' },
    y: { type: Type.STRING, description: 'Vertical percentage, e.g. 65%' },
  },
  required: ['x', 'y'],
};

export const habitatDioramaSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    primitiveType: { type: Type.STRING, enum: ['habitat-diorama'] },
    habitat: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING }, biome: { type: Type.STRING },
        climate: { type: Type.STRING }, description: { type: Type.STRING },
      },
      required: ['name', 'biome', 'climate', 'description'],
    },
    organisms: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING }, commonName: { type: Type.STRING },
          role: { type: Type.STRING, enum: ['producer', 'primary-consumer', 'secondary-consumer', 'tertiary-consumer', 'decomposer'] },
          imagePrompt: { type: Type.STRING }, position: positionSchema,
          description: { type: Type.STRING },
          adaptations: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['id', 'commonName', 'role', 'imagePrompt', 'position', 'description', 'adaptations'],
      },
    },
    relationships: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          fromId: { type: Type.STRING }, toId: { type: Type.STRING },
          type: { type: Type.STRING, enum: ['predation', 'symbiosis-mutualism', 'symbiosis-commensalism', 'symbiosis-parasitism', 'competition'] },
          description: { type: Type.STRING },
        },
        required: ['fromId', 'toId', 'type', 'description'],
      },
    },
    environmentalFeatures: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING }, name: { type: Type.STRING },
          description: { type: Type.STRING }, position: positionSchema,
        },
        required: ['id', 'name', 'description', 'position'],
      },
    },
    disruptionScenario: {
      type: Type.OBJECT,
      properties: {
        event: { type: Type.STRING },
        cascadeEffects: { type: Type.ARRAY, items: { type: Type.STRING } },
        question: { type: Type.STRING },
      },
      required: ['event', 'cascadeEffects', 'question'],
    },
    challenges: {
      // Gemini Flash Lite rejects this schema when every nested array is
      // bounded (INVALID_ARGUMENT). Bound the session fan-out here, where
      // output size matters most; prompts and build gates bound scene arrays.
      type: Type.ARRAY, minItems: '5', maxItems: '8',
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          type: { type: Type.STRING, enum: ALL_HABITAT_CHALLENGE_TYPES },
          prompt: { type: Type.STRING, description: 'Content focus or claim. Never include the answer text.' },
          explanation: { type: Type.STRING, description: 'Earned explanation shown/spoken only after a verdict.' },
          focusOrganismId: { type: Type.STRING },
          optionOrganismIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          fromId: { type: Type.STRING }, toId: { type: Type.STRING },
          disruptionEvent: { type: Type.STRING }, affectedOrganismId: { type: Type.STRING },
          expectedTrend: { type: Type.STRING, enum: ['increase', 'decrease', 'stay-similar'] },
          restorationEntityId: { type: Type.STRING },
          restorationZone: { type: Type.STRING, enum: ['canopy', 'open-land', 'water', 'shoreline', 'ground', 'underground'] },
          evidenceChoices: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: { id: { type: Type.STRING }, text: { type: Type.STRING } },
              required: ['id', 'text'],
            },
          },
          correctEvidenceId: { type: Type.STRING },
        },
        required: ['id', 'type', 'prompt', 'explanation'],
      },
    },
    gradeBand: { type: Type.STRING, enum: ['K-2', '3-5', '6-8'] },
  },
  required: ['primitiveType', 'habitat', 'organisms', 'relationships', 'environmentalFeatures', 'challenges', 'gradeBand'],
};

const gradeGuidance: Record<HabitatDioramaData['gradeBand'], string> = {
  'K-2': `
- 5 familiar living things; child-sized descriptions and no unexplained technical vocabulary.
- Include a producer, two consumers, and a decomposer so observation has real contrasts.
- Relationships are concrete feeding/helping connections.
- Predict uses one simple change and one direct consequence; do not generate a complex disruption panel.
- Evidence cards are one short sentence each and can be understood when read aloud.`,
  '3-5': `
- 6-8 organisms spanning a food chain, including a decomposer.
- Include predation plus one mutualism or competition relationship.
- Predictions trace one or two steps through a food chain.
- Restoration connects habitat needs (food, water, shelter) to a defensible zone.
- Evidence cards distinguish cause from coincidence.`,
  '6-8': `
- 8-9 organisms across trophic levels, including a decomposer and a keystone or ecosystem-engineer role.
- Use predation, competition, and at least one form of symbiosis.
- Predictions may use trophic cascades, competitive release, or abiotic-biotic feedback.
- Restoration choices must expose a trade-off, not merely replace the removed species.
- Evidence cards use precise ecological mechanisms but remain concise enough to say aloud.`,
};

const challengeRules = `
CHALLENGE CONTRACT — every generated item must survive code gates:
- Generate 5 challenges, not 1-3. In a pinned session all 5 use the allowed type; in a blend distribute the 5 across allowed types.
- Within one type, use a different answer each time: different target organisms, relationship pairs, habitat zones, or evidence keys. A tutor verdict names the answer, so repetition is invalid recall.
- IDs must reference organisms and relationships in THIS payload. Never invent an ID in a challenge.
- prompt, explanation, organism names, events, and evidence must never begin a sentence with "Yes" or "My turn".
- Observe: focusOrganismId is the answer. prompt must not contain its common name. Supply 3-5 optionOrganismIds including it.
- Connect: fromId -> toId must exactly match one relationship. prompt may name the source, NEVER the destination.
- RELATIONSHIP DIRECTION is not free: fromId -> toId always follows the flow of ENERGY or BENEFIT. For predation fromId is EATEN and toId EATS it. For parasitism fromId is the host and toId the parasite. For commensalism fromId is the one used and toId the one that benefits. Mutualism and competition are symmetric. The tutor speaks this direction aloud, so an inverted edge becomes a false sentence and the item is dropped.
- Predict: affectedOrganismId is the downstream answer. disruptionEvent must NOT name that organism. Supply 3-5 optionOrganismIds including it. expectedTrend must follow from the food web.
- Restore: restorationEntityId names the temporarily missing organism; restorationZone is where it can actually meet its needs. Do not make the zone obvious from the organism's generated name.
- Defend: prompt is a claim, not a question with the answer embedded. Provide exactly 3 evidenceChoices. Each choice needs at least one distinctive content word so a child can say a short form without matching two cards.
- explanation is EARNED feedback. It may name the answer, but nothing shown before the verdict may do so.
- Generate several challenges of the allowed type in a pinned session. In a blended or mixed session, distribute types; do not collapse to one type.`;

export const filterHabitatChallenges = (
  challenges: readonly HabitatChallenge[],
  data: Pick<HabitatDioramaData, 'organisms' | 'relationships'>,
  allowedTypes: readonly HabitatChallengeType[] = ALL_HABITAT_CHALLENGE_TYPES,
): HabitatChallenge[] => challenges.filter((challenge, index) => (
  allowedTypes.includes(challenge.type) && itemFromChallenge(challenge, data, index) !== null
));

export const generateHabitatDiorama = async (ctx: GenerationContext): Promise<HabitatDioramaData> => {
  const config = ctx.raw as Partial<HabitatDioramaData>;
  const gradeBand = resolveBiologyBand(config.gradeBand, ctx.grade, ctx.gradeContext);
  const resolution = await resolveEvalModes(
    'habitat-diorama',
    { targetEvalMode: ctx.targetEvalMode, intent: ctx.intent, objectiveText: ctx.objective.text },
    HABITAT_CHALLENGE_TYPE_DOCS,
  );
  const challengeTypeSection = buildModeConstraintSection(resolution, HABITAT_CHALLENGE_TYPE_DOCS);
  const activeSchema = resolution
    ? constrainChallengeTypeEnum(habitatDioramaSchema, resolution.allowedTypes, HABITAT_CHALLENGE_TYPE_DOCS)
    : habitatDioramaSchema;

  console.log(`[HabitatDiorama] modes: ${resolution ? `${resolution.modes.map((mode) => mode.evalMode).join('+')} (${resolution.source})` : 'mixed'} -> types [${(resolution?.allowedTypes ?? ALL_HABITAT_CHALLENGE_TYPES).join(', ')}]`);

  const prompt = `Create a living ecosystem mission for "${ctx.topic}".
${buildScopePromptSection(ctx.scope)}

TARGET GRADE BAND: ${gradeBand}
OBJECTIVE: ${ctx.intent || ctx.objective.text || ctx.topic}
${gradeGuidance[gradeBand]}

${challengeTypeSection}

SCENE:
- Create one coherent habitat, not a bag of organisms.
- Organism positions are percentage strings. Spread them across the scene with at least 12 percentage points between centers.
- Every relationship must use valid organism IDs and be scientifically defensible in this specific habitat.
- Descriptions explain observable evidence and ecological function without copying a challenge answer verbatim.
- ${gradeBand === 'K-2' ? 'Omit disruptionScenario; simple changes live only inside predict challenges.' : 'Include one disruptionScenario with a causal cascade.'}

${challengeRules}

The result should feel like field work: observe evidence, build a connection, predict a consequence, restore a viable part, and defend a claim — constrained to the selected mode or modes.`;

  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: prompt,
    config: {
      responseMimeType: 'application/json', responseSchema: activeSchema,
      systemInstruction: 'You are an expert K-8 ecology educator and assessment designer. You make causal ecosystem reasoning visible without leaking keys. Every relationship and population prediction is scientifically defensible.',
    },
  });
  if (!response.text) throw new Error('No habitat diorama data returned from Gemini');
  const generated = JSON.parse(response.text) as HabitatDioramaData;
  const merged: HabitatDioramaData = { ...generated, ...config, gradeBand };
  const rawChallenges = (config.challenges ?? generated.challenges ?? []) as HabitatChallenge[];
  const allowed = (resolution?.allowedTypes ?? ALL_HABITAT_CHALLENGE_TYPES) as HabitatChallengeType[];
  const challenges = filterHabitatChallenges(rawChallenges, merged, allowed);
  const finalData: HabitatDioramaData = {
    ...merged,
    challengeType: (allowed[0] ?? challenges[0]?.type ?? 'observe') as HabitatChallengeType,
    challengeTypes: allowed,
    challenges,
    supportTier: resolution?.modes.length === 1 ? ctx.supportTier : undefined,
  };
  console.log('Habitat Diorama generated:', {
    habitat: finalData.habitat.name, gradeBand, organisms: finalData.organisms.length,
    relationships: finalData.relationships.length, challenges: finalData.challenges?.length ?? 0,
    droppedChallenges: rawChallenges.length - challenges.length,
  });
  return finalData;
};
