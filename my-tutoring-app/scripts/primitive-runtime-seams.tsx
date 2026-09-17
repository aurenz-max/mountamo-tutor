// Hardware/auth/evaluation boundaries for the mounted-component live driver.
// Primitives, their scripts, grading, runners and runtime remain real.
import React, { createContext, useContext } from 'react';
export const DriverContext = createContext<any>(null);
export const useLuminaAIContext = () => useContext(DriverContext);
export const useMicLevel = () => 0;
export const auth = { currentUser: null };
export const db = {};
export const app = {};
export const useLiveVoiceTurns = () => ({ isVoiceActive: () => false, reset: () => {},
  lastTurnOpenAtRef: { current: null }, floorsRef: { current: {} }, config: {} });
export const SoundManager = new Proxy({}, { get: () => () => {} });
export const submissions: unknown[][] = [];
export const usePrimitiveEvaluation = () => ({ hasSubmitted: false, elapsedMs: 0,
  submitResult: (...args: unknown[]) => submissions.push(args) });
export default function MicrophoneHardwarePlaceholder() { return null; }

export const useEvaluationContext = () => null;
