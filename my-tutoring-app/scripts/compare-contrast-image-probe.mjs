// Probe: does bio-compare-contrast hand the image model a prompt that actually
// names the distinguishing feature being compared?
//
// The reported failure: a "Pink Leaves vs. Green Leaves" comparison rendered a
// mostly-green leaf on the pink side. Gemini image is faithful to its prompt, so
// the suspect is the imagePrompt the CONTENT generator writes, not the image call.
//
// Prints both entities' imagePrompt, and with --images also renders and saves the
// PNGs so the picture can be compared against the prompt that produced it.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run (add --images to also render the pictures).');
  process.exit(0);
}
const WITH_IMAGES = process.argv.includes('--images');
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key');
const clean = (v) => String(v).replaceAll(process.env.GEMINI_API_KEY, '[REDACTED]');
const logs = [];
const realLog = console.log;
for (const m of ['log', 'warn', 'error', 'info', 'debug']) console[m] = (...a) => logs.push(clean(format(...a)));

const root = process.cwd();
const out = resolve(root, 'qa/compare-contrast-images');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({
  root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const report = [];
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateCompareContrast } = await loader.import('/src/components/lumina/service/biology/gemini-compare-contrast.ts');
  const { ai } = await loader.import('/src/components/lumina/service/geminiClient.ts');

  const cases = [
    ['pink-vs-green-leaves', 'Pink Leaves', 'Green Leaves', '3-5', 'Compare why some leaves look pink and others look green'],
    ['monarch-vs-viceroy', 'Monarch Butterfly', 'Viceroy Butterfly', '3-5', 'Compare the wing patterns that tell these two butterflies apart'],
    ['frog-vs-toad', 'Frog', 'Toad', 'K-2', 'Compare frog and toad skin and body shape'],
  ];

  for (const [name, a, b, band, intent] of cases) {
    const t0 = Date.now();
    const data = await generateCompareContrast(a, b, band, 'side-by-side', undefined, intent);
    const row = {
      case: name, seconds: ((Date.now() - t0) / 1000).toFixed(1),
      title: data.title,
      entityA: { name: data.entityA.name, imagePrompt: data.entityA.imagePrompt },
      entityB: { name: data.entityB.name, imagePrompt: data.entityB.imagePrompt },
    };
    if (WITH_IMAGES) {
      for (const key of ['entityA', 'entityB']) {
        const res = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-image',
          contents: { parts: [{ text: data[key].imagePrompt }] },
          config: { imageConfig: { aspectRatio: '1:1' } },
        });
        const part = (res.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData);
        if (part) {
          const file = resolve(out, `${name}-${key}.png`);
          writeFileSync(file, Buffer.from(part.inlineData.data, 'base64'));
          row[key].image = file;
        } else {
          row[key].image = null;
        }
      }
    }
    report.push(row);
  }
} finally {
  await server.close();
}
writeFileSync(resolve(out, 'probe.json'), JSON.stringify({ report, logs }, null, 2));
realLog(JSON.stringify(report, null, 2));
realLog(`\nwrote ${resolve(out, 'probe.json')}`);
