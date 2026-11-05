/**
 * Generated displays: ungraded interactive explorables a model writes as TSX against the display
 * kit, validated in a headless browser, and kept as templates. Every display reads all of its
 * content from `params`, so a template is reused by giving it new params, not by writing new code.
 */

/** One input a display reads. `default` is what the template was validated with. */
export interface DisplayParam {
  type: 'number' | 'string' | 'boolean' | 'number[]' | 'string[]';
  description: string;
  default: unknown;
}

/** Move kit controls (by label), then check the page text. Runs on a fresh load. */
export interface DisplayProbe {
  name: string;
  set?: Record<string, unknown>;
  expect?: { includes?: string[]; excludes?: string[] };
}

/** A validated display kept for reuse. */
export interface DisplayTemplate {
  id: string;
  title: string;
  /** The idea it shows, in one sentence: what reuse search matches on. */
  idea: string;
  /** Subject words and grade band, for search. */
  tags: string[];
  source: string;
  params: Record<string, DisplayParam>;
  probes: DisplayProbe[];
  createdAt: string;
  /** How many lessons have used it; promotion to a catalog primitive reads this. */
  uses: number;
}
