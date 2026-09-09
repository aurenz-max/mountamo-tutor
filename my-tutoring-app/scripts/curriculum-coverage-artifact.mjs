import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createServer, createServerModuleRunner } from 'vite';
import { SCOPES, scopeFromArgv, curriculumUrl } from './lib/curriculum-coverage-scopes.mjs';
import { ENTRY_PREFIX, entryHash } from './lib/curriculum-coverage-catalog.mjs';

// Builds the self-contained HTML atlas for one reviewed scope. Every scope shares the template
// and view; scope-specific copy (title, counts, probe summary, verification) is embedded as data.
// Other built scopes are cross-linked in the grade/subject matrix through their summary.json.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scope = scopeFromArgv();
const dir = resolve(root, scope.dir);
// --out <dir>: write the HTML elsewhere (a dry build for verifying template/view changes without
// touching a scope's published atlas). --allow-stale-catalog: warn instead of refusing when the
// frozen catalog hashes no longer match; for dry builds only, never for a published atlas.
const argv = process.argv.slice(2);
const outDir = argv.includes('--out') ? resolve(argv[argv.indexOf('--out') + 1]) : dir;
const allowStale = argv.includes('--allow-stale-catalog');
if (allowStale && outDir === dir) throw new Error('--allow-stale-catalog is only valid with --out (dry build)');
const snapshotPath = `${scope.dir}/live-curriculum.json`;
const raw = readFileSync(resolve(root, snapshotPath), 'utf8');
const snapshot = JSON.parse(raw);
const hash = value => createHash('sha256').update(value).digest('hex');
const readJson = name => JSON.parse(readFileSync(resolve(dir, name), 'utf8'));
const optionalJson = name => existsSync(resolve(dir, name)) ? readJson(name) : null;
const server = await createServer({ configFile: false, root, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
try {
  const runner = createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { UNIVERSAL_CATALOG, CATALOGS_BY_DOMAIN } = await runner.import('/src/components/lumina/service/manifest/catalog/index.ts');
  const catalog = UNIVERSAL_CATALOG.map(c => ({
    id: c.id, description: c.description, constraints: c.constraints,
    domain: Object.entries(CATALOGS_BY_DOMAIN).find(([, entries]) => entries.some(e => e.id === c.id))?.[0],
    supportsEvaluation: c.supportsEvaluation === true,
    modes: (c.evalModes ?? []).map(m => ({ id: m.evalMode, description: m.description, label: m.label })),
  }));
  const review = readJson('review.json');
  for (const [p, h] of Object.entries(review.catalogSources ?? {})) {
    if (hash(readFileSync(resolve(root, p))) !== h) {
      if (!allowStale) throw new Error(`Catalog review is stale: ${p}`);
      console.warn(`WARNING (dry build): catalog review is stale: ${p}`);
    }
  }
  const evidence = readJson('content-checks.json');
  const requirements = snapshot.curriculum.flatMap(u => u.skills.flatMap(s => s.subskills.map(r => ({
    id: r.id, unit: u.title, unitId: u.id, skill: s.description, text: r.description,
    primitive: r.target_primitive || null, modes: r.target_eval_modes ?? [],
  }))));
  if (new Set(requirements.map(r => r.id)).size !== requirements.length) throw new Error('Duplicate curriculum IDs');
  for (const r of requirements) {
    r.review = review.decisions[r.id];
    if (!r.review) throw new Error(`No explicit review for ${r.id}`);
    if (r.review.requirementHash !== hash(r.text)) throw new Error(`Stale requirement review: ${r.id}`);
    for (const edge of r.review.candidates) {
      const def = catalog.find(p => p.id === edge.primitive);
      if (!def?.modes.some(m => m.id === edge.mode)) throw new Error(`Invalid reviewed edge: ${r.id} ${edge.primitive}/${edge.mode}`);
    }
    // A `catalog-entry:<id>` key is checked against the primitive's live entry; a path key against the file.
    const sourceChanged = ([p, h]) => p.startsWith(ENTRY_PREFIX) ? entryHash(UNIVERSAL_CATALOG, p.slice(ENTRY_PREFIX.length)) !== h : (!existsSync(resolve(root, p)) || hash(readFileSync(resolve(root, p))) !== h);
    r.evidence = evidence.filter(e => e.id === r.id).map(e => ({ ...e, stale: Object.entries(e.sourceHashes ?? {}).some(sourceChanged) }));
    if (r.evidence.length) {
      r.review.reviewLevel = 'source + generated content';
      r.review.content = r.evidence.some(e => e.stale) ? 'stale' : r.evidence.some(e => e.result === 'failed') ? 'failed' : 'sampled';
      r.review.contentNote = r.evidence[0].semantic;
    }
  }
  const workItems = readJson('work-items.json');
  const prescriptions = readJson('modality-prescriptions.json');
  if (new Set(workItems.map(w => w.id)).size !== workItems.length) throw new Error('Duplicate work item IDs');
  const nextRanks = workItems.filter(w => w.nextRank !== undefined).map(w => w.nextRank).sort((a, b) => a - b);
  if (nextRanks.some((rank, i) => !Number.isInteger(rank) || rank !== i + 1)) throw new Error('Development nextRank values must be consecutive positive integers');
  if (Object.keys(prescriptions).length !== workItems.length) throw new Error('Modality prescriptions must match the development queue');
  for (const item of workItems) {
    item.modality = prescriptions[item.id];
    for (const field of ['stimulus', 'response', 'visibility', 'feedback', 'score', 'liveCheck']) {
      if (!item.modality?.[field]?.trim()) throw new Error(`Missing modality prescription: ${item.id}/${field}`);
    }
    item.modality.reuseSources = (item.modality.reuseEvidence ?? []).map(p => ({ path: p, sha256: hash(readFileSync(resolve(root, p))) }));
    item.requirements = requirements.filter(r => r.review.work === item.id || item.requirementIds?.includes(r.id)).map(r => r.id);
    if (!item.requirements.length) throw new Error(`Development item ${item.id} blocks no requirement`);
  }
  for (const r of requirements) if (r.review.work && !workItems.some(w => w.id === r.review.work)) throw new Error(`${r.id} names unknown work item ${r.review.work}`);
  // Design themes (storyboards) are optional per scope; when present every unmapped requirement needs exactly one.
  const designs = optionalJson('design-themes.json') ?? [];
  const designed = new Set();
  if (new Set(designs.map(d => d.id)).size !== designs.length) throw new Error('Duplicate design IDs');
  for (const design of designs) {
    design.requirements = design.variants.map(v => {
      const matches = requirements.filter(r => v.id ? r.id === v.id : r.skill === v.skill && r.text.includes(v.textContains));
      if (matches.length !== 1) throw new Error(`Design variant must resolve exactly once: ${design.id}/${JSON.stringify(v)}`);
      const r = matches[0];
      if (r.review.candidates.length || designed.has(r.id)) throw new Error(`Design scope is not an unassigned gap or is duplicated: ${r.id}`);
      designed.add(r.id);
      return { id: r.id, text: r.text.split('\n')[0], treatment: v.treatment };
    });
    for (const f of ['idea', 'visual', 'core', 'reuse', 'student', 'feedback', 'mask', 'evidence']) if (!design[f]?.trim()) throw new Error(`Missing design field ${design.id}/${f}`);
    if (design.steps.length !== 3 || design.prompts.length !== 3) throw new Error(`Expected three design frames: ${design.id}`);
  }
  if (designs.length && requirements.filter(r => !r.review.candidates.length).some(r => !designed.has(r.id))) throw new Error('A requirement without a candidate has no design theme');
  // Build status (optional per scope): implementation state for design themes. A built primitive
  // never changes a fit verdict; each build item carries its design's requirement IDs so the view
  // can say how many of a work item's requirements it reaches.
  const build = optionalJson('build-status.json') ?? { items: [] };
  if (new Set(build.items.map(b => b.design)).size !== build.items.length) throw new Error('Duplicate build status design');
  for (const b of build.items) {
    const design = designs.find(d => d.id === b.design);
    if (!design) throw new Error(`Build status names an unknown design: ${b.design}`);
    if (!['built', 'in_progress', 'selected'].includes(b.state)) throw new Error(`Unknown build state: ${b.design}/${b.state}`);
    if (b.work && !workItems.some(w => w.id === b.work)) throw new Error(`Build status names an unknown work item: ${b.work}`);
    if (b.state !== 'selected' && !catalog.some(p => p.id === b.primitive)) throw new Error(`Build status primitive is not in the live catalog: ${b.primitive}`);
    if (b.state === 'built') { for (const f of ['date', 'built', 'verified', 'owed']) if (!b[f]?.trim()) throw new Error(`Missing build field: ${b.design}/${f}`); }
    else if (!b.next?.trim()) throw new Error(`Design needs a next step: ${b.design}`);
    for (const p of b.reports ?? []) if (!existsSync(resolve(root, p))) throw new Error(`Missing build report: ${p}`);
    // A build may address a subset of its design's requirements (one birth mode of several planned).
    const designIds = design.requirements.map(r => r.id);
    for (const id of b.requirementIds ?? []) if (!designIds.includes(id)) throw new Error(`Build requirement outside its design: ${b.design}/${id}`);
    b.requirements = b.requirementIds ?? designIds;
  }
  const counts = Object.fromEntries(['candidate', 'partial', 'development'].map(k => [k, requirements.filter(r => r.review.fit === k).length]));
  const probed = new Set(evidence.map(e => e.id));
  const verification = optionalJson('verification.json') ?? scope.verification ?? { tests: 0, suites: 0, note: 'No code verification recorded for this scope.' };
  // Sibling scopes that have already been built are linked from the matrix.
  const summary = { scope: scope.id, subject: scope.subject, grade: scope.grade, title: scope.title, dir: scope.dir, requirements: requirements.length, counts, probedPairs: probed.size, draws: evidence.length, generated: new Date().toISOString() };
  writeFileSync(resolve(dir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  const scopes = Object.values(SCOPES).filter(s => s.id !== scope.id && existsSync(resolve(root, s.dir, 'summary.json'))).map(s => {
    const sm = JSON.parse(readFileSync(resolve(root, s.dir, 'summary.json'), 'utf8'));
    return { ...sm, href: relative(dir, resolve(root, s.dir, 'index.html')).replace(/\\/g, '/') };
  });
  const data = {
    generated: summary.generated, subject: snapshot.subject, grade: scope.grade, title: scope.title,
    snapshotPath, snapshotHash: hash(raw), fetchedAt: statSync(resolve(root, snapshotPath)).mtime.toISOString(),
    sourceUrl: curriculumUrl(scope).replace('127.0.0.1', 'localhost'),
    catalogHash: hash(JSON.stringify(catalog)), catalog, requirements, workItems, designs, scopes,
    probe: { pairs: probed.size, draws: evidence.length, summary: scope.probeSummary },
    hasDesignStudio: designs.length > 0, build,
    verification,
  };
  const template = readFileSync(resolve(root, 'scripts/lib/curriculum-coverage-artifact.html'), 'utf8');
  const html = template.replace('/*__DATA__*/null', () => JSON.stringify(data).replace(/</g, '\\u003c'))
    .replace('/*__VIEW__*/', () => readFileSync(resolve(root, 'scripts/lib/curriculum-coverage-view.js'), 'utf8'));
  const output = resolve(outDir, 'index.html');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, html);
  if (designs.length) {
    const designHtml = readFileSync(resolve(root, 'scripts/lib/curriculum-design-studio.html'), 'utf8')
      .replace('/*__DESIGNS__*/null', () => JSON.stringify({ designs, generated: data.generated, grade: data.grade, subject: data.subject, requirementCount: designed.size, build: build.items }).replace(/</g, '\\u003c'))
      .replace('/*__STUDIO__*/', () => readFileSync(resolve(root, 'scripts/lib/curriculum-design-studio.js'), 'utf8'));
    writeFileSync(resolve(outDir, 'design-studio.html'), designHtml);
  }
  console.log(JSON.stringify({ scope: scope.id, output, requirements: requirements.length, primitives: catalog.length, counts, probedPairs: probed.size, draws: evidence.length, linkedScopes: scopes.map(s => s.scope) }));
} finally { await server.close(); }
