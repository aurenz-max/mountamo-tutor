import type { BlendJudgeVerdict } from '../../service/literacy/gemini-blend-judge';
import type { CapturedUtterance, VoiceModality, VoiceCaptureTiming } from '../../hooks/useVoiceCapture';

/**
 * Voice Studio — shared contracts.
 *
 * The studio is a plug-and-play bench for spoken interaction design:
 *   shell (VoiceStudio.tsx)  — scenario picker, config panels, trials table,
 *                              spec export. Content-agnostic.
 *   scenarios (scenarios/*)  — one component per interaction shape; each owns
 *                              its surface + judge wiring and consumes the
 *                              useVoiceCapture engine exactly like a primitive
 *                              would (the studio dogfoods the graduation path).
 *   engine (hooks/useVoiceCapture) — mic lifecycle + timing doctrine.
 *
 * Adding a bench = write one scenario component, add one registry entry.
 */

// ── Config (everything the spec export serializes) ───────────────

export type ActOnPolicy = 'high' | 'any';
export type VoiceActionPolicy = 'submit' | 'highlight';

export interface StudioConfig {
  modality: VoiceModality;
  autoArm: boolean;
  /** Judge model id, AUTO_LADDER, or an azure:* lane. */
  model: string;
  thinking: string;
  /** Choice-control levers. */
  actOn: ActOnPolicy;
  voiceAction: VoiceActionPolicy;
  /** Legacy turn-loop tunables. */
  armDelayMs: number;
  cooldownMs: number;
}

// ── Verdicts & trials ─────────────────────────────────────────────

/** Unified verdict: blend verdict + optional closed-set selection. */
export interface LabVerdict extends BlendJudgeVerdict {
  selectedOption?: string | null;
}

export type TrialPass = 'spec' | 'escalate' | 'fresh' | 're-judge';

export interface Trial {
  id: number;
  scenario: string;
  word: string;
  model: string;
  thinking: string;
  pass: TrialPass;
  modality: VoiceModality;
  verdict: LabVerdict | null;
  error?: string;
  totalLatencyMs: number;
  clipUrl: string;
  clipMs: number;
  timing: VoiceCaptureTiming;
}

export type RecordTrial = (trial: Omit<Trial, 'id'>) => void;

/** What a scenario reports upward so the shell can offer clip re-judging. */
export interface LastUtterance {
  utterance: CapturedUtterance<unknown>;
  /** How to judge this clip again. */
  kind: { kind: 'say'; word: string } | { kind: 'choice'; options: string[]; word: string };
  scenario: string;
}

// ── Scenario plug-in contract ─────────────────────────────────────

export interface StudioScenarioProps {
  config: StudioConfig;
  recordTrial: RecordTrial;
  /** Report the latest full clip so the shell can re-judge it on demand. */
  reportUtterance: (last: LastUtterance) => void;
}

export interface StudioScenario {
  id: string;
  label: string;
  blurb: string;
  Component: React.FC<StudioScenarioProps>;
}

// ── Shared constants ──────────────────────────────────────────────

export const PRESET_WORDS = ['map', 'cat', 'sun', 'pig', 'bed', 'top', 'run', 'hat'];
// Includes minimal-pair neighbors (mop/map, cap/cat…) — in choice mode the
// minimal pair lives IN the option set, which is the discrimination to bench.
export const DISTRACTOR_POOL = [...PRESET_WORDS, 'mop', 'cap', 'mat', 'pin', 'bad', 'tap'];

export const AUTO_LADDER = 'auto:ladder';
export const PRESET_MODELS = [
  AUTO_LADDER,
  'azure:pronunciation-assessment',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemma-4-26b-a4b-it',
];
export const THINKING_LEVELS = ['MINIMAL', 'LOW', 'default'] as const;
