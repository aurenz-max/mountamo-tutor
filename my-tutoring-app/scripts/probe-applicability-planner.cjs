// Execute the production TypeScript planner against the real model without a server or learner writes.
const fs = require('node:fs');
const ts = require('typescript');
require('@next/env').loadEnvConfig(process.cwd());
const { GoogleGenAI } = require('@google/genai');
const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const calls = [];
const ai = { models: { generateContent: async args => {
  const result = await client.models.generateContent(args);
  calls.push({ text: result.text, finishReason: result.candidates?.[0]?.finishReason,
    usage: result.usageMetadata });
  return result;
} } };
function load(file, dependencies) {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function('require', 'exports', output)(id => id in dependencies ? dependencies[id] : require(id), exports);
  return exports;
}
const { planLearningAdaptation } = load('src/components/lumina/service/generation/planLearningAdaptation.ts', {
  'server-only': {}, '../geminiClient': { ai },
});
const { placeValueTeaching, baseTenTeaching } = load('src/components/lumina/service/math/placeValueTeachingCapabilities.ts', {
  './placeValueRemediation': {},
});
(async () => {
  const report = [];
  for (const capability of [placeValueTeaching, baseTenTeaching]) {
    const observation = { id: 'o1', summary: 'Moving a symbol one column to the left does not change the amount the learner says it represents; they report the same quantity in both locations.' };
    const result = await planLearningAdaptation(capability, { grade: '4', mode: capability === placeValueTeaching ? 'compare' : 'read_blocks', tier: 'medium', topic: 'Place value in four-digit whole numbers' }, [observation]);
    report.push({ activity: capability.activity, result, modelResponse: calls.at(-1) });
  }
  fs.writeFileSync('../artifacts/learning-applicability/direct-planner.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})();
