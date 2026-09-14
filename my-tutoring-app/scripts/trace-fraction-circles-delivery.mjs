// Replica of the Next registry path for one authenticated fraction-circles draw.
// Token is read from a file path argument; logs status, counts and planner output only.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as vite from 'vite';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const [tokenFile, configJson] = process.argv.slice(2);
const authorization = readFileSync(tokenFile, 'utf8').trim();
const root = process.cwd();
const trace = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const t0 = Date.now();
  const response = await realFetch(url, init);
  if (String(url).includes('/api/student-profile/')) {
    const body = await response.clone().json().catch(() => null);
    trace.push({ backend: String(url).replace(/^https?:\/\/[^/]+/, ''), status: response.status, ms: Date.now() - t0,
      available: body?.available, count: Array.isArray(body?.observations) ? body.observations.length : undefined,
      evidenceChars: body?.observations?.[0]?.evidence?.length });
  }
  return response;
};
const server = await vite.createServer({ root, configFile: false, appType: 'custom', logLevel: 'silent',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } } });
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { ai } = await loader.import('/src/components/lumina/service/geminiClient.ts');
  const original = ai.models.generateContent.bind(ai.models);
  ai.models.generateContent = async args => {
    const planner = String(args.contents).startsWith('Select ONE');
    const t0 = Date.now();
    try {
      const result = await original(args);
      if (planner) trace.push({ planner: result.text, finish: result.candidates?.[0]?.finishReason, ms: Date.now() - t0 });
      return result;
    } catch (error) {
      if (planner) trace.push({ plannerError: String(error).slice(0, 200), ms: Date.now() - t0 });
      throw error;
    }
  };
  for (const method of ['warn', 'error']) {
    const prior = console[method];
    console[method] = (...args) => { trace.push({ [method]: args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ').slice(0, 300) }); };
    void prior;
  }
  const { withGenerationRequest } = await loader.import('/src/components/lumina/service/generation/generationRequest.ts');
  const { generateComponentContent } = await loader.import('/src/components/lumina/service/geminiService.ts');
  const item = JSON.parse(configJson);
  const result = await withGenerationRequest(authorization, () => generateComponentContent(item, item.topic, item.gradeLevel));
  process.stdout.write(JSON.stringify({ trace, adaptation: result?.data?.learningAdaptation ?? null,
    pairs: result?.data?.challenges?.map(c => `${c.numerator}/${c.denominator} vs ${c.compareFraction?.numerator}/${c.compareFraction?.denominator}`) }) + '\n');
} finally {
  await server.close();
}
