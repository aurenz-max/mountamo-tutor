/**
 * Content Registry - Central registry for component content generators
 *
 * This registry decouples content generation logic from the monolithic geminiService.ts,
 * reducing the "context debt" when adding new primitives from ~7,000 lines to ~100 lines.
 *
 * Pattern mirrors the proven primitiveRegistry.tsx for UI rendering.
 */

import { ComponentId } from '../../types';
import { DEBUG_CONTENT_REGISTRY } from '../../config/featureFlags';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration hints passed from the manifest to guide content generation
 */
export interface ManifestItemConfig {
  [key: string]: unknown;
}

/**
 * Manifest item passed to generators - describes what to generate
 */
export interface ManifestItem<TConfig = ManifestItemConfig> {
  componentId: ComponentId;
  instanceId: string;
  title?: string;
  intent?: string;
  config?: TConfig;
}

/**
 * Standard output from all content generators
 */
export interface GeneratedComponent<TData = unknown> {
  type: ComponentId;
  instanceId: string;
  data: TData;
}

/**
 * Content generator function signature
 *
 * @param item - The manifest item describing what to generate
 * @param topic - The learning topic (e.g., "fractions", "photosynthesis")
 * @param gradeContext - Grade-appropriate context string
 * @returns Generated component data or null if generation fails
 */
export type ContentGenerator<TConfig = ManifestItemConfig, TData = unknown> = (
  item: ManifestItem<TConfig>,
  topic: string,
  gradeContext: string
) => Promise<GeneratedComponent<TData> | null>;

// ============================================================================
// Registry
// ============================================================================

/**
 * Registry of all content generators, keyed by ComponentId
 */
const CONTENT_GENERATORS: Partial<Record<ComponentId, ContentGenerator>> = {};

/**
 * Register a content generator for a component type
 *
 * Typically called at module load via side-effect import.
 * Example: `import './registry/generators/mathGenerators';`
 *
 * @param id - The component ID to register
 * @param generator - The generator function
 */
export function registerGenerator<TConfig = ManifestItemConfig, TData = unknown>(
  id: ComponentId,
  generator: ContentGenerator<TConfig, TData>
): void {
  if (CONTENT_GENERATORS[id]) {
    console.warn(`[ContentRegistry] Generator for '${id}' already registered. Overwriting.`);
  }

  if (DEBUG_CONTENT_REGISTRY) {
    console.log(`[ContentRegistry] Registered generator for '${id}'`);
  }

  CONTENT_GENERATORS[id] = generator as ContentGenerator;
}

/**
 * Look up a generator by component ID
 *
 * @param id - The component ID to look up
 * @returns The generator function or undefined if not registered
 */
export function getGenerator(id: ComponentId): ContentGenerator | undefined {
  const generator = CONTENT_GENERATORS[id];

  if (DEBUG_CONTENT_REGISTRY) {
    if (generator) {
      console.log(`[ContentRegistry] Found generator for '${id}'`);
    } else {
      console.log(`[ContentRegistry] No generator found for '${id}', will use fallback`);
    }
  }

  return generator;
}

/**
 * Check if a generator is registered for a component ID
 *
 * @param id - The component ID to check
 * @returns True if a generator is registered
 */
export function hasGenerator(id: ComponentId): boolean {
  return id in CONTENT_GENERATORS;
}

/**
 * Get all registered component IDs
 *
 * Useful for debugging and validation.
 *
 * @returns Array of registered component IDs
 */
export function getRegisteredIds(): ComponentId[] {
  return Object.keys(CONTENT_GENERATORS) as ComponentId[];
}

/**
 * Get the count of registered generators
 *
 * @returns Number of registered generators
 */
export function getRegisteredCount(): number {
  return Object.keys(CONTENT_GENERATORS).length;
}

// ============================================================================
// Exports
// ============================================================================

export { CONTENT_GENERATORS };
