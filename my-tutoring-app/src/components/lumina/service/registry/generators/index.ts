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
 * - coreGenerators.ts (21 core/narrative/assessment primitives)
 * - mathGenerators.ts (23 math primitives)
 * - engineeringGenerators.ts (13 primitives)
 * - mediaGenerators.ts (3 primitives)
 * - foundationGenerators.ts (1 primitive)
 * - biologyGenerators.ts (1 primitive)
 * - astronomyGenerators.ts (1 primitive)
 *
 * Total: 63 registered generators
 */

// Import all generator modules for side-effect registration
import './coreGenerators';
import './mathGenerators';
import './engineeringGenerators';
import './mediaGenerators';
import './foundationGenerators';
import './biologyGenerators';
import './astronomyGenerators';
import './physicsGenerators';

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
