/**
 * Content Registry Module
 *
 * Central registry for component content generators, enabling modular
 * addition of new primitives without modifying geminiService.ts.
 *
 * Usage:
 *   // Import registry with all generators registered
 *   import { getGenerator, hasGenerator } from './registry';
 *
 *   // Or import just the registry types
 *   import type { ContentGenerator, ManifestItem } from './registry';
 */

// Import generators for side-effect registration
import './generators';

// Re-export everything from contentRegistry
export * from './contentRegistry';
