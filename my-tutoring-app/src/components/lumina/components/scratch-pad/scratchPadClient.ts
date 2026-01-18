// Client-side API wrapper for Scratch Pad Gemini service
// This file is safe to use in client components ('use client')

import { AIAnalysisResult } from './types';

const API_BASE = '/api/lumina';

export type AnalysisStage = 'uploading' | 'analyzing' | 'processing' | 'complete';

export interface AnalysisProgressCallback {
  onProgress?: (stage: AnalysisStage, message: string) => void;
}

async function callAPI(action: string, params: Record<string, unknown>) {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, params }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API call failed');
  }

  return response.json();
}

/**
 * Analyze scratch pad content using Gemini Vision
 * Supports progress callbacks for UI feedback
 */
export async function analyzeScratchPad(
  imageBase64: string,
  context?: {
    topic?: string;
    gradeLevel?: string;
  },
  callbacks?: AnalysisProgressCallback
): Promise<AIAnalysisResult> {
  // Stage 1: Uploading
  callbacks?.onProgress?.('uploading', 'Preparing your work...');

  // Create the API call promise
  const apiPromise = callAPI('analyzeScratchPad', { imageBase64, context });

  // Simulate progress stages based on typical timing
  // Stage 2: Analyzing (after ~300ms)
  const analyzeTimer = setTimeout(() => {
    callbacks?.onProgress?.('analyzing', 'Analyzing your work...');
  }, 300);

  // Stage 3: Processing (after ~1.5s)
  const processTimer = setTimeout(() => {
    callbacks?.onProgress?.('processing', 'Generating feedback...');
  }, 1500);

  try {
    const result = await apiPromise;

    // Clear timers and mark complete
    clearTimeout(analyzeTimer);
    clearTimeout(processTimer);
    callbacks?.onProgress?.('complete', 'Ready!');

    return result;
  } catch (error) {
    clearTimeout(analyzeTimer);
    clearTimeout(processTimer);
    throw error;
  }
}

/**
 * Get a hint for the current work
 */
export async function getScratchPadHint(
  imageBase64: string,
  hintLevel: number = 1
): Promise<string> {
  const result = await callAPI('getScratchPadHint', { imageBase64, hintLevel });
  return result.hint;
}

/**
 * Generate a practice problem for the scratch pad
 */
export async function generateScratchPadProblem(
  topic: string,
  gradeLevel: string,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium'
): Promise<{
  problem: string;
  hint?: string;
}> {
  return callAPI('generateScratchPadProblem', { topic, gradeLevel, difficulty });
}
