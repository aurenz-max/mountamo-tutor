import { NextRequest, NextResponse } from 'next/server';
import { UNIVERSAL_CATALOG } from '@/components/lumina/service/manifest/catalog';
import { generateComponentContent } from '@/components/lumina/service/geminiService';
import type { ComponentDefinition } from '@/components/lumina/types';
import { CONTENT_ORACLES, getOracle } from '@/components/lumina/service/qa/oracles';
import type { OracleViolation } from '@/components/lumina/service/qa/oracles';

/**
 * GET /api/lumina/oracle-test — deterministic content-contract QA.
 *
 * Two halves: the generation tap (the same generateComponentContent call the
 * real pipeline and /eval-test use) and a per-primitive calculation engine
 * (the oracle registry at service/qa/oracles). Where /eval-test is agent-judged
 * and qualitative, this route is code-judged: repeatable, free, CI-able.
 *
 * Without params: oracle coverage report against the catalog.
 * With ?componentId=X&evalMode=Y: generates N times (&runs=, default 3) and
 * runs the oracle on every generation. Any violation or generation failure
 * fails the run — exit signal in `status`.
 *
 * Optional: &topic= &gradeLevel= &difficulty= &intent= &grade= &scopeMax=
 * &includeData=1 (attach fullData of the first violating run for debugging).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const componentId = searchParams.get('componentId');
  const evalMode = searchParams.get('evalMode');

  if (componentId && evalMode) {
    const oracle = getOracle(componentId);
    if (!oracle) {
      return NextResponse.json({
        status: 'no-oracle',
        componentId,
        error: `No content oracle registered for "${componentId}". Write one via /oracle-test (see service/qa/oracles/index.ts).`,
      }, { status: 400 });
    }
    if (oracle.modes && !oracle.modes.includes(evalMode)) {
      return NextResponse.json({
        status: 'no-oracle',
        componentId,
        evalMode,
        error: `Oracle for "${componentId}" only covers modes [${oracle.modes.join(', ')}].`,
      }, { status: 400 });
    }

    const topic = searchParams.get('topic') || 'number sense';
    const gradeLevel = searchParams.get('gradeLevel') || 'elementary';
    const difficulty = searchParams.get('difficulty') || undefined;
    const intent = searchParams.get('intent') || undefined;
    const grade = searchParams.get('grade') || undefined;
    const scopeMaxParam = searchParams.get('scopeMax');
    const scopeMax = scopeMaxParam !== null ? parseInt(scopeMaxParam, 10) : undefined;
    const runs = Math.min(Math.max(parseInt(searchParams.get('runs') || '3', 10) || 3, 1), 25);
    const includeData = searchParams.get('includeData') === '1';

    const ctx = {
      componentId,
      evalMode,
      topic,
      gradeLevel,
      ...(scopeMax !== undefined && Number.isFinite(scopeMax) ? { scopeMax } : {}),
    };

    const runResults: Array<Record<string, unknown>> = [];
    const generationFailures: Array<{ run: number; error: string }> = [];
    let totalViolations = 0;
    let firstViolatingData: Record<string, unknown> | null = null;

    // Sequential to avoid Gemini rate limits (mirrors /eval-test POST).
    for (let run = 1; run <= runs; run++) {
      const item = {
        componentId,
        instanceId: `oracle-test-${componentId}-${evalMode}-${Date.now()}-${run}`,
        config: {
          targetEvalMode: evalMode,
          ...(difficulty ? { difficulty } : {}),
          ...(intent ? { intent } : {}),
          ...(grade ? { objectiveGrade: grade } : {}),
        },
      };
      const startTime = Date.now();
      try {
        const result = await generateComponentContent(item, topic, gradeLevel);
        const duration = Date.now() - startTime;
        if (!result || !result.data) {
          generationFailures.push({ run, error: 'Generator returned null or empty data' });
          continue;
        }
        const data = result.data as Record<string, unknown>;
        const verdict = oracle.verify(data, ctx);
        totalViolations += verdict.violations.length;
        if (verdict.violations.length > 0 && !firstViolatingData) firstViolatingData = data;
        runResults.push({
          run,
          duration,
          checkedChallenges: verdict.checkedChallenges,
          uncheckedTypes: verdict.uncheckedTypes,
          violations: verdict.violations,
        });
      } catch (error: unknown) {
        generationFailures.push({ run, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    const status = totalViolations === 0 && generationFailures.length === 0 ? 'pass' : 'fail';
    return NextResponse.json({
      status,
      componentId,
      evalMode,
      topic,
      gradeLevel,
      ...(difficulty ? { difficulty } : {}),
      runs,
      generationFailures,
      flakinessRate: `${generationFailures.length}/${runs}`,
      totalViolations,
      violationsByCheck: countByCheck(runResults),
      runResults,
      ...(includeData && firstViolatingData ? { firstViolatingData } : {}),
    }, { status: status === 'pass' ? 200 : 422 });
  }

  // Coverage mode: which catalog primitives have a calculation engine?
  const evaluable = UNIVERSAL_CATALOG.filter(
    (c: ComponentDefinition) => c.evalModes && c.evalModes.length > 0,
  );
  const coveredIds = new Set(CONTENT_ORACLES.map((o) => o.componentId));
  return NextResponse.json({
    totalEvaluablePrimitives: evaluable.length,
    oracleCount: CONTENT_ORACLES.length,
    covered: CONTENT_ORACLES.map((o) => ({
      componentId: o.componentId,
      modes: o.modes ?? 'all',
      inCatalog: evaluable.some((c) => c.id === o.componentId),
    })),
    uncovered: evaluable.filter((c) => !coveredIds.has(c.id)).map((c) => c.id),
  });
}

function countByCheck(runResults: Array<Record<string, unknown>>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of runResults) {
    for (const v of (r.violations as OracleViolation[]) ?? []) {
      counts[v.check] = (counts[v.check] ?? 0) + 1;
    }
  }
  return counts;
}
