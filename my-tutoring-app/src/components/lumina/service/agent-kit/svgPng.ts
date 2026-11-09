/**
 * SVG to PNG with resvg, so an agent author can see what it drew. No browser: serverless hosts have no room for one.
 * resvg loads no fonts of its own and drops text it has no font for without an error, so one font ships in the code
 * (`svgFont.ts`) and every family resolves to it. It reads fonts only from files, so the font is written to the temp
 * directory once. It parses strict XML, unlike the page, so an error names what to fix.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NOTO_SANS_BASE64 } from './svgFont';

const FAMILY = 'Noto Sans';

function fontFile(): string {
  const file = join(tmpdir(), 'lumina-noto-sans-v27.ttf');
  if (!existsSync(file)) writeFileSync(file, Buffer.from(NOTO_SANS_BASE64, 'base64'));
  return file;
}

export type SvgRender = { png: Buffer } | { error: string };

export async function svgToPng(svg: string, width = 760): Promise<SvgRender> {
  try {
    const { Resvg } = await import('@resvg/resvg-js');
    // The page draws an <svg> with no namespace; resvg reads it as having no root.
    const source = svg.replace(/<svg\b(?![^>]*\bxmlns\s*=)/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    const png = new Resvg(source, {
      background: '#fff',
      fitTo: { mode: 'width', value: width },
      font: { loadSystemFonts: false, fontFiles: [fontFile()], defaultFontFamily: FAMILY, sansSerifFamily: FAMILY, serifFamily: FAMILY, monospaceFamily: FAMILY, cursiveFamily: FAMILY, fantasyFamily: FAMILY },
    }).render().asPng();
    return { png: Buffer.from(png) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
