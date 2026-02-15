/**
 * Core Generators - Self-registering module for core/narrative primitives
 *
 * This module registers all core content generators (curator-brief, concept-card-grid,
 * feature-exhibit, comparison-panel, etc.) with the ContentRegistry.
 *
 * Each generator imports from its DEDICATED service file, NOT from geminiService.ts.
 * This is the key design pattern for reducing context window requirements.
 *
 * Import this file for side-effects to register the generators.
 *
 * Usage: import './registry/generators/coreGenerators';
 */

import { registerGenerator } from '../contentRegistry';

// ============================================================================
// Core Narrative Component Imports (from dedicated service files)
// ============================================================================
import { generateIntroBriefing } from '../../curator-brief/gemini-curator-brief';
import { generateConceptCards } from '../../concept-cards/gemini-concept-cards';
import { generateFeatureExhibit } from '../../feature-exhibit/gemini-feature-exhibit';
import { generateComparisonPanel } from '../../comparison-panel/gemini-comparison-panel';
import { generateGenerativeTable } from '../../generative-table/gemini-generative-table';
import { generateNestedHierarchy } from '../../nested-hierarchy/gemini-nested-hierarchy';

// ============================================================================
// Interactive Component Imports (from dedicated service files)
// ============================================================================
import { generateScaleSpectrum } from '../../scale-spectrum/gemini-scale-spectrum';
import { generateAnnotatedExample } from '../../annotated-example/gemini-annotated-example';
import { generateGraphBoard } from '../../graph-board/gemini-graph-board';
import { generateFormulaCard } from '../../formula-card/gemini-formula-card';

// ============================================================================
// Media/Visual Component Imports (from dedicated service files)
// NOTE: flashcard-deck, image-comparison, media-player are in mediaGenerators.ts
// ============================================================================
import { generateImagePanel } from '../../image-panel/gemini-image-panel';

// ============================================================================
// Learning Tool Imports (from dedicated service files)
// ============================================================================
import { generateTakeHomeActivity } from '../../take-home-activity/gemini-take-home-activity';
import { generateInteractivePassage } from '../../interactive-passage/gemini-interactive-passage';
import { generateWordBuilder } from '../../word-builder/gemini-word-builder';

// ============================================================================
// Science Component Imports (from dedicated service files)
// ============================================================================
import { generateMoleculeData } from '../../chemistry/gemini-chemistry';
import { generateMatterExplorer } from '../../chemistry/gemini-matter-explorer';
import { generateReactionLab } from '../../chemistry/gemini-reaction-lab';
import { generateStatesOfMatter } from '../../chemistry/gemini-states-of-matter';
import { generateAtomBuilder } from '../../chemistry/gemini-atom-builder';
import { generateMoleculeConstructor } from '../../chemistry/gemini-molecule-constructor';
import { generateEquationBalancer } from '../../chemistry/gemini-equation-balancer';
import { generateEnergyOfReactions } from '../../chemistry/gemini-energy-of-reactions';
import { generateMixingAndDissolving } from '../../chemistry/gemini-mixing-and-dissolving';
import { generatePhExplorer } from '../../chemistry/gemini-ph-explorer';
import { generateSafetyLab } from '../../chemistry/gemini-safety-lab';

// ============================================================================
// Specialized Visual/Interactive Component Imports (from dedicated service files)
// ============================================================================
import { generateMathVisual } from '../../math-visual/gemini-math-visual';
import { generateCustomVisual } from '../../custom-visual/gemini-custom-visual';
import { generateSentenceAnalyzer } from '../../sentence-analyzer/gemini-sentence-analyzer';

// ============================================================================
// Assessment Component Imports (from dedicated service files)
// ============================================================================
import { generateKnowledgeCheck } from '../../knowledge-check/gemini-knowledge-check';


// ============================================================================
// Helper Types and Functions
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyConfig = Record<string, any>;

/**
 * Helper to safely extract config values with proper typing
 */
const getConfig = (item: { config?: unknown }): AnyConfig => {
  return (item.config as AnyConfig) || {};
};

/**
 * Extract subject from topic keywords
 */
const inferSubject = (topic: string): string => {
  const topicLower = topic.toLowerCase();
  if (topicLower.includes('math') || topicLower.includes('fraction') || topicLower.includes('algebra') ||
      topicLower.includes('geometry') || topicLower.includes('number') || topicLower.includes('counting')) {
    return 'Mathematics';
  } else if (topicLower.includes('science') || topicLower.includes('biology') || topicLower.includes('chemistry') ||
             topicLower.includes('physics') || topicLower.includes('plant') || topicLower.includes('animal')) {
    return 'Science';
  } else if (topicLower.includes('reading') || topicLower.includes('writing') || topicLower.includes('grammar') ||
             topicLower.includes('sentence') || topicLower.includes('vocabulary') || topicLower.includes('language')) {
    return 'Language Arts';
  } else if (topicLower.includes('history') || topicLower.includes('historical') || topicLower.includes('ancient') ||
             topicLower.includes('civilization') || topicLower.includes('revolution') || topicLower.includes('war')) {
    return 'History';
  } else if (topicLower.includes('geography') || topicLower.includes('map') || topicLower.includes('continent') ||
             topicLower.includes('country') || topicLower.includes('climate')) {
    return 'Geography';
  }
  return 'General';
};

/**
 * Extract grade level from context string
 */
const inferGradeLevel = (gradeContext: string): string => {
  if (gradeContext.includes('toddler')) return 'Toddler';
  if (gradeContext.includes('preschool')) return 'Preschool';
  if (gradeContext.includes('kindergarten')) return 'Kindergarten';
  if (gradeContext.includes('elementary') || gradeContext.includes('grades 1-5')) return 'Elementary';
  if (gradeContext.includes('middle') || gradeContext.includes('grades 6-8')) return 'Middle School';
  if (gradeContext.includes('high') || gradeContext.includes('grades 9-12')) return 'High School';
  if (gradeContext.includes('undergraduate')) return 'Undergraduate';
  if (gradeContext.includes('graduate')) return 'Graduate';
  if (gradeContext.includes('phd')) return 'PhD';
  return 'Elementary';
};

// ============================================================================
// Core Narrative Components Registration
// ============================================================================

// Curator Brief (intro/hook)
registerGenerator('curator-brief', async (item, topic, gradeContext) => {
  const subject = inferSubject(topic);
  const gradeLevel = inferGradeLevel(gradeContext);
  const data = await generateIntroBriefing(topic, subject, gradeLevel);
  return {
    type: 'curator-brief',
    instanceId: item.instanceId,
    data
  };
});

// Concept Card Grid (3-card layout)
registerGenerator('concept-card-grid', async (item, topic, gradeContext) => {
  const config = getConfig(item);
  const data = await generateConceptCards(topic, gradeContext, {
    itemCount: config.itemCount,
    intent: item.intent,
    objectiveText: config.objectiveText,
    objectiveVerb: config.objectiveVerb
  });
  return {
    type: 'concept-card-grid',
    instanceId: item.instanceId,
    data
  };
});

// Feature Exhibit (deep dive editorial)
registerGenerator('feature-exhibit', async (item, topic, gradeContext) => {
  const config = getConfig(item);
  const data = await generateFeatureExhibit(topic, gradeContext, {
    intent: item.intent,
    objectiveText: config.objectiveText,
    objectiveVerb: config.objectiveVerb
  });
  return {
    type: 'feature-exhibit',
    instanceId: item.instanceId,
    data
  };
});

// Comparison Panel (A vs B)
registerGenerator('comparison-panel', async (item, topic, gradeContext) => {
  const config = getConfig(item);
  const data = await generateComparisonPanel(topic, gradeContext, {
    intent: item.intent,
    objectiveText: config.objectiveText,
    objectiveVerb: config.objectiveVerb
  });
  return {
    type: 'comparison-panel',
    instanceId: item.instanceId,
    data
  };
});

// Generative Table (structured data)
registerGenerator('generative-table', async (item, topic, gradeContext) => {
  const data = await generateGenerativeTable(topic, gradeContext, {
    intent: item.intent
  });
  return {
    type: 'generative-table',
    instanceId: item.instanceId,
    data
  };
});

// Nested Hierarchy (hierarchical tree structure)
registerGenerator('nested-hierarchy', async (item, topic, gradeContext) => {
  const data = await generateNestedHierarchy(topic, gradeContext, item.intent);
  return {
    type: 'nested-hierarchy',
    instanceId: item.instanceId,
    data
  };
});

// ============================================================================
// Interactive Components Registration
// ============================================================================

// Graph Board (interactive polynomial graphing)
registerGenerator('graph-board', async (item, topic, _gradeContext) => {
  const data = await generateGraphBoard(topic, {
    title: item.title,
    intent: item.intent
  });
  return {
    type: 'graph-board',
    instanceId: item.instanceId,
    data
  };
});

// Scale Spectrum (nuanced judgments)
registerGenerator('scale-spectrum', async (item, topic, gradeContext) => {
  const data = await generateScaleSpectrum(topic, gradeContext, {
    intent: item.intent
  });
  return {
    type: 'scale-spectrum',
    instanceId: item.instanceId,
    data
  };
});

// Annotated Example (worked examples with annotations)
registerGenerator('annotated-example', async (item, topic, gradeContext) => {
  const config = getConfig(item);
  const data = await generateAnnotatedExample(topic, gradeContext, {
    intent: item.intent,
    objectiveText: config.objectiveText,
    objectiveVerb: config.objectiveVerb
  });
  return {
    type: 'annotated-example',
    instanceId: item.instanceId,
    data
  };
});

// Formula Card (LaTeX/Math display)
registerGenerator('formula-card', async (item, topic, gradeContext) => {
  const data = await generateFormulaCard(topic, gradeContext, {
    intent: item.intent
  });
  return {
    type: 'formula-card',
    instanceId: item.instanceId,
    data
  };
});

// ============================================================================
// Media/Visual Components Registration
// ============================================================================

// Image Panel (AI-generated images)
registerGenerator('image-panel', async (item, topic, gradeContext) => {
  const data = await generateImagePanel(topic, gradeContext, {
    intent: item.intent,
    interactionMode: 'identify' // Always enable annotation mode with evaluation
  });
  return {
    type: 'image-panel',
    instanceId: item.instanceId,
    data
  };
});

// NOTE: flashcard-deck, image-comparison, and media-player are registered in mediaGenerators.ts

// ============================================================================
// Learning Tool Components Registration
// ============================================================================

// Take Home Activity (hands-on activities)
registerGenerator('take-home-activity', async (item, topic, gradeContext) => {
  const data = await generateTakeHomeActivity(topic, gradeContext, {
    intent: item.intent
  });
  return {
    type: 'take-home-activity',
    instanceId: item.instanceId,
    data
  };
});

// Interactive Passage (reading comprehension)
registerGenerator('interactive-passage', async (item, topic, gradeContext) => {
  const data = await generateInteractivePassage(topic, gradeContext, {
    intent: item.intent
  });
  return {
    type: 'interactive-passage',
    instanceId: item.instanceId,
    data
  };
});

// Word Builder (vocabulary & morphology)
registerGenerator('word-builder', async (item, topic, gradeContext) => {
  const data = await generateWordBuilder(topic, gradeContext, {
    intent: item.intent
  });
  return {
    type: 'word-builder',
    instanceId: item.instanceId,
    data
  };
});

// ============================================================================
// Science Visualization Registration
// ============================================================================

// Molecule Viewer (3D molecular structure)
registerGenerator('molecule-viewer', async (item, topic, gradeContext) => {
  const gradeLevel = inferGradeLevel(gradeContext);
  const moleculePrompt = item.intent || item.title || topic;
  const data = await generateMoleculeData(moleculePrompt, gradeLevel as any);
  return {
    type: 'molecule-viewer',
    instanceId: item.instanceId,
    data
  };
});

// Periodic Table (interactive elements table)
registerGenerator('periodic-table', async (item, _topic, _gradeContext) => {
  const config = getConfig(item);
  // Periodic table is self-contained with all element data
  const data = {
    title: item.title || 'Periodic Table of Elements',
    description: item.intent || 'Explore the elements and their properties',
    highlightElements: config.highlightElements || [],
    focusCategory: config.focusCategory
  };
  return {
    type: 'periodic-table',
    instanceId: item.instanceId,
    data
  };
});

// Matter Explorer (interactive matter classification)
registerGenerator('matter-explorer', async (item, topic, gradeContext) => {
  const data = await generateMatterExplorer(topic, gradeContext, {
    intent: item.intent,
  });
  return {
    type: 'matter-explorer',
    instanceId: item.instanceId,
    data,
  };
});

// Reaction Lab (interactive chemistry experiment station)
registerGenerator('reaction-lab', async (item, topic, gradeContext) => {
  const data = await generateReactionLab(topic, gradeContext, {
    intent: item.intent,
  });
  return {
    type: 'reaction-lab',
    instanceId: item.instanceId,
    data,
  };
});

// States of Matter (interactive particle simulation)
registerGenerator('states-of-matter', async (item, topic, gradeContext) => {
  const data = await generateStatesOfMatter(topic, gradeContext, {
    intent: item.intent,
  });
  return {
    type: 'states-of-matter',
    instanceId: item.instanceId,
    data,
  };
});

// Atom Builder (interactive atom construction with Bohr model)
registerGenerator('atom-builder', async (item, topic, gradeContext) => {
  const data = await generateAtomBuilder(topic, gradeContext, {
    intent: item.intent,
  });
  return {
    type: 'atom-builder',
    instanceId: item.instanceId,
    data,
  };
});

// Molecule Constructor (interactive molecule building)
registerGenerator('molecule-constructor', async (item, topic, gradeContext) => {
  const data = await generateMoleculeConstructor(topic, gradeContext, {
    intent: item.intent,
  });
  return {
    type: 'molecule-constructor',
    instanceId: item.instanceId,
    data,
  };
});

// Equation Balancer (interactive chemical equation balancing)
registerGenerator('equation-balancer', async (item, topic, gradeContext) => ({
  type: 'equation-balancer',
  instanceId: item.instanceId,
  data: await generateEquationBalancer(topic, gradeContext, item.config),
}));

// Energy of Reactions (exothermic/endothermic enthalpy diagrams)
registerGenerator('energy-of-reactions', async (item, topic, gradeContext) => ({
  type: 'energy-of-reactions',
  instanceId: item.instanceId,
  data: await generateEnergyOfReactions(topic, gradeContext, item.config),
}));

// Mixing and Dissolving (interactive solutions/mixtures explorer)
registerGenerator('mixing-and-dissolving', async (item, topic, gradeContext) => ({
  type: 'mixing-and-dissolving',
  instanceId: item.instanceId,
  data: await generateMixingAndDissolving(topic, gradeContext, item.config),
}));

// pH Explorer (interactive acid-base rainbow)
registerGenerator('ph-explorer', async (item, topic, gradeContext) => ({
  type: 'ph-explorer',
  instanceId: item.instanceId,
  data: await generatePhExplorer(topic, gradeContext, item.config),
}));

// Safety Lab (lab safety training & virtual PPE)
registerGenerator('safety-lab', async (item, topic, gradeContext) => ({
  type: 'safety-lab',
  instanceId: item.instanceId,
  data: await generateSafetyLab(topic, gradeContext, item.config),
}));

// ============================================================================
// Specialized Visual/Interactive Components Registration
// ============================================================================

// Math Visual (dynamic math visualization based on visual type)
registerGenerator('math-visual', async (item, topic, gradeContext) => {
  const config = getConfig(item);
  const data = await generateMathVisual(topic, gradeContext, {
    visualType: config.visualType,
    intent: item.intent,
    title: item.title
  });
  return {
    type: 'math-visual',
    instanceId: item.instanceId,
    data
  };
});

// Custom Visual (rich interactive HTML experiences)
registerGenerator('custom-visual', async (item, topic, gradeContext) => {
  const config = getConfig(item);
  const data = await generateCustomVisual(topic, gradeContext, {
    intent: item.intent,
    title: item.title,
    subject: config.subject,
    unitTitle: config.unitTitle,
    keyTerms: config.keyTerms,
    conceptsCovered: config.conceptsCovered,
    objectiveId: config.objectiveId,
    objectiveText: config.objectiveText,
    objectiveVerb: config.objectiveVerb
  });
  return {
    type: 'custom-visual',
    instanceId: item.instanceId,
    data: {
      type: 'custom-web' as const,
      id: item.instanceId,
      ...data,
    }
  };
});

// Sentence Analyzer (grammar/sentence structure analysis)
registerGenerator('sentence-analyzer', async (item, topic, gradeContext) => {
  const data = await generateSentenceAnalyzer(topic, gradeContext, {
    intent: item.intent,
    title: item.title
  });
  return {
    type: 'sentence-analyzer',
    instanceId: item.instanceId,
    data
  };
});

// ============================================================================
// Assessment Components Registration
// ============================================================================

// Knowledge Check (multiple problem types: MC, T/F, Fill-in, Matching, Sequencing, Categorization)
registerGenerator('knowledge-check', async (item, topic, gradeContext) => {
  const config = getConfig(item);
  const problems = await generateKnowledgeCheck(topic, gradeContext, {
    problemType: config.problemType,
    count: config.count || config.problemCount || 1,
    difficulty: config.difficulty,
    context: config.context,
    objectiveText: config.objectiveText
  });
  return {
    type: 'knowledge-check',
    instanceId: item.instanceId,
    data: {
      problems,
      problemType: config.problemType || 'multiple_choice',
      topic,
      gradeContext
    }
  };
});

// ============================================================================
// Migration status: 21 core components registered from dedicated service files
// Math primitives (bar-model, number-line, etc.) moved to mathGenerators.ts
// NO IMPORTS FROM geminiService.ts - all generators use dedicated files
// ============================================================================
