import React from 'react';

export interface TranscriptMessage {
  role: 'user' | 'assistant';
  content: string;
  /** Only streaming chunks share an ID. The underlying event feed stays append-only. */
  streamId?: number;
}

export function transcriptTurns(messages: readonly TranscriptMessage[]): TranscriptMessage[] {
  const turns: TranscriptMessage[] = [];
  for (const message of messages) {
    const last = turns[turns.length - 1];
    if (message.streamId !== undefined && last?.streamId === message.streamId && last.role === message.role) {
      // Gemini sends transcript deltas, including its own spaces and word splits.
      last.content += message.content;
    } else {
      turns.push({ ...message });
    }
  }
  return turns;
}

/** Presentation only: never replace the chunk feed consumed by the speech judge. */
export default function ConversationTranscript({ messages }: { messages: readonly TranscriptMessage[] }) {
  const turns = transcriptTurns(messages);
  return turns.length ? <>{turns.map((m, i) =>
    <p key={i} className={m.role === 'user' ? 'text-indigo-200' : 'text-slate-300'}>
      <strong>{m.role === 'user' ? 'You' : 'Tutor'}:</strong> {m.content}
    </p>)}</> : <p className="text-slate-500">Your conversation will appear here.</p>;
}
