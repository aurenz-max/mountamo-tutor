/**
 * The kit's run trace: what an agent author is doing while a generation runs. Each step goes to the server console and,
 * when a caller subscribed with `withKitTrace`, to that caller as it happens (the API route streams it to the tester).
 * The events also ship in the run's debug record, so a saved payload keeps its own history.
 *
 * The subscriber travels in AsyncLocalStorage so no generator signature changes to carry it.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export type KitStage = 'write' | 'look' | 'revise' | 'item' | 'run';
export type KitLevel = 'info' | 'warn' | 'error';

export interface KitEvent {
  /** Seconds since the run started. */
  seconds: number;
  stage: KitStage;
  level: KitLevel;
  /** 1-based item number; absent for a whole-run step. */
  item?: number;
  text: string;
  /** Estimated model spend of this run so far, USD. */
  costUsd: number;
}

const MAX_TEXT = 240;
const sinks = new AsyncLocalStorage<(event: KitEvent) => void>();

/** Run `fn` with every kit event inside it delivered to `onEvent`. */
export function withKitTrace<T>(onEvent: (event: KitEvent) => void, fn: () => T): T {
  return sinks.run(onEvent, fn);
}

export function startTrace(tag: string) {
  const started = Date.now();
  const sink = sinks.getStore();
  const events: KitEvent[] = [];
  let costUsd = 0;
  return {
    events,
    get costUsd() { return costUsd; },
    get seconds() { return Math.round((Date.now() - started) / 1000); },
    addCost(usd: number) { costUsd += usd; },
    say(stage: KitStage, text: string, opts: { item?: number; level?: KitLevel } = {}) {
      const level = opts.level ?? 'info';
      const short = text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text;
      const event: KitEvent = {
        seconds: Math.round((Date.now() - started) / 1000), stage, level, text: short, costUsd: +costUsd.toFixed(4),
        ...(opts.item ? { item: opts.item } : {}),
      };
      events.push(event);
      const line = `[${tag}] +${event.seconds}s ${opts.item ? `item ${opts.item} ` : ''}${stage}: ${short}`;
      if (level === 'error') console.error(line); else if (level === 'warn') console.warn(line); else console.log(line);
      sink?.(event);
    },
  };
}

export type KitTrace = ReturnType<typeof startTrace>;

/**
 * One run in one shape, whichever loop ran it (USER 2026-11-08): what it cost, whether it looked at what it built, and
 * which displays it was offered and used. It ships in `agentDebug.run`, so saved payloads can be compared across authors.
 */
export interface RunRecord {
  author: string;
  loop: 'author' | 'item';
  seconds: number;
  costUsd: number;
  items: number;
  /** Model turns in the author loop; revise rounds across all items in the item loop. */
  rounds: number;
  /** `looked` counts reads (an item revised and read again counts twice); `unread` is shipped items no reader saw in their final form. */
  look: { ran: boolean; looked: number; unread: number; screenshots: number; problems: number; skipped?: string };
  /** Null for an author that offers no displays. */
  displays: { offered: readonly string[]; used: Record<string, number> } | null;
}

/** How many times each display kind appears. */
export function tallyDisplays(shown: ReadonlyArray<{ kind: string } | null | undefined>): Record<string, number> {
  const used: Record<string, number> = {};
  for (const d of shown) if (d?.kind) used[d.kind] = (used[d.kind] ?? 0) + 1;
  return used;
}
