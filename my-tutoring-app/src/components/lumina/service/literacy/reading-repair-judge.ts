import { Type, type Schema } from '@google/genai';
import { ai } from '../geminiClient';
import { compareReading, type ReadingTranscript } from '../../primitives/visual-primitives/literacy/readingRepairEvidence';

const transcriptSchema: Schema = { type: Type.OBJECT, properties: {
  transcript: { type: Type.STRING }, confidence: { type: Type.STRING, enum: ['high', 'low'] },
  complete: { type: Type.BOOLEAN },
}, required: ['transcript', 'confidence', 'complete'] };

export function parseReadingTranscript(value: unknown): ReadingTranscript {
  if (!value || typeof value !== 'object') throw new Error('Missing audio evidence');
  const v = value as Record<string, unknown>;
  if (typeof v.transcript !== 'string' || v.transcript.length > 1000 || !['high', 'low'].includes(String(v.confidence))
    || typeof v.complete !== 'boolean') throw new Error('Invalid audio evidence');
  return { transcript: v.transcript, confidence: v.confidence as 'high' | 'low', complete: v.complete };
}

/** Neither audio transcription call sees the printed answer. Agreement is a
 * conservative provisional signal, not independence of recognizer errors. */
export async function judgeReadingRepair(audioBase64: string, text: string) {
  const transcripts = await Promise.all([0, 1].map(async (index) => {
    const result = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: [{ parts: [{ inlineData: { mimeType: 'audio/wav', data: audioBase64 } }, { text:
        `Transcribe this short child's reading from sound alone. ${index ? 'Listen carefully to vowels and endings.' : 'Preserve the exact words you hear.'}
Do not repair grammar, infer intended words, replace a word with a plausible synonym, or silently remove repetitions or restarts.
Accent and age-appropriate articulation are not errors. If a word is ambiguous, speech is quiet, multiple speakers overlap, or audio is clipped, report confidence low.
Return complete false for silence, unfinished/cut-off speech, or a recording you cannot hear clearly. Never guess to fill gaps. You are not given a reference sentence.` }] }],
      config: { responseMimeType: 'application/json', responseSchema: transcriptSchema },
    });
    if (!result.text) throw new Error('Empty audio response');
    return parseReadingTranscript(JSON.parse(result.text));
  }));
  return compareReading(text, transcripts);
}
