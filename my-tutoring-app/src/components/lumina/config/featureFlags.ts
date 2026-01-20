/**
 * Feature flags for Lumina component system
 *
 * These flags control the gradual migration from the monolithic switch-based
 * architecture to the modular registry-based pattern.
 */

/**
 * When true, uses the new ContentRegistry for component generation.
 * Falls back to the legacy switch statement if the generator isn't registered.
 *
 * Set to 'true' to enable the new registry pattern.
 * During migration, this allows incremental adoption while maintaining backward compatibility.
 */
export const USE_CONTENT_REGISTRY = process.env.NEXT_PUBLIC_USE_CONTENT_REGISTRY === 'true' || true;

/**
 * When true, logs registry lookups and fallbacks to the console.
 * Useful for debugging during migration.
 */
export const DEBUG_CONTENT_REGISTRY = process.env.NEXT_PUBLIC_DEBUG_CONTENT_REGISTRY === 'true' || false;
