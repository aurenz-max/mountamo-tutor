import { Type, Schema, ThinkingLevel } from "@google/genai";

import {
  ExhibitManifest,
  ManifestItem,
} from "../../types";

import { ai } from "../geminiClient";

// Import modular catalog (Phase 3 refactor)
import { UNIVERSAL_CATALOG } from './catalog';

/**
 * Convert objective-centric manifest to flat layout array for backward compatibility
 * This allows the existing rendering pipeline to work with the new manifest format
 */
export const flattenManifestToLayout = (manifest: ExhibitManifest): ManifestItem[] => {
  const layout: ManifestItem[] = [];

  // 1. Add curator brief first
  if (manifest.curatorBrief) {
    layout.push({
      componentId: 'curator-brief',
      instanceId: manifest.curatorBrief.instanceId,
      title: manifest.curatorBrief.title,
      intent: manifest.curatorBrief.intent,
      objectiveIds: manifest.objectiveBlocks?.map(b => b.objectiveId) || []
    });
  }

  // 2. Add all components from each objective block
  if (manifest.objectiveBlocks) {
    for (const block of manifest.objectiveBlocks) {
      for (const component of block.components) {
        layout.push({
          componentId: component.componentId,
          instanceId: component.instanceId,
          title: component.title,
          intent: component.intent,
          config: {
            ...component.config,
            // Inject objective context into config for content generators
            objectiveId: block.objectiveId,
            objectiveText: block.objectiveText,
            objectiveVerb: block.objectiveVerb,
          },
          objectiveIds: [block.objectiveId]
        });
      }
    }
  }

  // 3. Add final assessment last
  if (manifest.finalAssessment) {
    layout.push({
      componentId: manifest.finalAssessment.componentId,
      instanceId: manifest.finalAssessment.instanceId,
      title: manifest.finalAssessment.title,
      intent: manifest.finalAssessment.intent,
      config: manifest.finalAssessment.config,
      objectiveIds: manifest.objectiveBlocks?.map(b => b.objectiveId) || []
    });
  }

  return layout;
};

/**
 * Enrich manifest with flattened layout for backward compatibility
 */
export const enrichManifestWithLayout = (manifest: ExhibitManifest): ExhibitManifest => {
  return {
    ...manifest,
    layout: flattenManifestToLayout(manifest)
  };
};

/**
 * Convert grade level to descriptive educational context for prompts
 */
const getGradeLevelContext = (gradeLevel: string): string => {
  const contexts: Record<string, string> = {
    'toddler': 'toddlers (ages 1-3) - Use very simple language, basic concepts, concrete examples, and playful engagement. Focus on sensory experiences and foundational learning.',
    'preschool': 'preschool children (ages 3-5) - Use simple sentences, colorful examples, storytelling, and hands-on concepts. Build curiosity and wonder.',
    'kindergarten': 'kindergarten students (ages 5-6) - Use clear language, relatable examples, foundational skills, and engaging visuals. Encourage exploration and basic problem-solving.',
    'elementary': 'elementary students (grades 1-5) - Use age-appropriate vocabulary, concrete examples, structured learning objectives, and interactive elements. Build fundamental understanding.',
    'middle-school': 'middle school students (grades 6-8) - Use more complex vocabulary, abstract concepts, real-world applications, and critical thinking opportunities. Encourage deeper analysis.',
    'high-school': 'high school students (grades 9-12) - Use advanced vocabulary, sophisticated concepts, academic rigor, and college-prep content. Foster analytical and creative thinking.',
    'undergraduate': 'undergraduate college students - Use academic language, theoretical frameworks, research-based content, and interdisciplinary connections. Promote scholarly engagement.',
    'graduate': 'graduate students (Master\'s level) - Use specialized terminology, advanced theoretical concepts, research methodologies, and professional applications. Encourage critical scholarship.',
    'phd': 'doctoral students and researchers - Use expert-level terminology, cutting-edge research, theoretical depth, and scholarly discourse. Foster original thinking and research contributions.'
  };

  return contexts[gradeLevel] || contexts['elementary'];
};


// ============================================================================
// MANIFEST-FIRST ARCHITECTURE
// ============================================================================

// UNIVERSAL_CATALOG is now imported from './catalog' (Phase 3 refactor)
// This reduces context debt by splitting the catalog into domain-specific modules:
//   - catalog/math.ts (23 components)
//   - catalog/engineering.ts (4 components)
//   - catalog/science.ts (2 components)
//   - catalog/literacy.ts (2 components)
//   - catalog/media.ts (4 components)
//   - catalog/assessment.ts (2 components)
//   - catalog/core.ts (12 components)
//
// To add a new primitive, add it to the appropriate domain catalog file.
// The UNIVERSAL_CATALOG is automatically aggregated from all domain catalogs.

// Re-export for backward compatibility
export { UNIVERSAL_CATALOG };

/**
 * Schema for a single component within an objective
 */
const objectiveComponentSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    componentId: {
      type: Type.STRING,
      enum: UNIVERSAL_CATALOG.map(c => c.id),
      description: "Component type from the universal catalog"
    },
    instanceId: {
      type: Type.STRING,
      description: "Unique identifier for this instance (e.g., 'obj1-number-line-1', 'obj2-concept-cards')"
    },
    title: {
      type: Type.STRING,
      description: "Display title/heading for this section"
    },
    intent: {
      type: Type.STRING,
      description: "Detailed instructions for what content to generate. MUST directly address the parent objective."
    },
    config: {
      type: Type.OBJECT,
      description: "Optional configuration hints and educational context",
      properties: {
        visualType: { type: Type.STRING, description: "Type of visualization (e.g., 'bar-model', 'number-line')" },
        itemCount: { type: Type.NUMBER, description: "Number of items to generate" },
        difficulty: { type: Type.STRING, description: "Difficulty level" },
        subject: { type: Type.STRING, description: "Subject area (e.g., 'Mathematics', 'Science', 'Language Arts')" },
        unitTitle: { type: Type.STRING, description: "Broader unit context" },
        problemType: {
          type: Type.STRING,
          enum: ["multiple_choice", "true_false", "fill_in_blanks", "matching_activity", "sequencing_activity", "categorization_activity", "scenario_question", "short_answer"],
          description: "For knowledge-check components: Type of problem to generate"
        },
        count: { type: Type.NUMBER, description: "For knowledge-check components: Number of problems to generate" },
        gradeLevel: { type: Type.STRING, description: "For knowledge-check components: Override grade level for this specific check" },
        keyTerms: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Key vocabulary terms to emphasize in the visualization"
        },
        conceptsCovered: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Core concepts to illustrate"
        }
      }
    }
  },
  required: ["componentId", "instanceId", "title", "intent"]
};

/**
 * Manifest Schema for structured output - OBJECTIVE-CENTRIC design
 * Each objective gets its own dedicated set of components (1-to-many)
 */
const manifestSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    topic: { type: Type.STRING },
    gradeLevel: { type: Type.STRING },
    themeColor: {
      type: Type.STRING,
      description: "Hex color code for the exhibit theme (e.g., #3b82f6)"
    },
    // Curator brief is standalone - introduces all objectives
    curatorBrief: {
      type: Type.OBJECT,
      description: "The introductory curator-brief component (always first)",
      properties: {
        instanceId: { type: Type.STRING },
        title: { type: Type.STRING },
        intent: { type: Type.STRING }
      },
      required: ["instanceId", "title", "intent"]
    },
    // Each objective gets its own dedicated components
    objectiveBlocks: {
      type: Type.ARRAY,
      description: "Array of objective blocks. Each objective has its own dedicated components that teach ONLY that objective.",
      items: {
        type: Type.OBJECT,
        properties: {
          objectiveId: {
            type: Type.STRING,
            description: "The objective ID (e.g., 'obj1', 'obj2')"
          },
          objectiveText: {
            type: Type.STRING,
            description: "The full learning objective text"
          },
          objectiveVerb: {
            type: Type.STRING,
            description: "The Bloom's taxonomy verb (identify, explain, apply, etc.)"
          },
          components: {
            type: Type.ARRAY,
            description: "2-4 components dedicated to teaching THIS specific objective. Order matters: start with introduction/explanation, then practice/application.",
            items: objectiveComponentSchema
          }
        },
        required: ["objectiveId", "objectiveText", "objectiveVerb", "components"]
      }
    },
    // Final assessment covers all objectives
    finalAssessment: {
      type: Type.OBJECT,
      description: "Optional final knowledge-check or flashcard-deck that assesses ALL objectives together",
      properties: {
        componentId: {
          type: Type.STRING,
          enum: ["knowledge-check", "flashcard-deck"],
          description: "Either knowledge-check or flashcard-deck"
        },
        instanceId: { type: Type.STRING },
        title: { type: Type.STRING },
        intent: {
          type: Type.STRING,
          description: "Should assess understanding across ALL learning objectives"
        },
        config: {
          type: Type.OBJECT,
          properties: {
            problemType: { type: Type.STRING },
            count: { type: Type.NUMBER },
            difficulty: { type: Type.STRING }
          }
        }
      },
      required: ["componentId", "instanceId", "title", "intent"]
    }
  },
  required: ["topic", "gradeLevel", "themeColor", "curatorBrief", "objectiveBlocks"]
};

/**
 * Progress callback for manifest generation
 */
export interface ManifestProgressCallback {
  onThinking?: (thought: string) => void;
  onProgress?: (message: string) => void;
  onPartialManifest?: (partial: Partial<ExhibitManifest>) => void;
}

/**
 * Generate Exhibit Manifest with Streaming (Phase 1 - The Blueprint)
 * This creates a plan for what components to use WITHOUT generating content
 * Supports real-time progress updates and thinking visibility
 */
export const generateExhibitManifestStreaming = async (
  topic: string,
  gradeLevel: string = 'elementary',
  objectives?: Array<{ id: string; text: string; verb: string; icon: string }>,
  callbacks?: ManifestProgressCallback
): Promise<ExhibitManifest> => {
  try {
    const gradeLevelContext = getGradeLevelContext(gradeLevel);
    const catalogContext = UNIVERSAL_CATALOG.map(c =>
      `- ${c.id}: ${c.description}${c.constraints ? ` [${c.constraints}]` : ''}`
    ).join('\n');

    // Format objectives if provided
    const objectivesContext = objectives
      ? `\n\nLEARNING OBJECTIVES (Use these to guide component selection):
${objectives.map((obj, i) => `${i + 1}. ${obj.text} [${obj.verb}]`).join('\n')}`
      : '';

    const prompt = `You are the Lead Curator designing an educational exhibit using an OBJECTIVE-CENTRIC approach.

ASSIGNMENT: Create a manifest (blueprint) for: "${topic}"
TARGET AUDIENCE: ${gradeLevelContext}${objectivesContext}

AVAILABLE COMPONENT TOOLS:
${catalogContext}

## CRITICAL: OBJECTIVE-CENTRIC DESIGN

This manifest is structured around LEARNING OBJECTIVES, not a flat list of components.
Each objective gets its own dedicated set of 2-4 components (1-to-many relationship).

STRUCTURE:
1. curatorBrief: Introduces the topic and ALL objectives (always first)
2. objectiveBlocks: Array where EACH objective has its own dedicated components
3. finalAssessment: Optional quiz/flashcards covering ALL objectives (at the end)

## COMPONENT SELECTION BY SUBJECT:
- Elementary Math (Counting, Addition, Subtraction) → 'number-line', 'bar-model', 'tape-diagram'
- Elementary Math (Place Value) → 'base-ten-blocks', 'place-value-chart'
- Elementary Math (Fractions) → 'fraction-circles', 'fraction-bar'
- Elementary Math (Multiplication) → 'array-grid', 'area-model', 'bar-model'
- Elementary Math (Geometry) → 'geometric-shape'
- Elementary Math (Patterns, Input-Output) → 'function-machine'
- Elementary Math (Data, Counting Frequency) → 'dot-plot'
- Elementary/Middle School Math (Prime Factorization, GCF, LCM) → 'factor-tree'
- Middle School Math (Ratios, Proportions, Unit Rates) → 'double-number-line', 'ratio-table'
- Middle School Math (Percent, Conversions) → 'double-number-line', 'percent-bar'
- Middle School Math (Statistics, Mean, Median, Mode, Data Distribution) → 'dot-plot'
- Middle School Math (Comparing Data Sets) → 'dot-plot' (parallel mode)
- Middle School Math (Multi-digit Multiplication, Distributive Property) → 'area-model'
- Middle School Math (Functions, Function Notation) → 'function-machine', 'graph-board'
- Middle School Math (Ordered Pairs, Coordinate Plane) → 'coordinate-graph'
- Middle School Math (Slope, Rise Over Run) → 'slope-triangle', 'coordinate-graph'
- Pre-Algebra/Algebra (Equations, Equality, Solving) → 'balance-scale', 'tape-diagram'
- Algebra (Linear Equations, Slope, Intercepts, Systems of Equations) → 'slope-triangle', 'coordinate-graph', 'systems-equations-visualizer', 'graph-board'
- Algebra (Systems of Equations, Substitution, Elimination) → 'systems-equations-visualizer', 'coordinate-graph'
- Algebra (Linear Functions, Function Concepts) → 'function-machine', 'graph-board', 'coordinate-graph'
- Geometry (Parallel/Perpendicular Lines, Angle of Inclination) → 'slope-triangle', 'coordinate-graph'
- Algebra (Binomial/Polynomial Multiplication) → 'area-model' (algebraic mode)
- Algebra 2 (Quadratic Functions, Parabolas, Vertex Form) → 'coordinate-graph'
- Algebra 2 (Function Composition, Inverse Functions) → 'function-machine'
- Algebra 2 (Matrices, Determinants, Matrix Operations, Solving Systems with Matrices) → 'matrix-display', 'systems-equations-visualizer'
- Precalculus (Matrix Transformations, Inverse Matrices) → 'matrix-display'
- Precalculus (Function Families, Transformations) → 'coordinate-graph'
- Math Problem-Solving → 'annotated-example' for worked solutions, 'tape-diagram' for word problems
- Science/Chemistry → 'molecule-viewer', 'periodic-table', 'formula-card', 'custom-visual'
- Biology/Life Sciences (K-8) → 'species-profile' for dinosaurs, animals, plants, extinct/living species; perfect for paleontology, zoology, taxonomy, habitats, adaptations, ecosystems, food chains
- Engineering/Simple Machines (K-5) → 'lever-lab' for levers, balance, mechanical advantage; 'pulley-system-builder' for pulleys, lifting, rope systems; 'ramp-lab' for inclined planes, ramps, friction, force trade-offs; 'wheel-axle-explorer' for wheel and axle, doorknobs, winches, steering wheels, gear ratios
- Foundational Concepts (IDENTIFY objectives) → 'foundation-explorer' for introducing key vocabulary, parts, and components across all subjects
- History/Social Studies → 'comparison-panel', 'generative-table', 'feature-exhibit'
- Language Arts → 'sentence-analyzer', 'word-builder', 'concept-card-grid'
- Any topic with visuals → 'image-panel', 'image-comparison', 'media-player'
- Vocabulary/Memorization → 'flashcard-deck', 'concept-card-grid'

## RULES FOR EACH OBJECTIVE BLOCK:
1. Include 2-4 components per objective (not too few, not too many)
2. Components should PROGRESS within each objective through these PHASES:
   - Phase 1 (Introduce): Explain core vocabulary/concepts
   - Phase 2 (Visualize): Demonstrate with an interactive or visual tool
   - Phase 3 (Apply): Practice or worked examples
   
3. **CRITICAL: For each phase, consult the COMPONENT SELECTION BY SUBJECT section above 
   to choose the MOST SPECIFIC component for the topic.** 
   - If teaching fractions → use 'fraction-circles' or 'fraction-bar', NOT 'custom-visual'
   - If teaching systems of equations → use 'systems-equations-visualizer', NOT 'coordinate-graph'
   - If teaching slope → use 'slope-triangle', NOT 'annotated-example'
   
4. Each component's intent MUST directly address its parent objective
5. Use instanceIds that reference the objective (e.g., 'obj1-number-line')
## EXAMPLE MANIFEST (Addition for Kindergarten with 3 objectives):

{
  "topic": "Addition for Kindergarten",
  "gradeLevel": "kindergarten",
  "themeColor": "#3b82f6",
  "curatorBrief": {
    "instanceId": "curator-brief-1",
    "title": "Welcome to Addition!",
    "intent": "Create a warm, engaging introduction about adding numbers together. Preview all three learning objectives in kid-friendly language."
  },
  "objectiveBlocks": [
    {
      "objectiveId": "obj1",
      "objectiveText": "Understand what addition means",
      "objectiveVerb": "identify",
      "components": [
        {
          "componentId": "concept-card-grid",
          "instanceId": "obj1-concepts",
          "title": "What is Addition?",
          "intent": "Define addition in simple terms. Key concepts: 'putting together', 'more', 'total'. Use relatable examples like toys or snacks."
        },
        {
          "componentId": "custom-visual",
          "instanceId": "obj1-visual",
          "title": "See Addition in Action",
          "intent": "Create a simple animation showing two groups of objects coming together. Reinforce that addition means combining.",
          "config": {"subject": "Mathematics", "keyTerms": ["addition", "combine", "together"]}
        }
      ]
    },
    {
      "objectiveId": "obj2",
      "objectiveText": "Count objects to add them",
      "objectiveVerb": "apply",
      "components": [
        {
          "componentId": "bar-model",
          "instanceId": "obj2-bar-model",
          "title": "Counting Objects",
          "intent": "Show 3 apples + 2 apples = 5 apples using a bar model visualization. Emphasize counting each group then counting the total."
        },
        {
          "componentId": "number-line",
          "instanceId": "obj2-number-line",
          "title": "Hop Along the Number Line",
          "intent": "Demonstrate 3 + 2 = 5 by starting at 3 and hopping 2 spaces to land on 5. Range 0-10."
        },
        {
          "componentId": "knowledge-check",
          "instanceId": "obj2-practice",
          "title": "Try Counting!",
          "intent": "Simple counting-based addition: Show 2 balls and 3 balls, ask how many total?",
          "config": {"problemType": "multiple_choice", "difficulty": "easy"}
        }
      ]
    },
    {
      "objectiveId": "obj3",
      "objectiveText": "Recognize the plus sign (+) and equals sign (=)",
      "objectiveVerb": "identify",
      "components": [
        {
          "componentId": "concept-card-grid",
          "instanceId": "obj3-symbols",
          "title": "Meet the Math Symbols",
          "intent": "Introduce + and = signs. Explain + means 'add' or 'and', = means 'equals' or 'is the same as'. Use visual examples."
        },
        {
          "componentId": "annotated-example",
          "instanceId": "obj3-example",
          "title": "Reading a Math Sentence",
          "intent": "Walk through reading '2 + 3 = 5' step by step. Annotate each symbol's meaning."
        }
      ]
    }
  ],
  "finalAssessment": {
    "componentId": "knowledge-check",
    "instanceId": "final-quiz",
    "title": "Show What You Learned!",
    "intent": "Create 2-3 questions that cover ALL objectives: one about what addition means, one counting problem, one symbol recognition.",
    "config": {"problemType": "multiple_choice", "count": 3, "difficulty": "easy"}
  }
}

Now generate the manifest for: "${topic}" (${gradeLevel})
Return ONLY valid JSON matching the schema.`;

    callbacks?.onProgress?.('🧠 Starting manifest generation with AI thinking...');

    // Use streaming API
    const responseStream = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
        responseMimeType: "application/json",
        responseSchema: manifestSchema,
      },
    });

    let accumulatedText = '';
    let chunkCount = 0;
    let lastProgressUpdate = Date.now();

    callbacks?.onProgress?.('📡 Receiving AI response stream...');

    // Stream and accumulate chunks
    for await (const chunk of responseStream) {
      chunkCount++;

      if (chunk.text) {
        accumulatedText += chunk.text;

        // Throttle progress updates to every 500ms
        const now = Date.now();
        if (now - lastProgressUpdate > 500) {
          callbacks?.onProgress?.(`📝 Processing chunk ${chunkCount}... (${accumulatedText.length} chars)`);
          lastProgressUpdate = now;

          // Try to parse partial JSON to show progress
          try {
            const partial = JSON.parse(accumulatedText);
            if (partial.topic || partial.objectiveBlocks) {
              callbacks?.onPartialManifest?.(partial);
              if (partial.objectiveBlocks?.length) {
                const totalComponents = partial.objectiveBlocks.reduce(
                  (sum: number, block: any) => sum + (block.components?.length || 0), 0
                );
                callbacks?.onProgress?.(`🎯 Discovered ${partial.objectiveBlocks.length} objectives with ${totalComponents} components...`);
              }
            }
          } catch {
            // Not yet valid JSON, continue accumulating
          }
        }
      }

    }

    callbacks?.onProgress?.('✅ Stream complete, parsing final manifest...');

    if (!accumulatedText) throw new Error("No manifest returned");

    let jsonStr = accumulatedText.trim();
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) jsonStr = match[1].trim();

    // Cleanup potential trailing characters
    const firstOpen = jsonStr.indexOf('{');
    const lastClose = jsonStr.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
      jsonStr = jsonStr.substring(firstOpen, lastClose + 1);
    }

    const rawManifest = JSON.parse(jsonStr) as ExhibitManifest;

    // Enrich with flattened layout for backward compatibility
    const manifest = enrichManifestWithLayout(rawManifest);

    const totalComponents = manifest.objectiveBlocks?.reduce(
      (sum, block) => sum + (block.components?.length || 0), 0
    ) || 0;
    const objectiveCount = manifest.objectiveBlocks?.length || 0;

    callbacks?.onProgress?.(`🎉 Manifest complete: ${objectiveCount} objectives, ${totalComponents} components!`);
    console.log('📋 Manifest Generated (objective-centric):', manifest);
    console.log(`   📊 Objectives: ${objectiveCount}`);
    manifest.objectiveBlocks?.forEach(block => {
      console.log(`      - ${block.objectiveId}: "${block.objectiveText}" → ${block.components.length} components`);
    });

    return manifest;
  } catch (error) {
    console.error("Manifest generation error:", error);
    throw error;
  }
};

/**
 * Generate Exhibit Manifest (Phase 1 - The Blueprint)
 * This creates a plan for what components to use WITHOUT generating content
 *
 * @deprecated Use generateExhibitManifestStreaming for better progress visibility
 */
export const generateExhibitManifest = async (
  topic: string,
  gradeLevel: string = 'elementary',
  objectives?: Array<{ id: string; text: string; verb: string; icon: string }>
): Promise<ExhibitManifest> => {
  // Fallback to streaming version without callbacks for backward compatibility
  return generateExhibitManifestStreaming(topic, gradeLevel, objectives);
};