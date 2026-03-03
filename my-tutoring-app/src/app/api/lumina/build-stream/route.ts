import { NextRequest } from 'next/server';
import { buildCompleteExhibitFromManifest } from '@/components/lumina/service/geminiService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { manifest, curatorBrief } = body;

    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const sendEvent = async (event: Record<string, unknown>) => {
      const data = JSON.stringify(event) + '\n';
      await writer.write(encoder.encode(data));
    };

    // Run the build pipeline in the background so we can return the stream immediately
    (async () => {
      try {
        const exhibit = await buildCompleteExhibitFromManifest(
          manifest,
          curatorBrief,
          async (instanceId, componentId, index, total) => {
            await sendEvent({
              type: 'component-complete',
              instanceId,
              componentId,
              index,
              total,
            });
          },
        );

        await sendEvent({ type: 'exhibit-complete', exhibit });
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
