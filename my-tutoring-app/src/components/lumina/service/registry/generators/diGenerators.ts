/**
 * Direct Instruction Generators — self-registering module for the DI primitive
 * family (live-judged spoken call-response over Gemini Live).
 *
 * Import this file for side-effects to register the generators.
 * Usage: import './registry/generators/diGenerators';
 */

import { registerGenerator } from '../contentRegistry';
import { generateDiLetterSounds } from '../../direct-instruction/gemini-di-letter-sounds';
import { generateDiWordReading } from '../../direct-instruction/gemini-di-word-reading';

// di-letter-sounds — continuous letter sounds, menu-scoped to the objective.
registerGenerator('di-letter-sounds', async (item, topic, gradeContext) => ({
  type: 'di-letter-sounds',
  instanceId: item.instanceId,
  data: await generateDiLetterSounds(topic, gradeContext, {
    ...item.config,
    intent: item.intent || item.title,
  }),
}));

// di-word-reading — printed CVC + sight words, menu-scoped to the objective.
registerGenerator('di-word-reading', async (item, topic, gradeContext) => ({
  type: 'di-word-reading',
  instanceId: item.instanceId,
  data: await generateDiWordReading(topic, gradeContext, {
    ...item.config,
    intent: item.intent || item.title,
  }),
}));
