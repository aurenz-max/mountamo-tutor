# volcano-island `cool_the_rock` (2026-10-31, `/add-eval-modes`, SB-7, G4-5)

**Mode:** lava samples cooled in different places, shown as rock tiles under the island. For each sample the learner
guesses the rock's look (never graded) and it cools: deep underground (very slowly) makes granite with big crystals;
on the surface (fast) basalt with tiny crystals; in the sea (very fast) obsidian, smooth glass; gassy lava cooled fast
makes pumice, full of holes. Then the learner says where a found rock cooled from its look, and presses Check.
β 3.0, scaffoldingMode 3, answer `tap`.

| Tier | Samples and places |
|---|---|
| easy | underground and sea (two places) |
| medium | underground, surface and sea |
| hard | all three and gassy lava on the surface (pumice) |

**Misses:** `speed_swapped`, `fast_mixup`, `missed_bubbles`. **Levers:** `crystal_zoom` (marks: a magnifying ring on
every rock with its crystals drawn larger) and `one_step_less` (underground and sea, a rock like one of them).
Sessions vary the found rock.

**Verification:** `rockModel.test.ts` 6; mounted test (samples cool after a guess, a slow/fast swap is named, Try
again, right place passes); `test:primitive volcano-island` 729/729; `typecheck:lumina` 0; full tsc 770. Browser
Grade 5 medium `drive-rock.mjs` 16/16. The basalt tile's tiny crystals lined up in stripes; now scattered on a spiral.
$0 Gemini. Hard (pumice) in vitest only.
