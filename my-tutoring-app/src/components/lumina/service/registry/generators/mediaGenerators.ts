/**
 * Media Generators - Self-registering module for multimedia primitives
 *
 * This module registers all media-related content generators with the ContentRegistry.
 * Import this file for side-effects to register the generators.
 *
 * Usage: import './registry/generators/mediaGenerators';
 */

import { registerContextGenerator } from '../contentRegistry';

// Media Generator Imports
import { generateMediaPlayer } from '../../media-player/gemini-media-player';
import { generateFlashcardDeck } from '../../flashcard-deck/gemini-flashcard';
import { generateImageComparison } from '../../image-comparison/gemini-image-comparison';

// ============================================================================
// Media/Multimedia Primitives Registration
// ============================================================================

// Media Player (audio-visual lessons)
registerContextGenerator('media-player', async (ctx) => ({
  type: 'media-player',
  instanceId: ctx.instanceId,
  data: await generateMediaPlayer(ctx),
}));

// Flashcard Deck
registerContextGenerator('flashcard-deck', async (ctx) => ({
  type: 'flashcard-deck',
  instanceId: ctx.instanceId,
  data: await generateFlashcardDeck(ctx),
}));

// Image Comparison (before/after, side-by-side)
registerContextGenerator('image-comparison', async (ctx) => ({
  type: 'image-comparison',
  instanceId: ctx.instanceId,
  data: await generateImageComparison(ctx),
}));

// ============================================================================
// Migration status: 3/3 media primitives registered
// ============================================================================
