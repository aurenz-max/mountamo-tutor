/**
 * Scaffold Audit — deterministic Tier-1 contract checks for tutoring scaffolds.
 *
 * The tutoring connection is a chain of static contracts:
 *
 *   catalog tutoring block → useLuminaAI({ primitiveType, primitiveData })
 *   → WebSocket auth (LuminaAIContext sends componentDef.tutoring verbatim)
 *   → backend interpolate_template({{key}} ← primitive_data) → system prompt
 *
 * The backend fails SILENTLY: an unresolvable {{key}} renders as '(not set)'
 * with no error or log, so a broken scaffold degrades invisibly into a confused
 * tutor. Every link except "does Gemini behave" is decidable from source + the
 * catalog, which is what this module checks. Code-judged, free, CI-able —
 * the tutoring-layer sibling of service/qa/oracles.
 *
 * SERVER-ONLY: reads component sources from disk (fs). Import from API routes
 * (/api/lumina/tutor-test), never from client code.
 */

import fs from 'fs';
import path from 'path';
import type { ComponentDefinition, TutoringScaffold } from '../../../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FindingSeverity = 'CRITICAL' | 'HIGH' | 'WARN' | 'INFO';

export interface ScaffoldFinding {
  /** Stable check id, e.g. 'template-var-unresolvable' */
  check: string;
  severity: FindingSeverity;
  message: string;
}

export interface ScaffoldAuditResult {
  componentId: string;
  status: 'pass' | 'warn' | 'fail';
  /** Repo-relative source files that wire useLuminaAI with this primitiveType. */
  componentFiles: string[];
  /**
   * Top-level keys of the primitiveData bag passed to useLuminaAI —
   * the ONLY key space {{vars}} and contextKeys resolve against at runtime
   * (LuminaAIContext sends primitive_data verbatim; topic/grade_level travel
   * separately and are NOT merged in). null = could not parse statically.
   */
  dataBagKeys: string[] | null;
  /** Bag contains spreads/computed keys — key set is open, checks downgrade to WARN. */
  dataBagDynamic: boolean;
  contextKeys: string[];
  /** Every {{var}} referenced anywhere in the scaffold (recursive over all strings). */
  templateVars: string[];
  /** [TAG] tokens emitted by the component's sendText calls. */
  sendTextTags: string[];
  findings: ScaffoldFinding[];
}

export interface SweepResult {
  totalScaffolds: number;
  statusCounts: { pass: number; warn: number; fail: number };
  /** primitiveType literals wired in source that match NO catalog id (tutoring:null at runtime). */
  staleHookIds: Array<{ id: string; files: string[] }>;
  /** Catalog ids wired with useLuminaAI but no tutoring block (generic tutor — expected at L0). */
  hookNoScaffold: string[];
  results: ScaffoldAuditResult[];
}

export interface SourceIndex {
  /** repo-relative path (forward slashes) → file content */
  files: Map<string, string>;
  appRoot: string;
}

// ---------------------------------------------------------------------------
// Source index
// ---------------------------------------------------------------------------

const SCAN_DIRS = ['src/components/lumina', 'src/contexts'];

export function buildSourceIndex(appRoot: string = process.cwd()): SourceIndex {
  const files = new Map<string, string>();
  for (const dir of SCAN_DIRS) {
    walk(path.join(appRoot, dir), appRoot, files);
  }
  return { files, appRoot };
}

function walk(absDir: string, appRoot: string, out: Map<string, string>): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const abs = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__' || entry.name === 'docs') continue;
      walk(abs, appRoot, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
      try {
        out.set(path.relative(appRoot, abs).replace(/\\/g, '/'), fs.readFileSync(abs, 'utf8'));
      } catch {
        /* unreadable file — skip */
      }
    }
  }
}

/** Files that declare primitiveType literals without BEING the primitive (dev benches). */
function isBenchFile(relPath: string): boolean {
  return /LuminaTutorTester|DevPanelRouter/.test(relPath);
}

/** Catalog files contain the scaffold text itself — never count them as emission/wiring sites. */
function isCatalogFile(relPath: string): boolean {
  return relPath.includes('service/manifest/catalog');
}

// ---------------------------------------------------------------------------
// Lightweight TS scanner (string/comment/template-aware balanced matching)
// ---------------------------------------------------------------------------

/** Index of the delimiter matching src[openIdx] ('(' | '{' | '['), or -1. */
function findMatching(src: string, openIdx: number): number {
  const open = src[openIdx];
  const close = open === '(' ? ')' : open === '{' ? '}' : open === '[' ? ']' : null;
  if (!close) return -1;
  let depth = 0;
  let i = openIdx;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i);
      if (nl === -1) return -1;
      i = nl;
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      if (end === -1) return -1;
      i = end + 2;
      continue;
    }
    if (ch === "'" || ch === '"') {
      i = skipQuoted(src, i);
      if (i === -1) return -1;
      continue;
    }
    if (ch === '`') {
      i = skipTemplate(src, i);
      if (i === -1) return -1;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

/** i at the opening quote; returns index AFTER the closing quote. */
function skipQuoted(src: string, i: number): number {
  const q = src[i];
  i++;
  while (i < src.length) {
    if (src[i] === '\\') {
      i += 2;
      continue;
    }
    if (src[i] === q) return i + 1;
    if (src[i] === '\n') return i + 1; // unterminated — bail without looping forever
    i++;
  }
  return -1;
}

/** i at the opening backtick; returns index AFTER the closing backtick. */
function skipTemplate(src: string, i: number): number {
  i++;
  while (i < src.length) {
    if (src[i] === '\\') {
      i += 2;
      continue;
    }
    if (src[i] === '`') return i + 1;
    if (src[i] === '$' && src[i + 1] === '{') {
      const end = findMatching(src, i + 1);
      if (end === -1) return -1;
      i = end + 1;
      continue;
    }
    i++;
  }
  return -1;
}

/** Split object-literal INNER content (no outer braces) at depth-1 commas. */
function splitTopLevel(src: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i);
      if (nl === -1) break;
      i = nl;
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      if (end === -1) break;
      i = end + 2;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const next = skipQuoted(src, i);
      if (next === -1) break;
      i = next;
      continue;
    }
    if (ch === '`') {
      const next = skipTemplate(src, i);
      if (next === -1) break;
      i = next;
      continue;
    }
    if (ch === '(' || ch === '{' || ch === '[') {
      const m = findMatching(src, i);
      if (m === -1) break;
      i = m + 1;
      continue;
    }
    if (ch === ',') {
      parts.push(src.slice(start, i));
      start = i + 1;
    }
    i++;
  }
  parts.push(src.slice(start));
  return parts;
}

const LEADING_TRIVIA = /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)+/;

/** Extract top-level keys from an object literal (WITH outer braces). */
export function extractObjectKeys(objSrc: string): { keys: string[]; dynamic: boolean } {
  const inner = objSrc.slice(1, -1);
  const keys: string[] = [];
  let dynamic = false;
  for (const rawSegment of splitTopLevel(inner)) {
    const seg = rawSegment.replace(LEADING_TRIVIA, '').trim();
    if (!seg) continue; // trailing comma
    if (seg.startsWith('...')) {
      dynamic = true; // spread — key set is open
      continue;
    }
    if (seg.startsWith('[')) {
      dynamic = true; // computed key
      continue;
    }
    let m = /^(['"])((?:\\.|(?!\1).)*)\1\s*:/.exec(seg);
    if (m) {
      keys.push(m[2]);
      continue;
    }
    m = /^([A-Za-z_$][\w$]*)\s*[:(]/.exec(seg); // `key: value` or method `key(…)`
    if (m) {
      keys.push(m[1]);
      continue;
    }
    m = /^([A-Za-z_$][\w$]*)\s*$/.exec(seg); // shorthand
    if (m) {
      keys.push(m[1]);
      continue;
    }
    dynamic = true; // unrecognized construct — be honest that the set is open
  }
  return { keys, dynamic };
}

// ---------------------------------------------------------------------------
// Component-side extraction
// ---------------------------------------------------------------------------

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Regex matching a literal primitiveType wiring site for this id. */
function primitiveTypeSiteRe(id: string): RegExp {
  // matches:  primitiveType: ‹id›  |  primitiveType=‹id›  |  primitiveType={‹id›}  (quoted literals)
  return new RegExp(`primitiveType\\s*[:=]\\s*\\{?\\s*['"]${escapeRegex(id)}['"]`);
}

/**
 * Resolve `const <name> = …object literal…` in a file, unwrapping
 * useMemo(() => ({…})) and block bodies with a leading `return {…}`.
 * Returns the object literal source (with braces) or null.
 */
function resolveObjectLiteral(content: string, name: string): string | null {
  const declRe = new RegExp(`const\\s+${escapeRegex(name)}\\b[^=\\n]*=\\s*`);
  const m = declRe.exec(content);
  if (!m) return null;
  let i = m.index + m[0].length;

  const memoRe = /^(?:React\.)?useMemo(?:<[^>]*>)?\s*\(\s*\(\)\s*=>\s*\(?\s*/;
  const mm = memoRe.exec(content.slice(i));
  if (mm) i += mm[0].length;

  while (i < content.length && /\s/.test(content[i])) i++;
  if (content[i] !== '{') return null;
  let end = findMatching(content, i);
  if (end === -1) return null;
  let obj = content.slice(i, end + 1);

  // Block body: useMemo(() => { … return {…}; })
  const blockReturn = /^\{(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*return\b/.exec(obj);
  if (blockReturn) {
    const retIdx = i + blockReturn[0].length;
    let j = retIdx;
    while (j < content.length && /[\s(]/.test(content[j])) j++;
    if (content[j] !== '{') return null;
    end = findMatching(content, j);
    if (end === -1) return null;
    obj = content.slice(j, end + 1);
  }
  return obj;
}

interface HookSiteAnalysis {
  /** null = no parseable bag found in this file */
  keys: string[] | null;
  dynamic: boolean;
}

/** Analyze the useLuminaAI call wiring `id` in this file; extract its data-bag keys. */
function analyzeHookSite(content: string, id: string): HookSiteAnalysis {
  const siteRe = primitiveTypeSiteRe(id);
  const hookRe = /useLuminaAI\s*\(/g;
  let hm: RegExpExecArray | null;
  while ((hm = hookRe.exec(content)) !== null) {
    const openIdx = hm.index + hm[0].length - 1;
    const closeIdx = findMatching(content, openIdx);
    if (closeIdx === -1) continue;
    const args = content.slice(openIdx + 1, closeIdx);
    if (!siteRe.test(args)) continue;

    // Found the hook call for this id — locate its primitiveData value.
    const pd = /primitiveData\s*:\s*/.exec(args);
    if (pd) {
      const valStart = pd.index + pd[0].length;
      if (args[valStart] === '{') {
        const objEnd = findMatching(args, valStart);
        if (objEnd !== -1) {
          const parsed = extractObjectKeys(args.slice(valStart, objEnd + 1));
          return { keys: parsed.keys, dynamic: parsed.dynamic };
        }
        return { keys: null, dynamic: true };
      }
      const idm = /^([A-Za-z_$][\w$]*)/.exec(args.slice(valStart));
      if (idm) {
        const obj = resolveObjectLiteral(content, idm[1]);
        if (obj) {
          const parsed = extractObjectKeys(obj);
          return { keys: parsed.keys, dynamic: parsed.dynamic };
        }
      }
      return { keys: null, dynamic: true };
    }
    // Shorthand `primitiveData,` — a prop passed straight through; opaque here.
    if (/\bprimitiveData\s*[,}]/.test(args)) return { keys: null, dynamic: true };
    return { keys: null, dynamic: true };
  }
  return { keys: null, dynamic: false };
}

interface SendTextCall {
  tag: string | null;
  silent: boolean;
}

const TAG_RE = /\[([A-Z][A-Z0-9_]+)\]/;

/** All sendText(…) calls in a file (including destructure renames of sendText). */
function analyzeSendTextCalls(content: string): SendTextCall[] {
  const aliases = new Set<string>(['sendText']);
  const renameRe = /\bsendText\s*:\s*([A-Za-z_$][\w$]*)/g;
  let rm: RegExpExecArray | null;
  while ((rm = renameRe.exec(content)) !== null) aliases.add(rm[1]);

  const calls: SendTextCall[] = [];
  for (const alias of Array.from(aliases)) {
    const callRe = new RegExp(`(?<![\\w$.])${escapeRegex(alias)}\\s*\\(`, 'g');
    let cm: RegExpExecArray | null;
    while ((cm = callRe.exec(content)) !== null) {
      const openIdx = cm.index + cm[0].length - 1;
      const closeIdx = findMatching(content, openIdx);
      if (closeIdx === -1) continue;
      const args = content.slice(openIdx + 1, closeIdx);
      // Skip declarations/types that happen to look like calls
      if (/^\s*\)/.test(args) && args.trim() === '') continue;
      const tagMatch = TAG_RE.exec(args);
      calls.push({
        tag: tagMatch ? tagMatch[1] : null,
        silent: /silent\s*:\s*true/.test(args),
      });
    }
  }
  return calls;
}

// ---------------------------------------------------------------------------
// Scaffold-side extraction
// ---------------------------------------------------------------------------

const TEMPLATE_VAR_RE = /\{\{(\w+)\}\}/g;

/** Recursively collect {{var}} names from every string in the scaffold. */
export function collectTemplateVars(node: unknown, out: Set<string> = new Set()): Set<string> {
  if (typeof node === 'string') {
    let m: RegExpExecArray | null;
    TEMPLATE_VAR_RE.lastIndex = 0;
    while ((m = TEMPLATE_VAR_RE.exec(node)) !== null) out.add(m[1]);
  } else if (Array.isArray(node)) {
    for (const item of node) collectTemplateVars(item, out);
  } else if (node && typeof node === 'object') {
    for (const value of Object.values(node)) collectTemplateVars(value, out);
  }
  return out;
}

/** {{var}} names appearing only in student-audible script sections (levels + struggle responses). */
function collectSpokenSectionVars(scaffold: TutoringScaffold): Set<string> {
  const out = new Set<string>();
  collectTemplateVars(scaffold.scaffoldingLevels, out);
  for (const s of scaffold.commonStruggles ?? []) collectTemplateVars(s.response, out);
  return out;
}

const ANSWER_KEY_RE = /correct|answer|solution/i;

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export function auditScaffold(entry: ComponentDefinition, index: SourceIndex): ScaffoldAuditResult {
  const scaffold = entry.tutoring as TutoringScaffold;
  const findings: ScaffoldFinding[] = [];

  // --- Locate wiring sites ---------------------------------------------------
  const siteRe = primitiveTypeSiteRe(entry.id);
  const componentFiles: string[] = [];
  for (const [rel, content] of Array.from(index.files)) {
    if (isCatalogFile(rel) || isBenchFile(rel)) continue;
    if (siteRe.test(content)) componentFiles.push(rel);
  }

  if (componentFiles.length === 0) {
    findings.push({
      check: 'orphan-scaffold-no-hook',
      severity: 'HIGH',
      message:
        `Catalog has a tutoring block but no component wires useLuminaAI with primitiveType '${entry.id}' — `
        + 'the scaffold is never sent; students get the generic tutor.',
    });
    return finalize(entry.id, findings, componentFiles, null, false, scaffold, []);
  }

  // --- Extract the data bag ---------------------------------------------------
  let dataBagKeys: string[] | null = null;
  let dataBagDynamic = false;
  const keyUnion = new Set<string>();
  let anyParsed = false;
  for (const rel of componentFiles) {
    const analysis = analyzeHookSite(index.files.get(rel)!, entry.id);
    if (analysis.keys) {
      anyParsed = true;
      for (const k of analysis.keys) keyUnion.add(k);
    }
    if (analysis.dynamic) dataBagDynamic = true;
  }
  if (anyParsed) dataBagKeys = Array.from(keyUnion);
  if (!anyParsed) {
    dataBagDynamic = true;
    findings.push({
      check: 'data-bag-unparsed',
      severity: 'WARN',
      message:
        'Could not statically parse the primitiveData bag — contextKeys/{{var}} checks skipped. '
        + 'Run the &probe=1 tier or verify in the Lumina Tutor Tester.',
    });
  }

  // --- contextKeys ⊆ data bag --------------------------------------------------
  const contextKeys = scaffold.contextKeys ?? [];
  if (dataBagKeys) {
    const bag = new Set(dataBagKeys);
    for (const key of contextKeys) {
      if (!bag.has(key)) {
        findings.push({
          check: 'context-key-unresolvable',
          severity: dataBagDynamic ? 'WARN' : 'HIGH',
          message:
            `contextKey '${key}' is not in the component's primitiveData bag — `
            + `the RUNTIME STATE line will read "${key}: (not set)".`
            + (dataBagDynamic ? ' (bag has dynamic keys — verify at runtime)' : ''),
        });
      }
    }
  }

  // --- {{templateVars}} ⊆ data bag ---------------------------------------------
  const templateVars = Array.from(collectTemplateVars(scaffold));
  if (dataBagKeys) {
    const bag = new Set(dataBagKeys);
    for (const v of templateVars) {
      if (!bag.has(v)) {
        findings.push({
          check: 'template-var-unresolvable',
          severity: dataBagDynamic ? 'WARN' : 'HIGH',
          message:
            `{{${v}}} is not in the component's primitiveData bag — `
            + `it will interpolate as the literal string '(not set)' in the system prompt.`
            + (dataBagDynamic ? ' (bag has dynamic keys — verify at runtime)' : ''),
        });
      }
    }
  }

  // --- Answer leak in spoken sections ------------------------------------------
  for (const v of Array.from(collectSpokenSectionVars(scaffold))) {
    if (ANSWER_KEY_RE.test(v)) {
      findings.push({
        check: 'answer-leak-in-scaffold',
        severity: 'HIGH',
        message:
          `{{${v}}} is interpolated inside a scaffolding level or struggle response — `
          + 'these are scripts the tutor reads to the student; the answer must never appear in them. '
          + '(Answer keys in contextKeys/RUNTIME STATE are fine — that is tutor-reference only.)',
      });
    }
  }

  // --- sendText analysis --------------------------------------------------------
  const sendTextCalls: SendTextCall[] = [];
  for (const rel of componentFiles) {
    sendTextCalls.push(...analyzeSendTextCalls(index.files.get(rel)!));
  }
  const sendTextTags = Array.from(new Set(sendTextCalls.map((c) => c.tag).filter((t): t is string => !!t)));

  if (sendTextCalls.length === 0) {
    findings.push({
      check: 'no-sendtext-moments',
      severity: 'WARN',
      message:
        'Component never calls sendText — the tutor will go silent after the initial greeting '
        + '(no pedagogical moments are wired).',
    });
  }
  for (const call of sendTextCalls) {
    if (call.tag && !call.silent) {
      findings.push({
        check: 'tagged-sendtext-not-silent',
        severity: 'HIGH',
        message:
          `sendText('[${call.tag}] …') without { silent: true } — system triggers must be silent; `
          + 'non-silent calls claim focus and appear as student chat.',
      });
    }
  }

  // --- aiDirectives promise tags that are actually emitted -----------------------
  const directiveText = (scaffold.aiDirectives ?? []).map((d) => `${d.title}\n${d.instruction}`).join('\n');
  const directiveTags = new Set<string>();
  {
    const re = new RegExp(TAG_RE.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(directiveText)) !== null) directiveTags.add(m[1]);
  }
  for (const tag of Array.from(directiveTags)) {
    const needle = `[${tag}]`;
    let emitted = componentFiles.some((rel) => index.files.get(rel)!.includes(needle));
    if (!emitted) {
      // System-level tags ([CONTEXT UPDATE]-style) are emitted by shared infra, not the component.
      for (const [rel, content] of Array.from(index.files)) {
        if (isCatalogFile(rel)) continue;
        if (content.includes(needle)) {
          emitted = true;
          break;
        }
      }
    }
    if (!emitted) {
      findings.push({
        check: 'directive-tag-never-emitted',
        severity: 'WARN',
        message:
          `aiDirectives reference [${tag}] but no source file ever sends that tag — `
          + 'the directive is dead prompt text (or the trigger was renamed).',
      });
    }
  }

  // --- Shape sanity ---------------------------------------------------------------
  if (!scaffold.taskDescription?.trim()) {
    findings.push({ check: 'scaffold-shape', severity: 'WARN', message: 'taskDescription is empty.' });
  }
  for (const level of ['level1', 'level2', 'level3'] as const) {
    if (!scaffold.scaffoldingLevels?.[level]?.trim()) {
      findings.push({ check: 'scaffold-shape', severity: 'WARN', message: `scaffoldingLevels.${level} is empty.` });
    }
  }

  return finalize(entry.id, findings, componentFiles, dataBagKeys, dataBagDynamic, scaffold, sendTextTags);
}

function finalize(
  componentId: string,
  findings: ScaffoldFinding[],
  componentFiles: string[],
  dataBagKeys: string[] | null,
  dataBagDynamic: boolean,
  scaffold: TutoringScaffold,
  sendTextTags: string[],
): ScaffoldAuditResult {
  const hasFail = findings.some((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH');
  const hasWarn = findings.some((f) => f.severity === 'WARN');
  return {
    componentId,
    status: hasFail ? 'fail' : hasWarn ? 'warn' : 'pass',
    componentFiles,
    dataBagKeys,
    dataBagDynamic,
    contextKeys: scaffold.contextKeys ?? [],
    templateVars: Array.from(collectTemplateVars(scaffold)),
    sendTextTags,
    findings,
  };
}

// ---------------------------------------------------------------------------
// Sweep
// ---------------------------------------------------------------------------

const ANY_PRIMITIVE_TYPE_RE = /primitiveType\s*[:=]\s*\{?\s*['"]([\w-]+)['"]/g;

export function auditAllScaffolds(catalog: ComponentDefinition[], index: SourceIndex): SweepResult {
  const scaffolded = catalog.filter((c) => c.tutoring);
  const results = scaffolded.map((entry) => auditScaffold(entry, index));

  // Coverage: every primitiveType literal wired anywhere in source
  const wiredIds = new Map<string, string[]>();
  for (const [rel, content] of Array.from(index.files)) {
    if (isCatalogFile(rel) || isBenchFile(rel)) continue;
    let m: RegExpExecArray | null;
    ANY_PRIMITIVE_TYPE_RE.lastIndex = 0;
    while ((m = ANY_PRIMITIVE_TYPE_RE.exec(content)) !== null) {
      const files = wiredIds.get(m[1]) ?? [];
      if (!files.includes(rel)) files.push(rel);
      wiredIds.set(m[1], files);
    }
  }

  const catalogIds = new Set<string>(catalog.map((c) => c.id));
  const scaffoldedIds = new Set<string>(scaffolded.map((c) => c.id));
  const staleHookIds: Array<{ id: string; files: string[] }> = [];
  const hookNoScaffold: string[] = [];
  for (const [id, files] of Array.from(wiredIds)) {
    if (!catalogIds.has(id)) staleHookIds.push({ id, files });
    else if (!scaffoldedIds.has(id)) hookNoScaffold.push(id);
  }

  const statusCounts = { pass: 0, warn: 0, fail: 0 };
  for (const r of results) statusCounts[r.status]++;

  return {
    totalScaffolds: scaffolded.length,
    statusCounts,
    staleHookIds,
    hookNoScaffold: hookNoScaffold.sort(),
    results,
  };
}

// ---------------------------------------------------------------------------
// Prompt preview — byte-faithful mirror of the backend's
// get_primitive_specific_instructions (lumina_tutor.py). Keep in sync.
// ---------------------------------------------------------------------------

import { interpolateTemplate } from '../../../utils/interpolateTemplate';

export function buildScaffoldPromptPreview(
  primitiveType: string,
  primitiveData: Record<string, unknown>,
  scaffold: TutoringScaffold | null | undefined,
): string {
  const base = `\n**CURRENT PRIMITIVE: ${primitiveType}**\nGrade Level: ${primitiveData['gradeLevel'] ?? 'K-6'}\n`;

  if (!scaffold) return base + '\nNo specific scaffolding instructions for this primitive type.';

  const taskDesc = interpolateTemplate(scaffold.taskDescription ?? '', primitiveData);

  let contextSection: string;
  if (scaffold.contextKeys && scaffold.contextKeys.length > 0) {
    contextSection = scaffold.contextKeys
      .map((key) => `  ${key}: ${primitiveData[key] ?? '(not set)'}`)
      .join('\n');
  } else {
    contextSection = Object.entries(primitiveData)
      .map(([k, v]) => `  ${k}: ${v}`)
      .join('\n');
  }

  const levels = scaffold.scaffoldingLevels ?? { level1: '', level2: '', level3: '' };
  const level1 = interpolateTemplate(levels.level1 ?? '', primitiveData);
  const level2 = interpolateTemplate(levels.level2 ?? '', primitiveData);
  const level3 = interpolateTemplate(levels.level3 ?? '', primitiveData);

  const struggleLines = (scaffold.commonStruggles ?? []).map(
    (s) => `- ${s.pattern} → "${interpolateTemplate(s.response ?? '', primitiveData)}"`,
  );
  const strugglesSection = struggleLines.length > 0 ? struggleLines.join('\n') : 'None specified';

  let directivesSection = '';
  for (const d of scaffold.aiDirectives ?? []) {
    directivesSection += `\n**${d.title ?? 'DIRECTIVE'}:**\n${interpolateTemplate(d.instruction ?? '', primitiveData)}\n`;
  }

  return `${base}
**TASK:** ${taskDesc}

**RUNTIME STATE:**
${contextSection}

**SCAFFOLDING STRATEGY:**
Level 1: ${level1}
Level 2: ${level2}
Level 3: ${level3}

**COMMON STRUGGLES:**
${strugglesSection}
${directivesSection}`;
}
