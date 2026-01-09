// Client-side API wrapper for Gemini service functions
// This file is safe to use in client components ('use client')

import {
  ItemDetailData,
  ExhibitManifest,
  ExhibitData,
  SpecializedExhibitIntent,
  SpecializedExhibit,
  ProblemType,
  ProblemData,
  IntroBriefingData,
  CustomWebData,
  CustomSVGData,
  SentenceSchemaData,
  MathVisualData,
  ComponentId,
  ManifestItemConfig
} from '../types';

/**
 * Progress callback for manifest generation streaming
 */
export interface ManifestProgressCallback {
  onThinking?: (thought: string) => void;
  onProgress?: (message: string) => void;
  onPartialManifest?: (partial: Partial<ExhibitManifest>) => void;
}

const API_BASE = '/api/lumina';

async function callAPI(action: string, params: any) {
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

export const generateItemDetail = async (
  contextTopic: string,
  item: string
): Promise<ItemDetailData> => {
  return callAPI('generateItemDetail', { contextTopic, item });
};

export const generateConceptImage = async (prompt: string): Promise<string | null> => {
  const result = await callAPI('generateConceptImage', { prompt });
  return result.image;
};

export const generateCustomWebExhibit = async (
  topic: string,
  gradeLevel: string
): Promise<CustomWebData> => {
  return callAPI('generateCustomWebExhibit', { topic, gradeLevel });
};

export const generateCustomSVGExhibit = async (
  topic: string,
  gradeLevel: string
): Promise<CustomSVGData> => {
  return callAPI('generateCustomSVGExhibit', { topic, gradeLevel });
};

export const generateSentenceExhibit = async (
  topic: string,
  gradeLevel: string
): Promise<SentenceSchemaData> => {
  return callAPI('generateSentenceExhibit', { topic, gradeLevel });
};

export const generateMathVisualExhibit = async (
  topic: string,
  gradeLevel: string
): Promise<MathVisualData> => {
  return callAPI('generateMathVisualExhibit', { topic, gradeLevel });
};

export const generateSpecializedExhibits = async (
  topic: string,
  gradeLevel: string,
  intent: SpecializedExhibitIntent
): Promise<SpecializedExhibit[]> => {
  return callAPI('generateSpecializedExhibits', { topic, gradeLevel, intent });
};

export const generateMultipleChoiceProblems = async (
  topic: string,
  gradeLevel: string,
  count: number
): Promise<ProblemData[]> => {
  return callAPI('generateMultipleChoiceProblems', { topic, gradeLevel, count });
};

export const generateTrueFalseProblems = async (
  topic: string,
  gradeLevel: string,
  count: number
): Promise<ProblemData[]> => {
  return callAPI('generateTrueFalseProblems', { topic, gradeLevel, count });
};

export const generateFillInBlanksProblems = async (
  topic: string,
  gradeLevel: string,
  count: number
): Promise<ProblemData[]> => {
  return callAPI('generateFillInBlanksProblems', { topic, gradeLevel, count });
};

export const generateCategorizationProblems = async (
  topic: string,
  gradeLevel: string,
  count: number
): Promise<ProblemData[]> => {
  return callAPI('generateCategorizationProblems', { topic, gradeLevel, count });
};

export const generateMatchingProblems = async (
  topic: string,
  gradeLevel: string,
  count: number
): Promise<ProblemData[]> => {
  return callAPI('generateMatchingProblems', { topic, gradeLevel, count });
};

export const generateKnowledgeCheckProblems = async (
  topic: string,
  gradeLevel: string,
  problemType: ProblemType,
  count: number
): Promise<ProblemData[]> => {
  return callAPI('generateKnowledgeCheckProblems', { topic, gradeLevel, problemType, count });
};

export const generateSequencingProblems = async (
  topic: string,
  gradeLevel: string,
  count: number
): Promise<ProblemData[]> => {
  return callAPI('generateSequencingProblems', { topic, gradeLevel, count });
};

export const generateProblemHint = async (
  problem: ProblemData,
  hintLevel: number
): Promise<string> => {
  return callAPI('generateProblemHint', { problem, hintLevel });
};

export const generateComponentContent = async (
  componentId: ComponentId,
  topic: string,
  gradeLevel: string,
  config?: ManifestItemConfig
): Promise<any> => {
  return callAPI('generateComponentContent', { componentId, topic, gradeLevel, config });
};

export const generateExhibitManifest = async (
  topic: string,
  gradeLevel: string
): Promise<ExhibitManifest> => {
  return callAPI('generateExhibitManifest', { topic, gradeLevel });
};

export const generateExhibitManifestWithObjectives = async (
  topic: string,
  gradeLevel: string,
  objectives: Array<{ id: string; text: string; verb: string; icon: string }>
): Promise<ExhibitManifest> => {
  return callAPI('generateExhibitManifestWithObjectives', { topic, gradeLevel, objectives });
};

/**
 * Generate manifest with streaming progress updates via API
 * This uses Server-Sent Events to stream real-time progress
 */
export const generateExhibitManifestWithObjectivesStreaming = async (
  topic: string,
  gradeLevel: string,
  objectives: Array<{ id: string; text: string; verb: string; icon: string }>,
  callbacks?: ManifestProgressCallback
): Promise<ExhibitManifest> => {
  const response = await fetch('/api/lumina/manifest-stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ topic, gradeLevel, objectives }),
  });

  if (!response.ok) {
    throw new Error('Manifest streaming failed');
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    throw new Error('No response body reader available');
  }

  let buffer = '';
  let finalManifest: ExhibitManifest | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      // Decode chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const event = JSON.parse(line);

          switch (event.type) {
            case 'progress':
              callbacks?.onProgress?.(event.message);
              break;
            case 'thinking':
              callbacks?.onThinking?.(event.thought);
              break;
            case 'partial':
              callbacks?.onPartialManifest?.(event.manifest);
              break;
            case 'complete':
              finalManifest = event.manifest;
              break;
            case 'error':
              throw new Error(event.error);
          }
        } catch (parseError) {
          console.error('Failed to parse streaming event:', line, parseError);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!finalManifest) {
    throw new Error('No manifest received from stream');
  }

  return finalManifest;
};

export const buildCompleteExhibitFromManifest = async (
  manifest: ExhibitManifest,
  curatorBrief: IntroBriefingData
): Promise<ExhibitData> => {
  return callAPI('buildCompleteExhibitFromManifest', { manifest, curatorBrief });
};

export const generateIntroBriefing = async (
  topic: string,
  gradeLevel: string
): Promise<IntroBriefingData> => {
  return callAPI('generateIntroBriefing', { topic, gradeLevel });
};

export const generatePracticeAssessment = async (
  subject: string,
  gradeLevel: string,
  problemCount: number,
  problems: ProblemData[]
): Promise<{
  summary: string;
  strengths: string[];
  areasForGrowth: string[];
  recommendedTopics: Array<{
    topic: string;
    reason: string;
    subject: string;
  }>;
}> => {
  return callAPI('generatePracticeAssessment', { subject, gradeLevel, problemCount, problems });
};

export interface Quest {
  title: string;
  description: string;
  icon: string;
  focusArea: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

export interface WarmUpQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  funFact: string;
}

export const generateQuests = async (
  subject: string,
  gradeLevel: string,
  count: number = 4
): Promise<Quest[]> => {
  return callAPI('generateQuests', { subject, gradeLevel, count });
};

export const generateWarmUpQuestion = async (
  subject: string,
  gradeLevel: string
): Promise<WarmUpQuestion> => {
  return callAPI('generateWarmUpQuestion', { subject, gradeLevel });
};
