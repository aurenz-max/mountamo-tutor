import { GoogleGenAI } from '@google/genai';
import 'server-only';
import { meterClient } from '@/components/lumina/service/spend/spendMeter';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is not set');
}

// Metered: every call is priced into the daily ledger and automated sources stop at their cap (spendMeter.ts).
export const ai = meterClient(new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }));
