import { NextRequest, NextResponse } from 'next/server';
import {
  generateExhibitManifestStreaming,
  buildStudentContextBlock,
  buildStudentVoiceBlock,
} from '@/components/lumina/service/manifest/gemini-manifest';
import {
  generateComponentContent,
  generateIntroBriefing,
} from '@/components/lumina/service/geminiService';
import { getComponentById } from '@/components/lumina/service/manifest/catalog';
import type { ExhibitManifest, ManifestItem } from '@/components/lumina/types';
import type { StudentGenerationContext } from '@/components/lumina/service/studentContext/types';

// Full pipeline (brief → manifest → N generators) can take a while.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * /api/lumina/topic-trace
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
 * GET (query params — original interface):
 *   topic        (required)  e.g. "Counting to 10"
 *   gradeLevel   (default "elementary")
 *   componentId  (optional)  only trace components matching this id
 *   objectives   ("false" to skip the curator brief and let the manifest self-author)
 *   images       ("keep" to retain base64 image data; default strips it)
 *   manifestOnly ("true" to stop after the manifest — no generators. Fast; use
 *                 for manifest-level A/B comparisons like personalization.)
 *
 * POST (JSON body — adds personalization support):
 *   {
 *     topic, gradeLevel?, componentId?, images?, manifestOnly?,
 *     objectives?:    [{ id, text, verb, icon }],  // FIXED objectives — skips the
 *                                                  // brief so A/B runs compare the
 *                                                  // same lesson, not brief variance
 *     studentContext?: StudentGenerationContext    // from POST /api/student-profile/
 *                                                  // generation-context (FastAPI)
 *   }
 *   When studentContext is provided it is injected into the manifest prompt
 *   exactly as the production pipeline does, and the response echoes the
 *   rendered STUDENT PROFILE block under `personalization.promptBlock` so the
 *   caller can assess what the curator actually saw.
 *
 * Returns ONE JSON document. No PASS/FAIL scoring — judgment is left to the
 * caller (Claude Code / the /topic-trace skill).
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

interface TraceParams {
  topic: string;
  gradeLevel: string;
  componentIdFilter: string | null;
  useObjectives: boolean;
  keepImages: boolean;
  manifestOnly: boolean;
  /** Fixed objectives — when provided, the brief is skipped entirely */
  fixedObjectives: Array<{ id: string; text: string; verb: string; icon: string }> | null;
  studentContext: StudentGenerationContext | null;
}

async function runTrace(params: TraceParams) {
  const {
    topic,
    gradeLevel,
    componentIdFilter,
    useObjectives,
    keepImages,
    manifestOnly,
    fixedObjectives,
    studentContext,
  } = params;

  const startTime = Date.now();

  // ── Step 1: objectives — fixed (caller-controlled) or from the curator brief ──
  let brief: { hook?: unknown; objectives?: Array<{ id: string; text: string; verb: string; icon: string }> } | null = null;
  let objectives = fixedObjectives ?? undefined;
  if (!objectives && useObjectives) {
    try {
      brief = await generateIntroBriefing(topic, gradeLevel);
      objectives = brief?.objectives;
    } catch {
      // Brief is best-effort; the manifest can still self-author objectives.
      brief = null;
    }
  }

  // ── Step 2: manifest, seeded with the objectives (± student context) ──
  const manifest: ExhibitManifest = await generateExhibitManifestStreaming(
    topic,
    gradeLevel,
    objectives,
    studentContext,
  );

  // What the curator actually saw — '' when no usable context was provided.
  const promptBlock = buildStudentContextBlock(studentContext);
  const voiceBlock = buildStudentVoiceBlock(studentContext);
  const personalization = {
    applied: promptBlock.length > 0 || voiceBlock.length > 0,
    studentId: studentContext?.studentId ?? null,
    resolvedObjectives: studentContext?.objectives?.filter((o) => o.tier === 'exact').length ?? 0,
    totalObjectives: studentContext?.objectives?.length ?? 0,
    promptBlock: promptBlock || null,
    voiceBlock: voiceBlock || null,
  };

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

  const baseResponse = {
    topic: manifest.topic,
    gradeLevel: manifest.gradeLevel,
    themeColor: manifest.themeColor,
    personalization,
    // Where the voice greeting lands — needed to assess persona framing.
    curatorBrief: manifest.curatorBrief
      ? { title: manifest.curatorBrief.title, intent: manifest.curatorBrief.intent }
      : null,
    // The objectives the lesson was built around — where scope language lives.
    objectives:
      (manifest.objectiveBlocks || []).map((b) => ({
        objectiveId: b.objectiveId,
        objectiveText: b.objectiveText,
        objectiveVerb: b.objectiveVerb,
        componentIds: b.components.map((c) => c.componentId),
        // Personalization assessment: difficulty configs the curator chose.
        // Eval-mode instrumentation: surface the curator's targetEvalMode pin and
        // validate it against the primitive's catalog modes, so a manifestOnly run
        // measures the manifest miss-rate (how often a multi-mode primitive leaves
        // the manifest stage WITHOUT a valid pin → the recovery-path question).
        componentConfigs: b.components.map((c) => {
          const validModes = getComponentById(c.componentId)?.evalModes?.map((m) => m.evalMode) ?? [];
          const pin = c.config?.targetEvalMode ?? null;
          return {
            componentId: c.componentId,
            title: c.title,
            intent: c.intent,
            difficulty: c.config?.difficulty ?? null,
            targetEvalMode: pin,
            evalModeCount: validModes.length,
            // null = N/A (primitive has <2 modes, no pin needed);
            // true  = multi-mode AND validly pinned;
            // false = multi-mode but pin missing or not in the catalog set (a MISS).
            targetEvalModeValid: validModes.length < 2 ? null : pin != null && validModes.includes(pin),
          };
        }),
      })) || [],
    briefObjectives: objectives ?? null,
    finalAssessment: manifest.finalAssessment
      ? {
          componentId: manifest.finalAssessment.componentId,
          title: manifest.finalAssessment.title,
          intent: manifest.finalAssessment.intent,
        }
      : null,
  };

  // ── Manifest-only mode: stop here (fast A/B comparisons) ──
  if (manifestOnly) {
    return {
      ...baseResponse,
      totalDuration: Date.now() - startTime,
      componentCount: itemsToTrace.length,
      components: [],
      manifestOnly: true,
    };
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

  return {
    ...baseResponse,
    totalDuration: Date.now() - startTime,
    componentCount: components.length,
    components,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const topic = searchParams.get('topic');
  const gradeLevel = searchParams.get('gradeLevel') || 'elementary';

  if (!topic) {
    return NextResponse.json({
      usage: 'GET /api/lumina/topic-trace?topic=<topic>&gradeLevel=<grade> — or POST a JSON body for personalized traces',
      params: {
        topic: 'required — the lesson topic, e.g. "Counting to 10"',
        gradeLevel: 'optional, default "elementary"',
        componentId: 'optional — only trace components with this id (focus one generator)',
        objectives: 'optional — "false" to skip the curator brief',
        manifestOnly: 'optional — "true" to stop after the manifest (fast A/B)',
      },
      post: {
        body: '{ topic, gradeLevel?, componentId?, manifestOnly?, objectives?: [{id,text,verb,icon}], studentContext?: <generation-context response> }',
        note: 'Fixed objectives skip the brief so A/B runs compare the same lesson ± studentContext. The response echoes the injected STUDENT PROFILE block under personalization.promptBlock and the STUDENT VOICE block (from studentContext.studentProfile) under personalization.voiceBlock.',
      },
      returns:
        'The manifest plus, per primitive, the generator input (the api call) and the generated output.',
    });
  }

  try {
    const result = await runTrace({
      topic,
      gradeLevel,
      componentIdFilter: searchParams.get('componentId'),
      useObjectives: searchParams.get('objectives') !== 'false',
      keepImages: searchParams.get('images') === 'keep',
      manifestOnly: searchParams.get('manifestOnly') === 'true',
      fixedObjectives: null,
      studentContext: null,
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json(
      {
        status: 'error',
        topic,
        gradeLevel,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: 'error', error: 'Invalid JSON body' }, { status: 400 });
  }

  const topic = typeof body.topic === 'string' ? body.topic : null;
  if (!topic) {
    return NextResponse.json({ status: 'error', error: 'topic is required' }, { status: 400 });
  }
  const gradeLevel = typeof body.gradeLevel === 'string' ? body.gradeLevel : 'elementary';

  try {
    const result = await runTrace({
      topic,
      gradeLevel,
      componentIdFilter: typeof body.componentId === 'string' ? body.componentId : null,
      useObjectives: body.objectives !== false,
      keepImages: body.images === 'keep',
      manifestOnly: body.manifestOnly === true,
      fixedObjectives: Array.isArray(body.objectives)
        ? (body.objectives as TraceParams['fixedObjectives'])
        : null,
      studentContext: (body.studentContext as StudentGenerationContext | undefined) ?? null,
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json(
      {
        status: 'error',
        topic,
        gradeLevel,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
