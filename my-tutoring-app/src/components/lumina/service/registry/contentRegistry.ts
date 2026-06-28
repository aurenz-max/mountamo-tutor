/**
 * Content Registry - Central registry for component content generators
 *
 * This registry decouples content generation logic from the monolithic geminiService.ts,
 * reducing the "context debt" when adding new primitives from ~7,000 lines to ~100 lines.
 *
 * Pattern mirrors the proven primitiveRegistry.tsx for UI rendering.
 */

import { ComponentId } from '../../types';
import type { GenerationContext } from '../generation/generationContext';
import { resolveGenerationContext } from '../generation/resolveGenerationContext';

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
 * @param gradeContext - Grade-appropriate context string for Gemini prompts
 * @param gradeLevel - Raw grade level key (e.g., 'undergraduate', 'elementary')
 * @returns Generated component data or null if generation fails
 */
export type ContentGenerator<TConfig = ManifestItemConfig, TData = unknown> = (
  item: ManifestItem<TConfig>,
  topic: string,
  gradeContext: string,
  gradeLevel: string
) => Promise<GeneratedComponent<TData> | null>;

/**
 * Context-native generator signature — the harmonized contract.
 *
 * Receives a single resolved `GenerationContext` (built once by the registry
 * boundary) instead of the four positional `(item, topic, gradeContext, gradeLevel)`
 * arguments. New and migrated generators use this; legacy generators keep the
 * `ContentGenerator` signature until migrated. See
 * docs/PRD_GENERATION_CONTEXT_HARMONIZATION.md.
 */
export type ContextGenerator<TData = unknown> = (
  ctx: GenerationContext
) => Promise<GeneratedComponent<TData> | null>;

// ============================================================================
// Registry
// ============================================================================

/**
 * Registry of all content generators, keyed by ComponentId
 */
const CONTENT_GENERATORS: Partial<Record<ComponentId, ContentGenerator>> = {};

/**
 * Ledger of component IDs registered via `registerContextGenerator` — i.e. the
 * generators that receive the harmonized `GenerationContext` (resolved once at this
 * boundary) rather than the raw positional `(item, topic, …)` arguments.
 *
 * `CONTENT_GENERATORS` alone cannot tell context-native from legacy generators
 * because `registerContextGenerator` wraps into a `ContentGenerator`. This ledger
 * makes that distinction observable so the intent-contract regression test (PRD §6.5)
 * can assert the migrated set stays context-native: reverting any covered id to
 * `registerGenerator` re-opens the intent-drop defect class and fails that test.
 */
const CONTEXT_NATIVE_IDS = new Set<ComponentId>();

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

  CONTENT_GENERATORS[id] = generator as ContentGenerator;
}

/**
 * Register a CONTEXT-NATIVE generator for a component type.
 *
 * The generator receives a single resolved `GenerationContext` instead of the four
 * positional arguments. Internally this wraps it as a `ContentGenerator` that builds
 * the context via `resolveGenerationContext` at the dispatch boundary — so the
 * generator never sees `item`/`config` and a handler cannot drop an axis (intent,
 * scope, support tier, …). The dispatch site (`generateComponentContent`) is
 * unchanged; both registration styles coexist during the incremental migration.
 *
 * @param id - The component ID to register
 * @param generator - The context-native generator function
 */
export function registerContextGenerator<TData = unknown>(
  id: ComponentId,
  generator: ContextGenerator<TData>
): void {
  const wrapped: ContentGenerator = (item, topic, gradeContext, gradeLevel) =>
    generator(resolveGenerationContext(item, topic, gradeContext, gradeLevel));

  registerGenerator(id, wrapped);
  CONTEXT_NATIVE_IDS.add(id);
}

/**
 * True if `id` was registered as a context-native generator (via
 * `registerContextGenerator`), i.e. it consumes the resolved `GenerationContext`.
 */
export function isContextNative(id: ComponentId): boolean {
  return CONTEXT_NATIVE_IDS.has(id);
}

/**
 * Look up a generator by component ID
 *
 * @param id - The component ID to look up
 * @returns The generator function or undefined if not registered
 */
export function getGenerator(id: ComponentId): ContentGenerator | undefined {
  return CONTENT_GENERATORS[id];
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

export { CONTENT_GENERATORS, CONTEXT_NATIVE_IDS };
