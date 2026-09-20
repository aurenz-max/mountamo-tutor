// Repeat the reported case N times: does the pink side reliably get an imagePrompt
// that makes PINK the dominant thing in frame, and does the rendered picture obey it?
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) { console.log('Pass --run'); process.exit(0); }
const N = Number(process.argv[process.argv.indexOf('--n') + 1]) || 5;
if (!process.env.GEMINI_API_KEY) {
  const m = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (m) process.env.GEMINI_API_KEY = m[1].trim().replace(/^["']|["']$/g, '');
}
const clean = (v) => String(v).replaceAll(process.env.GEMINI_API_KEY, '[REDACTED]');
const realLog = console.log;
for (const m of ['log', 'warn', 'error', 'info', 'debug']) console[m] = () => {};

const root = process.cwd();
const out = resolve(root, 'qa/compare-contrast-images/repeat');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({
  root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const rows = [];
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateCompareContrast } = await loader.import('/src/components/lumina/service/biology/gemini-compare-contrast.ts');
  const { ai } = await loader.import('/src/components/lumina/service/geminiClient.ts');
  for (let i = 1; i <= N; i++) {
    const data = await generateCompareContrast(
      'Pink Leaves', 'Green Leaves', '3-5', 'side-by-side', undefined,
      'Compare why some leaves look pink and others look green',
    );
    const p = data.entityA.imagePrompt;
    const res = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-image',
      contents: { parts: [{ text: p }] },
      config: { imageConfig: { aspectRatio: '1:1' } },
    });
    const part = (res.candidates?.[0]?.content?.parts || []).find((x) => x.inlineData);
    if (part) writeFileSync(resolve(out, `run${i}-pink.png`), Buffer.from(part.inlineData.data, 'base64'));
    rows.push({ run: i, title: data.title, pinkPrompt: p, greenPrompt: data.entityB.imagePrompt, rendered: !!part });
  }
} finally { await server.close(); }
writeFileSync(resolve(out, 'repeat.json'), JSON.stringify(rows, null, 2));
realLog(JSON.stringify(rows, null, 2));
