/**
 * Physics Generators - Self-registering module for physics primitives
 *
 * This module registers all physics-related content generators with the ContentRegistry.
 * Import this file for side-effects to register the generators.
 *
 * Usage: import './registry/generators/physicsGenerators';
 */

import { registerGenerator } from '../contentRegistry';

// Physics Generator Imports
import { generateMotionDiagram } from '../../physics/gemini-motion-diagram';

// ============================================================================
// Physics Primitives Registration (Middle School - High School)
// ============================================================================

// Motion Diagram / Strobe Diagram - Kinematics visualization
registerGenerator('motion-diagram', async (item, topic, gradeContext) => ({
  type: 'motion-diagram',
  instanceId: item.instanceId,
  data: await generateMotionDiagram(topic, gradeContext, item.config),
}));

// ============================================================================
// Migration status: 1/1 physics primitives registered
// ============================================================================
