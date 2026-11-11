/**
 * The one entry the registry uses to build a DeepDive. `config.pipeline`
 * ('agent' | 'legacy'), else LUMINA_DD_PIPELINE, picks the author. The agent is
 * the default (USER 2026-11-08); the staged pipeline is the fallback when the
 * agent fails, and LUMINA_DD_PIPELINE=legacy turns the agent off.
 */

import { generateDeepDive } from '../gemini-deep-dive';
import { generateDeepDiveAgentic } from './agent-deep-dive';
import type { GenerationContext } from '../../generation/generationContext';
import type { DeepDiveData } from '../../../primitives/visual-primitives/core/deep-dive/types';

export async function generateDeepDiveEntry(ctx: GenerationContext): Promise<DeepDiveData> {
  const pipeline = (ctx.raw as { pipeline?: string } | undefined)?.pipeline ?? process.env.LUMINA_DD_PIPELINE ?? 'agent';
  if (pipeline !== 'agent') return generateDeepDive(ctx);
  try {
    return await generateDeepDiveAgentic(ctx);
  } catch (error) {
    console.warn('[DeepDive] Agent failed; using the staged pipeline:', error);
    return generateDeepDive(ctx);
  }
}
