import { NextRequest, NextResponse } from 'next/server';
import { UNIVERSAL_CATALOG, getComponentById } from '@/components/lumina/service/manifest/catalog';
import { generateComponentContent } from '@/components/lumina/service/geminiService';
import type { ComponentDefinition, TutoringScaffold } from '@/components/lumina/types';
import {
  buildSourceIndex,
  auditScaffold,
  auditAllScaffolds,
  buildScaffoldPromptPreview,
} from '@/components/lumina/service/qa/tutoring/scaffoldAudit';

/**
 * GET /api/lumina/tutor-test — deterministic tutoring-scaffold QA (/tutor-test skill).
 *
 * Verifies the static contract chain of the AI tutoring connection:
 * catalog tutoring block → useLuminaAI(primitiveType, primitiveData) →
 * WebSocket auth → backend {{key}} interpolation. The backend renders any
 * unresolvable {{key}} as '(not set)' with no error, so these breaks are
 * invisible at runtime — this route makes them visible. Code-judged, free,
 * CI-able; the tutoring sibling of /api/lumina/oracle-test.
 *
 * Modes:
 * - No params: Tier-1 sweep of every catalog entry with a tutoring block.
 *   `&full=1` includes findings for passing primitives too.
 * - ?componentId=X: single-primitive audit + a static prompt preview
 *   (component-provided keys render as «runtime:key» placeholders).
 * - ?componentId=X&probe=1: Tier-2 — generates REAL content via the same
 *   generateComponentContent call the pipeline uses, then reports where each
 *   {{var}}/contextKey would resolve from and renders the assembled prompt.
 *   Optional: &evalMode= &topic= &gradeLevel=
 *
 * Tier 3 (live Gemini behavior — answer withholding, directive compliance)
 * is NOT covered here; use the Lumina Tutor Tester dev panel.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const componentId = searchParams.get('componentId');

  const index = buildSourceIndex();

  // ---- Sweep mode -----------------------------------------------------------
  if (!componentId) {
    const sweep = auditAllScaffolds(UNIVERSAL_CATALOG as ComponentDefinition[], index);
    const full = searchParams.get('full') === '1';
    return NextResponse.json({
      totalScaffolds: sweep.totalScaffolds,
      statusCounts: sweep.statusCounts,
      staleHookIds: sweep.staleHookIds,
      hookNoScaffold: sweep.hookNoScaffold,
      results: full
        ? sweep.results
        : sweep.results
            .filter((r) => r.status !== 'pass')
            .sort((a, b) => (a.status === 'fail' ? 0 : 1) - (b.status === 'fail' ? 0 : 1)),
      passing: full ? undefined : sweep.results.filter((r) => r.status === 'pass').map((r) => r.componentId),
    });
  }

  // ---- Single-primitive mode --------------------------------------------------
  const entry = getComponentById(componentId) as ComponentDefinition | undefined;
  if (!entry) {
    return NextResponse.json(
      { status: 'error', error: `No catalog entry for componentId "${componentId}".` },
      { status: 404 },
    );
  }
  if (!entry.tutoring) {
    return NextResponse.json(
      {
        status: 'no-scaffold',
        componentId,
        error:
          `"${componentId}" has no tutoring block — it runs on the generic tutor (L0/L1). `
          + 'Add one via /add-tutoring-scaffold, then re-run.',
      },
      { status: 400 },
    );
  }

  const audit = auditScaffold(entry, index);
  const scaffold = entry.tutoring as TutoringScaffold;

  // Static preview: every statically-known key renders as a «runtime:key» placeholder,
  // so anything showing '(not set)' is a genuine unresolvable reference.
  const staticBag: Record<string, unknown> = {};
  for (const key of audit.dataBagKeys ?? []) staticBag[key] = `«runtime:${key}»`;
  const staticPromptPreview = buildScaffoldPromptPreview(componentId, staticBag, scaffold);

  // ---- Tier 2: probe with real generated content --------------------------------
  let probe: Record<string, unknown> | undefined;
  if (searchParams.get('probe') === '1') {
    const evalMode = searchParams.get('evalMode') || entry.evalModes?.[0]?.evalMode;
    const topic = searchParams.get('topic') || 'general practice';
    const gradeLevel = searchParams.get('gradeLevel') || 'elementary';
    try {
      const item = {
        componentId,
        instanceId: `tutor-test-${componentId}-${Date.now()}`,
        config: { ...(evalMode ? { targetEvalMode: evalMode } : {}) },
      };
      const result = await generateComponentContent(item, topic, gradeLevel);
      const generated = (result?.data ?? {}) as Record<string, unknown>;
      const generatedBag = flattenGeneratedData(generated);

      const staticKeys = new Set(audit.dataBagKeys ?? []);
      const varResolution = [
        ...audit.templateVars.map((name) => ({ name, kind: 'templateVar' as const })),
        ...audit.contextKeys.map((name) => ({ name, kind: 'contextKey' as const })),
      ].map(({ name, kind }) => ({
        name,
        kind,
        resolvedBy: staticKeys.has(name)
          ? ('component' as const)
          : name in generatedBag
            ? ('generator-only' as const) // exists upstream but the component never forwards it
            : ('unresolved' as const),
        ...(name in generatedBag ? { sampleValue: previewValue(generatedBag[name]) } : {}),
      }));

      // Merged preview: real generated values where names line up; component-only
      // keys keep their «runtime:key» placeholder; everything else → '(not set)'.
      const mergedBag: Record<string, unknown> = { ...staticBag };
      for (const key of Object.keys(generatedBag)) {
        if (staticKeys.size === 0 || staticKeys.has(key)) mergedBag[key] = generatedBag[key];
      }
      probe = {
        evalMode: evalMode ?? null,
        topic,
        gradeLevel,
        generatedKeys: Object.keys(generatedBag),
        varResolution,
        promptPreview: buildScaffoldPromptPreview(componentId, mergedBag, scaffold),
        // Tier-3 live harness (&live=1): everything a headless WS student needs to
        // authenticate as this primitive — the raw tutoring block (sent verbatim in
        // the auth message, like LuminaAIContext does) plus the full generated data
        // so the journey can drive real values and know real answer keys.
        ...(searchParams.get('live') === '1'
          ? { liveContext: { tutoring: scaffold, generatedData: generated, mergedBag } }
          : {}),
      };
    } catch (error: unknown) {
      probe = { error: error instanceof Error ? error.message : 'generation failed' };
    }
  }

  return NextResponse.json(
    {
      status: audit.status,
      componentId,
      audit,
      staticPromptPreview,
      ...(probe ? { probe } : {}),
    },
    { status: audit.status === 'fail' ? 422 : 200 },
  );
}

/**
 * Approximate the runtime data bag from raw generator output: top-level fields
 * plus the first element of the usual per-challenge containers (components
 * typically mirror current-challenge fields into aiPrimitiveData).
 */
function flattenGeneratedData(data: Record<string, unknown>): Record<string, unknown> {
  const bag: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) continue;
    bag[k] = v;
  }
  for (const container of ['challenges', 'items', 'problems', 'words', 'questions']) {
    const arr = data[container];
    if (Array.isArray(arr) && arr.length > 0 && arr[0] && typeof arr[0] === 'object') {
      for (const [k, v] of Object.entries(arr[0] as Record<string, unknown>)) {
        if (!(k in bag)) bag[k] = v;
      }
    }
  }
  return bag;
}

function previewValue(v: unknown): string {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s && s.length > 120 ? `${s.slice(0, 117)}…` : (s ?? String(v));
}
