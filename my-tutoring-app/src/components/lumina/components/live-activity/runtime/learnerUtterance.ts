/** Words that answer nothing on their own: the provider's stock transcript of near-silence or echo ("¿Qué?", 2026-10-13 pulse check: six in one session, one credited as a true/false answer). */
const FILLER = new Set(['que', 'what', 'huh']);
// Not hesitation sounds: 'ah', 'uh', 'mmm' are letter sounds a phonics item asks for, and 'hmm' is a learner's turn.

/** Whether a finished learner transcript holds no answer at all: no Latin letters or digits (the lessons are in
 *  English; a transcript in another script is the provider's reading of noise), or filler words only. */
export function isFillerUtterance(text: string) {
  const words = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return words.every(w => FILLER.has(w));
}

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
  // The tutor's turn just before the answer: which question the learner was answering (a row, a step, the task).
  let before = start;
  while (before > 0 && messages[before - 1].role === 'assistant') before--;
  const priorTutor = messages.slice(before, start).map(m => m.content).join('').trim();
  return { text: messages.slice(start, end + 1).filter(m => m.role === 'user' && m.streamId === last.streamId).map(m => m.content).join('').trim(),
    id: `speech:${start}:${messages[start].timestamp}`, ...(priorTutor ? { priorTutor } : {}) };
}
