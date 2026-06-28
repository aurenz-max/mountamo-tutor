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

import { registerGenerator, registerContextGenerator } from '../contentRegistry';

// ============================================================================
// Core Narrative Component Imports (from dedicated service files)
// ============================================================================
import { generateIntroBriefing } from '../../curator-brief/gemini-curator-brief';
import { generateConceptCards } from '../../concept-cards/gemini-concept-cards';
import { generateFeatureExhibit } from '../../feature-exhibit/gemini-feature-exhibit';
import { generateComparisonPanel } from '../../comparison-panel/gemini-comparison-panel';
import { generateGenerativeTable } from '../../generative-table/gemini-generative-table';


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
// Specialized Visual/Interactive Component Imports (from dedicated service files)
// ============================================================================
import { generateMathVisual } from '../../math-visual/gemini-math-visual';
import { generateCustomVisual } from '../../custom-visual/gemini-custom-visual';
import { generateSentenceAnalyzer } from '../../sentence-analyzer/gemini-sentence-analyzer';

// ============================================================================
// Assessment Component Imports (from dedicated service files)
// ============================================================================
import { generateKnowledgeCheck, type BloomsTier } from '../../knowledge-check/gemini-knowledge-check';
import { generateFastFact } from '../../core/gemini-fast-fact';
import { generateFactFile } from '../../core/gemini-fact-file';
import { generateHowItWorks } from '../../core/gemini-how-it-works';
import { generateTimelineExplorer } from '../../core/gemini-timeline-explorer';
import { generateVocabularyExplorer } from '../../core/gemini-vocabulary-explorer';
import { generateDigitalSkillsSim } from '../../core/gemini-digital-skills-sim';
import { generateDeepDive } from '../../core/gemini-deep-dive';
import { generatePassageStudio } from '../../core/gemini-passage-studio';


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
registerContextGenerator('concept-card-grid', async (ctx) => {
  const config = ctx.raw as AnyConfig;
  const data = await generateConceptCards(ctx.topic, ctx.gradeContext, {
    itemCount: config.itemCount,
    intent: ctx.intent,
    objectiveText: ctx.objective.text,
    objectiveVerb: ctx.objective.verb
  });
  return {
    type: 'concept-card-grid',
    instanceId: ctx.instanceId,
    data
  };
});

// Feature Exhibit (deep dive editorial)
registerContextGenerator('feature-exhibit', async (ctx) => {
  const data = await generateFeatureExhibit(ctx.topic, ctx.gradeContext, {
    intent: ctx.intent,
    objectiveText: ctx.objective.text,
    objectiveVerb: ctx.objective.verb
  });
  return {
    type: 'feature-exhibit',
    instanceId: ctx.instanceId,
    data
  };
});

// Comparison Panel (A vs B)
registerContextGenerator('comparison-panel', async (ctx) => {
  const data = await generateComparisonPanel(ctx.topic, ctx.gradeContext, {
    intent: ctx.intent,
    objectiveText: ctx.objective.text,
    objectiveVerb: ctx.objective.verb
  });
  return {
    type: 'comparison-panel',
    instanceId: ctx.instanceId,
    data
  };
});

// Generative Table (structured data)
registerContextGenerator('generative-table', async (ctx) => {
  const data = await generateGenerativeTable(ctx.topic, ctx.gradeContext, {
    intent: ctx.intent
  });
  return {
    type: 'generative-table',
    instanceId: ctx.instanceId,
    data
  };
});


// ============================================================================
// Interactive Components Registration
// ============================================================================

// Graph Board (interactive polynomial graphing)
registerContextGenerator('graph-board', async (ctx) => {
  const data = await generateGraphBoard(ctx.topic, {
    title: ctx.title,
    intent: ctx.intent
  });
  return {
    type: 'graph-board',
    instanceId: ctx.instanceId,
    data
  };
});

// Scale Spectrum (nuanced judgments)
registerContextGenerator('scale-spectrum', async (ctx) => {
  const data = await generateScaleSpectrum(ctx.topic, ctx.gradeContext, {
    intent: ctx.intent
  });
  return {
    type: 'scale-spectrum',
    instanceId: ctx.instanceId,
    data
  };
});

// Annotated Example (worked examples with annotations). Watch-only —
// practice on a sibling problem is handled by the standalone
// `practice-problem` primitive.
registerGenerator('annotated-example', async (item, topic, gradeContext) => {
  const data = await generateAnnotatedExample({
    topic,
    gradeContext,
    intent: item.intent,
  });
  return {
    type: 'annotated-example',
    instanceId: item.instanceId,
    data
  };
});

// Formula Card (LaTeX/Math display)
registerContextGenerator('formula-card', async (ctx) => {
  const data = await generateFormulaCard(ctx.topic, ctx.gradeContext, {
    intent: ctx.intent
  });
  return {
    type: 'formula-card',
    instanceId: ctx.instanceId,
    data
  };
});

// ============================================================================
// Media/Visual Components Registration
// ============================================================================

// Image Panel (AI-generated images)
registerContextGenerator('image-panel', async (ctx) => {
  const data = await generateImagePanel(ctx.topic, ctx.gradeContext, {
    intent: ctx.intent,
    interactionMode: 'identify' // Always enable annotation mode with evaluation
  });
  return {
    type: 'image-panel',
    instanceId: ctx.instanceId,
    data
  };
});

// NOTE: flashcard-deck, image-comparison, and media-player are registered in mediaGenerators.ts

// ============================================================================
// Learning Tool Components Registration
// ============================================================================

// Take Home Activity (hands-on activities)
registerContextGenerator('take-home-activity', async (ctx) => {
  const data = await generateTakeHomeActivity(ctx.topic, ctx.gradeContext, {
    intent: ctx.intent
  });
  return {
    type: 'take-home-activity',
    instanceId: ctx.instanceId,
    data
  };
});

// Interactive Passage (reading comprehension)
registerContextGenerator('interactive-passage', async (ctx) => {
  const data = await generateInteractivePassage(ctx.topic, ctx.gradeContext, {
    intent: ctx.intent
  });
  return {
    type: 'interactive-passage',
    instanceId: ctx.instanceId,
    data
  };
});

// Word Builder (vocabulary & morphology)
registerContextGenerator('word-builder', async (ctx) => {
  const data = await generateWordBuilder(ctx.topic, ctx.gradeContext, {
    ...(ctx.raw as AnyConfig),
    intent: ctx.intent,
  });
  return {
    type: 'word-builder',
    instanceId: ctx.instanceId,
    data
  };
});

// ============================================================================
// Specialized Visual/Interactive Components Registration
// ============================================================================

// Math Visual (dynamic math visualization based on visual type)
registerContextGenerator('math-visual', async (ctx) => {
  const config = ctx.raw as AnyConfig;
  const data = await generateMathVisual(ctx.topic, ctx.gradeContext, {
    visualType: config.visualType,
    intent: ctx.intent,
    title: ctx.title
  });
  return {
    type: 'math-visual',
    instanceId: ctx.instanceId,
    data
  };
});

// Custom Visual (rich interactive HTML experiences)
registerContextGenerator('custom-visual', async (ctx) => {
  const config = ctx.raw as AnyConfig;
  const data = await generateCustomVisual(ctx.topic, ctx.gradeContext, {
    intent: ctx.intent,
    title: ctx.title,
    subject: config.subject,
    unitTitle: config.unitTitle,
    keyTerms: config.keyTerms,
    conceptsCovered: config.conceptsCovered,
    objectiveId: ctx.objective.id,
    objectiveText: ctx.objective.text,
    objectiveVerb: ctx.objective.verb
  });
  return {
    type: 'custom-visual',
    instanceId: ctx.instanceId,
    data: {
      type: 'custom-web' as const,
      id: ctx.instanceId,
      ...data,
    }
  };
});

// Sentence Analyzer (grammar/sentence structure analysis)
registerContextGenerator('sentence-analyzer', async (ctx) => {
  const data = await generateSentenceAnalyzer(ctx.topic, ctx.gradeContext, {
    ...(ctx.raw as AnyConfig),
    intent: ctx.intent,
  });
  return {
    type: 'sentence-analyzer',
    instanceId: ctx.instanceId,
    data
  };
});

// ============================================================================
// Assessment Components Registration
// ============================================================================

// Knowledge Check (multiple problem types: MC, T/F, Fill-in, Matching, Sequencing, Categorization)
// Always uses the KC orchestrator — it plans optimal problem type mix, insets,
// and difficulty progression autonomously.
registerGenerator('knowledge-check', async (item, topic, gradeContext, gradeLevel) => {
  const config = getConfig(item);

  const problems = await generateKnowledgeCheck(topic, gradeLevel, {
    useOrchestrator: true,
    count: config.count || config.problemCount || 1,
    context: config.context,
    objectiveText: config.objectiveText,
    bloomsTier: config.targetEvalMode as BloomsTier | undefined,
  });
  return {
    type: 'knowledge-check',
    instanceId: item.instanceId,
    data: {
      problems,
      problemType: 'orchestrated',
      topic,
      gradeContext
    }
  };
});

// Fast Fact (timed fluency drill across all subjects)
registerContextGenerator('fast-fact', async (ctx) => ({
  type: 'fast-fact',
  instanceId: ctx.instanceId,
  data: await generateFastFact(ctx),
}));

// Fact File (magazine-style profile card with self-check questions)
registerContextGenerator('fact-file', async (ctx) => ({
  type: 'fact-file',
  instanceId: ctx.instanceId,
  data: await generateFactFile(ctx),
}));

// How It Works (step-by-step process breakdown with comprehension challenges)
registerContextGenerator('how-it-works', async (ctx) => ({
  type: 'how-it-works',
  instanceId: ctx.instanceId,
  data: await generateHowItWorks(ctx),
}));

// Timeline Explorer (chronological event exploration with comprehension challenges)
registerContextGenerator('timeline-explorer', async (ctx) => ({
  type: 'timeline-explorer',
  instanceId: ctx.instanceId,
  data: await generateTimelineExplorer(ctx),
}));

// Vocabulary Explorer (topic-specific vocabulary with contextual definitions and challenges)
registerContextGenerator('vocabulary-explorer', async (ctx) => ({
  type: 'vocabulary-explorer',
  instanceId: ctx.instanceId,
  data: await generateVocabularyExplorer(ctx),
}));

// Digital Skills Sim (click, drag, type practice for K-1)
registerContextGenerator('digital-skills-sim', async (ctx) => ({
  type: 'digital-skills-sim',
  instanceId: ctx.instanceId,
  data: await generateDigitalSkillsSim(ctx),
}));

// DeepDive (orchestrated multi-block learning experience)
registerContextGenerator('deep-dive', async (ctx) => ({
  type: 'deep-dive',
  instanceId: ctx.instanceId,
  data: await generateDeepDive(ctx),
}));

// PassageStudio (multi-block close-reading experience anchored to a stimulus)
registerContextGenerator('passage-studio', async (ctx) => ({
  type: 'passage-studio',
  instanceId: ctx.instanceId,
  data: await generatePassageStudio(ctx),
}));

// ============================================================================
// Migration status: 27 core components registered from dedicated service files
// Math primitives (bar-model, number-line, etc.) moved to mathGenerators.ts
// NO IMPORTS FROM geminiService.ts - all generators use dedicated files
// ============================================================================
