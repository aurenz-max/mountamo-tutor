import { NextRequest } from 'next/server';
import { generateExhibitManifestStreaming } from '@/components/lumina/service/manifest/gemini-manifest';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic, gradeLevel, objectives } = body;

    // Create a TransformStream for streaming the response
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Start the manifest generation in the background
    (async () => {
      try {
        await generateExhibitManifestStreaming(
          topic,
          gradeLevel,
          objectives,
          {
            onProgress: async (message: string) => {
              const data = JSON.stringify({ type: 'progress', message }) + '\n';
              await writer.write(encoder.encode(data));
            },
            onThinking: async (thought: string) => {
              const data = JSON.stringify({ type: 'thinking', thought }) + '\n';
              await writer.write(encoder.encode(data));
            },
            onPartialManifest: async (partial) => {
              const data = JSON.stringify({ type: 'partial', manifest: partial }) + '\n';
              await writer.write(encoder.encode(data));
            }
          }
        ).then(manifest => {
          // Send final manifest
          const data = JSON.stringify({ type: 'complete', manifest }) + '\n';
          writer.write(encoder.encode(data));
          writer.close();
        }).catch(error => {
          // Send error
          const data = JSON.stringify({ type: 'error', error: error.message }) + '\n';
          writer.write(encoder.encode(data));
          writer.close();
        });
      } catch (error: any) {
        const data = JSON.stringify({ type: 'error', error: error.message }) + '\n';
        await writer.write(encoder.encode(data));
        await writer.close();
      }
    })();

    // Return the streaming response
    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Stream setup failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
