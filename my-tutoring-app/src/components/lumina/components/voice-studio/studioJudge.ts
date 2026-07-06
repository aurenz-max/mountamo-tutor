import type { CapturedUtterance, VoiceJudgePass } from '../../hooks/useVoiceCapture';
import type { ChoiceJudgeVerdict } from '../../service/literacy/gemini-choice-judge';
import { AZURE_ENGINE, ESCALATION_MODEL } from '../../utils/spokenWordJudge';
import { AUTO_LADDER, type LabVerdict, type RecordTrial, type StudioConfig, type TrialPass } from './types';

/**
 * Studio judge plumbing — one place that knows how to turn an utterance into
 * a LabVerdict, record the trial row, and run the auto:ladder policy.
 *
 * Scenarios call judgeForPass() from the engine's judge callback. Pass
 * semantics (from useVoiceCapture):
 *   'spec'     → ride the fast lane (Azure when laddering)
 *   'escalate' → same audio, spec was unconfident → the OTHER judge
 *   'fresh'    → full clip is the utterance → enter the ladder at rung 1
 *
 * The correct answer is never sent to the choice judge — it identifies WHICH
 * option; the scenario grades client-side (isMatch is derived here from
 * kind.word purely for the trials table).
 */

export type JudgeKind =
  | { kind: 'say'; word: string }
  | { kind: 'choice'; options: string[]; word: string };

async function callJudge(
  kind: JudgeKind,
  base64: string,
  model: string,
  thinking: string,
): Promise<LabVerdict> {
  const body =
    kind.kind === 'choice'
      ? {
          action: 'judgeChoiceAudio',
          params: {
            audioBase64: base64,
            mimeType: 'audio/wav',
            options: kind.options,
            gradeLevel: 'Kindergarten',
            model,
            thinkingLevel: thinking,
          },
        }
      : {
          action: 'judgeBlendAudio',
          params: {
            audioBase64: base64,
            mimeType: 'audio/wav',
            targetWord: kind.word,
            gradeLevel: 'Kindergarten',
            model,
            thinkingLevel: thinking,
          },
        };
  const res = await fetch('/api/lumina', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  if (kind.kind === 'choice') {
    const cv = (await res.json()) as ChoiceJudgeVerdict;
    return {
      heard: cv.heard,
      isMatch: !!cv.selectedOption && cv.selectedOption.toLowerCase() === kind.word,
      confidence: cv.confidence,
      reasoning: cv.reasoning,
      model: cv.model,
      usedSchemaFallback: cv.usedSchemaFallback,
      judgeLatencyMs: cv.judgeLatencyMs,
      selectedOption: cv.selectedOption,
    };
  }
  return (await res.json()) as LabVerdict;
}

/** One judge call, recorded as a trial row. Returns null on error. */
export async function judgeOnce(
  kind: JudgeKind,
  utterance: Pick<CapturedUtterance<unknown>, 'base64' | 'url' | 'ms' | 'modality' | 'timing'>,
  model: string,
  thinking: string,
  pass: TrialPass,
  scenario: string,
  recordTrial: RecordTrial,
): Promise<LabVerdict | null> {
  const started = Date.now();
  const base = {
    scenario,
    word: kind.word,
    model,
    thinking,
    pass,
    modality: utterance.modality,
    clipUrl: utterance.url,
    clipMs: utterance.ms,
    timing: utterance.timing,
  };
  try {
    const verdict = await callJudge(kind, utterance.base64, model, thinking);
    recordTrial({ ...base, verdict, totalLatencyMs: Date.now() - started });
    return verdict;
  } catch (err) {
    recordTrial({
      ...base,
      verdict: null,
      error: err instanceof Error ? err.message : String(err),
      totalLatencyMs: Date.now() - started,
    });
    return null;
  }
}

/**
 * Model policy per engine pass. With AUTO_LADDER: spec rides Azure,
 * escalate goes straight to the LLM (re-asking Azure on the same audio just
 * repeats the answer), fresh runs Azure→LLM. With a fixed model: that model
 * everywhere (escalate = judging the full clip with it).
 */
export async function judgeForPass(
  kind: JudgeKind,
  utterance: Pick<CapturedUtterance<unknown>, 'base64' | 'url' | 'ms' | 'modality' | 'timing'>,
  pass: VoiceJudgePass,
  config: Pick<StudioConfig, 'model' | 'thinking'>,
  scenario: string,
  recordTrial: RecordTrial,
  onNote?: (note: string) => void,
): Promise<LabVerdict | null> {
  const { model, thinking } = config;
  if (model !== AUTO_LADDER) {
    return judgeOnce(kind, utterance, model, thinking, pass, scenario, recordTrial);
  }
  if (pass === 'spec') {
    return judgeOnce(kind, utterance, AZURE_ENGINE, thinking, 'spec', scenario, recordTrial);
  }
  if (pass === 'escalate') {
    onNote?.('Azure unsure — escalating to Gemini…');
    return judgeOnce(kind, utterance, ESCALATION_MODEL, thinking, 'escalate', scenario, recordTrial);
  }
  // fresh: full ladder — Azure first, LLM second opinion when unsure/errored.
  const azureVerdict = await judgeOnce(kind, utterance, AZURE_ENGINE, thinking, 'fresh', scenario, recordTrial);
  if (azureVerdict && azureVerdict.confidence === 'high') return azureVerdict;
  onNote?.('Azure unsure — escalating to Gemini…');
  return judgeOnce(kind, utterance, ESCALATION_MODEL, thinking, 'fresh', scenario, recordTrial);
}

/** Re-judge a stored clip with the CURRENT model config (shell feature). */
export async function rejudgeClip(
  kind: JudgeKind,
  utterance: Pick<CapturedUtterance<unknown>, 'base64' | 'url' | 'ms' | 'modality' | 'timing'>,
  config: Pick<StudioConfig, 'model' | 'thinking'>,
  scenario: string,
  recordTrial: RecordTrial,
  onNote?: (note: string) => void,
): Promise<LabVerdict | null> {
  const { model, thinking } = config;
  if (model !== AUTO_LADDER) {
    return judgeOnce(kind, utterance, model, thinking, 're-judge', scenario, recordTrial);
  }
  const azureVerdict = await judgeOnce(kind, utterance, AZURE_ENGINE, thinking, 're-judge', scenario, recordTrial);
  if (azureVerdict && azureVerdict.confidence === 'high') return azureVerdict;
  onNote?.('Azure unsure — escalating to Gemini…');
  return judgeOnce(kind, utterance, ESCALATION_MODEL, thinking, 're-judge', scenario, recordTrial);
}
