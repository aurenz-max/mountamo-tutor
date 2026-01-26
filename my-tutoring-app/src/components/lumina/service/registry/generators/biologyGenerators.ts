/**
 * Biology Generators - Self-registering module for biology primitives
 *
 * This module registers all biology content generators (species-profile, etc.)
 * with the ContentRegistry.
 *
 * Each generator imports from its DEDICATED service file, NOT from geminiService.ts.
 * This follows the design pattern for reducing context window requirements.
 *
 * Import this file for side-effects to register the generators.
 *
 * Usage: import './registry/generators/biologyGenerators';
 */

import { registerGenerator } from '../contentRegistry';

// ============================================================================
// Biology Component Imports (from dedicated service files)
// ============================================================================
import { generateSpeciesProfile } from '../../biology/gemini-species-profile';

// ============================================================================
// Helper Types
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyConfig = Record<string, any>;

/**
 * Helper to safely extract config values with proper typing
 */
const getConfig = (item: { config?: unknown }): AnyConfig => {
  return (item.config as AnyConfig) || {};
};

// ============================================================================
// Biology Primitive Registrations
// ============================================================================

/**
 * Species Profile - Comprehensive species information with taxonomy, habitat, and characteristics
 *
 * Perfect for:
 * - Dinosaur profiles (T-Rex, Velociraptor, Triceratops, etc.)
 * - Modern animal studies (mammals, reptiles, birds, fish)
 * - Plant species information
 * - Comparative biology lessons
 * - Ecosystem and habitat studies
 *
 * Features:
 * - Physical stats with real-world comparisons
 * - Diet, behavior, and hunting strategies
 * - Habitat and geographic/temporal information
 * - Complete taxonomic classification
 * - Fascinating facts and discovery history
 * - AI-generated species images
 */
registerGenerator('species-profile', async (item, topic, gradeContext) => {
  const config = getConfig(item);

  // Extract species name from config or topic
  const speciesName = config.speciesName || topic;

  return {
    type: 'species-profile',
    instanceId: item.instanceId,
    data: await generateSpeciesProfile(speciesName, gradeContext, config),
  };
});

// ============================================================================
// Export generator count for documentation
// ============================================================================

// Total: 1 biology generator
// - species-profile

console.log('✅ Biology Generators Registered: species-profile');
