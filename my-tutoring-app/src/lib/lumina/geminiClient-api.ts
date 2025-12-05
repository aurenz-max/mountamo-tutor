// Client-side API wrapper for Gemini service functions in lib/lumina
// This file is safe to use in client components ('use client')

import { ItemDetailData } from '@/types/lumina';

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
