#!/usr/bin/env node
/**
 * Scoped typecheck gate for the active Lumina product surface.
 *
 * The repo carries a large backlog of ~1040 TypeScript errors in legacy,
 * pre-Lumina surfaces (lib/WebSocketService, reading/, simulations/, duplicate
 * SyllabusSelector/DrawingWorkspace copies, etc.). That backlog means a plain
 * `tsc --noEmit` always exits non-zero, so it cannot gate anything — a brand new
 * error introduced in components/lumina/ is invisible inside the 1000+ count.
 *
 * This gate runs the same `tsc --noEmit` but only cares about errors located in
 * `src/components/lumina/`. It exits 0 only when that active surface is clean,
 * regardless of the legacy backlog. Filtering by error LOCATION (not the import
 * graph) makes it robust: a legacy file imported by Lumina still reports its
 * error at its own legacy path and is correctly ignored.
 *
 * Usage:  npm run typecheck:lumina
 */
const { spawnSync } = require('child_process');
const path = require('path');

const LUMINA_MARKER = 'components/lumina/';

// Resolve the local tsc binary (works on win32 and posix).
const tscBin = path.join(
  __dirname,
  '..',
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tsc.cmd' : 'tsc'
);

// Quote the binary: with shell:true an unquoted path containing spaces
// ("claude web tutor") silently fails to spawn, tsc never runs, and the empty
// output reads as "0 errors" — a false PASS. Same trap class as bare `npx tsc`.
const result = spawnSync(
  process.platform === 'win32' ? `"${tscBin}"` : tscBin,
  ['--noEmit'],
  {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    shell: process.platform === 'win32', // .cmd shim needs a shell on Windows
    maxBuffer: 64 * 1024 * 1024,
  }
);

// tsc prints diagnostics to stdout. Normalise separators so the marker matches
// on Windows (backslash paths) too.
const output = `${result.stdout || ''}${result.stderr || ''}`.replace(/\\/g, '/');

// Integrity guard: never report PASS unless tsc demonstrably ran. tsc exits 0
// (clean) or 2 (diagnostics); a spawn failure exits 1/null with no `error TS`
// lines — which the location filter below would misread as "0 lumina errors".
if (result.error || result.status === null || (result.status !== 0 && !/error TS\d+/.test(output))) {
  console.error('✗ typecheck-lumina: tsc DID NOT RUN — refusing to report a pass.');
  if (result.error) console.error(String(result.error));
  console.error(output.slice(0, 2000));
  process.exit(1);
}

const luminaErrors = output
  .split(/\r?\n/)
  .filter((line) => line.includes(LUMINA_MARKER) && /error TS\d+/.test(line));

if (luminaErrors.length > 0) {
  console.error(
    `\n✗ Lumina typecheck FAILED — ${luminaErrors.length} error(s) in ${LUMINA_MARKER}:\n`
  );
  console.error(luminaErrors.join('\n'));
  console.error(
    '\nThe active Lumina surface must stay at zero TypeScript errors.\n' +
      '(Legacy non-Lumina errors are intentionally ignored by this gate.)\n'
  );
  process.exit(1);
}

console.log(`✓ Lumina typecheck passed — 0 errors in ${LUMINA_MARKER}`);
process.exit(0);
