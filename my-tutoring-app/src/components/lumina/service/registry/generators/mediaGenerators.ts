/**
 * Media Generators - Self-registering module for multimedia primitives
 *
 * This module registers all media-related content generators with the ContentRegistry.
 * Import this file for side-effects to register the generators.
 *
 * Usage: import './registry/generators/mediaGenerators';
 */

import { registerGenerator, ManifestItem } from '../contentRegistry';

// Media Generator Imports
import { generateMediaPlayer } from '../../media-player/gemini-media-player';
import { generateFlashcardDeck } from '../../flashcard-deck/gemini-flashcard';
import { generateImageComparison } from '../../image-comparison/gemini-image-comparison';

// Helper to safely get config object
const getConfig = (item: ManifestItem): Record<string, any> => {
  return (item.config && typeof item.config === 'object') ? item.config : {};
};

// Helper to infer grade level from context string
const inferGradeLevel = (gradeContext: string): string => {
  const lower = gradeContext.toLowerCase();
  if (lower.includes('preschool') || lower.includes('prek')) return 'preschool';
  if (lower.includes('kindergarten')) return 'kindergarten';
  if (lower.includes('grade 1') || lower.includes('1st')) return 'grade1';
  if (lower.includes('grade 2') || lower.includes('2nd')) return 'grade2';
  if (lower.includes('grade 3') || lower.includes('3rd')) return 'grade3';
  if (lower.includes('grade 4') || lower.includes('4th')) return 'grade4';
  if (lower.includes('grade 5') || lower.includes('5th')) return 'grade5';
  if (lower.includes('middle')) return 'middle';
  if (lower.includes('high')) return 'high';
  return 'elementary';
};

// ============================================================================
// Media/Multimedia Primitives Registration
// ============================================================================

// Media Player (audio-visual lessons)
registerGenerator('media-player', async (item, topic, gradeContext) => {
  const config = getConfig(item);
  const gradeLevel = inferGradeLevel(gradeContext);
  const data = await generateMediaPlayer(
    item.intent || item.title || topic,
    gradeLevel as any,
    config.segmentCount || 4,
    config.imageResolution || '1K'
  );
  return {
    type: 'media-player',
    instanceId: item.instanceId,
    data
  };
});

// Flashcard Deck
registerGenerator('flashcard-deck', async (item, topic, gradeContext) => {
  const config = getConfig(item);
  const data = await generateFlashcardDeck(topic, gradeContext, {
    cardCount: config.cardCount || 15,
    focusArea: item.intent || config.focusArea,
    includeExamples: config.includeExamples
  });
  return {
    type: 'flashcard-deck',
    instanceId: item.instanceId,
    data
  };
});

// Image Comparison (before/after, side-by-side)
registerGenerator('image-comparison', async (item, topic, gradeContext) => {
  const config = getConfig(item);
  const data = await generateImageComparison(topic, gradeContext, {
    focusArea: item.intent || config.focusArea,
    aspectRatio: config.aspectRatio || '1:1'
  });
  return {
    type: 'image-comparison',
    instanceId: item.instanceId,
    data
  };
});

// ============================================================================
// Migration status: 3/3 media primitives registered
// ============================================================================
