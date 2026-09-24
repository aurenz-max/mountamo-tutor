/**
 * The isolated seams every live-runtime test shares.
 *
 * A runtime test keeps the component, the adapter, the judged runner, the
 * LiveLessonRuntime, the transport and the rendering shell REAL. Only four things
 * are substituted, and always the same four: the microphone-side AI context, the
 * voice-turn detector, the evaluation write, and sound. Those four factories used
 * to be a thirty-line `vi.mock` preamble copied into each runtime test file.
 *
 * `seam` is a module singleton rather than a `vi.hoisted` object because a test
 * file and its mock factories resolve this module to the same instance. That is
 * what lets the factories live here instead of being re-typed per file. It also
 * means the state is shared within a file and must be reset per test — call
 * `resetSeams()` from a `beforeEach` with a BLOCK body, never an arrow that
 * returns it, or vitest runs the return value as teardown.
 */
import { vi, type Mock } from 'vitest';
import { DEFAULT_VOICE_TURN_CONFIG } from '@/components/lumina/hooks/voiceTurnMachine';

export interface SeamState {
  /** The transcript the tutor and the child have produced so far. */
  conversation: Array<Record<string, unknown>>;
  /** Whether tutor audio is playing; the speech hold and cue timing read it. */
  audio: boolean;
  /** The voice-turn close listener the mounted runner subscribed, or null. */
  close: ((event: Record<string, unknown>) => void) | null;
  send: ReturnType<typeof vi.fn>;
  submit: ReturnType<typeof vi.fn>;
  /** How many speech holds are currently outstanding. */
  held: number;
  /**
   * The primitive the session believes is on screen. It MUST equal the mounted
   * data's `instanceId`: a judged runner that does not recognise itself as the
   * active primitive never starts, ownership stays `tutor`, and every advertised
   * action is simply absent — which reads as an adapter fault, not a seam fault.
   * `mountJudged` sets it from the data, so a test never sets it by hand.
   */
  activePrimitiveId: string;
  /** What `useEvaluationContext` returns. `null` is the live host, which has no evaluation provider. */
  evaluationContext: unknown;
  /** Every `SoundManager` method, stable per name, so a test can assert `seam.sound.playCorrect`. */
  sound: Record<string, Mock<(...args: unknown[]) => unknown>>;
  /** Calls to the legacy `useLuminaAI` hook while enabled, and to its `sendText`. */
  legacyAI: Mock<(...args: unknown[]) => unknown>;
}

export const seam: SeamState = {
  conversation: [], audio: false, close: null, send: vi.fn(), submit: vi.fn(), held: 0,
  activePrimitiveId: '', evaluationContext: null, sound: {}, legacyAI: vi.fn(),
};

/** Returns void deliberately: a `beforeEach` arrow returning a value runs it as teardown. */
export function resetSeams(): void {
  seam.conversation = [];
  seam.audio = false;
  seam.close = null;
  seam.held = 0;
  seam.evaluationContext = null;
}

/**
 * Fake timers plus rAF on top of them, so a paint opportunity is something the
 * test can advance rather than something it waits for.
 */
export function installRuntimeTimers(): void {
  vi.useFakeTimers();
  vi.clearAllMocks();
  resetSeams();
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
}

export function restoreRuntimeTimers(): void {
  vi.useRealTimers();
  vi.unstubAllGlobals();
}

export const luminaAIContextSeam = () => ({
  useMicLevel: () => 0,
  useLuminaAIContext: () => ({
    isConnected: true, isListening: true, isAudioPlaying: seam.audio, sessionMode: 'lesson',
    activePrimitiveId: seam.activePrimitiveId, sessionResumeCount: 0, conversation: seam.conversation,
    sendText: seam.send, startListening: vi.fn(), stopListening: vi.fn(), updateContext: vi.fn(),
    holdVoiceTurns: () => { seam.held++; return () => { seam.held--; }; },
    sharedVoiceTurns: {
      subscribe: (listener: { onTurnClose: SeamState['close'] }) => {
        seam.close = listener.onTurnClose;
        return () => { seam.close = null; };
      },
      isVoiceActive: () => false, reset: vi.fn(),
      lastTurnOpenAtRef: { current: null }, floorsRef: { current: { ambientRms: 0, echoRms: 0 } },
      config: DEFAULT_VOICE_TURN_CONFIG,
    },
  }),
});

/** Keeps the module's real exports and replaces only the detector hook. */
export const voiceTurnsSeam = async (original: () => Promise<Record<string, unknown>>) => ({
  ...(await original()),
  useLiveVoiceTurns: () => ({
    isVoiceActive: () => false, reset: vi.fn(), lastTurnOpenAtRef: { current: null },
    floorsRef: { current: {} }, config: DEFAULT_VOICE_TURN_CONFIG,
  }),
});

export const evaluationSeam = () => ({
  useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0, resetAttempt: vi.fn() }),
});

/** Getters answer like a live SoundManager (`isEnabled` true, volume 1); everything else is a stable spy. */
export const soundSeam = () => ({ SoundManager: new Proxy({}, { get: (_, name: string) => {
  if (name === 'isEnabled') return () => true;
  if (name === 'getVolume') return () => 1;
  return (seam.sound[name] ??= vi.fn());
} }) });

/**
 * The legacy per-primitive AI hook. A workspace-bound surface must pass `enabled: false` (its context
 * carries the answers) and never call its `sendText`; either one lands in `seam.legacyAI`.
 */
export const legacyAISeam = () => ({ useLuminaAI: (o: { enabled?: boolean }) => {
  if (o?.enabled !== false) seam.legacyAI('enabled');
  return { sendText: (...args: unknown[]) => seam.legacyAI('sendText', ...args), isConnected: true,
    isAudioPlaying: false, activePrimitiveId: seam.activePrimitiveId, updateContext: vi.fn() };
} });

export const micPanelSeam = () => ({ default: () => null });
