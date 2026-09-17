/**
 * The SPECIFIC FOCUS prompt line for generators whose taught content is words,
 * letters or sort groups (student-interests rollout row 0, 2026-09-16).
 *
 * Since interests shipped, a manifest intent carries two things: the skill
 * scope ("short a words", "animals and food") and often a theme ("theme it
 * around his dump trucks"). At PreK every component intent is themed. The
 * theme may decorate the carrier; it may not choose what the child is taught.
 * The old line ("lean word/letter choices toward <intent>") let it choose, and
 * a live probe (scripts/probe-literacy-themed-targets.mjs) caught it doing so
 * only when themed: "truck" in 4/4 K decodable passages, a sort's named groups
 * replaced in 8/12 challenges, "asphalt" and "iron" as hidden-letter words,
 * and rarer CVC words (rig, jig) in place of the familiar ones.
 */
export function themedFocusLine(
  topic: string,
  intent: string | undefined,
  opts: {
    /** What the child is taught with, e.g. "target words". */
    targets: string;
    /** Where a theme may show, e.g. "the title". */
    carrier: string;
    /** Allow a couple of everyday theme words among the targets. */
    themeWords?: boolean;
  },
): string {
  if (!intent) return '';
  const themeWords = opts.themeWords
    ? `\n- You MAY use up to 2 theme words among the ${opts.targets}, but only a word that obeys EVERY rule below `
      + `AND that a young child already says every day (dig, mud, bus). Never pick a rarer or harder word because `
      + `it fits the theme (not rig, jig, truck, crane, asphalt).`
    : '';
  return `\nSPECIFIC FOCUS: Beyond the topic "${topic}", this activity serves: "${intent}".
- Take the SKILL and SCOPE from it: a named sound, letter set, word pattern or group is binding.
- A theme or interest in it or in the topic (a child's favorite toys, vehicles or animals) is decoration. Show it in ${opts.carrier}. `
    + `Choose the ${opts.targets} exactly as you would with no theme.${themeWords}\n`;
}
