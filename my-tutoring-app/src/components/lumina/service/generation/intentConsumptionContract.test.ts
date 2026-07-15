import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('topic-fidelity intent consumption contract', () => {
  it('keeps every context-native generator connected to a canonical objective axis', () => {
    const projectRoot = path.resolve(__dirname, '../../../../..');
    const output = execFileSync(
      process.execPath,
      ['scripts/audit-intent-consumption.mjs'],
      { cwd: projectRoot, encoding: 'utf8' },
    );

    expect(output).toMatch(/Intent consumption contract passed: \d+\/\d+/);
  });
});
