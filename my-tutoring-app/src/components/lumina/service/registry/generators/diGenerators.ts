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
import { generateDiWorkedProcedure } from '../../direct-instruction/gemini-di-worked-procedure';
import { generateDiDeduction } from '../../direct-instruction/gemini-di-deduction';

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

// di-worked-procedure -- talk-through subtraction, the first "DI for Older
// Learners" pack. The step chain is planned in code; Gemini writes only the
// answer-free wrapper and a number-range hint. The canonical grade rides
// explicitly (the generator never parses grade out of the prose context).
registerContextGenerator('di-worked-procedure', async (ctx) => ({
  type: 'di-worked-procedure',
  instanceId: ctx.instanceId,
  data: await generateDiWorkedProcedure(ctx.topic, ctx.gradeContext, {
    ...ctx.raw,
    intent: ctx.intent,
    objectiveText: ctx.objective?.text,
    grade: ctx.grade ?? ctx.gradeLevel,
    targetEvalMode: ctx.targetEvalMode ?? (ctx.raw.targetEvalMode as string | undefined),
    supportTier: ctx.supportTier,
  }),
}));

// di-deduction -- a rule and a case, the second "DI for Older Learners" pack.
// Gemini emits the scope (a category, a property, entity lists); code builds
// every case, ask and answer, and a separate review call gates truth.
registerContextGenerator('di-deduction', async (ctx) => ({
  type: 'di-deduction',
  instanceId: ctx.instanceId,
  data: await generateDiDeduction(ctx.topic, ctx.gradeContext, {
    ...ctx.raw,
    intent: ctx.intent,
    objectiveText: ctx.objective?.text,
    grade: ctx.grade ?? ctx.gradeLevel,
    targetEvalMode: ctx.targetEvalMode ?? (ctx.raw.targetEvalMode as string | undefined),
    supportTier: ctx.supportTier,
  }),
}));
