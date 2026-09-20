import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * No source file may contain a C0 control byte.
 *
 * On 2026-09-18 three shipped files were found carrying literal backspace bytes
 * (0x08) where their regexes were meant to read `\b`: `liveJourneySpec.ts` (the
 * counting-board worked-example judge), `gemini-length-lab.ts` (seven unit
 * regexes, so a "measure with your hands" objective drew a random unit) and the
 * analog-clock oracle's answer-leak check. Every one of those regexes was dead,
 * and none of them could be seen — an editor, `grep`, a code review and even
 * `String(fn)` all render 0x08 as nothing, so the source reads exactly right
 * while the regex can never match. A writer that interprets `\b` as an escape
 * (a shell heredoc, `sed`, a Python string without `r''`) produces this, and
 * `tsc` accepts it. This byte scan is the only cheap thing that catches it.
 */
const ROOT = resolve(__dirname, '../../..');
const SKIP = new Set(['node_modules', '__snapshots__']);
const EXTENSIONS = ['.ts', '.tsx'];
// Tab, newline and carriage return are the legitimate C0 bytes in source.
const FORBIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    if (SKIP.has(entry)) return [];
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return EXTENSIONS.some((ext) => entry.endsWith(ext)) ? [path] : [];
  });

describe('lumina source bytes', () => {
  it('contains no C0 control characters', () => {
    const offenders = sourceFiles(ROOT)
      .filter((path) => FORBIDDEN.test(readFileSync(path, 'utf8')))
      .map((path) => path.slice(ROOT.length + 1));
    expect(offenders).toEqual([]);
  });
});
