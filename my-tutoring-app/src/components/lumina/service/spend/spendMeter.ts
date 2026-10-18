/**
 * Daily Gemini spend meter (USER RULING 2026-10-17). Gemini has no daily cap, and on 10-15/10-16 automated test
 * runs spent ~$90 a day before anyone saw it. Every call through the shared `ai` client is priced from its
 * usageMetadata and appended to `<repo>/.gemini-spend/<PST date>.jsonl`; a call from an automated source is refused
 * once that source's spend today reaches its cap.
 *
 * Sources:
 *   agent   — a process started by Claude Code (`LUMINA_AGENT=1`, set in .claude/settings.json `env`)
 *   harness — a request to a test route (/api/lumina/eval-test), wherever the server was started
 *   app     — everything else: the real app. Uncapped unless LUMINA_APP_DAILY_USD is set.
 * Cap: LUMINA_AGENT_DAILY_USD (default 5) covers agent + harness together.
 *
 * The meter fails open: a ledger read or write error never blocks a call. Prices are list estimates (USD per 1M
 * tokens, thinking billed as output, cached input at 10%); the Google bill is the truth. `node scripts/gemini-spend.mjs`
 * prints today's totals.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { appendFileSync, existsSync, mkdirSync, openSync, readSync, closeSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export type SpendSource = 'agent' | 'harness' | 'app';

interface Usage {
  promptTokenCount?: number;
  cachedContentTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
}

// [input, output] USD per 1M tokens. First match wins; aliases resolve as Google bills them (10-17).
const PRICES: Array<[RegExp, number, number]> = [
  [/image/, 0.3, 30],
  [/2\.5-flash-lite/, 0.1, 0.4],
  [/flash-lite/, 0.3, 2.5],
  [/2\.5-flash/, 0.3, 2.5],
  [/flash/, 0.75, 3.75],
];
const FALLBACK: [number, number] = [0.75, 3.75];

export function priceCall(model: string, u: Usage | undefined): number {
  if (!u) return 0;
  const [inP, outP] = PRICES.find(([re]) => re.test(model))?.slice(1) as [number, number] ?? FALLBACK;
  const cached = u.cachedContentTokenCount ?? 0;
  const fresh = Math.max(0, (u.promptTokenCount ?? 0) - cached);
  const out = (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0);
  return (fresh * inP + cached * inP * 0.1 + out * outP) / 1e6;
}

const scope = new AsyncLocalStorage<{ source: SpendSource; label?: string }>();

/** Run `fn` with every Gemini call inside it attributed to `source` (used by test routes). */
export function withSpendSource<T>(source: SpendSource, label: string | undefined, fn: () => T): T {
  return scope.run({ source, label }, fn);
}

export function currentSource(): { source: SpendSource; label?: string } {
  return scope.getStore() ?? { source: process.env.LUMINA_AGENT === '1' ? 'agent' : 'app' };
}

function findRepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, '.claude')) && existsSync(join(dir, 'my-tutoring-app'))) return dir;
    dir = dirname(dir);
  }
  return resolve(process.cwd(), '..');
}

const LEDGER_DIR = process.env.LUMINA_SPEND_DIR || join(findRepoRoot(), '.gemini-spend');

export function pstDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(now);
}

// Per-day running totals, read incrementally so other processes' lines (scripts, a second server) count too.
let day = '';
let offset = 0;
let partial = '';
const totals: Record<SpendSource, number> = { agent: 0, harness: 0, app: 0 };

function refresh(): void {
  const today = pstDate();
  const file = join(LEDGER_DIR, `${today}.jsonl`);
  const size = existsSync(file) ? statSync(file).size : 0;
  // A new day, or a ledger someone trimmed by hand: start the count over from the file.
  if (today !== day || size < offset) { day = today; offset = 0; partial = ''; totals.agent = totals.harness = totals.app = 0; }
  if (size <= offset) return;
  const fd = openSync(file, 'r');
  try {
    const buf = Buffer.alloc(size - offset);
    readSync(fd, buf, 0, buf.length, offset);
    offset = size;
    const lines = (partial + buf.toString('utf8')).split('\n');
    partial = lines.pop() ?? '';
    for (const line of lines) {
      if (!line) continue;
      try {
        const row = JSON.parse(line) as { source: SpendSource; usd: number };
        if (row.source in totals) totals[row.source] += row.usd;
      } catch { /* a torn line from a concurrent writer */ }
    }
  } finally { closeSync(fd); }
}

export function spentToday(): Record<SpendSource, number> {
  try { refresh(); } catch { /* fail open */ }
  return { ...totals };
}

function cap(name: string, fallback: number | null): number | null {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export class GeminiBudgetError extends Error {}

/** Throws before the request is sent when the caller's source is over today's cap. */
export function assertBudget(source: SpendSource): void {
  const spent = spentToday();
  if (source === 'app') {
    const appCap = cap('LUMINA_APP_DAILY_USD', null);
    if (appCap !== null && spent.app >= appCap) {
      throw new GeminiBudgetError(`Daily Gemini budget for the app reached ($${spent.app.toFixed(2)} of $${appCap.toFixed(2)}, resets midnight PST).`);
    }
    return;
  }
  const autoCap = cap('LUMINA_AGENT_DAILY_USD', 5)!;
  const auto = spent.agent + spent.harness;
  if (auto >= autoCap) {
    throw new GeminiBudgetError(
      `LUMINA_BUDGET: automated Gemini spend today is $${auto.toFixed(2)} of the $${autoCap.toFixed(2)} cap ` +
      `(agent + test routes; resets midnight PST). Do not work around this: stop and tell the user. ` +
      `The user can raise LUMINA_AGENT_DAILY_USD.`,
    );
  }
}

export function recordCall(model: string, usage: Usage | undefined, src: { source: SpendSource; label?: string }): void {
  try {
    const usd = priceCall(model, usage);
    mkdirSync(LEDGER_DIR, { recursive: true });
    const row = {
      t: new Date().toISOString(), model, source: src.source, label: src.label,
      in: usage?.promptTokenCount ?? 0, cached: usage?.cachedContentTokenCount ?? 0,
      out: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0), usd: Number(usd.toFixed(6)),
    };
    appendFileSync(join(LEDGER_DIR, `${pstDate()}.jsonl`), JSON.stringify(row) + '\n');
  } catch { /* fail open */ }
}

interface MeterableClient {
  models: {
    generateContent: (params: { model: string } & Record<string, unknown>) => Promise<{ usageMetadata?: Usage }>;
    generateContentStream: (params: { model: string } & Record<string, unknown>) => Promise<AsyncGenerator<{ usageMetadata?: Usage }>>;
  };
}

/** Wraps the client's two call paths in place (the codebase calls nothing else on `ai`) and returns it. */
export function meterClient<T>(client: T): T {
  const models = (client as unknown as MeterableClient).models;
  const generate = models.generateContent.bind(models);
  const stream = models.generateContentStream.bind(models);
  models.generateContent = async (params) => {
    const src = currentSource();
    assertBudget(src.source);
    const res = await generate(params);
    recordCall(params.model, res?.usageMetadata, src);
    return res;
  };
  models.generateContentStream = async (params) => {
    const src = currentSource();
    assertBudget(src.source);
    const it = await stream(params);
    return (async function* () {
      let last: Usage | undefined;
      try {
        for await (const chunk of it) { if (chunk?.usageMetadata) last = chunk.usageMetadata; yield chunk; }
      } finally { recordCall(params.model, last, src); }
    })();
  };
  return client;
}
