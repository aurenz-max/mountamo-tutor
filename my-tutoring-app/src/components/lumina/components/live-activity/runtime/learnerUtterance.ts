/** Reassemble source speech, preserving provider spaces and split words. Never grade a trailing chunk. */
export function latestLearnerUtterance(messages: readonly {
  role: 'user' | 'assistant'; content: string; timestamp: number; streamId?: number;
  isAudio?: boolean; transcriptFinished?: boolean;
}[], floor: number) {
  let end = messages.length - 1;
  while (end >= floor && messages[end].role !== 'user') end--;
  if (end < floor) return null;
  const last = messages[end];
  if (last.isAudio && last.streamId !== undefined && last.transcriptFinished !== true) return null;
  let start = end;
  if (last.streamId !== undefined) {
    const first = messages.findIndex(m => m.role === 'user' && m.streamId === last.streamId);
    if (first >= 0) start = first;
  }
  // A response whose start belongs to a prior item/stimulus stays there, even when its tail arrives late.
  if (start < floor) return null;
  return { text: messages.slice(start, end + 1).filter(m => m.role === 'user' && m.streamId === last.streamId).map(m => m.content).join('').trim(),
    id: `speech:${start}:${messages[start].timestamp}` };
}
