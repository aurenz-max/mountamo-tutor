/**
 * Compile a generated display's TSX for the sandboxed page. The static checks are early feedback
 * for the authoring agent, not the security boundary: the page runs in an iframe with no
 * same-origin access and a no-network CSP, and that is what isolates it.
 */
import { transform } from 'sucrase';
import { SDK_NAMES, SDK_SOURCE } from './sdkSource';

const MAX_SOURCE = 24_000;

/** Things a display never needs; each one is reported with the reason. */
const FORBIDDEN: Array<[RegExp, string]> = [
  [/^\s*import\s|^\s*export\s/m, 'no import or export: React hooks and the kit are already in scope'],
  [/\brequire\s*\(/, 'no require'],
  [/\b(fetch|XMLHttpRequest|WebSocket|EventSource|navigator\.sendBeacon)\b/, 'no network access'],
  [/\beval\s*\(|\bnew\s+Function\b/, 'no eval'],
  [/\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/, 'no storage'],
  [/\bwindow\.(parent|top|opener)\b|\bpostMessage\b/, 'talk to the lesson only through lumina.scene'],
  [/dangerouslySetInnerHTML|\.innerHTML\b|<script/i, 'no raw HTML'],
  [/\b__lumina\b/, '__lumina is the harness\'s; use the kit controls'],
];

export type CompileResult = { ok: true; js: string } | { ok: false; errors: string[] };

export function compileDisplay(source: string): CompileResult {
  const errors: string[] = [];
  if (source.length > MAX_SOURCE) errors.push(`source is ${source.length} characters; keep it under ${MAX_SOURCE}`);
  if (!/\bfunction\s+Display\s*\(|\bconst\s+Display\s*=/.test(source)) errors.push('define the component as function Display({ params, lumina })');
  for (const [re, why] of FORBIDDEN) if (re.test(source)) errors.push(why);
  const shadowed = SDK_NAMES.filter((n) => new RegExp(`\\b(const|let|var|function|class)\\s+${n}\\b`).test(source));
  if (shadowed.length) errors.push(`do not redeclare kit names: ${shadowed.join(', ')}`);
  if (errors.length) return { ok: false, errors };
  try {
    const js = transform(source, { transforms: ['typescript', 'jsx'], production: true }).code;
    return { ok: true, js };
  } catch (error) {
    return { ok: false, errors: [`does not compile: ${error instanceof Error ? error.message : String(error)}`] };
  }
}

let sdkJs: string | undefined;
/** The kit, compiled once per process. */
export function compiledSdk(): string {
  sdkJs ??= transform(SDK_SOURCE, { transforms: ['jsx'], production: true }).code;
  return sdkJs;
}
