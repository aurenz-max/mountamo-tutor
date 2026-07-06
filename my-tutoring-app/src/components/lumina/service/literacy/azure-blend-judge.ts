import 'server-only';
import type { BlendJudgeVerdict } from './gemini-blend-judge';
import type { ChoiceJudgeVerdict } from './gemini-choice-judge';

/**
 * Azure Pronunciation Assessment blend judge — the streaming-ASR lane.
 *
 * Same contract as judgeBlendAudio (clip + target word in, BlendJudgeVerdict
 * out) but backed by Azure Speech's short-audio REST endpoint with the
 * Pronunciation-Assessment header instead of an LLM. No SDK, no new deps:
 * our capture path already produces the exact WAV format this endpoint wants
 * (16kHz 16-bit mono PCM).
 *
 * The key design point: Azure returns SCORES (0-100 per word and per
 * phoneme), not verdicts. "Did the student say it?" is a policy decision that
 * lives HERE, in the threshold constants below — code owns the judgment, the
 * bench tunes the numbers. The per-phoneme readout goes into `reasoning`, so
 * the trials table shows exactly which phoneme dragged a score down.
 */

// ── Verdict policy (tune these from bench results) ──────────────
// Bench 2026-07-04: PA alone is REFERENCE-BIASED — a "mop" clip scored 86/100
// against reference "map" (and DisplayText echoed the reference). So the
// verdict needs TWO parallel signals from the same clip:
//   1. plain recognition (no reference) → unbiased transcript = the
//      minimal-pair discriminator ("did they say a different word?")
//   2. PA against the target → per-phoneme scores = leniency + feedback
// isMatch = the unbiased transcript contains the target word AND the PA
// accuracy clears MATCH_THRESHOLD (kid-lenient). Confidence is "high" only
// when both signals agree clearly; disagreement (e.g. transcript says "mop"
// but PA scored 86) → "low", which the production ladder escalates.
const MATCH_THRESHOLD = 55;
const HIGH_ACCURACY = 75;
const LOW_ACCURACY = 40;

const MODEL_LABEL = 'azure:pronunciation-assessment';

export interface AzureBlendJudgeParams {
  /** Base64 16kHz 16-bit mono PCM WAV, no data: prefix */
  audioBase64: string;
  /** The word the student was asked to blend aloud */
  targetWord: string;
}

/** Read a PA score that may be flat (REST) or nested (SDK-style JSON). */
function paScore(node: Record<string, any> | undefined, field: string): number | undefined {
  if (!node) return undefined;
  const v = node.PronunciationAssessment?.[field] ?? node[field];
  return typeof v === 'number' ? v : undefined;
}

/** One call to the short-audio REST endpoint, with or without the PA header. */
async function recognize(
  audio: Buffer,
  key: string,
  region: string,
  paHeader?: string,
): Promise<Record<string, any>> {
  const res = await fetch(
    `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`,
    {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
        Accept: 'application/json',
        ...(paHeader ? { 'Pronunciation-Assessment': paHeader } : {}),
      },
      body: audio,
    },
  );
  if (!res.ok) {
    throw new Error(`Azure STT HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return res.json();
}

// ── Choice lane ──────────────────────────────────────────────────
// Closed-set voice selection: ONE plain-recognition call (no PA header —
// pronunciation scoring is irrelevant when the question is WHICH option),
// transcript token-matched against the on-screen options. Exactly one match
// = high-confidence selection; zero or multiple = low confidence with no
// selection, which the ladder escalates to the LLM choice judge (the
// kid-articulation net: Azure hears "mat" for a mumbled "map").

const CHOICE_MODEL_LABEL = 'azure:speech-recognition';

export interface AzureChoiceJudgeParams {
  /** Base64 16kHz 16-bit mono PCM WAV, no data: prefix */
  audioBase64: string;
  /** The options visible on screen */
  options: string[];
}

export async function judgeChoiceAzure(params: AzureChoiceJudgeParams): Promise<ChoiceJudgeVerdict> {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) {
    throw new Error('AZURE_SPEECH_KEY / AZURE_SPEECH_REGION not set (my-tutoring-app/.env.local)');
  }

  const audio = Buffer.from(params.audioBase64.replace(/^data:audio\/\w+;base64,/, ''), 'base64');

  const started = Date.now();
  const plain = await recognize(audio, key, region);
  const judgeLatencyMs = Date.now() - started;

  const base: Pick<ChoiceJudgeVerdict, 'model' | 'usedSchemaFallback' | 'judgeLatencyMs'> = {
    model: CHOICE_MODEL_LABEL,
    usedSchemaFallback: false,
    judgeLatencyMs,
  };

  if (plain.RecognitionStatus !== 'Success') {
    return {
      ...base,
      heard: '',
      selectedOption: null,
      confidence: 'low',
      reasoning: `Azure recognition status: ${plain.RecognitionStatus}`,
    };
  }

  const heard = String(plain.DisplayText ?? plain.NBest?.[0]?.Display ?? '')
    .toLowerCase()
    .replace(/[^a-z' ]/g, '')
    .trim();
  const tokens = heard.split(/\s+/).filter(Boolean);
  // "includes" not "equals": a sounding-out transcript like "m a map" counts.
  const matched = params.options.filter((o) => tokens.includes(o.toLowerCase().trim()));

  const selectedOption = matched.length === 1 ? matched[0] : null;
  // Zero matches stays 'low' even with clear speech — the LLM rung gets a
  // second listen before the primitive concludes "not an option".
  const confidence: 'high' | 'low' = matched.length === 1 ? 'high' : 'low';

  return {
    ...base,
    heard,
    selectedOption,
    confidence,
    reasoning:
      matched.length === 1
        ? `transcript "${heard}" matched option "${matched[0]}"`
        : `transcript "${heard || '∅'}" matched ${matched.length} options`,
  };
}

export async function judgeBlendAzure(params: AzureBlendJudgeParams): Promise<BlendJudgeVerdict> {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) {
    throw new Error('AZURE_SPEECH_KEY / AZURE_SPEECH_REGION not set (my-tutoring-app/.env.local)');
  }

  const target = params.targetWord.toLowerCase().trim();
  const paHeader = Buffer.from(
    JSON.stringify({
      ReferenceText: target,
      GradingSystem: 'HundredMark',
      Granularity: 'Phoneme',
      Dimension: 'Comprehensive',
      EnableMiscue: false,
    }),
  ).toString('base64');

  const audio = Buffer.from(params.audioBase64.replace(/^data:audio\/\w+;base64,/, ''), 'base64');

  const started = Date.now();
  // Both signals from the same clip, concurrently — latency = max, not sum.
  const [plain, pa] = await Promise.all([
    recognize(audio, key, region),
    recognize(audio, key, region, paHeader),
  ]);
  const judgeLatencyMs = Date.now() - started;

  const base: Pick<BlendJudgeVerdict, 'model' | 'usedSchemaFallback' | 'judgeLatencyMs'> = {
    model: MODEL_LABEL,
    usedSchemaFallback: false,
    judgeLatencyMs,
  };

  if (plain.RecognitionStatus !== 'Success' && pa.RecognitionStatus !== 'Success') {
    return {
      ...base,
      heard: '',
      isMatch: false,
      confidence: 'low',
      reasoning: `Azure recognition status: ${plain.RecognitionStatus} / ${pa.RecognitionStatus}`,
    };
  }

  // Signal 1: unbiased transcript (plain recognition, no reference text)
  const heard = String(plain.DisplayText ?? plain.NBest?.[0]?.Display ?? '')
    .toLowerCase()
    .replace(/[^a-z' ]/g, '')
    .trim();
  // "contains" not "equals": a sounding-out transcript like "m a map" counts.
  const transcriptMatch = heard.split(/\s+/).includes(target);

  // Signal 2: pronunciation accuracy + per-phoneme feedback (PA call)
  const paBest = pa.NBest?.[0] ?? {};
  const words: Array<Record<string, any>> = paBest.Words ?? [];
  const word = words[0];
  const wordAccuracy = paScore(word, 'AccuracyScore') ?? paScore(paBest, 'AccuracyScore') ?? 0;
  const errorType: string = word?.PronunciationAssessment?.ErrorType ?? word?.ErrorType ?? 'None';
  const phonemeReadout = ((word?.Phonemes ?? []) as Array<Record<string, any>>)
    .map((p) => `${p.Phoneme}=${Math.round(paScore(p, 'AccuracyScore') ?? 0)}`)
    .join(' ');

  const isMatch = transcriptMatch && wordAccuracy >= MATCH_THRESHOLD;
  // High confidence only when both signals agree clearly.
  const confidence: 'high' | 'low' =
    (transcriptMatch && wordAccuracy >= HIGH_ACCURACY) ||
    (!transcriptMatch && wordAccuracy <= LOW_ACCURACY)
      ? 'high'
      : 'low';

  return {
    ...base,
    heard,
    isMatch,
    confidence,
    reasoning:
      `transcript ${transcriptMatch ? 'matches' : `"${heard || '∅'}" ≠ "${target}"`}, ` +
      `accuracy ${Math.round(wordAccuracy)}/100` +
      (errorType !== 'None' ? ` (${errorType})` : '') +
      (phonemeReadout ? ` | phonemes: ${phonemeReadout}` : ''),
  };
}
