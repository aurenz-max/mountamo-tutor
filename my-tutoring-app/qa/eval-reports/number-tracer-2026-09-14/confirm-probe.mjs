// Confirm: transparent export vs dark-filled export, messy-correct digits, and whether a read-as field is reliable.
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('./grader-probe.mjs', import.meta.url), 'utf8');
const head = src.split('// Expected outcomes written before running.')[0];
const body = `
const { ai } = await runner.import('/src/components/lumina/service/geminiClient.ts');
const { Type } = await import(pathToFileURL(join(ROOT, 'node_modules/@google/genai/dist/node/index.mjs')).href);
async function readAs(png) {
  const r = await ai.models.generateContent({ model: 'gemini-flash-lite-latest', contents: [{ parts: [
    { inlineData: { mimeType: 'image/png', data: png.split(',')[1] } },
    { text: 'A kindergarten student wrote a number on this canvas. The background is dark; the student strokes are white. Ignore faint grid lines and the dashed baseline. Which number did the student write? Answer with the digits you see, or ? if nothing readable is drawn. Say whether any digit is written mirror-reversed.' }] }],
    config: { responseMimeType: 'application/json', responseSchema: { type: Type.OBJECT, properties: { readAs: { type: Type.STRING }, mirrored: { type: Type.BOOLEAN } }, required: ['readAs', 'mirrored'] } } });
  return JSON.parse(r.text);
}
// Expected before running: transparent -> "nothing drawn" style rejections; dark fill -> vision sees the strokes;
// messy correct on transparent -> rejected; on dark -> accepted; readAs on dark matches the written number.
const cases = [
  ...[2, 4, 5, 7].map(t => ({ group: 'messy-correct', target: t, written: t, wobble: 28 })),
  ...[[5, 7], [6, 9], [1, 7], [2, 5], [7, 1], [4, 9]].map(([t, w]) => ({ group: 'wrong-number', target: t, written: w })),
  ...[3, 7].map(t => ({ group: 'mirrored', target: t, written: t, mirror: true })),
];
const rows = [];
for (const c of cases) {
  const strokes = childStrokes(c.written, { mirror: !!c.mirror, wobble: c.wobble ?? 8 });
  const ideal = geo.getDigitPaths(c.target);
  const geoScore = Math.round(geo.scoreStrokeAccuracy(strokes, ideal, true) * 0.6 + geo.computePathCoverage(strokes, ideal, true) * 0.4);
  for (const fill of [null, '#020617']) {
    const png = await render(strokes, fill);
    const alpha0 = await page.evaluate(() => document.getElementById('c').getContext('2d').getImageData(3, 3, 1, 1).data[3]);
    const v = await evaluateDigitDrawing(png, c.target, 'sequence');
    const read = fill ? await readAs(png) : null;
    const row = { ...c, fill: fill ?? 'transparent', alpha0, geoScore, v: { s: v.score, c: v.confidence, r: v.recognized, fb: v.feedback }, read };
    rows.push(row); console.log(JSON.stringify(row));
  }
}
await writeFile(join(OUT, 'confirm.json'), JSON.stringify(rows, null, 2));
await browser.close(); await server.close();
`;
const { writeFileSync } = await import('node:fs');
writeFileSync(new URL('./confirm-run.mjs', import.meta.url), head + body);
await import('./confirm-run.mjs');
