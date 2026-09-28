/**
 * `teachingWorkspace.misses` written against the ids a family's check can actually name (handoff 20).
 * `M` is the union the family's miss function returns (`FrameMiss`, `CountMiss`, ...), imported as a type,
 * so a catalog id the check never names, or a misspelled one, is a type error instead of a silent J8 gap.
 */
export function missLists<M extends string>(lists: Readonly<Record<string, readonly M[]>>): Readonly<Record<string, readonly M[]>> {
  return lists;
}

/** The same miss list on several modes. */
export function sameMisses<M extends string>(modes: readonly string[], ids: readonly M[]): Readonly<Record<string, readonly M[]>> {
  return Object.fromEntries(modes.map(mode => [mode, ids]));
}
