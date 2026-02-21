import { NextRequest } from 'next/server';
import { generatePracticeManifest } from '@/components/lumina/service/manifest/practice-manifest';
import { hydratePracticeManifest } from '@/components/lumina/service/manifest/practice-content-hydrator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic, gradeLevel, problemCount } = body;

    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const sendEvent = async (event: Record<string, unknown>) => {
      const data = JSON.stringify(event) + '\n';
      await writer.write(encoder.encode(data));
    };

    // Run the generation pipeline in the background so we can return the stream immediately
    (async () => {
      try {
        // Phase 1: Generate the manifest with progress callbacks
        const manifest = await generatePracticeManifest(
          topic,
          gradeLevel,
          problemCount,
          {
            onProgress: async (message: string) => {
              await sendEvent({ type: 'progress', message });
            },
            onThinking: async (thought: string) => {
              await sendEvent({ type: 'thinking', thought });
            },
          },
        );

        await sendEvent({
          type: 'manifest',
          itemCount: manifest.items.length,
          items: manifest.items.map(item => ({
            instanceId: item.instanceId,
            problemText: item.problemText,
            difficulty: item.difficulty,
            isVisual: !!item.visualPrimitive,
          })),
        });

        // Phase 2: Hydrate items in parallel, streaming each as it completes
        await sendEvent({ type: 'progress', message: 'Building interactive content...' });

        const hydratedItems = await hydratePracticeManifest(
          manifest,
          async (item, index, total) => {
            await sendEvent({
              type: 'item',
              index,
              total,
              item,
            });
            await sendEvent({
              type: 'progress',
              message: `Ready: ${index + 1} of ${total} problems`,
            });
          },
        );

        // Phase 3: Send the complete signal
        await sendEvent({ type: 'complete', items: hydratedItems });
        await writer.close();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        try {
          await sendEvent({ type: 'error', error: message });
        } catch { /* writer may already be closed */ }
        try {
          await writer.close();
        } catch { /* already closed */ }
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
