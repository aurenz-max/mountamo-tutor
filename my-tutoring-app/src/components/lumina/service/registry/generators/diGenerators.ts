/**
 * Direct Instruction Generators — self-registering module for the DI primitive
 * family (live-judged spoken call-response over Gemini Live).
 *
 * Import this file for side-effects to register the generators.
 * Usage: import './registry/generators/diGenerators';
 */

import { registerContextGenerator } from '../contentRegistry';
import { generateDiLetterSounds } from '../../direct-instruction/gemini-di-letter-sounds';
import { generateDiWordReading } from '../../direct-instruction/gemini-di-word-reading';

// di-letter-sounds — continuous letter sounds, menu-scoped to the objective.
registerContextGenerator('di-letter-sounds', async (ctx) => ({
  type: 'di-letter-sounds',
  instanceId: ctx.instanceId,
  data: await generateDiLetterSounds(ctx.topic, ctx.gradeContext, {
    ...ctx.raw,
    intent: ctx.intent,
  }),
}));

// di-word-reading — printed CVC + sight words, menu-scoped to the objective.
registerContextGenerator('di-word-reading', async (ctx) => ({
  type: 'di-word-reading',
  instanceId: ctx.instanceId,
  data: await generateDiWordReading(ctx.topic, ctx.gradeContext, {
    ...ctx.raw,
    intent: ctx.intent,
  }),
}));
