import { GoogleGenAI } from '@google/genai';
import 'server-only';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is not set');
}

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
