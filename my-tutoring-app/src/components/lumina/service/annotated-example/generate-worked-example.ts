/**
 * The one entry every caller (lesson registry, tester route) uses to build an
 * annotated example. The agentic author is the default
 * (qa/annotated-example-bench, 2026-11-04); LUMINA_AE_PIPELINE=legacy selects
 * the staged pipeline, which is also the fallback when the agent fails.
 */

import { generateAnnotatedExample, type GenerateAnnotatedExampleInput } from './gemini-annotated-example';
import { generateAnnotatedExampleAgentic } from './agent/agent-annotated-example';
import type { RichAnnotatedExampleData } from '../../primitives/annotated-example/types';

export async function generateWorkedExample(input: GenerateAnnotatedExampleInput): Promise<RichAnnotatedExampleData> {
  if (process.env.LUMINA_AE_PIPELINE === 'legacy') return generateAnnotatedExample(input);
  try {
    return await generateAnnotatedExampleAgentic(input);
  } catch (error) {
    console.warn('[AnnotatedExample] Agent failed; using the staged pipeline:', error);
    return generateAnnotatedExample(input);
  }
}
