import { NextRequest, NextResponse } from 'next/server';
import { UNIVERSAL_CATALOG } from '@/components/lumina/service/manifest/catalog';
import { generateComponentContent } from '@/components/lumina/service/geminiService';
import type { ComponentDefinition, EvalModeDefinition } from '@/components/lumina/types';

/**
 * GET /api/lumina/eval-test
 *
 * Without query params: returns catalog of all primitives with eval modes.
 * With ?componentId=X&evalMode=Y: runs a single test and returns full data (for CLI/Claude Code).
 *
 * Optional: &topic=X &gradeLevel=X
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const componentId = searchParams.get('componentId');
  const evalMode = searchParams.get('evalMode');

  // Single-test mode: returns full generated data for CLI analysis
  if (componentId && evalMode) {
    const testTopic = searchParams.get('topic') || 'number sense';
    const testGradeLevel = searchParams.get('gradeLevel') || 'elementary';

    const component = UNIVERSAL_CATALOG.find((c) => c.id === componentId);
    const modeDefinition = component?.evalModes?.find((m) => m.evalMode === evalMode);

    const item = {
      componentId,
      instanceId: `eval-test-${componentId}-${evalMode}-${Date.now()}`,
      config: { targetEvalMode: evalMode },
    };

    const startTime = Date.now();
    try {
      const result = await generateComponentContent(item, testTopic, testGradeLevel);
      const duration = Date.now() - startTime;

      if (!result || !result.data) {
        return NextResponse.json({
          status: 'fail',
          componentId,
          evalMode,
          duration,
          error: 'Generator returned null or empty data',
        }, { status: 500 });
      }

      // Validate challenge types
      const data = result.data as Record<string, unknown>;
      const validation = validateChallengeTypes(data, componentId, evalMode);

      return NextResponse.json({
        status: validation.valid ? 'pass' : 'fail',
        componentId,
        evalMode,
        duration,
        catalogMeta: modeDefinition ? {
          label: modeDefinition.label,
          beta: modeDefinition.beta,
          scaffoldingMode: modeDefinition.scaffoldingMode,
          allowedChallengeTypes: modeDefinition.challengeTypes,
          description: modeDefinition.description,
        } : null,
        validation: {
          challengeCount: validation.challengeCount,
          typesFound: validation.typesFound,
          disallowedTypes: validation.disallowedTypes,
          error: validation.error,
        },
        fullData: result.data,
      });
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json({
        status: 'error',
        componentId,
        evalMode,
        duration,
        error: message,
      }, { status: 500 });
    }
  }

  // Catalog mode: list all primitives with eval modes
  const primitivesWithEvalModes = UNIVERSAL_CATALOG
    .filter((c: ComponentDefinition) => c.evalModes && c.evalModes.length > 0)
    .map((c: ComponentDefinition) => ({
      id: c.id,
      description: c.description,
      evalModes: c.evalModes!.map((m: EvalModeDefinition) => ({
        evalMode: m.evalMode,
        label: m.label,
        beta: m.beta,
        scaffoldingMode: m.scaffoldingMode,
        challengeTypes: m.challengeTypes,
        description: m.description,
      })),
    }));

  return NextResponse.json({
    totalPrimitives: primitivesWithEvalModes.length,
    totalEvalModes: primitivesWithEvalModes.reduce((sum, p) => sum + p.evalModes.length, 0),
    primitives: primitivesWithEvalModes,
  });
}

/**
 * POST /api/lumina/eval-test
 *
 * Runs one or more eval mode tests by calling the actual Gemini generators.
 *
 * Body: {
 *   tests: Array<{ componentId: string, evalMode: string }>,
 *   topic?: string,       // default: "number sense"
 *   gradeLevel?: string   // default: "elementary"
 * }
 *
 * Returns streamed NDJSON so the dashboard can show results as they complete.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    tests,
    topic = 'number sense',
    gradeLevel = 'elementary',
  } = body as {
    tests: Array<{ componentId: string; evalMode: string }>;
    topic?: string;
    gradeLevel?: string;
  };

  if (!tests || !Array.isArray(tests) || tests.length === 0) {
    return NextResponse.json({ error: 'tests array is required' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendEvent = async (event: Record<string, unknown>) => {
    const data = JSON.stringify(event) + '\n';
    await writer.write(encoder.encode(data));
  };

  // Run tests sequentially to avoid Gemini rate limits
  (async () => {
    let passed = 0;
    let failed = 0;
    let errored = 0;

    for (let i = 0; i < tests.length; i++) {
      const { componentId, evalMode } = tests[i];
      const startTime = Date.now();

      try {
        const item = {
          componentId,
          instanceId: `eval-test-${componentId}-${evalMode}-${Date.now()}`,
          config: { targetEvalMode: evalMode },
        };

        const result = await generateComponentContent(item, topic, gradeLevel);
        const duration = Date.now() - startTime;

        if (!result || !result.data) {
          failed++;
          await sendEvent({
            type: 'test-result',
            index: i,
            total: tests.length,
            componentId,
            evalMode,
            status: 'fail',
            duration,
            error: 'Generator returned null or empty data',
          });
          continue;
        }

        // Validate: check that generated challenge types match allowed types
        const data = result.data;
        const validation = validateChallengeTypes(data, componentId, evalMode);

        if (validation.valid) {
          passed++;
          await sendEvent({
            type: 'test-result',
            index: i,
            total: tests.length,
            componentId,
            evalMode,
            status: 'pass',
            duration,
            challengeCount: validation.challengeCount,
            typesFound: validation.typesFound,
            data: summarizeData(data),
          });
        } else {
          failed++;
          await sendEvent({
            type: 'test-result',
            index: i,
            total: tests.length,
            componentId,
            evalMode,
            status: 'fail',
            duration,
            challengeCount: validation.challengeCount,
            typesFound: validation.typesFound,
            disallowedTypes: validation.disallowedTypes,
            error: validation.error,
            data: summarizeData(data),
          });
        }
      } catch (error: unknown) {
        errored++;
        const duration = Date.now() - startTime;
        const message = error instanceof Error ? error.message : 'Unknown error';
        await sendEvent({
          type: 'test-result',
          index: i,
          total: tests.length,
          componentId,
          evalMode,
          status: 'error',
          duration,
          error: message,
        });
      }
    }

    await sendEvent({
      type: 'summary',
      total: tests.length,
      passed,
      failed,
      errored,
    });

    await writer.close();
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

interface ValidationResult {
  valid: boolean;
  challengeCount: number;
  typesFound: string[];
  disallowedTypes?: string[];
  error?: string;
}

/**
 * Look up the catalog to find allowed types, then check generated data.
 * Handles both array-based challenges and root-level type fields.
 */
function validateChallengeTypes(
  data: Record<string, unknown>,
  componentId: string,
  evalMode: string,
): ValidationResult {
  // Find allowed types from catalog
  const component = UNIVERSAL_CATALOG.find((c) => c.id === componentId);
  const modeDefinition = component?.evalModes?.find((m) => m.evalMode === evalMode);

  if (!modeDefinition) {
    return { valid: true, challengeCount: 0, typesFound: [], error: 'No eval mode in catalog (skipped validation)' };
  }

  const allowedList = modeDefinition.challengeTypes;
  const allowed = new Set(allowedList);

  // Try to find challenges in various array names
  const arrayNames = ['challenges', 'words', 'instances', 'questions', 'items', 'problems'];
  let challenges: Array<Record<string, unknown>> | null = null;
  let arrayName = '';

  for (const name of arrayNames) {
    if (Array.isArray(data[name])) {
      challenges = data[name] as Array<Record<string, unknown>>;
      arrayName = name;
      break;
    }
  }

  // Check root-level type field (e.g., function-machine)
  const typeFieldNames = ['type', 'mode', 'operation', 'clueType', 'patternType', 'sentenceType'];
  for (const field of typeFieldNames) {
    if (typeof data[field] === 'string' && !challenges) {
      const rootType = data[field] as string;
      const typesFound = [rootType];
      const disallowed = typesFound.filter((t) => !allowed.has(t));
      return {
        valid: disallowed.length === 0,
        challengeCount: 1,
        typesFound,
        disallowedTypes: disallowed.length > 0 ? disallowed : undefined,
        error: disallowed.length > 0
          ? `Root-level type "${rootType}" not in allowed types [${allowedList.join(', ')}]`
          : undefined,
      };
    }
  }

  if (!challenges || challenges.length === 0) {
    // No array found — might be a different structure, pass with warning
    return {
      valid: true,
      challengeCount: 0,
      typesFound: [],
      error: `No challenge array found (checked: ${arrayNames.join(', ')}). Data keys: [${Object.keys(data).join(', ')}]`,
    };
  }

  // Extract types from challenges
  const typesFound: string[] = [];
  for (const challenge of challenges) {
    for (const field of typeFieldNames) {
      if (typeof challenge[field] === 'string') {
        typesFound.push(challenge[field] as string);
        break;
      }
    }
  }

  const uniqueTypes = typesFound.filter((t, i) => typesFound.indexOf(t) === i);
  const disallowed = uniqueTypes.filter((t) => !allowed.has(t));

  return {
    valid: disallowed.length === 0,
    challengeCount: challenges.length,
    typesFound: uniqueTypes,
    disallowedTypes: disallowed.length > 0 ? disallowed : undefined,
    error: disallowed.length > 0
      ? `Found disallowed types [${disallowed.join(', ')}] in ${arrayName}. Allowed: [${allowedList.join(', ')}]`
      : undefined,
  };
}

/**
 * Create a compact summary of the generated data (first challenge + key counts)
 */
function summarizeData(data: Record<string, unknown>): Record<string, unknown> {
  const summary: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      summary[key] = `Array(${value.length})`;
      if (value.length > 0) {
        summary[`${key}[0]`] = value[0];
      }
    } else if (typeof value === 'object' && value !== null) {
      summary[key] = `Object(${Object.keys(value).length} keys)`;
    } else {
      summary[key] = value;
    }
  }

  return summary;
}
