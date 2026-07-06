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

const result = spawnSync(tscBin, ['--noEmit'], {
  cwd: path.join(__dirname, '..'),
  encoding: 'utf8',
  shell: process.platform === 'win32', // .cmd shim needs a shell on Windows
});

// tsc prints diagnostics to stdout. Normalise separators so the marker matches
// on Windows (backslash paths) too.
const output = `${result.stdout || ''}${result.stderr || ''}`.replace(/\\/g, '/');

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
