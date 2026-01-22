
import { Type, Schema, ThinkingLevel } from "@google/genai";
import {
  ItemDetailData,
  ComponentDefinition
} from "../types";

import { generateIntroBriefing as generateIntroBriefingWithSubject } from "./curator-brief/gemini-curator-brief";

// Foundational Concept Teaching
import { ai } from "./geminiClient";

// Content Registry (Phase 1 Refactor)
import { getGenerator } from "./registry/contentRegistry";
import { USE_CONTENT_REGISTRY, DEBUG_CONTENT_REGISTRY } from "../config/featureFlags";
// Import all generators for side-effect registration
import "./registry/generators";

// --- HELPER FUNCTIONS ---

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

// --- MAIN EXHIBIT SCHEMA ---


const detailSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    realWorldApplication: { type: Type.STRING },
    funFact: { type: Type.STRING },
    visualPrompt: { type: Type.STRING }
  },
  required: ["title", "description", "realWorldApplication", "funFact", "visualPrompt"]
};



export const generateItemDetail = async (contextTopic: string, item: string): Promise<ItemDetailData> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Context: Educational exhibit about "${contextTopic}".
      Task: Provide a deep-dive analysis for the specific item: "${item}".`,
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
        responseMimeType: "application/json",
        responseSchema: detailSchema,
      }
    });
    if (!response.text) throw new Error("No text returned");

    let jsonStr = response.text.trim();
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) jsonStr = match[1].trim();
    
    return JSON.parse(jsonStr) as ItemDetailData;
  } catch (error) {
    console.error("Detail gen error:", error);
    throw error;
  }
}

export const generateConceptImage = async (prompt: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [{ text: prompt }]
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
    }
    return null;
  } catch (error) {
    console.error("Image gen error:", error);
    return null;
  }
};


// ============================================================================
// STEP 2: MANIFEST-BASED CONTENT GENERATORS
// ============================================================================

/**
 * Generate content for a single manifest item based on its component type
 *
 * Uses the ContentRegistry pattern - all generators are registered via side-effect imports.
 * See registry/generators/ for the 52 registered generators:
 * - coreGenerators.ts (21): curator-brief, concept-cards, knowledge-check, etc.
 * - mathGenerators.ts (23): bar-model, number-line, fraction-bar, etc.
 * - engineeringGenerators.ts (4): lever-lab, pulley, ramp, wheel-axle
 * - mediaGenerators.ts (3): media-player, flashcard-deck, image-comparison
 * - foundationGenerators.ts (1): foundation-explorer
 */
export const generateComponentContent = async (
  item: any, // ManifestItem
  topic: string,
  gradeLevel: string
): Promise<any> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);

  console.log(`🔧 [generateComponentContent] Processing: ${item.componentId} (${item.instanceId})`);

  const generator = getGenerator(item.componentId);
  if (generator) {
    if (DEBUG_CONTENT_REGISTRY) {
      console.log(`  📦 [Registry] Using registered generator for '${item.componentId}'`);
    }
    return await generator(item, topic, gradeLevelContext);
  }

  console.warn(`Unknown component type: ${item.componentId}`);
  return null;
};


/**
 * Build Complete Exhibit from Pre-Generated Manifest and Curator Brief
 * This function is used in the curator-brief-first architecture where:
 * 1. Curator brief is generated first (with learning objectives)
 * 2. Learning objectives guide manifest generation
 * 3. This function builds the exhibit from the manifest (skipping curator brief generation)
 */
export const buildCompleteExhibitFromManifest = async (
  manifest: any,
  curatorBrief: any
): Promise<any> => {
  console.log('🎯 Building exhibit from pre-generated manifest and curator brief');
  console.log(`📋 Manifest has ${manifest.layout.length} components`);

  // PHASE 1: Filter out curator-brief from manifest since we already have it
  const componentsToGenerate = manifest.layout.filter(
    (item: any) => item.componentId !== 'curator-brief'
  );
  console.log(`🎨 Generating ${componentsToGenerate.length} components (excluding curator-brief)...`);

  // PHASE 2: Generate Content for All Components in Parallel (except curator-brief)
  // Use indexed map to preserve order correlation with manifest.layout
  const contentPromises = componentsToGenerate.map(async (item: any, index: number) => {
    try {
      console.log(`  ⚙️ [${index + 1}/${componentsToGenerate.length}] Generating: ${item.componentId} (${item.instanceId})`);
      const content = await generateComponentContent(item, manifest.topic, manifest.gradeLevel);
      console.log(`  ✅ [${index + 1}/${componentsToGenerate.length}] Completed: ${item.componentId}`);
      // Return with original index to maintain order
      return { ...content, _originalIndex: index };
    } catch (error) {
      console.error(`  ❌ Failed to generate ${item.componentId}:`, error);
      return { _originalIndex: index, _failed: true }; // Keep index even for failures
    }
  });

  const components = await Promise.all(contentPromises);
  const validComponents = components.filter(c => !c._failed);
  console.log(`✅ Generated ${validComponents.length}/${componentsToGenerate.length} components successfully`);

  // PHASE 3: Assemble into Complete Exhibit Structure
  console.log('🏗️ Phase 3: Assembling exhibit...');

  const exhibit: any = {
    topic: manifest.topic,
    themeColor: manifest.themeColor,
    manifest: manifest, // Include the manifest for objective mapping
    introBriefing: curatorBrief, // Use pre-generated curator brief
    intro: {
      hook: curatorBrief.hook.content,
      objectives: curatorBrief.objectives.map((obj: any) => obj.text)
    },
    // NEW: Ordered components array preserving manifest layout order
    orderedComponents: [],
    // Legacy arrays kept for backward compatibility
    cards: [],
    featureExhibit: null,
    comparison: null,
    tables: [],
    graphBoards: [],
    scaleSpectrums: [],
    annotatedExamples: [],
    nestedHierarchies: [],
    imagePanels: [],
    takeHomeActivities: [],
    knowledgeCheck: null,
    specializedExhibits: [],
    relatedTopics: []
  };

  // Build the orderedComponents array from manifest layout order
  // Create a map of instanceId -> generated content for quick lookup
  const contentMap = new Map<string, any>();
  for (const component of validComponents) {
    if (component && component.instanceId) {
      contentMap.set(component.instanceId, component);
    }
  }

  // Iterate through manifest.layout to build orderedComponents in manifest order
  for (const layoutItem of manifest.layout) {
    if (layoutItem.componentId === 'curator-brief') {
      // Add curator brief as first component
      exhibit.orderedComponents.push({
        componentId: 'curator-brief',
        instanceId: layoutItem.instanceId,
        title: layoutItem.title,
        data: curatorBrief,
        objectiveIds: layoutItem.objectiveIds || []
      });
    } else {
      // Look up generated content by instanceId
      const generatedContent = contentMap.get(layoutItem.instanceId);
      if (generatedContent && !generatedContent._failed) {
        exhibit.orderedComponents.push({
          componentId: layoutItem.componentId,
          instanceId: layoutItem.instanceId,
          title: layoutItem.title,
          data: { ...generatedContent.data, __instanceId: layoutItem.instanceId },
          objectiveIds: layoutItem.objectiveIds || []
        });
      }
    }
  }

  console.log('🎉 Exhibit assembly complete from manifest!');
  return exhibit;
};

/**
 * Wrapper for generateIntroBriefing that auto-infers subject from topic
 * This allows simpler API calls that don't require explicit subject specification
 */
export const generateIntroBriefing = async (
  topic: string,
  gradeLevel: string
): Promise<any> => {
  // Auto-infer subject as "General" - the curator brief will adapt to the topic
  return generateIntroBriefingWithSubject(topic, 'General', gradeLevel);
};

// Re-export hint generator from problems service
export { generateProblemHint } from './problems/hint-generator';

