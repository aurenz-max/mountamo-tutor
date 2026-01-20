/**
 * Media Generators - Self-registering module for multimedia primitives
 *
 * This module registers all media-related content generators with the ContentRegistry.
 * Import this file for side-effects to register the generators.
 *
 * Usage: import './registry/generators/mediaGenerators';
 */

import { registerGenerator } from '../contentRegistry';

// Media Generator Imports
import { generateMediaPlayer } from '../../media-player/gemini-media-player';
import { generateFlashcardDeck } from '../../flashcard-deck/gemini-flashcard';
import { generateImageComparison } from '../../image-comparison/gemini-image-comparison';

// ============================================================================
// Media/Multimedia Primitives Registration
// ============================================================================

// Media Player
registerGenerator('media-player', async (item, topic, gradeContext) => ({
  type: 'media-player',
  instanceId: item.instanceId,
  data: await generateMediaPlayer(topic, gradeContext, item.config),
}));

// Flashcard Deck
registerGenerator('flashcard-deck', async (item, topic, gradeContext) => ({
  type: 'flashcard-deck',
  instanceId: item.instanceId,
  data: await generateFlashcardDeck(topic, gradeContext, item.config),
}));

// Image Comparison
registerGenerator('image-comparison', async (item, topic, gradeContext) => ({
  type: 'image-comparison',
  instanceId: item.instanceId,
  data: await generateImageComparison(topic, gradeContext, item.config),
}));

// ============================================================================
// Migration status: 3/3 media primitives registered
// ============================================================================
