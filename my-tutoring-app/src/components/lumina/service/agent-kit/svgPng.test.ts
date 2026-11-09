import { describe, expect, it } from 'vitest';
import { svgToPng } from './svgPng';

const page = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">${body}</svg>`;
const png = async (svg: string) => {
  const r = await svgToPng(svg, 400);
  if ('error' in r) throw new Error(r.error);
  return r.png;
};

describe('svgToPng', () => {
  it('draws a PNG at the width asked for', async () => {
    const out = await png(page('<rect width="50" height="50" fill="#e11"/>'));
    expect(out.subarray(1, 4).toString()).toBe('PNG');
    expect(out.readUInt32BE(16)).toBe(400);
  });

  it.each(['Arial', 'sans-serif', 'Georgia, serif', 'NoSuchFontAnywhere'])('draws text set in %s', async (family) => {
    const blank = await png(page(''));
    const text = await png(page(`<text x="10" y="50" font-size="24" font-family="${family}">Stamen 12</text>`));
    expect(text.length).toBeGreaterThan(blank.length + 200);
  });

  it('draws text with no font family at all', async () => {
    const blank = await png(page(''));
    expect((await png(page('<text x="10" y="50" font-size="24">Stamen</text>'))).length).toBeGreaterThan(blank.length + 200);
  });

  it('accepts a drawing with no xmlns, the way an author often writes one', async () => {
    expect('png' in await svgToPng(`<svg viewBox='0 0 100 100'><circle cx='50' cy='50' r='40'/></svg>`)).toBe(true);
  });

  it('returns an error for a drawing that is not well-formed XML', async () => {
    expect(await svgToPng(page('<text>salt & water</text>'))).toHaveProperty('error');
  });
});
