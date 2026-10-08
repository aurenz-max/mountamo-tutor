/**
 * Creation Generators - Self-registering module for open-ended creation primitives
 *
 * Usage: import './registry/generators/creationGenerators';
 */

import { registerContextGenerator } from '../contentRegistry';
import { generateOpenBuilder } from '../../creation/gemini-open-builder';

// Open Builder (build freely from a hopper to meet a goal; an inspector judges the build)
registerContextGenerator('open-builder', async (ctx) => ({
  type: 'open-builder',
  instanceId: ctx.instanceId,
  data: await generateOpenBuilder(ctx),
}));
