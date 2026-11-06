import { describe, expect, it } from 'vitest';
import { buoyancyBand } from './buoyancy-harbor-generator';
import { circuitBand } from './circuit-workbench-generator';
import { volcanoBand } from './volcano-island-generator';
import { marbleBand } from './marble-run-park-generator';
import { waveBand } from './wave-tank-generator';

describe('the science build worlds read the exact grade for their band', () => {
  it.each([['buoyancy', buoyancyBand], ['circuit', circuitBand], ['volcano', volcanoBand], ['marble', marbleBand], ['wave', waveBand]])('%s', (_n, band) => {
    // 'elementary' covers grades 1-5: the exact grade decides.
    expect(band('elementary', '4')).toBe('3-5');
    expect(band('elementary', '1')).toBe('K-2');
    expect(band('kindergarten', 'K')).toBe('K-2');
    // No exact grade: the key, as before.
    expect(band('fourth-grade')).toBe('3-5');
    expect(band('elementary')).toBe('K-2');
  });
});
