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
import { generateDiMathFacts } from '../../direct-instruction/gemini-di-math-facts';
import { generateDiShapes } from '../../direct-instruction/gemini-di-shapes';
import { generateDiSentenceReading } from '../../direct-instruction/gemini-di-sentence-reading';
import { generateDiSpokenPractice } from '../../direct-instruction/gemini-di-spoken-practice';
import { generateDiDiceRoll } from '../../direct-instruction/gemini-di-dice-roll';

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

// di-math-facts — printed addition/subtraction facts + the next-number step,
// pool-scoped to the objective (skill chosen by the L1 eval-mode resolution).
registerContextGenerator('di-math-facts', async (ctx) => ({
  type: 'di-math-facts',
  instanceId: ctx.instanceId,
  data: await generateDiMathFacts(ctx.topic, ctx.gradeContext, {
    ...ctx.raw,
    intent: ctx.intent,
  }),
}));

// di-shapes — drawn 2D shapes, menu-scoped to the objective (named shapes win,
// then the model's hint filtered to the grade menu, then the K.G.2 core five).
registerContextGenerator('di-shapes', async (ctx) => ({
  type: 'di-shapes',
  instanceId: ctx.instanceId,
  data: await generateDiShapes(ctx.topic, ctx.gradeContext, {
    ...ctx.raw,
    intent: ctx.intent,
  }),
}));

// di-sentence-reading — printed short sentences (3-8 words), menu-scoped to the
// objective's phonics pattern / sight-word focus and the grade word ceiling.
registerContextGenerator('di-sentence-reading', async (ctx) => ({
  type: 'di-sentence-reading',
  instanceId: ctx.instanceId,
  data: await generateDiSentenceReading(ctx.topic, ctx.gradeContext, {
    ...ctx.raw,
    intent: ctx.intent,
  }),
}));

// di-spoken-practice — the content-generic pack: Gemini writes the items AND
// their per-skill judging clauses, code holds the gates (benched response
// class, answer-leak scan, code-computed counting answers).
registerContextGenerator('di-spoken-practice', async (ctx) => ({
  type: 'di-spoken-practice',
  instanceId: ctx.instanceId,
  data: await generateDiSpokenPractice(ctx.topic, ctx.gradeContext, {
    ...ctx.raw,
    intent: ctx.intent,
  }),
}));

// di-dice-roll -- code-owned six-sided die values and spoken answers; Gemini
// writes only answer-free session chrome.
registerContextGenerator('di-dice-roll', async (ctx) => ({
  type: 'di-dice-roll',
  instanceId: ctx.instanceId,
  data: await generateDiDiceRoll(ctx.topic, ctx.gradeContext, {
    ...ctx.raw,
    intent: ctx.intent,
  }),
}));
