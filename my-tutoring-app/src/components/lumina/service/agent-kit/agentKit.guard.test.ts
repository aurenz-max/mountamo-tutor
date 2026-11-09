/**
 * Ratchet: an agent primitive runs the kit's author loop (`authorLoop.ts`), never its own copy.
 *
 * The live-tutor history is why this exists: each primitive wired its own tutor path until the boss framework moved
 * them onto presets and `boss.test.ts` stopped new copies. Agent primitives repeated the pattern (four copies of the
 * same tool loop by 11-07). Any file under `components/lumina/` that hands Gemini `functionDeclarations` outside the
 * kit fails here. LEGACY lists the loops not yet ported; it only shrinks.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const KIT = join('service', 'agent-kit') + sep;
/** Loops still to port onto the kit. Remove an entry when its primitive moves; never add one. */
const LEGACY = new Set([
  'service/annotated-example/agent/agent-annotated-example.ts',
  'service/core/deep-dive-agent/agent-deep-dive.ts',
  'service/gen-display/author.ts',
]);

/**
 * Agent primitives whose author is not offered the kit's displays, and why. Only shrinks: a new agent primitive states
 * a `DisplayCapability` and puts `displayPrompt` in its prompt (or runs the item loop, which does).
 */
const NO_DISPLAYS: Record<string, string> = {
  'service/core/wonder-walk/agent-wonder-walk.ts': 'a K walk whose stops are drawn by the world renderer; ten frames as help are queued',
  'service/annotated-example/agent/agent-annotated-example.ts': 'legacy loop, moves with its port to the kit',
  'service/gen-display/author.ts': 'writes interactive display templates; it is not an item author',
};

/**
 * Agent primitives that do not run the kit's look stage, and why. Only shrinks: an author built on `runAuthor` gives
 * `look`, and `runItemLoop` always looks. A lesson about seeing the work reaches every author through that one stage.
 */
const NO_LOOK: Record<string, string> = {
  'service/core/wonder-walk/agent-wonder-walk.ts': 'has its own independent review (wonder-walk/review.ts); moves to the look stage next',
  'service/core/deep-dive-agent/agent-deep-dive.ts': 'its own blind reader and screenshots in a legacy loop; moves with its port',
  'service/annotated-example/agent/agent-annotated-example.ts': 'legacy loop, moves with its port to the kit',
  'service/gen-display/author.ts': 'writes interactive display templates; it is not an item author',
};

/**
 * Agent primitives still given an eval mode as their input. Only shrinks (USER 2026-11-08): an agent primitive takes a
 * topic or objective, builds what fits, and code names the skill afterwards as a label. A mode never refuses a world.
 */
const MODE_INPUT: Record<string, string> = {
  'service/core/wonder-walk/agent-wonder-walk.ts': 'moves after the life-lab pilot (WORKSTREAMS row 16)',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe('agent kit guard', () => {
  const loops = walk(ROOT)
    .filter(p => readFileSync(p, 'utf8').includes('functionDeclarations'))
    .map(p => relative(ROOT, p));

  it('no tool loop outside the kit except the legacy ones', () => {
    const offenders = loops.filter(p => !p.startsWith(KIT) && !LEGACY.has(p.split(sep).join('/')));
    expect(offenders, 'run runAuthor from service/agent-kit/authorLoop.ts instead of a new loop').toEqual([]);
  });

  it('every agent primitive offers the kit displays, or says why not', () => {
    const offersDisplays = (file: string) => {
      const dir = dirname(join(ROOT, file));
      return readdirSync(dir).filter(n => /\.ts$/.test(n) && !/\.test\.ts$/.test(n)).some(n => /displayPrompt\(|surfacePrompt\(/.test(readFileSync(join(dir, n), 'utf8')));
    };
    const authors = Array.from(new Set([
      ...walk(ROOT).filter(p => /runAuthor[<(]|runItemLoop\(/.test(readFileSync(p, 'utf8'))).map(p => relative(ROOT, p).split(sep).join('/')),
      ...Array.from(LEGACY),
    ])).filter(p => !p.startsWith('service/agent-kit/'));
    expect(authors.length).toBeGreaterThan(3);
    const missing = authors.filter(p => !offersDisplays(p) && !(p in NO_DISPLAYS));
    expect(missing, 'state a DisplayCapability and add displayPrompt to the author\'s prompt').toEqual([]);
    const stale = Object.keys(NO_DISPLAYS).filter(p => !authors.includes(p) || offersDisplays(p));
    expect(stale, 'this author offers displays now, or is gone: remove it from NO_DISPLAYS').toEqual([]);
  });

  it('every agent primitive runs the look stage, or says why not', () => {
    const authors = Array.from(new Set([
      ...walk(ROOT).filter(p => /runAuthor[<(]|runItemLoop\(/.test(readFileSync(p, 'utf8'))).map(p => relative(ROOT, p).split(sep).join('/')),
      ...Array.from(LEGACY),
    ])).filter(p => !p.startsWith('service/agent-kit/'));
    const looks = (file: string) => { const src = readFileSync(join(ROOT, file), 'utf8'); return /runItemLoop\(/.test(src) || (/runAuthor[<(]/.test(src) && /\n\s+look: \{/.test(src)); };
    const missing = authors.filter(p => !looks(p) && !(p in NO_LOOK));
    expect(missing, 'give runAuthor a `look` stage: say what the child sees first').toEqual([]);
    const stale = Object.keys(NO_LOOK).filter(p => !authors.includes(p) || looks(p));
    expect(stale, 'this author looks now, or is gone: remove it from NO_LOOK').toEqual([]);
  });

  it('no agent primitive takes an eval mode as its input, or says why it still does', () => {
    const readers = walk(ROOT).map(p => relative(ROOT, p).split(sep).join('/'))
      .filter(p => !p.startsWith('service/agent-kit/') && /\bopenModes\(/.test(readFileSync(join(ROOT, p), 'utf8')));
    expect(readers.filter(p => !(p in MODE_INPUT)), 'build from the topic and objective; classify the finished world as a label').toEqual([]);
    expect(Object.keys(MODE_INPUT).filter(p => !readers.includes(p)), 'this author no longer takes a mode: remove it from MODE_INPUT').toEqual([]);
  });

  it('the legacy list only names loops that still exist', () => {
    const live = new Set(loops.map(p => p.split(sep).join('/')));
    expect(Array.from(LEGACY).filter(p => !live.has(p)), 'a ported loop: remove it from LEGACY').toEqual([]);
  });
});
