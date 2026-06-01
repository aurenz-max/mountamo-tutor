import { NextRequest, NextResponse } from 'next/server';
import { generateExhibitManifestStreaming } from '@/components/lumina/service/manifest/gemini-manifest';
import {
  generateComponentContent,
  generateIntroBriefing,
} from '@/components/lumina/service/geminiService';
import type { ExhibitManifest, ManifestItem } from '@/components/lumina/types';

// Full pipeline (brief → manifest → N generators) can take a while.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * GET /api/lumina/topic-trace
 *
 * Insert a topic → get the Lumina manifest AND the exact generator API call +
 * output for every downstream primitive. This is the topic-to-scope tracer:
 * it runs the REAL lesson pipeline so you can see how an input topic flows
 * into the scope each primitive actually generates, and assess the prompts.
 *
 * Pipeline (faithful to hooks/useExhibitSession.ts):
 *   1. Curator brief  → learning objectives (carry the scope language)
 *   2. Manifest       → seeded with those objectives (picks primitives + intent)
 *   3. Generators     → each manifest component runs its real generator
 *
 * Query params:
 *   topic        (required)  e.g. "Counting to 10"
 *   gradeLevel   (default "elementary")
 *   componentId  (optional)  only trace components matching this id (focus one generator)
 *   objectives   ("false" to skip the curator brief and let the manifest self-author objectives)
 *   images       ("keep" to retain base64 image data; default strips it — image
 *                 blobs are noise for scope/prompt assessment and bloat the response)
 *
 * Returns ONE JSON document: the manifest plus, per component, the generator
 * INPUT (the "primitive api call") and the generator OUTPUT. No PASS/FAIL
 * scoring — judgment is left to the caller (Claude Code / the /topic-trace skill).
 */
/**
 * Recursively replace base64 image payloads with a short placeholder so the
 * trace stays readable. Catches `data:image/...;base64,...` URIs and bare
 * base64 blobs (the shape generators use for inline images / audio). Scope and
 * prompt assessment never needs the pixels — only that an image was produced.
 */
function stripImageData(node: unknown): unknown {
  if (typeof node === 'string') {
    if (node.startsWith('data:') && node.includes('base64,')) {
      const [prefix] = node.split('base64,');
      return `[stripped ${prefix}base64, ${node.length} chars]`;
    }
    // Bare base64 blob (no data: prefix) — long and base64 charset only.
    if (node.length > 512 && /^[A-Za-z0-9+/=\s]+$/.test(node)) {
      return `[stripped base64 blob, ${node.length} chars]`;
    }
    return node;
  }
  if (Array.isArray(node)) return node.map(stripImageData);
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) out[k] = stripImageData(v);
    return out;
  }
  return node;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const topic = searchParams.get('topic');
  const gradeLevel = searchParams.get('gradeLevel') || 'elementary';
  const componentIdFilter = searchParams.get('componentId');
  const useObjectives = searchParams.get('objectives') !== 'false';
  const keepImages = searchParams.get('images') === 'keep';

  if (!topic) {
    return NextResponse.json({
      usage: 'GET /api/lumina/topic-trace?topic=<topic>&gradeLevel=<grade>',
      params: {
        topic: 'required — the lesson topic, e.g. "Counting to 10"',
        gradeLevel: 'optional, default "elementary"',
        componentId: 'optional — only trace components with this id (focus one generator)',
        objectives: 'optional — "false" to skip the curator brief',
      },
      returns:
        'The manifest plus, per primitive, the generator input (the api call) and the generated output.',
    });
  }

  const startTime = Date.now();

  try {
    // ── Step 1: curator brief → objectives (the scope-bearing context) ──
    let brief: { hook?: unknown; objectives?: Array<{ id: string; text: string; verb: string; icon: string }> } | null = null;
    if (useObjectives) {
      try {
        brief = await generateIntroBriefing(topic, gradeLevel);
      } catch (e) {
        // Brief is best-effort; the manifest can still self-author objectives.
        brief = null;
      }
    }

    // ── Step 2: manifest, seeded with the brief's objectives ──
    const manifest: ExhibitManifest = await generateExhibitManifestStreaming(
      topic,
      gradeLevel,
      brief?.objectives,
    );

    // objectiveId → block, so each component can name the objective that bound it.
    const blockByObjective = new Map<string, { objectiveText: string; objectiveVerb: string }>();
    for (const block of manifest.objectiveBlocks || []) {
      blockByObjective.set(block.objectiveId, {
        objectiveText: block.objectiveText,
        objectiveVerb: block.objectiveVerb,
      });
    }

    // The flattened layout already has objective context injected into config.
    const layout: ManifestItem[] = manifest.layout || [];
    let itemsToTrace = layout.filter((i) => i.componentId !== 'curator-brief');
    if (componentIdFilter) {
      itemsToTrace = itemsToTrace.filter((i) => i.componentId === componentIdFilter);
    }

    // ── Step 3: run each component's REAL generator, capturing input + output ──
    const components = await Promise.all(
      itemsToTrace.map(async (item) => {
        const objectiveId = (item.objectiveIds && item.objectiveIds[0]) || undefined;
        const objectiveMeta = objectiveId ? blockByObjective.get(objectiveId) : undefined;

        // This is the exact "primitive api call" the build pipeline makes:
        //   generateComponentContent(item, topic, gradeLevel)
        const generatorInput = {
          item: {
            componentId: item.componentId,
            instanceId: item.instanceId,
            config: item.config || {},
          },
          topic: manifest.topic,
          gradeLevel: manifest.gradeLevel,
        };

        // A replayable call against the existing action endpoint, so you can
        // re-run JUST this primitive without re-running the whole pipeline.
        const replay = {
          endpoint: '/api/lumina',
          method: 'POST',
          body: {
            action: 'generateComponentContent',
            params: {
              componentId: item.componentId,
              instanceId: item.instanceId,
              config: item.config || {},
              topic: manifest.topic,
              gradeLevel: manifest.gradeLevel,
            },
          },
        };

        const t0 = Date.now();
        try {
          const result = await generateComponentContent(
            generatorInput.item,
            generatorInput.topic,
            generatorInput.gradeLevel,
          );
          const duration = Date.now() - t0;
          const rawData = result && typeof result === 'object' && 'data' in result ? result.data : result;
          const data = keepImages ? rawData : stripImageData(rawData);

          return {
            componentId: item.componentId,
            instanceId: item.instanceId,
            title: item.title,
            objectiveId,
            objectiveText: objectiveMeta?.objectiveText ?? null,
            objectiveVerb: objectiveMeta?.objectiveVerb ?? null,
            intent: item.intent ?? null,
            generatorInput,
            replay,
            status: data ? 'ok' : 'empty',
            duration,
            data: data ?? null,
            error: data ? undefined : 'Generator returned null or empty data',
          };
        } catch (error: unknown) {
          return {
            componentId: item.componentId,
            instanceId: item.instanceId,
            title: item.title,
            objectiveId,
            objectiveText: objectiveMeta?.objectiveText ?? null,
            objectiveVerb: objectiveMeta?.objectiveVerb ?? null,
            intent: item.intent ?? null,
            generatorInput,
            replay,
            status: 'error',
            duration: Date.now() - t0,
            data: null,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }),
    );

    return NextResponse.json({
      topic: manifest.topic,
      gradeLevel: manifest.gradeLevel,
      themeColor: manifest.themeColor,
      totalDuration: Date.now() - startTime,
      // The objectives the lesson was built around — where scope language lives.
      objectives:
        (manifest.objectiveBlocks || []).map((b) => ({
          objectiveId: b.objectiveId,
          objectiveText: b.objectiveText,
          objectiveVerb: b.objectiveVerb,
          componentIds: b.components.map((c) => c.componentId),
        })) || [],
      briefObjectives: brief?.objectives ?? null,
      componentCount: components.length,
      components,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        status: 'error',
        topic,
        gradeLevel,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
