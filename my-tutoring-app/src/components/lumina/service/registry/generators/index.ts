/**
 * Generator Index - Aggregates all generator modules for side-effect imports
 *
 * Import this file to register all content generators with the ContentRegistry.
 * Each domain module self-registers its generators when imported.
 *
 * Usage in geminiService.ts:
 *   import './registry/generators';
 *
 * This will register all generators from:
 * - mathGenerators.ts (17 primitives)
 * - engineeringGenerators.ts (4 primitives)
 * - mediaGenerators.ts (3 primitives)
 * - foundationGenerators.ts (1 primitive)
 */

// Import all generator modules for side-effect registration
import './mathGenerators';
import './engineeringGenerators';
import './mediaGenerators';
import './foundationGenerators';

// Re-export registry functions for convenience
export {
  registerGenerator,
  getGenerator,
  hasGenerator,
  getRegisteredIds,
  getRegisteredCount,
  CONTENT_GENERATORS,
} from '../contentRegistry';

export type {
  ManifestItem,
  ManifestItemConfig,
  GeneratedComponent,
  ContentGenerator,
} from '../contentRegistry';
