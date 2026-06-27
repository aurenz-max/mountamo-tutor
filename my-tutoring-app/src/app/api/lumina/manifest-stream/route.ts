import { NextRequest } from 'next/server';
import { generateExhibitManifestStreaming } from '@/components/lumina/service/manifest/gemini-manifest';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic, gradeLevel, objectives, studentContext } = body;

    // Create a TransformStream for streaming the response
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // The client can disconnect (navigate away / re-request) mid-stream. When it
    // does, the readable side is cancelled and every write/close on this writer
    // throws (ResponseAborted / ERR_INVALID_STATE: WritableStream is closed).
    // Track that state and make all writer ops no-ops once aborted so we never
    // emit an unhandled rejection that crashes the dev server.
    let closed = false;
    request.signal.addEventListener('abort', () => {
      closed = true;
    });

    const safeWrite = async (payload: unknown) => {
      if (closed) return;
      try {
        await writer.write(encoder.encode(JSON.stringify(payload) + '\n'));
      } catch {
        closed = true; // client gone — stop trying to write
      }
    };
    const safeClose = async () => {
      if (closed) return;
      closed = true;
      try {
        await writer.close();
      } catch {
        /* already closed/aborted — nothing to do */
      }
    };

    // Start the manifest generation in the background
    (async () => {
      try {
        const manifest = await generateExhibitManifestStreaming(
          topic,
          gradeLevel,
          objectives,
          studentContext ?? undefined,
          {
            onProgress: (message: string) => safeWrite({ type: 'progress', message }),
            onThinking: (thought: string) => safeWrite({ type: 'thinking', thought }),
            onPartialManifest: (partial) => safeWrite({ type: 'partial', manifest: partial }),
          }
        );
        await safeWrite({ type: 'complete', manifest });
      } catch (error: any) {
        await safeWrite({ type: 'error', error: error?.message ?? String(error) });
      } finally {
        await safeClose();
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
