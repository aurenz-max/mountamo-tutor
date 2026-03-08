import { NextRequest } from 'next/server';
import { generatePulseManifest, PulseManifestItemInput } from '@/components/lumina/service/manifest/practice-manifest';
import { hydratePracticeManifest } from '@/components/lumina/service/manifest/practice-content-hydrator';

/**
 * POST /api/lumina/pulse-stream
 *
 * Generates a batch practice manifest for a Pulse session and hydrates all items.
 * Unlike practice-stream (single topic, N items), this takes the full Pulse item
 * queue so Gemini can diversify primitive selection across the entire session.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, gradeLevel, recentPrimitives } = body as {
      items: PulseManifestItemInput[];
      gradeLevel: string;
      recentPrimitives?: Array<{ primitive_type: string; eval_mode: string; score: number; subskill_id: string }>;
    };

    if (!Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'items array is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const sendEvent = async (event: Record<string, unknown>) => {
      const data = JSON.stringify(event) + '\n';
      await writer.write(encoder.encode(data));
    };

    (async () => {
      try {
        // Phase 1: Generate the batch manifest (one Gemini call for all items)
        const manifest = await generatePulseManifest(
          items,
          gradeLevel,
          {
            onProgress: async (message: string) => {
              await sendEvent({ type: 'progress', message });
            },
          },
          {
            recentPrimitives: Array.isArray(recentPrimitives) ? recentPrimitives : undefined,
          },
        );

        await sendEvent({
          type: 'manifest',
          itemCount: manifest.items.length,
          sessionBrief: manifest.sessionBrief || null,
          items: manifest.items.map(item => ({
            instanceId: item.instanceId,
            problemText: item.problemText,
            difficulty: item.difficulty,
            isVisual: !!item.visualPrimitive,
            componentId: item.visualPrimitive?.componentId || item.standardProblem?.problemType || null,
          })),
        });

        // Phase 2: Hydrate all items in parallel
        await sendEvent({ type: 'progress', message: 'Building interactive content...' });

        const hydratedItems = await hydratePracticeManifest(
          manifest,
          async (item, index, total) => {
            await sendEvent({ type: 'item', index, total, item });
            await sendEvent({ type: 'progress', message: `Ready: ${index + 1} of ${total} activities` });
          },
        );

        // Phase 3: Complete
        await sendEvent({ type: 'complete', items: hydratedItems });
        await writer.close();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        try { await sendEvent({ type: 'error', error: message }); } catch { /* writer closed */ }
        try { await writer.close(); } catch { /* already closed */ }
      }
    })();

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Stream setup failed';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
