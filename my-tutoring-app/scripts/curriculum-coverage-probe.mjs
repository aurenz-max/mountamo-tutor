import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'qa/curriculum-coverage');
const live = JSON.parse(readFileSync(resolve(out, 'live-curriculum.json'), 'utf8'));
const requirements = live.curriculum.flatMap(u => u.skills.flatMap(s => s.subskills));
const cases = [
  ['LA005-01-H', 'picture-vocabulary', 'gradable_scale'],
  ['LA005-03-A', 'picture-vocabulary', 'association'],
  ['LA005-02-I', 'di-spoken-practice', 'say_answer'],
  ['LA004-06-E', 'di-spoken-practice', 'say_answer'],
  ['LA004-01-A', 'word-sorter', 'binary_sort'],
  ['LA005-02-H', 'picture-vocabulary', 'sentence_frame'],
];
const hash = v => createHash('sha256').update(v).digest('hex');
mkdirSync(resolve(out, 'evidence'), { recursive: true });
const sourceFiles = [
  'src/app/api/lumina/eval-test/route.ts',
  'src/components/lumina/service/manifest/catalog/literacy.ts',
  'src/components/lumina/service/manifest/catalog/di.ts',
  'src/components/lumina/service/literacy/gemini-picture-vocabulary.ts',
  'src/components/lumina/service/literacy/gemini-word-sorter.ts',
  'src/components/lumina/service/direct-instruction/gemini-di-spoken-practice.ts',
  'src/components/lumina/primitives/visual-primitives/literacy/PictureVocabulary.tsx',
  'src/components/lumina/primitives/visual-primitives/literacy/WordSorter.tsx',
  'src/components/lumina/primitives/visual-primitives/direct-instruction/DiSpokenPractice.tsx',
];
const sourceHashes = Object.fromEntries(sourceFiles.map(p => [p, hash(readFileSync(resolve(root,p)))]));
const jobs = cases.flatMap(([id, primitive, mode]) => [1,2].map(draw => ({ id, primitive, mode, draw })));
async function worker() {
  for (;;) {
    const job = jobs.shift(); if (!job) return;
    const requirement = requirements.find(r => r.id === job.id);
    if (!requirement) throw new Error(`Missing published requirement ${job.id}`);
    const file = resolve(out, 'evidence', `${job.id}-${job.primitive}-${job.mode}-${job.draw}.json`);
    const inputHash = hash(JSON.stringify({ job, text: requirement.description, sourceHashes }));
    if (existsSync(file) && JSON.parse(readFileSync(file,'utf8')).inputHash === inputHash) {
      console.log(`cached ${job.id} ${job.mode} draw ${job.draw}`); continue;
    }
    const params = new URLSearchParams({ componentId: job.primitive, evalMode: job.mode,
      topic: requirement.description, intent: requirement.description,
      grade: 'K', gradeLevel: 'kindergarten', difficulty: 'easy' });
    const started = Date.now();
    const record = { ...job, subject: 'LANGUAGE_ARTS', grade: 'K', requirement: requirement.description,
      requestedAt: new Date().toISOString(), inputHash, sourceHashes, params: Object.fromEntries(params) };
    try {
      const response = await fetch(`http://localhost:3000/api/lumina/eval-test?${params}`, { signal: AbortSignal.timeout(180000) });
      record.httpStatus = response.status;
      record.response = await response.json();
    } catch (e) { record.transportError = String(e); }
    record.durationMs = Date.now()-started;
    writeFileSync(file, JSON.stringify(record,null,2)+'\n');
    console.log(JSON.stringify({ ...job, http: record.httpStatus, status: record.response?.status, error: record.response?.error || record.transportError, durationMs: record.durationMs }));
  }
}
await Promise.all([worker(),worker()]);
