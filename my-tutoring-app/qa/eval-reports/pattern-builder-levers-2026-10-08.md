# pattern-builder levers, 2026-10-08 (create) and 2026-10-09 (extend, identify_core, translate, find_rule)

Every mode now has levers. Class sweep (user opt-in 2026-10-08, Phase 2 stop waived): table designed and built in one pass.

## Failures (evidence)
No real-learner evidence for any mode. Demonstration logs, tutor reports, misconception reports: none for pattern-builder.
- **synthetic**: the journey's wrong program (last token swapped: `one_wrong`; identify one token too many: `too_long`),
  `patternBuilderWorkspace.test.ts` rows for every miss.
- **documented**: catalog `commonStruggles` "Cannot identify repeating core", "Growing pattern confusion",
  "Translation difficulty".
- **inferred**: losing one's place in a long translate row; filling an extend blank with the last token (`repeated_last`)
  or restarting the shown row (`started_over`).

**Corrupted evidence, fixed first:** the saved extend payload (`w1-payloads/pattern-builder.extend.json`) keys 3 of 6 AAB
rows as "A B" after "A A B A A B" (c3, c4, c6): the right continuation is marked wrong. The generator now writes extend
and identify_core keys in code (`repeatKey`: the part the shown row repeats, and the tokens that continue it). The saved
payload is unchanged (the journey reads its key as truth); regenerate it at the next sweep refresh.

## Lever table
| Mode | Miss (class) | Lever | Kind | Carrier | Leak rule (code) |
|---|---|---|---|---|---|
| extend / find_rule, repeating row | repeated_last, started_over, one_wrong, two_swapped, several_wrong (synthetic) | `repeat_groups`: a dashed gap in the SHOWN row each time it starts over | help | shown | gaps on shown tokens only, never a blank; never on identify_core (`repeatGroups` null) |
| find_rule (and number extend) | same (synthetic, documented "growing pattern") | `number_line`: the shown numbers as dots on a line spanning only them, an unlabelled hop between neighbours | help | shown | no point or end beyond the shown numbers (`lineLeaks`) |
| identify_core | two_repeats, too_long, too_short, other_part (synthetic, documented) | `core_model`: a model row in pictures off the palette, its own part boxed 3 times, a DIFFERENT shape from the item's part | help | shown | model shape ≠ item part shape; no model picture on palette or row (`coreModelLeaks`) |
| translate | blanks_left, extra_tokens, one_wrong, two_swapped, several_wrong (synthetic, documented) | `place_marker`: ▲ under the next original place, ✓ under each place made, from the learner's own row | help | shown | fact names places only, never a token (`markerFact`) |
| extend (repeating) | repeated_last, started_over, several_wrong | `simpler_row`: A B in other tokens, 1 blank (2 when the part is longer than 2) | simplify | shown | `practiceLeaks`: not the item's row/answer or their start, not another lesson row |
| identify_core | two_repeats, too_long, other_part | `simpler_row`: A B × 3 in other tokens | simplify | shown | same |
| find_rule | repeated_last, started_over, several_wrong | `simpler_row`: add 2/1/10/5 four terms, 1 blank; step ≠ the item's or any number item's still ahead | simplify | shown | same |
| translate | two_swapped, several_wrong | `simpler_row`: B A B A with two key entries | simplify | shown | same |
| create | (unchanged from 10-08) `shape_model`, `shape_ab` | | | | |

Starting position: `easy` starts each mode's help shown (not recorded as a pull); medium/hard released. The existing
`showCore`/`showRule` tier harness is unchanged. On hard, pulling `repeat_groups` replaces the tier's "do not point out
where it starts over" coaching (the gaps now show it).

**No lever (catalog `unanswered`)**: extend/find_rule `blanks_left` (the "?" blanks are already on screen; nothing to
draw) and `extra_tokens` (unreachable: the row stops at the last blank).

**Per-item gaps (no simplify, help only)**: extend A B with one blank; identify_core A B; find_rule adding 1, 2, 5 or 10;
translate A B four long. Each is already the plainest of its mode. In the saved payloads: extend c1/c2 have 2 blanks
(simplify exists), identify c1, find_rule c1/c2, translate c1 are help-only.

## Built
`patternBuilderLevers.ts` (help builders, leak rules, `practiceItem` for every mode), `PatternBuilder.tsx` (generic
simplify pull, `clearWork`, gaps, `HopLine`, core model, place marker, practice label for every mode),
`patternBuilderWorkspace.ts` (`repeatKey`, `repeatedPart` exported), `gemini-pattern-builder.ts` (code-written keys),
`liveJourneySpec.ts` (practice rebuilt with `practiceItem`), catalog `unanswered`.

## Measured
- vitest, pattern-builder files (5): 87/87 (levers file 49: leak rules over 200 random lessons per help, every simplify
  builder over 200 random lessons: same mode, solvable, never the item's row or answer; mounted per mode: pull changes
  screen + `onScreen` fact in one commit, refused pull leaves demand/levers/attempts/HTML unchanged, next attempt records
  the lever, practice ungraded and the full item back blank and credited).
- typecheck:lumina: 0 errors in pattern-builder files (other errors were siblings mid-edit).
- Not run here: journey sweep, tutor replay, Live (batch verify step). Not browser-driven.

## Open
- identify_core rejects a rotation of the part (B C A on an A B C row, `other_part`). Product decision, queued nowhere yet.
- find_rule payload c5 instruction states the rule ("Multiply by 2, then add 1"); generator prose, `/eval-fix`.
- No `docs/contracts/pattern-builder.md` (`/primitive-contract`).
