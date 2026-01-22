/**
 * Feature flags for Lumina component system
 *
 * These flags control the migration from the legacy switch-based content
 * generation to the new registry-based pattern.
 */

/**
 * When true, uses the ContentRegistry for content generation.
 * When false, falls back to the legacy switch statement.
 *
 * Set to true by default - the registry is the primary path.
 * The fallback switch remains for any components not yet migrated.
 */
export const USE_CONTENT_REGISTRY = true;

/**
 * When true, logs detailed registry lookup information for debugging.
 * Useful during migration to verify which path is being used.
 */
export const DEBUG_CONTENT_REGISTRY = process.env.NODE_ENV === 'development';
