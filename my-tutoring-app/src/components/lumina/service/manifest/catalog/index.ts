/**
 * Catalog Index - Aggregates all component catalogs
 *
 * This module provides both the unified UNIVERSAL_CATALOG (for manifest generation)
 * and domain-specific catalogs (for targeted AI context).
 *
 * Usage:
 *   // For full catalog (manifest generation)
 *   import { UNIVERSAL_CATALOG } from './catalog';
 *
 *   // For domain-specific work (reduced AI context)
 *   import { MATH_CATALOG, ENGINEERING_CATALOG } from './catalog';
 */

import { ComponentDefinition } from '../../../types';

// Import domain catalogs
import { CORE_CATALOG } from './core';
import { MATH_CATALOG } from './math';
import { ENGINEERING_CATALOG } from './engineering';
import { SCIENCE_CATALOG } from './science';
import { BIOLOGY_CATALOG } from './biology';
import { ASTRONOMY_CATALOG } from './astronomy';
import { PHYSICS_CATALOG } from './physics';
import { LITERACY_CATALOG } from './literacy';
import { MEDIA_CATALOG } from './media';
import { ASSESSMENT_CATALOG } from './assessment';

// ============================================================================
// Domain Exports (for targeted context)
// ============================================================================

export {
  CORE_CATALOG,
  MATH_CATALOG,
  ENGINEERING_CATALOG,
  SCIENCE_CATALOG,
  BIOLOGY_CATALOG,
  ASTRONOMY_CATALOG,
  PHYSICS_CATALOG,
  LITERACY_CATALOG,
  MEDIA_CATALOG,
  ASSESSMENT_CATALOG,
};

// ============================================================================
// Unified Catalog (for manifest generation)
// ============================================================================

/**
 * UNIVERSAL_CATALOG - Complete catalog of all available components
 *
 * This is the full list used by the manifest generator.
 * For adding new primitives, add them to the appropriate domain catalog file.
 */
export const UNIVERSAL_CATALOG: ComponentDefinition[] = [
  ...CORE_CATALOG,
  ...MATH_CATALOG,
  ...ENGINEERING_CATALOG,
  ...SCIENCE_CATALOG,
  ...BIOLOGY_CATALOG,
  ...ASTRONOMY_CATALOG,
  ...PHYSICS_CATALOG,
  ...LITERACY_CATALOG,
  ...MEDIA_CATALOG,
  ...ASSESSMENT_CATALOG,
];

// ============================================================================
// Catalog Lookup by Domain
// ============================================================================

/**
 * CATALOGS_BY_DOMAIN - Access catalogs by domain name
 *
 * Useful for AI agents that only need context about specific domains.
 */
export const CATALOGS_BY_DOMAIN: Record<string, ComponentDefinition[]> = {
  core: CORE_CATALOG,
  math: MATH_CATALOG,
  engineering: ENGINEERING_CATALOG,
  science: SCIENCE_CATALOG,
  biology: BIOLOGY_CATALOG,
  astronomy: ASTRONOMY_CATALOG,
  physics: PHYSICS_CATALOG,
  literacy: LITERACY_CATALOG,
  media: MEDIA_CATALOG,
  assessment: ASSESSMENT_CATALOG,
};

/**
 * Get a catalog by domain name
 */
export function getCatalogByDomain(domain: string): ComponentDefinition[] | undefined {
  return CATALOGS_BY_DOMAIN[domain.toLowerCase()];
}

/**
 * Get all domain names
 */
export function getDomainNames(): string[] {
  return Object.keys(CATALOGS_BY_DOMAIN);
}

/**
 * Look up a single component definition by its ID.
 * Used by the AI tutoring pipeline to retrieve scaffolding metadata.
 */
export function getComponentById(id: string): ComponentDefinition | undefined {
  return UNIVERSAL_CATALOG.find(c => c.id === id);
}
