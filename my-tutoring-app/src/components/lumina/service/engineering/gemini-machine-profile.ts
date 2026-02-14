import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import types from the component - single source of truth
import type {
  MachineProfileData,
  QuickStats,
  KeyComponent,
  MachineHistory,
  FascinatingFact,
} from '../../primitives/visual-primitives/engineering/MachineProfile';

// Re-export for convenience if needed elsewhere
export type { MachineProfileData };

/**
 * Schema for Quick Stats
 */
const quickStatsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    topSpeed: { type: Type.STRING, nullable: true },
    weight: { type: Type.STRING, nullable: true },
    range: { type: Type.STRING, nullable: true },
    capacity: { type: Type.STRING, nullable: true },
    yearIntroduced: { type: Type.STRING, nullable: true },
    powerSource: { type: Type.STRING, nullable: true },
    size: { type: Type.STRING, nullable: true },
    speedComparison: { type: Type.STRING, nullable: true },
    weightComparison: { type: Type.STRING, nullable: true },
    sizeComparison: { type: Type.STRING, nullable: true },
  },
};

/**
 * Schema for Key Component
 */
const keyComponentSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    description: { type: Type.STRING },
    funAnalogy: { type: Type.STRING, nullable: true },
  },
  required: ['name', 'description'],
};

/**
 * Schema for Machine History
 */
const historySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    inventor: { type: Type.STRING, nullable: true },
    yearInvented: { type: Type.STRING, nullable: true },
    originStory: { type: Type.STRING, nullable: true },
    milestones: { type: Type.ARRAY, items: { type: Type.STRING } },
    famousExamples: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
};

/**
 * Schema for Fascinating Fact
 */
const fascinatingFactSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    icon: { type: Type.STRING, enum: ['sparkles', 'zap', 'gauge', 'clock', 'globe', 'ruler'] },
  },
  required: ['title', 'description'],
};

/**
 * Schema for Machine Profile Data
 */
const machineProfileSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    machineName: {
      type: Type.STRING,
      description: 'Full name of the vehicle/machine (e.g., "Boeing 747-400")'
    },
    designation: {
      type: Type.STRING,
      nullable: true,
      description: 'Model designation (e.g., "747-400", "Model T")'
    },
    nameMeaning: {
      type: Type.STRING,
      nullable: true,
      description: 'Origin of the name if interesting'
    },
    category: {
      type: Type.STRING,
      enum: ['airplane', 'helicopter', 'car', 'train', 'ship', 'truck', 'submarine', 'bicycle', 'construction', 'spacecraft']
    },
    era: {
      type: Type.STRING,
      description: 'Time period (e.g., "1970 — Present")'
    },
    imagePrompt: {
      type: Type.STRING,
      description: 'Vivid prompt for AI image generation'
    },
    quickStats: quickStatsSchema,
    howItWorks: {
      type: Type.STRING,
      description: 'Plain-language operating principle (2-5 sentences)'
    },
    keyComponents: {
      type: Type.ARRAY,
      items: keyComponentSchema
    },
    history: historySchema,
    fascinatingFacts: {
      type: Type.ARRAY,
      items: fascinatingFactSchema
    },
    realWorldConnections: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    relatedMachines: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    gradeBand: {
      type: Type.STRING,
      enum: ['K-2', '3-5']
    },
  },
  required: ['machineName', 'category', 'era', 'imagePrompt', 'howItWorks', 'keyComponents', 'fascinatingFacts', 'gradeBand'],
};

/**
 * Generate Machine Profile data for display
 *
 * Creates comprehensive vehicle/machine profiles appropriate for K-5 engineering education:
 * - K-2: Simple vocabulary, short descriptions, relatable analogies, comparisons to everyday objects
 * - 3-5: More technical vocabulary, detailed explanations, science connections, historical milestones
 *
 * @param topic - The vehicle or machine to profile
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns MachineProfileData with complete profile information
 */
export const generateMachineProfile = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<MachineProfileData>
): Promise<MachineProfileData> => {
  const prompt = `
Create a comprehensive Machine Profile for "${topic}" appropriate for ${gradeLevel} students.

CONTEXT - MACHINE PROFILE:
Machine Profile is a display-only component that presents a rich, educational profile of a vehicle or machine.
It includes quick stats, how-it-works explanation, key components, history, fascinating facts, and real-world connections.
The goal is to spark curiosity and teach engineering concepts through engaging vehicle/machine profiles.

GRADE-LEVEL GUIDELINES:

K-2 (ages 5-8):
- Use simple, everyday vocabulary a young child can understand
- howItWorks: 2-3 short sentences maximum, use simple cause-and-effect language
- keyComponents: Limit to 3 components, each with a funAnalogy that relates to home or playground items
  (e.g., "The engine is like your heart - it pumps energy to make everything move!")
- quickStats: ALWAYS include comparison fields (speedComparison, weightComparison, sizeComparison)
  that compare to things kids know (e.g., "As fast as a cheetah!", "Heavy as 10 elephants!", "As long as 2 school buses!")
- fascinatingFacts: 2-3 facts with genuine "wow" factor, use exclamation marks
- history: Keep originStory to 1-2 sentences, milestones optional (0-2 entries)
- famousExamples: 1-2 well-known examples kids might recognize
- realWorldConnections: 2-3 connections to things kids see in daily life
- gradeBand: "K-2"

3-5 (ages 8-11):
- Use more technical vocabulary but still explain complex terms
- howItWorks: Full paragraph (4-5 sentences), can introduce basic physics concepts
  (thrust, lift, friction, combustion, etc.)
- keyComponents: 4-6 components with detailed descriptions, funAnalogy can reference science concepts
- quickStats: Include real statistics with units, comparisons still welcome but more precise
- fascinatingFacts: 3-5 facts, can include surprising statistics and engineering achievements
- history: Full originStory (2-3 sentences), milestones with 3-5 entries showing evolution,
  famousExamples with 2-4 entries
- realWorldConnections: 3-5 connections, can link to science curriculum topics
  (forces, energy, materials science)
- relatedMachines: 2-4 related vehicles/machines for further exploration
- gradeBand: "3-5"

ALWAYS:
- imagePrompt: Create a vivid, detailed prompt suitable for AI image generation.
  Describe the machine in a dramatic, photorealistic style with clear lighting and perspective.
  Example: "A gleaming Boeing 747-400 in flight against a deep blue sky with scattered clouds,
  seen from a slightly low angle, sunlight reflecting off its polished aluminum fuselage"
- Use genuine, accurate statistics - do not make up numbers
- fascinatingFacts should produce genuine "wow" reactions - surprising, counterintuitive, or amazing
- Every fact title should be catchy and intriguing
- icon choices for facts: 'sparkles' (amazing/cool), 'zap' (power/speed), 'gauge' (measurements),
  'clock' (time/history), 'globe' (world/geography), 'ruler' (size/dimensions)
- category must match the machine type accurately
- era should reflect when the machine was in active use or introduced

${config ? `
CONFIGURATION HINTS FROM MANIFEST:
${config.machineName ? `- Machine name: ${config.machineName}` : ''}
${config.category ? `- Category: ${config.category}` : ''}
${config.gradeBand ? `- Grade band: ${config.gradeBand}` : ''}
${config.era ? `- Era: ${config.era}` : ''}
${config.designation ? `- Designation: ${config.designation}` : ''}
` : ''}

VALIDATION REQUIREMENTS:
1. machineName must be the full, recognizable name of the machine
2. category must be one of: airplane, helicopter, car, train, ship, truck, submarine, bicycle, construction, spacecraft
3. keyComponents must have at least 1 entry (K-2: exactly 3, 3-5: 4-6)
4. fascinatingFacts must have at least 1 entry (K-2: 2-3, 3-5: 3-5)
5. Each fascinatingFact must have a title, description, and valid icon
6. imagePrompt must be detailed enough to generate a quality image
7. gradeBand must be either "K-2" or "3-5"
8. quickStats should have at least 3 filled fields

Return a complete Machine Profile with rich, accurate, and engaging content for the specified grade level.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: machineProfileSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid Machine Profile data returned from Gemini API');
  }

  // Validation: ensure machineName is present
  if (!data.machineName || data.machineName.trim() === '') {
    console.warn('Missing machineName. Setting from topic.');
    data.machineName = topic;
  }

  // Validation: ensure category is valid
  const validCategories = ['airplane', 'helicopter', 'car', 'train', 'ship', 'truck', 'submarine', 'bicycle', 'construction', 'spacecraft'];
  if (!data.category || !validCategories.includes(data.category)) {
    console.warn('Invalid category. Setting default.');
    data.category = 'car';
  }

  // Validation: ensure keyComponents has at least 1 entry
  if (!data.keyComponents || data.keyComponents.length === 0) {
    console.warn('No keyComponents provided. Setting defaults.');
    data.keyComponents = [
      { name: 'Engine', description: 'The part that provides power to make the machine work.' },
      { name: 'Frame', description: 'The strong structure that holds everything together.' },
      { name: 'Controls', description: 'The parts the operator uses to steer and control the machine.' },
    ];
  }

  // Validation: ensure each keyComponent has required fields
  data.keyComponents = data.keyComponents.map((c: KeyComponent) => ({
    name: c.name || 'Component',
    description: c.description || 'An important part of this machine.',
    funAnalogy: c.funAnalogy || undefined,
  }));

  // Validation: ensure fascinatingFacts has at least 1 entry
  if (!data.fascinatingFacts || data.fascinatingFacts.length === 0) {
    console.warn('No fascinatingFacts provided. Setting defaults.');
    data.fascinatingFacts = [
      { title: 'Amazing Machine', description: `The ${data.machineName} is an incredible feat of engineering!`, icon: 'sparkles' },
    ];
  }

  // Validation: ensure each fact has valid icon
  const validIcons = ['sparkles', 'zap', 'gauge', 'clock', 'globe', 'ruler'];
  data.fascinatingFacts = data.fascinatingFacts.map((f: FascinatingFact) => ({
    title: f.title || 'Interesting Fact',
    description: f.description || 'This machine has many fascinating features.',
    icon: f.icon && validIcons.includes(f.icon) ? f.icon : 'sparkles',
  }));

  // Validation: ensure gradeBand is valid, default based on gradeLevel string
  if (!data.gradeBand || !['K-2', '3-5'].includes(data.gradeBand)) {
    const gl = gradeLevel.toLowerCase();
    if (gl.includes('k') || gl.includes('kindergarten') || gl.includes('1') || gl.includes('2')) {
      data.gradeBand = 'K-2';
    } else {
      data.gradeBand = '3-5';
    }
  }

  // Validation: ensure howItWorks is present
  if (!data.howItWorks || data.howItWorks.trim() === '') {
    data.howItWorks = `The ${data.machineName} is a fascinating machine that uses engineering principles to accomplish its task.`;
  }

  // Validation: ensure imagePrompt is present
  if (!data.imagePrompt || data.imagePrompt.trim() === '') {
    data.imagePrompt = `A detailed, photorealistic image of a ${data.machineName}, shown from a dramatic angle with clear lighting.`;
  }

  // Validation: ensure era is present
  if (!data.era || data.era.trim() === '') {
    data.era = 'Modern Era';
  }

  // Ensure arrays exist even if empty
  if (!data.realWorldConnections) data.realWorldConnections = [];
  if (!data.relatedMachines) data.relatedMachines = [];
  if (!data.history) data.history = {};
  if (!data.history.milestones) data.history.milestones = [];
  if (!data.history.famousExamples) data.history.famousExamples = [];
  if (!data.quickStats) data.quickStats = {};

  // Apply config overrides
  if (config) {
    if (config.machineName) data.machineName = config.machineName;
    if (config.designation !== undefined) data.designation = config.designation;
    if (config.nameMeaning !== undefined) data.nameMeaning = config.nameMeaning;
    if (config.category) data.category = config.category;
    if (config.era) data.era = config.era;
    if (config.imagePrompt) data.imagePrompt = config.imagePrompt;
    if (config.quickStats) data.quickStats = { ...data.quickStats, ...config.quickStats };
    if (config.howItWorks) data.howItWorks = config.howItWorks;
    if (config.keyComponents) data.keyComponents = config.keyComponents;
    if (config.history) data.history = { ...data.history, ...config.history };
    if (config.fascinatingFacts) data.fascinatingFacts = config.fascinatingFacts;
    if (config.realWorldConnections) data.realWorldConnections = config.realWorldConnections;
    if (config.relatedMachines) data.relatedMachines = config.relatedMachines;
    if (config.gradeBand) data.gradeBand = config.gradeBand;
  }

  return data;
};

/**
 * Generate a machine image using Gemini's image generation
 *
 * @param imagePrompt - The detailed prompt for generating the machine image
 * @returns Base64 data URL of the generated image, or null if generation fails
 */
export const generateMachineImage = async (imagePrompt: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{
        role: 'user',
        parts: [{
          text: `Generate a detailed, photorealistic engineering illustration: ${imagePrompt}.
Style: Photorealistic or high-quality technical illustration, suitable for students.
Show the machine/vehicle with clear details and dramatic perspective. No text in the image.`
        }]
      }],
      config: {
        responseModalities: ['IMAGE', 'TEXT'],
        imageConfig: {
          aspectRatio: '16:9',
        },
      }
    });

    // Extract image from response
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.mimeType?.startsWith('image/')) {
          const base64Data = part.inlineData.data;
          return `data:${part.inlineData.mimeType};base64,${base64Data}`;
        }
      }
    }
    return null;
  } catch (error) {
    console.error('Error generating machine image:', error);
    return null;
  }
};
