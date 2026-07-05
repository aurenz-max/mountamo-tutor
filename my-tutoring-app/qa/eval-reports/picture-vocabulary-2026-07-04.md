# Eval Report: picture-vocabulary — 2026-07-04

Focus of this run (per request): is the pool schema brittle "due to too many nests?"
**Answer:** The original schema was NOT deeply nested (2 levels). The brittleness came
from **optional fields inside the shared word object** — the `oppositeWord`/`oppositeEmoji`
pair the whole `opposite` mode depended on. Flash Lite dropped them (SP-14 nested variant),
so `opposite` hard-failed, and the same shared pool mixed proxy-emoji adjectives into the
noun-only modes.

**RESOLVED 2026-07-04 via orchestrator refactor** — the single multi-purpose pool schema was
split into three per-category sub-generators (nouns, opposite pairs, frames), each with a FLAT
schema whose fields are ALL REQUIRED. Both issues are structurally eliminated.

## Results (after fix)

| Eval Mode | Status | Notes |
|-----------|--------|-------|
| receptive_match | PASS | nouns-only pool (PV-2 fixed) |
| naming | PASS | nouns-only pool (PV-2 fixed) |
| opposite | PASS | required `pairs[]` schema — 3/3 stochastic runs pass (PV-1 fixed) |
| sentence_frame | PASS | dedicated frame sub-generator; prompt-law held |
| Auto (mixed) | PASS | full 6-rung ladder: receptive×2 → naming×2 → opposite → sentence_frame |

G1/G4 sync verification passed on all four modes: every challenge carries its type's required
fields, the target word appears in exactly one of 4 options, and frames never contain the
target word.

## Fixed Issues

### PV-1 — opposite mode hard-failed on the majority of runs (schema brittleness) — RESOLVED
- **Was:** `opposite` built from the OPTIONAL nested `oppositeWord`/`oppositeEmoji` pair. Flash
  Lite emitted the two halves as separate top-level pool words instead of filling the pair
  fields, so `hasValidOpposite` matched nothing → `filterForMode` returned `[]` → the generator
  threw `Word pool too small after retry: 0/5`. Non-deterministic; the double Gemini call +
  corrective retry also caused HTTP-000 hangs.
- **Fix:** dedicated `generateOppositePairs` sub-generator with a `pairs[{word, emoji, oppositeWord,
  oppositeEmoji}]` schema where **all four fields are required** — Flash Lite can no longer drop a
  half-pair. `expandOpposites` still derives both directions. Removes the double-call latency.
  SP-14 (nested variant), correct-by-construction option (a) from the original recommendation.

### PV-2 — abstract adjectives rendered with proxy-noun emojis in naming/receptive — RESOLVED
- **Was:** the shared pool was asked to include opposites (adjectives), which have no standalone
  emoji, so they borrowed an exemplar noun's emoji (`big → 🐘`, `small → 🐁`). In `naming` the
  child saw 🐘 and would say "elephant" while the judge listened for "big" (G4 mismatch); in
  `receptive_match` a 🐁 card for "small" was indistinguishable from a real "mouse" card.
- **Fix:** `generateNounPool` serves `receptive_match` + `naming` and demands **concrete nouns only,
  emoji IS the referent** — explicitly forbidding adjectives/sizes/feelings and example-emojis.
  Opposites now live solely in `opposite` mode, where options are word-labeled and the base word
  is always shown, so an exemplar emoji is pedagogically fine there.

## Architecture note

Code still owns all challenge structure (`buildChallenge`, `buildOptions`, `assembleSingleMode`,
`assembleMixed`, prompt-law `normalizeFrames`) and the REJECT-never-fabricate contract. Only the
data *source* changed: one multi-purpose Gemini call → three focused calls. Mixed/Auto runs the
three in parallel (`Promise.all`), with the opposite and frame pools best-effort so a thin pool
pads with nouns instead of failing. Mirrors the coin-counter / word-sorter / dot-plot / bar-model
orchestrator refactors that closed SP-14. Component, types, catalog eval modes, and generator
registration are unchanged.
