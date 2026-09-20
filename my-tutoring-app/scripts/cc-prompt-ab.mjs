// A/B the image prompt only, holding the model fixed: is the half-green picture
// caused by the word "variegated" (and the missing dominance constraint), or by
// the image model ignoring its prompt?
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as vite from 'vite';
if (!process.env.GEMINI_API_KEY) {
  const m = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (m) process.env.GEMINI_API_KEY = m[1].trim().replace(/^["']|["']$/g, '');
}
const realLog = console.log;
for (const m of ['log','warn','error','info','debug']) console[m] = () => {};
const root = process.cwd();
const out = resolve(root, 'qa/compare-contrast-images/ab');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({
  root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const cases = {
  control: 'Close-up of a houseplant or ornamental tree with vibrant pink and white variegated leaves',
  fixed: 'Close-up photograph of a plant whose leaves are entirely bright pink over the whole blade, filling the frame. Every leaf is pink from edge to midrib, with no green and no white patches. Plain softly blurred background, no other plants in view.',
};
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { ai } = await loader.import('/src/components/lumina/service/geminiClient.ts');
  for (const [name, prompt] of Object.entries(cases)) {
    const res = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-image',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: '1:1' } },
    });
    const part = (res.candidates?.[0]?.content?.parts || []).find((x) => x.inlineData);
    if (part) writeFileSync(resolve(out, `${name}.png`), Buffer.from(part.inlineData.data, 'base64'));
    realLog(name, !!part);
  }
} finally { await server.close(); }
