/**
 * Block splitter — Stage 2 of the annotated-example pipeline.
 *
 * The solver emits prose with `---` separators between strategic moves. This
 * module splits on those separators deterministically. No LLM. The solver
 * already decided where one move ends and the next begins; re-deriving that
 * boundary downstream just loses information.
 *
 * One block → one rendered step. Always.
 */

export interface SolverBlock {
  /** Position in the solver's output, starting at 0. */
  index: number;
  /** The block's prose, with leading/trailing whitespace stripped. Inline KaTeX preserved. */
  prose: string;
}

/**
 * Split the solver's body on `---` lines into ordered blocks.
 * Throws if no non-empty blocks are produced (means the solver returned nothing usable).
 */
export function splitSolverBlocks(body: string): SolverBlock[] {
  const blocks = body
    .split(/^\s*---\s*$/m)
    .map((b, i) => ({ index: i, prose: b.trim() }))
    .filter((b) => b.prose.length > 0)
    // Re-index after filtering empties so indices are contiguous.
    .map((b, i) => ({ index: i, prose: b.prose }));

  if (blocks.length === 0) {
    throw new Error('Block splitter produced zero non-empty blocks from solver body');
  }

  console.log(`[Blocks] Split into ${blocks.length} block(s)`);
  for (const b of blocks) {
    const preview = b.prose.replace(/\s+/g, ' ').slice(0, 80);
    console.log(`[Blocks]   block ${b.index}: ${preview}${b.prose.length > 80 ? '…' : ''}`);
  }

  return blocks;
}
