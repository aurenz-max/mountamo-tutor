import { NextRequest } from 'next/server';
import { withGenerationRequest } from '@/components/lumina/service/generation/generationRequest';
import { buildCompleteExhibitFromManifest } from '@/components/lumina/service/geminiService';

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Stream setup failed';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
  // The learner's token and the backend-signed observation packet are request-local;
  // consumers read the verified packet instead of calling the backend during generation.
  return withGenerationRequest({ authorization: request.headers.get('authorization'), learningObservations: body.learningObservations },
    () => handlePost(body));
}

async function handlePost(body: Record<string, unknown>) {
  try {
    const { manifest, curatorBrief } = body as { manifest: any; curatorBrief: any };

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
