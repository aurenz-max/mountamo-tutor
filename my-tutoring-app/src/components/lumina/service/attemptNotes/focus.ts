import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { LearnerNote } from './notes';

// The learner notes of the ONE component being generated. Set by the dispatch site around the generator call,
// read by code that picks items (the word space picker), so a code-built generator needs no wiring of its own.
const current = new AsyncLocalStorage<ReadonlySet<string>>();

/** Run one component's generator with its notes' named items in reach of the pickers. */
export function withNoteFocus<T>(notes: readonly LearnerNote[], run: () => T): T {
  const words = new Set(notes.flatMap(n => n.include ?? []).map(w => w.trim().toLowerCase()).filter(Boolean));
  return words.size ? current.run(words, run) : run();
}

/**
 * The exact items (words, lower case) this learner's notes ask the current component to offer again, or null.
 * A picker may put an item that uses one first among the items its scope and tier already allow; it never
 * widens the scope for one.
 */
export function noteFocusWords(): ReadonlySet<string> | null {
  return current.getStore() ?? null;
}
