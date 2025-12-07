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

export const buildCompleteExhibitFromTopic = async (
  topic: string,
  gradeLevel: string
): Promise<ExhibitData> => {
  return callAPI('buildCompleteExhibitFromTopic', { topic, gradeLevel });
};

export const generateIntroBriefing = async (
  topic: string,
  gradeLevel: string
): Promise<IntroBriefingData> => {
  return callAPI('generateIntroBriefing', { topic, gradeLevel });
};
